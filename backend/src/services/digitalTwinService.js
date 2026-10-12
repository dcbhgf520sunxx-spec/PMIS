const db = require('../db');
const sanitizeHtml = require('sanitize-html');
const M = require('./digitalTwinModel');
const { calculatePaymentSummary } = require('./projectContractRules');
const { deriveContractStatus } = require('./productMaintenanceContractRules');
const { summaryDefinitions, money } = require('./digitalTwinSummary');
const kindPermissions = {
    products: '/products', requirements: '/requirements', projects: '/projects', tasks: '/tasks',
    bugs: '/bugs', planStages: '/projects', planItems: '/projects', contracts: '/projects',
    paymentStages: '/projects', payments: '/projects', maintenance: '/products', orders: '/work-orders'
};
const groupKinds = { requirements: 'requirements', projects: 'projects', plan: 'planItems', tasks: 'tasks', bugs: 'bugs', finance: 'contracts', maintenance: 'maintenance', orders: 'orders' };
const nodeKinds = { product: 'products', requirement: 'requirements', project: 'projects', work: 'tasks', quality: 'bugs', plan: 'planItems', contract: 'contracts', payment: 'payments', maintenance: 'maintenance', order: 'orders' };
const allowedKinds = Object.keys(kindPermissions);
const text = value => sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} });
async function permissions(query, userId) {
    const rows = await query.prepare(`SELECT DISTINCT m.path FROM pms_menu m
    JOIN pms_role_menu rm ON rm.menu_id = m.id JOIN pms_user_role ur ON ur.role_id = rm.role_id
    JOIN pms_role role ON role.id = rm.role_id AND role.is_deleted = 0
    WHERE ur.user_id = ? AND m.is_deleted = 0 AND m.status = 1`).all(userId);
    return new Set(rows.map(row => row.path));
}
async function listProducts(userId) {
    const paths = await permissions(db, userId);
    if (!paths.has('/products')) {
        const err = new Error('需要产品管理权限');
        err.status = 403;
        throw err;
    }
    return db.prepare(`SELECT p.id::text, p.name, COALESCE(u.real_name, '—') AS owner
    FROM pms_product p LEFT JOIN pms_user u ON u.id=p.owner_id WHERE p.is_deleted=0 ORDER BY p.id`).all();
}
function sourceQueries(productId) {
    const source = `LEFT JOIN pms_project p ON p.id=t.project_id AND p.is_deleted=0
    LEFT JOIN pms_requirement req ON req.id=t.requirement_id AND req.is_deleted=0
    WHERE t.is_deleted=0 AND ((t.source_type=1 AND p.product_id=?) OR (t.source_type=2 AND req.product_id=?))`;
    const owner = `LEFT JOIN pms_user u ON u.id=t.owner_id`;
    const scoped = table => `SELECT t.*, COALESCE(u.real_name,'—') AS owner_name FROM ${table} t ${owner} WHERE t.is_deleted=0 AND t.product_id=? ORDER BY t.id`;
    const projectJoin = `JOIN pms_project p ON p.id=t.project_id AND p.is_deleted=0 WHERE t.is_deleted=0 AND p.product_id=?`;
    const contractJoin = `JOIN pms_project_contract c ON c.id=t.contract_id AND c.is_deleted=0 JOIN pms_project p ON p.id=c.project_id AND p.is_deleted=0 WHERE t.is_deleted=0 AND p.product_id=?`;
    return {
        requirements: [scoped('pms_requirement'), [productId]], projects: [scoped('pms_project'), [productId]],
        tasks: [`SELECT t.*, COALESCE((SELECT STRING_AGG(u.real_name,'、' ORDER BY o.sort_order,u.id) FROM pms_task_owner o JOIN pms_user u ON u.id=o.user_id WHERE o.task_id=t.id),'—') AS owner_name FROM pms_task t ${source} ORDER BY t.id`, [productId, productId]],
        bugs: [`SELECT t.*, COALESCE(u.real_name,'—') AS owner_name FROM pms_bug t LEFT JOIN pms_user u ON u.id=t.assignee_id ${source} ORDER BY t.id`, [productId, productId]],
        planStages: [`SELECT t.* FROM pms_project_plan_stage t ${projectJoin} ORDER BY t.sort_order,t.id`, [productId]],
        planItems: [`SELECT t.*, COALESCE(u.real_name,'—') AS owner_name FROM pms_project_plan_item t ${owner} JOIN pms_project_plan_stage st ON st.id=t.stage_id AND st.is_deleted=0 JOIN pms_project p ON p.id=st.project_id AND p.is_deleted=0 WHERE t.is_deleted=0 AND p.product_id=? ORDER BY st.sort_order,t.sort_order,t.id`, [productId]],
        contracts: [`SELECT t.*, t.contract_name AS name FROM pms_project_contract t ${projectJoin} ORDER BY t.id`, [productId]],
        paymentStages: [`SELECT t.* FROM pms_project_payment_stage t ${contractJoin} ORDER BY t.sort_order,t.id`, [productId]],
        payments: [`SELECT t.*, COALESCE(u.real_name,'—') AS owner_name FROM pms_project_payment_record t LEFT JOIN pms_user u ON u.id=t.handler_id JOIN pms_project_payment_stage st ON st.id=t.stage_id AND st.is_deleted=0 JOIN pms_project_contract c ON c.id=st.contract_id AND c.is_deleted=0 JOIN pms_project p ON p.id=c.project_id AND p.is_deleted=0 WHERE t.is_deleted=0 AND p.product_id=? ORDER BY t.payment_month,t.id`, [productId]],
        maintenance: [`SELECT t.*, t.contract_name AS name FROM pms_product_maintenance_contract t WHERE t.is_deleted=0 AND t.product_id=? ORDER BY t.service_start_date,t.id`, [productId]],
        orders: [`SELECT t.*, COALESCE(u.real_name,'—') AS owner_name FROM pms_work_order t LEFT JOIN pms_user u ON u.id=t.follower_id WHERE t.is_deleted=0 AND t.product_id=? ORDER BY t.id`, [productId]]
    };
}
function normalize(row) {
    const out = { ...row };
    for (const key of Object.keys(out))
        if (key === 'id' || key.endsWith('_id'))
            out[key] = out[key] == null ? null : String(out[key]);
    return out;
}
function newestCreatedFirst(a, b) {
    const byCreated = String(b.created_at || '').localeCompare(String(a.created_at || ''));
    if (byCreated) return byCreated;
    const aId = BigInt(a.id), bId = BigInt(b.id);
    return aId < bId ? 1 : aId > bId ? -1 : 0;
}
function priorityFields(kind, row) {
    const field = ({ requirements: 'priority', projects: 'priority', tasks: 'priority', bugs: 'severity', orders: 'urgency' })[kind];
    const priorityCode = field && row[field] != null ? Number(row[field]) : null;
    const ended = kind === 'requirements' ? [33, 34, 36].includes(Number(row.status)) : Number(row.status) === 2;
    const high = kind === 'bugs' ? [3, 4].includes(priorityCode) : priorityCode === 2;
    return { priorityCode, needsAttention: Boolean(field && high && !ended) };
}
function buildSnapshot(data, paths, asOf) {
    const date = asOf.slice(0, 10);
    const product = data.products[0];
    const stats = M.summary(data, date);
    const definitions = summaryDefinitions(stats);
    const groups = Object.entries(definitions).map(([key, d]) => {
        const kind = groupKinds[key];
        const available = paths.has(kindPermissions[kind]);
        return { key, title: d.title, kind, available,
            metrics: d.items.map(([label, value, unit]) => ({ label, value: available ? String(value) : '—', unit })),
            note: available ? d.note : '未获该业务模块授权',
            rows: available ? d.rows.map(([label, value]) => ({ label, value })) : [], explanation: available ? d.explanation : '需要授权对应业务模块后查看。' };
    });
    const x = stats;
    const descriptors = [
        ['product', '产品', product.name, '负责人 ' + product.owner_name],
        ['requirement', '需求池', x.requirements.total, '项需求', `${x.requirements.transferred} 项已转项目`],
        ['project', '项目交付', x.projects.total, '个项目', `${x.projects.active} 进行中 · ${x.projects.done} 已完成`],
        ['contract', '项目合同', money(x.finance.amount), '万元', `${x.finance.contracts} 份合同`],
        ['work', '任务执行', x.tasks.total, '项主任务', `${x.tasks.open} 未完成 · ${x.tasks.subtasks.total} 子任务单列`],
        ['quality', '缺陷质量', x.bugs.total, '项缺陷', `${x.bugs.open} 未关闭 · ${x.bugs.closed} 已关闭`],
        ['plan', '阶段与关键事项', x.plan.done, `/ ${x.plan.total} 项`, `${x.plan.stages} 个阶段 · 事项完成`],
        ['payment', '项目付款', money(x.finance.paid), '万元', `${x.finance.payments} 笔 · 待付 ${money(x.finance.unpaid)} 万`],
        ['maintenance', '当期维保', money(x.maintenance.currentAmount), '万元', `${x.maintenance.current} 份服务中 · ${x.maintenance.past} 份已结束`],
        ['order', '产品工单', x.orders.open, '项待办', `${x.orders.total} 项总量 · ${x.orders.urgent} 紧急`]
    ];
    const nodes = descriptors.map(([key, title, value, unit, note]) => ({ key, title, kind: nodeKinds[key], available: paths.has(kindPermissions[nodeKinds[key]]), value: paths.has(kindPermissions[nodeKinds[key]]) ? String(value) : '—', unit: key === 'product' ? '' : unit, note: paths.has(kindPermissions[nodeKinds[key]]) ? (key === 'product' ? unit : note) : '未获业务授权' }));
    const records = allowedKinds.flatMap(kind => paths.has(kindPermissions[kind]) ? data[kind].slice().sort(newestCreatedFirst).map(r => {
        const chain = M.chain(data, kind, r.id).filter(link => paths.has(kindPermissions[link.kind]));
        const parent = chain.at(-2);
        const project = chain.find(link => link.kind === 'projects');
        const rootRoute = ({ products: 'products', requirements: 'requirements', projects: 'projects', tasks: 'tasks', bugs: 'bugs', orders: 'work-orders' })[kind];
        const amount = r.contract_amount ?? r.payment_amount ?? r.planned_amount;
        const statusCode = kind === 'maintenance'
            ? deriveContractStatus({ ...r, has_successor: data.maintenance.some(next => next.previous_contract_id === r.id) }, date)
            : r.status ?? null;
        const url = rootRoute ? `/${rootRoute}/${r.id}`
            : kind === 'maintenance' ? `/products/${product.id}/maintenance-contracts/${r.id}`
            : project ? `/projects/${project.id}/${['planStages', 'planItems'].includes(kind) ? 'stage-plan' : 'contract-detail'}` : '';
        return { kind, id: r.id, name: text(kind === 'payments' ? `${M.day(r.payment_month).slice(0, 7)}付款 · ${money(Number(amount))}万元` : M.name(r)),
            code: r.contract_code || r.id, status: M.status(kind, r, date), statusCode, owner: r.owner_name || '—',
            value: amount == null ? (r.owner_name || '—') : money(Number(amount)) + ' 万元',
            parentName: parent?.name || (chain.length === 1 && kind !== 'products' ? '来源模块未授权' : product.name),
            chain: chain.map(link => ({ ...link, name: text(link.name) })),
            description: text(r.description || r.remark || r.progress_text || r.content || ''),
            dueDate: M.day(r.current_due_date || r.expected_end_date || r.expected_resolve_date),
            updatedAt: r.updated_at || r.created_at, ...priorityFields(kind, r),
            url };
    }) : []);
    for (const node of nodes) {
        const focused = records.filter(r => r.kind === node.kind && r.needsAttention);
        const levels = node.kind === 'bugs' ? [['critical', 4, '致命'], ['high', 3, '高严重程度']] : [['high', 2, node.kind === 'orders' ? '高紧急程度' : '高优先级']];
        node.priorityAlerts = levels.flatMap(([level, code, label]) => {
            const matches = focused.filter(r => r.priorityCode === code);
            if (!matches.length) return [];
            const subtasks = node.kind === 'tasks' ? matches.filter(r => r.chain.slice(0, -1).some(link => link.kind === 'tasks')).length : 0;
            return [{ level, label, count: matches.length, detail: node.kind === 'tasks' ? `主任务 ${matches.length - subtasks} · 子任务 ${subtasks}` : '' }];
        });
    }
    const weekStart = new Date(date + 'T12:00:00Z');
    // 查询日期为上海本地日期，周一作为本周起点。
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
    weekStart.setUTCDate(weekStart.getUTCDate() - (dayOfWeek + 6) % 7);
    const threshold = weekStart.toISOString().slice(0, 10);
    const attention = records.filter(r => r.kind !== 'products' && M.day(r.updatedAt) >= threshold).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
    return { product: { id: product.id, name: product.name, owner: product.owner_name }, asOf, groups, nodes, records, attention };
}
async function snapshot(userId, productId, query = db) {
    const paths = await permissions(query, userId);
    if (!paths.has('/products')) {
        const err = new Error('需要产品管理权限');
        err.status = 403;
        throw err;
    }
    const product = await query.prepare(`SELECT p.*, COALESCE(u.real_name,'—') AS owner_name FROM pms_product p LEFT JOIN pms_user u ON u.id=p.owner_id WHERE p.is_deleted=0 AND p.id=?`).get(productId);
    if (!product) {
        const err = new Error('产品不存在或已被删除');
        err.status = 404;
        throw err;
    }
    const data = Object.fromEntries(Object.keys(M.kinds).map(kind => [kind, []]));
    data.products = [normalize(product)];
    for (const [kind, [sql, params]] of Object.entries(sourceQueries(productId))) {
        if (paths.has(kindPermissions[kind]))
            data[kind] = (await query.prepare(sql).all(...params)).map(normalize);
    }
    for (const stage of data.paymentStages) {
        const payment = calculatePaymentSummary(stage.planned_amount, data.payments.filter(p => p.stage_id === stage.id).map(p => p.payment_amount));
        stage.paid_amount = payment.paidAmount;
        stage.unpaid_amount = payment.unpaidAmount;
    }
    for (const contract of data.contracts) {
        const payment = calculatePaymentSummary(contract.contract_amount, data.paymentStages.filter(p => p.contract_id === contract.id).map(p => p.paid_amount));
        contract.paid_amount = payment.paidAmount;
        contract.unpaid_amount = payment.unpaidAmount;
    }
    const { as_of } = await query.prepare("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD HH24:MI:SS') AS as_of").get();
    return buildSnapshot(data, paths, as_of);
}
async function currentSnapshot(userId, productId) {
    return db.transaction(async (tx) => {
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        return snapshot(userId, productId, tx);
    });
}
module.exports = { listProducts, currentSnapshot, snapshot, buildSnapshot, kindPermissions, allowedKinds };

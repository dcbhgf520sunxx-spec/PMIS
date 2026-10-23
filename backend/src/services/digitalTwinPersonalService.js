const db = require('../db');
const { createHash } = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const { labels, name } = require('./digitalTwinModel');
const { kindPermissions, permissions } = require('./digitalTwinService');
const { calculateOverdue, overdueSql, POLICIES } = require('./overdueRules');
const { businessDateText, calendarDaysBetween } = require('../utils/date');
const { recentTwinUpdates, RECENT_UPDATE_LIMIT } = require('./digitalTwinRecentUpdates');

const categories = [
    ['requirements', 'requirement', '需求', 'requirement'], ['projects', 'project', '项目', 'project'],
    ['planItems', 'plan', '关键事项', 'stage_plan'], ['tasks', 'work', '任务', 'task'],
    ['bugs', 'quality', '缺陷', null], ['orders', 'order', '工单', 'work_order']
];
const text = value => sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} });

function workState(kind, status, isOpen) {
    if (!isOpen) return { workState: 'ended', nextAction: '' };
    const paused = { requirements: [3, 13, 22, 35], projects: [3], tasks: [3], planItems: [3], orders: [4], bugs: [] };
    if (paused[kind].includes(status)) return { workState: 'waiting', nextAction: '协调恢复或确认后续安排' };
    if (kind === 'bugs') return { workState: 'pending', nextAction: status === 1 ? '验证修复结果' : '安排缺陷修复' };
    const active = { requirements: [0, 1, 10, 11, 20, 30, 31, 32], projects: [1], tasks: [1], planItems: [1], orders: [1] };
    return active[kind].includes(status) ? { workState: 'active', nextAction: '推进当前工作收口' } : { workState: 'pending', nextAction: kind === 'requirements' ? '安排下一阶段工作' : kind === 'projects' ? '确认项目启动安排' : '安排启动或处理' };
}

function personalSourceQueries(userId) {
    const product = 'LEFT JOIN pms_product product ON product.id=t.product_id AND product.is_deleted=0';
    const source = `LEFT JOIN pms_project project ON project.id=t.project_id AND project.is_deleted=0
        LEFT JOIN pms_requirement requirement ON requirement.id=t.requirement_id AND requirement.is_deleted=0
        LEFT JOIN pms_requirement project_requirement ON project_requirement.id=project.requirement_id AND project_requirement.is_deleted=0
        LEFT JOIN pms_product product ON product.id=COALESCE(project.product_id,requirement.product_id) AND product.is_deleted=0`;
    const sourceFields = `product.id product_id, product.name product_name, project.name project_name,
        requirement.title requirement_name, (COALESCE(project.status=4,FALSE) OR COALESCE(requirement.status=37,FALSE) OR COALESCE(project_requirement.status=37,FALSE)) parent_closed`;
    const activeSource = '((t.source_type=1 AND project.id IS NOT NULL) OR (t.source_type=2 AND requirement.id IS NOT NULL))';
    return {
        requirements: [`SELECT t.*, ${overdueSql('requirement', { alias: 't' }).fields}, product.name product_name, u.real_name owner_name, 'responsible' relationship FROM pms_requirement t ${product} LEFT JOIN pms_user u ON u.id=t.owner_id WHERE t.is_deleted=0 AND t.owner_id=? ORDER BY t.created_at DESC,t.id DESC`, [userId]],
        projects: [`SELECT t.*, product.name product_name, u.real_name owner_name, requirement.title requirement_name,
            COALESCE(requirement.status=37,FALSE) parent_closed, CASE WHEN t.owner_id=? THEN 'responsible' ELSE 'participant' END relationship
            FROM pms_project t ${product} LEFT JOIN pms_user u ON u.id=t.owner_id LEFT JOIN pms_requirement requirement ON requirement.id=t.requirement_id AND requirement.is_deleted=0
            WHERE t.is_deleted=0 AND (t.owner_id=? OR EXISTS(SELECT 1 FROM pms_project_member m WHERE m.project_id=t.id AND m.user_id=?)) ORDER BY t.created_at DESC,t.id DESC`, [userId, userId, userId]],
        planItems: [`SELECT t.*, project.id project_id, project.name project_name, product.id product_id, product.name product_name, u.real_name owner_name,
            (project.status=4 OR COALESCE(requirement.status=37,FALSE)) parent_closed, CASE WHEN t.owner_id=? THEN 'responsible' ELSE 'collaborator' END relationship
            FROM pms_project_plan_item t JOIN pms_project_plan_stage stage ON stage.id=t.stage_id AND stage.is_deleted=0
            JOIN pms_project project ON project.id=stage.project_id AND project.is_deleted=0 LEFT JOIN pms_requirement requirement ON requirement.id=project.requirement_id AND requirement.is_deleted=0
            LEFT JOIN pms_product product ON product.id=project.product_id AND product.is_deleted=0 LEFT JOIN pms_user u ON u.id=t.owner_id
            WHERE t.is_deleted=0 AND (t.owner_id=? OR EXISTS(SELECT 1 FROM pms_project_plan_item_collaborator c WHERE c.plan_item_id=t.id AND c.user_id=?)) ORDER BY project.id,stage.sort_order,stage.id,t.sort_order,t.id`, [userId, userId, userId]],
        tasks: [`SELECT t.*, ${sourceFields},
            EXISTS(WITH RECURSIVE ancestors AS (
                SELECT p.id,p.parent_task_id,p.status,ARRAY[p.id] visited FROM pms_task p WHERE p.id=t.parent_task_id AND p.is_deleted=0
                UNION ALL SELECT p.id,p.parent_task_id,p.status,a.visited || p.id FROM pms_task p JOIN ancestors a ON p.id=a.parent_task_id WHERE p.is_deleted=0 AND NOT p.id=ANY(a.visited)
            ) SELECT 1 FROM ancestors WHERE status=4) ancestor_closed,
            COALESCE((SELECT STRING_AGG(u.real_name,'、' ORDER BY o.sort_order,u.id) FROM pms_task_owner o JOIN pms_user u ON u.id=o.user_id WHERE o.task_id=t.id),'—') owner_name,
            'responsible' relationship FROM pms_task t ${source}
            WHERE t.is_deleted=0 AND (${activeSource} OR t.source_type=3) AND EXISTS(SELECT 1 FROM pms_task_owner o WHERE o.task_id=t.id AND o.user_id=?) ORDER BY t.created_at DESC,t.id DESC`, [userId]],
        bugs: [`SELECT t.*, ${sourceFields}, u.real_name owner_name, 'responsible' relationship FROM pms_bug t ${source} LEFT JOIN pms_user u ON u.id=t.assignee_id
            WHERE t.is_deleted=0 AND ${activeSource} AND t.assignee_id=? ORDER BY t.created_at DESC,t.id DESC`, [userId]],
        orders: [`SELECT t.*, product.name product_name, u.real_name owner_name, 'responsible' relationship FROM pms_work_order t ${product} LEFT JOIN pms_user u ON u.id=t.follower_id
            WHERE t.is_deleted=0 AND t.follower_id=? ORDER BY t.created_at DESC,t.id DESC`, [userId]]
    };
}

function recordFromRow(kind, row, paths, date) {
    const code = Number(row.status);
    const ended = ({ requirements: [33, 34, 36, 37], projects: [2, 4], tasks: [2, 4], bugs: [2], planItems: [2], orders: [2, 3] })[kind].includes(code);
    const parentClosed = Boolean(row.parent_closed || row.ancestor_closed);
    const relationship = row.relationship || 'responsible';
    const priorityCode = (kind === 'bugs' ? row.severity : kind === 'orders' ? row.urgency : row.priority) ?? null;
    const needsAttention = !ended && !parentClosed && (kind === 'bugs' ? [3, 4].includes(Number(priorityCode)) : Number(priorityCode) === 2);
    const policy = categories.find(item => item[0] === kind)[3];
    const dueDate = policy ? businessDateText(row[POLICIES[policy].field], Boolean(POLICIES[policy].timestamp)) || '' : '';
    const overdue = policy ? calculateOverdue(policy, { date: dueDate, status: code, requirementType: row.requirement_type, completion: row.requirement_completion, parentStatus: parentClosed ? 4 : undefined }, date) : { isOverdue: 0 };
    const canSchedule = policy && !ended && !parentClosed && !POLICIES[policy].excluded.includes(code);
    const days = dueDate ? calendarDaysBetween(dueDate, date) : null;
    const isOverdue = !parentClosed && overdue.isOverdue === 1;
    const dueSoon = Boolean(canSchedule && days !== null && days >= 0 && days <= 7);
    const chain = [];
    if (paths.has('/products') && row.product_id && row.product_name) chain.push({ kind: 'products', id: String(row.product_id), name: text(row.product_name) });
    if (paths.has('/requirements') && row.requirement_id && row.requirement_name) chain.push({ kind: 'requirements', id: String(row.requirement_id), name: text(row.requirement_name) });
    if (paths.has('/projects') && kind !== 'projects' && row.project_id && row.project_name) chain.push({ kind: 'projects', id: String(row.project_id), name: text(row.project_name) });
    const recordName = text(name(row));
    const parentName = kind === 'tasks' && Number(row.source_type) === 3 ? '日常任务' : chain.at(-1)?.name || '来源模块未授权';
    const url = kind === 'planItems' ? `/projects/${row.project_id}/stage-plan` : `${kindPermissions[kind]}/${row.id}`;
    chain.push({ kind, id: String(row.id), name: recordName });
    return { kind, id: String(row.id), code: String(row.id), name: recordName, statusCode: code, status: labels[kind]?.[code] || '—', priorityCode: priorityCode === null ? null : Number(priorityCode), needsAttention,
        owner: text(row.owner_name || '—'), value: text(row.owner_name || '—'), parentName, chain, description: text(row.description || row.remark || row.progress_text || ''), dueDate,
        updatedAt: row.updated_at || row.created_at, createdAt: row.created_at || '', url, relationship, relationshipLabel: ({ responsible: '负责', participant: '参与', collaborator: '协作' })[relationship],
        productName: paths.has('/products') ? text(row.product_name || '—') : '—', productId: paths.has('/products') ? String(row.product_id || '') : '',
        isSubtask: kind === 'tasks' && Boolean(row.parent_task_id), isOpen: !ended && !parentClosed, parentClosed, isOverdue, dueSoon, progressNote: '', ...workState(kind, code, !ended && !parentClosed) };
}

function buildPersonalSnapshot(person, data, paths, asOf) {
    const records = categories.flatMap(([kind]) => paths.has(kindPermissions[kind]) ? [...new Map((data[kind] || []).map(row => [String(row.id), row])).values()].map(row => recordFromRow(kind, row, paths, asOf.slice(0, 10))) : []);
    const responsible = records.filter(row => row.relationship === 'responsible');
    const priorityOrder = (a, b) => Number(b.isOverdue) - Number(a.isOverdue) || Number(b.needsAttention) - Number(a.needsAttention) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.kind.localeCompare(b.kind) || b.id.localeCompare(a.id, undefined, { numeric: true });
    const priorities = responsible.filter(row => row.isOpen && (row.isOverdue || row.needsAttention || row.dueSoon)).sort(priorityOrder);
    const workBoard = { current: responsible.filter(row => row.workState === 'active').sort(priorityOrder), next: responsible.filter(row => row.isOpen && (row.workState !== 'active' || row.isOverdue || row.needsAttention || row.dueSoon)).sort(priorityOrder) };
    const groups = categories.map(([kind, key, title]) => {
        const own = responsible.filter(row => row.kind === kind), joined = records.filter(row => row.kind === kind && row.relationship !== 'responsible');
        const available = paths.has(kindPermissions[kind]);
        const open = own.filter(row => row.isOpen).length, subtasks = own.filter(row => row.isSubtask).length;
        const note = `${kind === 'tasks' ? `主任务 ${own.length - subtasks} · 子任务 ${subtasks}` : `关联 ${own.length + joined.length} 项`}${joined.length ? ` · ${kind === 'planItems' ? '协作' : '参与'} ${joined.length}` : ''}`;
        return { key, kind, title, available, metrics: [{ label: '负责', value: available ? String(own.length) : '—', unit: '项' }, { label: '未结束', value: available ? String(open) : '—', unit: '项' }], note: available ? note : '未获业务授权', rows: [{ label: '负责', value: `${own.length} 项` }, { label: '未结束', value: `${open} 项` }, { label: kind === 'planItems' ? '协作' : '参与', value: `${joined.length} 项` }], explanation: '只统计当前责任关系。参与和协作单独展示；主、子任务按独立工作项展示，不计算个人考核完成率。已结束及上级关闭的工作不进入优先处理。' };
    });
    const nodes = [{ key: 'person', kind: 'person', title: '本人', value: text(person.real_name), unit: '', note: `负责 ${responsible.length} 项 · 未结束 ${responsible.filter(row => row.isOpen).length} 项`, available: true, priorityAlerts: [] }, ...groups.map(group => {
        const high = responsible.filter(row => row.kind === group.kind && row.needsAttention);
        return { key: group.key, kind: group.kind, title: group.title, value: group.metrics[0].value, unit: '项负责', note: group.note, available: group.available, priorityAlerts: high.length ? [{ level: 'high', label: group.kind === 'bugs' ? '高危' : group.kind === 'orders' ? '紧急' : '高优', count: high.length, detail: '' }] : [] };
    })];
    const overview = { responsible: responsible.length, participating: records.length - responsible.length, open: responsible.filter(row => row.isOpen).length, urgent: responsible.filter(row => row.needsAttention).length, overdue: responsible.filter(row => row.isOverdue).length, dueSoon: responsible.filter(row => row.dueSoon).length, products: new Set(records.map(row => row.productId).filter(Boolean)).size };
    const snapshot = { person: { id: String(person.id), name: text(person.real_name) }, asOf, overview, groups, nodes, records, priorities, workBoard, events: [], attention: recentTwinUpdates(records, asOf).slice(0, RECENT_UPDATE_LIMIT) };
    snapshot.summaryRevision = personalSummaryRevision(snapshot);
    return snapshot;
}

function personalSummaryRevision(snapshot) {
    const fields = row => [row.kind, row.id, row.name, row.parentName, row.productName, row.status, row.dueDate, row.needsAttention, row.relationship, row.isOverdue, row.dueSoon, row.nextAction, row.description, row.progressNote];
    const recent = snapshot.events.flatMap(event => snapshot.records.filter(row => row.kind === event.kind && row.id === event.recordId));
    const evidence = ['personal-business-content-v2', snapshot.person, recent.map(fields), snapshot.workBoard.current.slice(0, 5).map(fields), snapshot.workBoard.next.slice(0, 5).map(fields), snapshot.events];
    return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

async function personalEvents(snapshot, personId, query, period) {
    const modules = { requirements: '需求', projects: '项目', tasks: '任务', bugs: 'BUG', orders: '运维工单', planItems: '项目阶段主计划' };
    const targets = snapshot.records.map(row => ({ module: modules[row.kind], id: row.id }));
    if (!targets.length) return [];
    const logs = await query.prepare(`SELECT * FROM (${period ? '' : 'SELECT DISTINCT ON (module,target_id) * FROM ('}
        SELECT l.id,l.module,l.target_id,l.action,l.field_name,l.new_value,l.created_at,
            ROW_NUMBER() OVER(PARTITION BY COALESCE(l.operation_id::text,l.id::text),l.module,l.target_id ORDER BY CASE WHEN l.field_name='status' THEN 0 ELSE 1 END,l.id DESC) row_number
        FROM pms_op_log l JOIN jsonb_to_recordset(?::jsonb) AS target(module text,id bigint) ON l.module=target.module AND l.target_id=target.id
        WHERE l.user_id=? AND l.created_at>=${period ? '?::timestamptz' : "(?::timestamp AT TIME ZONE 'Asia/Shanghai') - INTERVAL '7 days'"} AND l.created_at<${period ? '?::timestamptz' : "(?::timestamp AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 second'"}
        AND (l.module<>'项目阶段主计划' OR l.action IN ('新增关键事项','编辑关键事项','调整关键事项顺序','删除关键事项','状态变更','调整计划','上传交付文件','删除交付文件'))
    ) actions WHERE row_number=1 ${period ? '' : 'ORDER BY module,target_id,created_at DESC,id DESC) latest_work'} ORDER BY created_at DESC,id DESC ${period ? '' : 'LIMIT 5'}`).all(JSON.stringify(targets), personId, period ? `${period.startDate}T00:00:00+08:00` : snapshot.asOf, period ? (period.observationDate === period.today ? new Date(Date.parse(snapshot.asOf.replace(' ', 'T')+'+08:00')+1000).toISOString() : new Date(Date.parse(period.observationDate+'T00:00:00+08:00')+86400000).toISOString()) : snapshot.asOf);
    return logs.map(log => {
        const record = snapshot.records.find(row => modules[row.kind] === log.module && row.id === String(log.target_id));
        const status = log.field_name === 'status' ? labels[record.kind]?.[Number(log.new_value)] : null;
        return { id: String(log.id), kind: record.kind, recordId: record.id, name: record.name, action: status ? `状态变更为${status}` : text(log.action), createdAt: log.created_at, url: record.url };
    });
}

async function personalSnapshot(viewerId, query = db, personId = viewerId, period) {
    const person = await query.prepare('SELECT id,real_name FROM pms_user WHERE id=? AND is_deleted=0 AND status=1').get(personId);
    if (!person) throw Object.assign(new Error('所选人员不存在或已停用'), { status: 404 });
    const paths = await permissions(query, viewerId);
    const data = {};
    for (const [kind, [sql, params]] of Object.entries(personalSourceQueries(String(personId)))) {
        if (paths.has(kindPermissions[kind])) data[kind] = await query.prepare(sql).all(...params);
    }
    const { as_of } = await query.prepare("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD HH24:MI:SS') AS as_of").get();
    const snapshot = buildPersonalSnapshot(person, data, paths, as_of);
    const followUpTargets = snapshot.records.filter(row => ['projects', 'requirements', 'tasks'].includes(row.kind)).map(row => ({ kind: row.kind, id: row.id }));
    if (followUpTargets.length) {
        const notes = await query.prepare(`SELECT ${period ? '' : 'DISTINCT ON (target.kind,target.id)'} target.kind,target.id,f.content,f.updated_at
            FROM pms_follow_up_record f JOIN jsonb_to_recordset(?::jsonb) AS target(kind text,id bigint)
            ON (target.kind='projects' AND f.project_id=target.id) OR (target.kind='requirements' AND f.requirement_id=target.id) OR (target.kind='tasks' AND f.task_id=target.id)
            WHERE f.is_deleted=0 AND COALESCE(f.updater_id,f.creator_id)=? AND f.updated_at>=${period ? '?::timestamptz' : "(?::timestamp AT TIME ZONE 'Asia/Shanghai')-INTERVAL '7 days'"}
                AND f.updated_at<${period ? '?::timestamptz' : "(?::timestamp AT TIME ZONE 'Asia/Shanghai')+INTERVAL '1 second'"}
            ORDER BY target.kind,target.id,f.updated_at DESC,f.id DESC`).all(JSON.stringify(followUpTargets), personId, period ? `${period.startDate}T00:00:00+08:00` : as_of, period ? (period.observationDate===period.today ? new Date(Date.parse(as_of.replace(' ','T')+'+08:00')+1000).toISOString() : new Date(Date.parse(period.observationDate+'T00:00:00+08:00')+86400000).toISOString()) : as_of);
        for (const note of notes) {
            const record = snapshot.records.find(row => row.kind === note.kind && row.id === String(note.id));
            const content = text(note.content);
            record.progressNote += `${record.progressNote ? '\n' : ''}${period ? String(note.updated_at).slice(0,10)+' ' : ''}${content}`;
        }
    }
    snapshot.nodes[0].title = String(viewerId) === String(personId) ? '本人' : '人员';
    snapshot.events = await personalEvents(snapshot, personId, query, period);
    snapshot.summaryRevision = personalSummaryRevision(snapshot);
    return snapshot;
}
const currentPersonalSnapshot = (viewerId, personId = viewerId, range = {}) => db.transaction(async tx => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const { resolvePersonalPeriod, buildPersonalPeriodSnapshot, typeByKind } = require('./digitalTwinPersonalPeriod');
    const { analyzeBusinessCompletion } = require('./mcpCompletionAnalysisService');
    const period = resolvePersonalPeriod(range);
    const snapshot = await personalSnapshot(viewerId, tx, personId, period);
    const paths = await permissions(tx, viewerId);
    const types = snapshot.groups.filter(g=>g.available).map(g=>typeByKind[g.kind]);
    const analysis = types.length ? await analyzeBusinessCompletion({analysis_period:{preset:'custom',start_date:period.startDate,end_date:period.endDate},person_ids:[Number(personId)],business_types:types},
        {user:{id:Number(viewerId)},allowedMenuPaths:paths},tx,new Date(snapshot.asOf.replace(' ','T')+'+08:00'),true) : {sourceData:{records:[],logs:[]}};
    return buildPersonalPeriodSnapshot(snapshot, analysis.sourceData, period);
});
module.exports = { categories, buildPersonalSnapshot, personalSourceQueries, personalSnapshot, currentPersonalSnapshot };

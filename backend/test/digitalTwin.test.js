const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSnapshot, snapshot } = require('../src/services/digitalTwinService');
const M = require('../src/services/digitalTwinModel');
const permitted = new Set(['/products', '/requirements', '/projects', '/tasks', '/bugs', '/work-orders']);
const empty = () => ({ ...Object.fromEntries(Object.keys(M.kinds).map(kind => [kind, []])), products: [{ id: '1', name: '测试产品', owner_name: '负责人', status: 1 }] });
function row(id, props = {}) { return { id, name: id, status: 0, created_at: '2026-10-09 08:00:00', updated_at: '2026-10-09 08:00:00', ...props }; }
test('最近7天按读取时刻滚动计算，包含边界和跨周记录，排除范围外及未来更新', () => {
    const data = empty();
    data.tasks = [row('1', { updated_at: '2026-10-05 11:59:59' }), row('2', { updated_at: '2026-10-05 12:00:00' }), row('3', { updated_at: '2026-10-11 23:59:59' }), row('4', { updated_at: '2026-10-12 00:00:00' }), row('5', { updated_at: '2026-10-12 12:00:01' })];
    assert.deepEqual(buildSnapshot(data, permitted, '2026-10-12 12:00:00').attention.map(record => record.id), ['4', '3', '2']);
});
test('节点提醒只计未结束的高优先级对象，任务主子分别说明，缺陷高与致命分别统计', () => {
    const data = empty();
    data.requirements = [row('1', { priority: 2, status: 31 }), row('2', { priority: 2, status: 33 }), row('3', { priority: 2, status: 34 }), row('4', { priority: 2, status: 36 }), row('5', { priority: 0, is_overdue: 1 })];
    data.projects = [row('1', { priority: 2, status: 3 }), row('2', { priority: 2, status: 2 })];
    data.tasks = [row('1', { priority: 2, status: 1 }), row('2', { priority: 2, status: 0, parent_task_id: '1' }), row('3', { priority: 2, status: 2, parent_task_id: '1' })];
    data.bugs = [row('1', { severity: 3, status: 1 }), row('2', { severity: 4, status: 3 }), row('3', { severity: 4, status: 2 })];
    data.orders = [row('1', { urgency: 2, status: 4 }), row('2', { urgency: 2, status: 2 }), row('3', { urgency: 1, is_overdue: 1 })];
    const result = buildSnapshot(data, permitted, '2026-10-10 12:00:00');
    const alerts = key => result.nodes.find(node => node.key === key).priorityAlerts;
    assert.deepEqual(alerts('requirement'), [{ level: 'high', label: '高优先级', count: 1, detail: '' }]);
    assert.deepEqual(alerts('project'), [{ level: 'high', label: '高优先级', count: 1, detail: '' }]);
    assert.deepEqual(alerts('work'), [{ level: 'high', label: '高优先级', count: 2, detail: '主任务 1 · 子任务 1' }]);
    assert.deepEqual(alerts('quality'), [{ level: 'critical', label: '致命', count: 1, detail: '' }, { level: 'high', label: '高严重程度', count: 1, detail: '' }]);
    assert.deepEqual(alerts('order'), [{ level: 'high', label: '高紧急程度', count: 1, detail: '' }]);
    assert.deepEqual(result.records.filter(record => record.needsAttention).map(record => `${record.kind}:${record.id}`), ['requirements:1', 'projects:1', 'tasks:2', 'tasks:1', 'bugs:2', 'bugs:1', 'orders:1']);
    assert.equal(result.records.find(record => record.kind === 'bugs' && record.id === '2').priorityCode, 4);
    assert.deepEqual(alerts('contract'), []);
});
test('零重点事项和未授权模块不显示提醒，也不泄漏重点数量', () => {
    const data = empty();
    data.tasks = [row('1', { priority: 2 })];
    const result = buildSnapshot(data, new Set(['/products']), '2026-10-10 12:00:00');
    assert.ok(result.nodes.every(node => node.priorityAlerts.length === 0));
    assert.ok(result.records.every(record => !record.needsAttention));
});
test('链路明细按创建时间倒序，同一时间按数值编号倒序且不改变来源数据', () => {
    const data = empty();
    for (const kind of ['tasks', 'orders']) {
        data[kind] = [
            row('9007199254740992', { created_at: '2026-10-08 08:00:00', updated_at: '2026-10-10 11:00:00' }),
            row('9'), row('10'),
            row('1', { created_at: '2026-10-10 08:00:00' }),
            row('9007199254740993', { created_at: '2026-10-08 08:00:00' })
        ];
    }
    const original = structuredClone(data);
    const result = buildSnapshot(data, permitted, '2026-10-10 12:00:00');
    for (const kind of ['tasks', 'orders']) {
        assert.deepEqual(result.records.filter(record => record.kind === kind).map(record => record.id),
            ['1', '10', '9', '9007199254740993', '9007199254740992']);
    }
    assert.deepEqual(data, original);
    assert.equal(result.attention[0].id, '9007199254740992');
});
test('产品需求、项目、工单按计划日期倒序，无计划置后，不受完成情况或优先级干扰', () => {
    const data = empty();
    for (const kind of ['requirements', 'projects', 'orders']) {
        const dateField = kind === 'orders' ? 'expected_resolve_date' : 'expected_end_date';
        data[kind] = [row('1', { [dateField]: '2026-10-10', priority: 2 }),
            row('2', { [dateField]: '2026-10-20', status: 2 }),
            row('3', { created_at: '2026-10-23 08:00:00' }),
            row('4', { [dateField]: '2026-10-20', created_at: '2026-10-10 08:00:00' })];
    }
    const before = structuredClone(data);
    const result = buildSnapshot(data, permitted, '2026-10-23 12:00:00');
    for (const kind of ['requirements', 'projects', 'orders'])
        assert.deepEqual(result.records.filter(r => r.kind === kind).map(r => r.id), ['4', '2', '1', '3']);
    assert.deepEqual(data, before);
});
test('产品任务、缺陷按授权业务归属连续排列，子任务归入业务来源，组内日期倒序且不排完成情况', () => {
    const data = empty();
    data.projects = [row('10', { name: '项目2', product_id: '1' }), row('20', { name: '项目10', product_id: '1' })];
    data.requirements = [row('30', { name: '项目2', product_id: '1' })];
    for (const kind of ['tasks', 'bugs']) data[kind] = [
        row('1', { project_id: '10', expected_end_date: '2026-10-10', created_at: '2026-10-10 08:00:00' }),
        row('2', { project_id: '20', expected_end_date: '2026-10-23', created_at: '2026-10-23 08:00:00' }),
        row('3', { project_id: '10', expected_end_date: '2026-10-20', created_at: '2026-10-20 08:00:00', status: 2 }),
        row('4', { project_id: '10', parent_task_id: kind === 'tasks' ? '1' : null, expected_end_date: '2026-10-15', created_at: '2026-10-15 08:00:00' }),
        row('5', { requirement_id: '30', expected_end_date: '2026-10-23', created_at: '2026-10-23 08:00:00' }),
        row('6', { project_id: '10', expected_end_date: null, created_at: '2026-10-22 08:00:00' })
    ];
    const result = buildSnapshot(data, permitted, '2026-10-23 12:00:00');
    assert.deepEqual(result.records.filter(r => r.kind === 'tasks').map(r => r.id), ['3', '4', '1', '6', '5', '2']);
    assert.deepEqual(result.records.filter(r => r.kind === 'bugs').map(r => r.id), ['6', '3', '4', '1', '5', '2']);
    assert.equal(result.records.find(r => r.kind === 'tasks' && r.id === '4').parentName, '项目2');
    const restricted = buildSnapshot(data, new Set(['/products', '/tasks', '/bugs']), '2026-10-23 12:00:00');
    assert.deepEqual(restricted.records.filter(r => r.kind === 'tasks').map(r => r.id), ['5', '2', '3', '4', '1', '6']);
    assert.ok(!JSON.stringify(restricted.records).includes('项目2'));
    assert.ok(!JSON.stringify(restricted.records).includes('项目10'));
});
test('项目阶段、关键事项和付款阶段保留来源业务顺序，不被日期或状态覆盖', () => {
    const data = empty();
    for (const kind of ['planStages', 'planItems', 'paymentStages'])
        data[kind] = [row('1', { created_at: '2026-10-01 08:00:00', status: 2 }), row('2')];
    const result = buildSnapshot(data, permitted, '2026-10-23 12:00:00');
    for (const kind of ['planStages', 'planItems', 'paymentStages'])
        assert.deepEqual(result.records.filter(r => r.kind === kind).map(r => r.id), ['1', '2']);
});
test('任务层级和修复待验证缺陷不重复相加', () => {
    const data = empty();
    data.tasks = [row('1', { status: 2 }), row('2', { parent_task_id: '1', status: 2 }), row('3', { status: 3 }), row('4', { status: 1 })];
    data.bugs = [row('1', { status: 1 }), row('2', { status: 2 }), row('3', { status: 3 })];
    const x = M.summary(data, '2026-10-09');
    assert.equal(x.tasks.total, 3);
    assert.equal(x.tasks.open, 2);
    assert.equal(x.tasks.subtasks.total, 1);
    assert.equal(x.bugs.open, 2);
    assert.equal(x.bugs.fixed, 1);
    assert.equal(x.bugs.reactivated, 1);
});
test('同阶段多笔付款不重复计合同，维保金额保持独立', () => {
    const data = empty();
    data.contracts = [row('1', { contract_amount: '100000', project_id: '1', paid_amount: 30000, unpaid_amount: 70000 })];
    data.paymentStages = [row('1', { contract_id: '1', planned_amount: '100000' })];
    data.payments = [row('1', { stage_id: '1', payment_amount: '10000', payment_month: '2026-10-01' }), row('2', { stage_id: '1', payment_amount: '20000', payment_month: '2026-10-01' })];
    data.maintenance = [row('1', { product_id: '1', service_start_date: '2026-10-09', service_end_date: '2027-10-08', contract_amount: '50000' })];
    const result = buildSnapshot(data, permitted, '2026-10-09 12:00:00');
    const group = result.groups.find(x => x.key === 'finance');
    assert.equal(group.metrics[0].value, '10');
    assert.equal(group.metrics[1].value, '7');
    assert.equal(result.groups.find(x => x.key === 'maintenance').metrics.find(metric => metric.label === '服务中合同').value, '1');
    assert.equal(result.nodes.find(x => x.key === 'payment').value, '3');
});
test('服务期起止日含当天，终止后不覆盖当前', () => {
    const data = empty();
    data.maintenance = [row('1', { service_start_date: '2026-10-09', service_end_date: '2026-10-09', contract_amount: 1 }), row('2', { service_start_date: '2026-09-01', service_end_date: '2026-12-31', termination_date: '2026-10-08', contract_amount: 1 }), row('3', { service_start_date: '2026-10-10', service_end_date: '2027-10-09', contract_amount: 1 })];
    const x = M.summary(data, '2026-10-09');
    assert.deepEqual([x.maintenance.current, x.maintenance.past, x.maintenance.future], [1, 1, 1]);
});
test('当期维保金额只汇总查询日期服务中的合同，包含起止当天', () => {
    const data = empty();
    data.maintenance = [
        row('1', { service_start_date: '2026-01-01', service_end_date: '2026-10-10', contract_amount: '100000' }),
        row('2', { service_start_date: '2026-10-10', service_end_date: '2027-10-09', contract_amount: '25000.10' }),
        row('3', { service_start_date: '2026-10-11', service_end_date: '2027-10-10', contract_amount: '200000' }),
        row('4', { service_start_date: '2025-01-01', service_end_date: '2025-12-31', contract_amount: '30000' }),
        row('5', { service_start_date: '2026-01-01', service_end_date: '2026-12-31', termination_date: '2026-10-09', contract_amount: '40000' })
    ];
    const stats = M.summary(data, '2026-10-10').maintenance;
    assert.equal(stats.currentAmount, 125000.1);
    assert.equal(stats.amount, 395000.1);
    const result = buildSnapshot(data, permitted, '2026-10-10 12:00:00');
    const card = result.nodes.find(node => node.key === 'maintenance');
    assert.deepEqual([card.value, card.unit, card.note], ['12.5', '万元', '2 份服务中 · 2 份已结束']);
    const group = result.groups.find(group => group.key === 'maintenance');
    assert.equal(group.metrics[0].value, '12.5');
    assert.ok(group.rows.some(row => row.label === '当期维保金额' && row.value === '12.5 万元'));
    assert.ok(group.rows.some(row => row.label === '历年登记总额' && row.value === '39.5 万元'));
});
test('没有在服合同的当期维保金额为零，不能使用累计金额替代', () => {
    const data = empty();
    data.maintenance = [row('1', { service_start_date: '2027-01-01', service_end_date: '2027-12-31', contract_amount: '50000' })];
    assert.equal(M.summary(data, '2026-10-10').maintenance.currentAmount, 0);
    const result = buildSnapshot(data, permitted, '2026-10-10 12:00:00');
    assert.equal(result.nodes.find(node => node.key === 'maintenance').value, '0');
});
test('无关联需求项目保留产品来源，需求任务不自动迁至项目', () => {
    const data = empty();
    data.projects = [row('1', { product_id: '1' })];
    data.requirements = [row('1', { product_id: '1', title: '原需求', status: 36 })];
    data.tasks = [row('2', { requirement_id: '1', source_type: 2 })];
    assert.deepEqual(M.chain(data, 'projects', '1').map(x => x.kind), ['products', 'projects']);
    assert.deepEqual(M.chain(data, 'tasks', '2').map(x => x.kind), ['products', 'requirements', 'tasks']);
});
test('仅产品权限不查询任务、资金，未授权不显示零', async () => {
    const sqls = [];
    const query = { prepare(sql) { sqls.push(sql); return { all: async () => sql.includes('SELECT DISTINCT') ? [{ path: '/products' }] : [], get: async () => sql.includes('TO_CHAR') ? { as_of: '2026-10-09 12:00:00' } : row('1', { owner_name: '负责人', product_id: '1' }) }; } };
    const result = await snapshot(7, '1', query);
    assert.equal(result.groups.find(x => x.key === 'finance').available, false);
    assert.equal(result.groups.find(x => x.key === 'finance').metrics[0].value, '—');
    assert.ok(!sqls.some(sql => /FROM pms_task |FROM pms_project_contract/.test(sql)));
    assert.ok(result.records.every(row => ['products', 'maintenance'].includes(row.kind)));
});
test('无产品权限立即拒绝，不产生业务查询', async () => {
    let count = 0;
    const query = { prepare() { count++; return { all: async () => [{ path: '/tasks' }] }; } };
    await assert.rejects(snapshot(7, '1', query), error => error.status === 403);
    assert.equal(count, 1);
});
test('未授权来源不暴露名称、ID与详情地址', () => {
    const data = empty();
    data.tasks = [row('10', { project_id: '900', source_type: 1 }), row('11', { parent_task_id: '10', project_id: '900', source_type: 1 })];
    const result = buildSnapshot(data, new Set(['/products', '/tasks']), '2026-10-09 12:00:00');
    const task = result.records.find(x => x.kind === 'tasks');
    assert.ok(!JSON.stringify(task).includes('900'));
    assert.equal(task.parentName, '来源模块未授权');
    assert.equal(result.records.find(x => x.kind === 'tasks' && x.id === '11').parentName, '来源模块未授权');
});
test('菜单置于业务本体之后并单独授权，初始化和迁移一致', () => {
    const root = path.resolve(__dirname, '../..');
    const read = file => fs.readFileSync(path.join(root, file), 'utf8');
    const schema = read('backend/db/init/001_schema.sql');
    assert.match(schema, /'数字孪生',\s*'digital_twin',\s*2,\s*'\/digital-twin',\s*'BlockOutlined',\s*13,/);
    assert.match(schema, /'知识库',\s*'knowledge_base',\s*2,\s*'\/knowledge-base',\s*'BookOutlined',\s*14,/);
    const sidebar = read('frontend/src/layouts/AdminLayout/index.tsx');
    assert.ok(sidebar.indexOf("key: '/business-ontology'") < sidebar.indexOf("key: '/digital-twin'") && sidebar.indexOf("key: '/digital-twin'") < sidebar.indexOf("key: '/knowledge-base'"));
    assert.match(read('backend/src/app.js'), /app.use\('\/api\/digital-twin', verifyToken, checkPermission\('\/digital-twin'\), digitalTwinRoutes\)/);
    assert.match(read('backend/db/migrations/20261009_01_add_digital_twin_menu.sql'), /WHERE code = 'admin'/);
});
test('角分金额汇总复用合同付款规则，已付清不残留浮点尾差', () => {
    const data = empty();
    data.contracts = [row('1', { contract_amount: '0.30' })];
    data.payments = [row('1', { payment_amount: '0.10' }), row('2', { payment_amount: '0.20' })];
    const x = M.summary(data, '2026-10-09');
    assert.equal(x.finance.paid, 0.3);
    assert.equal(x.finance.unpaid, 0);
});
test('链路明细保留业务状态代码，并指向对象所在详情页', () => {
    const data = empty();
    data.projects = [row('10', { product_id: '1', status: 1 })];
    data.bugs = [row('20', { project_id: '10', status: 3 })];
    data.contracts = [row('30', { project_id: '10', contract_amount: 100, paid_amount: 0, unpaid_amount: 100 })];
    data.planStages = [row('40', { project_id: '10' })];
    data.planItems = [row('41', { stage_id: '40', status: 2 })];
    data.maintenance = [
        row('50', { product_id: '1', service_start_date: '2025-01-01', service_end_date: '2025-12-31' }),
        row('51', { product_id: '1', previous_contract_id: '50', service_start_date: '2026-01-01', service_end_date: '2026-12-31' })
    ];
    const result = buildSnapshot(data, permitted, '2026-10-10 12:00:00');
    const find = (kind, id) => result.records.find(record => record.kind === kind && record.id === id);
    assert.equal(find('bugs', '20').statusCode, 3);
    assert.equal(find('bugs', '20').url, '/bugs/20');
    assert.equal(find('contracts', '30').url, '/projects/10/contract-detail');
    assert.equal(find('planItems', '41').url, '/projects/10/stage-plan');
    assert.equal(find('maintenance', '50').statusCode, 'renewed');
    assert.equal(find('maintenance', '51').statusCode, 'active');
    assert.equal(find('maintenance', '51').url, '/products/1/maintenance-contracts/51');
});

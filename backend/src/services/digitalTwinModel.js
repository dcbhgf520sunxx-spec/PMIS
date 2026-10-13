const { toCents, calculatePaymentSummary } = require('./projectContractRules');
// 产品全链路的只读统计，沿用已确认的模拟版口径。
const labels = { products: { 0: '停用', 1: '启用' }, requirements: { 0: '上会评估', 1: '需求上会', 2: '上会通过', 3: '过会未通过', 10: '提报评估', 11: '需求审批', 12: '审批通过', 13: '审批未通过', 20: '需求验证', 21: '预研通过', 22: '预研不通过', 30: '需求整理', 31: '实施中', 32: '试运行', 33: '已完成', 34: '已完成未使用', 35: '暂停', 36: '已转项目', 37: '已关闭' }, projects: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停', 4: '已关闭' }, tasks: { 0: '待处理', 1: '处理中', 2: '已完成', 3: '已暂停', 4: '已关闭' }, bugs: { 0: '新建', 1: '已修复', 2: '已关闭', 3: '被激活' }, planItems: { 0: '未开始', 1: '进行中', 2: '已完成', 3: '已暂停' }, orders: { 0: '待处理', 1: '处理中', 2: '已解决', 3: '已关闭', 4: '已暂停', 5: '被激活' } };
const kinds = { products: '产品', requirements: '需求', projects: '项目', tasks: '任务', bugs: '缺陷', planStages: '项目阶段', planItems: '关键事项', contracts: '项目合同', paymentStages: '付款阶段', payments: '付款记录', maintenance: '维保合同', orders: '工单' };
const day = x => String(x || '').slice(0, 10), sum = (rows, key) => Number(rows.reduce((total, r) => total + (toCents(r[key]) ?? 0n), 0n)) / 100;
function totals(s) { const paid = sum(s.payments, 'payment_amount'), amount = sum(s.contracts, 'contract_amount'); return { requirements: s.requirements.length, projects: s.projects.length, completedProjects: s.projects.filter(x => x.status === 2).length, activeProjects: s.projects.filter(x => x.status === 1).length, tasks: s.tasks.length, bugs: s.bugs.length, openTasks: s.tasks.filter(x => x.status !== 2).length, openBugs: s.bugs.filter(x => x.status !== 2).length, orders: s.orders.length, openOrders: s.orders.filter(x => x.status !== 2).length, urgentOrders: s.orders.filter(x => x.status !== 2 && x.urgency === 2).length, contractAmount: amount, paid, unpaid: calculatePaymentSummary(amount, s.payments.map(r => r.payment_amount)).unpaidAmount, maintenanceAmount: sum(s.maintenance, 'contract_amount'), planItems: s.planItems.length, doneItems: s.planItems.filter(x => x.status === 2).length }; }
function status(kind, r, date) { if (kind === 'maintenance')
    return date < r.service_start_date ? '待服务' : date > (r.termination_date || r.service_end_date) ? '已结束' : '服务中'; if (kind === 'payments')
    return '已登记'; if (kind === 'contracts' || kind === 'paymentStages')
    return r.paid_amount === 0 ? '未付款' : r.unpaid_amount === 0 ? '已付清' : '部分付款'; if (kind === 'planStages')
    return '项目阶段'; return labels[kind]?.[r.status] || '—'; }
function name(r) { return r?.name || r?.title || r?.problem_desc || r?.stage_name || r?.remark || r?.content || r?.id || '—'; }
function directParent(s, kind, r) { if (kind === 'projects')
    return r.requirement_id && s.requirements.some(x => x.id === r.requirement_id) ? ['requirements', r.requirement_id] : ['products', r.product_id]; if (kind === 'planStages')
    return ['projects', r.project_id]; if (kind === 'planItems')
    return ['planStages', r.stage_id]; if (kind === 'contracts')
    return ['projects', r.project_id]; if (kind === 'paymentStages')
    return ['contracts', r.contract_id]; if (kind === 'payments')
    return ['paymentStages', r.stage_id]; if (kind === 'tasks' && r.parent_task_id)
    return ['tasks', r.parent_task_id]; if (['tasks', 'bugs'].includes(kind))
    return r.project_id ? ['projects', r.project_id] : ['requirements', r.requirement_id]; if (kind === 'maintenance' && r.previous_contract_id)
    return ['maintenance', r.previous_contract_id]; if (kind !== 'products')
    return ['products', r.product_id]; return null; }
function chain(s, kind, id) { const result = [], seen = new Set(); let r = s[kind]?.find(x => x.id === id); while (r) {
    const key = kind + ':' + r.id;
    if (seen.has(key))
        throw Error('业务关联出现循环');
    seen.add(key);
    result.unshift({ kind, id: r.id, name: name(r) });
    const parent = directParent(s, kind, r);
    if (!parent)
        break;
    [kind, id] = parent;
    r = s[kind]?.find(x => x.id === id);
} return result; }
function summary(s, date) {
    const count = (rows, code) => rows.filter(r => r.status === code).length;
    const buckets = rows => rows.reduce((out, r) => (out[r.status] = (out[r.status] || 0) + 1, out), {});
    const taskStats = rows => ({ total: rows.length, open: rows.filter(r => r.status !== 2).length, done: count(rows, 2), paused: count(rows, 3), closed: count(rows, 4), buckets: buckets(rows) });
    const main = s.tasks.filter(r => !r.parent_task_id), sub = s.tasks.filter(r => r.parent_task_id), money = totals(s);
    const currentMaintenance = s.maintenance.filter(r => status('maintenance', r, date) === '服务中');
    return {
        requirements: { total: s.requirements.length, open: s.requirements.filter(r => ![33, 34, 36].includes(r.status)).length, transferred: count(s.requirements, 36), done: s.requirements.filter(r => [33, 34].includes(r.status)).length, paused: count(s.requirements, 35), closed: count(s.requirements, 37), buckets: buckets(s.requirements) },
        projects: { total: s.projects.length, active: count(s.projects, 1), done: count(s.projects, 2), paused: count(s.projects, 3), closed: count(s.projects, 4), notStarted: count(s.projects, 0), buckets: buckets(s.projects) },
        plan: { total: s.planItems.length, open: s.planItems.filter(r => r.status !== 2).length, done: count(s.planItems, 2), paused: count(s.planItems, 3), stages: s.planStages.length, buckets: buckets(s.planItems) },
        tasks: { ...taskStats(main), records: s.tasks.length, subtasks: taskStats(sub) },
        bugs: { total: s.bugs.length, open: s.bugs.filter(r => r.status !== 2).length, closed: count(s.bugs, 2), fixed: count(s.bugs, 1), reactivated: count(s.bugs, 3), buckets: buckets(s.bugs) },
        finance: { amount: money.contractAmount, paid: money.paid, unpaid: money.unpaid, contracts: s.contracts.length, payments: s.payments.length, stages: s.paymentStages.length },
        maintenance: { total: s.maintenance.length, current: currentMaintenance.length, currentAmount: sum(currentMaintenance, 'contract_amount'), future: s.maintenance.filter(r => status('maintenance', r, date) === '待服务').length, past: s.maintenance.filter(r => status('maintenance', r, date) === '已结束').length, amount: money.maintenanceAmount },
        orders: { total: s.orders.length, open: s.orders.filter(r => r.status !== 2).length, resolved: count(s.orders, 2), paused: count(s.orders, 4), closed: count(s.orders, 3), reactivated: count(s.orders, 5), urgent: s.orders.filter(r => r.status !== 2 && r.urgency === 2).length, buckets: buckets(s.orders) }
    };
}
module.exports = { labels, kinds, day, sum, totals, summary, status, name, chain };

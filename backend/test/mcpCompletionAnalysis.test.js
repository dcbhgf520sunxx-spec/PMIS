const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateCompletion } = require('../src/services/mcpCompletionAnalysisService')
const today = '2026-11-15'
const period = { start_date: '2026-11-01', end_date: '2026-11-30' }
function row(type, id, changes = {}) {
  return { business_type: type, id, name: `${type}${id}`, status: 1, owner_id: 8, owner_ids: [8],
    requirement_type: 4, plan_date: '2026-11-10', actual_date: null, created_date: '2026-11-01',
    created_at: '2026-11-01T09:00:00+08:00', project_id: null, requirement_id: null, parent_task_id: null, ...changes }
}
function transition(type, id, old, next, date, op = `${id}-${date}-${next}`) {
  return { business_type: type, target_id: id, field_name: 'status', old_value: String(old), new_value: String(next),
    log_id: 1, operation_id: op, created_at: date + 'T12:00:00+08:00' }
}
function calc(records, logs = [], options = {}) {
  return evaluateCompletion({ records, logs, people: [{ id: 8, name: '测试人员' }],
    types: [...new Set(records.map(r => r.business_type))], period, today, cutoff: today, ...options })
}
const summary = (result, type, person = 8) => result.results.find(r => r.business_type === type && r.person_id === person)
test('三项任务只有一项完成，暂停参与；没有任务时比例为空而不是100%', () => {
  const result = calc([row('task', 1, {status:2, actual_date:'2026-11-03'}),row('task',2),row('task',3,{status:3})])
  assert.equal(summary(result,'task').statistic_count,3)
  assert.equal(summary(result,'task').completed_count,1)
  assert.equal(summary(result,'task').completion_rate,33.33)
  assert.equal(summary(calc([],[],{types:['task']}),'task').completion_rate,null)
})
test('主任务按未关闭子任务完成，全部子任务关闭排除；个人主子任务去重', () => {
  const records=[row('task',1,{status:1}),row('task',2,{parent_task_id:1,status:2,owner_ids:[9],actual_date:'2026-11-03'}),
    row('task',3,{parent_task_id:1,status:4,owner_ids:[9]}),row('task',4),row('task',5,{parent_task_id:4,status:4,owner_ids:[9]})]
  const r=calc(records)
  assert.equal(summary(r,'task').statistic_count,1)
  assert.equal(summary(r,'task').completed_count,1)
  assert.ok(r.details.some(d=>d.record_id===4&&d.reason_code==='all_children_closed'))
  records[1].owner_ids=[8]
  const next=calc(records)
  assert.ok(next.details.some(d=>d.record_id===1&&d.reason_code==='personal_task_duplicate'))
})
test('阶段按事项汇总，个人考核不推定阶段负责人和日期；事项协作人不计负责人', () => {
  const r=calc([row('project_stage',1,{owner_id:null,owner_ids:[],plan_date:null}),
    row('stage_plan',2,{stage_id:1,status:2,actual_date:'2026-11-05',owner_id:9,owner_ids:[9,8]})])
  const stage=r.details.find(d=>d.business_type==='project_stage')
  assert.equal(stage.completed,true)
  assert.equal(stage.person_id,null)
  assert.equal(stage.reason_code,'stage_personal_scope_missing')
  assert.equal(summary(r,'stage_plan').statistic_count,0)
})
test('三种需求否定结论算完成，后续实施保留结论；重新评估与无证据须分别判断', () => {
  const records=[row('requirement',1,{requirement_type:1,status:3}),row('requirement',2,{requirement_type:2,status:13}),
    row('requirement',3,{requirement_type:3,status:22}),row('requirement',4,{requirement_type:1,status:31}),
    row('requirement',5,{requirement_type:1,status:0}),row('requirement',6,{requirement_type:1,status:31}),
    row('requirement',7,{status:36})]
  const logs=[transition('requirement',4,1,2,'2026-11-02'),transition('requirement',4,2,31,'2026-11-03'),
    transition('requirement',5,3,0,'2026-11-03')]
  const r=calc(records,logs)
  assert.equal(r.details.find(d=>d.record_id===4).completed,true)
  assert.equal(r.details.find(d=>d.record_id===5).completed,false)
  assert.equal(r.details.find(d=>d.record_id===6).completed,null)
  assert.equal(r.details.find(d=>d.record_id===7).completed,true)
  assert.equal(summary(r,'requirement').completion_rate,null)
})
test('来源需求关闭连带项目任务BUG退出；BUG关闭算完成，工单关闭排除', () => {
  const records=[row('requirement',1,{status:37}),row('project',2,{requirement_id:1,status:2}),
    row('task',3,{project_id:2,status:2}),row('bug',4,{project_id:2,status:2}),
    row('bug',5,{status:2,created_date:'2026-11-02',actual_date:'2026-11-03'}),
    row('work_order',6,{status:3}),row('work_order',7,{status:2,actual_date:'2026-11-04'})]
  const r=calc(records)
  for(const id of [2,3,4])assert.equal(r.details.find(d=>d.record_id===id&&d.business_type!== 'requirement').included,false)
  assert.equal(summary(r,'bug').statistic_count,1)
  assert.equal(summary(r,'bug').completed_count,1)
  assert.equal(summary(r,'work_order').statistic_count,1)
})
test('最新计划归期；期初未完成的遗留进入分母，前期已完成的不再结转', () => {
  const records=[row('task',1,{plan_date:'2026-10-10',created_date:'2026-10-01',status:2,actual_date:'2026-11-03'}),
    row('task',2,{plan_date:'2026-10-10',created_date:'2026-10-01',status:2,actual_date:'2026-10-15'}),
    row('task',3,{plan_date:'2026-12-01'}),row('task',4,{plan_date:null})]
  const r=calc(records,[transition('task',1,1,2,'2026-11-03')])
  assert.equal(summary(r,'task').statistic_count,1)
  assert.equal(summary(r,'task').completed_count,1)
  assert.equal(r.details.find(d=>d.record_id===1).period_basis,'carried_over')
})
test('后来完成不倒算前期，历史无证据和历史不连续返回待核实', () => {
  const historical={period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'}
  const records=[row('task',1,{created_date:'2026-10-01',plan_date:'2026-10-10',status:2,actual_date:'2026-11-03'}),
    row('task',2,{created_date:'2026-10-01',plan_date:'2026-10-10',status:1})]
  const r=calc(records,[],historical)
  assert.equal(r.details.find(d=>d.record_id===1).completed,false)
  assert.equal(r.details.find(d=>d.record_id===2).completed,null)
  assert.equal(summary(r,'task').statistic_count,null)
  assert.equal(summary(r,'task').known_statistic_count,1)
  assert.equal(summary(r,'task').completed_count,null)
  assert.equal(summary(r,'task').completion_rate,null)
  const broken=calc([records[0]],[transition('task',1,0,2,'2026-10-10'),transition('task',1,1,2,'2026-11-03')],historical)
  assert.equal(summary(broken,'task').completion_rate,null)
})
test('BUG期初未关闭、本期新增或多次激活，同一BUG每期只计一次', () => {
  const records=[row('bug',1,{created_date:'2026-10-01',status:2,actual_date:'2026-11-09'}),
    row('bug',2,{created_date:'2026-10-01',status:2,actual_date:'2026-10-20'}),
    row('bug',3,{created_date:'2026-11-01',status:1})]
  const logs=[transition('bug',1,2,3,'2026-11-02'),transition('bug',1,3,2,'2026-11-03'),
    transition('bug',1,2,3,'2026-11-04'),transition('bug',1,3,2,'2026-11-09')]
  const r=calc(records,logs)
  assert.equal(summary(r,'bug').statistic_count,2)
  assert.equal(summary(r,'bug').completed_count,1)
})
test('关闭后恢复重新参与，不借用当前关闭状态排除历史期内未关闭工作', () => {
  const rec=row('task',1,{status:4,close_date:'2026-11-05',plan_date:'2026-10-15',created_date:'2026-10-01'})
  const logs=[transition('task',1,1,4,'2026-11-05')]
  const r=calc([rec],logs,{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
  assert.equal(summary(r,'task').statistic_count,1)
  assert.equal(summary(r,'task').completed_count,0)
  rec.status=1
  logs.push(transition('task',1,4,1,'2026-11-06'))
  assert.equal(summary(calc([rec],logs),'task').statistic_count,1)
})
test('多人负责人分别计入，成员协作人不自动纳入；未知子任务不抹去已知未完成证据',()=>{
 const r=calc([row('task',1,{status:2,owner_ids:[8,9]}),row('project',2,{owner_id:9,owner_ids:[9,8]})],[],{people:[{id:8,name:'甲'},{id:9,name:'乙'}]})
 assert.equal(summary(r,'task',8).statistic_count,1)
 assert.equal(summary(r,'task',9).statistic_count,1)
 assert.equal(summary(r,'project',8).statistic_count,0)
 const records=[row('task',1,{created_date:'2026-10-01',plan_date:'2026-10-15'}),
  row('task',2,{created_date:'2026-10-01',parent_task_id:1,owner_ids:[9],status:2,actual_date:'2026-11-05'}),
  row('task',3,{created_date:'2026-10-01',parent_task_id:1,owner_ids:[9]})]
 const past=calc(records,[transition('task',1,0,1,'2026-10-02')],{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
 assert.equal(summary(past,'task').statistic_count,1)
 assert.equal(summary(past,'task').completed_count,0)
})
test('历史需求类型变更按历史类型判断；历史日期与现行日期冲突不补造结论',()=>{
 const req=row('requirement',1,{requirement_type:2,status:10,created_date:'2026-10-01',plan_date:'2026-10-20'})
 const log=transition('requirement',1,2,10,'2026-11-03')
 const type={...log,field_name:'requirement_type',old_value:'1',new_value:'2',log_id:2}
 const old=calc([req],[log,type],{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
 assert.equal(summary(old,'requirement').completed_count,1)
 const task=row('task',2,{status:2,actual_date:'2026-11-05',created_date:'2026-10-01',plan_date:'2026-10-20'})
 const event=transition('task',2,1,2,'2026-10-20')
 const date={...event,field_name:'actual_end_date',old_value:null,new_value:'2026-10-20'}
 const inconsistent=calc([task],[event,date],{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
 assert.equal(summary(inconsistent,'task').completion_rate,null)
})
test('历史来源变更按当时来源校验关闭，而不是按当前日常任务关系判断',()=>{
 const task=row('task',1,{project_id:null,status:2,actual_date:'2026-11-08',created_date:'2026-10-01',plan_date:'2026-10-20'})
 const project=row('project',2,{owner_id:9,requirement_id:3,created_date:'2026-09-01'})
 const req=row('requirement',3,{status:37,owner_id:9,close_date:'2026-10-15',created_date:'2026-09-01'})
 const change={...transition('task',1,1,2,'2026-11-07'),field_name:'project_id',old_value:'2',new_value:null}
 const logs=[change,transition('project',2,0,1,'2026-09-02'),transition('requirement',3,31,37,'2026-10-15')]
 const old=calc([task,project,req],logs,{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
 assert.equal(summary(old,'task').statistic_count,0)
 assert.equal(old.details.find(d=>d.business_type==='task').reason_code,'ancestor_closed')
})
test('未来新增本人子任务不改写此前主任务的个人完成率',()=>{
 const main=row('task',1,{status:1,created_date:'2026-10-01',plan_date:'2026-10-20'})
 const child=row('task',2,{parent_task_id:1,created_date:'2026-11-05'})
 const logs=[transition('task',1,1,2,'2026-10-20'),transition('task',1,2,1,'2026-11-01')]
 const old=calc([main,child],logs,{period:{start_date:'2026-10-01',end_date:'2026-10-31'},cutoff:'2026-10-31'})
 assert.equal(summary(old,'task').statistic_count,1)
 assert.equal(summary(old,'task').completed_count,1)
 assert.equal(summary(old,'task').completion_rate,100)
})
test('明确重新评估或初次评估后暂停，尚无结论属于未完成而非证据缺失',()=>{
 const reopened=row('requirement',1,{requirement_type:1,status:35})
 const initial=row('requirement',2,{requirement_type:1,status:35})
 const logs=[transition('requirement',1,3,0,'2026-11-03'),transition('requirement',1,0,35,'2026-11-04'),
  transition('requirement',2,0,35,'2026-11-04')]
 const result=calc([reopened,initial],logs)
 assert.equal(summary(result,'requirement').statistic_count,2)
 assert.equal(summary(result,'requirement').completed_count,0)
 assert.equal(summary(result,'requirement').completion_rate,0)
 assert.ok(result.details.every(detail=>detail.completed===false))
})

test('完成率查询保留补录的暂停业务日期，恢复后不把此前考核期误算已完成', async () => {
  const { analyzeBusinessCompletion } = require('../src/services/mcpCompletionAnalysisService')
  for (const [type, paused, active, dateField] of [
    ['task', 3, 1, 'suspend_date'], ['project', 3, 1, 'suspend_date'],
    ['requirement', 35, 31, 'pause_date'], ['work_order', 4, 1, 'suspend_date'],
  ]) {
    const complete = type === 'requirement' ? 33 : 2
    const date = value => `${value}T12:00:00+08:00`
    const record = row(type, 1, { status: active, plan_date: '2026-10-20',
      created_at: date('2026-10-01'), created_date: '2026-10-01' })
    const logs = [
      { ...transition(type, 1, active, complete, '2026-10-10', 'completed'), log_id: 1 },
      { ...transition(type, 1, complete, paused, '2026-11-02', 'paused'), log_id: 2 },
      { business_type: type, target_id: 1, field_name: dateField, old_value: null,
        new_value: '2026-10-15', created_at: date('2026-11-02'), operation_id: 'paused', log_id: 3 },
      { ...transition(type, 1, paused, active, '2026-11-05', 'resumed'), log_id: 4 },
    ]
    const database = { prepare(sql) { return { all: async (...params) => {
      if (sql.includes('completion_analysis:people')) return [{ id: 8, name: '测试人员' }]
      if (sql.includes(`period_analysis:records:${type}`)) return [record]
      if (sql.includes('period_analysis:logs')) return logs.filter(log => params.at(-1).includes(log.field_name))
      throw new Error(`Unexpected SQL: ${sql}`)
    } } } }
    const result = await analyzeBusinessCompletion({ analysis_period: { preset: 'custom',
      start_date: '2026-10-01', end_date: '2026-10-31' }, business_types: [type] },
    { user: { id: 8 }, allowedMenuPaths: new Set([type === 'work_order' ? '/work-orders' : `/${type}s`]) },
    database, new Date('2026-11-15T00:00:00Z'))
    assert.equal(summary(result, type).completed_count, 0, type)
    assert.equal(summary(result, type).completion_rate, 0, type)
  }
})

test('查询历史阶段完成情况时按当时所属阶段汇总跨阶段移动的事项', async () => {
  const { analyzeBusinessCompletion } = require('../src/services/mcpCompletionAnalysisService')
  const item = row('stage_plan', 20, { status: 2, stage_id: '11', project_id: 1, owner_id: 9,
    owner_ids: [9], created_at: '2026-10-01T09:00:00+08:00', plan_date: '2026-10-20', actual_date: '2026-10-20' })
  const project = row('project', 1, { created_at: '2026-10-01T09:00:00+08:00' })
  const logs = [transition('project', 1, 0, 1, '2026-10-02'),
    { ...transition('stage_plan', 20, 10, 11, '2026-11-05'), field_name: 'stage_id' }]
  const database = { prepare(sql) { return { all: async (...params) => {
    if (sql.includes('completion_analysis:people')) return [{ id: 8, name: '测试人员' }]
    if (sql.includes('period_analysis:records:stage_plan')) return [item]
    if (sql.includes('completion_analysis:stages')) return [10, 11].map(id => ({
      business_type: 'project_stage', id, name: `阶段${id}`, project_id: 1, created_at: '2026-10-01T09:00:00+08:00' }))
    if (sql.includes('completion_analysis:parent_projects')) return [project]
    if (sql.includes('period_analysis:logs')) return logs.filter(log =>
      params.at(-1).includes(log.field_name) && sql.includes(`WHEN '${log.business_type === 'project' ? '项目' : '项目阶段主计划'}'`))
    throw new Error(`Unexpected SQL: ${sql}`)
  } } } }
  const result = await analyzeBusinessCompletion({ analysis_period: { preset: 'custom', start_date: '2026-10-01',
    end_date: '2026-10-31' }, business_types: ['project_stage'] },
  { user: { id: 8 }, allowedMenuPaths: new Set(['/projects']) }, database, new Date('2026-11-15T00:00:00Z'))
  assert.equal(result.details.items.find(detail => detail.record_id === 10).completed, true)
  assert.equal(result.details.items.find(detail => detail.record_id === 11).completed, false)
  assert.equal(result.coverage.stage_completion_complete, true)
})

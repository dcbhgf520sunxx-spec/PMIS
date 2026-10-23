const db = require('../db')
const { BUSINESS_TYPES, loadRecords, loadLogs, buildHistories, historicalStatus, dateOnly, shanghaiDate, resolvePeriod } = require('./mcpPeriodAnalysisService')
const { createPeriodDatasetToken, assertPeriodDatasetToken } = require('./mcpPeriodDetails')
const { summarizeRichText } = require('../mcp/contentPolicy')
const TYPES = { ...BUSINESS_TYPES, project_stage: { label: '项目阶段', menu: '/projects' } }
const CLOSED = { requirement: 37, project: 4, task: 4, work_order: 3 }
const { requirementCompletion } = require('./requirementCompletionRules')
const STATUS_VALUES = { requirement: [0,1,2,3,10,11,12,13,20,21,22,30,31,32,33,34,35,36,37],
  project:[0,1,2,3,4], task:[0,1,2,3,4], stage_plan:[0,1,2,3], bug:[0,1,2,3], work_order:[0,1,2,3,4,5] }
const REASONS = { completed:'已完成', unfinished:'尚未完成', self_closed:'单据取消关闭', ancestor_closed:'上级需求、项目或主任务关闭',
  all_children_closed:'全部子任务关闭', personal_task_duplicate:'本人同时负责主任务和子任务，只统计子任务',
  no_plan_date:'没有有效计划完成日期', outside_period:'最新计划日期不在本期，且不符合遗留条件',
  completed_before_period:'期初之前已完成，不结转本期', not_created:'观察日单据尚未创建',
  historical_state_missing:'缺少历史状态或历史状态不连续', conclusion_missing:'缺少本轮有效需求结论证据',
  dependency_missing:'关联上级或子任务资料不足', stage_personal_scope_missing:'项目阶段缺少独立负责人及计划完成日期，不推定个人考核归属',
  bug_outside_period:'BUG在期初已关闭，本期未取得重新激活证据', bug_scope_unknown:'BUG期初状态或本期重新激活证据不足',
  carry_state_unknown:'无法核实期初是否仍未完成', relationship_changed:'观察日之后关联或需求类型发生变化且历史依据不足' }
REASONS.children_completed='所有未关闭子任务均已完成'
REASONS.children_unfinished='存在未关闭且尚未完成的子任务'
const key = r => `${r.business_type}:${r.id}`
const previousDay = value => new Date(Date.parse(value + 'T00:00:00Z') - 86400000).toISOString().slice(0,10)
const closed = (r, status) => CLOSED[r.business_type] === status
const terminal = (r, status) => (r.business_type === 'requirement' ? [33,34,36] : [2]).includes(status)
function error(code, field, message) { return Object.assign(new Error(message), { code, ...(field ? { fieldErrors:{[field]:message} } : {}) }) }
const pointer = value => value===null || value===undefined || ['', 'null'].includes(String(value).trim()) ? null : Number(value)
function fieldAt(r,field,cutoff,history,today) {
  let value=pointer(r[field])
  if(cutoff===today)return value
  for(const log of [...(history?.fields||[])].reverse().filter(log=>log.field_name===field&&dateOnly(log.created_at)>cutoff)) {
    if(pointer(log.new_value)!==value)return undefined
    value=pointer(log.old_value)
  }
  return value
}

// Only current status, explicit business dates and scoped history are evidence; updated_at is never used.
function statusAt(r, cutoff, history, today) {
  if (r.created_date && r.created_date > cutoff) return { status:null, notCreated:true, evidence:[] }
  const transitions = [...(history?.transitions || [])].sort((a,b)=>a.date.localeCompare(b.date) || Number(a.log.log_id)-Number(b.log.log_id))
  if (cutoff === today) return { status:r.status, evidence:[{source:'current_status',date:today,log_id:null}] }
  if (history?.inconsistent) return { status:null, evidence:[] }
  const lastRecorded=history?.transitions?.at(-1)
  if(lastRecorded?.status===r.status&&terminal(r,r.status)&&lastRecorded.actual_date&&r.actual_date&&lastRecorded.actual_date!==r.actual_date)return {status:null,evidence:[]}
  if (transitions.length) {
    const latest=transitions.filter(event=>event.date<=cutoff).at(-1)
    const restored=historicalStatus(history,latest,cutoff)
    if(restored)return {status:restored.status,evidence:[restored]}
    const status=latest?.status ?? transitions[0].previous_status
    return { status, evidence:[{source:latest?.date_source || 'history_previous_status',date:latest?.date || transitions[0].date,
      log_id:Number((latest || transitions[0]).log.log_id) || null}] }
  }
  const initial=historicalStatus(history,null,cutoff)
  if(initial)return {status:initial.status,evidence:[initial]}
  const paused=({project:3,task:3,requirement:35,stage_plan:3,work_order:4})[r.business_type]===r.status
  const businessDate = closed(r,r.status) ? dateOnly(r.close_date) : terminal(r,r.status) ? r.actual_date : paused ? r.pause_date : null
  if (businessDate && businessDate<=cutoff) return {status:r.status,evidence:[{source:'current_business_date',date:businessDate,log_id:null}]}
  if (businessDate && terminal(r,r.status) && businessDate>cutoff && r.business_type!=='requirement') {
    return {status:0,evidence:[{source:'later_completion_date',date:businessDate,log_id:null}]}
  }
  return {status:null,evidence:[]}
}

function evaluateCompletion({records,logs,people,types,period,today,cutoff}) {
  const map=new Map(records.map(r=>[key(r),r]))
  const histories=buildHistories(records.filter(r=>r.business_type!=='project_stage'),logs)
  const children=new Map(),items=new Map(),uncertainStageProjects=new Set()
  for(const r of records) {
    const collection=r.business_type==='task'&&r.parent_task_id ? children : r.business_type==='stage_plan'&&r.stage_id ? items : null
    const id=collection===children?Number(r.parent_task_id):fieldAt(r,'stage_id',cutoff,histories.get(key(r)),today)
    if(collection===items&&id===undefined){uncertainStageProjects.add(Number(r.project_id));continue}
    if(collection){if(!collection.has(id))collection.set(id,[]);collection.get(id).push(r)}
  }
  const cache=new Map()
  function judge(r,date,seen=new Set()) {
    const cacheKey=key(r)+':'+date
    if(cache.has(cacheKey))return cache.get(cacheKey)
    if(seen.has(key(r)))return {eligible:null,completed:null,reason_code:'dependency_missing',evidence:[]}
    const chain=new Set([...seen,key(r)])
    const state=r.business_type==='project_stage' ? {status:null,evidence:[],notCreated:r.created_date>date} : statusAt(r,date,histories.get(key(r)),today)
    state.evidence=state.evidence.map(proof=>({...proof,record_id:Number(r.id),business_type:r.business_type}))
    let result={eligible:true,completed:null,reason_code:'historical_state_missing',evidence:state.evidence}
    if(state.notCreated)return { ...result,eligible:false,reason_code:'not_created' }
    if(r.business_type!=='project_stage' && state.status!==null && closed(r,state.status))return {...result,eligible:false,completed:false,reason_code:'self_closed'}
    // Read only boundary state for linked ancestors; it never becomes a person's work.
    const refs=[]
    const fields={}
    for(const field of ['project_id','requirement_id','parent_task_id'])fields[field]=fieldAt(r,field,date,histories.get(key(r)),today)
    if(Object.values(fields).includes(undefined))return {...result,eligible:null,reason_code:'relationship_changed'}
    if(fields.project_id && r.business_type!=='project')refs.push(`project:${fields.project_id}`)
    if(fields.requirement_id && r.business_type!=='requirement')refs.push(`requirement:${fields.requirement_id}`)
    if(fields.parent_task_id)refs.push(`task:${fields.parent_task_id}`)
    for(const ref of refs) {
      const parent=map.get(ref)
      if(!parent)return {...result,eligible:null,reason_code:'dependency_missing'}
      // Parent tasks derive completion from children; the boundary check only follows their ancestors.
      const parentState=statusAt(parent,date,histories.get(key(parent)),today)
      parentState.evidence=parentState.evidence.map(proof=>({...proof,record_id:Number(parent.id),business_type:parent.business_type}))
      if(closed(parent,parentState.status))return {...result,eligible:false,completed:false,reason_code:'ancestor_closed',evidence:[...result.evidence,...parentState.evidence]}
      if(parentState.status===null)return {...result,eligible:null,reason_code:'historical_state_missing'}
      const source=parent.business_type==='project'?fieldAt(parent,'requirement_id',date,histories.get(key(parent)),today):null
      if(source===undefined)return {...result,eligible:null,reason_code:'relationship_changed'}
      if(source) {
        const requirement=map.get(`requirement:${source}`)
        if(!requirement)return {...result,eligible:null,reason_code:'dependency_missing'}
        const reqState=statusAt(requirement,date,histories.get(key(requirement)),today)
        reqState.evidence=reqState.evidence.map(proof=>({...proof,record_id:Number(requirement.id),business_type:'requirement'}))
        if(reqState.status===37)return {...result,eligible:false,completed:false,reason_code:'ancestor_closed',evidence:[...result.evidence,...reqState.evidence]}
        if(reqState.status===null)return {...result,eligible:null,reason_code:'historical_state_missing'}
      }
    }
    if(r.business_type==='project_stage') {
      const stageItems=(items.get(r.id)||[]).filter(item=>!item.created_date||item.created_date<=date)
      const states=stageItems.map(item=>judge(item,date,chain))
      const uncertain=uncertainStageProjects.has(Number(r.project_id))
      result.completed=uncertain ? null : stageItems.length ? states.every(s=>s.completed===true) ? true : states.some(s=>s.completed===false) ? false : null : false
      result.evidence.push({source:'stage_items_aggregate',date,log_id:null,record_id:r.id,business_type:r.business_type,related_record_ids:stageItems.map(item=>item.id)})
      result.eligible=false
      result.reason_code=uncertain?'relationship_changed':'stage_personal_scope_missing'
    } else if(state.status===null || !STATUS_VALUES[r.business_type]?.includes(state.status))result.eligible=null
    else if(r.business_type==='task'&&(children.get(r.id)||[]).some(child=>!child.created_date||child.created_date<=date)) {
      const states=children.get(r.id).filter(child=>!child.created_date||child.created_date<=date).map(child=>{
        // The parent has already been checked; do not follow it back while aggregating children.
        return judge({...child,parent_task_id:null},date,chain)
      })
      const active=states.filter(s=>s.eligible===true)
      const unknown=states.some(s=>s.eligible===null)
      if(!active.length&&!unknown)result={...result,eligible:false,completed:false,reason_code:'all_children_closed'}
      else if(!active.length)result={...result,eligible:null,completed:null,reason_code:'dependency_missing'}
      else result={...result,completed:active.some(s=>s.completed===false)?false:unknown||active.some(s=>s.completed===null)?null:true}
      result.evidence.push({source:'children_aggregate',date,log_id:null,record_id:r.id,business_type:r.business_type,related_record_ids:children.get(r.id).map(child=>child.id)})
    } else if(r.business_type==='requirement') {
      const type=fieldAt(r,'requirement_type',date,histories.get(key(r)),today)
      const completion=type===undefined?{completed:null,reason_code:'relationship_changed'}:requirementCompletion({...r,requirement_type:type},state.status,date,histories.get(key(r)))
      result={...result,...completion,evidence:[...result.evidence,...(completion.evidence||[])]}
    }
    else result.completed=state.status===2
    if(result.completed!==null&&result.eligible===true)result.reason_code=r.business_type==='task'&&(children.get(r.id)||[]).length?result.completed?'children_completed':'children_unfinished':result.completed?'completed':'unfinished'
    cache.set(cacheKey,result)
    return result
  }
  const details=[]
  for(const person of people)for(const r of records.filter(r=>types.includes(r.business_type)&&r.business_type!=='project_stage')) {
    const owners=r.business_type==='task' ? r.owner_ids || [] : [r.owner_id]
    if(!owners.map(Number).includes(Number(person.id)))continue
    let judgement=judge(r,cutoff)
    let included=judgement.eligible,reason=judgement.reason_code,basis=null
    if(included!==false && r.business_type==='task' && !r.parent_task_id && (children.get(r.id)||[]).some(c=>(!c.created_date||c.created_date<=cutoff)&&(c.owner_ids||[]).map(Number).includes(Number(person.id)))) {
      included=false;reason='personal_task_duplicate'
    }
    if(included!==false&&r.business_type!=='bug') {
      if(!r.plan_date){included=false;reason='no_plan_date'}
      else if(r.plan_date>period.end_date){included=false;reason='outside_period'}
      else if(r.plan_date>=period.start_date)basis='planned_in_period'
      else {
        const opening=judge(r,previousDay(period.start_date))
        if(opening.reason_code==='not_created'){included=false;reason='outside_period'}
        else if(opening.completed===true){included=false;reason='completed_before_period'}
        else if(opening.eligible===null||opening.completed===null){included=null;reason='carry_state_unknown'}
        else basis='carried_over'
      }
    } else if(included!==false) {
      const activated=(histories.get(key(r))?.transitions||[]).some(e=>e.status===3&&e.date>=period.start_date&&e.date<=cutoff)
      if(r.created_date>=period.start_date&&r.created_date<=cutoff)basis='created_in_period'
      else if(activated)basis='activated_in_period'
      else {
        const opening=judge(r,previousDay(period.start_date))
        if(opening.completed===true){included=false;reason='bug_outside_period'}
        else if(opening.completed===null||opening.eligible===null){included=null;reason='bug_scope_unknown'}
        else basis='open_at_start'
      }
    }
    details.push({person_id:Number(person.id),business_type:r.business_type,record_id:r.id,
      name:summarizeRichText(r.name).slice(0,160),plan_date:r.plan_date || null,parent_task_id:r.parent_task_id ? Number(r.parent_task_id) : null,
      project_id:r.project_id?Number(r.project_id):null,requirement_id:r.requirement_id?Number(r.requirement_id):null,
      detail_target_id:r.business_type==='stage_plan'?Number(r.project_id)||null:Number(r.id),
      included,completed:judgement.completed,period_basis:basis,reason_code:reason,reason:REASONS[reason]||'待核实',evidence:judgement.evidence})
  }
  if(types.includes('project_stage'))for(const stage of records.filter(r=>r.business_type==='project_stage')) {
    const state=judge(stage,cutoff)
    details.push({person_id:null,business_type:'project_stage',record_id:stage.id,name:summarizeRichText(stage.name).slice(0,160),plan_date:null,parent_task_id:null,project_id:Number(stage.project_id)||null,requirement_id:null,detail_target_id:Number(stage.project_id)||null,
      included:false,completed:state.completed,period_basis:null,reason_code:state.reason_code,reason:REASONS[state.reason_code]||'待核实',evidence:state.evidence})
  }
  const results=people.flatMap(person=>types.map(type=>{
    const own=details.filter(d=>d.person_id===Number(person.id)&&d.business_type===type)
    const included=own.filter(d=>d.included===true)
    const uncertainMembership=own.some(d=>d.included===null)
    const uncertainCompletion=included.some(d=>d.completed===null)
    const knownCompleted=included.filter(d=>d.completed===true).length
    const count=uncertainMembership?null:included.length
    const completed=uncertainMembership||uncertainCompletion?null:knownCompleted
    return {person_id:Number(person.id),person_name:person.name,business_type:type,business_type_label:TYPES[type].label,
      statistic_count:count,completed_count:completed,known_statistic_count:included.length,known_completed_count:knownCompleted,
      unknown_count:own.filter(d=>d.included===null||(d.included===true&&d.completed===null)).length,
      excluded_count:own.filter(d=>d.included===false).length,
      completion_rate:count&&completed!==null?Math.round(completed/count*10000)/100:null,
      result_status:type==='project_stage'?'不适用':uncertainMembership||uncertainCompletion?'待核实':count?'已核实':'无符合条件单据'}
  }))
  details.sort((a,b)=>(a.person_id||0)-(b.person_id||0)||a.business_type.localeCompare(b.business_type)||a.record_id-b.record_id)
  return {results,details}
}

async function analyzeBusinessCompletion(args,context,database=db,now=new Date(),includeSourceData=false) {
  const actorId=Number(context.user?.id)
  if(!Number.isSafeInteger(actorId)||actorId<1)throw error('MCP_PERMISSION_DENIED',null,'需要有效的已鉴权人员身份')
  const page=args.page??1,pageSize=args.page_size??50
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw error('MCP_ARGUMENT_INVALID','page','页码必须为正整数，每页条数为1至100')
  if((page>1||args.dataset_token!==undefined)&&!/^[a-f0-9]{64}$/.test(args.dataset_token||''))throw error('MCP_ARGUMENT_INVALID','dataset_token','续页须提供首次返回的64位datasetToken')
  const today=shanghaiDate(now)
  const period=resolvePeriod(args.analysis_period,now)
  if(period.start_date>today)throw error('MCP_ARGUMENT_INVALID','analysis_period','考核期尚未开始，不能输出未来考核结果')
  const cutoff=period.end_date<today?period.end_date:today
  const permitted=Object.keys(TYPES).filter(type=>context.allowedMenuPaths?.has(TYPES[type].menu))
  const types=args.business_types||permitted
  if(!types.length||types.some(type=>!permitted.includes(type)))throw error('MCP_PERMISSION_DENIED','business_types','当前账号没有所请求业务的完成率查询权限')
  const requested=args.person_ids || [actorId]
  if(!requested.length||requested.some(id=>!Number.isSafeInteger(id)||id<1))throw error('MCP_ARGUMENT_INVALID','person_ids','需要当前已鉴权人员身份或有效人员标识')
  const people=await database.prepare('/* completion_analysis:people */ SELECT id,real_name name FROM pms_user WHERE id=ANY(?::BIGINT[]) AND is_deleted=0 AND status=1 ORDER BY id').all([requested])
  if(people.length!==new Set(requested).size)throw error('MCP_ARGUMENT_INVALID','person_ids','人员不存在、已删除或停用，请重新定位有效人员')
  const readTypes=[...new Set(types.flatMap(type=>type==='project_stage'?['stage_plan']: [type]))]
  const records=await loadRecords(readTypes,{},database,today,false)
  if(types.includes('project_stage')){
    const stages=await database.prepare('/* completion_analysis:stages */ SELECT \'project_stage\' business_type,id,name,project_id,created_at FROM pms_project_plan_stage WHERE is_deleted=0 ORDER BY id').all()
    records.push(...stages.map(r=>({...r,id:Number(r.id),project_id:Number(r.project_id),created_date:dateOnly(r.created_at)})))
  }
  const historyFields=['status','actual_end_date','closed_date','resolved_date','resolve_date','suspend_date','pause_date','close_date','stage_id','requirement_type','project_id','requirement_id','parent_task_id','source_type']
  const sourceTypes=rows=>[...new Set(rows.map(r=>r.business_type).filter(type=>type!=='project_stage'))]
  const logs=await loadLogs(sourceTypes(records),records,database,null,historyFields)
  const references=(field,rows=records,history=logs)=>[...new Set([
    ...rows.map(r=>pointer(r[field])),
    ...history.filter(log=>log.field_name===field).flatMap(log=>[pointer(log.old_value),pointer(log.new_value)]),
  ].filter(value=>Number.isSafeInteger(value)&&value>0))]
  const existing=new Set(records.map(key))
  const normalizeParent=parent=>({...parent,id:Number(parent.id),status:Number(parent.status),created_date:dateOnly(parent.created_at),actual_date:dateOnly(parent.actual_date)})
  const projectIds=references('project_id')
  if(projectIds.length){
    const parents=await database.prepare("/* completion_analysis:parent_projects */ SELECT 'project' business_type,id,status,requirement_id,actual_end_date actual_date,suspend_date pause_date,close_date,created_at FROM pms_project WHERE id=ANY(?::BIGINT[]) AND is_deleted=0").all([projectIds])
    const added=parents.filter(parent=>!existing.has(key(parent))).map(normalizeParent)
    records.push(...added)
    logs.push(...await loadLogs(sourceTypes(added),added,database,null,historyFields))
  }
  const requirementIds=references('requirement_id')
  if(requirementIds.length){
    const parents=await database.prepare("/* completion_analysis:parent_requirements */ SELECT 'requirement' business_type,id,status,requirement_type,actual_end_date actual_date,pause_date,close_date,created_at FROM pms_requirement WHERE id=ANY(?::BIGINT[]) AND is_deleted=0").all([requirementIds])
    const added=parents.filter(parent=>!existing.has(key(parent))).map(normalizeParent)
    records.push(...added)
    logs.push(...await loadLogs(sourceTypes(added),added,database,null,historyFields))
  }
  const evaluated=evaluateCompletion({records,logs,people,types,period,today,cutoff})
  const token=createPeriodDatasetToken({version:'2026-10-13',period,cutoff,types,people,actor:context.user.id,menus:[...context.allowedMenuPaths].sort()},evaluated.details)
  assertPeriodDatasetToken({datasetToken:args.dataset_token},token,'dataset_token')
  const offset=(page-1)*pageSize
  return {...(includeSourceData ? {sourceData:{records,logs}} : {}),rule_version:'2026-10-13',period,observation_date:cutoff,data_cutoff:now.toISOString(),results:evaluated.results,
    details:{items:evaluated.details.slice(offset,offset+pageSize),total:evaluated.details.length,page,pageSize,totalPages:Math.ceil(evaluated.details.length/pageSize),hasNextPage:offset+pageSize<evaluated.details.length,datasetToken:token},
    coverage:{statistics_complete:evaluated.results.every(r=>r.unknown_count===0),stage_completion_complete:evaluated.details.filter(d=>d.business_type==='project_stage').every(d=>d.completed!==null),authorized_business_types:types,
      notes:['按当前责任角色及最新计划完成日期统计；历史责任人、原定计划版本不追溯','已结束考核期按期末判断，未结束考核期按上海今天判断；后期完成不倒算前期','项目阶段只汇总关键事项，不推定个人归属或计划日期','待核实结果的比例为空，已知数量与明细保留；没有符合条件单据的比例也为空','跨请求读取非事务快照；明细续页校验数据集指纹，不以候选条数代替完整聚合']}}
}
module.exports={TYPES,analyzeBusinessCompletion,evaluateCompletion,statusAt,fieldAt}

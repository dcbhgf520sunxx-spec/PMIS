const CONCLUSIONS = { 1: [2, 3], 2: [12, 13], 3: [21, 22] }
const EARLY = { 1: [0, 1], 2: [10, 11], 3: [20] }
function requirementCompletion(r, status, cutoff, history) {
  if (status===36) return {completed:true,reason_code:'completed'}
  const type=Number(r.requirement_type)
  if (type===4) return {completed:[33,34].includes(status),reason_code:[33,34].includes(status)?'completed':'unfinished'}
  if (!CONCLUSIONS[type]) return {completed:null,reason_code:'conclusion_missing'}
  if (CONCLUSIONS[type].includes(status)) return {completed:true,reason_code:'completed'}
  if (EARLY[type].includes(status)) return {completed:false,reason_code:'unfinished'}
  if (![30,31,32,33,34,35].includes(status) || history?.inconsistent) return {completed:null,reason_code:'conclusion_missing'}
  let valid=null,proof=null
  for(const event of [...(history?.transitions || [])].filter(e=>e.date<=cutoff).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.log.log_id)-Number(b.log.log_id))) {
    if(CONCLUSIONS[type].includes(event.previous_status)){valid=true;proof=event}
    if(EARLY[type].includes(event.previous_status)){valid=false;proof=event}
    if(EARLY[type].includes(event.status)){valid=false;proof=event}
    if(CONCLUSIONS[type].includes(event.status)){valid=true;proof=event}
  }
  return valid===null ? {completed:null,reason_code:'conclusion_missing'} : {completed:valid,reason_code:valid?'completed':'unfinished',evidence:[{source:valid?'requirement_conclusion_history':'requirement_evaluation_history',date:proof.date,log_id:Number(proof.log.log_id)||null,record_id:r.id,business_type:r.business_type}]}
}


// Keep SQL filtering and the object evaluator on the same path/conclusion definitions.
function requirementCompletionSql(alias = 'pms_requirement', targetStatus) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) throw new Error('Invalid SQL alias')
  if (targetStatus !== undefined && !Number.isSafeInteger(targetStatus)) throw new Error('Invalid requirement status')
  const type = `${alias}.requirement_type`, current = `${alias}.status`
  const status = targetStatus === undefined ? current : String(targetStatus)
  const matches = (field, states) => '(' + Object.entries(states).map(([path, values]) =>
    `(${type}=${path} AND ${field} IN (${values.map(value => `'${value}'`).join(',')}))`).join(' OR ') + ')'
  const decision = `CASE WHEN ${matches('h.new_value', CONCLUSIONS)} THEN TRUE
    WHEN ${matches('h.new_value', EARLY)} THEN FALSE
    WHEN ${matches('h.old_value', CONCLUSIONS)} THEN TRUE
    WHEN ${matches('h.old_value', EARLY)} THEN FALSE END`
  const today = "TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD')"
  const history = `(SELECT CASE WHEN BOOL_OR(h.previous_new IS NOT NULL AND h.previous_new<>h.old_value)
    OR (ARRAY_AGG(h.new_value ORDER BY h.created_at DESC,h.id DESC))[1]<>${current}::text THEN NULL
    ELSE (ARRAY_AGG(${decision} ORDER BY h.event_date DESC,h.id DESC)
      FILTER (WHERE h.event_date<=${today} AND (${decision}) IS NOT NULL))[1] END
    FROM (SELECT l.id,l.old_value,l.new_value,l.created_at,
      LAG(l.new_value) OVER (ORDER BY l.created_at,l.id) previous_new,
      COALESCE((SELECT f.new_value FROM pms_op_log f
        WHERE f.module='需求' AND f.target_id=l.target_id
          AND ((l.operation_id IS NOT NULL AND f.operation_id=l.operation_id)
            OR (l.operation_id IS NULL AND f.operation_id IS NULL AND f.created_at=l.created_at AND f.user_id IS NOT DISTINCT FROM l.user_id))
          AND f.field_name=CASE WHEN l.new_value IN ('33','34') THEN 'actual_end_date'
            WHEN l.new_value='35' THEN 'pause_date' WHEN l.new_value='37' THEN 'close_date' END
          AND f.new_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ORDER BY f.created_at DESC,f.id DESC LIMIT 1),
        TO_CHAR(l.created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD')) event_date
      FROM pms_op_log l WHERE l.module='需求' AND l.target_id=${alias}.id AND l.field_name='status'
        AND l.old_value IS DISTINCT FROM l.new_value) h)`
  return `(CASE WHEN ${status}=36 THEN TRUE WHEN ${type}=4 THEN ${status} IN (33,34)
    WHEN ${type} NOT IN (1,2,3) THEN NULL
    WHEN ${matches(`(${status})::text`, CONCLUSIONS)} THEN TRUE
    WHEN ${matches(`(${status})::text`, EARLY)} THEN FALSE
    WHEN ${status} IN (30,31,32,33,34,35) THEN ${history} ELSE NULL END)`
}

async function completionForChange(database, record, targetStatus = Number(record.status)) {
  const simple = requirementCompletion(record, targetStatus, '', null).completed
  if (simple !== null || !record.id) return simple
  const type=Number(record.requirement_type), previous=Number(record.status)
  if ((CONCLUSIONS[type] || []).includes(previous) || (EARLY[type] || []).includes(previous)) {
    return requirementCompletion(record,previous,'',null).completed
  }
  const row = await database.prepare(`SELECT ${requirementCompletionSql('r', targetStatus)} AS completed FROM pms_requirement r WHERE r.id=?`).get(record.id)
  return row?.completed ?? null
}
module.exports = { requirementCompletion, requirementCompletionSql, completionForChange }

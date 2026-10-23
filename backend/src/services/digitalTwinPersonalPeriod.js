const { createHash } = require('node:crypto');
const { resolvePeriod, shanghaiDate, buildHistories, dateOnly } = require('./mcpPeriodAnalysisService');
const { evaluateCompletion, statusAt, fieldAt } = require('./mcpCompletionAnalysisService');
const { labels } = require('./digitalTwinModel');
const { calculateOverdue, POLICIES } = require('./overdueRules');
const typeByKind = {requirements:'requirement',projects:'project',planItems:'stage_plan',tasks:'task',bugs:'bug',orders:'work_order'};
const key = row => `${row.business_type}:${row.id}`;
function resolvePersonalPeriod(range = {}, now = new Date()) {
    try {
        if (Boolean(range.startDate) !== Boolean(range.endDate)) throw new Error('请选择完整的开始和结束日期');
        if ([range.startDate,range.endDate].some(v=>v!==undefined && (typeof v!=='string'||!v))) throw new Error('时间区间不正确');
        const value=resolvePeriod(range.startDate ? {preset:'custom',start_date:range.startDate,end_date:range.endDate} : {preset:'month'},now);
        const today=shanghaiDate(now);
        if(value.start_date>today)throw new Error('不能查询完全在未来的统计区间');
        return {startDate:value.start_date,endDate:value.end_date,observationDate:value.end_date<today?value.end_date:today,today};
    } catch(error) { throw Object.assign(new Error(error.message),{status:400}); }
}
function completionDateFor(record, detail, history, period, statusCode) {
    if(detail.included===false||detail.completed!==true)return '';
    if(record.business_type==='requirement') {
        const type=fieldAt(record,'requirement_type',period.observationDate,history,period.today);
        if(type!==4||statusCode===36) {
            const conclusions=statusCode===36?[36]:({1:[2,3],2:[12,13],3:[21,22]})[type]||[];
            return [...(history?.transitions||[])].filter(event=>conclusions.includes(event.status)&&event.date<=period.observationDate).map(event=>event.date).sort().at(-1)||'';
        }
    }
    const actual=dateOnly(record.actual_date);
    if(actual&&actual<=period.observationDate)return actual;
    return detail.evidence.filter(proof=>Number(proof.record_id)===Number(record.id)&&proof.business_type===record.business_type&&!['current_status','history_previous_status','later_completion_date','children_aggregate','stage_items_aggregate'].includes(proof.source)&&proof.date<=period.observationDate).map(proof=>proof.date).sort().at(-1)||'';
}
function buildPersonalPeriodSnapshot(snapshot, source, period) {
    const personId=Number(snapshot.person.id);
    const visible=new Map(snapshot.records.map(row=>[`${typeByKind[row.kind]}:${row.id}`,row]));
    // Dependency rows stay available to judge parents/children, but never become the person's work.
    const records=source.records.map(row=>{
        const own=visible.get(key(row));
        return own?.relationship==='responsible' ? row : {...row,owner_id:Number(row.owner_id)===personId?null:row.owner_id,owner_ids:(row.owner_ids||[]).filter(id=>Number(id)!==personId)};
    });
    const types=[...new Set(snapshot.groups.filter(g=>g.available).map(g=>typeByKind[g.kind]))];
    const options={logs:source.logs,people:[{id:personId,name:snapshot.person.name}],types,period:{start_date:period.startDate,end_date:period.endDate},today:period.today,cutoff:period.observationDate};
    const own=evaluateCompletion({...options,records});
    const joined=evaluateCompletion({...options,records:records.map(row=>{
        const item=visible.get(key(row));
        return item && item.relationship!=='responsible' ? {...row,owner_id:personId,owner_ids:[personId]} : row;
    })});
    const joinedMap=new Map(joined.details.map(d=>[`${d.business_type}:${d.record_id}`,d]));
    const ownMap=new Map(own.details.map(d=>[`${d.business_type}:${d.record_id}`,d]));
    const sourceMap=new Map(records.map(row=>[key(row),row]));
    const histories=buildHistories(records,source.logs);
    const scoped=[],excluded=[];
    for(const row of snapshot.records) {
        const recordKey=`${typeByKind[row.kind]}:${row.id}`;
        const record=sourceMap.get(recordKey);
        const detail=(row.relationship==='responsible'?ownMap:joinedMap).get(recordKey);
        if(!record||!detail||detail.reason_code==='not_created')continue;
        const hadActivity=snapshot.events.some(e=>e.kind===row.kind&&e.recordId===row.id)||Boolean(row.progressNote);
        const out=['outside_period','completed_before_period','bug_outside_period'].includes(detail.reason_code);
        if(out&&!hadActivity)continue;
        const state=statusAt(record,period.observationDate,histories.get(recordKey),period.today);
        const statusCode=state.status;
        const inferred=state.evidence.some(e=>e.source==='later_completion_date');
        const statisticStatus=detail.included===false?'excluded':detail.included===null||detail.completed===null?'unknown':detail.completed?'completed':'unfinished';
        const completionDate=completionDateFor(record,detail,histories.get(recordKey),period,statusCode);
        const isOpen=detail.included===true && detail.completed===false;
        const paused=({requirements:[3,13,22,35],projects:[3],tasks:[3],planItems:[3],orders:[4],bugs:[]})[row.kind].includes(statusCode);
        const parentProjectId=record.business_type==='stage_plan'?fieldAt(record,'project_id',period.observationDate,histories.get(recordKey),period.today):null;
        const parentProject=sourceMap.get(`project:${parentProjectId}`);
        const parentStatus=parentProject?statusAt(parentProject,period.observationDate,histories.get(key(parentProject)),period.today).status:undefined;
        const policy=POLICIES[record.business_type];
        const isOverdue=Boolean(isOpen&&policy&&calculateOverdue(record.business_type,{date:row.dueDate,status:statusCode,completion:detail.completed,parentStatus},period.observationDate).isOverdue===1);
        const canSchedule=isOpen&&policy&&!policy.excluded.includes(statusCode)&&!(record.business_type==='stage_plan'&&parentStatus===3);
        const item={...row,statusCode:inferred?null:statusCode,status:statusCode===null?'待核实':inferred?'期末未完成':labels[row.kind]?.[statusCode]||'待核实',
            included:detail.included,completed:detail.completed,statisticStatus,statisticReason:detail.reason,
            periodBasis:detail.period_basis||'',completionDate,isOpen,isOverdue,
            needsAttention:isOpen&&period.observationDate===period.today&&row.needsAttention,dueSoon:Boolean(canSchedule&&row.dueDate>=period.observationDate&&row.dueDate<=period.endDate),
            workState:isOpen?paused?'waiting':'active':'ended',nextAction:'',parentClosed:detail.reason_code==='ancestor_closed',
            periodRelevant:detail.included!==false,hasPeriodActivity:hadActivity};
        if(row.relationship==='responsible'&&detail.included===false)excluded.push(item);
        if(detail.included!==false||hadActivity)scoped.push(item);
    }
    const order=(a,b)=>Number(b.isOverdue)-Number(a.isOverdue)||Number(b.needsAttention)-Number(a.needsAttention)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999');
    const responsible=scoped.filter(row=>row.relationship==='responsible'&&row.included!==false);
    const groups=snapshot.groups.map(group=>{
        const result=own.results.find(item=>item.business_type===typeByKind[group.kind]);
        const ownRows=responsible.filter(row=>row.kind===group.kind);
        const joinedRows=scoped.filter(row=>row.kind===group.kind&&row.relationship!=='responsible'&&row.included!==false);
        const completion={included:result?.statistic_count??null,completed:result?.completed_count??null,
            knownIncluded:result?.known_statistic_count||0,knownCompleted:result?.known_completed_count||0,
            unfinished:ownRows.filter(row=>row.included===true&&row.completed===false).length,unknown:result?.unknown_count||0,
            rate:result?.completion_rate??null,carried:ownRows.filter(row=>row.periodBasis==='carried_over').length,
            participating:joinedRows.filter(row=>row.relationship==='participant').length,collaborating:joinedRows.filter(row=>row.relationship==='collaborator').length,
            excluded:excluded.filter(row=>row.kind===group.kind).length};
        return {...group,completion,metrics:[{label:'本期纳入',value:group.available&&completion.included!==null?String(completion.included):'—',unit:'项'},{label:'已完成',value:group.available&&completion.completed!==null?String(completion.completed):'—',unit:'项'}],
            note:`未完成 ${completion.unfinished} 项${completion.carried?` · 含期初遗留 ${completion.carried} 项`:''}`,
            rows:[{label:'本期纳入',value:completion.included===null?'待核实':`${completion.included} 项`},{label:'已完成',value:completion.completed===null?'待核实':`${completion.completed} 项`},{label:'未完成',value:`${completion.unfinished} 项`}],
            explanation:'按当前责任人、最新计划日期归期，带入期初逾期未完成；历史状态截至期末。主子任务按个人去重，参与与协作不计完成率。证据不足标记待核实。'};
    });
    const ownRowsForNode=kind=>responsible.filter(row=>row.kind===kind);
    const nodes=snapshot.nodes.map(node=>{
        if(node.key==='person')return {...node,note:`${period.startDate} 至 ${period.endDate} · 截至 ${period.observationDate}`};
        const group=groups.find(g=>g.key===node.key), c=group.completion;
        const urgent=responsible.filter(r=>r.kind===group.kind&&r.needsAttention).length;
        return {...node,value:group.available&&c.included!==null?String(c.included):'—',unit:'项纳入',periodStats:group.available?{unfinished:c.unfinished,overdue:ownRowsForNode(group.kind).filter(r=>r.isOverdue).length,unknown:c.unknown}:undefined,note:`已完成 ${c.completed??'—'}${c.participating?` · 参与 ${c.participating}`:''}${c.collaborating?` · 协作 ${c.collaborating}`:''}`,
            priorityAlerts:urgent?[{level:'high',label:group.kind==='bugs'?'高危':group.kind==='orders'?'紧急':'高优',count:urgent,detail:''}]:[]};
    });
    const priorities=responsible.filter(r=>r.isOpen&&(r.isOverdue||r.needsAttention||r.dueSoon)).sort(order);
    const output={...snapshot,period,records:scoped,excludedRecords:excluded,groups,nodes,priorities,
        workBoard:{current:responsible.filter(r=>r.isOpen).sort(order),next:responsible.filter(r=>r.isOpen).sort(order)},
        overview:{responsible:responsible.length,participating:scoped.filter(r=>r.relationship!=='responsible'&&r.included!==false).length,
            open:responsible.filter(r=>r.isOpen).length,urgent:responsible.filter(r=>r.needsAttention).length,overdue:responsible.filter(r=>r.isOverdue).length,dueSoon:responsible.filter(r=>r.dueSoon).length,products:new Set(scoped.map(r=>r.productId).filter(Boolean)).size},
        attention:scoped.filter(r=>r.hasPeriodActivity)};
    output.summaryRevision=createHash('sha256').update(JSON.stringify(['personal-period-v14-history-evidence',period,output.person,scoped,excluded,snapshot.events])).digest('hex');
    return output;
}
module.exports={resolvePersonalPeriod,buildPersonalPeriodSnapshot,typeByKind};

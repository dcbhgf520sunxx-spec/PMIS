const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePersonalPeriod, buildPersonalPeriodSnapshot } = require('../src/services/digitalTwinPersonalPeriod');
const { buildPersonalSnapshot } = require('../src/services/digitalTwinPersonalService');
const paths = new Set(['/products','/tasks','/projects']);
const now = new Date('2026-10-22T02:00:00Z');
const period = resolvePersonalPeriod({ startDate:'2026-10-01', endDate:'2026-10-31' }, now);
const task = (id, extra={}) => ({ business_type:'task', id, name:`工作${id}`, status:1, owner_id:7, owner_ids:[7], plan_date:'2026-10-20', created_date:'2026-09-01', created_at:'2026-09-01', ...extra });
function build(records, logs=[]) {
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'}, {tasks:records.map(r=>({...r,expected_end_date:r.plan_date,actual_end_date:r.actual_date,relationship:'responsible'}))},paths,'2026-10-22 10:00:00');
 return buildPersonalPeriodSnapshot(raw,{records,logs},period);
}
test('区间默认上海自然月，严格校验双日期、顺序及未来区间',()=>{
 assert.equal(resolvePersonalPeriod({},now).startDate,'2026-10-01');
 assert.equal(period.observationDate,'2026-10-22');
 for(const input of [{startDate:'2026-10-01'},{startDate:'2026-02-30',endDate:'2026-03-01'},{startDate:'2026-11-01',endDate:'2026-11-30'},{startDate:'2026-10-05',endDate:'2026-10-01'}])assert.throws(()=>resolvePersonalPeriod(input,now));
});
test('完成率与明细同源：子任务去重、关闭排除、已知完成和期初遗留',()=>{
 const result=build([task(1,{status:2,actual_date:'2026-10-10'}),task(2),task(3,{status:4,close_date:'2026-10-11'}),task(4),task(5,{parent_task_id:4})]);
 const group=result.groups.find(g=>g.kind==='tasks');
 assert.equal(group.completion.included,3);
 assert.equal(group.completion.completed,1);
 assert.equal(group.completion.rate,33.33);
 assert.equal(result.records.filter(r=>r.included===true).length,3);
 assert.ok(result.excludedRecords.some(r=>r.id==='4'&&r.statisticReason.includes('子任务')));
 assert.equal(result.records.find(r=>r.id==='1').completionDate,'2026-10-10');
});
test('历史期末无证据不冒充当前状态，不倒算后来完成，不进入可执行重点',()=>{
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{tasks:[{id:1,name:'任务',status:2,expected_end_date:'2026-09-20',actual_end_date:'2026-10-05',created_at:'2026-09-01',relationship:'responsible'}]},paths,'2026-10-22 10:00:00');
 const historical=buildPersonalPeriodSnapshot(raw,{records:[task(1,{status:2,plan_date:'2026-09-20',actual_date:'2026-10-05'})],logs:[]},resolvePersonalPeriod({startDate:'2026-09-01',endDate:'2026-09-30'},now));
 assert.equal(historical.groups.find(g=>g.kind==='tasks').completion.completed,0);
 assert.equal(historical.records[0].completionDate,'');
 assert.equal(historical.records[0].status,'期末未完成');
 const unknown=buildPersonalPeriodSnapshot(raw,{records:[task(1,{status:1,plan_date:'2026-09-20'})],logs:[]},resolvePersonalPeriod({startDate:'2026-09-01',endDate:'2026-09-30'},now));
 assert.equal(unknown.groups.find(g=>g.kind==='tasks').completion.rate,null);
 assert.equal(unknown.records[0].status,'待核实');
});
test('参与和协作使用相同区间但不计个人完成率，权限外记录不能进入统计',()=>{
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{projects:[{id:20,name:'参与项目',owner_id:9,status:1,expected_end_date:'2026-10-25',created_at:'2026-09-01',relationship:'participant'}]},paths,'2026-10-22 10:00:00');
 const result=buildPersonalPeriodSnapshot(raw,{records:[{...task(20),business_type:'project',owner_id:9,owner_ids:[9],plan_date:'2026-10-25'},task(99)],logs:[]},period);
 const group=result.groups.find(g=>g.kind==='projects');
 assert.equal(group.completion.included,0);
 assert.equal(group.completion.participating,1);
 assert.equal(result.records.length,1);
 assert.equal(result.groups.find(g=>g.kind==='tasks').completion.included,0);
});
test('周期简报输入覆盖全部事项与正文，不固定前五项，缓存包含区间',()=>{
 const { buildPersonalSummaryEvidence }=require('../src/services/digitalTwinAiSummary');
 const snapshot=build(Array.from({length:12},(_,i)=>task(i+1)));
 snapshot.records.forEach((r,i)=>{r.description='正文'.repeat(400);r.progressNote=`本期跟进${i}`;});
 const evidence=buildPersonalSummaryEvidence(snapshot);
 assert.equal(evidence.work.length,12);
 assert.equal(evidence.work[0].content.length,800);
 assert.equal(evidence.period.startDate,'2026-10-01');
});
test('分批简报覆盖所有来源，缺漏或无证据成果必须拒绝',async()=>{
 const {summaryBatches,parseSummary,completePersonalPeriodSummary}=require('../src/services/personalPeriodSummary');
 const work=Array.from({length:12},(_,i)=>({sourceId:`tasks:${i}`,content:'正文'.repeat(1000),reportedProgress:'已完成接口验证',actions:[],hasProgressEvidence:true,isPeriodUnfinished:false}));
 assert.equal(new Set(summaryBatches(work).flat().map(r=>r.sourceId)).size,12);
 assert.throws(()=>parseSummary(JSON.stringify({processedIds:[],progress:[],priorities:[],concerns:[]}),work));
 assert.throws(()=>parseSummary(JSON.stringify({processedIds:['tasks:0'],progress:[{sourceIds:['tasks:0'],text:'已完成'}],priorities:[],concerns:[]}),[{...work[0],hasProgressEvidence:false}]));
 const submitted=[];let merged=0;
 const result=await completePersonalPeriodSummary({person:'测试',period,work},{apiKey:'test-only',model:'test',baseUrl:'https://example.com',fetchImpl:async(_url,init)=>{
    const payload=JSON.parse(JSON.parse(init.body).messages[1].content);if(payload.draft)merged++;const batch=payload.work;submitted.push(...batch.map(r=>r.sourceId));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({processedIds:[...new Set(batch.map(r=>r.sourceId))],progress:payload.draft?[{sourceIds:batch.map(r=>r.sourceId),text:'接口验证工作已完成。'}]:batch.map(r=>({sourceIds:[r.sourceId],text:`已验证${r.sourceId}`})),priorities:[],concerns:[],...(payload.draft?{attention:[]}:{} )})}}]})};
 }});
 assert.equal(new Set(submitted.filter(id=>id.startsWith('tasks:'))).size,12);assert.equal(result.sections.progress.length,1);assert.equal(merged,1);assert.equal(new Set(result.sections.progress.flatMap(item=>item.sourceIds)).size,12);assert.ok(result.sections.progress.every(item=>item.sourceIds.every(id=>id.startsWith('tasks:'))));
});
test('周期预警沿用各模块逾期规则：直接实施需求暂停仍判断逾期，任务暂停不算逾期',()=>{
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{requirements:[{id:1,title:'实施需求',requirement_type:4,status:35,expected_end_date:'2026-10-10',owner_id:7,created_at:'2026-10-01',relationship:'responsible'}],tasks:[{id:2,name:'暂停任务',status:3,expected_end_date:'2026-10-10',created_at:'2026-10-01',relationship:'responsible'}]},new Set(['/requirements','/tasks']),'2026-10-22 10:00:00');
 const result=buildPersonalPeriodSnapshot(raw,{records:[{...task(1,{status:35}),business_type:'requirement',requirement_type:4,plan_date:'2026-10-10'},task(2,{status:3,plan_date:'2026-10-10'})],logs:[]},period);
 assert.equal(result.records.find(r=>r.kind==='requirements').isOverdue,true);
 assert.equal(result.records.find(r=>r.kind==='tasks').isOverdue,false);
});
test('前三类需求的完成依据日期是有效结论日期，不冒用后续实施完成日期',()=>{
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{requirements:[{id:1,title:'立项需求',requirement_type:1,status:32,expected_end_date:'2026-10-20',actual_end_date:'2026-10-20',owner_id:7,created_at:'2026-09-01',relationship:'responsible'}]},new Set(['/requirements']),'2026-10-22 10:00:00');
 const records=[{...task(1),business_type:'requirement',requirement_type:1,status:32,actual_date:'2026-10-20'}];
 const logs=[{business_type:'requirement',target_id:1,field_name:'status',old_value:'1',new_value:'2',created_at:'2026-09-15T10:00:00+08:00',log_id:1,operation_id:'decision'},{business_type:'requirement',target_id:1,field_name:'status',old_value:'2',new_value:'32',created_at:'2026-09-20T10:00:00+08:00',log_id:2,operation_id:'implementation'}];
 const result=buildPersonalPeriodSnapshot(raw,{records,logs},period);
 assert.equal(result.records[0].completed,true);
 assert.equal(result.records[0].completionDate,'2026-09-15');
 assert.equal(require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(result).work[0].hasProgressEvidence,false);
});
test('简报先按证据资格分批，未知归期不与已确认未完成混送',()=>{
 const {summaryBatches}=require('../src/services/personalPeriodSummary');
 const sample=[{sourceId:'tasks:1',content:'接口联调',hasProgressEvidence:false,isPeriodUnfinished:true,statisticStatus:'unfinished'},{sourceId:'tasks:2',content:'归期不明',hasProgressEvidence:false,isPeriodUnfinished:false,statisticStatus:'unknown'},{sourceId:'tasks:3',content:'已有实质进展',hasProgressEvidence:true,isPeriodUnfinished:true,statisticStatus:'unfinished'},{sourceId:'tasks:4',content:'无期间成果',hasProgressEvidence:false,isPeriodUnfinished:false,statisticStatus:'excluded'}];
 const batches=summaryBatches(sample);
 assert.equal(batches.length,4);
 assert.equal(new Set(batches.flat().map(r=>r.sourceId)).size,4);
 for(const batch of batches)assert.equal(new Set(batch.map(r=>`${r.hasProgressEvidence}:${r.isPeriodUnfinished}:${r.statisticStatus==='unknown'}`)).size,1);
});
test('简报最终按主题总结为两块，审阅与引用覆盖不要求逐张列举',async()=>{
 const {completePersonalPeriodSummary}=require('../src/services/personalPeriodSummary');
 let editorial=false;
 const work=[{sourceId:'tasks:1',kind:'任务',content:'权限联调已完成',hasProgressEvidence:true,isPeriodUnfinished:false},{sourceId:'bugs:2',kind:'缺陷',content:'权限复验被阻塞',hasProgressEvidence:false,isPeriodUnfinished:true},{sourceId:'tasks:3',kind:'任务',content:'常规材料归档，明细保留',hasProgressEvidence:false,isPeriodUnfinished:true}];
 const result=await completePersonalPeriodSummary({person:'本人',period,work},{apiKey:'fixture',baseUrl:'https://example.com',model:'test',fetchImpl:async(_url,init)=>{
   const request=JSON.parse(init.body),payload=JSON.parse(request.messages[1].content),rows=payload.work;
   const sections={processedIds:rows.map(r=>r.sourceId),progress:[],priorities:[],concerns:[]};
   if(payload.draft){
     editorial=payload.outputMode==='brief'&&request.messages[0].content.includes('每块先按产品、再按项目／业务主题分组');
     const done=rows.filter(r=>r.hasProgressEvidence),next=rows.filter(r=>!r.hasProgressEvidence).slice(0,1);
     sections.progress=done.length?[{sourceIds:done.map(r=>r.sourceId),text:'权限治理已完成联调验证。'}]:[];
     sections.concerns=next.length?[{sourceIds:next.map(r=>r.sourceId),text:'下一步优先解决权限复验阻塞。'}]:[];
   }else for(const r of rows)sections[r.hasProgressEvidence?'progress':'priorities'].push({sourceIds:[r.sourceId],text:r.sourceId});
   return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(payload.draft?{processedIds:sections.processedIds,progress:sections.progress,attention:sections.concerns}:sections)}}]})};
 }});
 assert.equal(editorial,true);
 assert.equal(result.sections.priorities.length,0);
 assert.equal(result.sections.concerns.length,1);
 assert.ok(result.text.includes('下阶段需关注'));
 assert.equal(new Set(Object.values(result.sections).flat().flatMap(r=>r.sourceIds)).size,2);
 assert.equal(result.coveredCount,3);
});
test('最终汇总每块直接返回一段文字，空段不补造事项',()=>{
 const {parseSummary}=require('../src/services/personalPeriodSummary');
 const result=parseSummary(JSON.stringify({processedIds:['fact-1'],progress:{sourceIds:['fact-1'],text:'完成交付验证与运行问题治理。'},attention:null}),[{sourceId:'fact-1',hasProgressEvidence:true}],true);
 assert.equal(result.progress.length,1);
 assert.deepEqual(result.concerns,[]);
});

 test('简报引用以真实产品和项目分组，拒绝跨产品及同名不同项目合并',()=>{
 const {parseSummary}=require('../src/services/personalPeriodSummary');
 const work=[{sourceId:'a',productId:'1',productName:'产品甲',projectId:'11',projectName:'门户一期',hasProgressEvidence:true},{sourceId:'b',productId:'2',productName:'产品乙',projectId:'21',projectName:'门户一期',hasProgressEvidence:true},{sourceId:'c',productId:'1',productName:'产品甲',projectId:'12',projectName:'门户一期',hasProgressEvidence:true}];
 const output=sourceIds=>JSON.stringify({processedIds:['a','b','c'],progress:[{sourceIds,text:'完成联调',productName:'伪造产品',topic:'伪造项目'}],attention:[]});
 assert.throws(()=>parseSummary(output(['a','b']),work,true),/不同产品或项目/);
 assert.throws(()=>parseSummary(output(['a','c']),work,true),/不同产品或项目/);
 const item=parseSummary(output(['a']),work,true).progress[0];
 assert.equal(item.productName,'产品甲');assert.equal(item.topic,'门户一期');assert.equal(item.projectId,'11');
 });
test('多产品简报分批隔离真实归属，再逐产品汇总，不限制产品或项目数量',async()=>{
 const {completePersonalPeriodSummary}=require('../src/services/personalPeriodSummary');
 const work=Array.from({length:8},(_,i)=>({sourceId:`tasks:${i}`,productId:String(i),productName:`产品${i}`,projectId:`p${i}`,projectName:'同名项目',hasProgressEvidence:true,isPeriodUnfinished:false,content:'完成权限验证'}));
 let merges=0;
 const result=await completePersonalPeriodSummary({person:'本人',period,work},{apiKey:'fixture',baseUrl:'https://example.com',model:'test',fetchImpl:async(_url,init)=>{
   const payload=JSON.parse(JSON.parse(init.body).messages[1].content),rows=payload.work;
   assert.equal(new Set(rows.map(r=>r.productId)).size,1);
   if(payload.draft)merges++;else assert.equal(new Set(rows.map(r=>r.projectId)).size,1);
   const progress=[{sourceIds:rows.map(r=>r.sourceId),text:'完成权限验证。'}];
   return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({processedIds:rows.map(r=>r.sourceId),progress,...(payload.draft?{attention:[]}:{priorities:[],concerns:[]})})}}]})};
 }});
 assert.equal(merges,8);assert.equal(result.sections.progress.length,8);
 assert.equal(new Set(result.sections.progress.map(r=>r.productId)).size,8);
 assert.ok(result.sections.progress.every(r=>r.topic==='同名项目'&&r.sourceIds.length===1&&r.sourceIds[0].startsWith('tasks:')));
});

test('历史关键事项逾期使用观察日项目状态，不受后来暂停或恢复影响',()=>{
 const historical=resolvePersonalPeriod({startDate:'2026-09-01',endDate:'2026-09-30'},now);
 for(const currentlyPaused of [true,false]) {
  const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{planItems:[{id:1,name:'验收联调',project_id:10,project_name:'项目',owner_id:7,status:1,current_due_date:'2026-09-20',created_at:'2026-09-01',relationship:'responsible'}]},new Set(['/projects']),'2026-10-22 10:00:00');
  const records=[{business_type:'stage_plan',id:1,name:'验收联调',status:1,owner_id:7,plan_date:'2026-09-20',created_date:'2026-09-01',project_id:10,parent_project_paused:currentlyPaused},{business_type:'project',id:10,status:currentlyPaused?3:1,created_date:'2026-09-01',pause_date:currentlyPaused?'2026-10-10':null}];
  const change=(type,id,from,to,date,logId)=>({business_type:type,target_id:id,field_name:'status',old_value:String(from),new_value:String(to),created_at:date,log_id:logId,operation_id:`change-${logId}`});
  const logs=[change('project',10,0,1,'2026-09-01',1),change('stage_plan',1,0,1,'2026-09-05',2)];
  if(currentlyPaused)logs.push(change('project',10,1,3,'2026-10-10',3));
  else logs.push(change('project',10,1,3,'2026-09-10',3),change('project',10,3,1,'2026-10-10',4));
  const result=buildPersonalPeriodSnapshot(raw,{records,logs},historical);
  assert.equal(result.records[0].included,true);
  assert.equal(result.records[0].isOverdue,currentlyPaused);
  assert.equal(result.nodes.find(n=>n.kind==='planItems').periodStats.overdue,currentlyPaused?1:0);
 }
});

test('需求后来转项目不抹掉前期有效结论日期和简报进展证据',()=>{
 const historical=resolvePersonalPeriod({startDate:'2026-09-01',endDate:'2026-09-30'},now);
 const raw=buildPersonalSnapshot({id:7,real_name:'本人'},{requirements:[{id:1,title:'立项评估',requirement_type:1,status:36,expected_end_date:'2026-09-20',owner_id:7,created_at:'2026-09-01',relationship:'responsible'}]},new Set(['/requirements']),'2026-10-22 10:00:00');
 const records=[{business_type:'requirement',id:1,requirement_type:1,status:36,owner_id:7,plan_date:'2026-09-20',created_date:'2026-09-01'}];
 const logs=[{business_type:'requirement',target_id:1,field_name:'status',old_value:'1',new_value:'2',created_at:'2026-09-15',log_id:1},{business_type:'requirement',target_id:1,field_name:'status',old_value:'2',new_value:'36',created_at:'2026-10-10',log_id:2}];
 const result=buildPersonalPeriodSnapshot(raw,{records,logs},historical);
 assert.equal(result.records[0].statusCode,2);
 assert.equal(result.records[0].completed,true);
 assert.equal(result.records[0].completionDate,'2026-09-15');
 assert.equal(require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(result).work[0].hasProgressEvidence,true);
});

test('待核实事项即使有本人跟进也不能进入已确认进展，仍保留风险说明资格',()=>{
 const {parseSummary}=require('../src/services/personalPeriodSummary');
 const work=[{sourceId:'tasks:1',hasProgressEvidence:true,isPeriodUnfinished:false,statisticStatus:'unknown'}];
 const output={processedIds:['tasks:1'],progress:[{sourceIds:['tasks:1'],text:'已完成交付'}],priorities:[],concerns:[]};
 assert.throws(()=>parseSummary(JSON.stringify(output),work),/本期进展引用/);
 assert.equal(parseSummary(JSON.stringify({...output,progress:[],concerns:[{sourceIds:['tasks:1'],text:'期间状态证据待核实'}]}),work).concerns.length,1);
 const result=build([task(1)]);result.records[0].statisticStatus='unknown';result.records[0].progressNote='本人记录已完成交付';
 assert.equal(require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(result).work[0].hasProgressEvidence,false);
});

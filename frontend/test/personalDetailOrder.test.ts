import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPersonalPeriodDetails, personalDetailKind, personalDetailCreatedDate } from '../src/modules/digital-twin/components/personalDetailOrder.ts';
import type { PersonalTwinRecord } from '../src/modules/digital-twin/types';
const row=(id:string,extra:Partial<PersonalTwinRecord>={})=>({id,kind:'requirements',productId:'1',productName:'产品甲',chain:[],dueDate:'2026-10-10',createdAt:'2026-10-01',completionDate:'',statisticStatus:'unfinished',isOverdue:false,needsAttention:false,...extra} as PersonalTwinRecord);
const parent=(id:string,name:string,kind='projects')=>({id,name,kind});

test('缺省、旧全部类别和非法类别默认需求，合法类别保留',()=>{
 const groups=[{kind:'projects',available:true},{kind:'requirements',available:true}];
 for(const value of [null,'all','invalid'])assert.equal(personalDetailKind(value,groups),'requirements');
 assert.equal(personalDetailKind('projects',groups),'projects');
});
test('类别只选择有权限的选项，需求无权限时使用首个可用类别',()=>{
 const groups=[{kind:'requirements',available:false},{kind:'projects',available:true}];
 assert.equal(personalDetailKind('requirements',groups),'projects');
 assert.equal(personalDetailKind(null,groups),'projects');
});
test('需求和项目未完成按计划日期倒序，遗留直接参与，排序不修改原数组',()=>{
 const input=[row('1',{dueDate:'2026-10-20'}),row('2',{dueDate:'2026-07-15',isOverdue:true}),row('3'),row('4',{dueDate:'2026-10-12'}),row('5',{dueDate:'2026-07-01',needsAttention:true})];
 for(const kind of ['requirements','projects'])assert.deepEqual(sortPersonalPeriodDetails(input.map(r=>({...r,kind})),'unfinished').map(r=>r.id),['1','4','3','2','5']);
 assert.deepEqual(input.map(r=>r.id),['1','2','3','4','5']);
});
test('无计划置后且按新增倒序，待核实与排除不影响日期顺序',()=>{
 const result=sortPersonalPeriodDetails([row('1',{dueDate:'',createdAt:'2026-10-08'}),row('2',{dueDate:'',createdAt:'2026-10-02'}),row('3',{statisticStatus:'unknown'}),row('4',{statisticStatus:'excluded'}),row('5',{dueDate:'2026-01-01'})],'all');
 assert.deepEqual(result.map(r=>r.id),['4','3','5','1','2']);
});
test('全部按计划倒序，完成情况及完成日期不改变计划顺序',()=>{
 const result=sortPersonalPeriodDetails([row('1',{statisticStatus:'completed',completionDate:'2026-10-10'}),row('2',{statisticStatus:'completed',completionDate:'2026-10-21'}),row('3',{dueDate:'2026-10-22'}),row('4',{dueDate:'2026-07-10'}),row('5',{statisticStatus:'unknown'}),row('6',{statisticStatus:'excluded'}),row('7',{dueDate:''}),row('8',{statisticStatus:'completed',completionDate:''})],'all');
 assert.deepEqual(result.map(r=>r.id),['3','8','6','5','2','1','4','7']);
});
test('任务和缺陷先按业务归属，归属内完成情况不插队，只按计划或新增倒序',()=>{
 for(const kind of ['tasks','bugs']) {
  const input=[row('1',{kind,chain:[parent('2','业务B')],dueDate:'2026-10-30',createdAt:'2026-10-30'}),
   row('2',{kind,chain:[parent('1','业务A')],dueDate:'2026-10-20',createdAt:'2026-10-20'}),
   row('3',{kind,chain:[parent('1','业务A')],statisticStatus:'completed',dueDate:'2026-10-22',createdAt:'2026-10-22',completionDate:'2026-10-01'}),
   row('4',{kind,chain:[parent('1','业务A')],dueDate:'2026-10-25',createdAt:'2026-10-25'}),
   row('5',{kind,chain:[parent('1','业务A')],statisticStatus:'completed',dueDate:'2026-10-21',createdAt:'2026-10-21',completionDate:'2026-10-31'})];
  assert.deepEqual(sortPersonalPeriodDetails(input,'all').map(r=>r.id),['4','3','5','2','1']);
 }
});
test('同名不同类型或编号的归属不混排，日常任务保持独立，未授权归属不靠名称猜测',()=>{
 const input=[row('1',{kind:'tasks',chain:[parent('2','同名')],dueDate:'2026-10-20'}),
  row('2',{kind:'tasks',chain:[parent('1','同名')],dueDate:'2026-10-21'}),
  row('3',{kind:'tasks',chain:[parent('2','同名')],dueDate:'2026-10-22'}),
  row('4',{kind:'tasks',chain:[parent('1','同名','requirements')],dueDate:'2026-10-23'}),
  row('5',{kind:'tasks',productId:'',productName:'—',parentName:'未授权项目X',dueDate:'2026-10-30'}),
  row('6',{kind:'tasks',productId:'',productName:'—',parentName:'日常任务',dueDate:'2026-10-29'})];
 const ids=sortPersonalPeriodDetails(input,'all').map(r=>r.id);
 assert.equal(ids.indexOf('1'),ids.indexOf('3')+1);
 assert.ok(ids.indexOf('2')<ids.indexOf('3'));
 assert.ok(ids.indexOf('4')>ids.indexOf('1'));
 assert.equal(ids.at(-1),'5');
 assert.ok(ids.includes('6'));
});
test('工单先按产品，产品内按计划倒序而非完成情况，同名产品用编号区分',()=>{
 const input=[row('1',{kind:'orders',productId:'2',productName:'产品B',dueDate:'2026-10-30'}),
  row('2',{kind:'orders',productId:'1',productName:'产品A',dueDate:'2026-10-20'}),
  row('3',{kind:'orders',productId:'1',productName:'产品A',statisticStatus:'completed',dueDate:'2026-10-22',completionDate:'2026-10-10'}),
  row('4',{kind:'orders',productId:'1',productName:'产品A',dueDate:'2026-10-25'}),
  row('5',{kind:'orders',productId:'3',productName:'产品A',dueDate:'2026-10-30'}),
  row('6',{kind:'orders',productId:'',productName:'—',dueDate:'2026-11-01'})];
 assert.deepEqual(sortPersonalPeriodDetails(input,'all').map(r=>r.id),['4','3','2','5','1','6']);
});
test('关键事项保持项目计划原始顺序，各视图不被日期、状态或优先级重新排序',()=>{
 const input=[row('10',{kind:'planItems',statisticStatus:'completed',completionDate:'2026-09-01'}),
  row('2',{kind:'planItems',dueDate:'2026-11-01',needsAttention:true}),row('8',{kind:'planItems',dueDate:'2026-07-01'}),
  row('1',{kind:'planItems',statisticStatus:'completed',completionDate:'2026-10-22'})];
 assert.deepEqual(sortPersonalPeriodDetails(input,'all').map(r=>r.id),['10','2','8','1']);
 assert.deepEqual(sortPersonalPeriodDetails(input.filter(r=>r.statisticStatus==='completed'),'completed').map(r=>r.id),['10','1']);
 assert.deepEqual(sortPersonalPeriodDetails(input.filter(r=>r.statisticStatus==='unfinished'),'unfinished').map(r=>r.id),['2','8']);
});
test('其余五类完成日期倒序，缺日期置后，同日按新增时间及编号倒序保持稳定',()=>{
 for(const kind of ['requirements','projects','tasks','bugs','orders']) {
  const input=[row('10',{kind,statisticStatus:'completed',completionDate:'2026-10-10'}),row('2',{kind,statisticStatus:'completed',completionDate:'2026-10-21'}),row('3',{kind,statisticStatus:'completed',completionDate:''}),row('4',{kind,statisticStatus:'completed',completionDate:'2026-10-10'})];
  assert.deepEqual(sortPersonalPeriodDetails(input,'completed').map(r=>r.id),['2','10','4','3']);
 }
});
test('混合完成情况时所有比较使用同一计划字段，输入顺序不同仍得到一致结果',()=>{
 const records=[row('1',{statisticStatus:'completed',dueDate:'2026-10-20',completionDate:'2026-10-05'}),row('2',{dueDate:'2026-10-15'}),row('3',{statisticStatus:'completed',dueDate:'2026-10-10',completionDate:'2026-10-30'})];
 for(const ids of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])assert.deepEqual(sortPersonalPeriodDetails(ids.map(i=>records[i]),'all').map(r=>r.id),['1','2','3']);
});
test('新增日期统一上海时区，非法日期显示横线',()=>{
 assert.equal(personalDetailCreatedDate(row('1',{createdAt:'2026-10-01T18:30:00Z'})),'2026-10-02');
 assert.equal(personalDetailCreatedDate(row('2',{createdAt:'invalid'})),'—');
});

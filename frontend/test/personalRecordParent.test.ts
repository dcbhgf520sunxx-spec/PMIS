import test from 'node:test';
import assert from 'node:assert/strict';
import { personalRecordParent } from '../src/modules/digital-twin/components/personalDetailOrder.ts';
import type { PersonalTwinRecord } from '../src/modules/digital-twin/types';
const row = (extra: Partial<PersonalTwinRecord>) => ({ kind:'tasks', id:'7', chain:[], productId:'', productName:'—', ...extra } as PersonalTwinRecord);

test('归属按授权关联链取直接父对象，排除自身；不同类型同编号仍是父对象',()=>{
 const product={kind:'products',id:'1',name:'产品甲'}, requirement={kind:'requirements',id:'7',name:'订阅需求'}, project={kind:'projects',id:'3',name:'门户一期'};
 assert.deepEqual(personalRecordParent(row({chain:[product,requirement,project,{kind:'tasks',id:'7',name:'任务'}]})),{kind:'projects',name:'门户一期',id:'3'});
 assert.deepEqual(personalRecordParent(row({chain:[product,requirement,{kind:'tasks',id:'7',name:'任务'}]})),{kind:'requirements',name:'订阅需求',id:'7'});
 assert.deepEqual(personalRecordParent(row({kind:'projects',id:'3',chain:[product,requirement,project]})),{kind:'requirements',name:'订阅需求',id:'7'});
 assert.deepEqual(personalRecordParent(row({kind:'orders',chain:[product,{kind:'orders',id:'7',name:'工单'}]})),{kind:'products',name:'产品甲',id:'1'});
});
test('日常任务及缺少授权归属不靠名称推断；仅可回退到已提供的产品',()=>{
 assert.deepEqual(personalRecordParent(row({parentName:'日常任务'})),{kind:'daily',name:'',id:''});
 assert.deepEqual(personalRecordParent(row({parentName:'日常任务',chain:[{kind:'requirements',id:'9',name:'日常任务'}]})),{kind:'requirements',name:'日常任务',id:'9'});
 assert.deepEqual(personalRecordParent(row({parentName:'像项目的名称'})),{kind:'',name:'未关联／未授权',id:''});
 assert.deepEqual(personalRecordParent(row({productId:'1',productName:'产品甲'})),{kind:'products',name:'产品甲',id:'1'});
});

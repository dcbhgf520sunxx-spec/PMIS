const test = require('node:test')
const assert = require('node:assert/strict')
const { parseInput,requestHash } = require('../src/services/openApiContract')
const base = {operation:'CREATE',sourceRecordId:'r1',operatorEmployeeNo:'001',idempotencyKey:'k1',data:{title:'测试',requirementType:4,productName:'产品',ownerEmployeeNo:'001',submitterName:'张三',submitDate:'2026-09-07'}}
test('开放接口完成情况最多200字符',() => {
  const input={...base,operation:'CHANGE_STATUS',data:{status:33,actualEndDate:'2026-07-12',completionStatus:'好'.repeat(200)}}
  assert.equal(parseInput('requirement',input).data.completionStatus.length,200)
  assert.throws(() => parseInput('requirement',{...input,data:{...input.data,completionStatus:'好'.repeat(201)}}))
})
test('开放接口暂停时要求暂停原因且最多200字符',() => {
  const requirement={...base,operation:'CHANGE_STATUS',data:{status:35,pauseDate:'2026-09-14',pauseReason:'等待资源'}}
  assert.equal(parseInput('requirement',requirement).data.pauseReason,'等待资源')
  assert.throws(() => parseInput('requirement',{...requirement,data:{status:35,pauseDate:'2026-09-14'}}))
  const workOrder={...base,operation:'CHANGE_STATUS',data:{status:4,suspendDate:'2026-09-14',suspendReason:'等待配件'}}
  assert.equal(parseInput('work_order',workOrder).data.suspendReason,'等待配件')
  assert.throws(() => parseInput('work_order',{...workOrder,data:{...workOrder.data,suspendReason:'原'.repeat(201)}}))
})
test('开放契约拒绝未知字段、伪造创建人、无效日期和标题换行',() => {
  assert.equal(parseInput('requirement',base).data.title,'测试')
  for (const extra of [{creatorId:1},{priority:2},{submitDate:'2026-02-30'},{title:'两行\n标题'}]) assert.throws(() => parseInput('requirement',{...base,data:{...base.data,...extra}}))
  assert.throws(() => parseInput('requirement',{...base,foo:1}))
})
test('部分更新只允许明确字段；必填不可清空，可选日期可以清空',() => {
  const update = {...base,operation:'UPDATE',data:{expectedEndDate:null}}
  assert.equal(parseInput('requirement',update).data.expectedEndDate,null)
  assert.throws(() => parseInput('requirement',{...update,data:{title:null}}))
  assert.throws(() => parseInput('requirement',{...update,data:{}}))
})
test('请求签名不受对象键顺序影响，覆盖员工、文件内容和动作',() => {
  assert.equal(requestHash('requirement',base),requestHash('requirement',{data:base.data,...base}))
  assert.notEqual(requestHash('requirement',base),requestHash('requirement',{...base,operatorEmployeeNo:'002'}))
  const file = {originalname:'a.txt',mimetype:'text/plain',buffer:Buffer.from('a')}
  assert.notEqual(requestHash('requirement',base,file),requestHash('requirement',base,{...file,buffer:Buffer.from('b')}))
})
test('未知业务类型和开放接口优先级动作被拒绝',() => {
  assert.throws(() => parseInput('product',base))
  for (const resource of ['requirement','work_order']) {
    assert.throws(() => parseInput(resource,{...base,operation:'CHANGE_PRIORITY',data:{priority:1}}))
  }
})
test('运维工单新增与页面一致：提出时间使用日期，紧急程度必填',() => {
  const input={operation:'CREATE',sourceRecordId:'wo1',operatorEmployeeNo:'001',idempotencyKey:'wo-k1',data:{
    problemDescription:'问题',productName:'产品',problemTypeCode:'PT001',followerEmployeeNo:'001',urgency:1,
    expectedResolveDate:'2026-09-08',submitterName:'张三',submitterDept:'信息部',submitTime:'2026-09-07'
  }}
  assert.equal(parseInput('work_order',input).data.submitTime,'2026-09-07')
  assert.throws(() => parseInput('work_order',{...input,data:{...input.data,submitTime:'2026-09-07T09:00:00+08:00'}}))
  const withoutUrgency={...input.data}
  delete withoutUrgency.urgency
  assert.throws(() => parseInput('work_order',{...input,data:withoutUrgency}))
})
test('富文本长度交由业务请求体上限控制，不额外虚构十万字符限制',() => {
  const description='说'.repeat(100001)
  assert.equal(parseInput('requirement',{...base,data:{...base.data,description}}).data.description.length,100001)
})

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildRequirementTitle,
  classifyItopsRecord,
  mapPriority,
  mergeSyncedSection,
  mapItopsRecord,
  resolveInitialSyncStart,
  resolveSyncWindow,
} = require('../src/services/itopsSyncRules')

test('i8 单据分类映射到需求或工单，并拒绝未知类别', () => {
  assert.deepEqual(classifyItopsRecord('需求问题'), { targetType: 'requirement', requirementType: 4 })
  assert.deepEqual(classifyItopsRecord('操作问题'), { targetType: 'work_order', problemTypeName: '日常操作' })
  assert.deepEqual(classifyItopsRecord('系统问题'), { targetType: 'work_order', problemTypeName: '系统优化' })
  assert.throws(() => classifyItopsRecord('咨询问题'), /不支持的问题类别/)
})

test('i8 单据字段映射使用来源提交人和提交组织并按业务类型生成精简描述', () => {
  const requirement = mapItopsRecord({
    单据编码: 'I8-001',
    单据日期: '2026-08-24 09:00:00',
    问题类别: '需求问题',
    模块: '财务',
    问题描述: '第一行\n第二行',
    解决方案: '已处理',
    处理人: '张三',
    负责人: '李四',
    预计解决时间: '2026-08-30 18:00:00',
    紧急程度: '重要',
    完成时间: '2026-08-25 10:00:00',
    更新时间: '2026-08-25 10:05:00',
    提交人: '徐波',
    提交组织: '建筑工程公司项目部',
  })
  assert.equal(requirement.targetType, 'requirement')
  assert.equal(requirement.title, '第一行 第二行')
  assert.equal(requirement.priority, 0)
  assert.equal(requirement.status, 33)
  assert.equal(requirement.submitterName, '徐波')
  assert.equal(requirement.submitterDept, '建筑工程公司项目部')
  assert.equal(requirement.submitDate, '2026-08-24')
  assert.equal(requirement.expectedEndDate, '2026-08-30')
  assert.equal(requirement.actualEndDate, '2026-08-25')
  assert.equal(requirement.completionStatus, '已处理')
  assert.equal(requirement.syncedSection, [
    '<p>问题描述：第一行<br>第二行</p>',
    '<p>模块：财务</p>',
    '<p>单据编号：I8-001</p>',
  ].join(''))

  const workOrder = mapItopsRecord({
    单据编码: 'I8-002', 问题类别: '操作问题', 问题描述: '协助操作', 模块: '协同办公',
    负责人: '王五', 处理人: '赵六', 解决方案: '已指导', 紧急程度: '普通',
    单据日期: '2026-08-24', 预计解决时间: '', 完成时间: '', 更新时间: '2026-08-24 12:00:00',
  })
  assert.equal(workOrder.targetType, 'work_order')
  assert.equal(workOrder.problemTypeName, '日常操作')
  assert.equal(workOrder.status, 1)
  assert.equal(workOrder.submitterName, 'i8')
  assert.equal(workOrder.submitterDept, 'i8')
  assert.equal(workOrder.syncedSection, [
    '<p>问题描述：协助操作</p>',
    '<p>模块：协同办公</p>',
    '<p>负责人：王五</p>',
    '<p>单据编号：I8-002</p>',
  ].join(''))
})

test('i8 单据缺少提交人或提交组织时兼容回退为 i8', () => {
  const requirement = mapItopsRecord({
    单据编码: 'I8-FALLBACK',
    单据日期: '2026-08-24',
    问题类别: '需求问题',
    问题描述: '来源字段缺失',
  })

  assert.equal(requirement.submitterName, 'i8')
  assert.equal(requirement.submitterDept, 'i8')
})

test('i8 已完成需求缺少解决方案时仍生成明确完成情况', () => {
  const requirement = mapItopsRecord({
    单据编码: 'I8-DONE',
    单据日期: '2026-08-24',
    问题类别: '需求问题',
    问题描述: '已处理但来源系统没有填写解决方案',
    完成时间: '2026-08-25 10:00:00',
    紧急程度: '普通',
  })

  assert.equal(requirement.status, 33)
  assert.equal(requirement.completionStatus, '已完成（i8同步）')
})

test('i8 同步描述生成安全的富文本换行', () => {
  const requirement = mapItopsRecord({
    单据编码: 'I8-HTML', 单据日期: '2026-08-24', 问题类别: '需求问题',
    问题描述: '<script>alert(1)</script>\n第二行', 模块: '<财务>', 紧急程度: '普通',
  })
  assert.equal(requirement.syncedSection, [
    '<p>问题描述：&lt;script&gt;alert(1)&lt;/script&gt;<br>第二行</p>',
    '<p>模块：&lt;财务&gt;</p>',
    '<p>单据编号：I8-HTML</p>',
  ].join(''))
})

test('更新同步区块时保留用户在区块之外补充的本地内容', () => {
  const original = `本地前言\n\n<!-- i8-sync:start -->\n旧同步内容\n<!-- i8-sync:end -->\n\n本地补充`
  assert.equal(
    mergeSyncedSection(original, '新同步内容'),
    `本地前言\n\n<!-- i8-sync:start -->\n新同步内容\n<!-- i8-sync:end -->\n\n本地补充`,
  )
  assert.equal(mergeSyncedSection('本地补充', '首次同步'), `本地补充\n\n<!-- i8-sync:start -->\n首次同步\n<!-- i8-sync:end -->`)
})

test('i8 紧急程度仅供工单映射，需求新增固定使用低优先级', () => {
  const requirement = mapItopsRecord({
    单据编码: 'I8-LOW', 单据日期: '2026-08-24', 问题类别: '需求问题',
    问题描述: '需求默认低优先级', 紧急程度: '重要',
  })
  assert.equal(requirement.priority, 0)
  assert.equal(requirement.warning, null)
  assert.deepEqual(mapPriority('重要'), { priority: 2, warning: null })
  assert.deepEqual(mapPriority('普通'), { priority: 1, warning: null })
  assert.deepEqual(mapPriority(''), { priority: 1, warning: '紧急程度为空，已按中优先级处理' })
  assert.deepEqual(mapPriority('特急'), { priority: 1, warning: '未知紧急程度“特急”，已按中优先级处理' })
})

test('需求标题保留短描述，长描述压缩空白后截取 100 字', () => {
  assert.equal(buildRequirementTitle('第一行\n第二行'), '第一行 第二行')
  const title = buildRequirementTitle(`  ${'测'.repeat(101)}\n后续  `)
  assert.equal(title, `${'测'.repeat(100)}……`)
})

test('首次同步优先使用接口配置日期，未配置时使用默认日期，增量同步回退一天', () => {
  assert.equal(resolveInitialSyncStart(), '2026-08-24')
  assert.deepEqual(resolveSyncWindow({ now: new Date('2026-08-24T09:15:00+08:00') }), {
    start: '2026-08-24',
    end: '2026-08-24',
  })
  assert.deepEqual(resolveSyncWindow({
    now: new Date('2026-08-25T09:15:00+08:00'),
    initialSyncDate: '2026-08-01',
  }), {
    start: '2026-08-01',
    end: '2026-08-25',
  })
  assert.deepEqual(resolveSyncWindow({
    now: new Date('2026-08-27T10:00:00+08:00'),
    lastSuccessAt: '2026-08-26T03:00:00+08:00',
  }), { start: '2026-08-25', end: '2026-08-27' })
})

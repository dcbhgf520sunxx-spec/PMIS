const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildTemplateApplication,
} = require('../src/services/projectPlanTemplateRules')

const template = {
  stages: [{
    id: 10,
    name: '项目立项',
    sort_order: 0,
    items: [
      { id: 101, name: '需求场景说明', sort_order: 0, requires_delivery_file: 0 },
      { id: 102, name: '立项汇报', sort_order: 1, requires_delivery_file: 1, delivery_requirement: '关键交付文件' },
    ],
  }],
}

test('模板套用时每条关键事项独立填写负责人、计划完成日期和交付要求', () => {
  const result = buildTemplateApplication(template, [{
    template_stage_id: 10,
    items: [
      { template_item_id: 101, owner_id: 5, due_date: '2026-08-31', requires_delivery_file: 0 },
      { template_item_id: 102, owner_id: 8, due_date: '2026-09-02', requires_delivery_file: 1 },
    ],
  }])

  assert.deepEqual(result[0].items.map((item) => ({
    id: item.templateItemId,
    ownerId: item.ownerId,
    dueDate: item.dueDate,
  })), [
    { id: 101, ownerId: 5, dueDate: '2026-08-31' },
    { id: 102, ownerId: 8, dueDate: '2026-09-02' },
  ])
})

test('模板关键事项的需交付文件允许按项目调整', () => {
  const result = buildTemplateApplication(template, [{
    template_stage_id: 10,
    items: [
      { template_item_id: 101, owner_id: 5, due_date: '2026-08-31', requires_delivery_file: 1 },
      { template_item_id: 102, owner_id: 8, due_date: '2026-09-02', requires_delivery_file: 0 },
    ],
  }])

  assert.equal(result[0].items[0].requiresDeliveryFile, 1)
  assert.equal(result[0].items[1].requiresDeliveryFile, 0)
})

test('模板阶段和事项允许删除并可追加自定义内容', () => {
  const expandedTemplate = {
    stages: [
      template.stages[0],
      { id: 20, name: '可删除阶段', sort_order: 1, items: [{ id: 201, name: '可删除事项', sort_order: 0, requires_delivery_file: 0 }] },
    ],
  }
  const result = buildTemplateApplication(expandedTemplate, [
    {
      template_stage_id: 10,
      items: [
        { template_item_id: 102, owner_id: 5, due_date: '2026-08-31', requires_delivery_file: 1 },
        { name: '补充评审', owner_id: 5, due_date: '2026-09-02', requires_delivery_file: 1, delivery_requirement: '评审材料' },
      ],
    },
    {
      name: '补充阶段',
      items: [{ name: '补充事项', owner_id: 8, due_date: '2026-09-30', requires_delivery_file: 0 }],
    },
  ])

  assert.deepEqual(result.map((stage) => stage.name), ['项目立项', '补充阶段'])
  assert.deepEqual(result[0].items.map((item) => item.name), ['立项汇报', '补充评审'])
  assert.equal(result[0].items[1].requiresDeliveryFile, 1)
  assert.equal(result[1].items[0].ownerId, 8)
})

test('空阶段允许保留且不要求无意义的默认负责人和日期', () => {
  const result = buildTemplateApplication(template, [{
    template_stage_id: 10,
    items: [],
  }])
  assert.equal(result[0].items.length, 0)
})

test('模板套用拒绝关键事项缺失负责人或日期，需交付文件未传时使用默认值', () => {
  assert.throws(
    () => buildTemplateApplication(template, [{
      template_stage_id: 10,
      items: [{ template_item_id: 101, due_date: '2026-08-31', requires_delivery_file: 0 }],
    }]),
    /请选择需求场景说明的负责人/
  )
  assert.throws(
    () => buildTemplateApplication(template, [{
      template_stage_id: 10,
      items: [{ template_item_id: 101, owner_id: 5, requires_delivery_file: 0 }],
    }]),
    /请选择需求场景说明的计划完成时间/
  )
  const defaults = buildTemplateApplication(template, [{
    template_stage_id: 10,
    items: [
      { template_item_id: 101, owner_id: 5, due_date: '2026-08-31' },
      { template_item_id: 102, owner_id: 5, due_date: '2026-08-31' },
      { name: '自定义事项', owner_id: 5, due_date: '2026-08-31' },
    ],
  }])
  assert.deepEqual(defaults[0].items.map((item) => item.requiresDeliveryFile), [0, 1, 0])
  assert.throws(
    () => buildTemplateApplication(template, [{
      template_stage_id: 10,
      items: [{ template_item_id: 999, owner_id: 8, due_date: '2026-08-31', requires_delivery_file: 0 }],
    }]),
    /模板关键事项不存在/
  )
})

test('自定义阶段和事项校验名称、重复项及完整默认值', () => {
  assert.throws(() => buildTemplateApplication(template, []), /至少保留一个阶段/)
  assert.throws(
    () => buildTemplateApplication(template, [{ name: '', items: [] }]),
    /请填写阶段名称/
  )
  assert.throws(
    () => buildTemplateApplication(template, [{
      name: '补充阶段',
      items: [
        { name: '同名事项', owner_id: 5, due_date: '2026-08-31', requires_delivery_file: 0 },
        { name: '同名事项', owner_id: 5, due_date: '2026-08-31', requires_delivery_file: 0 },
      ],
    }]),
    /关键事项名称不能重复/
  )
})

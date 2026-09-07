const assert = require('node:assert/strict')
const test = require('node:test')

const { validateBody } = require('../src/utils/validation')

test('validateBody reports missing required fields', () => {
  const result = validateBody({}, {
    employee_no: { required: true, label: '工号' }
  })

  assert.deepEqual(result, { ok: false, message: '工号不能为空' })
})

test('validateBody accepts numeric strings and rejects invalid numbers', () => {
  assert.deepEqual(validateBody({ status: '1' }, {
    status: { type: 'number', label: '状态' }
  }), { ok: true })

  assert.deepEqual(validateBody({ status: 'x' }, {
    status: { type: 'number', label: '状态' }
  }), { ok: false, message: '状态必须是数字' })
})

test('validateBody validates enum values', () => {
  const schema = { status: { type: 'enum', values: [0, 1, 2, 3], label: '状态' } }

  assert.deepEqual(validateBody({ status: 2 }, schema), { ok: true })
  assert.deepEqual(validateBody({ status: 9 }, schema), { ok: false, message: '状态取值无效' })
})

test('validateBody validates array item objects', () => {
  const schema = {
    items: {
      type: 'array',
      required: true,
      label: '排序数据',
      itemSchema: {
        id: { required: true, type: 'number', label: '档案ID' },
        sort_order: { required: true, type: 'number', label: '排序值' }
      }
    }
  }

  assert.deepEqual(validateBody({ items: [{ id: 1, sort_order: 2 }] }, schema), { ok: true })
  assert.deepEqual(validateBody({ items: [{ id: 1 }] }, schema), { ok: false, message: '排序数据第1项的排序值不能为空' })
})

test('validateBody enforces shared business text lengths', () => {
  const schema = { title: { required: true, maxLength: 3, label: '标题' } }
  assert.deepEqual(validateBody({ title: '三个字' }, schema), { ok: true })
  assert.deepEqual(validateBody({ title: '四个字了' }, schema), { ok: false, message: '标题不能超过3字符' })
})

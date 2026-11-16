const assert = require('node:assert/strict')
const test = require('node:test')
const db = require('../src/db')

for (const count of [1, 25]) {
  test(`角色列表返回${count}条时关联权限不产生逐行查询`, async t => {
    let queries = 0
    const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1, permissions: '可见叶子菜单' }))
    t.mock.method(db, 'prepare', () => {
      queries++
      return { all: async () => rows, get: async () => ({ total: count }) }
    })
    const res = { status() { return this }, json(body) { this.body = body } }
    await require('../src/controllers/roleController').list({ query: { pageSize: 50 } }, res)
    assert.equal(queries, 2)
    assert.equal(res.body.data.list.length, count)
    assert.ok(res.body.data.list.every(row => row.permissions === '可见叶子菜单'))
  })
}

for (const [module, field, expected] of [
  ['task', 'creatorName', 'creator.real_name'],
  ['workOrder', 'follower_id', 'u3.real_name'],
]) {
  for (const [order, direction] of [['ascend', 'ASC'], ['descend', 'DESC']]) {
    test(`${module} 的 ${field} 列表与详情上下条按显示姓名${direction}排序`, async t => {
      const queries = []
      t.mock.method(db, 'prepare', sql => {
        queries.push(sql.replace(/\s+/g, ' '))
        return { all: async () => [], get: async () => ({ total: 0 }) }
      })
      const controller = require(`../src/controllers/${module}Controller`)
      const req = { query: { sort_field: field, sort_order: order, id: 1, page: 2, pageSize: 10 }, user: { id: 1 } }
      const res = { status() { return this }, json() {} }
      await controller.list(req, res)
      await (controller.neighbors || controller.getNeighbors)(req, res)
      const list = queries.find(sql => sql.includes('LIMIT ?'))
      const neighbors = queries.find(sql => sql.includes('LAG('))
      if (module === 'task') {
        assert.ok(list.includes(`${expected} sort_value`))
        assert.ok(neighbors.includes(`${expected} sort_value`))
        assert.ok(list.includes(`group_sort ${direction}`))
        assert.ok(neighbors.includes(`group_sort ${direction}`))
      } else {
        assert.ok(list.includes(`ORDER BY ${expected} ${direction}, w.id ${direction}`))
        assert.ok(neighbors.includes(`ORDER BY ${expected} ${direction}, w.id ${direction}`))
      }
    })
  }
}

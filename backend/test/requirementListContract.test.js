const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('需求列表和相邻记录支持按创建人、创建时间排序', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/controllers/requirementController.js'), 'utf8')
  assert.equal((source.match(/creatorName:'creator\.real_name'/g) || []).length, 2)
  assert.equal((source.match(/createdAt:'r\.created_at'/g) || []).length, 2)
})

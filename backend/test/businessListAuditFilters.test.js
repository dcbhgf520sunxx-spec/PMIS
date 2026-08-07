const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', file), 'utf8')

const controllers = [
  ['productController.js', 'p'],
  ['projectController.js', 'p'],
  ['requirementController.js', 'r'],
  ['taskController.js', 't'],
  ['bugController.js', 'b'],
  ['workOrderController.js', 'w']
]

test('业务列表接口统一按创建人和创建时间区间筛选', () => {
  for (const [file, alias] of controllers) {
    const source = read(file)
    assert.match(source, new RegExp(`creator_id[^\\n]+${alias}\\.creator_id|${alias}\\.creator_id[^\\n]+creator_id`), `${file} 缺少创建人筛选`)
    assert.match(source, /created_at_from/, `${file} 缺少创建时间起点参数`)
    assert.match(source, new RegExp(`${alias}\\.created_at`), `${file} 缺少创建时间字段筛选`)
    assert.match(source, /created_at_to/, `${file} 缺少创建时间终点参数`)
    assert.match(source, /INTERVAL '1 day'/, `${file} 的创建时间终点未包含结束日全天`)
  }
})

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const { includeParentMenus } = require('../src/services/menuHierarchy')

const rootDir = join(__dirname, '..')
const authSource = readFileSync(join(rootDir, 'src/routes/auth.js'), 'utf8')
const controllerSource = readFileSync(join(rootDir, 'src/controllers/menuController.js'), 'utf8')

test('登录菜单和用户菜单复用父级补全能力', () => {
  assert.match(authSource, /includeParentMenus/)
  assert.match(controllerSource, /includeParentMenus/)
})

test('角色权限只保存勾选节点且不自动授予兄弟菜单', () => {
  assert.match(controllerSource, /only store what user checked/)
  assert.doesNotMatch(controllerSource, /auto-include siblings/)
})

test('只补授权节点的父级，不补同级菜单', () => {
  const allMenus = [
    { id: 1, parent_id: 0, code: 'design_system', sort_order: 40 },
    { id: 2, parent_id: 1, code: 'design_system_base', sort_order: 45 },
    { id: 3, parent_id: 1, code: 'design_system_feedback', sort_order: 47 }
  ]
  const resolved = includeParentMenus([allMenus[1]], allMenus)
  assert.deepEqual(resolved.map((menu) => menu.code), ['design_system', 'design_system_base'])
})

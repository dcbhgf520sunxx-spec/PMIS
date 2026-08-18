import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('优先级调整复用统一组件并按按钮权限隐藏', () => {
  const componentPath = path.join(root, 'src/components/admin/PriorityChangeAction/index.tsx');
  assert.equal(fs.existsSync(componentPath), true, '缺少 PriorityChangeAction')
  const source = read('src/components/admin/PriorityChangeAction/index.tsx');
  assert.match(source, /StatusChangeAction<PriorityValue>/)
  assert.match(source, /\{\.\.\.props\}/)
  assert.match(source, /调整优先级/)
  for (const label of ['低', '中', '高']) assert.match(source, new RegExp(`label: '${label}'`))
  assert.match(read('src/components/admin/index.ts'), /PriorityChangeAction/)
  assert.match(read('scripts/audit-component-usage.mjs'), /'PriorityChangeAction'/)
})

test('新增编辑表单展示只读优先级且新增复制默认低', () => {
  for (const file of [
    'src/modules/project/pages/ProjectFormPage.tsx',
    'src/modules/requirement/pages/RequirementFormPage.tsx',
    'src/modules/task/pages/TaskFormPage.tsx',
  ]) {
    const source = read(file)
    assert.match(source, /name="priority" label="优先级"/)
    assert.match(source, /name="priority"[\s\S]*?disabled/)
    assert.match(source, /priority:\s*0/)
  }
})

test('列表和详情均通过各自权限提供调整优先级入口', () => {
  for (const [moduleName, code] of [
    ['project', 'project_priority_adjust'],
    ['requirement', 'requirement_priority_adjust'],
    ['task', 'task_priority_adjust'],
  ]) {
    for (const page of ['ListPage', 'DetailPage']) {
      const source = read(`src/modules/${moduleName}/pages/${moduleName[0].toUpperCase()}${moduleName.slice(1)}${page}.tsx`)
      assert.match(source, /PriorityChangeAction/)
      assert.match(source, new RegExp(`permission="${code}"`))
    }
  }
})

test('列表优先级调整位于状态变更之后且任务中位于复制之前', () => {
  for (const moduleName of ['project', 'requirement', 'task']) {
    const source = read(`src/modules/${moduleName}/pages/${moduleName[0].toUpperCase()}${moduleName.slice(1)}ListPage.tsx`)
    const operationColumn = source.slice(source.indexOf("{ title: '操作'"), source.indexOf('</OperationColumnActions>') + '</OperationColumnActions>'.length)
    const statusIndex = operationColumn.indexOf('StatusChangeAction')
    const priorityIndex = operationColumn.indexOf('PriorityChangeAction')
    assert.ok(statusIndex >= 0 && priorityIndex > statusIndex, `${moduleName} 列表的调整优先级必须位于状态变更之后`)
    if (moduleName !== 'project') {
      const copyIndex = operationColumn.indexOf('/copy')
      assert.ok(copyIndex > priorityIndex, `${moduleName} 列表的调整优先级必须位于复制之前`)
    }
  }
})

test('三个 API 提供独立优先级调整接口且项目契约包含优先级', () => {
  for (const [moduleName, functionName] of [
    ['project', 'updateProjectPriority'],
    ['requirement', 'updateRequirementPriority'],
    ['task', 'updateTaskPriority'],
  ]) {
    const api = read(`src/api/${moduleName}Api.ts`)
    assert.match(api, new RegExp(`export async function ${functionName}`))
    assert.match(api, /\/priority/)
  }
  const types = read('src/modules/project/types.ts')
  assert.match(types, /export type ProjectPriority = 0 \| 1 \| 2/)
  assert.match(types, /priority: ProjectPriority/)
})

test('任务列表批量调整优先级复用统一组件和独立按钮权限', () => {
  const list = read('src/modules/task/pages/TaskListPage.tsx')
  const batch = read('src/modules/task/pages/useTaskBatchActions.tsx')
  const api = read('src/api/taskApi.ts')
  assert.match(list, /batch\.priorityAction/)
  assert.doesNotMatch(list, /batch\.priorityModal/)
  assert.match(batch, /<PriorityChangeAction/)
  assert.match(batch, /permission="task_priority_adjust"/)
  assert.doesNotMatch(batch, /priorityModal:\s*<AdminModal/)
  assert.match(batch, /batchUpdateTaskPriority/)
  assert.match(batch, /批量调整优先级/)
  assert.match(api, /export async function batchUpdateTaskPriority/)
  assert.match(api, /\/tasks\/batch-priority/)
})

test('组件工作台展示优先级调整操作示例', () => {
  const demo = read('src/modules/design-system/pages/demos/OverlayTemplateDemo.tsx')
  assert.match(demo, /PriorityChangeAction/)
  assert.match(demo, /优先级调整/)
})

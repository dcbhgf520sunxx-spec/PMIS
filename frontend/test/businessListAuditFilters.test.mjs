import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const keyIndex = (source, key) => source.search(new RegExp(`key:\\s*'${key}'`));

const listPages = [
  'src/modules/product/pages/ProductListPage.tsx',
  'src/modules/project/pages/ProjectListPage.tsx',
  'src/modules/requirement/pages/RequirementListPage.tsx',
  'src/modules/task/pages/TaskListPage.tsx',
  'src/modules/bug/pages/BugListPage.tsx'
];

test('业务列表在查询条件末尾统一提供创建人和创建时间筛选', () => {
  for (const relativePath of listPages) {
    const source = read(relativePath);
    const creatorFilter = keyIndex(source, 'creatorId');
    const createdAtFilter = keyIndex(source, 'createdAtRange');
    assert.ok(creatorFilter >= 0, `${relativePath} 缺少创建人筛选`);
    assert.ok(createdAtFilter > creatorFilter, `${relativePath} 的创建时间筛选必须位于创建人之后`);
    assert.match(source.slice(creatorFilter, createdAtFilter), /label:\s*'创建人'/);
    assert.match(source.slice(createdAtFilter), /label:\s*'创建时间'/);
  }

  const workOrderFilter = read('src/modules/work-order/pages/WorkOrderListFilterBar.tsx');
  const workOrderCreator = keyIndex(workOrderFilter, 'creatorId');
  const workOrderCreatedAt = keyIndex(workOrderFilter, 'createdAtRange');
  assert.ok(workOrderCreator >= 0, '运维工单缺少创建人筛选');
  assert.ok(workOrderCreatedAt > workOrderCreator, '运维工单的创建时间筛选必须位于创建人之后');
});

test('业务列表将创建筛选写入 URL 并传给真实接口', () => {
  for (const relativePath of listPages) {
    const source = read(relativePath);
    assert.match(source, /creatorId:\s*listRouteCodecs\.string/);
    assert.match(source, /createdAtRange:\s*listRouteCodecs\.dateArray/);
    assert.match(source, /creator_id:\s*filters\.appliedFilters\.creatorId/);
    assert.match(source, /created_at_from:/);
    assert.match(source, /created_at_to:/);
  }

  const workOrderPage = read('src/modules/work-order/pages/WorkOrderListPage.tsx');
  const workOrderData = read('src/modules/work-order/pages/useWorkOrderListData.ts');
  const workOrderQuery = read('src/api/workOrderQueryParams.ts');
  assert.match(workOrderPage, /creatorId:\s*listRouteCodecs\.string/);
  assert.match(workOrderPage, /createdAtRange:\s*listRouteCodecs\.dateArray/);
  assert.match(workOrderData, /creatorId:\s*appliedFilters\.creatorId/);
  assert.match(workOrderQuery, /creator_id:\s*params\.creatorId/);
  assert.match(workOrderQuery, /created_at_from:\s*params\.createdAtFrom/);
  assert.match(workOrderQuery, /created_at_to:\s*params\.createdAtTo/);
});

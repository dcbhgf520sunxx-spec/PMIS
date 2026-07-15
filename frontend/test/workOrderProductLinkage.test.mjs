import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(frontendRoot, '..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('运维工单前后端统一关联所属产品', () => {
  const frontend = [
    'frontend/src/api/workOrderApi.ts',
    'frontend/src/api/workOrderQueryParams.ts',
    'frontend/src/modules/work-order/types.ts',
    'frontend/src/modules/work-order/pages/WorkOrderFormPage.tsx',
    'frontend/src/modules/work-order/pages/WorkOrderListFilterBar.tsx',
    'frontend/src/modules/work-order/pages/WorkOrderListColumns.tsx',
    'frontend/src/modules/work-order/pages/WorkOrderDetailPage.tsx',
    'frontend/src/modules/work-order/pages/useWorkOrderListData.ts'
  ].map(read).join('\n');
  assert.match(frontend, /所属产品/);
  assert.match(frontend, /getProductOptions/);
  assert.doesNotMatch(frontend, /所属系统|systemId|systemName|system_id|system_name/);

  const controller = read('backend/src/controllers/workOrderController.js');
  assert.match(controller, /product_id/);
  assert.match(controller, /pms_product/);
  assert.doesNotMatch(controller, /所属系统|system_id|system_name/);
  assert.match(read('backend/src/controllers/productController.js'), /pms_work_order[\s\S]*product_id/);
});

test('工单所属产品迁移优先同名匹配并为其余模拟数据随机分配产品', () => {
  const migration = read('backend/db/migrations/20260713_work_order_product.sql');
  assert.match(migration, /p\.name\s*=\s*a\.name/);
  assert.match(migration, /ORDER BY random\(\)/);
  assert.match(migration, /DROP COLUMN system_id/);
  assert.match(migration, /product_id[\s\S]*REFERENCES pms_product/);
});

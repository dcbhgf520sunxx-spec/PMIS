import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('项目表单保持产品在前并支持产品和需求双向联动', () => {
  const form = read('src/modules/project/pages/ProjectFormPage.tsx');
  const api = read('src/api/projectApi.ts');

  assert.match(form, /getProjectRequirementOptions/);
  assert.match(form, /productId\s*\?\s*requirements\.filter\(\(requirement\)\s*=>\s*requirement\.productId\s*===\s*productId\)\s*:\s*requirements/);
  assert.ok(form.indexOf('name="productId"') < form.indexOf('name="requirementId"'), '所属产品必须保持在所属需求前面');
  assert.match(form, /name="requirementId" label="所属需求"[^\n]*?required\s*:\s*true/);
  assert.doesNotMatch(form, /name="requirementId"[^\n]*?disabled=/);
  assert.match(form, /handleProductChange/);
  assert.match(form, /selectedRequirement\.productId\s*!==\s*nextProductId[\s\S]*?setFieldValue\('requirementId',\s*undefined\)/);
  assert.match(form, /handleRequirementChange/);
  assert.match(form, /setFieldValue\('productId',\s*selectedRequirement\.productId\)/);
  assert.match(api, /requirement_id:Number\(v\.requirementId\)/);
})

test('项目列表和详情展示并筛选所属需求', () => {
  const list = read('src/modules/project/pages/ProjectListPage.tsx');
  const detail = read('src/modules/project/pages/ProjectDetailPage.tsx');
  const types = read('src/modules/project/types.ts');

  assert.match(list, /requirementId/);
  assert.match(list, /requirement_id:\s*filters\.appliedFilters\.requirementId/);
  assert.match(list, /title: '所属需求', dataIndex: 'requirementName'/);
  assert.match(list, /key: 'requirement'[\s\S]*?label: '所属需求'/);
  assert.match(detail, /label: '所属需求', value: row\.requirementName/);
  assert.match(types, /requirementId: string; requirementName: string/);
})

test('需求前端不再读写或展示所属项目', () => {
  for (const file of [
    'src/api/requirementApi.ts',
    'src/modules/requirement/types.ts',
    'src/modules/requirement/pages/RequirementFormPage.tsx',
    'src/modules/requirement/pages/RequirementListPage.tsx',
    'src/modules/requirement/pages/RequirementDetailPage.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /projectId|project_id|projectName|所属项目|getProjectOptions/, `${file} 仍包含所属项目`);
  }
});

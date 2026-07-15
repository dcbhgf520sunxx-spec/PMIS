import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/modules/requirement/statusTransitions.ts'), 'utf8');
const listSource = fs.readFileSync(path.join(root, 'src/modules/requirement/pages/RequirementListPage.tsx'), 'utf8');

test('需求评估状态按上会和提报场景区分命名', () => {
  assert.match(source, /0:'上会评估'/);
  assert.match(source, /10:'提报评估'/);
});

test('暂停后可以恢复到当前需求路径内任意状态', () => {
  assert.match(source, /1:\[0,1,2,3,30,31,32,33,34\]/);
  assert.match(source, /2:\[10,11,12,13,30,31,32,33,34\]/);
  assert.match(source, /3:\[20,21,22,30,31,32,33,34\]/);
  assert.match(source, /4:\[30,31,32,33,34\]/);
  assert.match(source, /r\.status===35[\s\S]*pathStatuses\[r\.requirementType\]/);
});

test('需求查询状态选项跟随需求路径并清空不兼容状态', () => {
  assert.match(source, /export function requirementStatusesForType/);
  assert.match(source, /export function normalizeRequirementStatusForType/);
  assert.match(source, /\[\.\.\.pathStatuses\[type\],35\]/);
  assert.match(listSource, /requirementStatusesForType\(filters\.draftFilters\.requirementType[^)]*\)/);
  assert.match(listSource, /normalizeRequirementStatusForType\(requirementType,prev\.status[^)]*\)/);
});

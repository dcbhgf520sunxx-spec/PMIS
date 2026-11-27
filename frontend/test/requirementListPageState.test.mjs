import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/modules/requirement/pages/RequirementListPage.tsx'), 'utf8');

test('需求列表复用模板的加载、错误和重新加载能力', () => {
  assert.match(source, /useTemplateServerListData<RequirementRecord/);
  assert.match(source, /const load = list\.reload/);
  assert.match(source, /<TemplateListPage<RequirementRecord>[^>]*error=\{list\.error\}[^>]*onRetry=\{load\}/s);
  assert.match(source, /table=\{\{ (?:\.\.\.recordFocus\.tableProps, )?columns, dataSource: list\.pagedRows, loading: list\.loading,/);
});

test('需求列表接入公共状态定位和行高亮能力', () => {
  assert.match(source, /const recordFocus = useListRecordFocus\(\{ list, reload: load,/);
  assert.match(source, /table=\{\{ \.\.\.recordFocus\.tableProps,/);
});

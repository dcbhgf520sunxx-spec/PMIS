import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/modules/requirement/pages/RequirementListPage.tsx'), 'utf8');

test('需求列表复用模板的加载、错误和重新加载能力', () => {
  assert.match(source, /\[loading,setLoading\]=useState\(true\)/);
  assert.match(source, /\[error,setError\]=useState\(''\)/);
  assert.match(source, /<TemplateListPage<RequirementRecord>[^>]*error=\{error\}[^>]*onRetry=\{load\}/s);
  assert.match(source, /table=\{\{ columns, dataSource: list\.pagedRows, loading,/);
});

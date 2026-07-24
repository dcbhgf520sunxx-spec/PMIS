import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('普通进度统一使用主蓝色且异常和成功状态保留语义色', () => {
  const source = read('src/components/admin/AdminPrimitives/index.tsx');

  assert.match(source, /const defaultStrokeColor = '#1f6fff'/);
  assert.match(source, /status === 'exception' \|\| status === 'success'/);
  assert.match(source, /strokeColor=\{strokeColor \?\? semanticStrokeColor\}/);
});

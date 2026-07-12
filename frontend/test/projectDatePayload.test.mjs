import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('项目提交把日期对象转换为 DATE 字符串', async () => {
  const source = await readFile(new URL('../src/api/projectApi.ts', import.meta.url), 'utf8');
  assert.match(source, /formatDateInput\(v\.startDate\)/);
  assert.match(source, /formatDateInput\(v\.expectedEndDate\)/);
  assert.match(source, /\.format\('YYYY-MM-DD'\)/);
});

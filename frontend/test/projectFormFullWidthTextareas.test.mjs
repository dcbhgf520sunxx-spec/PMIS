import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('项目进度和风险文本域各自独占一行', async () => {
  const source = await readFile(new URL('../src/modules/project/pages/ProjectFormPage.tsx', import.meta.url), 'utf8');
  const fullWidth = "formItemProps={{className:'admin-template-form-page__field is-full'}}";
  assert.match(source, new RegExp(`name="progressText"[^>]+${fullWidth.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
  assert.match(source, new RegExp(`name="riskText"[^>]+${fullWidth.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
});

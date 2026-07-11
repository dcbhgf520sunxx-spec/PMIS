import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('FormPage keeps Dayjs values for business submit adapters', async () => {
  const source = await readFile(new URL('../src/components/admin/FormPage/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /<ProForm<T>[\s\S]*dateFormatter=\{false\}/);
});

test('work order submit adapter formats retained Dayjs values explicitly', async () => {
  const source = await readFile(new URL('../src/modules/work-order/pages/WorkOrderFormPage.tsx', import.meta.url), 'utf8');

  assert.match(source, /values\.submitTime\.format\('YYYY-MM-DD'\)/);
  assert.match(source, /values\.expectedResolveDate\.format\('YYYY-MM-DD'\)/);
});

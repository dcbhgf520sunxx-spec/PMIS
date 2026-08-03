import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('keeps an inactive login session for two hours before automatic logout', async () => {
  const source = await readFile(
    new URL('../src/layouts/AdminLayout/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const SESSION_IDLE_TIMEOUT_MS = 2 \* 60 \* 60 \* 1000;/);
});

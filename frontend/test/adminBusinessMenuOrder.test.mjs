import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

test('管理端侧栏将需求管理排在项目管理之前', () => {
  const source = fs.readFileSync(
    path.resolve(currentDir, '../src/layouts/AdminLayout/index.tsx'),
    'utf8'
  );
  const requirementIndex = source.indexOf("label: '需求管理'");
  const projectIndex = source.indexOf("label: '项目管理'");

  assert.notEqual(requirementIndex, -1);
  assert.notEqual(projectIndex, -1);
  assert.ok(requirementIndex < projectIndex);
});

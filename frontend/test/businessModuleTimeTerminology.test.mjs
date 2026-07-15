import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules');
const modules = ['product', 'project', 'requirement', 'task', 'work-order'];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

test('产品、项目、需求和运维工单统一使用时间命名', () => {
  const offenders = modules.flatMap((moduleName) => sourceFiles(path.join(root, moduleName)))
    .filter((file) => fs.readFileSync(file, 'utf8').includes('日期'))
    .map((file) => path.relative(root, file));

  assert.deepEqual(offenders, []);
});

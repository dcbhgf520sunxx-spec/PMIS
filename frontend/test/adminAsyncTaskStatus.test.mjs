import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  const file = `${root}/${path}`;
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

test('异步任务状态组件统一承接等待、执行、完成、失败、进度和重试', () => {
  const source = read('src/components/admin/AdminAsyncTaskStatus/index.tsx');
  const styles = read('src/components/admin/AdminAsyncTaskStatus/index.css');
  const exports = read('src/components/admin/index.ts');

  assert.match(source, /export type AdminAsyncTaskState = 'waiting' \| 'running' \| 'success' \| 'error'/);
  assert.match(source, /progress\?: number/);
  assert.match(source, /errorMessage\?: ReactNode/);
  assert.match(source, /onRetry\?:/);
  assert.match(source, /state === 'error'/);
  assert.match(source, /setIsRetrying\(true\)/);
  assert.match(source, /AdminProgress/);
  assert.match(source, /strokeColor="#1f6fff"/);
  assert.doesNotMatch(source, /status="active"/);
  assert.match(source, /waiting: \{ label: '正在排队'/);
  assert.match(source, /running: \{ label: '正在处理'/);
  assert.match(source, /success: \{ label: '处理完成'/);
  assert.match(source, /error: \{ label: '处理失败'/);
  assert.match(styles, /\.admin-async-task-status\.is-running/);
  assert.match(styles, /\.admin-async-task-status\.is-error/);
  assert.match(exports, /AdminAsyncTaskStatus/);
});

test('组件工作台一次展示长任务的四种真实状态且不使用模拟操作按钮', () => {
  const section = read('src/modules/design-system/pages/sections/FeedbackSection.tsx');
  const example = read('src/modules/design-system/pages/sections/feedback/AsyncTaskStatusExamples.tsx');
  const styles = read('src/modules/design-system/pages/sections/FeedbackSection.css');

  assert.match(section, /AsyncTaskStatusExamples/);
  assert.match(section, /label: '长任务处理'/);
  assert.match(example, /AdminAsyncTaskStatus/);
  assert.match(example, /state="waiting"/);
  assert.match(example, /state="running"/);
  assert.match(example, /state="success"/);
  assert.match(example, /state="error"/);
  assert.match(example, /前方还有 3 个任务/);
  assert.match(example, /progress=\{38\}/);
  assert.match(example, /onRetry/);
  assert.doesNotMatch(example, /模拟完成|模拟失败|开始执行/);
  assert.match(styles, /\.design-system-page__async-task-state-grid/);
});

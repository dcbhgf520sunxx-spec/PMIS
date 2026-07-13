import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assessBackendRuntimeFreshness } from './backend-runtime-freshness.mjs';

test('没有本地后端进程时跳过运行态检查', () => {
  assert.deepEqual(assessBackendRuntimeFreshness({ listenerPid: null }), {
    status: 'skipped',
    message: '本地后端未运行，跳过运行态新鲜度检查'
  });
});

test('运行进程早于后端源码时阻断交付', () => {
  const result = assessBackendRuntimeFreshness({
    listenerPid: 123,
    processStartMs: Date.parse('2026-07-13T15:59:59+08:00'),
    latestSourceMtimeMs: Date.parse('2026-07-13T17:20:23+08:00')
  });

  assert.equal(result.status, 'stale');
  assert.match(result.message, /后端源码晚于当前服务启动时间/);
  assert.match(result.message, /请重启后端/);
});

test('运行进程不早于后端源码时允许交付', () => {
  assert.deepEqual(assessBackendRuntimeFreshness({
    listenerPid: 123,
    processStartMs: Date.parse('2026-07-13T17:21:00+08:00'),
    latestSourceMtimeMs: Date.parse('2026-07-13T17:20:23+08:00')
  }), {
    status: 'fresh',
    message: '当前后端服务已加载最新源码'
  });
});

test('统一门禁和交付文档都包含运行态新鲜度检查', () => {
  const gate = readFileSync(new URL('./verify-change.mjs', import.meta.url), 'utf8');
  const flow = readFileSync(new URL('../docs/ai-delivery-flow.md', import.meta.url), 'utf8');

  assert.match(gate, /check-backend-runtime-freshness\.mjs/);
  assert.match(flow, /运行态新鲜度/);
});

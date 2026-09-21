import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDay, millisecondsUntilNextBusinessDay } from '../src/utils/businessDay.ts';

test('上海跨日刷新在午夜触发，不受浏览器时区影响', () => {
  const before = Date.parse('2026-09-30T15:59:59Z');
  assert.equal(businessDay(before), '2026-09-30');
  assert.equal(millisecondsUntilNextBusinessDay(before), 1000);
  assert.equal(businessDay(before + 1000), '2026-10-01');
  assert.equal(millisecondsUntilNextBusinessDay(before + 1000), 86400000);
});

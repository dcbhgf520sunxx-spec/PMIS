import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const historyTimelineSource = readFileSync(
  new URL('../src/components/admin/HistoryTimeline/index.tsx', import.meta.url),
  'utf8'
);

test('变更历史对所有描述类字段统一生成富文本摘要', () => {
  assert.match(historyTimelineSource, /field\.endsWith\('描述'\)/);
  assert.match(historyTimelineSource, /richTextToSummary\(value\)/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(
  new URL('../src/components/admin/HistoryTimeline/index.tsx', import.meta.url),
  'utf8'
);
const rules = readFileSync(new URL('../../docs/ai-development-rules.md', import.meta.url), 'utf8');

test('变更历史统一摘要所有描述类富文本和其中的图片', () => {
  assert.match(component, /field\.endsWith\('描述'\)/);
  assert.match(component, /richTextToSummary\(value\)/);
  assert.doesNotMatch(component, /field === '问题描述'/);
  assert.match(rules, /变更历史.*描述类富文本.*〔图片〕/);
});

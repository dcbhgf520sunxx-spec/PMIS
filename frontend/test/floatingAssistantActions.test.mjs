import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/admin/AdminFloatingAssistant/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/components/admin/AdminFloatingAssistant/index.css', import.meta.url), 'utf8');
const atlas = readFileSync(new URL('../src/assets/assistant/minibot-floating-spritesheet.webp', import.meta.url));

test('小机器人使用最新动作图集', () => {
  assert.equal(createHash('sha256').update(atlas).digest('hex'), '0f87635a77d5ad59a01569b93214a0f5aaf305af3224b48ea40b087b15a84dc2');
  assert.doesNotMatch(styles, /minibot-run-spritesheet/);
});

test('小机器人动作名称与九状态图集行语义一致', () => {
  for (const mood of ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review']) {
    assert.match(styles, new RegExp(`data-mood=['"]${mood}['"]`));
  }
  assert.doesNotMatch(source, /'patrol'|'wave'|'sit'|'cheer'|'think'|'look'/);
});

test('拖动和悬浮使用对应的新动作', () => {
  assert.match(source, /isDragging \? `running-\$\{runDirection\}`/);
  assert.match(source, /isHovering \? 'waving'/);
  const ambientMoods = source.match(/const AMBIENT_MOODS[\s\S]*?= \[([\s\S]*?)\];/)?.[1] || '';
  assert.doesNotMatch(ambientMoods, /'failed'/);
});

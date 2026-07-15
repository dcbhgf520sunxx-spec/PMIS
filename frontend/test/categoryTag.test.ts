import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { defineCategoryToneMap } from '../src/components/admin/CategoryTag/categoryTones.ts';

test('分类色映射由业务定义且不同分类必须使用不同色调', () => {
  const tones = defineCategoryToneMap({ typeA: 'blue', typeB: 'cyan' });

  assert.deepEqual(tones, { typeA: 'blue', typeB: 'cyan' });
  assert.equal(Object.isFrozen(tones), true);
});

test('分类色映射拒绝不同分类使用同一色调', () => {
  assert.throws(
    () => defineCategoryToneMap({ typeA: 'blue', typeB: 'blue' }),
    /同一分类维度的不同值不能使用相同色调/
  );
});

test('青色分类标签使用底座规范色', () => {
  const source = readFileSync(new URL('../src/components/admin/CategoryTag/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /color:\s*'#0ea5e9'/);
  assert.match(source, /backgroundColor:\s*'rgba\(14, 165, 233, 0\.1\)'/);
  assert.match(source, /borderColor:\s*'rgba\(14, 165, 233, 0\.35\)'/);
  assert.match(source, /color=\{tone === 'cyan' \? undefined : categoryToneColors\[tone\]\}/);
});

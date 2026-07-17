import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const layoutSectionSource = readFileSync(
  new URL('../src/modules/design-system/pages/sections/LayoutSection.tsx', import.meta.url),
  'utf8'
);
const demoUrl = new URL('../src/modules/design-system/pages/demos/OverlayTemplateDemo.tsx', import.meta.url);
const demoSource = existsSync(demoUrl) ? readFileSync(demoUrl, 'utf8') : '';

test('页面模式的弹窗抽屉区域接入真实 OverlayTemplateDemo', () => {
  assert.ok(layoutSectionSource.includes("import { OverlayTemplateDemo } from '../demos/OverlayTemplateDemo'"));
  assert.ok(layoutSectionSource.includes("if (title === '弹窗 / 抽屉') return <OverlayTemplateDemo />"));
});

test('弹窗抽屉模板展示真实可运行组件组合', () => {
  assert.ok(demoSource.includes('<AdminModal'));
  assert.ok(demoSource.includes('<StatusChangeAction'));
  assert.ok(demoSource.includes("tone: 'normal'"));
  assert.ok(demoSource.includes("tone: 'success'"));
  assert.ok(demoSource.includes("tone: 'danger'"));
  assert.ok(demoSource.includes('<DeleteConfirmAction'));
  assert.ok(demoSource.includes('<AdminDrawer'));
  assert.ok(demoSource.includes('<TemplateDrawerTable<OverlayTableRecord>'));
  assert.ok(demoSource.includes('ComponentEntry name="AdminModal / StatusChangeAction / DeleteConfirmAction / AdminDrawer / TemplateDrawerTable"'));
});

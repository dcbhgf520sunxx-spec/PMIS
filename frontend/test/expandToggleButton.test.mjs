import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const component = read('src/components/admin/ExpandToggleButton/index.tsx');
const styles = read('src/components/admin/ExpandToggleButton/index.css');
const iconActionStyles = read('src/components/admin/AdminIconAction/index.css');
const baseSection = read('src/modules/design-system/pages/sections/BaseSection.tsx');

test('展开收起按钮同时保留裸加减和方框加减两组图标', () => {
  assert.match(component, /MinusOutlined/);
  assert.match(component, /PlusOutlined/);
  assert.match(component, /MinusSquareOutlined/);
  assert.match(component, /PlusSquareOutlined/);
  assert.match(component, /variant\?: 'plain' \| 'square'/);
  assert.match(component, /variant = 'plain'/);
  assert.match(component, /Omit<ButtonProps,[^>]*'variant'/s);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /title=\{label\}/);
});

test('层级图标按钮保持轻量尺寸和细线图形', () => {
  assert.match(styles, /width:\s*24px/);
  assert.match(styles, /height:\s*24px/);
  assert.match(styles, /font-size:\s*16px/);
  assert.match(styles, /background:\s*transparent/);
});

test('全部图标按钮使用正方形点击区和统一浅蓝悬浮底色', () => {
  assert.match(iconActionStyles, /\.admin-icon-action\.ant-btn-sm/);
  assert.match(iconActionStyles, /width:\s*24px/);
  assert.match(iconActionStyles, /height:\s*24px/);
  assert.match(iconActionStyles, /background:\s*var\(--app-soft-primary-bg\)\s*!important/);
  assert.match(styles, /background:\s*var\(--app-soft-primary-bg\)\s*!important/);
});

test('基础组件的图标按钮展示裸图标和方框图标的展开收起状态', () => {
  assert.match(baseSection, /expandLabel="展开层级"/);
  assert.match(baseSection, /collapseLabel="收起层级"/);
  assert.match(baseSection, /variant="square"/);
  assert.match(baseSection, /expanded=\{false\}/);
  assert.match(baseSection, /<ExpandToggleButton\s+expanded/);
});

test('基础组件的图标按钮展示附件下载动作', () => {
  assert.match(baseSection, /DownloadOutlined/);
  assert.match(baseSection, /<AdminIconAction label="下载" icon=\{<DownloadOutlined \/>\}/);
});

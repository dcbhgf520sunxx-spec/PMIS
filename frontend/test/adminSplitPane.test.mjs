import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  const file = `${root}/${path}`;
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

test('可拖拽双栏组件统一承接拖拽、边界、窄屏和个人宽度记忆', () => {
  const source = read('src/components/admin/AdminSplitPane/index.tsx');
  const styles = read('src/components/admin/AdminSplitPane/index.css');
  const exports = read('src/components/admin/index.ts');

  assert.match(source, /export function AdminSplitPane/);
  assert.match(source, /minLeftWidth/);
  assert.match(source, /maxLeftWidth/);
  assert.match(source, /minRightWidth/);
  assert.match(source, /className/);
  assert.match(source, /storageKey/);
  assert.match(source, /localStorage/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /dragStartRef/);
  assert.match(source, /event\.clientX - dragStartRef\.current\.clientX/);
  assert.doesNotMatch(source, /updateByPointer\(event\.clientX\)/);
  assert.match(source, /<span aria-hidden="true"/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /role="separator"/);
  assert.match(styles, /grid-template-columns/);
  assert.match(styles, /admin-split-pane__divider::before/);
  assert.match(styles, /width: 1px/);
  assert.match(styles, /admin-split-pane__divider span/);
  assert.match(styles, /width: 3px/);
  assert.match(styles, /height: 44px/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(exports, /AdminSplitPane/);
});

test('基础档案复用公共双栏组件，不在业务页面重复实现拖拽', () => {
  const page = read('src/modules/archive/pages/ArchivePage.tsx');
  const styles = read('src/modules/archive/pages/ArchivePage.css');

  assert.match(page, /<AdminSplitPane/);
  assert.match(page, /maxLeftWidth=\{MAX_ARCHIVE_SIDEBAR_WIDTH\}/);
  assert.match(page, /storageKey="archive-type-list"/);
  assert.doesNotMatch(page, /handleSidebarResizeStart/);
  assert.doesNotMatch(page, /addEventListener\('pointermove'/);
  assert.doesNotMatch(styles, /archive-page__resize-handle/);
});

test('组件工作台在页面模式展示可操作的双栏工作台示例', () => {
  const section = read('src/modules/design-system/pages/sections/LayoutSection.tsx');
  const example = read('src/modules/design-system/pages/sections/layout/SplitPaneExamples.tsx');

  assert.match(section, /SplitPaneExamples/);
  assert.match(example, /AdminSplitPane/);
  assert.match(example, /可拖拽分栏/);
  assert.match(example, /基础档案已使用同一组件/);
  assert.match(example, /storageKey="design-system-split-pane-example"/);
});

test('步骤导航沉淀到页面模式，底座不固化具体业务流转', () => {
  const source = read('src/components/admin/AdminStepNavigation/index.tsx');
  const styles = read('src/components/admin/AdminStepNavigation/index.css');
  const exports = read('src/components/admin/index.ts');
  const section = read('src/modules/design-system/pages/sections/LayoutSection.tsx');
  const example = read('src/modules/design-system/pages/sections/layout/StepNavigationExamples.tsx');

  assert.match(source, /export function AdminStepNavigation/);
  assert.match(source, /<Steps/);
  assert.match(source, /responsive/);
  assert.match(styles, /display: inline-flex/);
  assert.match(styles, /flex: 0 1 clamp\(190px, 20vw, 260px\)/);
  assert.match(styles, /item-finish \.ant-steps-item-icon/);
  assert.match(styles, /background: var\(--app-primary\)/);
  assert.match(styles, /color: #fff !important/);
  assert.match(styles, /width: 12px/);
  assert.match(styles, /stroke-width: 48/);
  assert.match(exports, /AdminStepNavigation/);
  assert.match(section, /StepNavigationExamples/);
  assert.match(example, /AdminStepNavigation/);
  assert.match(example, /业务页面负责每一步的数据校验/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  return readFileSync(`${root}/${path}`, 'utf8');
}

test('可编辑明细表单复用 ProFormList 并提供统一增删能力', () => {
  const source = read('src/components/admin/AdminProFormEditableList/index.tsx');
  assert.match(source, /ProFormList/);
  assert.match(source, /MIN_ROWS/);
  assert.match(source, /creatorRecord/);
  assert.match(source, /fields/);
  assert.match(source, /至少保留/);
  assert.match(source, /index\s*\+\s*1/);
  assert.match(source, /minmax\(160px, 280px\)/);
});

test('可编辑明细表单在窄屏切换为卡片并保留字段标签', () => {
  const source = read('src/components/admin/AdminProFormEditableList/index.tsx');
  const styles = read('src/components/admin/AdminProFormEditableList/index.css');
  assert.match(source, /data-label/);
  assert.match(source, /admin-pro-form-editable-list__header/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(styles, /admin-pro-form-editable-list__header[\s\S]*display:\s*none/);
  assert.match(styles, /admin-pro-form-editable-list__row[\s\S]*border/);
});

test('可编辑明细表单在电脑端按实际列宽收缩而不是铺满整页', () => {
  const styles = read('src/components/admin/AdminProFormEditableList/index.css');
  assert.match(styles, /\.admin-pro-form-editable-list\s*\{[\s\S]*width:\s*fit-content/);
  assert.match(styles, /\.admin-pro-form-editable-list\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*\.admin-pro-form-editable-list\s*\{[\s\S]*width:\s*100%/);
});

test('可编辑明细表单在横向滚动时固定左右边界列', () => {
  const styles = read('src/components/admin/AdminProFormEditableList/index.css');

  assert.match(
    styles,
    /admin-pro-form-editable-list__header\s*>\s*span:first-child[\s\S]*position:\s*sticky[\s\S]*left:\s*0/
  );
  assert.match(
    styles,
    /admin-pro-form-editable-list__sequence[\s\S]*position:\s*sticky[\s\S]*left:\s*0/
  );
  assert.match(
    styles,
    /admin-pro-form-editable-list__header\s*>\s*span:last-child[\s\S]*position:\s*sticky[\s\S]*right:\s*0/
  );
  assert.match(
    styles,
    /admin-pro-form-editable-list__operation[\s\S]*position:\s*sticky[\s\S]*right:\s*0/
  );
});

test('可编辑明细表单已统一导出并在组件工作台提供真实示例', () => {
  const exports = read('src/components/admin/index.ts');
  const formInputs = read('src/components/admin/AdminProFormInput/index.tsx');
  const section = read('src/modules/design-system/pages/sections/InputSection.tsx');
  const example = read('src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx');
  assert.match(exports, /AdminProFormEditableList/);
  assert.match(formInputs, /AdminProFormMoney/);
  assert.match(formInputs, /precision:\s*2/);
  assert.match(formInputs, /stringMode:\s*true/);
  assert.match(section, /EditableDetailListExamples/);
  assert.match(example, /AdminProFormEditableList/);
  assert.match(example, /AdminProFormMoney/);
  assert.match(example, /阶段名称/);
  assert.match(example, /计划金额/);
  assert.match(example, /plannedAmount:\s*'300000\.00'/);
  assert.match(example, /fields=\{stageFields\}/);
});

test('可编辑明细表单的新增按钮使用通用文案', () => {
  const source = read('src/components/admin/AdminProFormEditableList/index.tsx');
  const example = read('src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx');

  assert.match(source, /creatorButtonText:\s*'新增'/);
  assert.doesNotMatch(example, /新增阶段/);
});

test('组件工作台的可编辑明细示例不重复展示保存取消', () => {
  const example = read('src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx');

  assert.match(
    example,
    /<FormPage<EditableDetailExampleValues>[\s\S]*showActions=\{false\}/
  );
});

test('可编辑明细业务方只能声明字段，结构和操作由底座固定', () => {
  const source = read('src/components/admin/AdminProFormEditableList/index.tsx');
  const example = read('src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx');

  assert.match(source, /fields:\s*AdminProFormEditableListField\[\]/);
  assert.match(source, /const MIN_ROWS = 1/);
  assert.match(source, /creatorButtonText:\s*'新增'/);
  assert.doesNotMatch(source, /\baddText\?:/);
  assert.doesNotMatch(source, /\bminRows\?:/);
  assert.doesNotMatch(source, /\bmaxRows\?:/);
  assert.doesNotMatch(source, /\breadonly\?:/);
  assert.doesNotMatch(source, /field\.width/);
  assert.match(example, /fields=\{stageFields\}/);
  assert.doesNotMatch(example, /\bwidth:/);
});

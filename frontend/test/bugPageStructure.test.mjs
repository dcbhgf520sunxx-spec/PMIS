import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('BUG 页面使用统一列表表单详情样板', () => {
  assert.match(read('src/modules/bug/pages/BugListPage.tsx'), /TemplateListPage/);
  assert.match(read('src/modules/bug/pages/BugFormPage.tsx'), /TemplateFormPage/);
  assert.match(read('src/modules/bug/pages/BugDetailPage.tsx'), /TemplateDetailPage/);
});

test('BUG 类型和解决方案均来自基础档案', () => {
  const files = ['src/modules/bug/pages/BugListPage.tsx', 'src/modules/bug/pages/BugFormPage.tsx', 'src/modules/bug/pages/BugDetailPage.tsx'];
  const source = files.map(read).join('\n');
  assert.match(source, /getArchiveOptionsByTypeName\('Bug类型'\)/);
  assert.match(source, /getArchiveOptionsByTypeName\('Bug解决方案'\)/);
  assert.doesNotMatch(source, /\{\s*label:\s*'功能'[\s\S]*label:\s*'界面'/);
});

test('BUG 标题和富文本描述依次独占整行', () => {
  const source = read('src/modules/bug/pages/BugFormPage.tsx');
  const title = source.indexOf('name="title"');
  const description = source.indexOf('name="description"');
  const sourceType = source.indexOf('name="sourceType"');
  assert.ok(title >= 0 && description > title && sourceType > description);
  assert.match(source, /name="title"[\s\S]*?is-full/);
  assert.match(source, /AdminProFormRichDescription name="description"[\s\S]*?is-full/);
  assert.match(source, /TemplateFormSection title="处理信息"[\s\S]*?label="指派给"/);
});

test('BUG 列表提供真实计数、批量操作和完整列', () => {
  const source = read('src/modules/bug/pages/BugListPage.tsx');
  const batchSource = source + read('src/modules/bug/pages/useBugBatchActions.tsx');
  assert.match(source, /mode="batch"/);
  assert.match(source, /showCounts/);
  assert.match(batchSource, /批量指派/);
  assert.match(batchSource, /批量状态变更/);
  assert.match(batchSource, /批量删除/);
  for (const label of ['Bug标题', '关联对象', '指派给', 'Bug类型', '严重程度', '状态', '创建人', '创建时间']) assert.match(source, new RegExp(label));
});

test('BUG 详情包含状态区、处理信息、变更历史和上下条', () => {
  const source = read('src/modules/bug/pages/BugDetailPage.tsx');
  assert.match(source, /statusSection/);
  assert.match(source, /statusAction/);
  assert.match(source, /TemplateDetailSection title="处理信息"/);
  assert.match(source, /HistoryTimelineSection/);
  assert.match(source, /DetailNeighborNav/);
  assert.match(source, /修复时间/);
  assert.match(source, /关闭时间/);
  const resolution = source.indexOf("label: '解决方案'");
  const closed = source.indexOf("label: '关闭时间'");
  assert.ok(resolution >= 0 && closed > resolution);
  assert.match(source, /label: '激活原因', value: row\.activationReason \|\| '-', wide: true/);
  assert.doesNotMatch(source, /row\.status === 3[\s\S]*label: '激活原因'/);
  assert.match(source, /wide:\s*true/);
});

test('BUG 页面用户可见命名统一使用时间', () => {
  for (const file of ['src/modules/bug/pages/BugListPage.tsx', 'src/modules/bug/pages/BugFormPage.tsx', 'src/modules/bug/pages/BugDetailPage.tsx']) assert.doesNotMatch(read(file), /日期/);
});

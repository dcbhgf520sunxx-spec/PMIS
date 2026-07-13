import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('AI 页面规则明确操作列、状态动作和详情状态位置', () => {
  const rules = read('../../docs/ai-development-rules.md');
  assert.match(rules, /DeleteConfirmAction/);
  assert.match(rules, /StatusChangeAction/);
  assert.match(rules, /statusSection\.items/);
  assert.match(rules, /不得另传 `titleTags`/);
  assert.match(rules, /statusAction/);
  assert.doesNotMatch(rules, /删除、停用等危险动作使用 `ConfirmAction`/);
});

test('AI 交付链路要求语义审计和浏览器检查', () => {
  const flow = read('../../docs/ai-delivery-flow.md');
  const template = read('../../docs/ai-delivery-template.md');
  assert.match(flow, /JSX 语义审计/);
  assert.match(flow, /标题与右侧非空状态项的数量、顺序和内容一致/);
  assert.match(flow, /空值、空字符串和 `-` 不显示标题标签/);
  assert.match(template, /操作列文字动作/);
  assert.match(template, /状态操作位置/);
});

test('开发规则明确分类色由业务集中映射且同一维度不得重复', () => {
  const rules = read('../../docs/ai-development-rules.md');
  const flow = read('../../docs/ai-delivery-flow.md');
  const template = read('../../docs/ai-delivery-template.md');
  const workbench = read('../src/modules/design-system/pages/DesignSystemPage.tsx');
  assert.match(rules, /CategoryTag/);
  assert.match(rules, /defineCategoryToneMap/);
  assert.match(rules, /同一分类维度.*不得.*相同/);
  assert.match(flow, /分类标签.*集中映射/);
  assert.match(template, /分类色映射.*不重复/);
  assert.match(workbench, /业务定义分类含义和色调映射/);
  assert.match(workbench, /<CategoryTag\s+tone=/);
});

test('开发规则要求变更历史在进入组件前完成中文转译', () => {
  const rules = read('../../docs/ai-development-rules.md');
  const flow = read('../../docs/ai-delivery-flow.md');
  const template = read('../../docs/ai-delivery-template.md');
  const workbench = read('../src/modules/design-system/pages/DesignSystemPage.tsx');
  assert.match(rules, /变更历史.*中文字段名.*业务展示值/);
  assert.match(flow, /变更历史转译/);
  assert.match(template, /变更历史中文化/);
  assert.match(workbench, /字段名和值必须是最终中文展示文本/);
});

test('统一门禁包含新增的语义约束测试', () => {
  const gate = read('../../scripts/verify-change.mjs');
  assert.match(gate, /readdirSync/);
  assert.match(gate, /frontendTests/);
  assert.match(gate, /audit:api-contracts/);
});

test('AI 交付链路要求功能能力和防绕过门禁一次性交付', () => {
  const flow = read('../../docs/ai-delivery-flow.md');
  assert.match(flow, /能力实现和防绕过门禁必须一次性交付/);
  assert.match(flow, /业务接入层/);
});

test('AI 链路要求完整地址菜单权限和状态组件溯源', () => {
  const rules = read('../../docs/ai-development-rules.md');
  const agents = read('../../AGENTS.md');
  assert.match(rules, /完整地址/);
  assert.match(rules, /查询参数/);
  assert.match(rules, /业务状态组件.*公共 `StatusChangeAction`/);
  assert.match(agents, /组件工作台.*独立授权/);
});

test('列表规则明确列宽、固定列、横向滚动和排序契约', () => {
  const rules = read('../../docs/ai-development-rules.md');
  const template = read('../../docs/ai-delivery-template.md');
  assert.match(rules, /数值型 `width`/);
  assert.match(rules, /fixed: 'left'/);
  assert.match(rules, /序号列和紧随其后的第一业务列/);
  assert.match(rules, /fixed: 'right'/);
  assert.match(rules, /scroll\.x/);
  assert.match(rules, /sorter: true/);
  assert.match(template, /左右固定列/);
  assert.match(template, /列宽拖拽/);
  assert.match(template, /列头排序/);
});

test('列表规则要求创建人和创建时间固定为末尾业务列', () => {
  const rules = read('../../docs/ai-development-rules.md');
  const template = read('../../docs/ai-delivery-template.md');
  assert.match(rules, /最后两个业务列.*创建人.*创建时间/);
  assert.match(rules, /访问日志.*例外/);
  assert.match(template, /创建人.*创建时间.*操作列之前/);
});

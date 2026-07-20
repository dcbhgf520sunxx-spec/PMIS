import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const agentsSource = read('../AGENTS.md');
const deliveryFlowSource = read('../docs/ai-delivery-flow.md');
const developmentRulesSource = read('../docs/ai-development-rules.md');

test('AI 判断底座缺少能力前必须完成多入口检索', () => {
  assert.match(agentsSource, /判断底座没有某项能力[\s\S]*组件入口[\s\S]*组件工作台[\s\S]*实际行为/);
  assert.match(deliveryFlowSource, /能力检索[\s\S]*用户说法[\s\S]*组件入口[\s\S]*工作台示例[\s\S]*实际行为/);
  assert.match(deliveryFlowSource, /不得只按[“"]?单一关键词/);
});

test('用户口中的详情页 Tab 明确映射到底座分类导航', () => {
  assert.match(developmentRulesSource, /详情页 Tab/);
  assert.match(developmentRulesSource, /顶部页签/);
  assert.match(developmentRulesSource, /TemplateDetailPage\.sectionNavigation/);
  assert.match(developmentRulesSource, /sectionKey/);
  assert.match(developmentRulesSource, /点击[\s\S]*定位[\s\S]*不是[\s\S]*切换或隐藏内容/);
  assert.match(developmentRulesSource, /DetailTemplateDemo\.tsx/);
});

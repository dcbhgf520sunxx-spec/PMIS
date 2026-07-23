import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const agentsSource = read('../AGENTS.md');
const deliveryFlowSource = read('../docs/ai-delivery-flow.md');
const developmentRulesSource = read('../docs/ai-development-rules.md');
const baseSectionSource = read('src/modules/design-system/pages/sections/BaseSection.tsx');
const pageNavigationDemoUrl = new URL('../src/modules/design-system/pages/demos/PageNavigationTabsDemo.tsx', import.meta.url);
const pageNavigationDemoSource = existsSync(pageNavigationDemoUrl) ? readFileSync(pageNavigationDemoUrl, 'utf8') : '';

test('AI 判断底座缺少能力前必须完成多入口检索', () => {
  assert.match(agentsSource, /判断底座没有某项能力[\s\S]*组件入口[\s\S]*组件工作台[\s\S]*实际行为/);
  assert.match(deliveryFlowSource, /能力检索[\s\S]*用户说法[\s\S]*组件入口[\s\S]*工作台示例[\s\S]*实际行为/);
  assert.match(deliveryFlowSource, /不得只按[“"]?单一关键词/);
});

test('新功能开工前必须向用户展示组件支撑情况', () => {
  assert.match(agentsSource, /新功能[\s\S]*开始实现前[\s\S]*组件支撑情况/);
  assert.match(deliveryFlowSource, /组件支撑情况[\s\S]*功能需要[\s\S]*支持结论[\s\S]*组件或页面样板[\s\S]*处理方式/);
  assert.match(deliveryFlowSource, /没有输出[\s\S]*不得开始实现/);
  assert.match(developmentRulesSource, /全部支持[\s\S]*部分支持[\s\S]*暂不支持[\s\S]*不涉及前端组件/);
});

test('部分支持或暂不支持时必须给出组件沉淀建议结论', () => {
  for (const source of [agentsSource, deliveryFlowSource, developmentRulesSource]) {
    assert.match(source, /部分支持[\s\S]*暂不支持[\s\S]*建议结论/);
    assert.match(source, /业务内最小处理[\s\S]*扩展现有底座组件[\s\S]*新增底座组件/);
  }
  assert.match(deliveryFlowSource, /复用范围[\s\S]*职责边界[\s\S]*影响范围/);
  assert.match(deliveryFlowSource, /先完善底座[\s\S]*组件工作台[\s\S]*测试[\s\S]*业务页面/);
});

test('低频和业务特有能力允许由业务系统自行开发', () => {
  for (const source of [agentsSource, deliveryFlowSource, developmentRulesSource]) {
    assert.match(source, /低频[\s\S]*一次性[\s\S]*业务特有/);
    assert.match(source, /允许业务系统自行开发/);
  }
  assert.match(deliveryFlowSource, /门禁[\s\S]*只检查[\s\S]*分析[\s\S]*建议结论/);
  assert.match(deliveryFlowSource, /不因选择[“"]?业务内最小处理[”"]?而阻断/);
});

test('用户口中的分类导航明确区分同页定位和页面切换', () => {
  assert.match(developmentRulesSource, /详情页 Tab/);
  assert.match(developmentRulesSource, /顶部页签/);
  assert.match(developmentRulesSource, /TemplateDetailPage\.sectionNavigation/);
  assert.match(developmentRulesSource, /sectionKey/);
  assert.match(developmentRulesSource, /点击[\s\S]*定位[\s\S]*不是[\s\S]*切换或隐藏内容/);
  assert.match(developmentRulesSource, /DetailTemplateDemo\.tsx/);
  assert.match(developmentRulesSource, /页面切换 Tab/);
  assert.match(developmentRulesSource, /DetailSectionNavigation/);
  assert.match(developmentRulesSource, /onChange[\s\S]*navigate/);
  assert.match(developmentRulesSource, /切换到不同页面或路由/);
  assert.match(developmentRulesSource, /BaseSection\.tsx/);
  assert.match(developmentRulesSource, /同一页面内定位[\s\S]*切换页面或路由/);
});

test('组件工作台提供真实的页面分类切换示例', () => {
  assert.match(baseSectionSource, /PageNavigationTabsDemo/);
  assert.match(pageNavigationDemoSource, /DetailSectionNavigation/);
  assert.doesNotMatch(pageNavigationDemoSource, /ViewTabs/);
  assert.match(pageNavigationDemoSource, /useLocation/);
  assert.match(pageNavigationDemoSource, /useNavigate/);
  assert.match(pageNavigationDemoSource, /navigationDemo/);
  assert.match(pageNavigationDemoSource, /navigate\(/);
  assert.match(pageNavigationDemoSource, /项目概览页/);
  assert.match(pageNavigationDemoSource, /合同信息页/);
  assert.match(pageNavigationDemoSource, /当前地址/);
});

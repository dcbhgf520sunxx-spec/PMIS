import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const templateSource = read('src/components/admin/TemplateDetailPage/index.tsx');
const templateStyles = read('src/components/admin/TemplateDetailPage/index.css');
const demoSource = read('src/modules/design-system/pages/demos/DetailTemplateDemo.tsx');
const rulesSource = read('../docs/ai-development-rules.md');

test('详情模板提供可选的顶部分类导航契约', () => {
  assert.match(templateSource, /sectionNavigation\?: boolean/);
  assert.match(templateSource, /sectionKey\?: string/);
  assert.doesNotMatch(templateSource, /IntersectionObserver/);
  assert.match(templateSource, /syncActiveSection/);
  assert.match(templateSource, /navigationTargetRef/);
  assert.match(templateSource, /requestAnimationFrame/);
  assert.match(templateSource, /querySelectorAll<HTMLElement>\('\[data-detail-section-key\]'\)/);
  assert.match(templateSource, /scrollContainerRef\.current\?\.scrollTo/);
  assert.doesNotMatch(templateSource, /scrollIntoView/);
  assert.match(templateSource, /scrollHeight - root\.scrollTop - root\.clientHeight/);
  assert.match(templateSource, /behavior: 'auto'/);
  assert.doesNotMatch(templateSource, /behavior: 'smooth'/);
  assert.match(templateSource, /admin-template-detail-page__section-navigation/);
});

test('详情分类导航在窄屏切换为下拉定位', () => {
  assert.match(templateSource, /AdminSelect/);
  assert.match(templateStyles, /admin-template-detail-page__section-select/);
  assert.match(templateStyles, /@media \(max-width: 760px\)/);
});

test('组件工作台提供长详情分类定位示例', () => {
  assert.match(demoSource, /sectionNavigation/);
  const sectionKeys = demoSource.match(/sectionKey=/g) || [];
  assert.ok(sectionKeys.length >= 6, `expected at least 6 sections, received ${sectionKeys.length}`);
});

test('组件工作台统一使用变更历史和标准时间线', () => {
  assert.match(demoSource, /HistoryTimeline/);
  assert.match(demoSource, /title="变更历史" sectionKey="history"/);
  assert.doesNotMatch(demoSource, /title="操作记录"/);
});

test('开发规则要求长详情优先使用模板分类导航', () => {
  assert.match(rulesSource, /长详情页.*顶部分类导航/);
});

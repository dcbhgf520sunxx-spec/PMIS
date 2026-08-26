import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const followUpSection = read('src/modules/follow-up/FollowUpRecordSection.tsx');
const followUpAction = read('src/modules/follow-up/FollowUpRecordAction.tsx');
const activityTimeline = read('src/components/admin/ActivityTimeline/index.tsx');
const activityTimelineStyles = read('src/components/admin/ActivityTimeline/index.css');
const historyTimelineStyles = read('src/components/admin/HistoryTimeline/index.css');
const componentExports = read('src/components/admin/index.ts');
const workbench = read('src/modules/design-system/pages/sections/DisplaySection.tsx');
const projectList = read('src/modules/project/pages/ProjectListPage.tsx');
const requirementList = read('src/modules/requirement/pages/RequirementListPage.tsx');
const taskList = read('src/modules/task/pages/TaskListPage.tsx');

test('跟进记录使用始终展开的公共活动时间线', () => {
  assert.match(followUpSection, /<ActivityTimeline/);
  assert.doesNotMatch(followUpSection, /<article/);
  assert.match(activityTimeline, /<Timeline/);
  assert.match(activityTimeline, /item\.description/);
  assert.match(activityTimeline, /item\.extra/);
  assert.doesNotMatch(activityTimeline, /ExpandToggleButton|expandedKeys|useState/);
});

test('活动时间线从公共组件入口导出并在组件工作台提供示例', () => {
  assert.match(componentExports, /export \* from '\.\/ActivityTimeline'/);
  assert.match(workbench, /ComponentEntry name="ActivityTimeline"/);
  assert.match(workbench, /<ActivityTimeline/);
});

test('跟进区把新增操作放在标题后并使用统一编辑删除图标', () => {
  assert.match(followUpSection, /inlineExtraPlacement="after-title"/);
  assert.match(followUpSection, /inlineExtra=\{<FollowUpRecordAction target=\{target\} onSaved=\{onChanged\} \/>\}/);
  assert.doesNotMatch(followUpSection, /extra=\{<FollowUpRecordAction/);
  assert.match(followUpSection, /<FollowUpRecordAction target=\{target\} record=\{record\} variant="icon"/);
  assert.match(followUpSection, /<AdminDeleteIconAction/);
  assert.match(followUpAction, /variant\?: 'button' \| 'text' \| 'icon'/);
  assert.match(followUpAction, /<AdminEditIconAction/);
  assert.match(followUpAction, /title=\{record \? '编辑跟进记录' : '新增跟进记录'\}/);
  assert.match(followUpSection, /title="删除跟进记录"/);
});

test('活动时间线沿用变更历史间距且仅在当前记录悬浮或聚焦时显示操作', () => {
  const historyPadding = historyTimelineStyles.match(/\.admin-history-timeline \.ant-timeline-item \{\s*padding-bottom: ([^;]+);/s)?.[1];
  const activityPadding = activityTimelineStyles.match(/\.admin-activity-timeline \.ant-timeline-item \{\s*padding-bottom: ([^;]+);/s)?.[1];
  assert.equal(activityPadding, historyPadding);
  assert.doesNotMatch(activityTimelineStyles, /ant-timeline-item-tail/);
  assert.match(activityTimelineStyles, /\.admin-activity-timeline__extra \{[\s\S]*opacity: 0;/);
  assert.match(activityTimelineStyles, /\.admin-activity-timeline__item:hover \.admin-activity-timeline__extra/);
  assert.match(activityTimelineStyles, /\.admin-activity-timeline__item:focus-within \.admin-activity-timeline__extra/);
  assert.match(activityTimelineStyles, /@media \(hover: none\)/);
});

test('活动时间线操作区紧跟记录日期而不是靠到行尾', () => {
  const headerRule = activityTimelineStyles.match(/\.admin-activity-timeline__header \{([\s\S]*?)\}/)?.[1] || '';
  assert.match(headerRule, /justify-content: flex-start;/);
  assert.doesNotMatch(headerRule, /justify-content: space-between;/);
});

test('列表跟进记录操作位于复制前且项目中位于调整优先级后', () => {
  assert.ok(requirementList.includes('>跟进记录</AdminTextAction><AdminTextAction onClick={() => navigate(`/requirements/${row.id}/copy`)}>复制</AdminTextAction>'));
  assert.ok(taskList.includes('>跟进记录</AdminTextAction><AdminTextAction onClick={() => navigate(`/tasks/${row.id}/copy`)}>复制</AdminTextAction>'));
  const projectActions = projectList.slice(projectList.indexOf("{ title: '操作'"), projectList.indexOf('</OperationColumnActions>'));
  const priority = projectActions.indexOf('PriorityChangeAction');
  const followUp = projectActions.indexOf('>跟进记录<');
  const remove = projectActions.indexOf('>删除<');
  assert.ok(priority >= 0 && followUp > priority && remove > followUp);
});

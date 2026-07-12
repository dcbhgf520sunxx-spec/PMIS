import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('详情模板由右侧状态项自动生成完整标题标签', () => {
  const source = read('src/components/admin/TemplateDetailPage/index.tsx');
  assert.match(source, /titleCode\?: ReactNode/);
  assert.match(source, /statusAction\?: ReactNode/);
  assert.match(source, /visibleStatusTitleItems/);
  assert.match(source, /titleExtra=\{resolvedTitleTags\}/);
  assert.match(source, /admin-template-detail-page__status-list/);
  assert.doesNotMatch(source, /titleTags\?: ReactNode/);
  assert.match(source, /admin-template-detail-page__status-action/);
  assert.doesNotMatch(source, /titleExtra\?: ReactNode/);
});

for (const [name, path] of [
  ['用户详情', 'src/modules/user/pages/UserDetailPage.tsx'],
  ['工单详情', 'src/modules/work-order/pages/WorkOrderDetailPage.tsx'],
  ['工单详情样板', 'src/modules/work-order-template/pages/WorkOrderTemplateDetailPage.tsx']
]) {
  test(`${name} 使用模板固定的标题标签和状态操作位置`, () => {
    const source = read(path);
    assert.doesNotMatch(source, /titleTags=\{/);
    assert.match(source, /statusSection=\{/);
    assert.match(source, /statusAction=\{/);
    assert.doesNotMatch(source, /titleExtra=\{/);
    assert.doesNotMatch(source, /work-order-detail-page__side-actions/);
  });
}

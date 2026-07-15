import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

for (const [name, path] of [
  ['产品详情', 'src/modules/product/pages/ProductDetailPage.tsx'],
  ['项目详情', 'src/modules/project/pages/ProjectDetailPage.tsx'],
]) {
  test(`${name}使用统一的变更历史分组`, () => {
    const source = read(path);
    assert.match(source, /<HistoryTimelineSection\s+items=\{history\}\s*\/>/);
    assert.doesNotMatch(source, /<TemplateDetailSection\s+title="变更历史"><HistoryTimeline/);
  });
}

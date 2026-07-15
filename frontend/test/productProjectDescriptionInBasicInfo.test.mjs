import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const [name, path, label] of [
  ['产品详情', 'src/modules/product/pages/ProductDetailPage.tsx', '产品描述'],
  ['项目详情', 'src/modules/project/pages/ProjectDetailPage.tsx', '项目描述'],
]) {
  test(`${name}把描述作为基本信息中的整行字段`, () => {
    const source = readFileSync(path, 'utf8');
    assert.match(source, new RegExp(`label: '${label}', value: <RichTextViewer[\\s\\S]*wide: true`));
    assert.doesNotMatch(source, new RegExp(`<TemplateDetailSection title="${label}">`));
  });
}

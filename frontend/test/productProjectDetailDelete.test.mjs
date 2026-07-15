import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const [name, path, entity, listPath, apiName] of [
  ['产品详情', 'src/modules/product/pages/ProductDetailPage.tsx', '产品', '/products', 'deleteProduct'],
  ['项目详情', 'src/modules/project/pages/ProjectDetailPage.tsx', '项目', '/projects', 'deleteProject'],
]) {
  test(`${name}使用统一删除确认并在成功后返回列表`, () => {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /<DeleteConfirmAction/);
    assert.match(source, new RegExp(`entityName="${entity}"`));
    assert.match(source, new RegExp(`await ${apiName}\\(row\\.id\\)`));
    assert.match(source, new RegExp(`usePageReturnNavigation\\('${listPath}'\\)`));
    assert.match(source, /returnToSource\(\)/);
  });
}

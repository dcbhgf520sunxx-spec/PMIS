import test from 'node:test';
import assert from 'node:assert/strict';
import { expandedRelationKeys, focusAfterExpansion, relationKey } from '../src/modules/business-ontology/relationExpansion.ts';

const links = [
  { id: 'belongsToProduct', source: 'Requirement', target: 'Product' },
  { id: 'belongsToProduct', source: 'Project', target: 'Product' },
  { id: 'belongsToProduct', source: 'WorkOrder', target: 'Product' }
];
const [first, second] = links.map(relationKey);

test('同名关系的各个起点独立展开，收起一条不影响另一条', () => {
  const params = new URLSearchParams();
  params.append('open', first);
  assert.deepEqual(expandedRelationKeys(params, links), [first]);
  params.append('open', second);
  assert.deepEqual(expandedRelationKeys(params, links), [first, second]);
  params.delete('open', first);
  assert.deepEqual(expandedRelationKeys(params, links), [second]);
  params.delete('open');
  assert.deepEqual(expandedRelationKeys(params, links), []);
});

test('全部展开、全部收起及刷新恢复', () => {
  const params = new URLSearchParams();
  links.forEach(link => params.append('open', relationKey(link)));
  assert.deepEqual(expandedRelationKeys(new URLSearchParams(params.toString()), links), links.map(relationKey));
  params.delete('open');
  assert.deepEqual(expandedRelationKeys(params, links), []);
});

test('对象切换后忽略不属于当前对象的展开项', () => {
  const params = new URLSearchParams({ open: first });
  assert.deepEqual(expandedRelationKeys(params, [links[1]]), []);
});

test('兼容旧关系链接，具体连线定位不展开同名关系', () => {
  assert.deepEqual(expandedRelationKeys(new URLSearchParams({ relation: 'belongsToProduct' }), links), links.map(relationKey));
  assert.deepEqual(expandedRelationKeys(new URLSearchParams({ open: second }), links), [second]);
});

test('同名关系仅高亮新选中连线，关闭当前项清除选中，不影响其他展开项', () => {
  assert.equal(focusAfterExpansion([], [first], ''), first);
  assert.equal(focusAfterExpansion([first], [first, second], first), second);
  assert.equal(focusAfterExpansion([first, second], [second], second), second);
  assert.equal(focusAfterExpansion([first, second], [first], second), '');
  assert.equal(focusAfterExpansion([first], [], first), '');
});

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const hookPath = new URL('../src/components/admin/TemplateListPage/useTemplateServerListData.ts', import.meta.url);
const rulesPath = new URL('../../docs/ai-development-rules.md', import.meta.url);
const deliveryPath = new URL('../../docs/ai-delivery-flow.md', import.meta.url);

test('统一服务端列表能力隔离旧查询数据并只展示当前查询结果', () => {
  assert.equal(existsSync(hookPath), true, '缺少 useTemplateServerListData 底座能力');
  const source = readFileSync(hookPath, 'utf8');

  assert.match(source, /useQuery/);
  assert.match(source, /queryKey:\s*serverQueryKey/);
  assert.match(source, /const rows = query\.data\?\.list\s*\?\?\s*\[\]/);
  assert.match(source, /const total = query\.data\?\.total\s*\?\?\s*0/);
  assert.doesNotMatch(source, /placeholderData/);
});

test('统一服务端列表能力将查询上下文、分页和排序组成同一个请求标识', () => {
  const source = readFileSync(hookPath, 'utf8');

  assert.match(source, /queryKey,/);
  assert.match(source, /listData\.currentPage/);
  assert.match(source, /listData\.pageSize/);
  assert.match(source, /listData\.sortState\.field/);
  assert.match(source, /listData\.sortState\.order/);
  assert.match(source, /pendingQueryContextRef/);
  assert.match(source, /requestPage = (?:queryContextChanged \|\| )?pendingQueryReset \? 1 : listData\.currentPage/);
});

test('列表规则要求服务端分页统一接入异步列表能力', () => {
  const source = readFileSync(rulesPath, 'utf8');

  assert.match(source, /useTemplateServerListData/);
  assert.match(source, /旧数据/);
  assert.match(source, /请求乱序/);
  assert.match(source, /原子/);
});

test('交付冒烟要求快速切换视图时不展示旧数据', () => {
  const source = readFileSync(deliveryPath, 'utf8');

  assert.match(source, /快速切换/);
  assert.match(source, /旧数据/);
  assert.match(source, /最新请求/);
});

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditListSorting } from '../scripts/audit-list-sorting.mjs';

const contract = { 'demo/pages/DemoListPage.tsx': { request: 'getList', backend: 'controllers/demo.js', map: 'sortMap', api: 'demoApi.ts', convert: 'toSortField' } };
test('本项目每个业务列表通过逐列接入审计', () => {
  assert.deepEqual(auditListSorting({ rootDir: fileURLToPath(new URL('../..', import.meta.url)) }), []);
});
function fixture(t, { page, api, backend } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'list-sorting-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries({
    'frontend/src/modules/demo/pages/DemoListPage.tsx': page ?? `const columns = [{dataIndex:'name',sorter:true,sortOrder:sortState.field==='name'?sortState.order:null}]; useTemplateServerListData({request:({sortField,sortOrder})=>getList({sortField,sortOrder})});`,
    'frontend/src/api/demoApi.ts': api ?? `function toSortField(field) {const sortMap={name:'display_name'};return sortMap[field]||field;} request({sort_field:toSortField(params.sortField)});`,
    'backend/src/controllers/demo.js': backend ?? `const sortMap={display_name:'d.name'};`
  })) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

test('完整的前端列、API 转换和后端白名单允许通过', t => {
  assert.deepEqual(auditListSorting({ rootDir: fixture(t), contracts: contract }), []);
});
test('服务端列表必须声明可核查的跨层契约', t => {
  assert.match(auditListSorting({ rootDir: fixture(t), contracts: {} }).join('\n'), /排序契约/);
});
test('新增排序列漏后端映射时阻断，不能静默回退', t => {
  assert.match(auditListSorting({ rootDir: fixture(t, { backend: 'const sortMap={created_at:"d.created_at"};' }), contracts: contract }).join('\n'), /name.*display_name/);
});
test('表头箭头绑定了另一个字段时阻断', t => {
  const page = `const columns=[{dataIndex:'name',sorter:true,sortOrder:sortState.field==='createdAt'?sortState.order:null}];useTemplateServerListData({});`;
  assert.match(auditListSorting({ rootDir: fixture(t, { page }), contracts: contract }).join('\n'), /name.*sortOrder/);
});
test('本地列表必须为每个箭头配置比较器', t => {
  const page = `const columns=[{dataIndex:'name',sorter:true,sortOrder:sortState.field==='name'?sortState.order:null}];useTemplateListPageData({rows:[],sorters:createListSorters({createdAt:listSorters.date(r=>r.createdAt)})});`;
  assert.match(auditListSorting({ rootDir: fixture(t, { page }), contracts: {} }).join('\n'), /name.*比较器/);
});
test('API 留下转换函数但不调用时阻断', t => {
  const api = `function toSortField(field){const sortMap={name:'display_name'};return sortMap[field]||field;} request({sort_field:params.sortField});`;
  assert.match(auditListSorting({ rootDir: fixture(t, { api }), contracts: contract }).join('\n'), /sort_field.*未使用转换函数/);
});
test('转换函数被其他表达式调用，sort_field 却直接传原字段时仍阻断', t => {
  const api = `function toSortField(field){const sortMap={name:'display_name'};return sortMap[field]||field;} log(toSortField(params.sortField));request({sort_field:params.sortField});`;
  assert.match(auditListSorting({ rootDir: fixture(t, { api }), contracts: contract }).join('\n'), /sort_field.*未使用转换函数/);
});
test('服务端 Hook 丢弃排序参数或把排序参数交给无关函数时阻断', t => {
  for (const request of ['()=>getList({})', '({sortField,sortOrder})=>{log({sortField,sortOrder});return getList({})}']) {
    const page = `const columns=[{dataIndex:'name',sorter:true,sortOrder:sortState.field==='name'?sortState.order:null}];useTemplateServerListData({request:${request}});`;
    assert.match(auditListSorting({ rootDir: fixture(t, { page }), contracts: contract }).join('\n'), /request.*sortField\/sortOrder/);
  }
});
test('拆到 ts 数据 Hook 的服务端列表同样接受契约检查', t => {
  const root = fixture(t, { page: `const columns=[{dataIndex:'name',sorter:true,sortOrder:sortState.field==='name'?sortState.order:null}];` });
  writeFileSync(join(root, 'frontend/src/modules/demo/pages/useRows.ts'), 'useTemplateServerListData({});');
  assert.match(auditListSorting({ rootDir: root, contracts: contract }).join('\n'), /useRows.ts.*排序契约/);
});

test('业务 API 直接转发后端字段时允许显式声明透传契约', t => {
  const page = `const columns=[{dataIndex:'name',sorter:true,sortOrder:sortState.field==='name'?sortState.order:null}];useTemplateServerListData({request:({sortField,sortOrder})=>getList({sort_field:sortField,sort_order:sortOrder})});`;
  const api = `export function getList(params={}){return request.get('/demo',{params});}`;
  const backend = `const sortMap={name:'d.name'};`;
  const contracts = { 'demo/pages/DemoListPage.tsx': { request: 'getList', api: 'demoApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/demo.js', map: 'sortMap' } };
  assert.deepEqual(auditListSorting({ rootDir: fixture(t, { page, api, backend }), contracts }), []);
  const broken = `export function getList(params={}){return request.get('/demo',{params:{page:params.page}});}`;
  assert.match(auditListSorting({ rootDir: fixture(t, { page, api: broken, backend }), contracts }).join('\n'), /API.*透传/);
});

test('同字段排序状态辅助函数允许复用，传错字段仍阻断', t => {
  for (const field of ['name', 'createdAt']) {
    const page = `const sortOrder=(field)=>sortState.field===field?sortState.order:null;const columns=[{dataIndex:'name',sorter:true,sortOrder:sortOrder('${field}')}];useTemplateServerListData({request:({sortField,sortOrder})=>getList({sortField,sortOrder})});`;
    const errors = auditListSorting({ rootDir: fixture(t, { page }), contracts: contract });
    if (field === 'name') assert.deepEqual(errors, []);
    else assert.match(errors.join('\n'), /name.*sortOrder/);
  }
});

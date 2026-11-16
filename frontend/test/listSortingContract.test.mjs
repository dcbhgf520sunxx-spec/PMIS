import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createListSorters, listSorters } from '../src/components/admin/listHelpers.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const parse = file => ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
function find(source, predicate) {
  const matches = [];
  function walk(node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, walk); }
  walk(source);
  return matches;
}
const properties = node => new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText().replace(/['"]/g, ''), property.initializer]));
function columns(source) {
  return find(source, ts.isObjectLiteralExpression).map(properties).filter(props => props.has('sorter') && props.has('dataIndex')).map(props => props.get('dataIndex').text);
}
function variable(source, name) {
  return find(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === name)[0]?.initializer;
}
function convertField(file, name) {
  if (!file) return field => field;
  const source = parse(file);
  const fn = find(source, node => ts.isFunctionDeclaration(node) && node.name?.text === name)[0];
  const code = ts.transpileModule(fn.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return vm.runInNewContext(`${code};${name}`, { exports: {} });
}

// 从真实页面与 API 转换函数读取字段，新增可排序列必须同步接通后端。
for (const [page, controller, mapName, api, convert] of [
  ['task/pages/TaskListPage.tsx', 'controllers/taskController.js', 'sortMap'],
  ['requirement/pages/RequirementListPage.tsx', 'controllers/requirementController.js', 'map'],
  ['project/pages/ProjectListPage.tsx', 'controllers/projectController.js', 'sortMap'],
  ['product/pages/ProductListPage.tsx', 'controllers/productController.js', 'sortMap'],
  ['bug/pages/BugListPage.tsx', 'controllers/bugController.js', 'sortMap'],
  ['user/pages/UserListPage.tsx', 'controllers/userController.js', 'sortMap', 'userApi.ts', 'toUserSortField'],
  ['role/pages/RoleListPage.tsx', 'controllers/roleController.js', 'sortMap', 'roleApi.ts', 'toRoleSortField'],
  ['work-order/pages/WorkOrderListColumns.tsx', 'controllers/workOrderController.js', 'WORK_ORDER_SORT_MAP', 'workOrderQueryParams.ts', 'toWorkOrderSortField'],
  ['access-log/pages/AccessLogListPage.tsx', 'services/accessLogService.js', 'sortMap', 'accessLogApi.ts', 'toAccessLogSortField'],
  ['integration/pages/OpenClientRequestsPage.tsx', 'services/openClientAdminService.js', 'sorts'],
]) {
  test(`${page} 的每个可排序列均接通后端白名单`, () => {
    const fields = columns(parse(`frontend/src/modules/${page}`));
    assert.ok(fields.length > 0);
    const supported = properties(variable(parse(`backend/src/${controller}`), mapName));
    const toBackend = convertField(api && `frontend/src/api/${api}`, convert);
    for (const field of fields) assert.ok(supported.has(toBackend(field)), `${field} 未接通，不能静默回退默认排序`);
  });
}

for (const page of ['model-center/pages/ModelConnectionListPage.tsx', 'integration/pages/OpenClientListPage.tsx']) {
  test(`${page} 每列均使用实际比较器，包含数值、日期和空值`, () => {
    const source = parse(`frontend/src/modules/${page}`);
    const call = find(source, node => ts.isCallExpression(node) && node.expression.getText(source) === 'useTemplateListPageData')[0];
    let expression = properties(call.arguments[0]).get('sorters');
    assert.ok(expression, '本地列表必须传入排序规则，不能只显示箭头');
    if (ts.isIdentifier(expression)) expression = variable(source, expression.text);
    const code = ts.transpileModule(`const sorters = ${expression.getText(source)}; sorters;`, {}).outputText;
    const sorters = vm.runInNewContext(code, { createListSorters, listSorters });
    for (const field of columns(source)) {
      assert.equal(typeof sorters[field], 'function', field);
      const [low, high] = /At$/.test(field) ? ['2026-01-01', '2026-11-01'] : ['enabled', 'isDefault'].includes(field) ? [0, 1] : ['Alpha', 'Zulu'];
      assert.ok(sorters[field]({ [field]: low }, { [field]: high }) < 0, `${field} 升序`);
      assert.ok(sorters[field]({ [field]: high }, { [field]: low }) > 0, `${field} 降序`);
      assert.ok(Number.isFinite(sorters[field]({ [field]: '' }, { [field]: '' })), `${field} 空值`);
    }
    if (sorters.expiresAt) assert.ok(sorters.expiresAt({ expiresAt: '2026-12-01' }, { expiresAt: null }) < 0, '长期有效排在具体截止日期之后');
  });
}

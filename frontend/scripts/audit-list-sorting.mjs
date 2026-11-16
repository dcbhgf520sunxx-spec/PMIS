import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// 各项目维护自己的服务端列表接入关系；字段从真实页面、API 和查询白名单读取。
export const listSortingContracts = {
  'archive/pages/ArchivePage.tsx': { columns: 'archive/components/ArchiveRecordTable.tsx', rowOrderOnly: true },
  'user/pages/UserListPage.tsx': { request: 'getUserList', api: 'userApi.ts', convert: 'toUserSortField', backend: 'controllers/userController.js', map: 'sortMap' },
  'role/pages/RoleListPage.tsx': { request: 'getRoleList', api: 'roleApi.ts', convert: 'toRoleSortField', backend: 'controllers/roleController.js', map: 'sortMap' },
  'work-order/pages/useWorkOrderListData.ts': { columns: 'work-order/pages/WorkOrderListColumns.tsx', request: 'getWorkOrderList', api: 'workOrderQueryParams.ts', convert: 'toWorkOrderSortField', backend: 'controllers/workOrderController.js', map: 'WORK_ORDER_SORT_MAP' },
  'access-log/pages/AccessLogListPage.tsx': { request: 'getAccessLogList', api: 'accessLogApi.ts', convert: 'toAccessLogSortField', backend: 'services/accessLogService.js', map: 'sortMap' },
  'task/pages/TaskListPage.tsx': { request: 'getTaskList', api: 'taskApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/taskController.js', map: 'sortMap' },
  'bug/pages/BugListPage.tsx': { request: 'getBugList', api: 'bugApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/bugController.js', map: 'sortMap' },
  'product/pages/ProductListPage.tsx': { request: 'getProductList', api: 'productApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/productController.js', map: 'sortMap' },
  'project/pages/ProjectListPage.tsx': { request: 'getProjectList', api: 'projectApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/projectController.js', map: 'sortMap' },
  'requirement/pages/RequirementListPage.tsx': { request: 'getRequirementList', api: 'requirementApi.ts', passthrough: true, requestFields: ['sort_field', 'sort_order'], backend: 'controllers/requirementController.js', map: 'map' },
  'integration/pages/OpenClientRequestsPage.tsx': { request: 'getOpenClientRequests', api: 'openClientApi.ts', passthrough: true, backend: 'services/openClientAdminService.js', map: 'sorts', requestArgument: 1 },
  'integration/pages/IntegrationPage.tsx': { rowOrderOnly: true }
};

function nodes(source, predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return matches;
}

function props(node) {
  return new Map((node?.properties || []).filter(p => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)).map(p => [p.name.text, p.initializer || p.name]));
}

function variable(source, name) {
  return nodes(source, n => ts.isVariableDeclaration(n) && n.name.getText() === name)[0]?.initializer;
}

function object(expression, source) {
  const visited = new Set();
  while (expression && !ts.isObjectLiteralExpression(expression)) {
    if (visited.has(expression)) return undefined;
    visited.add(expression);
    if (ts.isIdentifier(expression)) expression = variable(source, expression.text);
    else if (ts.isCallExpression(expression) && expression.expression.getText() === 'createListSorters') expression = expression.arguments[0];
    else if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) expression = expression.expression;
    else return undefined;
  }
  return expression;
}

function columns(source) {
  return nodes(source, ts.isObjectLiteralExpression).map(props).filter(p => p.has('dataIndex') && p.has('sorter') && p.get('sorter').kind !== ts.SyntaxKind.FalseKeyword);
}

function orderMatches(expression, field, source) {
  let parameter;
  if (expression && ts.isCallExpression(expression)) {
    if (expression.arguments[0]?.text !== field) return false;
    const fn = variable(source, expression.expression.getText());
    parameter = fn?.parameters?.[0]?.name?.text;
    if (!parameter) return false;
    expression = fn;
  }
  return expression && nodes(expression, n => ts.isBinaryExpression(n)
    && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    && n.left.getText().endsWith('.field')
    && (parameter ? n.right.getText() === parameter : n.right.text === field)).length > 0;
}

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(dir, entry.name))
    : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
}

export function auditListSorting({ rootDir, contracts = listSortingContracts }) {
  const errors = [];
  const modulesDir = join(rootDir, 'frontend/src/modules');
  const parse = file => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const file of files(modulesDir)) {
    const page = relative(modulesDir, file).split('\\').join('/');
    if (['auth', 'design-system'].includes(page.split('/')[0])) continue;
    const source = parse(file);
    const hooks = nodes(source, n => ts.isCallExpression(n) && ['useTemplateListPageData', 'useTemplateServerListData'].includes(n.expression.getText()));
    for (const hook of hooks) {
      const server = hook.expression.getText() === 'useTemplateServerListData';
      const contract = contracts[page];
      if (server && !contract) {
        errors.push(`${page}: 服务端列表未声明排序契约，请登记列、API 转换与后端白名单`);
        continue;
      }
      try {
        const columnSource = contract?.columns ? parse(join(modulesDir, contract.columns)) : source;
        const sortableColumns = columns(columnSource);
        if (!sortableColumns.length && !contract?.rowOrderOnly) errors.push(`${page}: 未找到可核查的排序列`);
        let available;
        let aliases = new Map();
        if (server) {
          const request = props(object(hook.arguments[0], source)).get('request');
          const parameter = request?.parameters?.[0]?.name;
          const bindings = new Map((parameter && ts.isObjectBindingPattern(parameter) ? parameter.elements : [])
            .map(e => [e.propertyName?.text || e.name.text, e.name.text]));
          const forwards = request && bindings.has('sortField') && bindings.has('sortOrder')
            && nodes(request, n => ts.isCallExpression(n) && n.expression.getText() === contract.request).some(call => {
              const args = props(call.arguments[contract.requestArgument || 0]);
              return ['sortField', 'sortOrder'].every((field, index) => args.get(contract.requestFields?.[index] || field)?.getText() === bindings.get(field));
            });
          if (!forwards) errors.push(`${page}: request 回调未将 sortField/sortOrder 传入 ${contract.request}`);
          const backend = parse(join(rootDir, 'backend/src', contract.backend));
          available = props(object(variable(backend, contract.map), backend));
          if (!available.size) errors.push(`${page}: 后端排序白名单无法解析`);
          const api = parse(join(rootDir, 'frontend/src/api', contract.api));
          if (contract.passthrough) {
            const fn = nodes(api, n => ts.isFunctionDeclaration(n) && n.name?.text === contract.request)[0];
            const params = fn?.parameters?.[contract.requestArgument || 0]?.name?.getText();
            if (!fn || !params || !nodes(fn, n => ts.isCallExpression(n) && n.expression.getText() === 'request.get'
              && props(n.arguments[1]).get('params')?.getText() === params).length) {
              errors.push(`${page}: API ${contract.request} 未完整透传请求参数`);
            }
          } else {
            const convert = nodes(api, n => ts.isFunctionDeclaration(n) && n.name?.text === contract.convert)[0];
            if (!convert) errors.push(`${page}: API 转换函数 ${contract.convert} 不存在`);
            else aliases = props(object(variable(convert, 'sortMap'), convert));
            if (!nodes(api, n => ts.isPropertyAssignment(n) && n.name.text === 'sort_field'
              && ts.isCallExpression(n.initializer) && n.initializer.expression.getText() === contract.convert).length) {
              errors.push(`${page}: API 的 sort_field 未使用转换函数 ${contract.convert} 的结果`);
            }
          }
        } else {
          const options = props(object(hook.arguments[0], source));
          available = props(object(options.get('sorters'), source));
        }
        for (const column of sortableColumns) {
          const field = column.get('dataIndex').text;
          if (!field) {
            errors.push(`${page}: 排序列 dataIndex 需使用可核查的字段名`);
            continue;
          }
          const order = column.get('sortOrder');
          const matchesField = orderMatches(order, field, source);
          if (!matchesField) errors.push(`${page}: ${field} 的 sortOrder 未绑定同一字段`);
          const mapped = aliases.get(field)?.text || field;
          if (!available.has(mapped)) errors.push(server
            ? `${page}: ${field} → ${mapped} 未接通后端白名单`
            : `${page}: ${field} 缺少实际比较器`);
        }
      } catch (error) {
        errors.push(`${page}: 排序契约无法核查：${error.message}`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = auditListSorting({ rootDir: fileURLToPath(new URL('../..', import.meta.url)) });
  console.log(errors.length ? `排序接入审计失败：\n- ${errors.join('\n- ')}` : '排序接入审计通过：本地比较器、排序状态及服务端逐列映射已核对');
  process.exitCode = errors.length ? 1 : 0;
}

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const rootDir = new URL('..', import.meta.url).pathname;
const modulesDirArgIndex = process.argv.indexOf('--modules-dir');
const modulesDir = modulesDirArgIndex >= 0
  ? process.argv[modulesDirArgIndex + 1]
  : join(rootDir, 'src/modules');
const strict = process.argv.includes('--strict');

const excludedPathParts = [
  'auth',
  'design-system'
];

const blockingRules = [
  { pattern: /<Button(\s|>)/g, reason: '按钮应优先使用 AdminButton / PermissionButton / 操作组件' },
  { pattern: /<Input(\s|>|\.TextArea)/g, reason: '输入框应优先使用 AdminInput / AdminTextArea' },
  { pattern: /<DatePicker(\s|>|\.RangePicker)/g, reason: '日期应优先使用 AdminDatePicker / AdminRangePicker' },
  { pattern: /<Select(\s|>)/g, reason: '下拉应优先使用 AdminSelect' },
  { pattern: /<TreeSelect(\s|>)/g, reason: '树选择应优先使用 AdminTreeSelect' },
  { pattern: /<Tree(\s|>)/g, reason: '树组件应优先使用 AdminTree' },
  { pattern: /<Cascader(\s|>)/g, reason: '级联选择应优先使用 AdminCascader' },
  { pattern: /<Modal(\s|>)/g, reason: '弹窗应优先使用 AdminModal / ConfirmAction' },
  { pattern: /<Popconfirm(\s|>)/g, reason: '气泡确认应优先使用 BubbleConfirmAction' },
  { pattern: /<Drawer(\s|>)/g, reason: '抽屉应优先沉淀为 AdminDrawer / 业务抽屉组件' },
  { pattern: /<Empty(\s|>)/g, reason: '空状态应优先使用 AdminEmptyState / SearchTable locale' },
  { pattern: /<ProFormText(\s|>)/g, reason: '表单文本应优先使用 AdminProFormText' },
  { pattern: /<ProFormTextArea(\s|>)/g, reason: '表单多行文本应优先使用 AdminProFormTextArea' },
  { pattern: /<ProFormDatePicker(\s|>)/g, reason: '表单日期应优先使用 AdminProFormDatePicker' },
  { pattern: /<ProFormSelect(\s|>)/g, reason: '表单下拉应优先使用 AdminProFormSelect' },
  { pattern: /<ProForm\.Item(\s|>)/g, reason: '表单字段应优先使用 AdminProForm 系列组件' },
  { pattern: /<ProTable(\s|>)/g, reason: '表格应优先使用 TemplateListPage / SearchTable' },
  { pattern: /<ProForm(\s|>)/g, reason: '表单容器应优先使用 TemplateFormPage' },
  { pattern: /<ProCard(\s|>)/g, reason: '卡片应优先使用页面样板或 AdminCard' },
  { pattern: /<Dropdown(\s|>)/g, reason: '动作下拉应优先使用 AdminActionDropdown / AdminSearchDropdown' },
  { pattern: /<Typography\.Text(\s|>)/g, reason: '文本状态应优先使用 AdminText' }
];

const warningRules = [];

const listTemplateRules = [
  {
    pattern: /<AdminDrawer(?:(?!<\/AdminDrawer>)[\s\S])*?<TemplateListPage(?:\s|>)/g,
    reason: '抽屉内列表应通过 TemplateDrawerTable 承接抽屉、筛选、表格和分页'
  },
  {
    pattern: /<SearchTable(?:\s|>)/g,
    reason: '业务列表应通过 TemplateListPage / TemplateDrawerTable 承接表格、页脚和分页'
  },
  {
    pattern: /<TablePagination(?:\s|>)/g,
    reason: '业务列表分页应通过 TemplateListPage.pagination 传入'
  }
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    if (!path.endsWith('.tsx')) return [];
    return [path];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collectMatches(files, rules, level) {
  const matches = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      for (const match of source.matchAll(rule.pattern)) {
        matches.push({
          level,
          file: relative(rootDir, file),
          line: lineNumber(source, match.index ?? 0),
          token: match[0].trim(),
          reason: rule.reason
        });
      }
    }
  }

  return matches;
}

function collectPageTemplateViolations(files) {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const pagePath = relative(modulesDir, file);
    const violations = [];

    if (pagePath.endsWith('FormPage.tsx') && !source.includes('<TemplateFormPage')) {
      violations.push({
        level: 'BLOCK',
        file: relative(rootDir, file),
        line: 1,
        token: 'FormPage',
        reason: '新增编辑页必须从 TemplateFormPage 入口接入'
      });
    }
    if (pagePath.endsWith('DetailPage.tsx') && !source.includes('<TemplateDetailPage')) {
      violations.push({
        level: 'BLOCK',
        file: relative(rootDir, file),
        line: 1,
        token: 'DetailPage',
        reason: '详情页必须从 TemplateDetailPage 入口接入'
      });
    }

    return violations;
  });
}

function jsxTagName(node, sourceFile) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(sourceFile);
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText(sourceFile);
  return '';
}

function jsxAttributes(node) {
  if (ts.isJsxElement(node)) return node.openingElement.attributes.properties;
  if (ts.isJsxSelfClosingElement(node)) return node.attributes.properties;
  return [];
}

function attribute(node, name) {
  return jsxAttributes(node).find((item) => ts.isJsxAttribute(item) && item.name.getText() === name);
}

function attributeText(node, name, sourceFile) {
  return attribute(node, name)?.initializer?.getText(sourceFile) || '';
}

function finding(file, sourceFile, node, reason, token = jsxTagName(node, sourceFile)) {
  return {
    level: 'BLOCK',
    file: relative(rootDir, file),
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    token,
    reason
  };
}

function resolveImportedComponentSource(file, sourceFile, componentName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const modulePath = statement.moduleSpecifier.text;
    if (!modulePath.startsWith('.')) continue;
    const namedImports = statement.importClause?.namedBindings;
    if (!namedImports || !ts.isNamedImports(namedImports)) continue;
    const importsComponent = namedImports.elements.some((element) => element.name.text === componentName);
    if (!importsComponent) continue;
    const basePath = resolve(dirname(file), modulePath);
    const candidates = [`${basePath}.tsx`, `${basePath}.ts`, join(basePath, 'index.tsx'), join(basePath, 'index.ts')];
    const componentFile = candidates.find((candidate) => existsSync(candidate));
    return componentFile ? readFileSync(componentFile, 'utf8') : '';
  }
  return '';
}

function collectSemanticViolations(files) {
  const allowedOperationActions = new Set([
    'AdminTextAction',
    'StatusConfirmAction',
    'StatusChangeAction',
    'DeleteConfirmAction',
    'ConfirmAction',
    'AdminActionDropdown'
  ]);
  const textVariantActions = new Set([
    'StatusConfirmAction',
    'StatusChangeAction',
    'DeleteConfirmAction',
    'ConfirmAction'
  ]);

  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations = [];

    const inspectBusinessStatusAction = (node, name) => {
      const isBusinessChangeAction = name !== 'StatusChangeAction' && name.endsWith('StatusChangeAction');
      const isBusinessConfirmAction = name !== 'StatusConfirmAction' && name.endsWith('StatusConfirmAction');
      if (!isBusinessChangeAction && !isBusinessConfirmAction) return;
      const componentSource = resolveImportedComponentSource(file, sourceFile, name);
      const requiredComponent = isBusinessChangeAction ? 'StatusChangeAction' : 'StatusConfirmAction';
      const rendersRequiredComponent = new RegExp(`<${requiredComponent}(?:<|\\s|/|>)`).test(componentSource);
      if (!rendersRequiredComponent) {
        violations.push(finding(file, sourceFile, node, `业务状态动作 ${name} 必须直接调用公共 ${requiredComponent}`));
      }
    };

    const inspectOperationChildren = (container) => {
      const inspect = (node) => {
        if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return;
        const name = jsxTagName(node, sourceFile);
        if (name && name !== 'OperationColumnActions') {
          const isStatusChangeAction = name.endsWith('StatusChangeAction');
          if (!allowedOperationActions.has(name) && !isStatusChangeAction) {
            violations.push(finding(file, sourceFile, node, '操作列只允许统一文字操作组件，普通按钮应改为文字操作'));
          } else if ((textVariantActions.has(name) || isStatusChangeAction) && attributeText(node, 'variant', sourceFile) !== '"text"') {
            violations.push(finding(file, sourceFile, node, `${name} 在操作列中必须声明 variant="text"`));
          }
          if (name === 'ConfirmAction' && (/删除/.test(node.getText(sourceFile)) || attribute(node, 'danger'))) {
            violations.push(finding(file, sourceFile, node, '删除操作必须使用 DeleteConfirmAction'));
          }
          return;
        }
        ts.forEachChild(node, inspect);
      };
      ts.forEachChild(container, inspect);
    };

    const visit = (node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = jsxTagName(node, sourceFile);
        inspectBusinessStatusAction(node, name);
        if (name === 'StatusFlowModal') {
          violations.push(finding(file, sourceFile, node, '业务页面不得直接使用 StatusFlowModal，应通过 StatusChangeAction 承接'));
        }
        if (name === 'StatusFlowAction') {
          violations.push(finding(file, sourceFile, node, 'StatusFlowAction 已废弃，必须使用 StatusChangeAction'));
        }
        if (name === 'OperationColumnActions') inspectOperationChildren(node);
        if (name === 'TemplateDetailPage') {
          const statusSection = attribute(node, 'statusSection');
          const titleTags = attribute(node, 'titleTags');
          const statusAction = attribute(node, 'statusAction');
          const titleTagsSource = attributeText(node, 'titleTags', sourceFile);
          const statusActionSource = attributeText(node, 'statusAction', sourceFile);
          const hasStatusTag = /(?:\w*StatusTag|render\w*Status)\b/.test(titleTagsSource);
          const hasStatusAction = /\w*Status(?:Confirm|Change)Action\b/.test(statusActionSource);

          if ((titleTags && hasStatusTag) || statusAction) {
            if (!statusSection) {
              violations.push(finding(file, sourceFile, node, '详情包含状态标签或状态动作时必须声明 statusSection'));
            }
          }
          if (statusSection && !titleTags) {
            violations.push(finding(file, sourceFile, node, '有状态详情必须通过 TemplateDetailPage.titleTags 展示标题状态标签'));
          }
          if (statusSection && titleTags && !hasStatusTag) {
            violations.push(finding(file, sourceFile, node, '有状态详情的 titleTags 必须包含 StatusTag 或统一状态标签封装'));
          }
          if (statusSection && !statusAction) {
            violations.push(finding(file, sourceFile, node, '有状态详情必须通过 TemplateDetailPage.statusAction 承接状态操作'));
          }
          if (statusSection && statusAction && !hasStatusAction) {
            violations.push(finding(file, sourceFile, node, '有状态详情的 statusAction 必须使用统一状态动作组件'));
          }
          const actionsSource = attributeText(node, 'actions', sourceFile);
          if (/Status(?:Confirm|Change)Action|StatusFlowModal/.test(actionsSource)) {
            violations.push(finding(file, sourceFile, node, '详情状态操作不得放在右上角 actions，必须放入 statusAction'));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return violations;
  });
}

function objectProperty(object, name) {
  return object.properties.find((property) => ts.isPropertyAssignment(property)
    && property.name.getText().replace(/^['"]|['"]$/g, '') === name);
}

function propertyText(object, name, sourceFile) {
  return objectProperty(object, name)?.initializer.getText(sourceFile) || '';
}

function collectListColumnContractViolations(files) {
  return files.flatMap((file) => {
    if (!file.endsWith('ListPage.tsx')) return [];
    const source = readFileSync(file, 'utf8');
    if (!source.includes('<TemplateListPage')) return [];
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations = [];
    let columnsArray;
    const findColumns = (node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === 'columns'
        && node.initializer && ts.isArrayLiteralExpression(node.initializer)) columnsArray = node.initializer;
      ts.forEachChild(node, findColumns);
    };
    findColumns(sourceFile);
    if (!columnsArray) return violations;

    const columns = columnsArray.elements.filter(ts.isObjectLiteralExpression);
    if (columns.length < 2) return violations;
    const first = columns[0];
    const hasSequenceColumn = /序号/.test(propertyText(first, 'title', sourceFile))
      || propertyText(first, 'valueType', sourceFile).replace(/['"]/g, '') === 'index';
    const firstBusiness = hasSequenceColumn ? columns[1] : first;
    const action = columns.find((column) => /^['"]option['"]$/.test(propertyText(column, 'valueType', sourceFile)));
    const hasNumericWidth = (column) => /^\d+(?:\.\d+)?$/.test(propertyText(column, 'width', sourceFile));
    const fixed = (column, side) => propertyText(column, 'fixed', sourceFile).replace(/['"]/g, '') === side;

    for (const column of columns) {
      if (!hasNumericWidth(column)) violations.push(finding(file, sourceFile, column, '标准列表每个可见列必须声明数值型 width，确保列宽可拖拽'));
    }
    if ((hasSequenceColumn && !fixed(first, 'left')) || !fixed(firstBusiness, 'left')) {
      violations.push(finding(file, sourceFile, firstBusiness, hasSequenceColumn
        ? '包含序号列时，序号列和紧随其后的第一业务列都必须声明 fixed="left"'
        : '标准列表第一业务列必须声明 fixed="left"'));
    }
    if (action && !fixed(action, 'right')) {
      violations.push(finding(file, sourceFile, action, '标准列表操作列必须声明 fixed="right"'));
    }
    if (!/scroll\s*:\s*\{\s*x\s*:/.test(source)) {
      violations.push(finding(file, sourceFile, columnsArray, '标准列表必须配置 table.scroll.x，使左右固定列在横向滚动时生效'));
    }
    const sortableColumns = columns.filter((column) => column !== action && column !== (hasSequenceColumn ? first : undefined));
    for (const column of sortableColumns) {
      if (propertyText(column, 'sorter', sourceFile) !== 'true') {
        violations.push(finding(file, sourceFile, column, '标准列表除序号列和操作列外，每个可见列都必须声明 sorter: true，并接入统一排序状态'));
      }
    }
    return violations;
  });
}

function collectListViewTabContractViolations(files) {
  return files.flatMap((file) => {
    if (!file.endsWith('ListPage.tsx')) return [];
    const source = readFileSync(file, 'utf8');
    if (!source.includes('<TemplateListPage') || !source.includes('<ViewTabs')) return [];
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const variables = new Map();
    const viewTabs = [];

    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        variables.set(node.name.text, node.initializer);
      }
      if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && jsxTagName(node, sourceFile) === 'ViewTabs') {
        viewTabs.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    const unwrap = (expression) => {
      if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
        || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) {
        return unwrap(expression.expression);
      }
      if (ts.isIdentifier(expression) && variables.has(expression.text)) return unwrap(variables.get(expression.text));
      return expression;
    };

    return viewTabs.flatMap((node) => {
      const itemsAttribute = attribute(node, 'items');
      const expression = itemsAttribute?.initializer && ts.isJsxExpression(itemsAttribute.initializer)
        ? itemsAttribute.initializer.expression
        : undefined;
      const items = expression ? unwrap(expression) : undefined;
      if (!items || !ts.isArrayLiteralExpression(items)) {
        return [finding(file, sourceFile, node, '列表数据视图 Tab 的 items 必须是可静态审计的数组，并为每项声明 count')];
      }
      return items.elements
        .filter(ts.isObjectLiteralExpression)
        .filter((item) => !objectProperty(item, 'count'))
        .map((item) => finding(file, sourceFile, item, '列表数据视图 Tab 每一项必须声明 count；普通非列表 Tab 不受此约束', 'ViewTabs item'));
    });
  });
}

const files = walk(modulesDir).filter((file) => {
  const normalized = relative(modulesDir, file).split('/');
  return !excludedPathParts.includes(normalized[0]);
});

const blocking = collectMatches(files, blockingRules, 'BLOCK');
const listTemplateBlocking = collectMatches(files, listTemplateRules, 'BLOCK');
const pageTemplateBlocking = collectPageTemplateViolations(files);
const semanticBlocking = collectSemanticViolations(files);
const listColumnContractBlocking = collectListColumnContractViolations(files);
const listViewTabContractBlocking = collectListViewTabContractViolations(files);
const warnings = collectMatches(files, warningRules, 'WARN');

console.log('组件接入审计');
console.log(`扫描文件：${files.length}`);
console.log(`阻断项：${blocking.length + listTemplateBlocking.length + pageTemplateBlocking.length + semanticBlocking.length + listColumnContractBlocking.length + listViewTabContractBlocking.length}`);
console.log(`提醒项：${warnings.length}`);

for (const item of [...blocking, ...listTemplateBlocking, ...pageTemplateBlocking, ...semanticBlocking, ...listColumnContractBlocking, ...listViewTabContractBlocking, ...warnings]) {
  console.log(`${item.level} ${item.file}:${item.line} ${item.token} ${item.reason}`);
}

if (strict && (blocking.length > 0 || listTemplateBlocking.length > 0 || pageTemplateBlocking.length > 0 || semanticBlocking.length > 0 || listColumnContractBlocking.length > 0 || listViewTabContractBlocking.length > 0)) {
  process.exitCode = 1;
}

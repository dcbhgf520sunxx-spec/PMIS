import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

    const inspectOperationChildren = (container) => {
      const inspect = (node) => {
        if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return;
        const name = jsxTagName(node, sourceFile);
        if (name && name !== 'OperationColumnActions') {
          if (!allowedOperationActions.has(name)) {
            violations.push(finding(file, sourceFile, node, '操作列只允许统一文字操作组件，普通按钮应改为文字操作'));
          } else if (textVariantActions.has(name) && attributeText(node, 'variant', sourceFile) !== '"text"') {
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
        if (name === 'StatusFlowModal') {
          violations.push(finding(file, sourceFile, node, '业务页面不得直接使用 StatusFlowModal，应通过 StatusChangeAction 承接'));
        }
        if (name === 'StatusFlowAction') {
          violations.push(finding(file, sourceFile, node, 'StatusFlowAction 已废弃，必须使用 StatusChangeAction'));
        }
        if (name === 'OperationColumnActions') inspectOperationChildren(node);
        if (name === 'TemplateDetailPage' && attribute(node, 'statusSection')) {
          if (!attribute(node, 'titleTags')) {
            violations.push(finding(file, sourceFile, node, '有状态详情必须通过 TemplateDetailPage.titleTags 展示标题状态标签'));
          }
          if (!attribute(node, 'statusAction')) {
            violations.push(finding(file, sourceFile, node, '有状态详情必须通过 TemplateDetailPage.statusAction 承接状态操作'));
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

const files = walk(modulesDir).filter((file) => {
  const normalized = relative(modulesDir, file).split('/');
  return !excludedPathParts.includes(normalized[0]);
});

const blocking = collectMatches(files, blockingRules, 'BLOCK');
const listTemplateBlocking = collectMatches(files, listTemplateRules, 'BLOCK');
const pageTemplateBlocking = collectPageTemplateViolations(files);
const semanticBlocking = collectSemanticViolations(files);
const warnings = collectMatches(files, warningRules, 'WARN');

console.log('组件接入审计');
console.log(`扫描文件：${files.length}`);
console.log(`阻断项：${blocking.length + listTemplateBlocking.length + pageTemplateBlocking.length + semanticBlocking.length}`);
console.log(`提醒项：${warnings.length}`);

for (const item of [...blocking, ...listTemplateBlocking, ...pageTemplateBlocking, ...semanticBlocking, ...warnings]) {
  console.log(`${item.level} ${item.file}:${item.line} ${item.token} ${item.reason}`);
}

if (strict && (blocking.length > 0 || listTemplateBlocking.length > 0 || pageTemplateBlocking.length > 0 || semanticBlocking.length > 0)) {
  process.exitCode = 1;
}

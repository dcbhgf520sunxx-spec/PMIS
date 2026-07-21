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
  { pattern: /<ProFormList(\s|>)/g, reason: '可编辑明细应使用 AdminProFormEditableList' },
  { pattern: /<Form\.List(\s|>)/g, reason: '可编辑明细应使用 AdminProFormEditableList' },
  { pattern: /<EditableProTable(\s|>)/g, reason: '可编辑明细应使用 AdminProFormEditableList' },
  { pattern: /<Upload(\s|>|\.Dragger)/g, reason: '业务附件应使用 AdminAttachmentUpload 或 AdminAttachmentDragger，统一承接列表、状态、重试、预览、下载和删除确认' },
  { pattern: /<ProTable(\s|>)/g, reason: '表格应优先使用 TemplateListPage / SearchTable' },
  { pattern: /<ProForm(\s|>)/g, reason: '表单容器应优先使用 TemplateFormPage' },
  { pattern: /<ProCard(\s|>)/g, reason: '卡片应优先使用页面样板或 AdminCard' },
  { pattern: /<Dropdown(\s|>)/g, reason: '动作下拉应优先使用 AdminActionDropdown / AdminSearchDropdown' },
  { pattern: /<Typography\.Text(\s|>)/g, reason: '文本状态应优先使用 AdminText' },
  { pattern: /<Tag(\s|>)/g, reason: '标签应使用 AdminTag 或状态、紧急程度、逾期等统一语义标签' }
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

function walkSourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walkSourceFiles(path);
    if (!/\.tsx?$/.test(path)) return [];
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
    if (pagePath.endsWith('FormPage.tsx') && source.includes('<TemplateFormPage') && !source.includes('usePageReturnNavigation')) {
      violations.push({
        level: 'BLOCK', file: relative(rootDir, file), line: 1, token: 'FormPage',
        reason: '新增编辑页必须使用 usePageReturnNavigation 统一保存、取消和直接访问的返回目标'
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
    if (pagePath.endsWith('DetailPage.tsx') && source.includes('<TemplateDetailPage') && !source.includes('usePageReturnNavigation')) {
      violations.push({
        level: 'BLOCK', file: relative(rootDir, file), line: 1, token: 'DetailPage',
        reason: '详情页必须使用 usePageReturnNavigation 统一返回列表和进入编辑的来源链路'
      });
    }
    if (pagePath.endsWith('ListPage.tsx') && source.includes('<TemplateListPage') && !/urlSync\s*:\s*true/.test(source)) {
      violations.push({
        level: 'BLOCK', file: relative(rootDir, file), line: 1, token: 'ListPage',
        reason: '标准列表必须通过 urlSync: true 同步已提交筛选、分页和排序状态'
      });
    }
    return violations;
  });
}

function collectServerListDataViolations(files) {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const match = /useTemplateListPageData\s*\(\s*\{[\s\S]*?serverPaging\s*:\s*true[\s\S]*?\}\s*\)/.exec(source);
    if (!match) return [];
    return [{
      level: 'BLOCK',
      file: relative(rootDir, file),
      line: lineNumber(source, match.index),
      token: 'useTemplateListPageData',
      reason: '服务端分页列表必须使用 useTemplateServerListData，统一处理旧数据失效、加载状态和请求乱序'
    }];
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

function resolveImportedComponent(file, sourceFile, componentName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const modulePath = statement.moduleSpecifier.text;
    if (!modulePath.startsWith('.')) continue;
    const importClause = statement.importClause;
    const namedImports = importClause?.namedBindings;
    const namedImport = namedImports && ts.isNamedImports(namedImports)
      ? namedImports.elements.find((element) => element.name.text === componentName)
      : undefined;
    const exportName = importClause?.name?.text === componentName
      ? 'default'
      : namedImport?.propertyName?.text || namedImport?.name.text;
    if (!exportName) continue;
    const basePath = resolve(dirname(file), modulePath);
    const candidates = [`${basePath}.tsx`, `${basePath}.ts`, join(basePath, 'index.tsx'), join(basePath, 'index.ts')];
    const componentFile = candidates.find((candidate) => existsSync(candidate));
    return componentFile ? { componentFile, exportName } : undefined;
  }
  return undefined;
}

function resolveImportedComponentFile(file, sourceFile, componentName) {
  return resolveImportedComponent(file, sourceFile, componentName)?.componentFile || '';
}

function resolveImportedComponentSource(file, sourceFile, componentName) {
  const componentFile = resolveImportedComponentFile(file, sourceFile, componentName);
  return componentFile ? readFileSync(componentFile, 'utf8') : '';
}

function importedComponentUsesDetailTablePrimitive(file, sourceFile, componentName, visited = new Set()) {
  const importedComponent = resolveImportedComponent(file, sourceFile, componentName);
  if (!importedComponent) return false;
  const { componentFile, exportName } = importedComponent;
  const visitKey = `${componentFile}:${exportName}`;
  if (visited.has(visitKey)) return false;
  visited.add(visitKey);

  const componentSource = readFileSync(componentFile, 'utf8');
  const componentSourceFile = ts.createSourceFile(
    componentFile,
    componentSource,
    ts.ScriptTarget.Latest,
    true,
    componentFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const isDefaultExport = (node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  let componentDeclaration;
  for (const statement of componentSourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && ((exportName === 'default' && isDefaultExport(statement)) || statement.name?.text === exportName)) {
      componentDeclaration = statement;
      break;
    }
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find((item) => (
        ts.isIdentifier(item.name) && item.name.text === exportName
      ));
      if (declaration) {
        componentDeclaration = declaration;
        break;
      }
    }
  }
  if (!componentDeclaration) return false;

  let usesPrimitive = false;
  const inspect = (node) => {
    if (usesPrimitive) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = jsxTagName(node, componentSourceFile);
      if (['SearchTable', 'TemplateListPage', 'ProTable', 'table'].includes(name)) {
        usesPrimitive = true;
        return;
      }
      if (/^[A-Z]/.test(name)
        && importedComponentUsesDetailTablePrimitive(componentFile, componentSourceFile, name, visited)) {
        usesPrimitive = true;
        return;
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(componentDeclaration);
  return usesPrimitive;
}

function collectSemanticViolations(files) {
  const successMessageActions = new Set([
    'BubbleConfirmAction',
    'ConfirmAction',
    'DeleteConfirmAction',
    'StatusConfirmAction'
  ]);
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
        if (successMessageActions.has(name)) {
          const onConfirmSource = attributeText(node, 'onConfirm', sourceFile);
          const successMessageSource = attributeText(node, 'successMessage', sourceFile);
          if (/\bmessage\.success\s*\(/.test(onConfirmSource) && successMessageSource !== '{false}') {
            violations.push(finding(
              file,
              sourceFile,
              node,
              `${name} 默认会展示成功提示；onConfirm 自行提示时必须声明 successMessage={false}`
            ));
          }
        }
        if (name === 'HistoryTimeline') {
          if (attribute(node, 'expandedKeys') || attribute(node, 'onExpandedKeysChange')) {
            violations.push(finding(file, sourceFile, node, 'HistoryTimeline 已内置全部展开/全部收起，业务页不得手工控制展开状态'));
          }
          let parent = node.parent;
          while (parent && parent !== sourceFile) {
            if (ts.isJsxElement(parent) && jsxTagName(parent, sourceFile) === 'TemplateDetailSection') break;
            parent = parent.parent;
          }
          const sectionTitle = parent && ts.isJsxElement(parent)
            ? attributeText(parent, 'title', sourceFile)
            : '';
          if (sectionTitle !== '"变更历史"' && sectionTitle !== "'变更历史'") {
            violations.push(finding(file, sourceFile, node, 'HistoryTimeline 所在详情分组必须统一命名为“变更历史”'));
          }
          if (parent && ts.isJsxElement(parent)) {
            violations.push(finding(file, sourceFile, node, '详情页变更历史必须使用 HistoryTimelineSection，确保全部展开/收起位于标题后'));
          }
        }
        if (name === 'StatusFlowModal') {
          violations.push(finding(file, sourceFile, node, '业务页面不得直接使用 StatusFlowModal，应通过 StatusChangeAction 承接'));
        }
        if (name === 'StatusFlowAction') {
          violations.push(finding(file, sourceFile, node, 'StatusFlowAction 已废弃，必须使用 StatusChangeAction'));
        }
        if (name === 'AdminTag' && attribute(node, 'color')) {
          violations.push(finding(file, sourceFile, node, '普通分类标签不得自行指定 color；需要区分多个分类值时使用 CategoryTag 和集中色调映射'));
        }
        if (name === 'CategoryTag') {
          const tone = attribute(node, 'tone');
          const toneSource = attributeText(node, 'tone', sourceFile);
          if (attribute(node, 'color') || !tone) {
            violations.push(finding(file, sourceFile, node, 'CategoryTag 必须通过 tone 使用底座受控分类色板，不得传入 color 或省略 tone'));
          } else if (/^["']/.test(toneSource)) {
            violations.push(finding(file, sourceFile, node, 'CategoryTag 的 tone 必须来自业务集中映射，不得在页面中直接写死色调'));
          } else if (!source.includes('defineCategoryToneMap(')) {
            violations.push(finding(file, sourceFile, node, 'CategoryTag 所在业务封装必须通过 defineCategoryToneMap 集中声明并校验分类色调映射'));
          }
        }
        if (name === 'OperationColumnActions') inspectOperationChildren(node);
        if (name === 'AdminProFormEditableList') {
          const forbiddenProps = ['columns', 'addText', 'minRows', 'maxRows', 'readonly', 'className', 'style'];
          for (const propName of forbiddenProps) {
            if (attribute(node, propName)) {
              violations.push(finding(
                file,
                sourceFile,
                node,
                `业务方只能定义明细字段，${propName} 属于底座统一结构，不允许覆盖`,
                `AdminProFormEditableList.${propName}`
              ));
            }
          }

          let parent = node.parent;
          while (parent && parent !== sourceFile) {
            if (ts.isJsxElement(parent) && jsxTagName(parent, sourceFile) === 'TemplateFormPage') break;
            parent = parent.parent;
          }
          if (!parent || parent === sourceFile) {
            violations.push(finding(
              file,
              sourceFile,
              node,
              '可编辑明细必须放在 TemplateFormPage 内，由底座统一表单布局和保存取消操作'
            ));
          }
        }
        if (name === 'TemplateDetailPage') {
          const statusSection = attribute(node, 'statusSection');
          const titleTags = attribute(node, 'titleTags');
          const statusAction = attribute(node, 'statusAction');
          const statusSectionSource = attributeText(node, 'statusSection', sourceFile);
          const statusActionSource = attributeText(node, 'statusAction', sourceFile);
          const hasStatusTag = /(?:\w*(?:Status|Urgency|Overdue)Tag|render\w*(?:Status|Urgency|Overdue))\b/.test(statusSectionSource);
          const hasStatusAction = /\w*Status(?:Confirm|Change)Action\b/.test(statusActionSource);

          if (titleTags) {
            violations.push(finding(file, sourceFile, node, '标题状态标签必须由 statusSection.items 自动生成，业务页不得手工维护 titleTags'));
          }
          if (statusAction && !statusSection) {
            violations.push(finding(file, sourceFile, node, '详情包含状态动作时必须声明 statusSection'));
          }
          if (statusSection && (!/\bitems\s*:/.test(statusSectionSource) || /\bchildren\s*:/.test(statusSectionSource))) {
            violations.push(finding(file, sourceFile, node, '当前状态必须通过 statusSection.items 声明，由底座统一右侧样式和标题标签'));
          }
          if (statusSection && /\bitems\s*:/.test(statusSectionSource) && !hasStatusTag) {
            violations.push(finding(file, sourceFile, node, 'statusSection.items 必须使用 StatusTag 或统一状态标签封装，确保标题展示为标签'));
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
          const inspectDetailTableContent = (child) => {
            if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
              const childName = jsxTagName(child, sourceFile);
              const isDirectPrimitive = ['SearchTable', 'TemplateListPage', 'ProTable', 'table'].includes(childName);
              const isBusinessWrapper = /^[A-Z]/.test(childName)
                && childName !== 'TemplateDetailTableSection'
                && importedComponentUsesDetailTablePrimitive(file, sourceFile, childName);
              if (isDirectPrimitive || isBusinessWrapper) {
                violations.push(finding(
                  file,
                  sourceFile,
                  child,
                  '详情页结构化数据必须使用 TemplateDetailTableSection，不得直接调用表格、复用列表页或通过业务包装组件绕过'
                ));
                if (isBusinessWrapper) return;
              }
            }
            ts.forEachChild(child, inspectDetailTableContent);
          };
          ts.forEachChild(node, inspectDetailTableContent);
          if (attribute(node, 'sectionNavigation')) {
            const inspectNavigationSections = (child) => {
              if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
                const childName = jsxTagName(child, sourceFile);
                if (['TemplateDetailSection', 'TemplateDetailTableSection'].includes(childName)
                  && !attribute(child, 'sectionKey')) {
                  violations.push(finding(file, sourceFile, child, `开启详情分类导航后，每个 ${childName} 必须声明唯一 sectionKey`));
                }
              }
              ts.forEachChild(child, inspectNavigationSections);
            };
            ts.forEachChild(node, inspectNavigationSections);
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

function collectListCreationColumnViolations(files) {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const modulePath = relative(modulesDir, file).split('/');
    if (modulePath[0] === 'access-log') return [];
    const isListPage = file.endsWith('ListPage.tsx') && source.includes('<TemplateListPage');
    const isListColumns = file.endsWith('ListColumns.tsx');
    if (!isListPage && !isListColumns) return [];

    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const candidates = [];
    const visit = (node) => {
      if (ts.isArrayLiteralExpression(node)) {
        const columns = node.elements.filter(ts.isObjectLiteralExpression);
        const titledColumns = columns.filter((column) => objectProperty(column, 'title'));
        if (titledColumns.length >= 2) candidates.push({ node, columns: titledColumns });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    const candidate = candidates.sort((left, right) => right.columns.length - left.columns.length)[0];
    if (!candidate) return [];

    const visibleColumns = candidate.columns.filter((column) => propertyText(column, 'hideInTable', sourceFile) !== 'true');
    const businessColumns = visibleColumns.filter((column) => {
      const title = propertyText(column, 'title', sourceFile).replace(/^['"]|['"]$/g, '');
      return title !== '序号' && propertyText(column, 'valueType', sourceFile).replace(/['"]/g, '') !== 'option';
    });
    const creator = businessColumns.at(-2);
    const createdAt = businessColumns.at(-1);
    const titleOf = (column) => column ? propertyText(column, 'title', sourceFile).replace(/^['"]|['"]$/g, '') : '';
    const dataIndexOf = (column) => column ? propertyText(column, 'dataIndex', sourceFile).replace(/^['"]|['"]$/g, '') : '';
    const valid = titleOf(creator) === '创建人' && dataIndexOf(creator) === 'creatorName'
      && titleOf(createdAt) === '创建时间' && dataIndexOf(createdAt) === 'createdAt';
    return valid ? [] : [finding(
      file,
      sourceFile,
      candidate.node,
      '标准列表最后两个业务列必须依次为创建人（creatorName）和创建时间（createdAt），并位于操作列之前'
    )];
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
      if (!attribute(node, 'showCounts')) {
        return [finding(file, sourceFile, node, '列表页出现 ViewTabs 时必须显式启用 showCounts，并为每个 Tab 提供真实统计')];
      }
      const itemsAttribute = attribute(node, 'items');
      const expression = itemsAttribute?.initializer && ts.isJsxExpression(itemsAttribute.initializer)
        ? itemsAttribute.initializer.expression
        : undefined;
      const items = expression ? unwrap(expression) : undefined;
      if (!items || !ts.isArrayLiteralExpression(items)) {
        return [finding(file, sourceFile, node, '启用 showCounts 的列表数据视图 Tab，其 items 必须是可静态审计的数组，并为每项声明 count')];
      }
      return items.elements
        .filter(ts.isObjectLiteralExpression)
        .filter((item) => !objectProperty(item, 'count'))
        .map((item) => finding(file, sourceFile, item, '启用 showCounts 后，每个列表数据视图 Tab 都必须声明 count', 'ViewTabs item'));
    });
  });
}

const files = walk(modulesDir).filter((file) => {
  const normalized = relative(modulesDir, file).split('/');
  return !excludedPathParts.includes(normalized[0]);
});
const sourceFiles = walkSourceFiles(modulesDir).filter((file) => {
  const normalized = relative(modulesDir, file).split('/');
  return !excludedPathParts.includes(normalized[0]);
});

const blocking = collectMatches(files, blockingRules, 'BLOCK');
const listTemplateBlocking = collectMatches(files, listTemplateRules, 'BLOCK');
const pageTemplateBlocking = collectPageTemplateViolations(files);
const serverListDataBlocking = collectServerListDataViolations(sourceFiles);
const semanticBlocking = collectSemanticViolations(files);
const listColumnContractBlocking = collectListColumnContractViolations(files);
const listCreationColumnBlocking = collectListCreationColumnViolations(files);
const listViewTabContractBlocking = collectListViewTabContractViolations(files);
const warnings = collectMatches(files, warningRules, 'WARN');

console.log('组件接入审计');
console.log(`扫描文件：${files.length}`);
console.log(`阻断项：${blocking.length + listTemplateBlocking.length + pageTemplateBlocking.length + serverListDataBlocking.length + semanticBlocking.length + listColumnContractBlocking.length + listCreationColumnBlocking.length + listViewTabContractBlocking.length}`);
console.log(`提醒项：${warnings.length}`);

for (const item of [...blocking, ...listTemplateBlocking, ...pageTemplateBlocking, ...serverListDataBlocking, ...semanticBlocking, ...listColumnContractBlocking, ...listCreationColumnBlocking, ...listViewTabContractBlocking, ...warnings]) {
  console.log(`${item.level} ${item.file}:${item.line} ${item.token} ${item.reason}`);
}

if (strict && (blocking.length > 0 || listTemplateBlocking.length > 0 || pageTemplateBlocking.length > 0 || serverListDataBlocking.length > 0 || semanticBlocking.length > 0 || listColumnContractBlocking.length > 0 || listCreationColumnBlocking.length > 0 || listViewTabContractBlocking.length > 0)) {
  process.exitCode = 1;
}

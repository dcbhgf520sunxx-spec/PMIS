import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const rootDir = new URL('..', import.meta.url).pathname;
const modulesDir = join(rootDir, 'src/modules');
const strict = process.argv.includes('--strict');

const excludedPathParts = [
  'auth'
];

const blockingRules = [
  { pattern: /<Input(\s|>|\.TextArea)/g, reason: '输入框应优先使用 AdminInput / AdminTextArea' },
  { pattern: /<DatePicker(\s|>|\.RangePicker)/g, reason: '日期应优先使用 AdminDatePicker / AdminRangePicker' },
  { pattern: /<Select(\s|>)/g, reason: '下拉应优先使用 AdminSelect' },
  { pattern: /<TreeSelect(\s|>)/g, reason: '树选择应优先使用 AdminTreeSelect' },
  { pattern: /<Cascader(\s|>)/g, reason: '级联选择应优先使用 AdminCascader' },
  { pattern: /<Modal(\s|>)/g, reason: '弹窗应优先使用 AdminModal / ConfirmAction' },
  { pattern: /<Popconfirm(\s|>)/g, reason: '气泡确认应优先使用 BubbleConfirmAction' },
  { pattern: /<Drawer(\s|>)/g, reason: '抽屉应优先沉淀为 AdminDrawer / 业务抽屉组件' },
  { pattern: /<Empty(\s|>)/g, reason: '空状态应优先使用 AdminEmptyState / SearchTable locale' },
  { pattern: /<ProFormText(\s|>)/g, reason: '表单文本应优先使用 AdminProFormText' },
  { pattern: /<ProFormTextArea(\s|>)/g, reason: '表单多行文本应优先使用 AdminProFormTextArea' },
  { pattern: /<ProFormDatePicker(\s|>)/g, reason: '表单日期应优先使用 AdminProFormDatePicker' },
  { pattern: /<ProFormSelect(\s|>)/g, reason: '表单下拉应优先使用 AdminProFormSelect' },
  { pattern: /<Dropdown(\s|>)/g, reason: '动作下拉应优先使用 AdminActionDropdown / AdminSearchDropdown' }
];

const warningRules = [];

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

const files = walk(modulesDir).filter((file) => {
  const normalized = relative(modulesDir, file).split('/');
  return !excludedPathParts.includes(normalized[0]);
});

const blocking = collectMatches(files, blockingRules, 'BLOCK');
const warnings = collectMatches(files, warningRules, 'WARN');

console.log('组件接入审计');
console.log(`扫描文件：${files.length}`);
console.log(`阻断项：${blocking.length}`);
console.log(`提醒项：${warnings.length}`);

for (const item of [...blocking, ...warnings]) {
  console.log(`${item.level} ${item.file}:${item.line} ${item.token} ${item.reason}`);
}

if (strict && blocking.length > 0) {
  process.exitCode = 1;
}

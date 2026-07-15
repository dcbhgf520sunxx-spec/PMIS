import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/modules/requirement/pages/RequirementDetailPage.tsx'), 'utf8');

test('需求详情右侧按当前状态、优先级、逾期状态展示且基本信息不重复优先级', () => {
  const statusSectionMatch = source.match(/statusSection=\{row\?\{items:\[(.*?)\]\}:null\}/s);
  assert.ok(statusSectionMatch, '未匹配到需求详情 statusSection.items');
  const statusSection = statusSectionMatch[1];
  assert.ok(statusSection.includes("label:'当前状态'"), '缺少当前状态');
  assert.ok(statusSection.includes("label:'优先级'"), '缺少优先级');
  assert.ok(statusSection.includes("label:'逾期状态'"), '缺少逾期状态');
  assert.ok(statusSection.indexOf("label:'当前状态'") < statusSection.indexOf("label:'优先级'"));
  assert.ok(statusSection.indexOf("label:'优先级'") < statusSection.indexOf("label:'逾期状态'"));
  const basicInfoMatch = source.match(/<TemplateDetailSection title="基本信息">(.*?)<\/TemplateDetailSection>/s);
  assert.ok(basicInfoMatch, '未匹配到需求详情基本信息分组');
  const basicInfo = basicInfoMatch[1];
  assert.equal(basicInfo.includes("label:'优先级'"), false);
});

test('需求详情逾期状态为空时向模板传递普通占位符', () => {
  assert.match(source, /row\.isOverdue===null\?'\-':renderRequirementOverdue/);
});

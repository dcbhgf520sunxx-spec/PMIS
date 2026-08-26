import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const formPages = [
  'src/modules/requirement/pages/RequirementFormPage.tsx',
  'src/modules/project/pages/ProjectFormPage.tsx',
  'src/modules/task/pages/TaskFormPage.tsx',
  'src/modules/bug/pages/BugFormPage.tsx',
  'src/modules/work-order/pages/WorkOrderFormPage.tsx',
];

const detailPages = [
  'src/modules/requirement/pages/RequirementDetailPage.tsx',
  'src/modules/project/pages/ProjectDetailPage.tsx',
  'src/modules/task/pages/TaskDetailPage.tsx',
  'src/modules/bug/pages/BugDetailPage.tsx',
  'src/modules/work-order/pages/WorkOrderDetailPage.tsx',
];

test('五类业务表单把附件放在第一个分类块的最后一个字段', () => {
  for (const file of formPages) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const firstSectionStart = source.indexOf('<TemplateFormSection');
    const firstSectionEnd = source.indexOf('</TemplateFormSection>', firstSectionStart);
    const attachmentStart = source.indexOf('<BusinessAttachmentField ref=');

    assert.ok(firstSectionStart >= 0, `${file} 缺少第一个分类块`);
    assert.ok(attachmentStart > firstSectionStart && attachmentStart < firstSectionEnd, `${file} 的附件不在第一个分类块内`);
    assert.match(
      source.slice(attachmentStart, firstSectionEnd),
      /^<BusinessAttachmentField[\s\S]*?\/>\s*<\/div>\s*$/,
      `${file} 的附件不是第一个分类块最后一个字段`,
    );
    assert.doesNotMatch(source, /<TemplateFormSection title="附件">/);
  }
});

test('五类业务详情把附件放在基本信息的最后一个字段', () => {
  for (const file of detailPages) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const firstSectionStart = source.indexOf('<TemplateDetailSection title="基本信息"');
    const firstSectionEnd = source.indexOf('</TemplateDetailSection>', firstSectionStart);
    const firstSection = source.slice(firstSectionStart, firstSectionEnd);

    assert.ok(firstSectionStart >= 0, `${file} 缺少基本信息分类块`);
    const attachmentLabel = firstSection.match(/label:\s*['"]附件['"]/);
    assert.match(firstSection, /label:\s*['"]附件['"][\s\S]*?<BusinessAttachmentField\s+readOnly/, `${file} 的附件不在基本信息内`);
    assert.equal(firstSection.lastIndexOf('label:'), attachmentLabel?.index, `${file} 的附件不是基本信息最后一个字段`);
    assert.doesNotMatch(source, /<TemplateDetailSection title="附件"/);
  }
});

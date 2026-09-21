import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');
test('删除确认中的表单校验保留字段提示，不伪报接口失败',()=>{
 const source=read('src/components/admin/ConfirmAction/index.tsx');
 assert.ok(source.indexOf("'errorFields' in error") < source.indexOf('const nextMessage'));
 assert.match(read('src/modules/design-system/pages/sections/feedback/FeedbackConfirmations.tsx'), /await form.validateFields/);
});
test('需求转项目两个入口及只读项目链接保持可追溯',()=>{
 for(const name of ['RequirementListPage','RequirementDetailPage']) assert.match(read(`src/modules/requirement/pages/${name}.tsx`),/projects\/new\?requirement_id=/);
 assert.match(read('src/modules/requirement/pages/RequirementDetailPage.tsx'),/关联项目.*DetailLinkCell/);
 assert.match(read('src/modules/project/components/ProjectDeleteConfirmAction.tsx'),/await form.validateFields/);
 assert.match(read('src/modules/project/pages/ProjectFormPage.tsx'),/RequirementReleaseFields/);
});

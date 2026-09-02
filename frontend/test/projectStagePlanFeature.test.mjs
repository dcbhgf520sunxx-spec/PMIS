import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('关键事项不再展示或限制关联任务', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  assert.doesNotMatch(page, /关联主任务|q_planItemId|taskCount|已关联主任务/);
});

test('套用模板按钮始终展示，已有阶段时只提示且不打开模板抽屉', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');

  assert.match(page, /<PermissionButton permission="project" onClick=\{\(\)=>void openTemplate\(\)\}>套用模板<\/PermissionButton>/);
  assert.doesNotMatch(page, /visibleStages\.length===0\?<PermissionButton[\s\S]*套用模板/);
  assert.match(page, /if\(visibleStages\.length>0\)\{[\s\S]*message\.info\('当前已有阶段主计划，不能重复套用模板'\);[\s\S]*return;/);
  assert.match(page, /return;[\s\S]*setTemplateOpen\(true\)/);
});

test('任务页面和接口不再接入关键事项关联', () => {
  for (const file of [
    'src/api/taskApi.ts',
    'src/modules/task/types.ts',
    'src/modules/task/pages/TaskListPage.tsx',
    'src/modules/task/pages/TaskFormPage.tsx',
    'src/modules/task/pages/TaskDetailPage.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /planItem|plan_item|关联关键事项/);
  }
});

test('需要交付文件的事项在完成状态弹窗内选择并随状态一次提交', () => {
  const action = read('src/modules/project/components/ProjectPlanStatusChangeAction.tsx');
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const api = read('src/api/projectApi.ts');
  assert.match(action, /target===2&&item\.requiresDeliveryFile&&item\.fileCount===0/);
  assert.match(action, /<AdminAttachmentUpload/);
  assert.match(action, /multiple/);
  assert.doesNotMatch(action, /uploadProjectPlanFile\(projectId,item\.id,file\)/);
  assert.doesNotMatch(action, /deleteProjectPlanFile\(projectId,item\.id,attachment\.id\)/);
  assert.match(page, /completionFiles:\(values\.completionFiles[\s\S]*rawFile/);
  assert.match(api, /data\.append\('files',file\)/);
});

test('关键事项只保留四状态并在暂停时填写原因', () => {
  const action = read('src/modules/project/components/ProjectPlanStatusChangeAction.tsx');
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const types = read('src/modules/project/types.ts');

  assert.match(types, /ProjectPlanItemStatus = 0 \| 1 \| 2 \| 3/);
  assert.doesNotMatch(types, /\| 4/);
  assert.doesNotMatch(action, /取消|重新打开/);
  assert.match(action, /label:'进行中',value:1/);
  assert.match(action, /name="pauseReason"[\s\S]*暂停原因[\s\S]*required/);
  assert.match(page, /pause_reason:values\.pauseReason/);
  assert.match(page, /pauseReason/);
  assert.match(action, /<Tooltip title=\{pauseReason\}><span>[\s\S]*\{tag\}[\s\S]*<\/span><\/Tooltip>/);
  assert.match(action, /3:'已暂停'/);
  assert.match(action, /label:'已暂停',value:3/);
});

test('关键事项固定为两行信息并把进度和调整信息放回对应列', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const styles = read('src/modules/project/pages/ProjectStagePlanPage.css');

  assert.match(page, /project-plan-item-copy/);
  assert.match(page, /project-plan-owner/);
  assert.match(page, /project-plan-status/);
  assert.match(page, /project-plan-due/);
  assert.match(page, /原计划 \{row\.item!\.originalDueDate\} ·/);
  assert.match(styles, /\.project-plan-row\.is-item td\s*\{[\s\S]*height:\s*42px/);
  assert.match(styles, /\.project-plan-status \.admin-status-tag\.ant-tag\s*\{[\s\S]*height:\s*18px/);
  assert.match(styles, /\.project-plan-item-copy > \.admin-text-action,[\s\S]*\.project-plan-due \.admin-text-action\s*\{[\s\S]*height:\s*16px/);
  assert.match(styles, /\.project-plan-item-copy,[\s\S]*\.project-plan-owner,[\s\S]*\.project-plan-status,[\s\S]*\.project-plan-due\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column/);
  assert.match(styles, /-webkit-line-clamp:\s*1/);
});

test('交付文件只从关键事项提示进入并且只提供上传预览下载删除', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const api = read('src/api/projectApi.ts');
  const actionColumn = page.slice(page.indexOf("{title:'操作'"), page.indexOf('const openHistory'));

  assert.doesNotMatch(actionColumn, />交付文件</);
  assert.match(page, /交付文件 \{item\.fileCount\} ›/);
  assert.match(page, /onRemove=\{async\(attachment\)=>\{await deleteProjectPlanFile/);
  assert.match(api, /export const deleteProjectPlanFile=/);
  assert.doesNotMatch(api, /replaceProjectPlanFile|versionNo|replacesFileId|changeNote/);
});

test('新增关键事项使用当前阶段专属抽屉并支持一次新增多条', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const styles = read('src/modules/project/pages/ProjectStagePlanPage.css');
  const api = read('src/api/projectApi.ts');
  const action = read('src/modules/project/components/ProjectPlanStatusChangeAction.tsx');

  assert.match(page, /<AdminDrawer/);
  assert.match(page, /width="min\(1200px, 100vw\)"/);
  assert.match(page, /rootClassName="project-plan-create-drawer-root"/);
  assert.match(page, /新增关键事项 ·/);
  assert.match(page, /createDrawer\.items\.map/);
  assert.match(page, /继续添加一条/);
  assert.match(page, /createProjectPlanItems\(params\.id,createDrawer\.stage\.id,createDrawer\.items\)/);
  assert.match(page, /<Form layout="vertical" className="project-plan-create-form">/);
  assert.match(page, /className="is-remark"[\s\S]*<AdminTextArea rows=\{1\}/);
  assert.match(page, /<AdminIconAction danger label="删除本条" icon=\{<DeleteOutlined\/>\}/);
  assert.match(styles, /\.is-remark \.admin-textarea\.ant-input\s*\{[\s\S]*min-height:\s*32px !important/);
  assert.match(styles, /\.project-plan-create-drawer-root \.ant-drawer-body\s*\{[\s\S]*padding:\s*8px 18px 12px/);
  assert.doesNotMatch(page, /关键交付文件要求/);
  assert.doesNotMatch(page, /变更原因|删除原因/);
  assert.doesNotMatch(action, /变更原因|name="reason"/);
  assert.doesNotMatch(page, /kind:'new'/);
  assert.doesNotMatch(page, /保存并继续新增/);
  assert.match(api, /\/stage-plan\/items\/batch/);
});

test('编辑关键事项复用表单抽屉且调整计划纵向展示原计划与必填原因', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const api = read('src/api/projectApi.ts');
  const types = read('src/modules/project/types.ts');

  assert.match(page, /<AdminDrawer[\s\S]*title="编辑关键事项"/);
  assert.doesNotMatch(page, /<AdminModal title="编辑关键事项"/);
  assert.match(page, /title="编辑关键事项"[\s\S]*width="min\(1200px, 100vw\)"[\s\S]*rootClassName="project-plan-create-drawer-root"/);
  assert.match(page, /title="编辑关键事项"[\s\S]*<Form layout="vertical" className="project-plan-create-form">[\s\S]*<ProjectPlanItemFields/);
  assert.equal((page.match(/<ProjectPlanItemFields/g) || []).length, 2);
  assert.doesNotMatch(page, /function ItemFields/);
  assert.match(page, /adjustModal[\s\S]*reason/);
  assert.match(page, /title="调整计划完成时间"[\s\S]*<Form layout="vertical"[\s\S]*label="原计划完成时间"[\s\S]*adjustModal\.item\.currentDueDate/);
  assert.match(page, /label="原计划完成时间"[\s\S]*<AdminDatePicker[\s\S]*disabled/);
  assert.match(page, /setAdjustModal\(\{item,date:'',reason:'',attempted:false\}\)/);
  assert.match(page, /label="新的计划完成时间"[\s\S]*required/);
  assert.match(page, /label="调整原因"[\s\S]*required/);
  assert.match(page, /label="调整原因"[\s\S]*maxLength=\{100\}/);
  assert.match(page, /reason:event\.target\.value\.slice\(0,100\)/);
  assert.match(page, /row\.reason/);
  assert.match(api, /adjustProjectPlanItem=\(projectId:string,itemId:string,newDueDate:string,reason:string\)/);
  assert.match(api, /reason\}\)/);
  assert.match(types, /ProjectPlanAdjustment[\s\S]*reason: string/);
});

test('调整历史只从已调整次数进入并使用对比卡片展示，主计划变更历史独立放在表格下方', () => {
  const page = read('src/modules/project/pages/ProjectStagePlanPage.tsx');
  const actionColumn = page.slice(page.indexOf("{title:'操作'"), page.indexOf('const openHistory'));

  assert.doesNotMatch(actionColumn, /查看调整历史/);
  assert.match(page, /<AdminTextAction onClick=\{\(\)=>void openHistory\(row\.item!\)\}>已调整 \{row\.item!\.adjustmentCount\} 次<\/AdminTextAction>/);
  assert.match(page, /<TemplateDetailTableSection[\s\S]*<HistoryTimelineSection items=\{history\} sectionKey="stage-plan-history"\/>/);
  assert.match(page, /title=\{`计划调整记录 · \$\{historyModal\?\.item\.name\|\|''\}`\}/);
  assert.match(page, /className="project-plan-adjustment-card"/);
  assert.match(page, /className="project-plan-adjustment-card__summary"/);
  assert.match(page, />原计划<[\s\S]*row\.oldDueDate[\s\S]*>调整后<[\s\S]*row\.newDueDate/);
  assert.match(page, /className="project-plan-adjustment-card__reason"[\s\S]*调整原因[\s\S]*row\.reason/);
  assert.match(page, /row\.operatorName[\s\S]*row\.createdAt/);
  assert.doesNotMatch(page, /className="project-plan-history"/);

  const styles = read('src/modules/project/pages/ProjectStagePlanPage.css');
  assert.match(styles, /\.project-plan-adjustment-card__summary\s*\{[\s\S]*grid-template-columns:\s*auto auto auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.project-plan-adjustment-card__reason\s*\{[\s\S]*border-left:\s*1px solid #e8eef5/);
  assert.match(styles, /\.project-plan-adjustment-card__reason > span\s*\{[\s\S]*white-space:\s*nowrap/);
  const reasonStyle = styles.slice(styles.indexOf('.project-plan-adjustment-card__reason p'), styles.indexOf('.project-plan-status-file-tip'));
  assert.match(reasonStyle, /display:\s*-webkit-box/);
  assert.match(reasonStyle, /-webkit-line-clamp:\s*2/);
  assert.match(reasonStyle, /overflow:\s*hidden/);
});

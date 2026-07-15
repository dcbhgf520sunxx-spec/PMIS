import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/modules/project/pages/ProjectListPage.tsx', 'utf8');

test('项目查询使用逾期状态名称',()=>{assert.match(page,/label: '逾期状态'/);assert.doesNotMatch(page,/label: '是否逾期'/);});
const helperPath = 'src/modules/project/helpers.tsx';
const helper = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';
const controller = readFileSync('../backend/src/controllers/projectController.js', 'utf8');

test('项目列表把逾期标签放在项目名称后并只对逾期项目展示', () => {
  assert.match(helper, /renderProjectOverdue[\s\S]*<OverdueTag/);
  assert.match(page, /className="project-name-cell"[\s\S]*className="project-name-cell__text"[\s\S]*\{row\.name\}[\s\S]*className="project-name-cell__tag"[\s\S]*renderProjectOverdue/);
  assert.doesNotMatch(page, /title:\s*'逾期'/);
  assert.doesNotMatch(page, /<Space\s+size=\{6\}>/);
});

test('项目详情根据预计完成日期实时展示逾期天数', () => {
  const detail = readFileSync('src/modules/project/pages/ProjectDetailPage.tsx', 'utf8');
  assert.match(detail, /renderProjectOverdue\(row\.isOverdue, row\.expectedEndDate\)/);
  assert.doesNotMatch(detail, /overdueDays=\{row\.isOverdue \? 1 : 0\}/);
  assert.match(helper, /Date\.now\(\)[\s\S]*due\.getTime\(\)[\s\S]*86_400_000/);
});

test('项目列表展示启动时间和完整的预计完成时间列名', () => {
  assert.match(page, /title:\s*'启动时间',[\s\S]*dataIndex:\s*'startDate'/);
  assert.match(page, /title:\s*'预计完成时间',[\s\S]*dataIndex:\s*'expectedEndDate'/);
  assert.match(controller, /startDate:\s*'p\.start_date'/);
});

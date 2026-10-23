# 日常任务关联类型

用户已确认任务关联类型新增“日常任务”，允许记录没有项目或需求的常规运维工作。

- 关联类型：1 项目、2 需求、3 日常任务；日常任务的项目、需求均为空。
- 不新增表、字段、索引或权限，不迁移历史业务数据。扩展任务表的关联类型与对应 CHECK 约束。
- 新增、复制、编辑、子任务继承、筛选、详情、历史中文标签和 MCP 同步支持。
- 日常任务仍要求任务名称、任务类型、至少一名负责人及预计完成时间；状态、逾期、跟进和附件使用原规则。
- 纳入人员工作全景，按已有责任和主子任务边界展示；不归属任何产品、项目或需求，不新增完成率计算。
- BUG 的项目/需求关联规则不变。

## 组件支撑情况

| 功能需要 | 支持结论 | 组件或页面样板 | 组件工作台示例 | 处理方式 | 建议结论 |
|---|---|---|---|---|---|
| 表单关联类型、条件显示关联字段 | 全部支持 | TemplateFormPage、AdminProFormSelect | input/SelectionInputExamples；任务现有表单 | 直接复用 | - |
| 列表筛选、分类展示和详情 | 全部支持 | TemplateListPage、AdminSelect、CategoryTag、TemplateDetailPage、DetailMetaList | layout/ListTemplateDemo、input/SelectionInputExamples、DisplaySection 分类标签示例 | 直接复用 | - |
| 状态、权限、历史、子任务 | 全部支持 | 原 TaskStatusChangeAction、PermissionButton、HistoryTimelineSection、TemplateDetailTableSection | 任务现有流程及组件测试 | 直接复用 | - |

## 数据库与验证

增量迁移：`20261014_01_add_daily_task_source.sql`。同步初始化 SQL、数据库表结构 Markdown 和原 Excel。迁移只替换关联 CHECK 约束，不改已有任务。

`backend/test/taskDaily.test.js` 覆盖 MCP Schema 和真实数据库新增、复制、关联切换、子任务、历史、个人全景、产品排除及 Action 预览确认执行。真实读写使用独立临时 schema，运行方式：`cd backend && RUN_DB_INTEGRATION=1 node --test test/taskDaily.test.js`。

本体明确日常任务无项目/需求归属，扩展来源映射和 SHACL 校验，保留原项目/需求任务及 BUG 的关联约束。

## 本地交付证据

- `node scripts/verify-change.mjs` 完整门禁通过：前端测试586项通过；后端902项通过、0失败、18项默认跳过；组件、接口、历史审计、lint、构建及运行态新鲜度通过。
- 单独启用日常任务真实数据库测试：2项通过、0失败，覆盖 Action 预览确认执行；所有测试 schema 已清理。
- 本体映射和 SHACL 回归：20项通过；TTL 与 OWL/XML 等价。
- 本地迁移已执行，迁移回读无待执行项；3103健康检查及3104前端入口均为200。
- 浏览器实际验证：新增、必填校验、保存成功、日常任务列表筛选、详情、编辑回填、复制回填、子任务继承且锁定关联类型。测试任务139的关联字段回读均为空，验收后通过既有控制器软删除，审计历史保留。
- 数据库Excel仅更新任务表及字段汇总中的关联类型说明，已回读并检查版式，其他工作表及样式保留。
- 本功能纳入本批 Git 交付，正式环境未发布。工作区原有其他变更保留，用户最终业务验收仍待进行。

# 项目阶段主计划管理设计

## 1. 目标与范围

在现有项目详情中增加“阶段主计划”子页面，用“阶段 → 关键事项”两级结构维护项目主计划。阶段负责组织和汇总，关键事项负责责任人、状态、计划时间、交付文件及与主任务的对应关系。

本期范围包括：

- 项目内阶段和关键事项管理。
- 阶段、关键事项拖拽排序。
- 关键事项独立状态、计划调整和历史留痕。
- 主任务从任务侧单向选择关联关键事项。
- 关键事项完成时提交关键交付文件，并支持完成后补充和替换。
- 项目详情、任务列表和任务详情之间的页面跳转。

本期不增加独立一级菜单，不提供跨项目主计划总览，不把关键事项状态与任务状态联动，不提供普通附件、计划审批、完成率百分比或阶段手工状态。

## 2. 已确认的业务关系

- 一个项目可以有多个阶段。
- 一个阶段可以有多个关键事项。
- 一个关键事项有一名主负责人和零至多名协作人。
- 一个关键事项可以关联多个主任务。
- 一个主任务最多关联一个关键事项。
- 关联关系只能在主任务新增、编辑页维护；主计划侧只查看关联结果。
- 子任务不能直接关联关键事项。
- 任务状态与关键事项状态完全独立，互不自动更新。

## 3. 页面入口与主页面

项目详情的页面切换增加“阶段主计划”，与“基本信息”“合同信息”并列。使用项目详情现有子页面切换模式，地址为 `/projects/:id/stage-plan`，不新增侧栏菜单或独立权限键，复用项目管理权限。

主页面使用阶段分组表格，固定展示以下列：

1. 阶段 / 关键事项
2. 负责人
3. 状态
4. 计划完成时间
5. 实际完成时间
6. 关联主任务
7. 操作

页面顶部只保留“新增阶段”，不显示统计卡片。筛选区提供关键事项搜索、业务状态、主负责人和“只看逾期”。

### 3.1 阶段行

阶段行展示：

- 阶段名称。
- `已完成 X/Y`，不换算或展示完成率百分比。
- 下属关键事项当前有效计划时间的最早至最晚范围。
- 存在逾期时展示“已逾期 X 项”；没有逾期时不显示任何逾期文案。
- 行操作：新增关键事项、编辑阶段、删除。

阶段使用拖拽调整顺序，不提供上移、下移操作。阶段名称负责展开或收起下属关键事项。阶段下存在有效关键事项时禁止删除。

### 3.2 关键事项行

- 主负责人直接显示姓名。
- 存在协作人时，在下一行完整列出全部姓名，例如“协作：陈锋、李明、王芳”；没有协作人时不显示协作人行，不使用“无协作人”“等 X 人”或 `+X`。
- 协作人较多时允许单元格自动换行，不能截断姓名。
- 关键事项使用拖拽调整当前阶段内的顺序；跨阶段移动通过编辑关键事项修改所属阶段并记录历史。
- 关联主任务显示为“X 个 ›”。点击后跳转任务列表，自动带入当前关键事项筛选；返回时恢复阶段主计划页面。
- 操作列直接显示“编辑”“状态变更”“更多”。“更多”包含调整计划、交付文件、查看调整历史和删除；不需要交付文件的事项不显示“交付文件”。

### 3.3 计划完成时间

- 未调整时只显示计划完成时间，例如 `2026-07-12`。
- 调整后主行显示当前有效计划完成时间。
- 下一行小字显示 `原计划 2026-07-10 · 已调整 1 次`。
- 点击“已调整 X 次”查看完整调整历史。
- 阶段日期范围、临近截止和逾期判断均使用当前有效计划完成时间；原计划永久保留用于追溯。

### 3.4 交付文件提示

交付文件信息放在关键事项名称下方，不新增表格列：

- 未完成且要求交付文件：显示“需交付文件”。
- 已完成且存在有效交付文件：显示“交付文件 X ›”，点击查看、下载和版本历史。
- 不要求交付文件：不显示文件提示。

## 4. 阶段操作

### 4.1 新增、编辑阶段

使用小型弹窗，字段为阶段名称和阶段说明。阶段名称必填，长度不超过 100 个字符，同一项目内有效阶段名称不重复。新增阶段默认排在末尾。

阶段没有手工负责人、状态、日期或完成率字段；所有汇总来自下属关键事项。

### 4.2 阶段排序与删除

拖拽完成后一次性保存当前项目全部有效阶段的顺序，并由后端校验排序集合与项目归属。删除采用逻辑删除；存在有效关键事项时返回明确错误。

## 5. 关键事项操作

### 5.1 新增、编辑

使用右侧抽屉，字段为：

- 所属阶段：必填。
- 关键事项名称：必填，同一阶段内有效名称不重复。
- 主负责人：必填，只能选择一人。
- 协作人：选填，可多选，不能包含主负责人。
- 计划完成时间：新增时必填，保存后成为原计划时间。
- 需要交付文件：是 / 否，默认否。
- 交付文件要求：选择“是”后必填。
- 备注：选填。

普通编辑只能修改所属阶段、名称、主负责人、协作人、是否需要交付文件、交付文件要求和备注。状态、当前有效计划时间及实际完成时间不能从普通编辑入口修改。

未完成事项可以调整“需要交付文件”。已完成事项从“需要”改为“不需要”时必须填写变更原因并记录历史；从“不需要”改为“需要”时必须在同一次操作中上传至少一个有效交付文件。

### 5.2 排序与删除

关键事项只允许在当前阶段内拖拽排序。拖拽保存时后端校验事项均属于当前项目和当前阶段。

删除采用逻辑删除并要求填写删除原因。存在有效关联主任务时禁止删除，必须先在任务编辑页解除关联。删除后保留调整、状态和文件历史。

## 6. 状态与进度提示

### 6.1 业务状态

业务状态由用户独立维护，共五个：

- 未开始
- 进行中
- 已完成
- 暂停
- 取消

流转规则：

- 未开始 → 进行中、暂停、取消。
- 进行中 → 已完成、暂停、取消。
- 暂停 → 恢复到暂停前状态、取消。
- 已完成 → 重新打开为进行中。
- 取消 → 恢复到取消前状态。

变更为已完成时必须填写实际完成时间；要求交付文件的事项还必须在同一次操作中上传至少一个有效文件。暂停、取消、重新打开和从取消恢复必须填写原因。重新打开时清空实际完成时间，但保留交付文件及历史。

### 6.2 自动进度提示

进度提示不作为可编辑状态，不单独存储，共四个：

- 临近截止：未完成、未暂停、未取消，当前日期距离有效计划完成时间为 0 至 3 个自然日。
- 已逾期 X 天：未完成、未暂停、未取消，当前日期晚于有效计划完成时间。
- 按期完成：实际完成时间不晚于有效计划完成时间。
- 延期完成：实际完成时间晚于有效计划完成时间。

正常推进但距离截止超过 3 天时不显示进度提示；暂停或取消不计算逾期；不显示“正常”“无逾期”等标签。状态列最多同时展示一个业务状态标签和一个自动进度提示。

## 7. 计划调整

计划调整使用独立弹窗，填写新的有效计划完成时间和调整原因。允许提前或延后，允许多次调整。

每次调整记录：事项、调整前时间、调整后时间、调整原因、操作人和操作时间。原计划时间永不覆盖。调整、状态变化、负责人变化、跨阶段移动和删除继续写入统一操作日志。

## 8. 主任务侧关联

主任务新增、编辑页增加“关联关键事项”单选字段：

- 非必填。
- 仅主任务显示，子任务不显示且后端禁止提交。
- 只允许选择与该任务归属同一项目的有效关键事项。
- 项目来源任务直接按 `project_id` 校验；需求来源任务按关联需求所属项目校验。
- 重新选择时覆盖原关联；清空时解除关联。
- 主任务详情展示所属阶段和关键事项，并可进入项目阶段主计划。
- 主任务删除后关联自然失效，不影响关键事项。

任务列表增加关键事项筛选参数，阶段主计划点击“X 个”后进入 `/tasks` 并带入关键事项筛选及返回地址。筛选结果只包含有效主任务，不包含子任务。

## 9. 关键交付文件

本期只建设关键交付文件，不提供普通附件。

### 9.1 首次提交

关键事项新增时只声明是否需要交付文件及文件要求，不提前上传。要求交付文件的事项变更为已完成时，状态弹窗显示上传区并要求至少上传一个文件。

文件落库与状态完成作为一个完整业务操作：全部文件持久化成功后才更新事项状态和实际完成时间；任一文件校验或保存失败时，事项状态保持不变，并清理本次未落库的临时文件。

### 9.2 完成后管理

已完成事项允许：

- 补充新的交付文件。
- 替换已有文件，必须填写更新说明。
- 作废文件，必须填写原因。

替换时保留旧版本，不能物理覆盖。要求交付文件的已完成事项至少保留一个有效文件，不能作废最后一个有效文件。文件变化不自动改变事项状态。

每个文件记录原始文件名、存储键、MIME 类型、大小、版本号、被替换文件、当前有效标记、更新说明、上传人和上传时间。下载使用受鉴权接口，不直接暴露服务器文件路径；存储文件名使用系统生成的不可预测键，阻止路径穿越和同名覆盖。默认拒绝可执行文件，单文件大小限制由部署配置控制，初始建议 50 MB。

## 10. 数据结构设计

所有物理表使用 `pms_` 前缀。

### 10.1 `pms_project_plan_stage`

- `id BIGSERIAL PRIMARY KEY`
- `project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE RESTRICT`
- `name VARCHAR(100) NOT NULL`
- `description TEXT`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `creator_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `updater_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `is_deleted SMALLINT NOT NULL DEFAULT 0`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMP NOT NULL DEFAULT NOW()`

约束与索引：同一项目内有效阶段名称唯一；按项目、删除标记和排序建立查询索引。

### 10.2 `pms_project_plan_item`

- `id BIGSERIAL PRIMARY KEY`
- `stage_id BIGINT NOT NULL REFERENCES pms_project_plan_stage(id) ON DELETE RESTRICT`
- `name VARCHAR(200) NOT NULL`
- `owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT`
- `status SMALLINT NOT NULL DEFAULT 0`
- `previous_status SMALLINT`
- `original_due_date DATE NOT NULL`
- `current_due_date DATE NOT NULL`
- `actual_end_date DATE`
- `requires_delivery_file SMALLINT NOT NULL DEFAULT 0`
- `delivery_requirement TEXT`
- `remark TEXT`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `creator_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `updater_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `is_deleted SMALLINT NOT NULL DEFAULT 0`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMP NOT NULL DEFAULT NOW()`

约束与索引：同一阶段内有效事项名称唯一；状态、文件要求和完成时间保持一致；按阶段排序、负责人、状态和当前有效计划时间建立索引。

### 10.3 `pms_project_plan_item_collaborator`

- `plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE CASCADE`
- `user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- 主键为 `(plan_item_id, user_id)`。

后端校验协作人不能与主负责人重复。

### 10.4 `pms_project_plan_adjustment`

- `id BIGSERIAL PRIMARY KEY`
- `plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT`
- `old_due_date DATE NOT NULL`
- `new_due_date DATE NOT NULL`
- `reason TEXT NOT NULL`
- `operator_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`

按事项和创建时间建立索引。

### 10.5 `pms_project_plan_delivery_file`

- `id BIGSERIAL PRIMARY KEY`
- `plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT`
- `original_name VARCHAR(255) NOT NULL`
- `storage_key VARCHAR(255) NOT NULL UNIQUE`
- `mime_type VARCHAR(150) NOT NULL`
- `size_bytes BIGINT NOT NULL`
- `version_no INTEGER NOT NULL DEFAULT 1`
- `replaces_file_id BIGINT REFERENCES pms_project_plan_delivery_file(id) ON DELETE RESTRICT`
- `is_current SMALLINT NOT NULL DEFAULT 1`
- `is_void SMALLINT NOT NULL DEFAULT 0`
- `change_note TEXT`
- `uploader_id BIGINT NOT NULL REFERENCES pms_user(id)`
- `created_at TIMESTAMP NOT NULL DEFAULT NOW()`

按事项、当前有效标记和创建时间建立索引。替换、作废和“至少保留一个有效文件”的约束由事务内锁定事项及当前文件集合后校验。

### 10.6 `pms_task` 变更

新增：

- `plan_item_id BIGINT REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT`

按 `plan_item_id` 和删除标记建立索引。后端保证只有主任务可以保存该字段，且任务解析出的项目与关键事项所属项目一致。

## 11. 接口与事务边界

项目接口组增加：

- `GET /api/projects/:projectId/stage-plan`：读取阶段、关键事项、协作人、汇总和关联任务数量。
- `POST /api/projects/:projectId/stage-plan/stages`
- `PUT /api/projects/:projectId/stage-plan/stages/:stageId`
- `PUT /api/projects/:projectId/stage-plan/stages/reorder`
- `DELETE /api/projects/:projectId/stage-plan/stages/:stageId`
- `POST /api/projects/:projectId/stage-plan/items`
- `PUT /api/projects/:projectId/stage-plan/items/:itemId`
- `PUT /api/projects/:projectId/stage-plan/stages/:stageId/items/reorder`
- `PUT /api/projects/:projectId/stage-plan/items/:itemId/status`
- `POST /api/projects/:projectId/stage-plan/items/:itemId/adjustments`
- `GET /api/projects/:projectId/stage-plan/items/:itemId/adjustments`
- `DELETE /api/projects/:projectId/stage-plan/items/:itemId`
- `GET /api/projects/:projectId/stage-plan/items/:itemId/files`
- `POST /api/projects/:projectId/stage-plan/items/:itemId/files`
- `POST /api/projects/:projectId/stage-plan/items/:itemId/files/:fileId/replace`
- `POST /api/projects/:projectId/stage-plan/items/:itemId/files/:fileId/void`
- `GET /api/projects/:projectId/stage-plan/items/:itemId/files/:fileId/download`

状态完成与首次文件提交使用同一状态接口的 `multipart/form-data` 请求。数据库状态、文件元数据和操作日志在同一事务提交；磁盘临时文件在事务失败时清理。替换和作废同样使用事务及行锁，避免并发操作破坏最后一份有效文件约束。

所有接口先验证登录，再复用项目管理权限；写操作还要验证项目、阶段、事项和文件的完整归属链。前端 API 层转换字段并声明读写运行时契约。

## 12. 组件支撑情况

| 功能需要 | 支持结论 | 已核对入口 | 组件工作台示例 | 处理方式 |
|---|---|---|---|---|
| 项目详情子页面切换 | 全部支持 | `TemplateDetailPage.sectionNavigation` | `DetailTemplateDemo.tsx` | 复用现有路由页签模式 |
| 分组表格、筛选和固定操作列 | 部分支持 | `TemplateDetailTableSection`、`SearchTable`、`HierarchyListCell` | `DetailTemplateDemo.tsx`、`ListTemplateDemo.tsx` | 复用表格和层级单元格；阶段整行与拖拽采用项目计划业务组合，不新增依赖 |
| 新增编辑抽屉、弹窗和状态操作 | 全部支持 | `AdminDrawer`、现有后台表单控件、`StatusChangeAction` | 组件工作台反馈、输入和详情示例 | 复用统一抽屉、表单和状态交互 |
| 文件选择和拖拽上传 | 部分支持 | `AdminUpload`、`AdminUploadDragger` | `AdvancedInputExamples.tsx` 的“上传” | 复用上传交互；新增真实文件 API、元数据、版本和受权下载能力 |
| 通用持久化附件能力 | 暂不支持 | 仅现有头像上传为专用实现；未发现业务附件表或通用文件接口 | 无持久化附件示例 | 本期按关键交付文件做业务专用最小实现，不扩成全系统附件中心 |

`MilestoneEditor` 和 `MilestoneTimeline` 只提供前端里程碑编辑、展示，字段、两级结构、真实接口和持久化能力均不满足本设计，因此不作为阶段主计划业务入口。

## 13. 权限、历史与错误处理

- 页面和接口复用项目管理权限，不新增菜单。
- 关联任务查询继续受任务管理权限控制；无任务权限时任务数量不提供跳转，并显示无权查看提示。
- 所有操作者身份从当前登录用户取得，前端不得提交创建人、更新人或上传人。
- 可归属字段的校验错误使用结构化 `fieldErrors` 回填；并发排序、文件替换和关联冲突返回明确错误并要求刷新。
- 阶段和事项使用软删除，文件使用历史版本；协作人、任务关联等关系变化写入统一操作日志，不物理覆盖关键业务证据。
- 文件上传失败、数据库事务失败或临时文件清理异常必须记录服务端错误；不得出现状态已完成但文件未保存的部分成功。

## 14. 验收范围

自动测试至少覆盖：

- 阶段和事项项目归属、名称唯一、排序集合、防跨项目修改和删除限制。
- 主负责人、协作人完整显示及重复人员校验。
- 五态合法与非法流转、暂停/取消原因、完成时间和重新打开。
- 临近截止、逾期、按期完成和延期完成的边界日期。
- 原计划保留、多次调整次数和调整历史。
- 一个主任务最多一个关键事项、一个事项多个主任务、子任务禁止关联、跨项目禁止关联。
- 要求文件但未上传时禁止完成；上传失败状态不变；补充、替换、作废和最后有效文件保护。
- 文件下载鉴权、路径安全、大小和类型限制。
- 项目详情页签、筛选、拖拽、任务列表跳转与返回恢复、姓名完整展示及无协作人不渲染占位。

实现完成后运行 migration 检查、后端测试、前端测试、构建和 `node scripts/verify-change.mjs`，再在 `3104` 实际验证阶段、事项、状态、计划调整、任务关联跳转和交付文件完整流程，并确认 `3103` 健康检查返回 200。

## 15. 数据库确认门禁

本设计新增五张表并修改 `pms_task`。进入实现后，必须先由用户确认第 10 节的表、字段、索引、外键和数据影响；确认后才能同步初始化 SQL、增量 migration、后端查询及测试、`docs/数据库表结构.md` 和 `docs/数据库表结构.xlsx`，并执行带 `--user-approved` 的迁移命令。

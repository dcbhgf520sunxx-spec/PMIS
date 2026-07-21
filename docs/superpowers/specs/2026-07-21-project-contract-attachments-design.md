# 项目合同多附件设计

## 目标

在现有项目合同新增、编辑和详情流程中增加多附件管理。附件与合同一对多关联，合同信息和付款阶段的现有业务规则保持不变。

## 已确认方案

- 合同新增和编辑页增加“合同附件”区，支持同时选择多个文件、移除待上传文件、保留或删除已有附件。
- 合同详情增加“合同附件”表格，展示文件名、大小、上传人、上传时间和下载操作。
- 单个文件最大 20MB，一份合同最多保留 10 个有效附件。
- 支持图片、PDF、Word、Excel 和 ZIP；拒绝可执行文件及不在白名单内的类型。
- 附件文件保存到后端私有目录，不挂载到公开 `/uploads`；下载必须经过登录和项目菜单权限校验。
- 删除采用数据库软删除，并在事务成功后清理对应物理文件。
- 不扩展为全系统通用附件中心，不增加菜单或权限。

## 数据模型

新增 `pms_project_contract_attachment`：

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | `BIGSERIAL` | 主键 |
| `contract_id` | `BIGINT` | 必填，引用 `pms_project_contract.id`，限制删除 |
| `original_name` | `VARCHAR(255)` | 必填，用户上传时的原文件名 |
| `storage_name` | `VARCHAR(255)` | 必填、唯一，服务端生成的不可猜测存储名 |
| `mime_type` | `VARCHAR(150)` | 必填 |
| `file_size` | `BIGINT` | 必填，范围 1 至 20MB |
| `sort_order` | `INTEGER` | 默认 0 |
| `creator_id` | `BIGINT` | 引用 `pms_user.id` |
| `updater_id` | `BIGINT` | 引用 `pms_user.id` |
| `is_deleted` | `SMALLINT` | 默认 0 |
| `created_at` | `TIMESTAMPTZ` | 默认当前时间 |
| `updated_at` | `TIMESTAMPTZ` | 默认当前时间 |

索引：`storage_name` 唯一索引；`(contract_id, sort_order, id) WHERE is_deleted = 0` 查询索引。

## 接口与保存流程

- 合同查询响应增加 `attachments`。
- 合同创建和编辑仍先保存合同及付款阶段；保存成功后，前端按文件逐个调用附件上传接口，避免一次请求把多个大文件全部读入内存。
- `POST /projects/:id/contract/attachments`：上传单个附件，使用 `multipart/form-data`。
- `GET /projects/:id/contract/attachments/:attachmentId/download`：鉴权下载。
- `DELETE /projects/:id/contract/attachments/:attachmentId`：软删除附件并清理文件。
- 新增合同若附件上传部分失败，合同本身保留，页面明确提示失败文件并留在编辑页供重试，避免把已保存合同误报为全部失败。

## 组件能力

- 表单继续使用 `TemplateFormPage` 和 `TemplateFormSection`。
- 多文件选择复用组件层 `AdminUpload`；组件工作台“输入 / 上传”已有基础上传与拖拽上传示例。
- 详情附件展示复用 `TemplateDetailTableSection` 和 `OperationColumnActions`。
- 业务页只处理合同附件数据和回调，不自造上传控件。

## 验收标准

- 新增合同可选择多个附件并全部保存；编辑时可新增和删除附件。
- 超过 20MB、超出 10 个、扩展名或 MIME 类型不允许的文件，前后端均拦截并给出中文提示。
- 合同详情真实展示数据库附件，可鉴权下载，未登录不能读取。
- 删除后页面和接口不再返回附件，物理文件被清理。
- 初始化 SQL、迁移、结构 Markdown 和 Excel 一致。
- 后端专项测试、前端专项测试、项目门禁、3103/3104 服务检查和实际页面流程通过。

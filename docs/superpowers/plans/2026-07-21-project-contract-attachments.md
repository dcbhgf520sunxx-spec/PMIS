# 项目合同多附件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为项目合同新增、编辑和详情流程增加最多 10 个、单文件不超过 20MB 的私有多附件上传、下载与删除能力。

**Architecture:** 新增合同附件表保存文件元数据，文件落在后端私有目录并由鉴权接口下载。合同主数据继续使用现有 JSON 接口，附件在合同保存成功后通过单文件 multipart 接口逐个上传，详情使用现有表格样板展示。

**Tech Stack:** PostgreSQL、Express、Multer、React、TypeScript、Ant Design Pro、Node test runner、`@oai/artifact-tool`。

## Global Constraints

- 数据库物理表使用 `pms_` 前缀并同步初始化 SQL、migration、Markdown 和 Excel。
- 复用 `AdminUpload`、`TemplateFormPage`、`TemplateDetailTableSection` 和统一操作列组件。
- 单文件最大 20MB，一份合同最多 10 个有效附件；文件只通过鉴权接口下载。
- 不增加菜单、权限或全系统通用附件中心。
- 先写失败测试并观察预期失败，再写最小实现。

---

### Task 1: 数据库附件结构

**Files:**
- Modify: `backend/test/projectContractSchema.test.js`
- Modify: `backend/db/init/001_schema.sql`
- Create: `backend/db/migrations/20260721_02_add_project_contract_attachment.sql`

**Interfaces:**
- Produces: `pms_project_contract_attachment` 及有效附件查询索引。

- [ ] 增加结构测试，断言表、外键、文件大小约束和两个索引。
- [ ] 运行 `node --test backend/test/projectContractSchema.test.js`，确认因附件表缺失而失败。
- [ ] 在初始化 SQL 和增量 migration 中实现已确认结构。
- [ ] 重跑结构测试，确认通过。

### Task 2: 私有文件校验与附件接口

**Files:**
- Create: `backend/src/services/projectContractAttachmentService.js`
- Modify: `backend/src/controllers/projectContractController.js`
- Modify: `backend/src/routes/project.js`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `backend/test/projectContractHttpIntegration.test.js`
- Create: `backend/test/projectContractAttachmentService.test.js`

**Interfaces:**
- Produces: `validateAttachmentFile(file)`、`saveAttachmentFile(file)`、`removeAttachmentFile(storageName)`。
- Produces: 上传、鉴权下载和软删除接口；合同响应字段 `attachments`。

- [ ] 增加文件类型、大小、数量、合同归属、下载和删除的失败测试。
- [ ] 运行附件专项测试，确认因服务和接口缺失而失败。
- [ ] 增加 Multer，仅在单文件上传路由使用内存存储和 20MB 限制；服务端重新校验扩展名、MIME 和实际大小。
- [ ] 保存文件时生成随机存储名并写入私有目录；数据库失败时回收文件。
- [ ] 查询合同返回有效附件；下载设置安全的 `Content-Disposition`；删除先软删除再清理物理文件。
- [ ] 重跑附件和合同接口测试，确认通过。

### Task 3: 前端多附件表单与详情

**Files:**
- Modify: `frontend/src/modules/project/types.ts`
- Modify: `frontend/src/api/projectApi.ts`
- Modify: `frontend/src/modules/project/pages/ProjectContractFormPage.tsx`
- Modify: `frontend/src/modules/project/pages/ProjectContractDetailPage.tsx`
- Modify: `frontend/test/projectContractFeature.test.mjs`

**Interfaces:**
- Produces: `ProjectContractAttachment`、`uploadProjectContractAttachment`、`deleteProjectContractAttachment`、`downloadProjectContractAttachment`。
- Consumes: `AdminUpload` 多选文件列表和合同响应 `attachments`。

- [ ] 增加前端契约测试，要求多文件选择、限制提示、保存后上传、已有附件删除和详情下载。
- [ ] 运行 `node --test frontend/test/projectContractFeature.test.mjs`，确认因页面未实现而失败。
- [ ] 在合同表单增加“合同附件”，保留待上传文件和已有附件；提交合同成功后逐个上传，全部成功才返回详情。
- [ ] 在合同详情使用标准表格展示附件元数据和下载操作。
- [ ] 重跑前端专项测试并执行 TypeScript 构建。

### Task 4: 结构文档与完整验收

**Files:**
- Modify: `docs/数据库表结构.md`
- Modify: `docs/数据库表结构.xlsx`

**Interfaces:**
- Produces: 与 SQL 一致的技术结构文档和业务核对工作簿。

- [ ] 更新 Markdown 表清单和附件字段说明。
- [ ] 使用 `@oai/artifact-tool` 导入、渲染并核对原工作簿，在相同样式中增加附件表结构后导出覆盖目标文件。
- [ ] 执行 migration apply 和 check，验证真实数据库表与接口读写。
- [ ] 运行后端测试、前端专项测试、前端构建和 `node scripts/verify-change.mjs`。
- [ ] 检查 3103 健康响应和 3104 页面可访问；实际验证新增多文件、编辑删除、详情下载及失败限制。

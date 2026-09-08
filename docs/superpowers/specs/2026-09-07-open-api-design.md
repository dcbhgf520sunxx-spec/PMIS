# SIDM 需求与运维工单开放接口实施设计

状态：2026-09-07 用户已确认表结构并授权落地；三表及迁移已实现，本地迁移已执行。接口已完成本地 HTTP/PostgreSQL 联调，尚未发布生产；真实公司 OSS 链路仍需接入联调。

## 交付范围

新增 `/api/open/v1`，需求和工单各一个 `POST /{resource}/operate` 入口，支持 QUERY、CREATE、UPDATE、CHANGE_STATUS、DELETE。附件沿用单文件 multipart 上传方式，并提供列表、下载、删除。提供鉴权后的 health 和基础数据查询。

现有页面接口、MCP、i8 自动同步保持运行。新入口不内置 i8 默认产品或兜底人员。需求新增优先级低、工单紧急程度中，状态规则沿用当前业务实现。

## 实施前已核对的实现依据

- `backend/src/app.js`：当前不存在 `/api/open/v1` 路由。
- `backend/src/services/itopsSyncService.js`：已有来源单据编码与目标记录映射；从 `pms_integration_sync_record` 最新成功记录获取，不能按标题匹配。
- `backend/src/controllers/requirementController.js`：现有需求编辑为全量校验和更新；开放接口的部分更新须合并旧值、拒绝未支持字段后再校验。
- `backend/src/services/requirementRules.js`、`workOrderStatusRules.js`：复用状态流转和附加字段规则。
- `backend/src/db.js`：当前控制器使用数据库全局连接，不能直接在外层开事务、内部继续调用全局控制器并声称原子执行。
- `backend/src/services/mcpPermissionService.js`：可复用现有菜单与按钮权限查询，开放接口不调用 MCP dispatcher 或绕过其人工确认约束。

## 表结构提案：3 张新增表

三类记录分别具有独立生命周期：凭证会轮换，业务映射长期保留，请求历史逐次追加。既有同步历史是追加日志，没有唯一业务映射约束；不把它改成新接口的幂等存储。

### 1. pms_open_client：接入系统与授权

| 字段 | 类型与约束 | 用途 |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | 接入系统标识 |
| code | VARCHAR(50) NOT NULL UNIQUE | 稳定系统编码，轮换凭证不改变 |
| name | VARCHAR(100) NOT NULL | 显示名称 |
| token_hash | CHAR(64) NOT NULL UNIQUE | 高熵凭证 SHA-256 摘要，禁止保存明文 |
| enabled | SMALLINT NOT NULL DEFAULT 0，限 0/1 | 默认停用 |
| expires_at | TIMESTAMPTZ，可空 | 凭证失效时间 |
| scopes | JSONB NOT NULL DEFAULT '[]' | 兼容保留，不再参与授权 |
| operator_ids | JSONB NOT NULL DEFAULT '[]' | 兼容保留，不再参与授权 |
| created_by | BIGINT，可空，关联 pms_user(id)，ON DELETE SET NULL | 配置创建人 |
| created_at / updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | 配置时间 |

管理页面和管理员命令均支持创建、轮换、启停和配置名称/有效期；编码自动生成。按用户后续确认取消额外动作和人员白名单，scopes 和 operator_ids 暂留存储，不做结构迁移。人员启用、菜单、按钮及业务权限继续运行时校验。

### 2. pms_open_record：来源记录映射

| 字段 | 类型与约束 | 用途 |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | 映射标识 |
| client_id | BIGINT NOT NULL，关联 pms_open_client(id)，ON DELETE RESTRICT | 来源系统 |
| resource_type | VARCHAR(20) NOT NULL，限 requirement/work_order | 业务类型 |
| source_record_id | VARCHAR(100) NOT NULL | 外部系统记录编号 |
| target_id | BIGINT NOT NULL | SIDM 需求或工单 ID |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | 建立映射时间 |

唯一索引 `(client_id, resource_type, source_record_id)` 防止同一来源重复创建；唯一索引 `(client_id, resource_type, target_id)` 防止一个系统把同一目标误绑多个来源编号。

target_id 指向两种业务表，不能建立单一外键，由业务事务验证目标类型和存在性。业务软删除后保留映射，禁止来源编号自动重建新记录。

### 3. pms_open_request：逐次请求结果与幂等凭据

| 字段 | 类型与约束 | 用途 |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | 请求记录标识 |
| request_id | UUID NOT NULL UNIQUE | 本次调用追踪号 |
| client_id | BIGINT NOT NULL，关联 pms_open_client(id)，ON DELETE RESTRICT | 接入系统 |
| operator_id | BIGINT，可空，关联 pms_user(id)，ON DELETE SET NULL | 实际操作人 |
| resource_type | VARCHAR(20) NOT NULL，限 requirement/work_order/system | 业务类型或系统查询 |
| source_record_id | VARCHAR(100)，可空 | 来源编号 |
| operation | VARCHAR(40) NOT NULL | 动作，包括附件、基础数据与连接测试 |
| idempotency_key | VARCHAR(100)，可空 | 写入请求唯一号，只读无需传入 |
| request_hash | CHAR(64)，可空 | 规范化参数摘要；附件含文件内容哈希，不记录正文 |
| outcome | VARCHAR(20) NOT NULL，限 success/failed/replayed | 本次结果 |
| http_status | SMALLINT NOT NULL，限 100–599 | 响应状态 |
| result_json | JSONB NOT NULL DEFAULT '{}' | 写入回执或脱敏失败信息；查询不保存完整业务正文 |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | 发生时间 |

部分唯一索引 `(client_id, idempotency_key) WHERE outcome='success' AND idempotency_key IS NOT NULL` 保存一次有效写入；普通索引 `(client_id, created_at DESC)` 查询历史，`(client_id, resource_type, source_record_id, created_at DESC)` 定位业务请求。

失败及重放均追加记录，不覆盖前次失败；第一版不自动清除幂等成功记录。凭证轮换后仍属于同一 client，原请求号不可再用于另一业务请求。修正参数后的写入使用新请求号。

## 原子性与权限边界

写入在同一 PostgreSQL 事务内完成业务数据、变更历史、来源映射和成功回执。按接入系统与请求号锁定幂等执行，再按来源记录锁定业务写入；数据库唯一约束提供最终防重复保障。同键同参数返回原业务回执与本次追踪号，同键不同参数返回 409。

仅在新入口所需范围提取或注入可接收事务连接的业务写入能力，既有控制器保持原请求、响应和行为。测试覆盖旧入口回归。业务错误回滚后追加失败日志；事务已提交但响应丢失时，重试从成功回执恢复，不能重复创建。

附件存储是外部副作用：采用稳定存储标识和可恢复清理策略，数据库回滚不宣称 OSS 自动回滚。上传前检查鉴权、父记录、类型、数量、大小，重复上传读取已有回执；下载校验附件归属。

有效系统凭证允许全部已开放接口，实际操作仍受人员当前业务权限约束。接入系统只能通过自己的来源映射访问记录。日志同时保留 client 与实际操作人；业务创建人/更新人由正文工号解析后记录，不能直接接受外部传入内部 creator_id/updater_id。调用方服务端负责可信地传递实际操作人身份。

## i8 切换准备

提供仅检查的映射导入命令，要求指定新 client 和原 integration_config。按 source_key 找最新成功映射，校验目标类型、存在性、重复与冲突；输出待导入和冲突清单。应用导入和暂停旧同步留到用户确认切换时执行。

映射导入不修改业务数据、不补建被删除记录、不修改旧历史。由于旧同步继续运行，切换时应重新检查并补齐最终映射后再开放同批真实数据写入。

## 实施与验收顺序

1. 确认上述表、字段、索引、关联及数据影响，再同步 init SQL、migration、表结构 Markdown/Excel；仅在本地执行已确认迁移。
2. 实现系统凭证与管理员脚本、字段校验和权限；测试失效凭证、未授权动作、无效人员、跨系统访问拒绝。
3. 实现需求/工单查询和写入；测试部分更新、默认值、合法/非法状态、删除限制、中文历史、同键并发、不同键同来源并发、失败回滚和重试。
4. 实现附件与 i8 映射检查；验证下载归属、失败恢复与历史冲突，不切换旧同步。
5. 更新接入手册和发布记录；新增独立鉴权路由时同步交付规则与门禁例外。运行 verify-change 和真实 HTTP/PostgreSQL 联调，确认 3103/3104 可用且后端加载最新代码。

## 数据影响及发布边界

只新增三张表，不修改需求、工单、MCP、旧接口配置或同步历史的物理结构；不迁移或覆盖现有业务数据。凭证和映射不会通过 migration 自动生成。当前开发授权不包含 Git 合并、正式环境迁移、停旧同步或生产切换。

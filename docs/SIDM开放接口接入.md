# SIDM 需求与运维工单开放接口

对外统一手册：`/docs/sidm-open-api.html`（源文件 `frontend/public/docs/sidm-open-api.html`）。无需登录，所有接入系统共用，不包含凭证、发布过程或内部迁移说明。本文供内部开发运维使用；外部字段契约发生变化时同步更新公开手册。

版本：V1.1。实现入口 `/api/open/v1`。本次为本地开发版本，生产启用以部署和凭证交付为准；旧 V1.0 Word 为方案稿，字段约定以本文件及契约测试为准。

生产部署后基础地址：`https://gcglsys.znjs.com:9088/api/open/v1`。
本地验收基础地址：`http://127.0.0.1:3103/api/open/v1`。

## 1. 鉴权与人员

所有接口请求头：`Authorization: Bearer <系统凭证>`。JSON 请求同时带 `Content-Type: application/json`。凭证由 SIDM 管理员单独交付，勿写进日志或共享文档。

一个凭证代表一个接入系统，正文 `operatorEmployeeNo` 表示实际操作人工号。读取附件和基础数据时放在同名查询参数中。新增记录的创建人、更新人均为实际操作人；编辑、状态变更、删除记录更新人。提出人/提出组织是业务信息，不要求一定是 SIDM 用户。

启用且未过期的有效接入凭证可调用全部已开放接口，不再单独配置操作或人员白名单。业务请求须传真实操作人工号，校验人员有效性及其现有菜单/按钮和业务权限；不绕过业务校验。记录按接入系统隔离，仅可操作本系统来源编号对应的数据。连接测试只验证凭证及服务连通性。接入系统负责可信地传递实际操作人身份，凭证应仅保存在受信任服务端，不可交给浏览器或普通用户。

## 2. 通用请求、回执和重试

需求：`POST /requirements/operate`；运维工单：`POST /work-orders/operate`。

```json
{
  "operation": "CREATE",
  "sourceRecordId": "REQ-001",
  "operatorEmployeeNo": "005058",
  "idempotencyKey": "REQ-001-CREATE-001",
  "data": {}
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| operation | 是 | QUERY、CREATE、UPDATE、CHANGE_STATUS、DELETE |
| sourceRecordId | 是 | 本系统业务编号，1–100字符；同一系统、同一业务类型内唯一 |
| operatorEmployeeNo | 是 | SIDM 中有效且已授权的工号，1–50字符 |
| idempotencyKey | 写入是 | 1–100字符；QUERY 不传 |
| data | 随动作 | 新增、编辑、变更时传；查询、删除不传或传空对象 |

不接受未声明字段。数字枚举传 JSON 数字，不能传数字字符串。所有业务日期传 `YYYY-MM-DD`，并按上海时区解释。

成功返回 HTTP 200：

```json
{"code":0,"message":"success","data":{"operation":"CREATE","result":"CREATED","sourceRecordId":"REQ-001","targetId":126},"requestId":"本次追踪号"}
```

result 值：CREATED 新增、UPDATED 更新、STATUS_CHANGED 状态变更、DELETED 删除、ALREADY_DELETED 已删除、SKIPPED 无变化、FOUND 查询成功。写入回执表示事务已提交，不要求每次再查询才能认定成功；需要完整记录时使用 QUERY。

同一逻辑写入重试必须使用原 idempotencyKey、操作人及原业务参数；成功后重试返回原业务回执，并增加 `replayed: true`，本次 requestId 不同。不同逻辑写入必须用不同请求号；同请求号不同内容返回 409。第一版成功幂等记录长期保留，不能循环复用请求号。业务编号不能代替请求号。附件指纹还包括文件内容、名称和类型。

网络断开或 5xx 时，先使用原请求号重试；参数修正后用新请求号。同一记录按业务顺序发送，请求并发会排队处理，但不保证符合外部事件先后。暂不支持批量和 UPSERT。

失败示例：

```json
{"code":400,"message":"业务字段不正确","data":null,"fieldErrors":{"title":["标题不能换行"]},"requestId":"本次追踪号"}
```

| HTTP | 含义与处理 |
|---|---|
| 400 | 参数、字段、状态规则错误，检查 message 和 fieldErrors |
| 401 | 凭证无效或过期，联系管理员 |
| 403 | 系统停用或操作无权限，联系管理员 |
| 404 | 本系统来源编号或附件不存在 |
| 409 | 来源编号重复、幂等内容冲突或并发数据冲突，查询后处理 |
| 413 | 上传文件大于20MB |
| 500 | 服务处理失败，保留 requestId，原请求号重试或联系管理员 |
| 502 | 附件下载存储暂不可用，可重试读取 |

附件不支持的类型或内容与扩展名不匹配返回 400。已识别系统的业务失败会追加请求历史，不被后续成功覆盖；无效凭证请求不写入系统所属业务历史。日志不存凭证、文件正文及完整查询结果。

## 3. 连接与基础数据

- `GET /health`：返回 `data.status: "healthy"`、`message: "连接成功"`。
- `GET /reference-data?types=products,users,workOrderProblemTypes&operatorEmployeeNo=005058`。

基础数据返回：

```json
{"code":0,"message":"success","data":{"products":[{"name":"智能数管 SIDM"}],"users":[{"employeeNo":"005058","name":"韩健"}],"workOrderProblemTypes":[{"code":"PT001","name":"日常操作"}]},"requestId":"本次追踪号"}
```

名称、工号、档案编码均以实际查询为准；示例不是环境固定配置。产品名称必须精确匹配，产品改名后需刷新映射。接口不使用默认产品、默认负责人或 i8 兜底人员。

## 4. 需求字段

CREATE 的 data：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 最长200字符，不换行，不能与未删除需求重名 |
| description | string/null | 否 | 基础富文本，危险标签会清理；受单次 JSON 请求体8MB上限约束 |
| requirementType | integer | 是 | 1上会立项、2需求提报、3预研、4直接实施 |
| productName | string | 是 | 有效产品名称，最长100字符 |
| ownerEmployeeNo | string | 是 | 有效负责人 SIDM 工号 |
| submitterName | string | 是 | 提出人，最长50字符 |
| submitterDept | string/null | 否 | 提出组织，最长100字符，可空字符串 |
| submitDate | string | 是 | 提出日期 |
| startDate | string/null | 否 | 启动日期 |
| expectedEndDate | string/null | 否 | 预计完成日期 |

初始优先级固定低（0），初始状态由需求路径决定：1→0、2→10、3→20、4→30。不接受新增时指定 priority 或 status。

UPDATE 允许上述所有字段，至少传一个，只修改传入字段。未传保持不变；只有标注 null 的字段可以清空。需求进入实施路径状态30–35后，不允许修改需求路径；其他状态变更路径会重置对应初始状态。状态不能通过 UPDATE 修改，开放接口不支持修改优先级。

CHANGE_STATUS：`data.status` 必填，附加字段按目标状态填写，其余附加字段不能传。

| 状态 | 名称 |
|---|---|
| 0 / 1 / 2 / 3 | 上会评估 / 需求上会 / 上会通过 / 过会未通过 |
| 10 / 11 / 12 / 13 | 提报评估 / 需求审批 / 审批通过 / 审批未通过 |
| 20 / 21 / 22 | 需求验证 / 预研通过 / 预研不通过 |
| 30 / 31 / 32 | 需求整理 / 实施中 / 试运行 |
| 33 / 34 / 35 | 已完成 / 已完成未使用 / 暂停 |

- 33、34：必填 actualEndDate（实际完成日期，不晚于今天）、completionStatus（完成情况，1–200字符）。
- 35：必填 pauseDate（暂停日期）。
- 其他：仅传 status。
- 允许的流转受当前路径和状态约束，先 QUERY 查看 allowedStatuses。

DELETE 为软删除；已关联项目或仍有未删除任务/Bug 的需求不可删除。已删除记录保留来源映射，不能以同一来源编号重新创建。

## 5. 运维工单字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| problemDescription | string | 是 | 问题描述，基础富文本；受单次 JSON 请求体8MB上限约束 |
| productName | string | 是 | 有效产品名称 |
| problemTypeCode | string | 是 | 有效问题类型档案编码，最长50字符 |
| followerEmployeeNo | string | 是 | 跟进人 SIDM 工号 |
| urgency | integer | 是 | 0低、1中、2高；新增时必须明确传入 |
| expectedResolveDate | string | 是 | 预计完成日期 |
| submitterName | string | 是 | 提出人，最长50字符 |
| submitterDept | string | 是 | 提出组织，最长100字符 |
| submitTime | string | 是 | 提出日期，YYYY-MM-DD |

初始状态固定为0待处理。UPDATE 可修改上表字段，至少传一项，未传保持不变；工单字段不能用 null 清空。处置结果和实际修复日期通过状态变更提交。

CHANGE_STATUS 的 data.status 为0待处理、1处理中、2已解决、4已暂停、5被激活。

- 2：必填 resolveDate（实际修复日期，不晚于今天）、resultDescription（处置结果，基础富文本，受单次 JSON 请求体8MB上限约束）。
- 4：必填 suspendDate（暂停日期）。
- 5：必填 activationReason（激活原因，1–100字符）。
- 0、1：仅传 status。
- 允许流转：0→1/2/4，1→2/4，2→4/5，4→0/1/2，5→2。

DELETE 为软删除，关联附件同时标记删除。新请求重复删除返回 ALREADY_DELETED。

## 6. 查询完整记录

QUERY 不传 idempotencyKey，返回 data 包含：operation、result、sourceRecordId、targetId、本业务新增字段、status、statusLabel、allowedStatuses 和状态附加字段。需求另含 priority。

```json
{"operation":"QUERY","sourceRecordId":"REQ-001","operatorEmployeeNo":"005058"}
```

### 通用返回字段

| 字段 | 中文名 | 类型 | 说明 |
|---|---|---|---|
| creator | 创建人 | object / null | 首次创建记录的实际操作人，包含 employeeNo（工号）和 name（姓名） |
| updater | 更新人 | object / null | 最近一次修改记录的实际操作人，包含 employeeNo（工号）和 name（姓名） |
| createdAt | 创建时间 | string | 记录在 SIDM 的创建时间，返回带时区的时间 |
| updatedAt | 更新时间 | string | 记录在 SIDM 的最近更新时间，返回带时区的时间 |

创建人和更新人由请求中的 operatorEmployeeNo 自动记录，调用方不能传入或覆盖。新建时两者通常相同；后续修改后更新人会变化。历史记录无法解析人员时返回 null。

### 完整查询响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "operation": "QUERY",
    "result": "FOUND",
    "sourceRecordId": "REQ-001",
    "targetId": 101,
    "title": "示例需求",
    "status": 31,
    "statusLabel": "实施中",
    "allowedStatuses": [{"value":32,"label":"试运行"},{"value":35,"label":"暂停"}],
    "creator": {"employeeNo":"EMP001","name":"示例人员"},
    "updater": {"employeeNo":"EMP002","name":"更新人员"},
    "createdAt": "2026-09-07T09:00:00+08:00",
    "updatedAt": "2026-09-07T10:30:00+08:00"
  },
  "requestId": "本次追踪号"
}
```

不存在的可选值为 null；业务日期格式为 YYYY-MM-DD，创建时间和更新时间为带时区时间。allowedStatuses 只返回当前记录允许变更的目标，以实际响应为准。

## 7. 附件

下列路径中的 `{resource}` 为 requirements 或 work-orders，来源编号在 URL 路径中必须 URL 编码。必须先创建业务记录。

| 动作 | 方法与路径 | 参数 |
|---|---|---|
| 查询附件 | GET /{resource}/{sourceRecordId}/attachments | 查询参数 operatorEmployeeNo |
| 上传附件 | POST /{resource}/{sourceRecordId}/attachments | multipart/form-data：file、operatorEmployeeNo、idempotencyKey |
| 下载附件 | GET /{resource}/{sourceRecordId}/attachments/{attachmentId}/download | 查询参数 operatorEmployeeNo，返回文件流 |
| 删除附件 | POST /{resource}/{sourceRecordId}/attachments/delete | JSON：attachmentId（数字）、operatorEmployeeNo、idempotencyKey |

multipart 的 boundary 由 HTTP 客户端生成，不要手工固定 Content-Type。上传成功回执增加 `attachment: {"id":218,"name":"说明.pdf","size":1024}`；使用附件 ID 下载或删除。列表返回 `data.attachments`，每项含 id、original_name、mime_type、file_size、sort_order、creator_id、updater_id、created_at、updated_at、business_type、business_id。不返回 OSS 内部存储回执。

单文件不超过20MB，每条业务最多10个附件，文件名最长255字符。支持 JPG/JPEG/PNG/WEBP/PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/TXT/MD/ZIP。文件内容需符合类型，不能只改扩展名。

上传通过 SIDM 转存到已有 OSS。数据库失败后的相同请求重试会尽量复用持久化的上传回执；OSS 与数据库不是同一事务，上传成功与回执落盘之间的进程崩溃仍可能产生未关联的 OSS 文件，不能保证存储侧没有孤立文件。不会因此重复创建业务附件。部署需保留后端 private-uploads/open-api-receipts 目录，按现有私有上传目录备份；凭证不保存在其中。

## 8. 管理员配置和历史衔接

网页入口为“基础设置 → 接口管理”。主列表管理外部接入系统，支持按名称/编码、启停状态查询、新增、编辑、启停及查看调用历史。新增只需填写系统名称，可选凭证有效期；系统编码保存时自动生成且不可修改，既有编码保持不变。系统名称进入详情，可查看当前环境接口地址、调用示例及本说明。

新增配置默认停用，不返回有效明文凭证。在详情点击“生成/重置凭证”后，新凭证只在当前弹窗展示，关闭或离开页面后无法重新查看；可手动复制并安全交付对方。每次重置都会使旧凭证立即失效，不改变来源映射；重置不会自动启用接入系统。列表、详情及历史均不返回凭证摘要或明文。

新系统编码采用 `SYS000001` 形式（数字至少六位，按既有主键序列分配，可能有间隔），列表、表单和详情均在系统名称前展示。历史编码不自动改写。系统编码不是访问凭证，缩短编码不改变凭证强度。

单据信息按创建人、创建时间、更新人、更新时间单列展示。网页编辑、启停、重置凭证记录当前登录人为更新人；无变化不更新。尚未修改或无法确认人员的历史记录显示 `-`。本机管理命令无网页登录身份，其更新人留空，不沿用之前人员。

网页管理接口使用 `/api/open-clients`，只接受网页登录会话，并复用 `/integrations` 菜单权限；外部系统凭证不能管理其他接入系统。应仅将该菜单授权给负责系统接入的管理员。管理动作记录在变更审计中，不把凭证写入日志。原 scopes/operator_ids 字段暂留兼容存储，不再参与鉴权，也无需修改既有配置。

调用历史按服务端分页展示，可筛选失败或重复请求、来源编号，查看操作人、动作、处理说明、字段校验原因及请求追踪号。系统连接测试无实际操作人工号，因此该类记录的操作人为空。历史页面不提供写入重放，重试由调用方按幂等约定处理。

“旧同步管理”是过渡入口，仍保留旧 i8 配置、执行与历史；新页面不会停用旧任务。确认双方联调及历史映射完成后，再另行切换和移除旧同步入口。

在 backend 目录使用 `node scripts/open-api-client.js <动作> <配置.json> [新凭证文件]`。
动作：create 新建（默认停用，自动生成编码）、configure 修改名称或有效期、rotate 轮换、enable 启用、disable 停用。

配置示例：

```json
{"name":"外部系统","expiresAt":null}
```

创建返回生成的 code；后续 configure/rotate/enable/disable 配置需携带该 code 定位系统。业务调用仍传实际操作人工号，不再配置 scopes 或 operatorIds。

create/rotate 必须指定不存在的输出文件，权限0600；只向终端输出文件路径，不打印凭证。rotate 不改变接入系统 ID 或来源映射。expiresAt 为空表示不自动过期。

历史检查：`node scripts/open-api-import-i8.js <clientId> <旧integrationId>`。只检查旧同步的最新成功映射，报告 ready、existing、conflicts；不改业务数据或旧配置。
正式切换时先停用旧同步，等待执行中的旧批次结束，再重新检查，确认无冲突后加 `--apply` 导入。旧同步仍启用或仍在执行时拒绝导入，避免把同批数据交给两个入口同时维护。被删除目标不自动重建。

请求历史保存在 pms_open_request，可按 client_id、request_id、source_record_id 检索；未自动清除历史。现有 i8 配置、自动执行与历史继续可用，部署本功能不会自动停旧同步。

## 9. 开发验收

- 单元与契约：`cd backend && node --test test/openApiContract.test.js`。
- 真实 HTTP/PostgreSQL：`cd backend && OPEN_API_INTEGRATION=1 node --test test/openApiIntegration.test.js`，使用随机隔离 schema，测试结束清理，不写现有业务数据。
- 完整门禁：项目根目录执行 `node scripts/verify-change.mjs`。
- 本地迁移：`cd backend && npm run db:migrate -- --apply --user-approved`（本次结构已确认）。

测试附件用注入的存储响应验证业务链路，不等同于公司 OSS 网络验收。生产发布、签发正式凭证和切换旧同步另行按部署流程执行。

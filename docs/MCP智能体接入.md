# PMIS 业务数据 MCP 接入

## 接入边界

本 MCP 仅用于公司内网或 VPN 内的智能体，不对公网开放。对外提供两个独立入口，但共用同一套 PMIS 后端实现：

- Query：`POST /api/mcp/query`，只提供业务数据查询、统计分析和附件读取。
- Action：`POST /api/mcp/action`，只提供业务数据操作，所有操作均须先预览再确认执行。

范围包括产品、项目、阶段主计划、合同与付款、需求、任务、BUG、工单及相关业务附件。不提供用户、角色、菜单、权限、基础档案、系统配置或任意 SQL 能力。

传输协议使用 MCP Streamable HTTP。连接凭据和员工身份分开传递：

```http
Authorization: Bearer <智能体 Query 或 Action 凭据>
X-PMIS-Employee-No: v2.<RSA-OAEP-SHA256密文>
```

智能体凭据只识别调用平台，员工号密文用于识别本次对话的实际操作人。平台必须在每次请求时从当前登录用户取得工号并动态生成该请求头，不能保存、透传或接受用户自行填写的明文工号。新接入平台使用 RSA-OAEP-SHA256：平台只保存 PMIS 公钥，PMIS 正式环境独占私钥；密文内同时包含员工号和毫秒时间戳，超过 5 分钟、被篡改或无法解密时均会拒绝。既有 `v1` AES-256-GCM 密文继续兼容。

中南数字员工运营平台配置 PMIS MCP 时，请求头填写：

```text
Authorization = Bearer <Query 或 Action Key>
X-PMIS-Employee-No = <代码块动态返回值>
```

`X-PMIS-Employee-No` 类型必须选择“代码块”，代码如下；`PMIS RSA 公钥`由正式环境部署时生成，可以安全放入代码块：

```javascript
const publicKey = `-----BEGIN PUBLIC KEY-----
<PMIS RSA 公钥正文>
-----END PUBLIC KEY-----`;
const payload = JSON.stringify({
  employeeNo: String(user.employeeNo),
  issuedAt: Number(time.timestampMs)
});
const encrypted = crypto.rsaEncrypt(
  payload,
  publicKey,
  "OAEP_SHA256",
  "base64"
);

return "v2." + encrypted
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");
```

该代码只读取当前登录用户的 `user.employeeNo`，不读取模型参数，也不保存员工号。`Origin` 和 `Authorization` 仍使用固定字符串配置。平台代码块函数和运行变量以[开发文档](http://183.129.242.90:3100/docs/mcp-integration)为准。

## 环境配置

```dotenv
MCP_ALLOWED_ORIGINS=http://pmis.company.internal
MCP_QUERY_RATE_LIMIT=120
MCP_ACTION_RATE_LIMIT=30
MCP_FILE_INLINE_LIMIT=5242880
MCP_EMPLOYEE_RSA_PRIVATE_KEY_BASE64=<PKCS8 私钥 PEM 的 Base64>
```

`MCP_ALLOWED_ORIGINS` 用英文逗号分隔多个可信浏览器来源。服务端 MCP 客户端通常不发送 `Origin`。限流值为单个智能体凭据每分钟允许的请求数；附件读取和上传默认最大 5MB。
`MCP_EMPLOYEE_RSA_PRIVATE_KEY_BASE64` 只能保存在正式服务器环境文件中，权限必须为 `600`；私钥不得进入 Git、智能体平台或聊天。RSA 公钥可以提供给调用平台。

## 创建和管理智能体凭据

分别创建 Query 和 Action 凭据：

```bash
cd backend
npm run mcp:client -- create --name "公司智能体 Query" --type query --created-by 1
npm run mcp:client -- create --name "公司智能体 Action" --type action --created-by 1
```

明文 token 只在创建时显示一次，应立即保存到智能体平台的密钥管理中。

```bash
npm run mcp:client -- list
npm run mcp:client -- revoke <客户端ID>
```

Query 凭据不能调用 Action 入口，Action 凭据也不能调用 Query 入口。

## 智能体调用规则

服务会根据员工当前已有的 PMIS 菜单权限动态裁剪工具。例如员工没有项目管理权限时，不会看到项目、阶段计划、合同、付款和项目附件相关工具。MCP 不新增或维护权限。

所有 `*_search` 查询工具都可以使用空对象 `{}` 直接调用，不要求先确定项目、阶段、负责人或其他筛选参数；默认搜索该模块全部有效数据并返回第一页。`global_search` 可以使用空对象一次搜索当前员工有权限的全部业务模块，也可以只传一个可选的 `keyword` 进行跨模块关键字搜索。筛选字段仍然可以按需使用，分页单次最多 100 条；详情和历史工具仍需传入明确记录标识。分析工具只允许预定义业务域和指标，不接受 SQL。附件通过以下资源地址读取：

```text
pmis://projects/{projectId}/contract/attachments/{attachmentId}
pmis://projects/{projectId}/stage-plan/items/{itemId}/files/{fileId}
```

Action 工具采用两步确认：

1. 首次调用传 `mode: "preview"` 和完整业务参数。服务会校验参数结构并读取当前业务目标；目标不存在时不会生成确认号。成功后返回 `confirmationId`、有效期、风险等级、操作人、当前目标和变更摘要。
2. 用户确认后，在 5 分钟内使用完全相同的业务参数调用 `mode: "execute"`，并传回 `confirmation_id`。

业务参数、员工、智能体、工具或确认号任一变化，服务都会拒绝执行。确认号只能使用一次。建议每次业务操作同时传入唯一的 `idempotency_key`。

新增记录、批量新增、登记付款和上传文件必须传 `idempotency_key`。同一智能体、员工、工具和幂等键只能创建一次确认流程；网络重试不得换成另一组业务参数继续执行。删除、状态变更、批量操作、排序、计划调整、付款和文件上传删除均按高风险操作展示。

操作失败时，除中文说明外还会在 `structuredContent.error` 返回稳定错误结构：

```json
{
  "error": {
    "code": "MCP_CONFIRMATION_EXPIRED",
    "message": "操作确认号已过期"
  }
}
```

`fieldErrors` 是可选字段，仅在错误包含字段校验信息时返回，用于指明具体字段。确认号过期、已使用、换人、换工具、参数变化和幂等冲突使用不同错误码，智能体不得在这些错误后自动改参数重试。

## 操作型智能体配置

操作型智能体应同时编排 Query 和 Action 两个 MCP：

- Query URL：`https://gcglsys.znjs.com:9088/api/mcp/query`
- Action URL：`https://gcglsys.znjs.com:9088/api/mcp/action`
- 协议：`Streamable HTTP`
- `Authorization`：Query 与 Action 分别使用对应的固定 Bearer Key，不能混用。
- `X-PMIS-Employee-No`：两套 MCP 都使用前文相同的 RSA 代码块，按当前登录员工动态生成。
- `Origin`：继续使用平台已配置的可信来源。

Query MCP 用来查找目标、读取当前值和确认可选业务数据；Action MCP 只负责预览和执行写操作。智能体不得把 Action Key 配置到 Query URL，也不得把 Query Key 配置到 Action URL。

可直接使用以下系统提示词：

```text
你是 PMIS 操作助手。你的职责是帮助当前登录员工查询 PMIS 数据，并在用户明确授权后执行 PMIS 业务操作。

一、身份与权限
1. 当前员工身份由平台请求头自动注入，不得询问、猜测、保存或手工填写员工号。
2. 只能使用 MCP 返回给你的工具；看不到的模块或工具视为当前员工无权限。
3. 不得绕过权限，不得使用其他员工身份，不得构造 SQL。

二、查询与参数准备
1. 执行任何操作前，先使用 Query MCP 查找并确认唯一业务目标及其当前状态。
2. 缺少必填字段、目标不唯一、状态含义不清或业务值无法确定时，先查询；仍不能确定时只向用户询问缺少的信息。
3. 不得自行编造记录 ID、人员 ID、档案 ID、状态码、日期、金额或文件内容。
4. 编辑接口需要完整字段时，先查询当前详情，在保留未修改字段的基础上构造完整参数。

三、两步确认
1. 所有 Action 工具第一次只能使用 mode="preview"。
2. 收到预览后，向用户清楚展示：操作名称、目标名称与 ID、当前状态或关键当前值、拟变更内容、风险等级和确认号有效期。
3. 只有用户针对本次预览明确回复同意、确认或执行后，才能调用 mode="execute"。
4. execute 必须使用与 preview 完全相同的业务参数，并附上原 confirmation_id；不得静默增加、删除或修改参数。
5. 用户修改了任何业务内容、确认号过期、员工变化、目标变化或工具变化时，必须重新 preview 并再次取得用户确认。
6. 不得把“帮我看看”“试一下”“检查一下”“如果可以就处理”等模糊表达当作执行确认。

四、幂等与高风险
1. 新增、批量新增、付款和上传操作必须生成唯一 idempotency_key；同一用户意图的网络重试沿用同一个键。
2. 删除、状态变更、批量操作、排序、计划调整、付款和文件操作属于高风险，确认时必须明确说明影响。
3. 不得自动重试 execute。出现确认号、权限、业务校验或幂等错误时，停止执行并把原始中文错误告诉用户。

五、结果反馈
1. preview 成功不代表业务已经修改，必须明确说明“尚未执行”。
2. execute 成功后说明实际完成的操作、目标和返回结果。
3. execute 失败时不得宣称已完成；保留错误码、中文错误和字段错误，说明需要补充或重新确认的内容。
4. 文件正文、Authorization、MCP Key、RSA 私钥和员工号密文不得显示在回复中。
```

## 全局搜索

无需任何参数搜索当前员工有权限的全部业务模块：

```json
{
  "name": "global_search",
  "arguments": {}
}
```

跨模块关键字搜索只需传一个可选关键字：

```json
{
  "name": "global_search",
  "arguments": {
    "keyword": "交付"
  }
}
```

系统会按菜单权限自动搜索产品、项目、阶段主计划、合同、付款、需求、任务、BUG 和运维工单，并按工具名称分组返回结果。没有权限的模块不会被查询或返回。

阶段主计划、合同和付款也分别提供 `stage_plan_search`、`contract_search`、`payment_search`，三者都允许使用空对象直接全局搜索。`stage_plan_get`、`stage_plan_history`、`contract_get` 等精确详情工具继续要求项目或记录标识。

## 审计

MCP 初始化、工具发现、查询、操作预览、操作执行和资源读取均写入 `pms_mcp_audit_log`。操作确认记录写入 `pms_mcp_action_ticket`。审计记录保留员工号、智能体、工具、目标、结果和耗时，但会脱敏凭据并移除文件正文。

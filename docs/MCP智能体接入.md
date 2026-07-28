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

1. 首次调用传 `mode: "preview"` 和完整业务参数，返回 `confirmationId`、风险等级、操作人和变更摘要。
2. 用户确认后，在 5 分钟内使用完全相同的业务参数调用 `mode: "execute"`，并传回 `confirmation_id`。

业务参数、员工、智能体、工具或确认号任一变化，服务都会拒绝执行。确认号只能使用一次。建议每次业务操作同时传入唯一的 `idempotency_key`。

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

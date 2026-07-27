# PMIS 业务数据 MCP 接入

## 接入边界

本 MCP 仅用于公司内网或 VPN 内的智能体，不对公网开放。对外提供两个独立入口，但共用同一套 PMIS 后端实现：

- Query：`POST /api/mcp/query`，只提供业务数据查询、统计分析和附件读取。
- Action：`POST /api/mcp/action`，只提供业务数据操作，所有操作均须先预览再确认执行。

范围包括产品、项目、阶段主计划、合同与付款、需求、任务、BUG、工单及相关业务附件。不提供用户、角色、菜单、权限、基础档案、系统配置或任意 SQL 能力。

传输协议使用 MCP Streamable HTTP。请求头只传连接凭据：

```http
Authorization: Bearer <智能体 Query 或 Action 凭据>
```

每个业务工具的请求参数都必须传 `employee_no`，用于识别本次调用的实际操作人。服务端按该工号加载 PMIS 用户、菜单权限和审计身份。智能体凭据只识别调用平台，平台必须妥善保管凭据。

## 环境配置

```dotenv
MCP_ALLOWED_ORIGINS=http://pmis.company.internal
MCP_QUERY_RATE_LIMIT=120
MCP_ACTION_RATE_LIMIT=30
MCP_FILE_INLINE_LIMIT=5242880
```

`MCP_ALLOWED_ORIGINS` 用英文逗号分隔多个可信浏览器来源。服务端 MCP 客户端通常不发送 `Origin`。限流值为单个智能体凭据每分钟允许的请求数；附件读取和上传默认最大 5MB。

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

工具发现阶段会返回当前 Query 或 Action 入口的完整工具列表。执行工具时，服务根据必填的 `employee_no` 加载员工当前已有的 PMIS 菜单权限；员工没有对应权限时拒绝执行。MCP 不新增或维护权限。

查询工具只接受声明过的筛选字段，分页单次最多 100 条；分析工具只允许预定义业务域和指标，不接受 SQL。项目附件通过带员工身份的查询工具读取：

```text
contract_attachment_read(employee_no, project_id, attachment_id)
stage_delivery_read(employee_no, project_id, item_id, file_id)
```

Action 工具采用两步确认：

1. 首次调用传 `employee_no`、`mode: "preview"` 和完整业务参数，返回 `confirmationId`、风险等级、操作人和变更摘要。
2. 用户确认后，在 5 分钟内使用相同的 `employee_no` 和业务参数调用 `mode: "execute"`，并传回 `confirmation_id`。

业务参数、员工、智能体、工具或确认号任一变化，服务都会拒绝执行。确认号只能使用一次。建议每次业务操作同时传入唯一的 `idempotency_key`。

## 审计

MCP 初始化、工具发现、查询、操作预览、操作执行和附件读取均写入 `pms_mcp_audit_log`。操作确认记录写入 `pms_mcp_action_ticket`。业务工具审计保留请求参数中的员工号、智能体、工具、目标、结果和耗时，但会脱敏凭据并移除文件正文。

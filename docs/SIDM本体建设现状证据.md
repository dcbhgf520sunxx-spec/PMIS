# SIDM 本体建设现状证据

编制日期：2026-09-20  
对应文档：[SIDM 本体建设总体蓝图](SIDM本体建设总体蓝图.md)  
本地源码基线：`30e2962d`（2026-09-14 的本地 HEAD；未检查远程或生产版本）。

## 1. 证据怎么读

本附录记录本轮实际核对的源文件和结论。源码与文档证明设计/实现，不证明生产环境已经加载，也不证明真实业务数据完整。测试文件存在与测试已执行分别记录。

本轮围绕业务对象、规则、动作、权限及分析边界进行范围内阅读与检索，不是对全仓库或整本参考书逐行审计。旧说明书只作为业务叙述参考，遇到差异以当前实现记录现状；这不等于替业务方批准当前规则。

## 2. 证据索引

### E01 产品定位与既有说明书

- 来源：[操作说明书正文](/Users/sunxinxin/Documents/Project/SIDM/artifacts/SIDM软著V1.0-20260908/操作说明书正文.md:1)。
- 核对内容：定位为企业数字化交付与运维管理，覆盖产品、需求、项目、阶段、任务、BUG、工单、合同付款、权限、历史与接入。
- 限制：该说明书注明基于固定 V1.0 编写，不能替代当前源码。项目优先级叙述与当前控制器有差异，见 E05。

### E02 对象、关系与数据库约束

- 来源：[初始化结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:66)、[数据库表结构说明](/Users/sunxinxin/Documents/Project/SIDM/docs/数据库表结构.md:80)。
- 主要核对区段：产品/工单/项目 66～143；阶段计划和交付 146～255；项目合同付款 257～332；需求 334～359；产品运维合同 396 起；任务、负责人、跟进、BUG 462～525；历史 528 起；同步/开放接口 658～750；相关唯一索引 771、783。
- 可得结论：主要对象及关联存在；任务和 BUG 的项目/需求来源二选一；跟进记录每条仅关联项目、需求、任务之一。
- 限制：初始化文件和迁移体现目标结构，没有查询当前数据库的实际结构、行数或数据质量。未把 Excel 表结构文件作为本轮逐项核验来源。

### E03 任务、子任务、多人负责人及完成条件

- 来源：[任务规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/taskRules.js:1)、[状态控制器](/Users/sunxinxin/Documents/Project/SIDM/backend/src/controllers/taskController.js:411)、[任务负责人结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:480)。
- 已核对：状态为待处理、处理中、已完成、已暂停；完成需要实际完成日期；暂停需要日期和原因；未删除子任务未全部完成时拒绝主任务完成。
- 已核对：不能在子任务下再创建子任务；主任务已完成时不能新增子任务；已完成主任务约束子任务退出完成状态。
- 关键细节：`canCompleteParent(0, 0)` 成立，只表示零子任务不会触发该项阻断，不代表所有条件都满足。最后一个子任务完成返回提示信息，不自动写主任务为完成。
- 测试来源：[任务规则测试](/Users/sunxinxin/Documents/Project/SIDM/backend/test/taskRules.test.js:1)、[控制器契约测试](/Users/sunxinxin/Documents/Project/SIDM/backend/test/taskControllerContract.test.js:1)、[多人负责人测试](/Users/sunxinxin/Documents/Project/SIDM/backend/test/taskMultiOwner.test.js:1)。

### E04 阶段事项与任务关联被移除

- 来源：[移除关联迁移](/Users/sunxinxin/Documents/Project/SIDM/backend/db/migrations/20260724_04_remove_task_plan_item_link.sql:1)、[当前任务结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:462)。
- 迁移明确删除索引并 `DROP COLUMN IF EXISTS plan_item_id`；当前初始化任务结构不含此字段。
- 可得结论：不能把任务直接挂阶段事项视为当前结构能力；如未来需要，必须解释业务关系并按结构变更要求处理。
- 不可得结论：本轮没有检查生产迁移记录，不能据此声称所有运行环境已执行该迁移。

### E05 项目与需求关系、优先级

- 来源：[项目字段校验](/Users/sunxinxin/Documents/Project/SIDM/backend/src/controllers/projectController.js:15)、[关联校验](/Users/sunxinxin/Documents/Project/SIDM/backend/src/controllers/projectController.js:126)、[创建逻辑](/Users/sunxinxin/Documents/Project/SIDM/backend/src/controllers/projectController.js:158)、[唯一索引](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:783)。
- 已核对：新建/编辑所属需求必填；需求必须属于所选产品且未关联其他未删除项目；数据库需求字段可空，唯一索引排除空值和已删除记录。
- 已核对：新建使用默认优先级；独立的优先级调整入口位于控制器约 231 行。
- 资料差异：旧操作说明书第 5 节写优先级由关联规则处理，不能直接沿用为当前本体规则。

### E06 阶段事项、文件要求及状态

- 来源：[阶段事项规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/projectStagePlanRules.js:1)、[结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:196)。
- 已核对：原定/当前完成日期、调整记录、交付要求及文件；完成需要实际日期，要求文件时至少存在一个有效文件。
- 差异提示：事项暂停按前一未开始/进行中状态恢复；任务暂停可转到其他允许状态，不能统一成一套恢复规则。
- 已核对：事项从完成回到进行中会要求作废相关文件状态的处理；这不等于抹掉历史文件。
- 测试来源：[阶段计划规则测试](/Users/sunxinxin/Documents/Project/SIDM/backend/test/projectStagePlanRules.test.js:1)。

### E07 验收模板与验收能力边界

- 来源：[模板种子](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:939)，重点 946、970 行；E06 交付规则。
- 已有：AI 项目标准模板包含“项目验收与成果交付”阶段和需要文件的“项目验收”关键事项。
- 判断：已有验收相关过程与材料承载；本轮所查结构未见统一独立的验收结论、验收人、接受责任对象。不能说“完全没有验收”，也不能说“已有统一正式验收模型”。
- 待确认：实际材料中是否已记录验收标准、签字、结论和撤销，哪些场景需要结构化。

### E08 需求路径和“已完成未使用”

- 来源：[需求规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/requirementRules.js:1)、[前端状态语义](/Users/sunxinxin/Documents/Project/SIDM/frontend/src/modules/requirement/statusTransitions.ts:1)、[MCP 枚举](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:36)。
- 已核对：四种路径；实施、试运行、已完成、已完成未使用、暂停等状态；完成状态要求日期和完成情况。
- 边界：需求完成不是价值实现，未使用不能合并解释为已使用。文本中的预期收益尚不等于经验证的业务收益。

### E09 项目状态及逾期

- 来源：[项目规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/productProjectRules.js:1)、[前端状态](/Users/sunxinxin/Documents/Project/SIDM/frontend/src/modules/project/statusTransitions.ts:1)。
- 已核对：未开始、进行中、已完成、已暂停；完成要求日期，暂停要求日期和原因；当前逾期计算排除已完成和已暂停。
- 边界：暂停不计入该逾期口径，不能推导暂停没有业务风险，也不能自动推定恢复时间。

### E10 BUG 生命周期

- 来源：[BUG 规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/bugRules.js:1)、[MCP 枚举](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:44)。
- 已核对：新建、已修复、已关闭、被激活；修复、关闭和激活条件不同；激活需要原因与指派人。
- 边界：没有独立计划完成日期的分析能力，见 E15。不能把任务逾期公式照搬给 BUG。

### E11 运维工单生命周期

- 来源：[工单规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/workOrderStatusRules.js:1)、[MCP 枚举](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:45)。
- 当前有效状态：待处理、处理中、已解决、已暂停、被激活；已解决要求实际修复时间和处置结果。
- 兼容提示：结构中保留 `close_date`，不能据此宣称当前还存在“已关闭”的可选状态；以当前规则和公开枚举为准。

### E12 项目合同与付款

- 来源：[合同付款规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/projectContractRules.js:1)、[合同付款结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:257)、[有效合同唯一索引](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:771)。
- 已核对：分阶段计划金额合计等于合同金额；单次登记金额大于零且不能超过该阶段待付金额；付款月份不能晚于当前月份。
- 边界：不是银行支付指令，也没有从“项目已完成”直接推出“满足合同付款条件”的统一业务规则。

### E13 MCP 工具目录与公开/内部区分

- 来源：[内部目录](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:1)、[公开工具分组](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:1404)、[通用详情定义](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/catalog.js:1472)、[dispatcher](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/dispatcher.js:1)。
- 已核对：搜索、通用详情/历史、跟进和分析；公开 Action 使用分组工具与 operation。`task_flow` 的状态操作映射内部 `task_change_status`。
- 边界：本轮没有执行带用户身份的 `tools/list`，不报告当前用户实际可见工具数量；也不把所有后台业务能力都宣称为 MCP 已开放。

### E14 MCP 责任、确认、并发和执行结果

- 来源：[MCP 文档](/Users/sunxinxin/Documents/Project/SIDM/docs/MCP智能体接入.md:163)、[任务动作校验](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/actionTools.js:479)、[责任校验](/Users/sunxinxin/Documents/Project/SIDM/backend/src/mcp/actionTools.js:887)。
- 已核对：preview→用户确认→execute；绑定业务参数、身份、工具和确认号；确认号单次使用且有有效期；新增等操作要求幂等标识。
- 已核对：任务按负责人集合；普通编辑/删除允许创建人的例外不自动适用于状态变更、指派等动作。
- 契约明确：`MCP_DATA_CHANGED` 需重新查询/预览；`MCP_EXECUTION_OUTCOME_UNKNOWN` 不能说成功或未写入，应先回查。执行时继续校验权限及约束。
- 限制：本轮未在真实用户上下文重跑整条 Action 链路；文档和单元/契约测试不能替代这项试点验收。

### E15 分析范围和明确不支持的维度

- 来源：[分析 coverage](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/mcpPeriodAnalysisService.js:1350)、[接入文档边界](/Users/sunxinxin/Documents/Project/SIDM/docs/MCP智能体接入.md:511)。
- 当前总体：授权范围内当前未删除记录，不是含已删除记录的完整历史台账。
- 明确不支持：历史存量完整还原、历史计划版本还原、正式组织层级、回款、预算、成本、ROI、业务收益、BUG 计划日期、法定节假日/调休工作日、统一预计恢复时间、结构化业务依赖、完整操作权限人员名册。
- 时间解释：实际业务日期与登记回退日期区分；当前计划日期不能当作历史承诺快照；人员相关事项数不等于个人工作量，各人员分组不能直接相加。
- 这不是本轮猜测缺口，而是当前分析实现直接声明的边界。

### E16 跟进、变更事件与来源证据

- 来源：[跟进记录](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:487)、[操作日志](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:528)、[MCP 审计说明](/Users/sunxinxin/Documents/Project/SIDM/docs/MCP智能体接入.md:517)。
- 已核对：跟进记录含创建/更新信息；操作日志含操作人、对象、字段前后值、操作分组和登记时间；MCP 有调用审计。
- 边界：不能把 `updated_at` 当成任何业务事件发生时间；跟进文本是信息材料，不是新的执行指令；历史完整性仍受 E15 限制。

### E17 外部开放接口

- 来源：[开放接口说明](/Users/sunxinxin/Documents/Project/SIDM/docs/SIDM开放接口接入.md:1)、[来源映射结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:720)。
- 已核对契约：需求与工单操作、接入系统来源编号映射、实际操作人、权限、幂等和请求回执。
- 边界：与 MCP 不是同一确认与重试契约，不能从已有开放接口推定所有系统都已接入或生产已启用。

### E18 产品运维合同

- 来源：[运维合同规则](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/productMaintenanceContractRules.js:1)、[结构](/Users/sunxinxin/Documents/Project/SIDM/backend/db/init/001_schema.sql:396)。
- 已核对：合同编号约束、前后服务周期、续签/终止、附件要求、派生状态和到期提醒规则。
- 边界：不同于项目合同付款，不应合并两者状态；提醒规则存在不等于实际提醒已送达。

### E19 通用同步与来源适配

- 来源：[同步编排](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/integrationService.js:1)、[i8 适配实现](/Users/sunxinxin/Documents/Project/SIDM/backend/src/services/itopsSyncService.js:1)。
- 已核对范围：启停、自动首次执行/间隔判断、适配器调用、来源映射、映射版本摘要、变化日志和成功/失败/跳过记录。
- 边界：本轮没有触发同步或测试外部连接，也没有把已有适配器当作通用语义映射已经完成。

### E20 现有测试与本轮检查

- 来源：`backend/test/taskRules.test.js`、`taskControllerContract.test.js`、`taskMultiOwner.test.js`、`projectStagePlanRules.test.js`、`requirementRules.test.js`、`productProjectRules.test.js`、`bugRules.test.js`、`workOrderStatusRules.test.js`、`projectContractRules.test.js` 以及 MCP 契约测试。
- 区分：规则单测验证函数行为；源代码契约测试验证接入约束；临时数据库测试与真实业务用户端到端验收也不同。不能把任一项扩大为全部业务验收。
- 本轮门禁和文档检查结果记录在第 4 节。

### E21 书籍与方法参考

- 来源：用户提供 `/Users/sunxinxin/Desktop/《本体驱动的AI数据管理》.pdf`，前轮提取与相关章节阅读结果。
- 重点定位：印刷页 78～81、133～150、163～165、180～191、218～223、264～272。
- 用法：借鉴事实—事理—行动、目标评估、专家与 AI 协作、场景验证及增量连接；不照搬示例规则、工具选型或效率承诺。
- 标准资料链接集中放在蓝图第 15 节。SWRL、OWL-S 为 W3C 成员提交文档，书中的 7+1 不等同于一套统一认证标准。

### E22 缺口检索与结论边界

- 检索范围：当前初始化结构、迁移目录、相关服务/控制器、MCP 目录和分析能力边界，辅以前端状态定义和既有操作说明。
- 检索重点：本体/ontology、依赖/dependency/predecessor、验收/acceptance、目标收益、预算、工时、阶段事项关联、历史范围。
- 确定缺口以 E15 实现声明为主；验收相关部分覆盖以 E06/E07 为主；阶段任务关联以 E04 为主。
- 关于“独立本体知识服务未发现”的判断仅限本轮所查仓库范围，不排除外部平台、私人材料、其他分支或未检查系统已有能力。

## 3. 本轮没有进行的验证

- 未查询生产业务数据、抽查真实项目附件或核实全部历史完整性。
- 未调用带实际用户身份的 MCP 工具发现、Query/Action 或外部同步。
- 未以浏览器逐项验收业务页面；本轮没有产品页面变更。
- 未生成正式本体模型，未部署图存储、推理器或 Agent。
- 未确认公司制度、专家经验和实际流程之间的所有差异。

因此，蓝图中的“已核对实现”不可改写为“生产已验收通过”。

## 4. 本轮文档检查与门禁记录

文档核查：已回读两份文档，检查章节、样例与现状标记；51 处本地文件引用的目标存在、行号有效，蓝图使用的 E01～E22 均有对应证据。此项不等于浏览器中的图表渲染验收。

仓库门禁：已执行 `node scripts/verify-change.mjs`，退出码为 1，未通过完整门禁。前端测试共 527 项，525 项通过、2 项失败；失败文件为 `openApiManual.test.mjs` 和 `templateDetailDocumentSection.test.mjs`，均在导入 Vite/Rolldown 时因本机原生绑定缺失报错 `Cannot find native binding`（缺少 `@rolldown/binding-darwin-x64` 等绑定）。后续检查未全部运行。本轮没有更改依赖、锁文件或产品代码，也没有据此宣称业务规则测试全部通过。

本地运行状态：检查 `http://127.0.0.1:3103/api/health` 与 `http://127.0.0.1:3104` 均连接失败；未启动或重启服务，未完成在线验收。上述门禁和运行限制不影响文档内容回读，但不能作为本体试点已验收的证据。

Git/迁移/发布：只新增蓝图及本附录；不提交、不推送、不迁移、不发布。原有 `artifacts/SIDM说明书-批注修订版/` 未修改。

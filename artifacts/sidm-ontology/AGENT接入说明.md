# SIDM本体智能体接入

本体查询统一使用`sidm_standard_ontology_query`，沿OWL/RDF、HermiT、SHACL、SPARQL执行。旧JSON本体工具已删除。

- [现有SIDM Query MCP接入](standard/Query-MCP接入说明.md)
- 本机 Codex 可使用 `standard/stdio-server.mjs` 独立 STDIO 入口；同机凭据与真实调用报告只保留在本地，不随 Git 交付。
- [业务定义与维护](standard/业务定义维护记录.md)
- 实际业务样本的验证报告保留在本机。Git 交付标准定义、执行代码和虚构测试样例；正式平台身份握手与生产运行仍需独立验收。

智能体检查每条答案的`validationStatus`与`validationIssues`，保留来源和范围，不将登记付款等同于外部真实支付凭证。

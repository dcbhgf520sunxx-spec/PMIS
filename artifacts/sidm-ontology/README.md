# SIDM本体工程

唯一建设与执行路径：**OWL/RDF → HermiT → SHACL → SPARQL**。旧JSON本体模型、规则计算器、旧MCP、原型测试和过期报告已删除。

## 从哪里开始

- [教材](SIDM本体落地教材.html)：解释业务本体、交付物和智能体调用。
- [标准工程](standard/README.md)：模型、约束、查询、测试与运行入口。
- [Query MCP接入](standard/Query-MCP接入说明.md)：当前系统接入与权限。
- [业务定义维护](standard/业务定义维护记录.md)：业务依据、确认状态与维护责任。
- 实际业务样本和对应验证报告只保留在本机，不随 Git 交付；标准引擎和虚构样例可按下述命令独立复核。

## 根目录保留文件

`read-chain.mjs`、`commerce.mjs`、`operations.mjs`、`delivery.mjs`只负责授权只读采集，不再包含旧关系转换、业务规则计算或旧命令行入口。`mapping.json`只负责接口字段与枚举映射，不是本体定义。

模型、标准校验与查询位于`standard/`。两份标准验证仍需读取的历史样本已移至Git忽略的`standard/local-output/archived-input/`；其他旧原型快照与输出已删除。正常接口与结果JSON继续作为数据载体。

```sh
node --test artifacts/sidm-ontology/read-chain.test.mjs
artifacts/sidm-ontology/standard/.venv/bin/python artifacts/sidm-ontology/standard/verify.py
```

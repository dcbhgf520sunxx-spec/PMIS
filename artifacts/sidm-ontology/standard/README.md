# SIDM 标准本体工程

本目录沿标准本体技术路径建设：**OWL 2 DL → RDF实例 → HermiT推理 → SHACL校验 → SPARQL查询**。唯一权威OWL语义定义在 `sidm.ttl`，不再由上级JSON模型或JavaScript规则计算器定义执行结果。

2026-10-09已接入本地原有Query MCP，并以当前员工身份通过SDK真实数据调用及审计回读；平台HTTP凭据握手和线上部署尚未验证。真实业务样本与对应验证报告仅保留在本机，不随Git交付；仓库保留标准定义、执行代码和虚构测试样例。

## 文件是什么

| 文件 | 作用 |
|---|---|
| sidm.ttl | OWL本体的Turtle序列化；直接可读、可独立加载的权威模型 |
| sidm.owl | 同一模型的RDF/XML序列化，验证入口生成并核对两者等价 |
| shapes.ttl | SHACL Core和SHACL-SPARQL约束；检查具体实例的完整性及业务数据规则 |
| fixtures/valid.ttl | 明确虚构的完整业务样例，含全部14类对象与20种原始关系 |
| fixtures/missing-source.ttl | 缺来源需求对照：OWL开放世界下不矛盾，SHACL报缺项 |
| fixtures/contradiction.ttl | 矛盾对照：同一对象同时属于两类互斥阶段，HermiT必须拒绝 |
| queries/*.rq | 直接在RDF图上执行的SPARQL查询 |
| reports/ | 虚构样例的标准验证报告、推理后RDF、查询结果及工具版本 |
| local-output/ | 已授权采集及历史样本的验证输出，包含业务数据，Git忽略 |
| 验证问题.md | 建模前确定的业务问题与预期结论 |
| import_graph.py | 只将已保存导出的显式对象和关系装载为RDF，不调用旧规则计算答案 |
| reasoning.py | 实际调用Owlready2携带的Java HermiT推理器，原始RDF/XML直接传入Java |
| verify.py | 连续运行测试、标准推理、标准数据校验、查询和本机样本复核 |

## 如何独立复核

Python 3.9或以上与Java17。工程本地`.venv`和`.runtime`不提交，不修改系统默认工具。若使用其他已安装Java，通过`SIDM_ONTOLOGY_JAVA`指定可执行文件。

```sh
cd artifacts/sidm-ontology/standard
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python verify.py
```

`verify.py`会调用标准库的实现，而不是用Python重写本体推理规则。HermiT不可用、SHACL出错、测试预期不符时直接失败；不会降级成自定义推理或伪造报告。首次需下载依赖，此后用本地文件运行。

`sidm.owl`也可在Protégé等OWL工具中打开。本轮是否实际验证图形工具，以结果说明为准，不把兼容文件格式说成已经人工打开。

Git 包含已生成的 `model-view-data.cjs`，干净检出可直接展示本体定义。`docs/SIDM业务骨架.md` 是未随 Git 交付的本地业务讨论资料；缺少时标准验证仍执行 OWL、HermiT、SHACL 和 SPARQL，但报告将其来源标为 `not-provided`，不宣称已复核该资料。重新生成业务说明需要先提供这份已确认资料，再运行 `render-model.py`；仅运行标准验证不会重新生成展示说明。

## 建模与证据边界

- 业务对象定义和可确定的逻辑放入OWL。数据必须显式包含哪些属性、金额如何核对，放入SHACL。这是标准分工。
- 选择OWL 2 DL并使用HermiT。新增`hasProject`逆属性和`relatedProduct`属性链，是已有关系的明确推导；不会把任务直接归属从项目改成需求。
- 14类业务对象互斥；不同记录显式声明AllDifferent。OWL不默认认为不同IRI就是不同对象。
- 金额使用xsd:decimal；月份使用YYYY-MM字符串；日粒度使用xsd:dateTime的UTC零点作为日历编码，原粒度另外说明。已有真实时刻保留时区；无时区不会猜测补入。
- 原始断言图用于SHACL；推理图用于推导问题。不能先推理补出类型再掩盖原始数据问题。
- 历史导出验证和本轮重新授权采集分开保存，RDF保留源记录ID、环境、时间、接口和快照哈希。采集资料及真实样本报告只保留在本机。
- 付款聚合基于该快照中已登记的明细。缺页、未采集和外部未登记事实仍需读取边界证据，不由OWL凭空证明。
- 用户已确认一需求至多一项目、一项目至多一合同、运维合同按单链续签，数量限制由SHACL校验；运维合同录入即表示已付款，查询以合同金额表达已付款金额，无单独付款明细；人工转项目判断和外部OA、银行事实不编码成自动推断。
- 标准查询已接入现有SIDM Query MCP，不替换原查询或Action确认链；本机Codex已原生调用项目范围工具，运维扩展已由新启动的本机STDIO MCP子进程验证。线上接入仍须由正式平台实际调用标准执行链并提供调用证据。

标准及工具：[OWL 2](https://www.w3.org/TR/owl2-primer/)、[SHACL](https://www.w3.org/TR/shacl/)、[Owlready2/HermiT](https://owlready2.readthedocs.io/en/v0.49/reasoning.html)、[pySHACL](https://github.com/RDFLib/pySHACL)。

金额精度说明：运行时直接将RDF/XML交给HermiT，保留原始十进制断言，仅添加推理器实际输出的类型和关系结论。已用大于JavaScript安全整数范围且带分位的金额验证不发生舍入；不经过Owlready2的Python数值转换来回写金额。

## 维护与使用入口

业务口径从 `docs/SIDM业务骨架.md` 开始，OWL定义使用本目录 `sidm.ttl`，当前系统实例约束使用 `shapes.ttl`。旧JSON本体模型、旧规则工具与报告已删除；上层采集模块仅保留只读传输能力，历史标准验证输入位于`local-output/archived-input/`。

现有Query MCP与本机STDIO连接统一调用 `sidm_standard_ontology_query`。智能体必须检查逐条 `validationStatus` / `validationIssues`；“异常待核实”不能表述为已核对结论，“通过已执行校验”也不证明银行付款、跨请求事务一致性或尚未建模的业务。

定义维护见[业务定义维护记录](业务定义维护记录.md)，Query MCP接入见[接入说明](Query-MCP接入说明.md)。

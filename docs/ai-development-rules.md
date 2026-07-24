# AI 开发规则

本规则用于约束后续 AI 的所有业务页面变更，包括新增、优化、修复、重构和字段/接口调整；目标是让列表页、新增编辑页、详情页稳定复用页面样板和组件库，不再在业务页面临时拼一套样式和交互。

完整交付流程、路由菜单权限、接口、数据库和发布要求以 `docs/ai-delivery-flow.md` 为准；本文件只负责页面样板和组件规则。

## 入口顺序

进行业务页面变更前，必须先按页面类型找到对应样板：

- 列表页：优先使用 `TemplateListPage`、`CompactFilterBar`、`SearchTable`、`TableFooterBar`、`TablePagination`。
- 新增编辑页：优先使用 `TemplateFormPage`、`TemplateFormSection` 和 `AdminProForm*` 表单控件。
- 详情页：优先使用 `TemplateDetailPage`、详情分组、信息栅格、状态、历史记录和操作组件。
- 弹窗、气泡确认、状态变更、删除确认、动作菜单、下拉搜索、空状态、加载态，优先走 `components/admin` 下的组件。

业务页面只负责传字段、传数据、处理接口和业务动作，不负责重新定义通用视觉、交互节奏、空状态、错误态、按钮样式和下拉样式。

## 能力检索与用户说法映射

用户通常描述界面效果，代码则使用组件名和属性名，两者可能不一样。AI 在判断“底座没有这个能力”之前，必须按“用户说法和同义词 → 下表能力映射 → 组件入口 → 组件工作台示例 → 实际行为和测试”的顺序核对，不能只搜索一个技术关键词。确认已有能力时直接复用；确认缺失时，结论中必须列出已核对的组件入口和工作台示例。

开发新功能时，能力检索结果必须在开始实现前通过“组件支撑情况”向用户展示，不能只在 AI 内部完成判断。支持结论只使用以下四类：

- **全部支持**：现有页面样板和组件可直接组合，列出实际入口和工作台示例。
- **部分支持**：分别列出直接复用和需要扩展的部分，说明扩展落在组件层还是业务层。
- **暂不支持**：列出已经核对的入口、工作台示例和测试证据，再说明采用业务特例还是补充底座。
- **不涉及前端组件**：适用于纯接口、脚本或配置功能，组件和工作台示例填写 `-`。

支持结论为“部分支持”或“暂不支持”时，必须给出明确的建议结论：低频、一次性且业务特有、没有明确复用价值的能力，允许业务系统自行开发并选择“业务内最小处理”；现有组件职责匹配、只是能力不足时建议“扩展现有底座组件”；多个业务会复用且现有组件职责不适合承接时建议“新增底座组件”。结论必须说明复用范围、职责边界和影响范围。建议扩展或新增底座组件时，先完善底座、组件工作台示例和测试，再让业务页面调用；选择业务内最小处理时，不要求为单一业务建立通用组件。

不得只写“复用现有组件”或“底座不支持”而不给证据，也不得在清单尚未输出时先写业务页面、事后补清单。

| 用户常用说法 | 底座能力与调用方式 | 实际行为 | 组件工作台示例 |
|---|---|---|---|
| 详情页 Tab、顶部页签、详情分类、锚点导航、点击定位 | `TemplateDetailPage.sectionNavigation`；参与导航的 `TemplateDetailSection`、`TemplateDetailTableSection`、`HistoryTimelineSection` 传唯一 `sectionKey` | 顶部生成分类标签，点击后定位到对应详情区域；它不是切换或隐藏内容的页面切换 Tab，窄屏时自动改为下拉定位 | `frontend/src/modules/design-system/pages/demos/DetailTemplateDemo.tsx` |
| 详情页页面切换、详情子页面、详情路由页签 | 为 `TemplateDetailPage.sectionNavigation` 传入 `items`、`activeKey` 和 `onChange`；业务层在 `onChange` 中更新路由并只传当前页面内容 | 与导航定位使用同一套分类导航样式，点击后切换地址和页面内容，不滚动定位；窄屏时使用同一套下拉切换 | `frontend/src/modules/design-system/pages/demos/DetailTemplateDemo.tsx` |
| 普通页面分类切换、跨页面分类页签 | 使用 `DetailSectionNavigation`；由业务层在 `onChange` 中调用 `navigate(targetPath)`，并根据当前路由或查询参数传入选中项 | 与详情分类导航保持同一套样式，点击后切换到不同页面或路由，只展示目标页面内容 | `frontend/src/modules/design-system/pages/sections/BaseSection.tsx` 的“页面分类切换”示例 |
| 列表数据视图 | 使用 `ViewTabs`；根据当前视图传入选中项和真实统计数量 | 切换同一列表的数据范围，不切换页面；必须遵守列表统计规则 | `frontend/src/modules/design-system/pages/sections/BaseSection.tsx` 的“列表数据视图切换”示例 |
| 可编辑表格、动态明细、付款阶段、预算明细、表单中增删多行 | 在 `TemplateFormPage` 内使用 `AdminProFormEditableList`，通过 `fields` 组合 `AdminProForm*` 字段控件 | 业务方只定义字段、校验、默认值和 `compact` / `standard` / `wide` 三档受控宽度；底座统一实际列宽、序号、增删、最少行数、响应式以及保存取消 | `frontend/src/modules/design-system/pages/sections/input/EditableDetailListExamples.tsx` |
| 附件、上传附件、多附件、已有附件、下载附件、删除附件 | 按钮选择使用 `AdminAttachmentUpload`，拖拽上传使用 `AdminAttachmentDragger`，由业务方传入附件数据、上传与删除动作，并通过 `onLoadPreview` 和 `onDownload` 分别提供预览内容与下载动作 | 两种入口共用附件列表、格式图标、上传进度、失败重试、名称预览、图标下载和删除确认；图片明确支持 JPG、JPEG、PNG、GIF、WEBP、BMP、SVG、AVIF、HEIC，PNG 的标准类型、旧类型和缺失类型均按扩展名正确识别；图片和 PDF 由底座弹窗预览，不支持在线预览的格式明确提示下载；文件格式、附件数量和附件大小仅在业务方明确传入规则时校验 | `frontend/src/modules/design-system/pages/sections/input/AdvancedInputExamples.tsx` |
| 左右分栏、拖拽面板、双栏工作台、目录与预览同屏 | 使用 `AdminSplitPane`，传入左右两侧内容；需要记住个人调整宽度时传唯一 `storageKey` | 底座统一承接拖拽、键盘调宽、左右宽度边界、窄屏上下堆叠和可选的个人宽度记忆；业务页面只放各自的列表、预览或详情内容。基础档案是已落地用法，判断能力时应同时核对该真实页面 | `frontend/src/modules/design-system/pages/sections/layout/SplitPaneExamples.tsx`、`frontend/src/modules/archive/pages/ArchivePage.tsx` |
| 异步任务、后台处理中、解析进度、导出进度、失败重试 | 使用 `AdminAsyncTaskStatus`，传入任务状态、标题、进度、失败原因和重试回调 | 底座统一显示等待、执行中、完成、失败、进度和重试；运行中不重复暴露重试入口，业务负责真实任务接口、轮询或消息订阅 | `frontend/src/modules/design-system/pages/sections/feedback/AsyncTaskStatusExamples.tsx` |
| 多步骤流程、阶段导航、办理步骤、审核步骤 | 使用 `AdminStepNavigation`，传入步骤项、当前步骤和切换回调 | 底座统一步骤导航外观、完成/当前/等待状态和窄屏表现；业务负责每一步的数据、校验、保存以及是否允许进入下一步 | `frontend/src/modules/design-system/pages/sections/layout/StepNavigationExamples.tsx` |

判断标准固定为：详情页同一页面内定位时，为 `sectionNavigation` 传 `true` 并让全部分组声明 `sectionKey`；详情页切换页面或路由时，为 `sectionNavigation` 传 `items`、`activeKey` 和 `onChange`，只渲染当前页面内容。普通页面的分类切换直接使用 `DetailSectionNavigation`。这些模式复用同一套分类导航样式；只有列表数据视图使用 `ViewTabs`。不得用 `ViewTabs` 重做分类导航，也不能因为代码名称不是 `Tabs`，就误判底座不支持用户所说的页签效果。

## 新业务接入样板

新增后台业务模块默认遵循当前架构：React / Vite 前端、Express REST API、PostgreSQL 数据库。常规目录如下：

```text
frontend/src/modules/<module>/pages/<Module>ListPage.tsx
frontend/src/modules/<module>/pages/<Module>FormPage.tsx
frontend/src/modules/<module>/pages/<Module>DetailPage.tsx
frontend/src/modules/<module>/types.ts
frontend/src/api/<module>Api.ts
backend/src/controllers/<module>Controller.js
backend/src/routes/<module>.js
```

API 接入保持统一：

- 前端通过 `request` 和 `unwrap` 调接口，接口返回统一为 `{ code, message, data }`。
- 表单字段校验失败统一在响应顶层返回 `fieldErrors: Record<string, string[]>`，后端使用 `failField` 生成；数据库唯一约束冲突必须转换为同一结构，不能返回 500 或只返回一段供前端匹配的文字。
- `TemplateFormPage` 自动把结构化字段错误回填到字段下方并滚动到第一个错误字段；前后端字段名不一致时通过 `fieldNameMap` 声明映射。业务页面不得通过 `error.message.includes(...)` 手工匹配错误文字。
- 后端字段使用数据库命名，前端 API 层负责转成页面需要的 record。
- 页面读取接口必须为关键返回字段传入 `objectContract` / `arrayContract` 运行时契约；写接口返回业务对象时同样必须传入运行时契约。字段名不匹配时直接报错，不能静默渲染 `undefined`。
- 前端 `id` 统一转成字符串，后端写入时再转成数字。
- `creator_id`、`updater_id` 和操作日志 `user_id` 必须由后端从 `req.user.id` 取得，前端请求体不得提交或覆盖操作者身份。
- 新增、编辑、删除、状态变更、批量操作和权限分配都遵守同一身份来源；业务控制器不得从 `req.body` 解构 `creator_id` 或 `updater_id`。
- 新模块路由统一注册到 `frontend/src/app/routes.tsx`。
- 数据库物理表名必须使用 `pms_` 前缀。

## 核心页面模板入口

后续新增、优化或改造业务模块时，列表、新增编辑、详情三类页面必须从页面级模板入口开始，不直接在业务页拼 `PageShell`、`DataListPage`、`FormPage`、`TablePagination` 或详情页外层布局。

业务页面只保留业务字段、接口调用、筛选状态、列配置和业务动作。页面结构、页头、操作区、列表底部、表单分组、详情分组、主区/侧区等由模板入口承接。

后台框架顶部说明属于全局契约：除组件工作台外，统一显示“欢迎回来，今天也请从容处理每一项工作。”，不得按业务模块自定义顶部标题或文案。组件工作台可保留用于说明设计系统上下文的专属标题和说明。

### 标签与色彩

- 不需要区分多个值的普通标签使用不传颜色的 `AdminTag`；同一分类维度存在多个值时使用 `CategoryTag`，由业务模块通过 `defineCategoryToneMap` 集中声明业务值与受控色调的映射，底座不定义“某业务类型应使用什么颜色”。
- 同一分类维度的不同值不得使用相同色调，同一业务值在同一系统内必须保持色调稳定。业务页面不得直接写死 `tone`，不得给 `AdminTag` / `CategoryTag` 传入 `color`，也不得直接使用原生 `Tag` 绕过约束。
- 状态、紧急程度、逾期等具有固定语义的信息必须使用对应统一标签组件，不得用普通分类标签模拟。
- 分类色板只提供蓝、青、靛、紫、品红等非状态色调；成功、警告、危险等语义色不进入分类色板。

### 列表页

列表页统一使用 `TemplateListPage`；本地数据使用 `useTemplateListPageData`，服务端分页数据使用 `useTemplateServerListData`。

必须保持以下规则：

- 第一列业务值进入详情，操作列不放“详情”。
- 普通列表字段由 `SearchTable` 统一在超出列宽时显示省略号，并在悬停时展示完整内容；详情入口由 `DetailLinkCell` 自动使用文字内容作为悬停提示。业务页面不重复实现截断和提示；枚举、状态、标签等自定义渲染仍由对应公共组件负责完整内容展示。
- 每个可见列必须声明数值型 `width`，保证 `SearchTable` 能生成列宽拖拽手柄；包含序号列时，序号列和紧随其后的第一业务列都必须声明 `fixed: 'left'`，不含序号列时固定第一业务列；存在操作列时必须声明 `fixed: 'right'`，只读列表不强制新增操作列。
- 存在固定列的标准列表必须通过 `TemplateListPage.table.scroll.x` 声明足够的横向宽度；不能只写 `fixed` 而没有横向滚动区域。
- 固定列属于代码强制结构，优先级高于用户历史列设置；列设置可以保留显示、顺序和非强制列固定偏好，但不得覆盖代码声明的左右固定列。
- 除序号列和操作列外，标准列表每个可见列都必须声明 `sorter: true`；服务端分页列表同时绑定 `sortOrder` 并把统一排序状态传给接口。
- 标准业务列表的最后两个业务列必须依次为“创建人”（`creatorName`）和“创建时间”（`createdAt`），并紧邻操作列之前；没有操作列时“创建时间”就是最后一列。两列必须返回真实数据、声明数值型 `width` 并支持排序。访问日志等不存在“创建人”业务语义的系统事件列表属于明确例外。
- 操作列使用 `OperationColumnActions`，最多 3 个动作直接展示；4 个及以上时由组件保留前 2 个，第 3 个及之后收入“更多”。动作统一使用文字形态：普通动作使用 `AdminTextAction`，删除使用 `DeleteConfirmAction variant="text"`，状态变更使用 `StatusChangeAction variant="text"` 或以它为底层的业务 `*StatusChangeAction`。
- 删除不得使用通用 `ConfirmAction danger` 或业务自建 `Modal`；启用、停用等二态确认使用 `StatusConfirmAction`。
- `ConfirmAction`、`StatusConfirmAction`、`DeleteConfirmAction` 和 `BubbleConfirmAction` 默认负责成功提示；业务页需要自定义静态文案时传 `successMessage`，需要根据接口结果动态提示时传 `successMessage={false}` 后自行提示，同一次操作不得由组件和业务页重复提示。
- 序号使用 `renderIndex(index)`，按过滤后的全量数据位置计算。
- 本地数据排序交给 `useTemplateListPageData`，先排序过滤后的全量数据，再分页。
- 服务端分页列表必须通过 `useTemplateServerListData` 请求数据，并把全部已提交筛选、当前视图和其他数据范围参数放入 `queryKey`。组件以查询上下文、分页和排序共同组成请求标识：上下文切换时立即隔离旧数据，统一输出加载和错误状态，只接收当前请求结果以避免请求乱序覆盖，并将页码原子重置为第一页。业务页面不得继续使用 `useEffect + setRows` 自行维护服务端列表，也不得只靠切换时清空数组遮盖问题。
- 用户只切换页码时必须保留所选页码，不能被筛选重置逻辑拉回第一页；只有已提交筛选、当前视图或其他查询上下文真正变化时才重置为第一页。
- 分页配置通过 `TemplateListPage.pagination` 传入，不在业务页直接放 `TablePagination`。
- 主子任务等低频层级列表继续使用 `TemplateListPage`，名称列通过 `HierarchyListCell` 统一方框开关、主子标识和子级缩进，不使用表格原生展开列，也不新增业务专用树表组件。父子数据按展示组平铺返回，父级记录分页，子级跟随父级且默认收起；父子关系校验、状态联动、进度汇总、权限和删除限制仍由业务模块处理。
- 普通列表不传选择列、批量操作和已选数量，分页保持在右侧。
- 批量列表必须显式声明 `mode="batch"`，并通过 `batch` 传入已选数量和批量操作。
- 筛选区使用 `CompactFilterBar`，表格区和底部分页区由模板承接。
- `ViewTabs` 在非列表场景中统计是可选能力；只要出现在 `TemplateListPage` 列表页中，就必须显式传入 `showCounts`，并为每个 Tab 传入真实 `count`，后端必须提供对应统计口径。
- 启用统计的服务端分页列表统一返回 `viewCounts`，统计口径为“公共查询条件 + 当前 Tab 的数据范围”。查询条件和视图范围必须使用不同参数表达，不能让同一个 `owner_id`、`follower_id` 同时承担查询筛选和“我的”范围；存在冲突条件时，由视图配置通过 `omitFilters` 明确排除。后端优先复用 `calculateViewCounts` 和 `buildViewQuery`，业务层只声明各视图的范围条件。
- 启用统计后，前端不得使用当前页 `rows.length`，不得把当前视图的 `total` 复用到其他 Tab；模块测试必须覆盖公共查询条件进入全部视图、各视图范围条件正确追加、冲突查询条件按配置排除。

### 抽屉表格

抽屉内承载完整列表时统一使用 `TemplateDrawerTable`，不得在 `AdminDrawer` 中直接拼装列表结构。

必须保持以下规则：

- `TemplateDrawerTable` 内部复用 `TemplateListPage embedded`，筛选、表格、批量操作和分页口径与标准列表一致。
- 排序和分页使用 `useTemplateListPageData`，必须先排序过滤后的全量数据，再截取当前页。
- 每个抽屉表格通过 `SearchTable.preferenceKey` 传入稳定且唯一的标识，避免同一路由中的列宽、密度和列设置互相覆盖。
- 业务页面只传抽屉标题、说明、筛选项、列配置、数据状态和业务动作，不重复实现抽屉高度、表格主体和底部栏布局。

### 新增编辑页

新增编辑页统一使用 `TemplateFormPage` 和 `TemplateFormSection`。

必须保持以下规则：

- 表单页标题、返回、取消、提交、加载态由模板承接。
- 点击保存和回车提交必须走 `TemplateFormPage` 的同一提交入口；业务页不得另写一套提交按钮或错误处理链路。
- 编辑页数据加载失败或记录不存在时，通过模板的 `error`、`notFound`、`onRetry` 展示统一状态，不能留下空表单或一直加载。
- 唯一性等服务端字段校验通过结构化 `fieldErrors` 展示在对应字段下方；没有字段归属的业务错误和网络异常才使用全局消息。
- 后端已能明确归属到表单字段的校验错误必须使用 `failField` 返回，禁止用普通 `fail` 或手写响应降级为顶部全局提示。
- 业务页只传 `formId`、初始值、提交回调和业务字段。
- 业务方只能定义字段、字段顺序、字段控件、选项、校验、默认值以及接口数据转换。标题区、分组外观、字段布局、保存取消、提交状态、错误反馈和未保存保护全部由 `TemplateFormPage` / `TemplateFormSection` 承接；不得在业务页增加第二套保存取消按钮，也不得覆盖公共表单样式。
- 字段布局优先使用模板内置 grid class，不在业务页另起一套表单布局。
- 表单控件优先使用 `AdminProForm*` 或项目已沉淀表单组件。
- 弹窗和局部表单使用 `AdminModal`、`Form`、`AdminFormItem` 与底座输入控件组合。业务页不得使用原始 `Form.Item`，不得用 HTML `label` 手工拼字段标签，也不得用 `message.error('请输入/请选择/请填写……')` 代替字段校验；必填、格式和可归属到字段的服务端错误必须显示在对应字段下方。无字段归属的保存失败、网络异常等才允许使用全局消息。
- 业务模块不得直接使用原生 `button`、`input`、`select`、`textarea`，也不得通过导入别名或命名空间改名绕过组件审计；交互入口和字段控件统一使用 `components/admin` 已沉淀能力。
- 表单中需要新增、删除多行结构化明细时统一使用 `AdminProFormEditableList`，并且必须位于 `TemplateFormPage` 内。业务页只通过 `fields` 声明中文字段名、字段控件、校验规则以及 `compact` / `standard` / `wide` 三档受控宽度，通过 `creatorRecord` 声明新增行的业务默认值，通过 `rules` 声明整组数据校验；实际列宽、新增文案、自动序号、删除方式、最少行数、电脑端表格布局、窄屏卡片布局和保存取消由底座统一。电脑端表格按字段数量和底座宽度规格展示，不强制铺满页面；字段较多并超过可用区域时允许横向滚动，并由组件固定左侧序号列和右侧操作列。金额字段统一使用 `AdminProFormMoney`，默认保留两位小数。序号仅用于展示，不得作为业务字段提交。业务页不得直接使用 `ProFormList`、`Form.List`、`EditableProTable`，也不得向 `AdminProFormEditableList` 传入像素列宽、`columns`、`addText`、`minRows`、`maxRows`、`readonly`、`className` 或 `style` 改写公共结构。
- 业务附件按钮入口使用 `AdminAttachmentUpload`，拖拽入口使用 `AdminAttachmentDragger`。业务方负责提供已有附件数据、上传、下载、删除回调以及确有需要的校验规则；预览必须通过 `onLoadPreview` 返回 `Blob` 文件内容，由底座统一判断格式和展示，不得自行打开窗口或复用下载动作冒充预览。已有附件提供下载时必须同时传入 `onLoadPreview`，提供预览内容时也必须同时传入 `onDownload`，不得只接其中一项。底座统一承接多附件列表、真实格式图标、上传进度、失败原因与图标重试、点击名称预览、图标下载、图标删除确认和响应式样式。图片上传明确支持 JPG、JPEG、PNG、GIF、WEBP、BMP、SVG、AVIF、HEIC；校验图片类型时必须同时兼容浏览器上报的标准类型、旧类型和缺失类型，不能因 PNG 上报 `image/x-png` 或空类型而误拦截。图片和 PDF 在底座弹窗内预览，预览弹窗右上角提供“新窗口打开”，用于放大或长时间查看；Word、Excel、压缩包等浏览器不支持的格式统一提示“该格式暂不支持在线预览，请下载查看”，不打开空白页。附件上传区域在宽屏最大宽度统一为 `760px`，窄屏占满可用宽度。业务页面不得选择附件宽度模式，也不得通过 `className`、`style` 或页面级样式改写组件内部布局。已上传附件保持单行紧凑展示，名称过长时省略，文件大小和操作不换行；上传完成后不重复展示“上传成功”。底座不内置文件格式、附件数量和附件大小限制；业务方未传对应规则时不限制。头像、导入文件等不需要完整附件列表和管理流程的轻量场景，可以继续使用 `AdminUpload`。

### 详情页

详情页统一使用 `TemplateDetailPage` 和 `TemplateDetailSection`。

必须保持以下规则：

- 详情页标题、操作区、主区/侧区和加载态由模板承接。
- 有状态详情必须通过 `statusSection.items` 声明全部状态类标签，模板自动把同一组非空标签按相同顺序展示在标题后和右侧当前状态区；空值、空字符串和 `-` 只保留在右侧，不在标题后展示。业务页不得另传 `titleTags`，不得通过 `statusSection.children` 自定义第二套状态样式。单据编号通过 `titleCode` 单独传入。状态操作通过 `statusAction` 紧跟在当前状态区之后；右上角 `actions` 只放编辑等页面级操作。
- 状态变更统一使用 `StatusChangeAction` 或以它为底层的业务封装。业务状态组件必须直接渲染公共 `StatusChangeAction`，仅使用 `*StatusChangeAction` 名称但内部自行拼按钮或弹窗仍属违规。目标状态语义固定为：普通操作蓝色、正向操作绿色、危险或反向操作红色；业务页面不得直接使用 `StatusFlowModal`，不得创建自维护开关和目标状态的重复弹窗。
- 返回列表通过 `TemplateDetailPage.onBack` 传入，业务页不重复创建“返回列表”按钮和操作栏外壳。
- 接口失败或记录不存在时，通过模板的 `error`、`notFound`、`onRetry` 展示统一状态，不能无限显示加载中。
- 基础信息、单据信息、历史记录等使用详情分组和 `DetailMetaList`；使用 `HistoryTimeline` 的详情分组统一命名为“变更历史”，不得继续使用“操作历史”“操作记录”等旧名称。
- `DetailMetaList` 对 `null`、`undefined`、空字符串和纯空格统一显示 `-`；业务页面直接传原始值，不得自行改成“暂无描述”“暂无内容”等其他空值文案，也无需逐字段编写 `|| '-'`。普通文本字段默认最多显示两行，超出显示省略号并悬浮展示完整内容；角色、权限、人员、区域等聚合字段可继续通过 `aggregate` 显式声明。描述、备注、进展、风险等需要完整阅读的长文本通过 `longText` 声明，组件自动保留手工回车并完整换行，业务页面不得自行拼接换行标签或覆盖文本样式；富文本继续直接传入 `RichTextViewer`。长文本和富文本的空值同样显示 `-`，有内容时不截断、不提供展开/收起。业务页面不得自行实现另一套截断和提示逻辑。
- 详情页中的子任务、明细和关联记录等结构化数据统一使用 `TemplateDetailTableSection`，不得在 `TemplateDetailSection` 中直接放置 `SearchTable`、原生表格或复用 `TemplateListPage embedded`，也不得通过业务包装组件绕过；严格组件审计必须阻断这些直接和间接调用。组件默认只做纯数据展示，不自动增加详情链接和操作列；需要查看或管理时，由业务列显式声明 `DetailLinkCell` 和 `OperationColumnActions`。传入 `table.scroll.x` 后，组件在横向滚动时自动固定首个业务列，并为滚动条预留底部空间，业务页不重复设置相关样式。筛选、批量操作或复杂分页较多时，应进入独立列表页或 `TemplateDrawerTable`，不能把完整列表页工具栏塞进详情分组。
- `TemplateDetailSection.inlineExtra` 只承接标题后的统计或轻量上下文，右侧主要业务动作通过 `extra` 传入；`TemplateDetailTableSection.summary` 和 `extra` 分别承接关联数据摘要与新增等操作。
- 详情页变更历史统一使用 `HistoryTimelineSection`，由它把方框加号/方框减号的“全部展开/全部收起”图标按钮紧跟在“变更历史”标题之后，并使用同一套图标承接单条展开/收起；业务页面不得使用 `TemplateDetailSection + HistoryTimeline` 拼装，不得维护 `expandedKeys`、`onExpandedKeysChange` 或通过 `inlineExtra` 重复实现。
- 同一次保存或状态变更产生的多字段日志必须共享 `pms_op_log.operation_id`，历史接口按该标识聚合为一个节点；聚合节点内的字段顺序必须复用对应详情页的字段顺序，禁止按日志写入顺序、数据库返回顺序或字段名排序。没有 `operation_id` 的历史日志按单条兼容展示，不能按“同一秒”猜测聚合。
- 变更历史进入 `HistoryTimeline` 前必须完成转译，使用中文字段名和业务展示值：人员和关联对象 ID 转为名称，枚举和状态码转为中文含义，日期使用页面统一格式。后端优先复用 `formatHistoryChanges` 并显式声明 `fieldLabels`、`valueLookups` 和 `dateFields`；不得把 `field_name`、`*_id`、枚举编码等数据库原始值直接交给前端或组件。
- 变更历史中的问题描述、Bug 描述、任务描述、需求描述等描述类富文本统一由 `HistoryTimeline` 生成纯文字摘要；内容包含图片时只追加 `〔图片〕` 标记，不在时间线中直接渲染图片或富文本源码，业务页面不得重复实现字段特判。
- 长详情页存在较多分类且需要快速定位时，必须使用 `TemplateDetailPage.sectionNavigation` 以及 `TemplateDetailSection.sectionKey` / `TemplateDetailTableSection.sectionKey` 提供的顶部分类导航；开启分类导航后，每个参与导航的详情分组都必须声明唯一 `sectionKey`。不得在业务页重复维护分类数组、自建锚点或滚动监听，窄屏下拉定位由模板自动承接。
- 详情页需要页面切换时，必须为 `TemplateDetailPage.sectionNavigation` 传入 `items`、`activeKey` 和 `onChange`，由业务层更新路由并且只渲染当前页面内容；页面切换和导航定位必须使用模板提供的同一套分类导航样式，业务页不得另放一套 `ViewTabs` 或自定义页签样式。
- 详情页返回、编辑等动作通过 `ActionBar` 和现有按钮组件组合。
- 不在业务页临时重做详情卡片、字段栅格、状态展示和历史记录样式。

## 禁止绕开组件

业务模块中不得直接使用下列原生控件实现通用能力：

- `Input`、`Input.TextArea`
- `DatePicker`、`DatePicker.RangePicker`
- `Select`、`TreeSelect`、`Cascader`
- `Modal`、`Popconfirm`、`Drawer`
- `Dropdown`
- `Empty`
- `ProFormText`、`ProFormTextArea`、`ProFormDatePicker`、`ProFormSelect`
- `ProFormList`、`Form.List`、`EditableProTable`
- `Upload`、`Upload.Dragger`（头像、导入文件等已说明原因的轻量场景除外）

如果确实需要这些能力，先使用现有 `Admin*` 组件；现有组件不满足时，先扩展或新增组件，再让业务页面调用。

## 缺口处理

遇到样板或组件不满足需求时，按下面顺序处理：

1. 判断是否已有组件参数可以覆盖，不新增代码。
2. 如果是可复用能力，扩展组件层或页面样板。
3. 如果只是单个业务页面的真实特例，限定在当前页面内做最小差异，并写清原因。
4. 不确定时，先说明差异点、影响范围和建议方案，再继续改。

不得为了赶进度先用原生控件拼页面，再事后对齐样式。

## 双栏工作台与异步任务规则

- 需要左侧目录、规则、记录列表与右侧预览、详情、处理区同时出现，且用户需要调整阅读空间时，统一使用 `AdminSplitPane`；业务页面不得自行实现鼠标拖拽分隔线、宽度记忆或另一套窄屏折叠逻辑。
- `AdminSplitPane` 只负责通用布局。左侧内容、右侧业务内容、默认宽度和最小宽度可由业务页面传入；确有“记住个人宽度”需要时，使用模块内唯一的 `storageKey`，不得多个页面共用同一个键。
- 解析、导出、重新提取、重新审核等异步任务，统一使用 `AdminAsyncTaskStatus` 展示等待、执行中、完成和失败。业务页面负责真实状态来源、轮询/订阅和重试调用；不得另拼进度条、失败文案和重试按钮。运行中不应再次提供重试入口，避免重复发起任务。
- 有明确先后顺序的多步骤页面统一使用 `AdminStepNavigation`；业务页面只传步骤、当前步骤和切换回调，不得另拼步骤条样式。每一步的业务内容、保存时机、前置校验和是否允许跳转由业务模块处理，底座不固化具体流程。
- 文件排序、PDF 页码/坐标标注、审核规则、证据卡片和报告内容属于具体业务，不因使用上述通用组件而沉淀到底座。

## 查询和下拉规则

- 查询区输入只更新草稿条件，点击“查询”或文本回车后才提交筛选。
- 标准列表必须为 `useCommittedFilters` 以及对应的 `useTemplateListPageData` / `useTemplateServerListData` 启用 `urlSync: true`；只把已提交筛选、当前视图、分页和排序写入 URL。输入草稿、勾选行、弹窗状态不进入 URL，列宽、列显隐和密度继续使用用户偏好。
- 列表进入详情、新增、编辑或复制必须使用 `usePageReturnNavigation.navigateWithReturn` 携带完整列表来源；详情和表单必须使用 `returnToSource` 返回。保存、取消、删除和“返回列表”使用替换历史，禁止硬编码 `navigate('/模块列表')`。
- `returnTo` 只允许当前模块内的站内相对地址；非法、跨模块或外部地址必须回退到模块默认列表。详情相邻记录切换必须保留当前 `returnTo`，无来源的直接访问不得复用旧列表上下文。
- `TemplateFormPage` 统一启用未保存离开保护，覆盖取消、菜单跳转、浏览器前进后退、刷新和关闭；保存成功后清除保护。业务页不得重复弹确认框或绕开模板。
- 标准列表从详情或编辑返回时恢复同一 URL 对应的页面纵向位置和表格横向位置；重新查询或切换到不同 URL 后使用各自位置。
- 收起状态展示数量必须同时受 `visibleCount` 和容器当前一行容量约束；浏览器缩放或窗口变窄导致一行容量下降时，自动减少首行条件并显示“展开”，不得用固定高度裁掉不可访问的条件。
- 下拉单选、多选、树选择、级联选择默认支持筛选。
- 筛选无数据必须显示中文空状态，例如“暂无数据”，不能出现英文 `No data`。
- 批量指派、人员选择等需要搜索的动作入口，使用带搜索能力的组件。

## 状态流转契约

包含三个及以上业务状态的模块，必须在模块测试中声明 `statusTransitions`，并同时覆盖：

- 允许的来源状态和目标状态；
- 禁止的跨级或反向流转；
- 特定目标状态要求的原因、处理结果等附加字段；
- 前端可选目标与后端校验保持一致。

状态矩阵属于业务规则，不写入通用组件；前端只展示当前状态允许的目标，后端仍必须独立拒绝非法流转和缺少附加字段的请求。

## 菜单权限规则

- 菜单权限以包含查询参数的完整地址为键；共享同一路径的页面分类不得只按 pathname 放权。
- 组件工作台的概览、页面样板、基础规范、布局、基础组件、输入、反馈和数据展示必须逐项独立授权，父菜单只负责分组和补齐祖先展示，不能自动放开兄弟菜单。
- 一级菜单顺序固定为首页、运维工单、基础设置、用户权限、组件工作台；基础设置必须位于用户权限之前。

## 验收要求

每次业务页面变更后，必须完成：

- `npm run audit:components`
- `npm run audit:components:strict`
- `npm run audit:api-contracts`
- `npm run build`
- 浏览器实际检查核心页面，重点看筛选、排序、分页、弹窗、下拉、空状态和表单控件。
- 对列表和详情额外检查：操作列是否全为文字动作、4 个动作时是否按规则进入“更多”、标题状态标签是否存在、状态操作是否紧跟当前状态、删除和状态变更是否打开统一组件。

审查脚本出现阻断项时，不能交付；提醒项必须确认是否需要沉淀组件，不能忽略。

## 允许例外

以下场景可以保留原生控件，但必须控制范围：

- 登录页等不属于后台业务样板的页面。
- 组件工作台中用于展示底层组件原貌的区域。
- 第三方组件无法被当前封装承接的极少数场景，但必须在代码附近保留原因说明。

除此之外，用户、角色、基础档案、运维工单和后续所有业务模块、优化和修复都按组件和样板规则执行。

# AI 开发规则

本规则用于约束后续 AI 新增或改造业务功能，目标是让列表页、新增编辑页、详情页稳定复用页面样板和组件库，不再在业务页面临时拼一套样式和交互。

## 入口顺序

开发新业务前，必须先按页面类型找到对应样板：

- 列表页：优先使用 `TemplateListPage`、`CompactFilterBar`、`SearchTable`、`TableFooterBar`、`TablePagination`。
- 新增编辑页：优先使用 `TemplateFormPage`、`TemplateFormSection` 和 `AdminProForm*` 表单控件。
- 详情页：优先使用 `TemplateDetailPage`、详情分组、信息栅格、状态、历史记录和操作组件。
- 弹窗、气泡确认、状态变更、删除确认、动作菜单、下拉搜索、空状态、加载态，优先走 `components/admin` 下的组件。

业务页面只负责传字段、传数据、处理接口和业务动作，不负责重新定义通用视觉、交互节奏、空状态、错误态、按钮样式和下拉样式。

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
- 后端字段使用数据库命名，前端 API 层负责转成页面需要的 record。
- 前端 `id` 统一转成字符串，后端写入时再转成数字。
- 新模块路由统一注册到 `frontend/src/app/routes.tsx`。
- 数据库物理表名必须使用 `pms_` 前缀。

## 核心页面模板入口

后续新增或改造业务模块时，列表、新增编辑、详情三类页面必须从页面级模板入口开始，不直接在业务页拼 `PageShell`、`DataListPage`、`FormPage`、`TablePagination` 或详情页外层布局。

业务页面只保留业务字段、接口调用、筛选状态、列配置和业务动作。页面结构、页头、操作区、列表底部、表单分组、详情分组、主区/侧区等由模板入口承接。

### 列表页

列表页统一使用 `TemplateListPage` 和 `useTemplateListPageData`。

必须保持以下规则：

- 第一列业务值进入详情，操作列不放“详情”。
- 操作列使用 `OperationColumnActions`，默认文字操作；删除、停用等危险动作使用 `ConfirmAction`。
- 序号使用 `renderIndex(index)`，按过滤后的全量数据位置计算。
- 排序交给 `useTemplateListPageData`，先排序过滤后的全量数据，再分页。
- 分页配置通过 `TemplateListPage.pagination` 传入，不在业务页直接放 `TablePagination`。
- 普通列表不传选择列、批量操作和已选数量，分页保持在右侧。
- 批量列表必须显式声明 `mode="batch"`，并通过 `batch` 传入已选数量和批量操作。
- 筛选区使用 `CompactFilterBar`，表格区和底部分页区由模板承接。

### 新增编辑页

新增编辑页统一使用 `TemplateFormPage` 和 `TemplateFormSection`。

必须保持以下规则：

- 表单页标题、返回、取消、提交、加载态由模板承接。
- 业务页只传 `formId`、初始值、提交回调和业务字段。
- 字段布局优先使用模板内置 grid class，不在业务页另起一套表单布局。
- 表单控件优先使用 `AdminProForm*` 或项目已沉淀表单组件。

### 详情页

详情页统一使用 `TemplateDetailPage` 和 `TemplateDetailSection`。

必须保持以下规则：

- 详情页标题、操作区、主区/侧区和加载态由模板承接。
- 基础信息、单据信息、历史记录等使用详情分组和 `DetailMetaList`。
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

如果确实需要这些能力，先使用现有 `Admin*` 组件；现有组件不满足时，先扩展或新增组件，再让业务页面调用。

## 缺口处理

遇到样板或组件不满足需求时，按下面顺序处理：

1. 判断是否已有组件参数可以覆盖，不新增代码。
2. 如果是可复用能力，扩展组件层或页面样板。
3. 如果只是单个业务页面的真实特例，限定在当前页面内做最小差异，并写清原因。
4. 不确定时，先说明差异点、影响范围和建议方案，再继续改。

不得为了赶进度先用原生控件拼页面，再事后对齐样式。

## 查询和下拉规则

- 查询区输入只更新草稿条件，点击“查询”或文本回车后才提交筛选。
- 下拉单选、多选、树选择、级联选择默认支持筛选。
- 筛选无数据必须显示中文空状态，例如“暂无数据”，不能出现英文 `No data`。
- 批量指派、人员选择等需要搜索的动作入口，使用带搜索能力的组件。

## 验收要求

每次新增或改造业务页面后，必须完成：

- `npm run audit:components`
- `npm run audit:components:strict`
- `npm run build`
- 浏览器实际检查核心页面，重点看筛选、排序、分页、弹窗、下拉、空状态和表单控件。

审查脚本出现阻断项时，不能交付；提醒项必须确认是否需要沉淀组件，不能忽略。

## 允许例外

以下场景可以保留原生控件，但必须控制范围：

- 登录页等不属于后台业务样板的页面。
- 组件工作台中用于展示底层组件原貌的区域。
- 第三方组件无法被当前封装承接的极少数场景，但必须在代码附近保留原因说明。

除此之外，用户、角色、基础档案、运维工单和后续新业务模块都按组件和样板规则执行。

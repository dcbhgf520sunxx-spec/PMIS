# 可编辑明细表单实施计划

> 按现有底座最小扩展，测试先行，不引入新依赖，不涉及数据库变更。

## 一、先锁定组件契约

新增回归测试，确认以下能力不能缺失：

- 公共导出名为 `AdminProFormEditableList`。
- 底层复用 `ProFormList`。
- 支持列配置、新增行默认值、最少和最多行数。
- 自动序号不进入表单值。
- 电脑端表头/行布局与 760px 以下卡片布局同时存在。
- 组件工作台有真实表单示例。
- 业务模块直接使用 `ProFormList`、`Form.List`、`EditableProTable` 会被严格审计阻断。

先运行新增测试并看到失败，再开始实现。

## 二、实现公共组件

新增：

- `frontend/src/components/admin/AdminProFormEditableList/index.tsx`
- `frontend/src/components/admin/AdminProFormEditableList/index.css`

组件接口包含：

- `name`、`label`
- `columns`：表头、宽度和字段渲染函数
- `creatorRecord`、`addText`
- `minRows`、`maxRows`

实现要点：

- 使用 `ProFormList` 接入主表单。
- 每行把当前字段信息传给列渲染函数，业务方继续组合 `AdminProFormText` 等控件。
- 关闭 `ProFormList` 默认复制和删除图标，改用底座统一文字删除操作。
- 通过 CSS 自定义属性生成桌面网格列宽。
- 760px 以下隐藏表头、显示卡片字段标签。

## 三、补组件工作台和规则

- 在输入组件分类新增“可编辑明细表单”示例。
- 示例使用阶段名称、计划金额两个字段，使用通用“新增”文案，展示新增、删除、最少保留一行和校验。
- 在开发规则中补充能力映射与接入示例。
- 扩展组件使用审计，阻断业务页绕开公共组件。

## 四、验证

- 运行新增单测、组件审计、类型检查、构建和完整工程门禁。
- 浏览器打开组件工作台输入分类，实际验证：
  - 电脑端表头和行布局。
  - 新增、删除、最少一行提示。
  - 必填校验。
  - 窄屏卡片布局与字段标签。
- 检查后端 3101 健康接口和前端 3102 页面可访问。

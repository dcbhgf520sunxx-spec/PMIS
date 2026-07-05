export const overviewSpecs = [
  { label: '目标', value: '沉淀可长期复用的后台设计语言与组件用法' },
  { label: '风格', value: '科技蓝、低装饰、轻边框、清晰层级' },
  { label: '密度', value: '默认紧凑，列表、表单和详情优先保留工作区' },
  { label: '组件', value: '优先复用通用组件，新增能力必须沉淀' },
  { label: '页面', value: '覆盖列表、详情、表单、弹窗、抽屉和全屏态' },
  { label: '验收', value: '能展示、能复用、状态完整、交互中文化' }
];

export const qualityGateBlocks = [
  {
    title: '视觉检查',
    items: [
      { label: '颜色', value: '主色、hover、状态色没有跑偏' },
      { label: '高度', value: '筛选、表单、分页、按钮垂直居中' },
      { label: '对齐', value: '字段名、输入框、表头、操作区齐整' },
      { label: '空间', value: '工作区尽量大，底部栏不挤压内容' }
    ]
  },
  {
    title: '交互检查',
    items: [
      { label: '筛选', value: '必须点击查询后才变更列表结果' },
      { label: '表格', value: '排序、列宽、列设置、全屏、重置列宽可用' },
      { label: '弹窗', value: '按钮、必填、日期、下拉、中文化完整' },
      { label: '危险操作', value: '删除、批量删除必须二次确认' }
    ]
  },
  {
    title: '沉淀检查',
    items: [
      { label: '组件', value: '新增通用能力要进入组件工作台' },
      { label: '页面', value: '典型列表、详情、表单模式要能复用' },
      { label: '变量', value: '色彩、字体、间距与设计基础一致' },
      { label: '状态', value: '空数据、加载、禁用、危险确认完整' }
    ]
  }
];

export const componentGroups = [
  {
    key: 'overview',
    title: '总览',
    description: '确定设计方向、组件边界和验收口径。',
    items: ['方向', '边界', '验收', '沉淀']
  },
  {
    key: 'foundation',
    title: '设计基础',
    description: '统一色彩、字体、间距、圆角、阴影、图标和动效。',
    items: ['色彩', '字体', '间距', '圆角', '阴影', '图标', '动效']
  },
  {
    key: 'layout',
    title: '页面模式',
    description: '统一系统框架、列表、详情、表单、弹窗和抽屉。',
    items: ['框架', '列表', '详情', '表单', '弹窗', '抽屉', '全屏']
  },
  {
    key: 'base',
    title: '基础组件',
    description: '沉淀按钮、文字操作、图标按钮和状态标签。',
    items: ['按钮', '文字操作', '图标按钮', '状态标签', '标签', '徽标']
  },
  {
    key: 'input',
    title: '输入组件',
    description: '覆盖文本、数字、选择、日期、上传和富文本。',
    items: [
      '文本输入',
      '数字输入',
      '日期与时间',
      '下拉选择',
      '单选框',
      '复选框',
      '穿梭选择器',
      '开关',
      '滑动选择器',
      '评分',
      '上传',
      '颜色选择器',
      '富文本编辑器'
    ]
  },
  {
    key: 'feedback',
    title: '反馈组件',
    description: '规范提示、通知、确认、进度、加载、弹窗和抽屉。',
    items: ['轻提示', '通知', '确认', '进度', '加载', '弹窗', '抽屉']
  },
  {
    key: 'display',
    title: '数据展示',
    description: '覆盖表格、详情、状态、统计、日志和空状态。',
    items: [
      '表格',
      '详情',
      '状态',
      '统计',
      '日志',
      '空状态'
    ]
  }
];

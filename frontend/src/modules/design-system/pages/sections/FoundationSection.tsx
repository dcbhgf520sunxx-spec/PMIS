import { AdminCard } from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

const foundationColorGroups = [
  {
    title: '主色阶',
    note: '全局统一，承载主按钮、导航选中、核心操作和重点链接。',
    colors: [
      { name: '默认', value: '#1f6fff', scene: '主按钮、选中态、核心链接', token: 'app-primary' },
      { name: '悬浮', value: 'var(--app-primary-hover)', scene: '蓝色文字悬浮、主交互悬浮态', token: 'app-primary-hover' },
      { name: '深色', value: '#1559d6', scene: '按钮按下、强调态', token: 'app-primary-deep' },
      { name: '浅背景', value: 'var(--app-bg-strong)', scene: '选中背景、轻提示背景', token: 'app-bg-strong' }
    ]
  },
  {
    title: '辅助色',
    note: '按场景克制使用，单页按需选 1-3 种，避免后台页面变花。',
    colors: [
      { name: '青蓝', value: '#0ea5e9', scene: '信息提示、辅助点缀，不做核心悬浮色', token: 'app-cyan' },
      { name: '淡紫', value: 'var(--app-purple)', scene: 'AI 标识、特色模块；分类标签仅通过受控色板使用', token: 'app-purple' },
      { name: '暖橙', value: 'var(--app-warning-strong)', scene: '待办、提醒、中优先级', token: 'semantic-warning' },
      { name: '冷灰蓝', value: 'var(--app-steel)', scene: '弱操作、次级图标、辅助说明', token: 'app-steel' }
    ]
  },
  {
    title: '中性色',
    note: '文字、背景、边框和表头优先使用中性色，保证长期耐看。',
    colors: [
      { name: '正文', value: '#12213a', scene: '一级文字、表格主内容', token: 'app-text' },
      { name: '辅助文字', value: 'var(--app-muted)', scene: '说明、占位、弱信息', token: 'app-muted' },
      { name: '页面背景', value: '#f4f8fd', scene: '后台页面底色', token: 'app-bg' },
      { name: '边框', value: 'var(--app-border)', scene: '卡片、输入框、表格分割', token: 'app-border' }
    ]
  },
  {
    title: '功能状态色',
    note: '状态色全局不可随意替换，尤其是成功、警告、危险。',
    colors: [
      { name: '成功', value: '#22c55e', scene: '已完成、通过、成功反馈', token: 'semantic-success' },
      { name: '警告', value: 'var(--app-warning-strong)', scene: '预警、待确认、中度异常', token: 'semantic-warning' },
      { name: '危险', value: 'var(--app-danger-light)', scene: '删除、报错、校验失败', token: 'semantic-danger' },
      { name: '信息', value: '#1f6fff', scene: '普通通知、帮助、待处理', token: 'semantic-info' }
    ]
  },
  {
    title: '暗色预留',
    note: '大屏和夜间场景先预留，不在普通后台页面强行启用。',
    colors: [
      { name: '页面背景', value: '#0d1119', scene: '大屏底色', token: 'dark-page-bg' },
      { name: '卡片背景', value: '#151a23', scene: '大屏卡片和弹层', token: 'dark-surface' },
      { name: '一级文字', value: '#f5f7fa', scene: '暗色主文字', token: 'dark-text' },
      { name: '边框', value: '#272e3b', scene: '暗色分割线', token: 'dark-border' }
    ]
  }
];

const foundationPrinciples = [
  { title: '色彩统一', desc: '所有页面先走主题变量，主色、悬浮、边框和背景不能各自发挥。' },
  { title: '密度优先', desc: '后台页面默认紧凑，控件高度、表格行高和底部栏要服务工作区面积。' },
  { title: '层级克制', desc: '用轻边框、弱阴影和字号层级表达关系，不靠大面积装饰。' },
  { title: '状态清晰', desc: '状态、紧急程度、逾期、危险操作必须分开设计，不能混用标签样式。' }
];

const typographyItems = [
  { name: '页面标题', value: '20px / 26px', sample: '运维工单' },
  { name: '分组标题', value: '14px / 22px', sample: '基础信息' },
  { name: '正文内容', value: '13px / 20px', sample: '生产环境登录偶发超时' },
  { name: '辅助说明', value: '12px / 18px', sample: '用于说明字段、空值和弱提示' }
];

const spacingItems = [
  { name: '页面间距', value: '8 / 12 / 16' },
  { name: '卡片内距', value: '12 / 16' },
  { name: '筛选控件', value: '32px' },
  { name: '表单控件', value: '36px' },
  { name: '底部栏', value: '40px' },
  { name: '圆角', value: '6px' }
];

const radiusShadowItems = [
  { name: '4px', value: '输入框、小按钮、小标签' },
  { name: '6px', value: '卡片、弹窗、表格、通用容器' },
  { name: '8px', value: '统计卡、大模块，谨慎使用' },
  { name: '轻阴影', value: '输入框、标签、局部浮起' },
  { name: '卡片阴影', value: '普通卡片弱层级' },
  { name: '浮层阴影', value: '弹窗、抽屉、下拉面板' }
];

const iconSpecItems = [
  { name: '风格', value: '线性图标为主，面性图标只用于选中态和强调态' },
  { name: '尺寸', value: '菜单 16px，按钮内 16-18px，独立图标 20-24px' },
  { name: '线宽', value: '默认 1.5px，保持轻量科技感' },
  { name: '颜色', value: '默认跟随文字，选中和悬浮使用主色' }
];

const motionStateItems = [
  { name: '悬浮', value: '颜色变化明确，避免太接近默认色' },
  { name: '聚焦', value: '统一蓝色边框和轻量外圈' },
  { name: '禁用', value: '文字、边框、背景同步降级，并保留可识别性' },
  { name: '加载', value: '提交和批量操作必须进入加载态，避免重复提交' },
  { name: '过渡', value: '150-200ms，只服务反馈，不做装饰动效' },
  { name: '表格行悬浮', value: '行背景轻微高亮，蓝色文字悬浮使用科技蓝' }
];

export function FoundationSection() {
  return (
    <div className="design-system-page__foundation">
      <AdminCard title="设计基础">
        <div className="design-system-page__base-rule-grid">
          {foundationPrinciples.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="1. 色彩规范">
        <div className="design-system-page__color-groups">
          {foundationColorGroups.map((group) => (
            <section className="design-system-page__color-group" key={group.title}>
              <div className="design-system-page__color-group-head">
                <h3>{group.title}</h3>
                <ComponentEntry label="Token 入口" name={group.colors.map((item) => `--${item.token}`).join(' / ')} />
                <p>{group.note}</p>
              </div>
              <div className="design-system-page__token-board">
                {group.colors.map((item) => (
                  <div className="design-system-page__token-card" key={`${group.title}-${item.name}`}>
                    <div
                      className="design-system-page__token-swatch"
                      style={{ background: item.value }}
                    />
                    <div className="design-system-page__token-card-meta">
                      <strong>{item.name}</strong>
                      <span>{item.value}</span>
                      <code>{item.token.replace(/^--/, '')}</code>
                      <p>{item.scene}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="2. 字体规范">
        <div className="design-system-page__type-list">
          {typographyItems.map((item) => (
            <div className="design-system-page__type-row" key={item.name}>
              <span>{item.name}</span>
              <strong>{item.sample}</strong>
              <em>{item.value}</em>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="3. 栅格与间距规范">
        <div className="design-system-page__space-list">
          {spacingItems.map((item) => (
            <div key={item.name}>
              <span>{item.name}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="4. 圆角与阴影">
        <div className="design-system-page__space-list">
          {radiusShadowItems.map((item) => (
            <div key={item.name}>
              <span>{item.name}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="5. 图标规范">
        <div className="design-system-page__base-rule-grid">
          {iconSpecItems.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.name}>
              <h3>{item.name}</h3>
              <p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="6. 动效与状态">
        <div className="design-system-page__base-rule-grid">
          {motionStateItems.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.name}>
              <h3>{item.name}</h3>
              <p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>

    </div>
  );
}

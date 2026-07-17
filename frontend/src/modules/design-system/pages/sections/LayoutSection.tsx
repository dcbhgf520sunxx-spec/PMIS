import { AdminCard } from '../../../../components/admin';
import { DetailTemplateDemo } from '../demos/DetailTemplateDemo';
import { FormTemplateDemo } from '../demos/FormTemplateDemo';
import { OverlayTemplateDemo } from '../demos/OverlayTemplateDemo';
import { ListTemplateDemo } from './layout/ListTemplateDemo';
import { layoutPatterns } from './layout/layoutPatterns';
import './LayoutSection.css';
import './layout/LayoutPatternGallery.css';
import './layout/LayoutPatternPreviews.css';

const layoutSpecs = [
  { label: '系统框架', value: '顶部栏、侧边栏、消息、用户入口统一位置' },
  { label: '列表页', value: '标题区、筛选区、表格区、底部分页固定，批量操作按业务启用' },
  { label: '详情页', value: '标题后展示关键状态，信息一次性给到用户' },
  { label: '新增 / 编辑页', value: '操作放右上，字段分组，长文本独占整行' },
  { label: '弹窗 / 抽屉', value: '普通确认、危险确认、状态变更使用统一结构' }
];

function renderLayoutTemplateDemo(title: string) {
  if (title === '列表页') return <ListTemplateDemo />;
  if (title === '新增 / 编辑页') return <FormTemplateDemo />;
  if (title === '详情页') return <DetailTemplateDemo />;
  if (title === '弹窗 / 抽屉') return <OverlayTemplateDemo />;
  return null;
}

export function LayoutSection() {
  return (
    <div className="design-system-page__section design-system-page__layout">
      <AdminCard title="页面模式规范">
        <div className="design-system-page__base-rule-grid">
          {layoutSpecs.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="页面样板与标注">
        <div className="design-system-page__layout-patterns">
          {layoutPatterns.map((pattern) => (
            <section className="design-system-page__layout-pattern" key={pattern.title}>
              <div className="design-system-page__layout-pattern__content">
                <h3>{pattern.title}</h3>
                <p>{pattern.description}</p>
                <ul>{pattern.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
              </div>
              {pattern.preview}
              {renderLayoutTemplateDemo(pattern.title)}
            </section>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

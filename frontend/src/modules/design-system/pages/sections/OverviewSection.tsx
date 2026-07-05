import { AdminCard, InfoGrid } from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';
import { componentGroups, overviewSpecs, qualityGateBlocks } from '../data/overview';

export function OverviewSection() {
  return (
    <div className="design-system-page__overview">
      <AdminCard title="规范总览">
        <div className="design-system-page__overview-lead">
          <h2>后台系统组件规范</h2>
          <ComponentEntry name="AdminCard / InfoGrid" />
          <p>面向长期后台项目，统一设计基础、页面模式和组件用法，保证风格一致、区域紧凑、能力可复用。</p>
        </div>
        <div className="design-system-page__overview-pill-row">
          <span>科技蓝</span>
          <span>紧凑工作区</span>
          <span>组件优先</span>
          <span>中文交互</span>
        </div>
        <InfoGrid columns={3} items={overviewSpecs} />
      </AdminCard>

      <AdminCard title="规范入口">
        <ComponentEntry name="AdminCard" />
        <div className="design-system-page__catalog">
          {componentGroups.map((group) => (
            <a
              className="design-system-page__catalog-card"
              key={group.title}
              href={`?category=${group.key}`}
            >
              <div className="design-system-page__catalog-card-title">
                <h3>{group.title}</h3>
                <span>{group.items.length} 项</span>
              </div>
              <p>{group.description}</p>
              <strong>{group.items.slice(0, 4).join(' / ')}</strong>
            </a>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="沉淀原则">
        <ComponentEntry name="AdminCard" />
        <div className="design-system-page__principles">
          {[
            { label: '视觉方向', value: '科技蓝、低装饰、清晰层级' },
            { label: '页面密度', value: '默认紧凑，优先保留工作区' },
            { label: '组件策略', value: '先复用，再沉淀，不重复造' },
            { label: '状态完整', value: '空、加载、禁用、危险确认齐全' }
          ].map((item) => (
            <div className="design-system-page__principle" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="验收门槛">
        <ComponentEntry name="AdminCard" />
        <div className="design-system-page__check-list">
          {qualityGateBlocks.map((block) => (
            <section key={block.title}>
              <h3>{block.title}</h3>
              <ul>
                {block.items.slice(0, 3).map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

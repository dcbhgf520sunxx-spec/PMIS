import { useLocation, useNavigate } from 'react-router-dom';
import { DetailSectionNavigation } from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

type NavigationDemoPage = 'overview' | 'contract';

export function PageNavigationTabsDemo() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePage: NavigationDemoPage = new URLSearchParams(location.search).get('navigationDemo') === 'contract'
    ? 'contract'
    : 'overview';

  const handleChange = (nextPage: NavigationDemoPage) => {
    const nextSearchParams = new URLSearchParams(location.search);
    if (nextPage === 'overview') nextSearchParams.delete('navigationDemo');
    else nextSearchParams.set('navigationDemo', nextPage);
    const nextSearch = nextSearchParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`);
  };

  return (
    <div className="design-system-page__button-demo">
      <h4>页面分类切换</h4>
      <ComponentEntry name="DetailSectionNavigation + useNavigate" />
      <p className="design-system-page__button-demo-description">
        点击后更新页面地址，并由地址决定展示哪个页面内容。
      </p>
      <DetailSectionNavigation
        activeKey={activePage}
        onChange={handleChange}
        sticky={false}
        ariaLabel="页面分类切换"
        items={[
          { title: '项目概览页', key: 'overview' },
          { title: '合同信息页', key: 'contract' }
        ]}
      />
      <div className="design-system-page__base-rule-card">
        <strong>{activePage === 'overview' ? '项目概览页' : '合同信息页'}</strong>
        <span>{activePage === 'overview' ? '展示项目整体进度、负责人和关键指标。' : '展示合同条款、金额和履约信息。'}</span>
        <span>当前地址：{location.pathname}{location.search}</span>
      </div>
    </div>
  );
}

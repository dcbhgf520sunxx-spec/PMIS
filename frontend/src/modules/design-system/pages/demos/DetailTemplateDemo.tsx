import type { ProColumns } from '@ant-design/pro-components';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AdminButton,
  AdminSegmented,
  AdminTextAction,
  DetailNeighborNav,
  DetailLinkCell,
  DetailMetaList,
  HistoryTimelineSection,
  OperationColumnActions,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection,
  TemplateDetailTableSection
} from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

type RelatedRecord = {
  id: string;
  name: string;
  ownerName: string;
  typeName: string;
  priority: string;
  status: 'pending' | 'processing' | 'success';
};

type RelatedTableMode = 'display' | 'linked' | 'managed' | 'empty';
type NavigationMode = 'anchor' | 'page';
type DemoPage = 'basic' | 'permissions';

const relatedRecords: RelatedRecord[] = [
  { id: 'related-1', name: '整理权限范围清单', ownerName: '张三', typeName: '资料整理', priority: '中', status: 'success' },
  { id: 'related-2', name: '复核区域授权边界', ownerName: '李四', typeName: '权限复核', priority: '高', status: 'processing' }
];

export function DetailTemplateDemo() {
  const location = useLocation();
  const navigate = useNavigate();
  const [demoState, setDemoState] = useState<'normal' | 'loading' | 'error' | 'notFound'>('normal');
  const [relatedTableMode, setRelatedTableMode] = useState<RelatedTableMode>('display');
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('anchor');
  const activePage: DemoPage = new URLSearchParams(location.search).get('detailDemoPage') === 'permissions'
    ? 'permissions'
    : 'basic';

  const handlePageChange = (nextPage: string) => {
    const nextSearchParams = new URLSearchParams(location.search);
    if (nextPage === 'basic') nextSearchParams.delete('detailDemoPage');
    else nextSearchParams.set('detailDemoPage', nextPage);
    const nextSearch = nextSearchParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`);
  };

  const handleNavigationModeChange = (nextMode: NavigationMode) => {
    setNavigationMode(nextMode);
    if (nextMode === 'page') return;
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('detailDemoPage');
    const nextSearch = nextSearchParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`, { replace: true });
  };
  const relatedColumns = useMemo<ProColumns<RelatedRecord>[]>(() => [
    {
      title: '记录名称',
      dataIndex: 'name',
      width: 220,
      render: (_, record) => relatedTableMode === 'display' || relatedTableMode === 'empty'
        ? record.name
        : <DetailLinkCell onClick={() => {}}>{record.name}</DetailLinkCell>
    },
    { title: '负责人', dataIndex: 'ownerName', width: 100 },
    { title: '类型', dataIndex: 'typeName', width: 110 },
    { title: '优先级', dataIndex: 'priority', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => <StatusTag status={record.status} text={record.status === 'success' ? '已完成' : undefined} />
    },
    ...(relatedTableMode === 'managed' ? [{
      title: '操作',
      valueType: 'option' as const,
      width: 110,
      fixed: 'right' as const,
      render: () => (
        <OperationColumnActions>
          <AdminTextAction>编辑</AdminTextAction>
          <AdminTextAction>指派</AdminTextAction>
        </OperationColumnActions>
      )
    }] : [])
  ], [relatedTableMode]);

  const basicPageContent = (
    <>
      <TemplateDetailSection title="基本信息" sectionKey="basic">
        <DetailMetaList
          items={[
            { label: '工号', value: '10086' },
            { label: '姓名', value: '张三' },
            { label: '手机号', value: '13800000000' },
            { label: '所属角色', value: '系统管理员 / 业务管理员 / 运维管理员 / 数据管理员 / 审计管理员 / 安全管理员', aggregate: true }
          ]}
        />
      </TemplateDetailSection>
      <TemplateDetailTableSection<RelatedRecord>
        title="关联数据"
        sectionKey="related"
        summary={relatedTableMode === 'empty' ? '共 0 条' : '已完成 1 / 共 2 条'}
        extra={relatedTableMode === 'managed' ? <AdminButton size="small" type="primary">新增关联记录</AdminButton> : undefined}
        table={{
          columns: relatedColumns,
          dataSource: relatedTableMode === 'empty' ? [] : relatedRecords,
          scroll: { x: 1100 }
        }}
      />
    </>
  );

  const permissionsPageContent = (
    <>
      <TemplateDetailSection title="权限范围" sectionKey="permissions">
        <DetailMetaList
          items={[
            { label: '管理范围', value: '用户、角色、运维工单、基础档案、访问日志、组件工作台、页面样板、基础组件、输入组件、反馈组件、数据展示', wide: true, aggregate: true },
            { label: '数据权限', value: '本部门及下级部门' },
            { label: '账号来源', value: 'HR 同步' }
          ]}
        />
      </TemplateDetailSection>
      <TemplateDetailSection title="负责区域" sectionKey="regions">
        <DetailMetaList
          items={[
            { label: '总部园区', value: '综合楼、研发楼、数据中心' },
            { label: '华东区域', value: '上海、杭州、南京' },
            { label: '授权边界', value: '仅查看已授权区域数据', wide: true }
          ]}
        />
      </TemplateDetailSection>
      <TemplateDetailSection title="所属组织" sectionKey="organization">
        <DetailMetaList
          items={[
            { label: '一级部门', value: '数字化中心' },
            { label: '二级部门', value: '平台产品部' },
            { label: '直属主管', value: '李经理' },
            { label: '协作团队', value: '研发一组、运维组' }
          ]}
        />
      </TemplateDetailSection>
      <TemplateDetailSection title="安全设置" sectionKey="security">
        <DetailMetaList
          items={[
            { label: '双因素认证', value: '已开启' },
            { label: '登录限制', value: '仅企业网络' },
            { label: '密码更新时间', value: '2026-06-18 14:20', wide: true }
          ]}
        />
      </TemplateDetailSection>
      <HistoryTimelineSection
        sectionKey="history"
        items={[
          { id: 'history-1', operator: '业务管理员', action: '更新负责区域', time: '2026-07-12 09:30', changes: [{ field: '负责区域', before: '总部园区', after: '总部园区、华东区域' }] },
          { id: 'history-2', operator: '系统管理员', action: '调整角色权限', time: '2026-07-10 16:45', changes: [{ field: '所属角色', before: '业务管理员', after: '系统管理员 / 业务管理员' }] },
          { id: 'history-3', operator: '张三', action: '完成安全验证', time: '2026-07-08 11:20' }
        ]}
      />
    </>
  );

  return (
    <div className="design-system-page__layout-pattern-template">
      <div className="design-system-page__input-panel-head">
        <h3>TemplateDetailPage</h3>
        <ComponentEntry name="TemplateDetailPage / DetailNeighborNav / TemplateDetailSection / DetailMetaList / TemplateDetailTableSection" />
        <p>详情页统一从这个入口接入。标题标签、上一条/下一条、记录操作和状态操作分别由模板固定位置。</p>
        <div className="design-system-page__template-mode-switch">
          <AdminSegmented
            size="small"
            value={demoState}
            options={[
              { label: '正常', value: 'normal' },
              { label: '加载中', value: 'loading' },
              { label: '加载失败', value: 'error' },
              { label: '记录不存在', value: 'notFound' }
            ]}
            onChange={(value) => setDemoState(value as typeof demoState)}
          />
        </div>
        <div className="design-system-page__template-mode-switch">
          <span>关联数据：</span>
          <AdminSegmented
            size="small"
            value={relatedTableMode}
            options={[
              { label: '纯展示', value: 'display' },
              { label: '可查看', value: 'linked' },
              { label: '可管理', value: 'managed' },
              { label: '空数据', value: 'empty' }
            ]}
            onChange={(value) => setRelatedTableMode(value as RelatedTableMode)}
          />
        </div>
        <div className="design-system-page__template-mode-switch">
          <span>分类导航：</span>
          <AdminSegmented
            size="small"
            value={navigationMode}
            options={[
              { label: '导航定位', value: 'anchor' },
              { label: '页面切换', value: 'page' }
            ]}
            onChange={(value) => handleNavigationModeChange(value as NavigationMode)}
          />
        </div>
        <p>
          {navigationMode === 'anchor'
            ? '导航定位：展示同一详情页的全部分组，点击顶部分类后滚动到对应区域。'
            : '页面切换：顶部分类样式保持一致，点击后更新页面地址并只展示当前页面内容。'}
        </p>
      </div>
      <div className="design-system-page__template-demo is-detail">
        <TemplateDetailPage
          title="详情模板：用户详情"
          loading={demoState === 'loading'}
          error={demoState === 'error' ? '详情数据加载失败，请稍后重试' : undefined}
          notFound={demoState === 'notFound'}
          onRetry={() => setDemoState('normal')}
          onBack={() => {}}
          titleCenter={(
            <DetailNeighborNav
              placement="title"
              prevId="10085"
              nextId="10087"
              ordinal={8}
              total={24}
              onNavigate={() => {}}
            />
          )}
          actions={<AdminButton type="primary">编辑</AdminButton>}
          sectionNavigation={navigationMode === 'page' ? {
            items: [
              { key: 'basic', title: '基本信息页' },
              { key: 'permissions', title: '权限信息页' }
            ],
            activeKey: activePage,
            onChange: handlePageChange
          } : true}
          statusSection={{
            items: [
              { label: '状态', value: <StatusTag status="enabled" />, wide: true }
            ]
          }}
          statusAction={<AdminButton block type="primary">状态变更</AdminButton>}
          documentSection={{
            items: [
              { label: '创建人', value: '系统管理员' },
              { label: '创建时间', value: '2026-06-30 10:12', wide: true },
              { label: '更新人', value: '业务管理员' },
              { label: '更新时间', value: '2026-07-04 09:00', wide: true },
              { label: '最近登录', value: '2026-07-04 09:30', wide: true }
            ]
          }}
        >
          {navigationMode === 'page'
            ? activePage === 'basic'
              ? basicPageContent
              : activePage === 'permissions'
                ? permissionsPageContent
                : null
            : <>{basicPageContent}{permissionsPageContent}</>}
        </TemplateDetailPage>
      </div>
    </div>
  );
}

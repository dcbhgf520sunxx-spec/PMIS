import { UserOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminAvatar,
  AdminAvatarGroup,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCollapse,
  AdminEmptyState,
  AdminList,
  AdminListItem,
  AdminListItemMeta,
  AdminPopover,
  AdminSpace,
  AdminStatistic,
  AdminTag,
  AdminTextAction,
  AdminTree,
  CategoryTag,
  defineCategoryToneMap,
  DetailMetaList,
  HistoryTimeline,
  MetricCard,
  OperationColumnActions,
  SearchTable,
  TableFooterBar,
  TablePagination
} from '../../../../components/admin';
import { mockWorkOrderHistory, mockWorkOrders } from '../../../work-order/mock';
import type { WorkOrderRecord } from '../../../work-order/types';
import {
  problemTypeOptions,
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  urgencyOptions
} from '../../../work-order/helpers';
import { ComponentEntry } from '../components/ComponentEntry';
import './DisplaySection.css';

const categoryDemoTones = defineCategoryToneMap({
  typeA: 'blue',
  typeB: 'cyan',
  typeC: 'indigo'
});

const displaySpecs = [
  { label: '表格', value: '列头不换行、内容超出省略号、列宽可调整、关键列可排序，横向滚动与底部操作稳定' },
  { label: '详情信息', value: '承载单条记录字段阅读，字段名完整、值对齐，普通字段不做标签化装饰' },
  { label: '统计指标', value: '承载关键数字和业务概览，说明口径，不替代表格明细' },
  { label: '列表', value: '承载轻量集合和摘要信息，主信息优先，次要信息降级展示' },
  { label: '标签徽标', value: '承载分类、数量和辅助提醒，不和业务状态标签混用' },
  { label: '过程记录', value: '承载时间线、操作日志和变更记录，保证来源、动作和时间可追溯' },
  { label: '空状态', value: '承载无数据场景，文案必须中文化，并给出必要的下一步操作' },
  { label: '折叠展示', value: '承载补充信息或低频内容，不隐藏主数据和关键字段' },
  { label: '气泡卡片', value: '承载局部补充说明或轻量预览，贴近触发对象，不打断当前流程' }
];

export function DisplaySection() {
  const [displayTablePage, setDisplayTablePage] = useState(1);
  const [displayTablePageSize, setDisplayTablePageSize] = useState(20);

  const displayTableColumns = useMemo<ProColumns<WorkOrderRecord>[]>(() => [
    {
      title: '序号',
      valueType: 'index',
      width: 48,
      fixed: 'left',
      search: false,
      hideInSetting: true
    },
    {
      title: '问题描述',
      dataIndex: 'problemDesc',
      width: 320,
      fixed: 'left',
      ellipsis: true,
      sorter: (a, b) => a.problemDesc.localeCompare(b.problemDesc),
      render: (_, record) => (
        <div className="design-system-page__display-problem-cell">
          <AdminTextAction className="design-system-page__display-table-link" title={record.problemDesc}>
            {record.problemDesc}
          </AdminTextAction>
          {record.isOverdue ? <span className="design-system-page__display-problem-tag">{renderOverdue(true)}</span> : null}
        </div>
      )
    },
    {
      title: '问题类型',
      dataIndex: 'problemType',
      width: 110,
      ellipsis: true,
      sorter: (a, b) => problemTypeOptions.findIndex((item) => item.value === a.problemType) - problemTypeOptions.findIndex((item) => item.value === b.problemType),
      renderText: (value) => problemTypeText(value as WorkOrderRecord['problemType'])
    },
    {
      title: '跟进人',
      dataIndex: 'followerName',
      width: 100,
      ellipsis: true,
      sorter: (a, b) => a.followerName.localeCompare(b.followerName)
    },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      width: 96,
      align: 'center',
      sorter: (a, b) => urgencyOptions.findIndex((item) => item.value === a.urgency) - urgencyOptions.findIndex((item) => item.value === b.urgency),
      render: (_, record) => renderUrgency(record.urgency)
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      sorter: (a, b) => statusOptions.findIndex((item) => item.value === a.status) - statusOptions.findIndex((item) => item.value === b.status),
      render: (_, record) => renderWorkOrderStatus(record.status)
    },
    {
      title: '提出人',
      dataIndex: 'submitterName',
      width: 96,
      ellipsis: true,
      sorter: (a, b) => a.submitterName.localeCompare(b.submitterName)
    },
    {
      title: '提出时间',
      dataIndex: 'submitTime',
      width: 150,
      ellipsis: true,
      sorter: (a, b) => a.submitTime.localeCompare(b.submitTime),
      renderText: (value) => String(value).slice(0, 10)
    },
    {
      title: '预计完成时间',
      dataIndex: 'expectedResolveDate',
      width: 140,
      ellipsis: true,
      sorter: (a, b) => a.expectedResolveDate.localeCompare(b.expectedResolveDate)
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: () => (
        <OperationColumnActions>
          <AdminTextAction className="design-system-page__display-table-link">编辑</AdminTextAction>
          <AdminTextAction className="design-system-page__display-table-link">状态变更</AdminTextAction>
        </OperationColumnActions>
      )
    }
  ], []);

  return (
            <div className="design-system-page__section design-system-page__display">
            <AdminCard title="数据展示规范">
              <div className="design-system-page__base-rule-grid">
                {displaySpecs.map((item) => (
                  <section className="design-system-page__base-rule-card" key={item.label}>
                    <h3>{item.label}</h3>
                    <p>{item.value}</p>
                  </section>
                ))}
              </div>
            </AdminCard>
            <AdminCard title="数据展示组件">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel is-wide">
                  <div className="design-system-page__input-panel-head">
                    <h3>表格</h3>
                    <ComponentEntry name="SearchTable / TableFooterBar / TablePagination" />
                    <p>用于多字段、多行数据的比较和维护。列头不换行，内容超出省略，横向滚动和操作列保持稳定。</p>
                  </div>
                  <div className="design-system-page__display-keypoints">
                    <span>列头不换行</span>
                    <span>内容超出省略号</span>
                    <span>列宽可拖拽调整</span>
                    <span>列可排序</span>
                  </div>
                  <div className="design-system-page__display-table">
                    <SearchTable<WorkOrderRecord>
                      columns={displayTableColumns}
                      dataSource={mockWorkOrders.slice(0, 6)}
                      options={false}
                      pagination={false}
                      search={false}
                      scroll={{ x: 1180 }}
                    />
                  </div>
                  <div className="design-system-page__display-table-footer-demo">
                    <TableFooterBar
                      selectedCount={0}
                      actions={(
                        <AdminSpace size={8}>
                          <AdminButton size="small">批量指派</AdminButton>
                          <AdminButton size="small" disabled>批量状态变更</AdminButton>
                          <AdminButton danger size="small" disabled>批量删除</AdminButton>
                        </AdminSpace>
                      )}
                      extra={(
                        <TablePagination
                          current={displayTablePage}
                          pageSize={displayTablePageSize}
                          total={56}
                          onChange={(page, pageSize) => {
                            setDisplayTablePage(page);
                            setDisplayTablePageSize(pageSize);
                          }}
                          onShowSizeChange={(_, pageSize) => {
                            setDisplayTablePage(1);
                            setDisplayTablePageSize(pageSize);
                          }}
                        />
                      )}
                    />
                  </div>
                </section>

                <section className="design-system-page__input-panel is-wide">
                  <div className="design-system-page__input-panel-head">
                    <h3>详情信息</h3>
                    <ComponentEntry name="DetailMetaList" />
                    <p>用于单条记录字段阅读。空值统一显示短横线；普通文本字段最多显示两行，超出省略，悬浮查看完整内容；长文本和富文本完整展示。</p>
                  </div>
                  <DetailMetaList
                    columns={4}
                    items={[
                      { label: '问题描述', value: '生产环境登录偶发超时，需要排查认证链路和网关日志', wide: true, longText: true },
                      { label: '工单编号', value: 'RQ-20260630-001' },
                      { label: '所属系统', value: '生产环境登录系统' },
                      { label: '问题类型', value: '日常操作' },
                      { label: '跟进人', value: '管理员' },
                      { label: '提出人', value: '张三' },
                      { label: '提出组织', value: '运维部' },
                      { label: '协作角色', value: '系统管理员、业务管理员、运维管理员、审计管理员、数据管理员、安全管理员、项目管理员、需求管理员、任务管理员、质量管理员', aggregate: true },
                      { label: '空值示例', value: '' },
                      { label: '提出时间', value: '2026-06-01 09:30' },
                      { label: '预计完成时间', value: '2026-06-01' }
                    ]}
                  />
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>统计指标</h3>
                    <ComponentEntry name="MetricCard / AdminStatistic" />
                    <p>用于快速扫读关键数字，数量和口径同屏展示，不替代表格明细。</p>
                  </div>
                  <div className="design-system-page__metrics">
                    <MetricCard
                      title="工单总数"
                      value={56}
                      unit="张"
                      overdue="逾期 12"
                      items={[
                        { label: '待处理', value: 14, tone: 'blue' },
                        { label: '处理中', value: 16, tone: 'cyan' },
                        { label: '已完成', value: 18, tone: 'green' }
                      ]}
                    />
                    <AdminStatistic title="本月完成率" value={86.4} suffix="%" />
                  </div>
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>列表</h3>
                    <ComponentEntry name="AdminList / AdminListItem / AdminListItemMeta" />
                    <p>用于轻量集合和摘要信息，主标题优先展示，辅助信息降低权重。</p>
                  </div>
                  <AdminList<WorkOrderRecord>
                    size="small"
                    dataSource={mockWorkOrders.slice(0, 4)}
                    renderItem={(item) => (
                      <AdminListItem>
                        <AdminListItemMeta
                          title={<span className="design-system-page__display-list-title">{item.problemDesc}</span>}
                          description={`${item.submitterName} · ${item.submitTime.slice(0, 10)} · ${problemTypeText(item.problemType)}`}
                        />
                      </AdminListItem>
                    )}
                  />
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>标签、徽标与头像</h3>
                    <ComponentEntry name="AdminTag / CategoryTag / AdminBadge / AdminAvatar" />
                    <p>业务定义分类含义和色调映射，底座只提供受控色板并阻止同一维度重复用色；流程状态、紧急程度和逾期使用各自的语义标签。</p>
                  </div>
                  <AdminSpace direction="vertical" size={12}>
                    <AdminSpace wrap>
                      <CategoryTag tone={categoryDemoTones.typeA}>分类一</CategoryTag>
                      <CategoryTag tone={categoryDemoTones.typeB}>分类二</CategoryTag>
                      <CategoryTag tone={categoryDemoTones.typeC}>分类三</CategoryTag>
                      <AdminTag>无需区分</AdminTag>
                    </AdminSpace>
                    <AdminSpace wrap size={18} className="design-system-page__display-badge-row">
                      <AdminBadge count={8}>
                        <AdminButton size="small">待跟进</AdminButton>
                      </AdminBadge>
                      <AdminBadge count={128} overflowCount={99}>
                        <AdminButton size="small">待处理</AdminButton>
                      </AdminBadge>
                      <AdminBadge dot>
                        <AdminButton size="small">新消息</AdminButton>
                      </AdminBadge>
                    </AdminSpace>
                    <AdminSpace wrap size={10} className="design-system-page__display-avatar-row">
                      <AdminAvatar style={{ backgroundColor: 'var(--app-primary)' }}>张</AdminAvatar>
                      <AdminAvatar style={{ backgroundColor: 'var(--app-cyan)' }}>李</AdminAvatar>
                      <AdminAvatar style={{ backgroundColor: 'var(--app-purple)' }}>王</AdminAvatar>
                      <AdminAvatar style={{ backgroundColor: 'var(--app-warning-strong)' }}>赵</AdminAvatar>
                      <AdminAvatarGroup max={{ count: 3 }}>
                        <AdminAvatar style={{ backgroundColor: 'var(--app-primary)' }}>运</AdminAvatar>
                        <AdminAvatar style={{ backgroundColor: 'var(--app-steel)' }}>审</AdminAvatar>
                        <AdminAvatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--app-bg-strong)', color: 'var(--app-primary)' }} />
                      </AdminAvatarGroup>
                    </AdminSpace>
                  </AdminSpace>
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>时间线与日志</h3>
                    <ComponentEntry name="HistoryTimeline" />
                    <p>用于记录数据产生、流转和变更过程。字段名和值必须是最终中文展示文本，不接收数据库字段名、关联 ID 或枚举编码。</p>
                  </div>
                  <HistoryTimeline items={mockWorkOrderHistory} />
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>树形展示</h3>
                    <ComponentEntry name="AdminTree" />
                    <p>用于组织、权限和分类层级展示，展开层级要克制，避免占满工作区。</p>
                  </div>
                  <AdminTree
                    defaultExpandAll
                    treeData={[
                      {
                        title: '技术中心',
                        key: 'tech',
                        children: [
                          { title: '平台部', key: 'platform' },
                          { title: '运维部', key: 'ops' }
                        ]
                      },
                      {
                        title: '业务中心',
                        key: 'business',
                        children: [
                          { title: '游戏业务组', key: 'game' },
                          { title: '数据运营组', key: 'data' }
                        ]
                      }
                    ]}
                  />
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>空状态</h3>
                    <ComponentEntry name="AdminEmptyState" />
                    <p>用于无数据场景。文案要说明当前没有什么，并在需要时提供下一步操作。</p>
                  </div>
                  <AdminEmptyState description="暂无数据">
                    <AdminButton type="primary" size="small">新增数据</AdminButton>
                  </AdminEmptyState>
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>折叠展示</h3>
                    <ComponentEntry name="AdminCollapse" />
                    <p>用于低频补充信息。默认不占用过多空间，但不能隐藏主数据和核心操作。</p>
                  </div>
                  <AdminCollapse
                    size="small"
                    defaultActiveKey={['basic']}
                    items={[
                      {
                        key: 'basic',
                        label: '基础信息',
                        children: '展示与当前记录强相关的补充说明，内容保持简短。'
                      },
                      {
                        key: 'rule',
                        label: '处理规则',
                        children: '只放低频查看的规则说明，不放必须立即处理的业务字段。'
                      }
                    ]}
                  />
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>气泡卡片</h3>
                    <ComponentEntry name="AdminPopover" />
                    <p>用于局部预览、字段解释和轻量补充信息，贴近触发对象，不打断当前页面。</p>
                  </div>
                  <AdminSpace wrap>
                    <AdminPopover
                      content={
                        <div className="design-system-page__display-popover-card">
                          <strong>工单摘要</strong>
                          <span>当前状态：处理中</span>
                          <span>跟进人：运维人员</span>
                          <span>预计完成：2026-06-01</span>
                        </div>
                      }
                      title="关联信息"
                    >
                      <AdminButton size="small">查看摘要</AdminButton>
                    </AdminPopover>
                    <AdminPopover content="用于解释字段含义，内容不超过两行。" title="字段说明">
                      <AdminButton size="small">字段说明</AdminButton>
                    </AdminPopover>
                  </AdminSpace>
                </section>
              </div>
            </AdminCard>
            </div>
  );
}

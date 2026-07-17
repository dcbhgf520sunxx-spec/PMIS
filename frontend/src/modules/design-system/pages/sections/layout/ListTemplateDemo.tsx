import { type Key, useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminButton,
  AdminInput,
  AdminSegmented,
  AdminSelect,
  AdminTextAction,
  CompactFilterBar,
  createListFilterItems,
  createListSorters,
  HierarchyListCell,
  listSorters,
  OperationColumnActions,
  TemplateListPage,
  useTemplateListPageData
} from '../../../../../components/admin';
import { mockWorkOrders, workOrderUsers } from '../../../../work-order/mock';
import type { WorkOrderRecord } from '../../../../work-order/types';
import {
  problemTypeOptions,
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  urgencyOptions
} from '../../../../work-order/helpers';
import { ComponentEntry } from '../../components/ComponentEntry';
import './ListTemplateDemo.css';

type HierarchyWorkOrderRecord = WorkOrderRecord & {
  hierarchyParentId?: string;
  hierarchyChildCount: number;
};

const listTemplateSorters = createListSorters<WorkOrderRecord>({
  problemDesc: listSorters.text((row) => row.problemDesc),
  problemType: listSorters.text((row) => problemTypeText(row.problemType)),
  followerName: listSorters.text((row) => row.followerName),
  urgency: listSorters.number((row) => row.urgency),
  status: listSorters.number((row) => row.status),
  submitterName: listSorters.text((row) => row.submitterName),
  submitTime: listSorters.date((row) => row.submitTime),
  expectedResolveDate: listSorters.date((row) => row.expectedResolveDate)
});

const hierarchyTemplateRows: HierarchyWorkOrderRecord[] = [
  { ...mockWorkOrders[0], id: 'hierarchy-parent-1', problemDesc: '完成生产环境登录链路优化', hierarchyChildCount: 2 },
  { ...mockWorkOrders[1], id: 'hierarchy-child-1', problemDesc: '排查认证服务日志', hierarchyParentId: 'hierarchy-parent-1', hierarchyChildCount: 0 },
  { ...mockWorkOrders[2], id: 'hierarchy-child-2', problemDesc: '验证网关超时配置', hierarchyParentId: 'hierarchy-parent-1', hierarchyChildCount: 0 },
  { ...mockWorkOrders[3], id: 'hierarchy-parent-2', problemDesc: '完成角色权限刷新优化', hierarchyChildCount: 0 }
];

const hierarchyTemplateParentCount = hierarchyTemplateRows.filter((row) => !row.hierarchyParentId).length;

export function ListTemplateDemo() {
  const [listTemplateMode, setListTemplateMode] = useState<'standard' | 'batch' | 'hierarchy'>('standard');
  const [listTemplateFilterExpanded, setListTemplateFilterExpanded] = useState(false);
  const [listTemplateSelectedRowKeys, setListTemplateSelectedRowKeys] = useState<Key[]>([]);
  const [listTemplateSelectedRows, setListTemplateSelectedRows] = useState<WorkOrderRecord[]>([]);
  const [expandedHierarchyParentIds, setExpandedHierarchyParentIds] = useState<Set<string>>(() => new Set());
  const [listTemplateFilterRevision, setListTemplateFilterRevision] = useState(0);

  const {
    pagedRows: listTemplateRows,
    pagination: listTemplatePagination,
    handleTableChange: handleListTemplateTableChange
  } = useTemplateListPageData({
    rows: mockWorkOrders,
    sorters: listTemplateSorters,
    resetOn: [listTemplateFilterRevision]
  });

  useEffect(() => {
    if (listTemplateMode !== 'batch') {
      setListTemplateSelectedRowKeys([]);
      setListTemplateSelectedRows([]);
    }
  }, [listTemplateMode]);

  const listTemplateFilterItems = useMemo(() => createListFilterItems([
    {
      key: 'problemDesc',
      label: '问题描述',
      node: <AdminInput size="small" placeholder="请输入" />
    },
    {
      key: 'problemType',
      label: '问题类型',
      node: (
        <AdminSelect
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          options={problemTypeOptions}
          placeholder="全部"
        />
      )
    },
    {
      key: 'urgency',
      label: '紧急程度',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          options={urgencyOptions}
          placeholder="全部"
        />
      )
    },
    {
      key: 'status',
      label: '状态',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          options={statusOptions}
          placeholder="全部"
        />
      )
    },
    {
      key: 'followerId',
      label: '跟进人',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          options={workOrderUsers}
          placeholder="全部"
        />
      )
    },
    {
      key: 'submitterName',
      label: '提出人',
      node: <AdminInput size="small" placeholder="请输入" />
    }
  ]), []);

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

  const toggleHierarchyParent = (parentId: string) => {
    setExpandedHierarchyParentIds((current) => {
      const next = new Set(current);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const visibleHierarchyTemplateRows = useMemo(
    () => hierarchyTemplateRows.filter((row) => (
      !row.hierarchyParentId || expandedHierarchyParentIds.has(row.hierarchyParentId)
    )),
    [expandedHierarchyParentIds]
  );

  const hierarchyDisplayColumns = useMemo<ProColumns<HierarchyWorkOrderRecord>[]>(() => (
    displayTableColumns.map((column) => column.dataIndex === 'problemDesc'
      ? {
        ...column,
        render: (_, row) => (
          <HierarchyListCell
            level={row.hierarchyParentId ? 'child' : row.hierarchyChildCount > 0 ? 'parent' : undefined}
            hasChildren={row.hierarchyChildCount > 0}
            expanded={expandedHierarchyParentIds.has(row.id)}
            expandLabel={`展开 ${row.problemDesc} 的子任务`}
            collapseLabel={`收起 ${row.problemDesc} 的子任务`}
            onToggle={() => toggleHierarchyParent(row.id)}
            trailing={row.isOverdue ? renderOverdue(true) : null}
          >
            <AdminTextAction className="design-system-page__display-table-link" title={row.problemDesc}>
              {row.problemDesc}
            </AdminTextAction>
          </HierarchyListCell>
        )
      }
      : column
    ) as ProColumns<HierarchyWorkOrderRecord>[]
  ), [displayTableColumns, expandedHierarchyParentIds]);

  const listTemplateFilter = (
    <CompactFilterBar
      items={listTemplateFilterItems}
      expanded={listTemplateFilterExpanded}
      visibleCount={4}
      onExpandChange={setListTemplateFilterExpanded}
      onReset={() => {
        setListTemplateFilterRevision((value) => value + 1);
        setListTemplateSelectedRowKeys([]);
        setListTemplateSelectedRows([]);
      }}
      onSearch={() => {
        setListTemplateFilterRevision((value) => value + 1);
        setListTemplateSelectedRowKeys([]);
        setListTemplateSelectedRows([]);
      }}
    />
  );
  const listTemplateTableBase = {
    columns: displayTableColumns,
    dataSource: listTemplateRows,
    options: false as const,
    pagination: false as const,
    search: false as const,
    scroll: { x: 1180 },
    tableAlertRender: false as const,
    onChange: handleListTemplateTableChange
  };

  return (
    <div className="design-system-page__layout-pattern-template">
      <div className="design-system-page__input-panel-head">
        <h3>TemplateListPage</h3>
        <ComponentEntry name="TemplateListPage / CompactFilterBar / SearchTable / TablePagination" />
        <p>列表页统一从这个入口接入。默认普通模式不带批量区；需要批量操作的页面必须声明批量模式，分页始终固定在右侧。</p>
        <div className="design-system-page__template-mode-switch">
          <AdminSegmented
            size="small"
            value={listTemplateMode}
            options={[
              { label: '普通列表', value: 'standard' },
              { label: '批量列表', value: 'batch' },
              { label: '层级列表', value: 'hierarchy' }
            ]}
            onChange={(value) => setListTemplateMode(value as 'standard' | 'batch' | 'hierarchy')}
          />
        </div>
        <div className="design-system-page__template-mode-list">
          <span>普通列表：用户、角色，不传选择列和批量操作</span>
          <span>批量列表：运维工单，使用 mode=&quot;batch&quot; 和 batch.actions</span>
          <span>层级列表：使用 HierarchyListCell，方框开关、主子标识和子级缩进保持统一</span>
        </div>
      </div>
      <div className="design-system-page__template-demo is-list">
        {listTemplateMode === 'batch' ? (
          <TemplateListPage<WorkOrderRecord>
            mode="batch"
            title="列表模板：运维工单"
            actions={<AdminButton type="primary">新增工单</AdminButton>}
            filter={listTemplateFilter}
            table={{
              ...listTemplateTableBase,
              rowSelection: {
                selectedRowKeys: listTemplateSelectedRowKeys,
                onChange: (selectedKeys, selectedRows) => {
                  setListTemplateSelectedRowKeys(selectedKeys);
                  setListTemplateSelectedRows(selectedRows);
                }
              }
            }}
            batch={{
              selectedCount: listTemplateSelectedRows.length,
              actions: (
                <>
                  <AdminButton size="small" disabled={listTemplateSelectedRows.length === 0}>批量指派</AdminButton>
                  <AdminButton size="small" disabled={listTemplateSelectedRows.length === 0}>批量状态变更</AdminButton>
                  <AdminButton danger size="small" disabled={listTemplateSelectedRows.length === 0}>批量删除</AdminButton>
                </>
              )
            }}
            pagination={listTemplatePagination}
          />
        ) : listTemplateMode === 'hierarchy' ? (
          <TemplateListPage<HierarchyWorkOrderRecord>
            key="hierarchy"
            mode="standard"
            title="列表模板：主子任务"
            actions={<AdminButton type="primary">新增任务</AdminButton>}
            table={{
              ...listTemplateTableBase,
              columns: hierarchyDisplayColumns,
              dataSource: visibleHierarchyTemplateRows,
              onChange: undefined
            }}
            pagination={{
              current: 1,
              pageSize: 20,
              total: hierarchyTemplateParentCount,
              onChange: () => undefined,
              onShowSizeChange: () => undefined
            }}
          />
        ) : (
          <TemplateListPage<WorkOrderRecord>
            mode="standard"
            title="列表模板：运维工单"
            actions={<AdminButton type="primary">新增工单</AdminButton>}
            filter={listTemplateFilter}
            table={listTemplateTableBase}
            pagination={listTemplatePagination}
          />
        )}
      </div>
    </div>
  );
}

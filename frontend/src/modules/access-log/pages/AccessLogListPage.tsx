import { useMemo } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  CompactFilterBar,
  createListFilterItems,
  createListSorters,
  listRouteCodecs,
  listSorters,
  StatusTag,
  TemplateListPage,
  useCommittedFilters,
  useTemplateServerListData
} from '../../../components/admin';
import { getAccessLogList } from '../../../api/accessLogApi';
import type { AccessLogFilters, AccessLogRecord } from '../../../api/accessLogApi';

type DateLike = AccessLogFilters['accessTimeRange'][number];

const defaultFilters: AccessLogFilters = {
  employeeNo: '',
  account: '',
  realName: '',
  result: undefined,
  failReason: undefined,
  ip: '',
  accessTimeRange: []
};

const accessLogSorters = createListSorters<AccessLogRecord>({
  employeeNo: listSorters.text((row) => row.employeeNo),
  account: listSorters.text((row) => row.account),
  realName: listSorters.text((row) => row.realName),
  result: listSorters.text((row) => row.result),
  failReason: listSorters.text((row) => row.failReason),
  loginAt: listSorters.date((row) => row.loginAt),
  logoutAt: listSorters.date((row) => row.logoutAt),
  lastActiveAt: listSorters.date((row) => row.lastActiveAt),
  durationSeconds: listSorters.number((row) => row.durationSeconds),
  ip: listSorters.text((row) => row.ip),
  userAgent: listSorters.text((row) => row.userAgent),
  createdAt: listSorters.date((row) => row.createdAt)
});

function getResultText(result: AccessLogRecord['result']) {
  if (result === 'success') return '成功';
  if (result === 'locked') return '限制';
  return '失败';
}

function toDateRange(value: unknown): DateLike[] {
  return Array.isArray(value) ? value.filter(Boolean) as DateLike[] : [];
}

export function AccessLogListPage() {
  const { draftFilters, appliedFilters, revision: filterRevision, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters, {
    urlSync: true,
    codecs: {
      result: listRouteCodecs.string,
      failReason: listRouteCodecs.string,
      accessTimeRange: listRouteCodecs.dateArray
    }
  });

  const {
    pagedRows,
    sortState,
    pagination,
    handleTableChange,
    renderIndex,
    loading,
    error,
    reload
  } = useTemplateServerListData({
    queryKey: ['access-logs', appliedFilters, filterRevision],
    request: ({ current, pageSize, sortField, sortOrder }) => getAccessLogList({
      ...appliedFilters,
      current,
      pageSize,
      sortField,
      sortOrder
    }),
    sorters: accessLogSorters,
    urlSync: true
  });

  const filterItems = useMemo(() => createListFilterItems([
    {
      key: 'employeeNo',
      label: '工号',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.employeeNo}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, employeeNo: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'account',
      label: '登录账号',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.account}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, account: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'realName',
      label: '姓名',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.realName}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, realName: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'result',
      label: '访问结果',
      node: (
        <AdminSelect
          size="small"
          value={draftFilters.result}
          placeholder="全部"
          options={[
            { label: '成功', value: 'success' },
            { label: '失败', value: 'failed' },
            { label: '限制', value: 'locked' }
          ]}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, result: value }))}
        />
      )
    },
    {
      key: 'failReason',
      label: '失败原因',
      node: (
        <AdminSelect
          size="small"
          value={draftFilters.failReason}
          placeholder="全部"
          options={[
            { label: '用户不存在', value: '用户不存在' },
            { label: '密码错误', value: '密码错误' },
            { label: '账号已停用', value: '账号已停用' },
            { label: '登录频率限制', value: '登录频率限制' }
          ]}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, failReason: value }))}
        />
      )
    },
    {
      key: 'ip',
      label: 'IP',
      node: (
        <AdminInput
          size="small"
          value={draftFilters.ip}
          placeholder="请输入"
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, ip: event.target.value }))}
          onPressEnter={() => {
            commitFilters();
          }}
        />
      )
    },
    {
      key: 'accessTimeRange',
      label: '访问时间',
      wide: true,
      node: (
        <AdminRangePicker
          size="small"
          value={draftFilters.accessTimeRange as never}
          placeholder={['开始日期', '结束日期']}
          onChange={(value) => setDraftFilters((prev) => ({ ...prev, accessTimeRange: toDateRange(value) }))}
        />
      )
    }
  ]), [commitFilters, draftFilters, setDraftFilters]);

  const columns: ProColumns<AccessLogRecord>[] = [
    {
      title: '序号',
      width: 56,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 120,
      fixed: 'left',
      sorter: true,
      sortOrder: sortState.field === 'employeeNo' ? sortState.order : null
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      width: 120,
      sorter: true,
      sortOrder: sortState.field === 'realName' ? sortState.order : null
    },
    {
      title: '登录账号',
      dataIndex: 'account',
      width: 140,
      sorter: true,
      sortOrder: sortState.field === 'account' ? sortState.order : null
    },
    {
      title: '访问结果',
      dataIndex: 'result',
      width: 110,
      sorter: true,
      sortOrder: sortState.field === 'result' ? sortState.order : null,
      render: (_, record) => (
        <StatusTag
          status={record.result === 'success' ? 'success' : 'error'}
          text={getResultText(record.result)}
        />
      )
    },
    {
      title: '失败原因',
      dataIndex: 'failReason',
      width: 140,
      sorter: true,
      sortOrder: sortState.field === 'failReason' ? sortState.order : null
    },
    {
      title: '登录时间',
      dataIndex: 'loginAt',
      width: 170,
      sorter: true,
      sortOrder: sortState.field === 'loginAt' ? sortState.order : null
    },
    {
      title: '退出时间',
      dataIndex: 'logoutAt',
      width: 170,
      sorter: true,
      sortOrder: sortState.field === 'logoutAt' ? sortState.order : null
    },
    {
      title: '最后活跃时间',
      dataIndex: 'lastActiveAt',
      width: 170,
      sorter: true,
      sortOrder: sortState.field === 'lastActiveAt' ? sortState.order : null
    },
    {
      title: '在线时长',
      dataIndex: 'durationText',
      width: 130,
      sorter: true,
      sortOrder: sortState.field === 'durationSeconds' ? sortState.order : null
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 150,
      sorter: true,
      sortOrder: sortState.field === 'ip' ? sortState.order : null
    },
    {
      title: '浏览器/设备',
      dataIndex: 'userAgent',
      width: 260,
      ellipsis: true,
      sorter: true,
      sortOrder: sortState.field === 'userAgent' ? sortState.order : null
    },
    {
      title: '记录时间',
      dataIndex: 'createdAt',
      width: 170,
      sorter: true,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : null
    }
  ];

  return (
    <TemplateListPage<AccessLogRecord>
      error={error}
      onRetry={reload}
      title="访问日志"
      filter={(
        <CompactFilterBar
          items={filterItems}
          visibleCount={4}
          onSearch={() => {
            commitFilters();
          }}
          onReset={() => {
            resetFilters();
          }}
        />
      )}
      table={{
        columns,
        dataSource: pagedRows,
        loading,
        pagination: false,
        search: false,
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1900 }
      }}
      pagination={pagination}
    />
  );
}

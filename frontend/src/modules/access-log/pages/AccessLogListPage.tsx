import { useEffect, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import {
  AdminInput,
  AdminRangePicker,
  AdminSelect,
  CompactFilterBar,
  StatusTag,
  TemplateListPage,
  useCommittedFilters,
  useTemplateListPageData
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

const accessLogSorters: Record<string, (a: AccessLogRecord, b: AccessLogRecord) => number> = {
  employeeNo: (a, b) => a.employeeNo.localeCompare(b.employeeNo),
  account: (a, b) => a.account.localeCompare(b.account),
  realName: (a, b) => a.realName.localeCompare(b.realName),
  result: (a, b) => a.result.localeCompare(b.result),
  failReason: (a, b) => a.failReason.localeCompare(b.failReason),
  loginAt: (a, b) => a.loginAt.localeCompare(b.loginAt),
  logoutAt: (a, b) => a.logoutAt.localeCompare(b.logoutAt),
  lastActiveAt: (a, b) => a.lastActiveAt.localeCompare(b.lastActiveAt),
  durationSeconds: (a, b) => a.durationSeconds - b.durationSeconds,
  ip: (a, b) => a.ip.localeCompare(b.ip),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

function getResultText(result: AccessLogRecord['result']) {
  if (result === 'success') return '成功';
  if (result === 'locked') return '限制';
  return '失败';
}

function toDateRange(value: unknown): DateLike[] {
  return Array.isArray(value) ? value.filter(Boolean) as DateLike[] : [];
}

export function AccessLogListPage() {
  const [rows, setRows] = useState<AccessLogRecord[]>([]);
  const { draftFilters, appliedFilters, setDraftFilters, commitFilters, resetFilters } = useCommittedFilters(defaultFilters);

  useEffect(() => {
    getAccessLogList(appliedFilters).then((result) => {
      setRows(result.list);
    });
  }, [appliedFilters]);

  const {
    currentPage,
    pageSize,
    pagedRows,
    sortState,
    total,
    setCurrentPage,
    setPageSize,
    handleTableChange,
    renderIndex
  } = useTemplateListPageData({ rows, sorters: accessLogSorters });

  const filterItems = useMemo(() => [
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
            setCurrentPage(1);
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
            setCurrentPage(1);
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
            setCurrentPage(1);
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
            setCurrentPage(1);
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
  ], [commitFilters, draftFilters, setCurrentPage, setDraftFilters]);

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
      ellipsis: true
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
      title="访问日志"
      filter={(
        <CompactFilterBar
          items={filterItems}
          visibleCount={4}
          onSearch={() => {
            commitFilters();
            setCurrentPage(1);
          }}
          onReset={() => {
            resetFilters();
            setCurrentPage(1);
          }}
        />
      )}
      table={{
        columns,
        dataSource: pagedRows,
        pagination: false,
        search: false,
        onChange: handleTableChange,
        tableAlertRender: false,
        scroll: { x: 1900 }
      }}
      scrollYDeps={[total, currentPage, pageSize, pagedRows.length]}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        onChange: (page, size) => {
          setCurrentPage(page);
          setPageSize(size);
        },
        onShowSizeChange: (_, size) => {
          setCurrentPage(1);
          setPageSize(size);
        }
      }}
    />
  );
}

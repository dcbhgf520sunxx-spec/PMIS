import { App, Form } from 'antd';
import dayjs from 'dayjs';
import type { ProColumns } from '@ant-design/pro-components';
import { useCallback, useEffect, useState } from 'react';
import {
  AdminAlert, AdminDatePicker, AdminFormItem, AdminInput, AdminModal, AdminNumberInput, AdminSpace,
  AdminSwitch, AdminTextAction, OperationColumnActions, StatusConfirmAction, StatusTag,
  TemplateDrawerTable, TemplateListPage, useTemplateListPageData,
} from '../../../components/admin';
import {
  changeIntegrationStatus, listIntegrations, listIntegrationExecutions, listIntegrationRecords, runIntegrationSync,
  testIntegrationConnection, updateIntegration, type IntegrationConfig, type IntegrationExecution,
  type IntegrationSyncRecord,
} from '../../../api/integrationApi';

const statusText: Record<string, string> = { idle: '未执行', running: '执行中', success: '成功', failed: '失败' };
const formatTime = (value?: string) => (value ? value.slice(0, 19).replace('T', ' ') : '-');
const formatAutoExecution = (row: IntegrationConfig) => !row.auto_enabled
  ? '未启用'
  : !row.auto_start_at
    ? '待设置首次执行时间'
    : `${formatTime(row.auto_start_at)} 起，每 ${row.sync_interval_hours} 小时`;
const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function IntegrationPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [editing, setEditing] = useState<IntegrationConfig>();
  const [selected, setSelected] = useState<IntegrationConfig>();
  const [executions, setExecutions] = useState<IntegrationExecution[]>([]);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionError, setExecutionError] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<IntegrationExecution>();
  const [records, setRecords] = useState<IntegrationSyncRecord[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<number>();
  const autoEnabled = Form.useWatch('auto_enabled', form);

  const configList = useTemplateListPageData({ rows: configs, defaultPageSize: 20, urlSync: true });
  const executionList = useTemplateListPageData({ rows: executions, defaultPageSize: 10 });
  const recordList = useTemplateListPageData({ rows: records, defaultPageSize: 20 });

  const reload = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      setConfigs(await listIntegrations());
    } catch (error) {
      setConfigError(getErrorMessage(error, '加载接口配置失败'));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const loadHistory = useCallback(async (row: IntegrationConfig) => {
    setExecutionLoading(true);
    setExecutionError('');
    try {
      setExecutions((await listIntegrationExecutions(row.id)).list);
    } catch (error) {
      setExecutionError(getErrorMessage(error, '加载执行历史失败'));
    } finally {
      setExecutionLoading(false);
    }
  }, []);

  const showHistory = (row: IntegrationConfig) => {
    setSelected(row);
    setSelectedExecution(undefined);
    setRecords([]);
    void loadHistory(row);
  };

  const showRecords = async (row: IntegrationExecution) => {
    if (!selected) return;
    setSelectedExecution(row);
    setRecordLoading(true);
    setRecordError('');
    try {
      setRecords((await listIntegrationRecords(selected.id, row.id)).list);
    } catch (error) {
      setRecordError(getErrorMessage(error, '加载执行明细失败'));
    } finally {
      setRecordLoading(false);
    }
  };

  const openEdit = (row: IntegrationConfig) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      endpoint_url: row.endpoint_url,
      auto_enabled: row.auto_enabled === 1,
      sync_interval_hours: row.sync_interval_hours,
      auto_start_at: row.auto_start_at ? dayjs(row.auto_start_at) : undefined,
    });
  };

  const save = async () => {
    if (!editing) return;
    const values = await form.validateFields();
    await updateIntegration(editing.id, {
      ...values,
      auto_enabled: values.auto_enabled ? 1 : 0,
      auto_start_at: values.auto_start_at?.toISOString(),
    });
    setEditing(undefined);
    message.success('接口配置已保存');
    await reload();
  };

  const test = async (row: IntegrationConfig) => {
    setTestingId(row.id);
    try {
      await testIntegrationConnection(row.id);
      message.success('连接成功');
    } catch (error) {
      message.error(getErrorMessage(error, '测试连接失败'));
    } finally {
      setTestingId(undefined);
    }
  };

  const changeStatus = async (row: IntegrationConfig, enabled: 0 | 1) => {
    await changeIntegrationStatus(row.id, enabled);
    message.success(enabled === 1 ? '接口已启用' : '接口已停用');
    await reload();
  };

  const sync = (row: IntegrationConfig) => modal.confirm({
    title: `立即同步“${row.name}”？`,
    content: '系统将按当前配置执行一次同步，并记录完整执行历史。',
    okText: '确认同步',
    cancelText: '取消',
    onOk: async () => {
      setBusy(true);
      try {
        const result = await runIntegrationSync(row.id);
        message.success(`同步完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`);
        await reload();
        if (selected?.id === row.id) await loadHistory(row);
      } catch (error) {
        message.error(getErrorMessage(error, '同步失败'));
      } finally {
        setBusy(false);
      }
    },
  });

  const configColumns: ProColumns<IntegrationConfig>[] = [
    { title: '序号', width: 60, fixed: 'left', render: (_, __, index) => configList.renderIndex(index) },
    { title: '接口名称', dataIndex: 'name', width: 260, ellipsis: true },
    { title: '状态', width: 90, render: (_, row) => <StatusTag status={row.enabled ? 'success' : 'pending'} text={row.enabled ? '启用' : '停用'} /> },
    {
      title: '自动执行',
      dataIndex: 'auto_start_at',
      width: 320,
      ellipsis: true,
      renderText: (_, row) => formatAutoExecution(row),
      onCell: (row) => ({ title: formatAutoExecution(row) }),
    },
    { title: '最近执行', width: 170, render: (_, row) => formatTime(row.last_finished_at) },
    { title: '最近结果', width: 110, render: (_, row) => <StatusTag status={row.last_status === 'success' ? 'success' : row.last_status === 'failed' ? 'error' : 'pending'} text={statusText[row.last_status] || row.last_status} /> },
    {
      title: '操作', valueType: 'option', width: 230,
      render: (_, row) => <OperationColumnActions>
        <AdminTextAction onClick={() => openEdit(row)}>编辑</AdminTextAction>
        <StatusConfirmAction
          variant="text"
          action={row.enabled ? 'disable' : 'enable'}
          entityName="接口"
          targetName={row.name}
          onConfirm={() => changeStatus(row, row.enabled ? 0 : 1)}
        >{row.enabled ? '停用' : '启用'}</StatusConfirmAction>
        <AdminTextAction disabled={testingId === row.id} onClick={() => test(row)}>{testingId === row.id ? '测试中…' : '测试连接'}</AdminTextAction>
        <AdminTextAction disabled={busy || !row.enabled} onClick={() => sync(row)}>立即同步</AdminTextAction>
        <AdminTextAction onClick={() => showHistory(row)}>查看历史</AdminTextAction>
      </OperationColumnActions>,
    },
  ];

  const executionColumns: ProColumns<IntegrationExecution>[] = [
    { title: '执行方式', width: 100, render: (_, row) => row.trigger_type === 'auto' ? '自动执行' : '手动执行' },
    { title: '开始时间', width: 170, render: (_, row) => formatTime(row.started_at) },
    { title: '结束时间', width: 170, render: (_, row) => formatTime(row.finished_at) },
    { title: '结果', width: 100, render: (_, row) => <StatusTag status={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : 'pending'} text={statusText[row.status] || row.status} /> },
    { title: '失败原因', dataIndex: 'error_message', ellipsis: true },
    { title: '操作', valueType: 'option', width: 100, render: (_, row) => <AdminTextAction onClick={() => void showRecords(row)}>查看明细</AdminTextAction> },
  ];

  const recordColumns: ProColumns<IntegrationSyncRecord>[] = [
    { title: '来源编号', dataIndex: 'source_key', width: 170 },
    { title: '来源类型', dataIndex: 'source_type', width: 130 },
    { title: '目标数据', width: 160, render: (_, row) => row.target_type
      ? `${row.target_type === 'requirement' ? '需求' : row.target_type === 'work_order' ? '运维工单' : row.target_type} #${row.target_id || '-'}`
      : '-' },
    { title: '执行动作', dataIndex: 'execution_action', width: 100 },
    { title: '处理说明', dataIndex: 'processing_note', width: 300, ellipsis: true },
    { title: '结果', width: 100, render: (_, row) => <StatusTag
      status={row.sync_status === 'success' ? 'success' : row.sync_status === 'skipped' ? 'pending' : 'error'}
      text={row.sync_status === 'success' ? '成功' : row.sync_status === 'skipped' ? '跳过' : '失败'} /> },
    { title: '提醒', dataIndex: 'warning_message', ellipsis: true },
    { title: '失败原因', dataIndex: 'error_message', ellipsis: true },
    { title: '同步时间', width: 170, render: (_, row) => formatTime(row.synced_at) },
  ];

  return <>
    <TemplateListPage<IntegrationConfig>
      title="接口管理"
      error={configError}
      onRetry={reload}
      table={{ rowKey: 'id', columns: configColumns, dataSource: configList.pagedRows, loading: configLoading, preferenceKey: 'integration:config-list', pagination: false, search: false, tableAlertRender: false, onChange: configList.handleTableChange }}
      pagination={configList.pagination}
    />

    <TemplateDrawerTable<IntegrationExecution>
      title={`${selected?.name || ''} · 执行历史`}
      width="calc(100vw - 220px)"
      open={Boolean(selected)}
      onClose={() => { setSelected(undefined); setSelectedExecution(undefined); setRecords([]); }}
      description={selected?.last_error ? <AdminAlert type="error" showIcon message="最近执行失败" description={selected.last_error} /> : undefined}
      list={{
        error: executionError,
        onRetry: selected ? () => void loadHistory(selected) : undefined,
        table: { rowKey: 'id', columns: executionColumns, dataSource: executionList.pagedRows, loading: executionLoading, preferenceKey: 'integration:execution-history', pagination: false, search: false, tableAlertRender: false, onChange: executionList.handleTableChange },
        pagination: executionList.pagination,
      }}
    />

    <TemplateDrawerTable<IntegrationSyncRecord>
      title="执行明细"
      width="calc(100vw - 300px)"
      open={Boolean(selectedExecution)}
      onClose={() => { setSelectedExecution(undefined); setRecords([]); }}
      description={selectedExecution ? `${formatTime(selectedExecution.started_at)} 开始执行` : undefined}
      list={{
        error: recordError,
        onRetry: selectedExecution ? () => void showRecords(selectedExecution) : undefined,
        table: { rowKey: 'id', columns: recordColumns, dataSource: recordList.pagedRows, loading: recordLoading, preferenceKey: 'integration:sync-records', pagination: false, search: false, tableAlertRender: false, scroll: { x: 1600 }, onChange: recordList.handleTableChange },
        pagination: recordList.pagination,
      }}
    />

    <AdminModal title="编辑接口配置" open={Boolean(editing)} onCancel={() => setEditing(undefined)} onOk={save}>
      <Form form={form} layout="vertical">
        <AdminFormItem name="name" label="接口名称" rules={[{ required: true, message: '请输入接口名称' }]}><AdminInput /></AdminFormItem>
        <AdminFormItem name="endpoint_url" label="接口地址" rules={[{ required: true, message: '请输入接口地址' }]}><AdminInput /></AdminFormItem>
        <AdminSpace size="large">
          <AdminFormItem name="auto_enabled" label="自动执行" valuePropName="checked"><AdminSwitch checkedChildren="启用" unCheckedChildren="停用" /></AdminFormItem>
          {autoEnabled ? <>
            <AdminFormItem name="auto_start_at" label="首次执行时间" rules={[{ required: true, message: '请选择首次执行时间' }]}><AdminDatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" /></AdminFormItem>
            <AdminFormItem name="sync_interval_hours" label="执行间隔（小时）" rules={[{ required: true, message: '请输入执行间隔' }]}><AdminNumberInput min={1} max={720} /></AdminFormItem>
          </> : null}
        </AdminSpace>
      </Form>
    </AdminModal>
  </>;
}

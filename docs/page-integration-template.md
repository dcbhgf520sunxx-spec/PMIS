# 页面接入代码样板

## 适用范围

本样板用于后续新增后台业务模块。页面实现默认遵循当前架构：React / Vite 前端、Express REST API、PostgreSQL 数据库。

## 目录结构

```text
frontend/src/modules/<module>/pages/<Module>ListPage.tsx
frontend/src/modules/<module>/pages/<Module>FormPage.tsx
frontend/src/modules/<module>/pages/<Module>DetailPage.tsx
frontend/src/modules/<module>/types.ts
frontend/src/api/<module>Api.ts
backend/src/controllers/<module>Controller.js
backend/src/routes/<module>.js
```

## API 接入样板

```ts
import { request, unwrap } from './requestClient';
import type { PageResult } from '../types/api';

export type DemoRecord = Record<string, unknown> & {
  id: string;
  name: string;
  status: 'enabled' | 'disabled';
  createdAt: string;
};

type DemoResponse = {
  id: number;
  name: string;
  status: number;
  created_at?: string;
};

function toRecord(row: DemoResponse): DemoRecord {
  return {
    id: String(row.id),
    name: row.name,
    status: Number(row.status) === 1 ? 'enabled' : 'disabled',
    createdAt: String(row.created_at || '').slice(0, 19).replace('T', ' ')
  };
}

export async function getDemoList(params: Record<string, unknown>): Promise<PageResult<DemoRecord>> {
  const rows = await unwrap<DemoResponse[]>(request.get('/demos', { params }));
  const page = Number(params.current || 1);
  const pageSize = Number(params.pageSize || 20);
  const start = (page - 1) * pageSize;

  return {
    list: rows.map(toRecord).slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize
  };
}
```

## 核心页面模板入口

后续新增业务模块时，列表、新增编辑、详情三类核心页面必须从页面级模板入口开始，不直接在业务页拼 `PageShell`、`DataListPage`、`FormPage`、`TablePagination` 或详情页外层布局。

业务页面只保留业务字段、接口调用、筛选状态、列配置和业务动作。页面结构、页头、操作区、列表底部、表单分组、详情分组、主区/侧区等由模板入口承接。

### 列表页入口

列表页统一使用 `TemplateListPage` 和 `useTemplateListPageData`。

必须保持以下规则：

- 第一列业务值进入详情，操作列不放“详情”。
- 操作列使用 `OperationColumnActions`，默认文字操作；删除、停用等危险动作使用 `ConfirmAction`。
- 序号使用 `renderIndex(index)`，按过滤后的全量数据位置计算。
- 排序交给 `useTemplateListPageData`，先排序过滤后的全量数据，再分页。
- 分页配置通过 `TemplateListPage.pagination` 传入，不在业务页直接放 `TablePagination`。
- 普通列表不传选择列、批量操作和已选数量，分页保持在右侧。
- 批量列表必须显式声明 `mode="batch"`，并通过 `batch` 传入已选数量和批量操作。
- 筛选区使用 `CompactFilterBar`，表格区和底部分页区由模板承接。

```tsx
import type { ProColumns } from '@ant-design/pro-components';
import { useMemo, useState } from 'react';
import { Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  AdminTextAction,
  CompactFilterBar,
  ConfirmAction,
  DetailLinkCell,
  OperationColumnActions,
  PermissionButton,
  StatusTag,
  TemplateListPage,
  useTemplateListPageData
} from '../../../components/admin';
import { deleteDemo, getDemoList, type DemoRecord } from '../../../api/demoApi';

const demoSorters: Record<string, (a: DemoRecord, b: DemoRecord) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt)
};

export function DemoListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DemoRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const filteredRows = useMemo(
    () => rows.filter((row) => appliedKeyword ? row.name.includes(appliedKeyword) : true),
    [appliedKeyword, rows]
  );

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
  } = useTemplateListPageData({ rows: filteredRows, sorters: demoSorters });

  const columns: ProColumns<DemoRecord>[] = [
    {
      title: '序号',
      width: 56,
      fixed: 'left',
      hideInSetting: true,
      search: false,
      render: (_, __, index) => renderIndex(index)
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 180,
      fixed: 'left',
      sorter: true,
      sortOrder: sortState.field === 'name' ? sortState.order : null,
      render: (_, record) => (
        <DetailLinkCell onClick={() => navigate(`/demos/${record.id}`)}>
          {record.name}
        </DetailLinkCell>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => <StatusTag status={record.status} />
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <OperationColumnActions>
          <AdminTextAction onClick={() => navigate(`/demos/${record.id}/edit`)}>编辑</AdminTextAction>
          <ConfirmAction variant="text" danger title="确认删除" description={`将删除 ${record.name}。`} onConfirm={() => deleteDemo(record.id)}>
            删除
          </ConfirmAction>
        </OperationColumnActions>
      )
    }
  ];

  return (
    <TemplateListPage<DemoRecord>
      title="示例模块"
      actions={<ActionBar><PermissionButton type="primary" permission="demo:create" onClick={() => navigate('/demos/new')}>新增</PermissionButton></ActionBar>}
      filter={(
        <CompactFilterBar
          items={[{
            key: 'name',
            label: '名称',
            node: <Input size="small" value={keyword} placeholder="请输入" onChange={(event) => setKeyword(event.target.value)} />
          }]}
          onSearch={() => {
            setAppliedKeyword(keyword);
            setCurrentPage(1);
          }}
          onReset={() => {
            setKeyword('');
            setAppliedKeyword('');
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
        scroll: { x: 1000 }
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
```

批量列表只在业务明确需要时启用，例如运维工单：

```tsx
<TemplateListPage<DemoRecord>
  mode="batch"
  title="示例模块"
  table={{
    columns,
    dataSource: pagedRows,
    pagination: false,
    search: false,
    rowSelection: {
      selectedRowKeys,
      onChange: (keys, records) => {
        setSelectedRowKeys(keys);
        setSelectedRows(records);
      }
    },
    onChange: handleTableChange,
    tableAlertRender: false,
    scroll: { x: 1000 }
  }}
  batch={{
    selectedCount: selectedRows.length,
    actions: (
      <Button size="small" disabled={selectedRows.length === 0}>
        批量操作
      </Button>
    )
  }}
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
```

### 新增编辑页入口

新增编辑页统一使用 `TemplateFormPage` 和 `TemplateFormSection`。

```tsx
import { ProFormText } from '@ant-design/pro-components';
import { useNavigate, useParams } from 'react-router-dom';
import { TemplateFormPage, TemplateFormSection } from '../../../components/admin';

type DemoFormValues = Record<string, unknown> & {
  name: string;
};

export function DemoFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const params = useParams();

  return (
    <TemplateFormPage<DemoFormValues>
      title={mode === 'create' ? '新增示例' : '编辑示例'}
      formId="demo-form"
      onCancel={() => navigate('/demos')}
      onSubmit={async (values) => {
        if (mode === 'edit' && params.id) {
          await updateDemo(params.id, values);
        } else {
          await createDemo(values);
        }
        navigate('/demos');
      }}
    >
      <TemplateFormSection title="基本信息">
        <div className="admin-template-form-page__grid">
          <ProFormText
            className="admin-template-form-page__field"
            formItemProps={{ className: 'admin-template-form-page__field' }}
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          />
        </div>
      </TemplateFormSection>
    </TemplateFormPage>
  );
}
```

### 详情页入口

详情页统一使用 `TemplateDetailPage` 和 `TemplateDetailSection`。

```tsx
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ActionBar, DetailMetaList, TemplateDetailPage, TemplateDetailSection } from '../../../components/admin';

export function DemoDetailPage({ demo }: { demo?: DemoRecord }) {
  const navigate = useNavigate();

  return (
    <TemplateDetailPage
      title="示例详情"
      loading={!demo}
      actions={<ActionBar><Button onClick={() => navigate('/demos')}>返回列表</Button></ActionBar>}
      aside={demo ? (
        <TemplateDetailSection title="单据信息">
          <DetailMetaList
            columns={2}
            items={[
              { label: '创建时间', value: demo.createdAt || '-', wide: true },
              { label: '更新时间', value: demo.updatedAt || '-', wide: true }
            ]}
          />
        </TemplateDetailSection>
      ) : null}
    >
      {demo ? (
        <TemplateDetailSection title="基本信息">
          <DetailMetaList items={[{ label: '名称', value: demo.name }]} />
        </TemplateDetailSection>
      ) : null}
    </TemplateDetailPage>
  );
}
```

## 后端接口样板

```js
const db = require('../db')

exports.list = async (req, res) => {
  const rows = await db.prepare('SELECT id, name, status, created_at FROM pms_demo WHERE is_deleted = 0 ORDER BY created_at DESC').all()
  res.json({ code: 0, message: 'success', data: rows })
}

exports.create = async (req, res) => {
  const { name, creator_id } = req.body
  const result = await db.prepare('INSERT INTO pms_demo (name, creator_id, updater_id) VALUES (?, ?, ?)').run(name, creator_id || null, creator_id || null)
  res.json({ code: 0, message: 'success', data: { id: result.lastInsertRowid } })
}
```

## 接入要求

- 业务页面只组合组件、传入数据、处理业务流程。
- 通用样式、空状态、加载态、错误态、确认框、状态标签优先使用 `frontend/src/components/admin`。
- API 返回统一使用 `{ code, message, data }`。
- 前端 `id` 统一转成字符串，后端写入时再转成数字。
- 新模块路由统一注册到 `frontend/src/app/routes.tsx`。

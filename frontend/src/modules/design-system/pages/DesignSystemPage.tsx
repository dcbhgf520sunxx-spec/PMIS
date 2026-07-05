import { type Key, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ProColumns,
} from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import {
  UserOutlined
} from '@ant-design/icons';
import {
  AdminActionDropdown,
  AdminAlert,
  AdminAvatar,
  AdminAvatarGroup,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCollapse,
  AdminDatePicker,
  AdminDrawer,
  AdminEmptyState,
  AdminFormItem,
  AdminInput,
  AdminList,
  AdminListItem,
  AdminListItemMeta,
  AdminModal,
  AdminParagraph,
  AdminPopover,
  AdminProgress,
  AdminRangePicker,
  AdminSegmented,
  AdminSelect,
  AdminSpace,
  AdminSpin,
  AdminStatistic,
  AdminTag,
  AdminTextArea,
  AdminTextAction,
  AdminTree,
  BubbleConfirmAction,
  ConfirmAction,
  CompactFilterBar,
  DeleteConfirmAction,
  DetailMetaList,
  HistoryTimeline,
  MetricCard,
  OperationColumnActions,
  PageShell,
  SearchTable,
  StatusConfirmAction,
  StatusFlowModal,
  StatusTag,
  TableFooterBar,
  TablePagination,
  TemplateListPage
} from '../../../components/admin';
import { useAdminFeedback } from '../../../components/admin';
import { DesignCategory, isDesignCategory } from '../categories';
import { BaseSection } from './sections/BaseSection';
import { FoundationSection } from './sections/FoundationSection';
import { InputSection } from './sections/InputSection';
import { OverviewSection } from './sections/OverviewSection';
import { DetailTemplateDemo } from './demos/DetailTemplateDemo';
import { FormTemplateDemo } from './demos/FormTemplateDemo';
import { ComponentEntry } from './components/ComponentEntry';
import { useDrawerTableScrollY } from './hooks/useDrawerTableScrollY';
import { mockWorkOrderHistory, mockWorkOrders, workOrderUsers } from '../../work-order/mock';
import type { WorkOrderRecord, WorkOrderStatus } from '../../work-order/types';
import {
  problemTypeOptions,
  problemTypeText,
  renderOverdue,
  renderUrgency,
  renderWorkOrderStatus,
  statusOptions,
  urgencyOptions
} from '../../work-order/helpers';
import './DesignSystemPage.css';

type DrawerTableRecord = WorkOrderRecord;

type DrawerTableFilters = {
  problemDesc: string;
  problemTypes: WorkOrderRecord['problemType'][];
  urgency?: WorkOrderRecord['urgency'];
  status?: WorkOrderRecord['status'];
  isOverdue?: boolean;
  followerId?: string;
  submitterName: string;
  submitTimeRange: unknown[];
  expectedResolveDateRange: unknown[];
};

type LayoutPattern = {
  title: string;
  description: string;
  preview: ReactNode;
  rules: string[];
};

const defaultDrawerTableFilters: DrawerTableFilters = {
  problemDesc: '',
  problemTypes: [],
  urgency: undefined,
  status: undefined,
  isOverdue: undefined,
  followerId: undefined,
  submitterName: '',
  submitTimeRange: [],
  expectedResolveDateRange: []
};

function toDateText(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object' && 'format' in value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return String(value).slice(0, 10);
}

function inDateRange(value: string, range: unknown[]) {
  if (range.length !== 2 || !range[0] || !range[1]) return true;
  const start = toDateText(range[0]);
  const end = toDateText(range[1]);
  const current = value.slice(0, 10);
  return current >= start && current <= end;
}

const drawerTableColumns: ProColumns<DrawerTableRecord>[] = [
  { title: '序号', valueType: 'index', width: 48, fixed: 'left', hideInSetting: true },
  {
    title: '问题描述',
    dataIndex: 'problemDesc',
    width: 320,
    fixed: 'left',
    ellipsis: true,
    sorter: (a, b) => a.problemDesc.localeCompare(b.problemDesc),
    render: (_, record) => (
      <div className="design-system-page__drawer-problem-cell">
        <AdminTextAction className="design-system-page__drawer-table-link" title={record.problemDesc}>
          {record.problemDesc}
        </AdminTextAction>
        {record.isOverdue ? <span className="design-system-page__drawer-problem-tag">{renderOverdue(true)}</span> : null}
      </div>
    )
  },
  {
    title: '问题类型',
    dataIndex: 'problemType',
    width: 100,
    ellipsis: true,
    sorter: (a, b) => problemTypeText(a.problemType).localeCompare(problemTypeText(b.problemType)),
    render: (_, record) => problemTypeText(record.problemType)
  },
  {
    title: '跟进人',
    dataIndex: 'followerName',
    width: 80,
    ellipsis: true,
    sorter: (a, b) => (a.followerName || '').localeCompare(b.followerName || '')
  },
  {
    title: '紧急程度',
    dataIndex: 'urgency',
    width: 80,
    sorter: (a, b) => a.urgency - b.urgency,
    render: (_, record) => renderUrgency(record.urgency)
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    sorter: (a, b) => a.status - b.status,
    render: (_, record) => renderWorkOrderStatus(record.status)
  },
  {
    title: '提出人',
    dataIndex: 'submitterName',
    width: 80,
    ellipsis: true,
    sorter: (a, b) => a.submitterName.localeCompare(b.submitterName)
  },
  {
    title: '提出时间',
    dataIndex: 'submitTime',
    width: 130,
    sorter: (a, b) => a.submitTime.localeCompare(b.submitTime),
    render: (_, record) => record.submitTime.slice(0, 10)
  },
  { title: '预计完成时间', dataIndex: 'expectedResolveDate', width: 140 },
  { title: '创建人', dataIndex: 'creatorName', width: 80, ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', width: 150, ellipsis: true },
  {
    title: '操作',
    valueType: 'option',
    width: 180,
    fixed: 'right',
    render: () => (
      <OperationColumnActions>
        <AdminTextAction className="design-system-page__drawer-table-link">编辑</AdminTextAction>
        <AdminTextAction className="design-system-page__drawer-table-link">状态变更</AdminTextAction>
        <AdminActionDropdown
          items={[
            { key: 'copy', label: '复制' },
            { key: 'delete', label: '删除', danger: true }
          ]}
          onClick={() => undefined}
        />
      </OperationColumnActions>
    )
  }
];

const layoutSpecs = [
  { label: '系统框架', value: '顶部栏、侧边栏、消息、用户入口统一位置' },
  { label: '列表页', value: '标题区、筛选区、表格区、底部分页固定，批量操作按业务启用' },
  { label: '详情页', value: '标题后展示关键状态，信息一次性给到用户' },
  { label: '新增 / 编辑页', value: '操作放右上，字段分组，长文本独占整行' },
  { label: '弹窗 / 抽屉', value: '普通确认、危险确认、状态变更使用统一结构' }
];

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

const feedbackSpecs = [
  { label: '轻提示与横幅', value: '用于即时反馈和页面内持续提示，短句中文，靠近相关内容' },
  { label: '通知提醒', value: '用于后台任务或跨区域提醒，标题说事件，正文说下一步' },
  { label: '气泡确认框', value: '用于按钮或文字操作旁的二次确认，高风险动作必须说明后果' },
  { label: '进度反馈', value: '用于导入、导出、批处理等可量化任务，明确展示完成比例' },
  { label: '加载状态', value: '用于局部等待和提交中状态，只加载正在处理的区域' },
  { label: '弹窗与抽屉', value: '弹窗承接短流程，抽屉承接侧向补充，不替代详情页' }
];

const layoutPatterns: LayoutPattern[] = [
  {
    title: '系统框架',
    description: '后台系统的外层骨架。顶部只承载系统级信息和个人入口，左侧承载一级/二级菜单，右侧工作区承载具体业务页面。框架的核心目标是稳定、节省空间、让业务内容优先。',
    preview: (
      <div className="design-system-page__layout-shot is-shell">
        <div className="design-system-page__layout-shot-topbar">
          <b>顶部系统栏</b>
          <span>消息</span>
          <span>用户</span>
        </div>
        <div className="design-system-page__layout-shot-body">
          <div className="design-system-page__layout-shot-sider">
            <em>侧边菜单</em>
            <span />
            <span />
            <span />
          </div>
          <div className="design-system-page__layout-shot-workspace">
            <i className="design-system-page__layout-label">工作区</i>
            <div className="design-system-page__layout-shot-title" />
            <div className="design-system-page__layout-shot-filter" />
            <div className="design-system-page__layout-shot-content" />
          </div>
        </div>
      </div>
    ),
    rules: [
      '顶部系统栏固定高度，放系统名称、消息、用户，不放业务筛选和页面操作',
      '侧边栏默认紧凑，支持展开和收起，收起后图标必须居中',
      '二级菜单缩进必须从属于一级菜单，不能比一级菜单更靠左',
      '工作区是主要信息承载区，不放无意义说明，不用装饰卡片占空间'
    ]
  },
  {
    title: '列表页',
    description: '用于承载高频查询、筛选和数据维护。页面由标题区、筛选区、表格区、底部分页区组成，核心原则是表格区最大化，筛选和底部栏稳定不跳动；批量操作只在业务明确需要时启用。',
    preview: (
      <div className="design-system-page__layout-shot is-list">
        <div className="design-system-page__layout-shot-header">
          <i className="design-system-page__layout-label">标题区</i>
          <strong>运维工单</strong>
          <span>全部 56</span>
          <span>我的工单 19</span>
          <button>新增工单</button>
        </div>
        <div className="design-system-page__layout-shot-filter">
          <i className="design-system-page__layout-label">筛选区</i>
          <span>问题描述</span>
          <span>问题类型</span>
          <span>状态</span>
          <button>查询</button>
        </div>
        <div className="design-system-page__layout-shot-table">
          <i className="design-system-page__layout-label">表格区</i>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="design-system-page__layout-shot-footer">
          <i className="design-system-page__layout-label">底部分页区</i>
          <span>分页</span>
        </div>
      </div>
    ),
    rules: [
      '标题区放页面名称、可选页签和主操作，页签有的页面才出现',
      '筛选区字段宽度、高度、间距统一，必须点击查询才更新列表结果',
      '表格区直接顶到底部操作区，横向滚动条贴近底部栏上方',
      '列内容不换行，放不下用省略号，排序和列宽调整不能互相误触',
      '详情入口使用第一列业务值的 DetailLinkCell，操作列不放“详情”',
      '操作列使用 OperationColumnActions，默认是文字操作，删除、停用走确认动作',
      '底部栏固定承载分页；只有运维工单这类明确需要批量处理的页面才传入批量操作',
      '用户、角色等无批量业务的列表不展示批量区，分页必须保持在右侧'
    ]
  },
  {
    title: '详情页',
    description: '用于一次性阅读单据全量信息。详情页不做“更多”隐藏核心内容，状态集中在标题后和右侧状态区，主体信息按通用分组展示，避免过度业务化标题。',
    preview: (
      <div className="design-system-page__layout-shot is-detail">
        <div className="design-system-page__layout-shot-header">
          <i className="design-system-page__layout-label">标题与操作</i>
          <strong>工单详情</strong>
          <span>待处理</span>
          <span>逾期 3 天</span>
          <button>编辑</button>
        </div>
        <div className="design-system-page__layout-shot-detail">
          <div>
            <i className="design-system-page__layout-label">详情内容区</i>
            <section>基本信息</section>
            <section>处理信息</section>
            <section>变更历史</section>
          </div>
          <aside>
            <i className="design-system-page__layout-label">右侧状态区</i>
            <span>当前状态</span>
            <span>单据信息</span>
            <button>状态变更</button>
          </aside>
        </div>
      </div>
    ),
    rules: [
      '标题后只放关键状态、紧急程度、逾期，不在内容区重复出现状态标签',
      '右侧状态区承载当前状态、单据信息和状态变更，不分散放操作',
      '主体字段使用完整字段名，字段名和值保持左对齐和行高一致',
      '变更历史默认可收起，全部展开/收起和单条展开/收起是两个动作',
      '所属系统、问题类型等普通字段不用标签，只有状态类信息使用标签'
    ]
  },
  {
    title: '新增 / 编辑页',
    description: '用于创建和维护单据。操作固定在右上角，表单按信息类型分组，字段宽度和高度统一，长文本独占整行，确保高频录入时清晰、稳定、少误触。',
    preview: (
      <div className="design-system-page__layout-shot is-form">
        <div className="design-system-page__layout-shot-header">
          <i className="design-system-page__layout-label">标题与操作</i>
          <strong>新增工单</strong>
          <button>保存</button>
        </div>
        <div className="design-system-page__layout-shot-form">
          <i className="design-system-page__layout-label">表单分组</i>
          <span className="is-long">问题描述</span>
          <span>所属系统</span>
          <span>问题类型</span>
          <span>紧急程度</span>
          <span>提出人</span>
          <span>提出时间</span>
          <span>跟进人</span>
          <span>预计完成时间</span>
        </div>
      </div>
    ),
    rules: [
      '保存、取消放在页面右上，不再底部重复一套操作',
      '一行最多四个字段，同一分组内输入框宽度、高度必须统一',
      '问题描述这类长文本独占整行，允许粘贴图片并调整图片大小',
      '必填项只标识真正必填字段，非必填字段不要误加红星',
      '字段顺序按业务阅读顺序排列，基本信息和处理信息分组清晰'
    ]
  },
  {
    title: '弹窗 / 抽屉',
    description: '用于承接短流程、确认操作和侧向补充信息。弹窗适合需要中断当前操作的确认或表单，抽屉适合在不离开页面的情况下查看或编辑补充信息。',
    preview: (
      <div className="design-system-page__layout-shot is-overlay">
        <div className="design-system-page__layout-shot-mask">
          <div className="design-system-page__layout-shot-modal">
            <i className="design-system-page__layout-label">弹窗</i>
            <strong>状态变更</strong>
            <span>当前状态 / 目标状态</span>
            <span>必填表单</span>
            <footer>
              <button>取消</button>
              <button>确认</button>
            </footer>
          </div>
        </div>
        <div className="design-system-page__layout-shot-drawer">
          <i className="design-system-page__layout-label">抽屉</i>
          <span>补充详情</span>
          <span>辅助操作</span>
        </div>
      </div>
    ),
    rules: [
      '通用弹窗按钮只用取消和确认，不写成具体业务动作',
      '状态变更弹窗在列表和详情共用，字段、校验和中文文案保持一致',
      '高风险操作必须二次确认，文案说明对象和后果，不额外做夸张警示块',
      '弹窗内表单字段高度、焦点、日期选择器必须沿用输入组件规范',
      '抽屉只放补充信息或辅助操作，不替代详情页主信息展示'
    ]
  },
  {
    title: '全屏态',
    description: '用于密集表格查看和横向列较多的场景。全屏后不是换一套页面，而是在保留表格能力的前提下放大工作区，批量操作、分页、列设置必须跟随保留。',
    preview: (
      <div className="design-system-page__layout-shot is-fullscreen">
        <div className="design-system-page__layout-shot-tools">
          <i className="design-system-page__layout-label">表格设置</i>
          <span />
          <span />
          <span />
        </div>
        <div className="design-system-page__layout-shot-table">
          <i className="design-system-page__layout-label">全屏表格区</i>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="design-system-page__layout-shot-footer">
          <i className="design-system-page__layout-label">固定底部栏</i>
          <span>批量操作</span>
          <span>分页</span>
        </div>
      </div>
    ),
    rules: [
      '全屏后表格区仍然顶到底部操作区，横向滚动条不悬在页面中间',
      '满数据、部分数据、空数据三种状态下滚动条位置保持一致',
      '批量操作、已选数量、分页和每页条数选择必须完整保留',
      '表格设置入口保留在右上角，列显示、密度、全屏、重置列宽统一收纳',
      '全屏只扩大工作区，不改变列表字段、列顺序和操作逻辑'
    ]
  }
];

export function DesignSystemPage() {
  const { message, notification } = useAdminFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  const [statusFlowOpen, setStatusFlowOpen] = useState(false);
  const [statusFlowTarget, setStatusFlowTarget] = useState<WorkOrderStatus | undefined>();
  const [listTemplateMode, setListTemplateMode] = useState<'standard' | 'batch'>('standard');
  const [listTemplateFilterExpanded, setListTemplateFilterExpanded] = useState(false);
  const [listTemplateSelectedRowKeys, setListTemplateSelectedRowKeys] = useState<Key[]>([]);
  const [listTemplateSelectedRows, setListTemplateSelectedRows] = useState<WorkOrderRecord[]>([]);
  const [listTemplateCurrentPage, setListTemplateCurrentPage] = useState(1);
  const [listTemplatePageSize, setListTemplatePageSize] = useState(20);
  const [tableDrawerFilterExpanded, setTableDrawerFilterExpanded] = useState(false);
  const [tableDrawerDraftFilters, setTableDrawerDraftFilters] = useState<DrawerTableFilters>(defaultDrawerTableFilters);
  const [tableDrawerAppliedFilters, setTableDrawerAppliedFilters] = useState<DrawerTableFilters>(defaultDrawerTableFilters);
  const [tableDrawerSelectedRowKeys, setTableDrawerSelectedRowKeys] = useState<Key[]>([]);
  const [tableDrawerSelectedRows, setTableDrawerSelectedRows] = useState<DrawerTableRecord[]>([]);
  const [tableDrawerCurrentPage, setTableDrawerCurrentPage] = useState(1);
  const [tableDrawerPageSize, setTableDrawerPageSize] = useState(20);
  const [displayTablePage, setDisplayTablePage] = useState(1);
  const [displayTablePageSize, setDisplayTablePageSize] = useState(20);
  const [displayHistoryExpandedKeys, setDisplayHistoryExpandedKeys] = useState<string[]>(['h1']);
  const [richText, setRichText] = useState('<p><strong>项目说明：</strong>这里用于沉淀可复用富文本描述，支持基础格式和粘贴图片。</p>');
  const categoryParam = searchParams.get('category');
  const activeCategory: DesignCategory = isDesignCategory(categoryParam) ? categoryParam : 'overview';

  useEffect(() => {
    if (categoryParam !== null && !isDesignCategory(categoryParam)) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('category', 'overview');
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [categoryParam, searchParams, setSearchParams]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeCategory]);

  const tableDrawerFilteredRows = useMemo(() => mockWorkOrders.filter((row) => {
    const matchProblem = tableDrawerAppliedFilters.problemDesc
      ? row.problemDesc.includes(tableDrawerAppliedFilters.problemDesc)
      : true;
    const matchSubmitter = tableDrawerAppliedFilters.submitterName
      ? row.submitterName.includes(tableDrawerAppliedFilters.submitterName)
      : true;
    const matchProblemType = tableDrawerAppliedFilters.problemTypes.length > 0
      ? tableDrawerAppliedFilters.problemTypes.includes(row.problemType)
      : true;
    const matchUrgency = tableDrawerAppliedFilters.urgency !== undefined
      ? row.urgency === tableDrawerAppliedFilters.urgency
      : true;
    const matchStatus = tableDrawerAppliedFilters.status !== undefined
      ? row.status === tableDrawerAppliedFilters.status
      : true;
    const matchOverdue = tableDrawerAppliedFilters.isOverdue !== undefined
      ? row.isOverdue === tableDrawerAppliedFilters.isOverdue
      : true;
    const matchFollower = tableDrawerAppliedFilters.followerId
      ? row.followerId === tableDrawerAppliedFilters.followerId
      : true;
    const matchSubmitTime = inDateRange(row.submitTime, tableDrawerAppliedFilters.submitTimeRange);
    const matchExpectedTime = inDateRange(row.expectedResolveDate, tableDrawerAppliedFilters.expectedResolveDateRange);

    return matchProblem
      && matchSubmitter
      && matchProblemType
      && matchUrgency
      && matchStatus
      && matchOverdue
      && matchFollower
      && matchSubmitTime
      && matchExpectedTime;
  }), [tableDrawerAppliedFilters]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(tableDrawerFilteredRows.length / tableDrawerPageSize));
    if (tableDrawerCurrentPage > maxPage) {
      setTableDrawerCurrentPage(maxPage);
    }
  }, [tableDrawerCurrentPage, tableDrawerFilteredRows.length, tableDrawerPageSize]);

  const tableDrawerRows = useMemo(() => {
    const start = (tableDrawerCurrentPage - 1) * tableDrawerPageSize;
    return tableDrawerFilteredRows.slice(start, start + tableDrawerPageSize);
  }, [tableDrawerCurrentPage, tableDrawerFilteredRows, tableDrawerPageSize]);

  const listTemplateRows = useMemo(() => {
    const start = (listTemplateCurrentPage - 1) * listTemplatePageSize;
    return mockWorkOrders.slice(start, start + listTemplatePageSize);
  }, [listTemplateCurrentPage, listTemplatePageSize]);

  useEffect(() => {
    if (listTemplateMode === 'standard') {
      setListTemplateSelectedRowKeys([]);
      setListTemplateSelectedRows([]);
    }
  }, [listTemplateMode]);

  const listTemplateFilterItems = useMemo(() => [
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
  ], []);

  const { containerRef: tableDrawerContainerRef, scrollY: tableDrawerScrollY } = useDrawerTableScrollY([
    tableDrawerOpen,
    tableDrawerFilterExpanded,
    tableDrawerFilteredRows.length,
    tableDrawerCurrentPage,
    tableDrawerPageSize,
    tableDrawerRows.length
  ]);

  const tableDrawerFilterItems = useMemo(() => [
    {
      key: 'problemDesc',
      label: '问题描述',
      node: (
        <AdminInput
          size="small"
          value={tableDrawerDraftFilters.problemDesc}
          placeholder="请输入"
          onChange={(event) => setTableDrawerDraftFilters((prev) => ({ ...prev, problemDesc: event.target.value }))}
          onPressEnter={() => {
            setTableDrawerAppliedFilters(tableDrawerDraftFilters);
            setTableDrawerCurrentPage(1);
            setTableDrawerSelectedRowKeys([]);
            setTableDrawerSelectedRows([]);
          }}
        />
      )
    },
    {
      key: 'problemType',
      label: '问题类型',
      node: (
        <AdminSelect
          size="small"
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.problemTypes}
          options={problemTypeOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, problemTypes: value }))}
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
          value={tableDrawerDraftFilters.urgency}
          options={urgencyOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, urgency: value }))}
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
          value={tableDrawerDraftFilters.status}
          options={statusOptions}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, status: value }))}
        />
      )
    },
    {
      key: 'isOverdue',
      label: '逾期',
      node: (
        <AdminSelect
          size="small"
          allowClear
          optionFilterProp="label"
          value={tableDrawerDraftFilters.isOverdue}
          options={[
            { label: '未逾期', value: false },
            { label: '逾期', value: true }
          ]}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, isOverdue: value }))}
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
          value={tableDrawerDraftFilters.followerId}
          options={workOrderUsers}
          placeholder="全部"
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, followerId: value }))}
        />
      )
    },
    {
      key: 'submitterName',
      label: '提出人',
      node: (
        <AdminInput
          size="small"
          value={tableDrawerDraftFilters.submitterName}
          placeholder="请输入"
          onChange={(event) => setTableDrawerDraftFilters((prev) => ({ ...prev, submitterName: event.target.value }))}
          onPressEnter={() => {
            setTableDrawerAppliedFilters(tableDrawerDraftFilters);
            setTableDrawerCurrentPage(1);
            setTableDrawerSelectedRowKeys([]);
            setTableDrawerSelectedRows([]);
          }}
        />
      )
    },
    {
      key: 'submitTimeRange',
      label: '提出时间',
      wide: true,
      node: (
        <AdminRangePicker
          size="small"
          value={tableDrawerDraftFilters.submitTimeRange as never}
          placeholder={['开始日期', '结束日期']}
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, submitTimeRange: value || [] }))}
        />
      )
    },
    {
      key: 'expectedResolveDateRange',
      label: '预计完成时间',
      wide: true,
      node: (
        <AdminRangePicker
          size="small"
          value={tableDrawerDraftFilters.expectedResolveDateRange as never}
          placeholder={['开始日期', '结束日期']}
          onChange={(value) => setTableDrawerDraftFilters((prev) => ({ ...prev, expectedResolveDateRange: value || [] }))}
        />
      )
    }
  ], [tableDrawerDraftFilters]);

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

  const listTemplateFilter = (
    <CompactFilterBar
      items={listTemplateFilterItems}
      expanded={listTemplateFilterExpanded}
      visibleCount={4}
      onExpandChange={setListTemplateFilterExpanded}
      onReset={() => {
        setListTemplateCurrentPage(1);
        setListTemplateSelectedRowKeys([]);
        setListTemplateSelectedRows([]);
      }}
      onSearch={() => {
        setListTemplateCurrentPage(1);
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
    tableAlertRender: false as const
  };
  const listTemplateScrollYDeps = [
    listTemplateMode,
    listTemplateFilterExpanded,
    listTemplateRows.length,
    listTemplateCurrentPage,
    listTemplatePageSize,
    listTemplateSelectedRowKeys.length
  ];
  const listTemplatePagination = {
    current: listTemplateCurrentPage,
    pageSize: listTemplatePageSize,
    total: mockWorkOrders.length,
    onChange: (page: number, pageSize: number) => {
      setListTemplateCurrentPage(page);
      setListTemplatePageSize(pageSize);
    },
    onShowSizeChange: (_: number, pageSize: number) => {
      setListTemplateCurrentPage(1);
      setListTemplatePageSize(pageSize);
      setListTemplateSelectedRowKeys([]);
      setListTemplateSelectedRows([]);
    }
  };

  const listPageTemplateDemo = (
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
              { label: '批量列表', value: 'batch' }
            ]}
            onChange={(value) => setListTemplateMode(value as 'standard' | 'batch')}
          />
        </div>
        <div className="design-system-page__template-mode-list">
          <span>普通列表：用户、角色，不传选择列和批量操作</span>
          <span>批量列表：运维工单，使用 mode=&quot;batch&quot; 和 batch.actions</span>
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
            scrollYDeps={listTemplateScrollYDeps}
            batch={{
              selectedCount: listTemplateSelectedRows.length,
              actions: (
                <>
                  <AdminButton size="small" disabled={listTemplateSelectedRows.length === 0}>批量指派</AdminButton>
                  <AdminButton size="small" disabled={listTemplateSelectedRows.length === 0}>批量状态变更</AdminButton>
                  <AdminButton size="small" disabled={listTemplateSelectedRows.length === 0}>批量删除</AdminButton>
                </>
              )
            }}
            pagination={listTemplatePagination}
          />
        ) : (
          <TemplateListPage<WorkOrderRecord>
            mode="standard"
            title="列表模板：运维工单"
            actions={<AdminButton type="primary">新增工单</AdminButton>}
            filter={listTemplateFilter}
            table={listTemplateTableBase}
            scrollYDeps={listTemplateScrollYDeps}
            pagination={listTemplatePagination}
          />
        )}
      </div>
    </div>
  );

  const renderLayoutTemplateDemo = (title: string) => {
    if (title === '列表页') return listPageTemplateDemo;
    if (title === '新增 / 编辑页') return <FormTemplateDemo />;
    if (title === '详情页') return <DetailTemplateDemo />;
    return null;
  };

  return (
    <div className="design-system-page">
      <PageShell
        title="组件工作台"
        compact
      >
        <div ref={contentRef} className="design-system-page__content">
          {activeCategory === 'overview' ? (
            <div className="design-system-page__section design-system-page__overview-section">
              <OverviewSection />
            </div>
          ) : null}

          {activeCategory === 'foundation' ? (
            <div className="design-system-page__section">
              <FoundationSection />
            </div>
          ) : null}

          {activeCategory === 'base' ? (
            <div className="design-system-page__section">
              <BaseSection />
            </div>
          ) : null}

          {activeCategory === 'input' ? (
            <div className="design-system-page__section">
              <InputSection richText={richText} setRichText={setRichText} />
            </div>
          ) : null}

          {activeCategory === 'layout' ? (
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
                      <ul>
                        {pattern.rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                    {pattern.preview}
                    {renderLayoutTemplateDemo(pattern.title)}
                  </section>
                ))}
              </div>
            </AdminCard>

            </div>
          ) : null}

          {activeCategory === 'display' ? (
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
                          <AdminButton size="small" disabled>批量删除</AdminButton>
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
                    <p>用于单条记录字段阅读。字段名完整，字段值对齐，普通文本字段不使用标签样式。</p>
                  </div>
                  <DetailMetaList
                    columns={4}
                    items={[
                      { label: '问题描述', value: '生产环境登录偶发超时，需要排查认证链路和网关日志', wide: true },
                      { label: '工单编号', value: 'RQ-20260630-001' },
                      { label: '所属系统', value: '生产环境登录系统' },
                      { label: '问题类型', value: '日常操作' },
                      { label: '跟进人', value: '管理员' },
                      { label: '提出人', value: '张三' },
                      { label: '提出组织', value: '运维部' },
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
                    <ComponentEntry name="AdminTag / AdminBadge / AdminAvatar" />
                    <p>用于分类、数量和人员提示，不替代流程状态、紧急程度和逾期标签。</p>
                  </div>
                  <AdminSpace direction="vertical" size={12}>
                    <AdminSpace wrap>
                      <AdminTag color="blue">系统优化</AdminTag>
                      <AdminTag color="cyan">后台维护</AdminTag>
                      <AdminTag>日常操作</AdminTag>
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
                      <AdminAvatar style={{ backgroundColor: '#f59e0b' }}>赵</AdminAvatar>
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
                    <p>用于记录数据产生、流转和变更过程，必须包含动作、人员和时间。</p>
                  </div>
                  <HistoryTimeline
                    items={mockWorkOrderHistory}
                    expandedKeys={displayHistoryExpandedKeys}
                    onExpandedKeysChange={setDisplayHistoryExpandedKeys}
                  />
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
          ) : null}

          {activeCategory === 'feedback' ? (
            <div className="design-system-page__section design-system-page__feedback">
            <AdminCard title="反馈组件">
              <div className="design-system-page__base-rule-grid">
                {feedbackSpecs.map((item) => (
                  <section className="design-system-page__base-rule-card" key={item.label}>
                    <h3>{item.label}</h3>
                    <p>{item.value}</p>
                  </section>
                ))}
              </div>
            </AdminCard>

            <AdminCard title="1. 轻提示与横幅">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>轻提示</h3>
                    <ComponentEntry name="useAdminFeedback().message" />
                    <p>用于保存、删除、复制等即时反馈。短句中文、自动消失，不承载复杂说明。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>普通提示</h4>
                      <AdminButton onClick={() => message.info('数据已刷新')}>显示提示</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>成功提示</h4>
                      <AdminButton
                        className="design-system-page__feedback-button--success"
                        onClick={() => message.success('保存成功')}
                      >
                        显示成功
                      </AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>警告提示</h4>
                      <AdminButton
                        className="design-system-page__feedback-button--warning"
                        onClick={() => message.warning('请先选择处理人')}
                      >
                        显示警告
                      </AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>失败提示</h4>
                      <AdminButton danger onClick={() => message.error('保存失败，请检查必填字段')}>显示失败</AdminButton>
                    </div>
                  </div>
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>通知横幅</h3>
                    <ComponentEntry name="AdminAlert" />
                    <p>用于页面内持续可见的状态提示。靠近相关区域，不替代弹窗确认。</p>
                  </div>
                  <div className="design-system-page__input-stack">
                    <AdminAlert type="info" message="已同步最新数据" showIcon />
                    <AdminAlert type="success" message="保存成功，变更已同步" showIcon />
                    <AdminAlert type="warning" message="当前筛选条件较多，查询可能耗时较长" showIcon />
                    <AdminAlert type="error" message="保存失败，请检查必填字段" showIcon />
                  </div>
                </section>
              </div>
            </AdminCard>

            <AdminCard title="2. 通知提醒">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>通知提醒</h3>
                    <ComponentEntry name="useAdminFeedback().notification" />
                    <p>用于跨区域提醒或后台任务结果。标题说明事件，正文说明原因和下一步。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>任务完成</h4>
                      <AdminButton
                        className="design-system-page__feedback-button--success"
                        onClick={() => notification.success({ message: '导出完成', description: '工单明细已生成，可以在下载中心查看。' })}
                      >
                        显示通知
                      </AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>风险提醒</h4>
                      <AdminButton
                        className="design-system-page__feedback-button--warning"
                        onClick={() => notification.warning({ message: '存在逾期工单', description: '当前筛选结果中有 3 条工单已逾期，请优先处理。' })}
                      >
                        显示提醒
                      </AdminButton>
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>

            <AdminCard title="3. 气泡确认框">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>普通确认</h3>
                    <ComponentEntry name="BubbleConfirmAction" />
                    <p>用于轻量二次确认，跟随触发按钮出现，不打断整个页面。</p>
                  </div>
                  <div className="design-system-page__input-demo-list design-system-page__confirm-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>继续操作</h4>
                      <BubbleConfirmAction
                        title="确认继续提交？"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('提交确认已触发');
                        }}
                      >
                        提交确认
                      </BubbleConfirmAction>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>轻量撤销</h4>
                      <BubbleConfirmAction
                        title="确认撤销当前操作？"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('撤销确认已触发');
                        }}
                      >
                        撤销确认
                      </BubbleConfirmAction>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>删除气泡</h4>
                      <BubbleConfirmAction
                        danger
                        title="确认删除该记录？"
                        description="删除后无法恢复，适合低复杂度的单条记录删除。"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('删除气泡确认已触发');
                        }}
                      >
                        删除气泡确认
                      </BubbleConfirmAction>
                    </div>
                  </div>
                </section>

                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>弹窗确认</h3>
                    <ComponentEntry name="StatusConfirmAction / DeleteConfirmAction" />
                    <p>用于启用、停用、删除等需要明确确认的操作。</p>
                  </div>
                  <div className="design-system-page__input-demo-list design-system-page__confirm-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>启用记录</h4>
                      <StatusConfirmAction
                        action="enable"
                        entityName="记录"
                        targetName="客户资料"
                        type="primary"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('启用确认已提交');
                        }}
                      >
                        启用确认
                      </StatusConfirmAction>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>停用记录</h4>
                      <StatusConfirmAction
                        action="disable"
                        entityName="记录"
                        targetName="客户资料"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('停用确认已提交');
                        }}
                      >
                        停用确认
                      </StatusConfirmAction>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>删除记录</h4>
                      <DeleteConfirmAction
                        entityName="记录"
                        targetName="客户资料"
                        successMessage={false}
                        onConfirm={() => {
                          message.success('删除确认已提交');
                        }}
                      >
                        删除弹窗确认
                      </DeleteConfirmAction>
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>

            <AdminCard title="4. 进度反馈">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>进度反馈</h3>
                    <ComponentEntry name="AdminProgress" />
                    <p>用于导入、导出、批量处理等可量化任务。能给进度就不要只给加载中。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>线性进度</h4>
                      <AdminProgress percent={68} />
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>小型进度</h4>
                      <AdminProgress percent={42} size="small" status="active" />
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>步骤进度</h4>
                      <AdminProgress percent={100} steps={5} size="small" />
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>异常进度</h4>
                      <AdminProgress percent={36} status="exception" />
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>

            <AdminCard title="5. 加载状态">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>加载状态</h3>
                    <ComponentEntry name="AdminSpin / AdminButton / AdminCard" />
                    <p>用于局部等待和按钮提交。局部操作只加载局部，不让整页失去控制。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>局部加载</h4>
                      <AdminSpin tip="加载中">
                        <div className="design-system-page__spin-box" />
                      </AdminSpin>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>按钮加载</h4>
                      <AdminButton type="primary" loading>提交中</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>文字按钮加载</h4>
                      <AdminTextAction loading>刷新中</AdminTextAction>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>卡片加载</h4>
                      <AdminCard size="small" loading title="工单统计" />
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>

            <AdminCard title="6. 弹窗与抽屉">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>弹窗与抽屉</h3>
                    <ComponentEntry name="AdminModal / AdminDrawer / StatusFlowModal" />
                    <p>弹窗用于短流程，抽屉用于侧向补充。通用按钮统一使用取消和确认。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>普通弹窗</h4>
                      <AdminButton onClick={() => setModalOpen(true)}>打开弹窗</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>状态流转弹窗</h4>
                      <AdminButton
                        onClick={() => {
                          setStatusFlowTarget(undefined);
                          setStatusFlowOpen(true);
                        }}
                      >
                        打开状态流转
                      </AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>侧向抽屉</h4>
                      <AdminButton onClick={() => setDrawerOpen(true)}>打开抽屉</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>表单抽屉</h4>
                      <AdminButton onClick={() => setFormDrawerOpen(true)}>打开表单抽屉</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>表格抽屉</h4>
                      <AdminButton onClick={() => setTableDrawerOpen(true)}>打开表格抽屉</AdminButton>
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>
            </div>
          ) : null}

        </div>
      </PageShell>

      <StatusFlowModal<WorkOrderStatus>
        open={statusFlowOpen}
        currentValue={renderWorkOrderStatus(0)}
        targetValue={statusFlowTarget}
        targetText={statusFlowTarget !== undefined ? renderWorkOrderStatus(statusFlowTarget) : undefined}
        targetOptions={statusOptions.filter((item) => item.value !== 0)}
        onTargetChange={setStatusFlowTarget}
        onCancel={() => {
          setStatusFlowOpen(false);
          setStatusFlowTarget(undefined);
        }}
        onConfirm={() => {
          message.success('状态已变更');
          setStatusFlowOpen(false);
          setStatusFlowTarget(undefined);
        }}
        renderExtra={(target) => (
          target === 2 ? (
            <>
              <AdminFormItem
                name="resolveDate"
                label="实际修复时间"
                rules={[{ required: true, message: '请选择实际修复时间' }]}
              >
                <AdminDatePicker
                  placeholder="请选择实际修复时间"
                />
              </AdminFormItem>
              <AdminFormItem
                name="resultDesc"
                label="处理结果"
                rules={[{ required: true, message: '请输入处理结果' }]}
              >
                <AdminTextArea rows={3} placeholder="请输入处理结果" />
              </AdminFormItem>
            </>
          ) : null
        )}
      />

      <AdminModal
        title="演示弹窗"
        open={modalOpen}
        width={560}
        onCancel={() => setModalOpen(false)}
        onOk={() => setModalOpen(false)}
      >
        <AdminParagraph>
          弹窗用于短流程确认和少量字段录入，内容要聚焦，不承载复杂列表。
        </AdminParagraph>
        <div className="design-system-page__modal-form">
          <label>
            <span>工单标题</span>
            <AdminInput placeholder="请输入工单标题" />
          </label>
          <label>
            <span>问题类型</span>
            <AdminSelect
              placeholder="请选择问题类型"
              options={[
                { label: '日常操作', value: 'daily' },
                { label: '系统优化', value: 'optimize' },
                { label: '故障报障', value: 'fault' }
              ]}
            />
          </label>
          <label>
            <span>紧急程度</span>
            <AdminSelect
              placeholder="请选择紧急程度"
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' }
              ]}
            />
          </label>
          <label>
            <span>跟进人</span>
            <AdminSelect
              placeholder="请选择跟进人"
              options={[
                { label: 'A001·管理员', value: 'admin' },
                { label: 'A002·运维人员', value: 'ops' },
                { label: 'A003·审核人员', value: 'reviewer' }
              ]}
            />
          </label>
          <label className="design-system-page__modal-form-full">
            <span>备注说明</span>
            <AdminTextArea rows={3} placeholder="请输入备注说明" />
          </label>
        </div>
      </AdminModal>

      <AdminDrawer
        title="演示抽屉"
        width={420}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="design-system-page__drawer-footer">
            <AdminButton onClick={() => setDrawerOpen(false)}>取消</AdminButton>
            <AdminButton type="primary" onClick={() => setDrawerOpen(false)}>确认</AdminButton>
          </div>
        }
      >
        <AdminParagraph>
          抽屉用于中等复杂度的表单和上下文操作。
        </AdminParagraph>
        <AdminTextArea rows={4} placeholder="抽屉输入区" />
      </AdminDrawer>

      <AdminDrawer
        title="表单抽屉"
        width={720}
        open={formDrawerOpen}
        onClose={() => setFormDrawerOpen(false)}
        footer={
          <div className="design-system-page__drawer-footer">
            <AdminButton onClick={() => setFormDrawerOpen(false)}>取消</AdminButton>
            <AdminButton type="primary" onClick={() => setFormDrawerOpen(false)}>确认</AdminButton>
          </div>
        }
      >
        <AdminParagraph>
          表单抽屉用于承载较完整的上下文数据，适合不离开当前列表的新增、编辑和补充信息。
        </AdminParagraph>
        <div className="design-system-page__drawer-form">
          <label>
            <span>工单标题</span>
            <AdminInput placeholder="请输入工单标题" />
          </label>
          <label>
            <span>问题类型</span>
            <AdminSelect
              placeholder="请选择问题类型"
              options={[
                { label: '日常操作', value: 'daily' },
                { label: '系统优化', value: 'optimize' },
                { label: '故障报障', value: 'fault' }
              ]}
            />
          </label>
          <label>
            <span>紧急程度</span>
            <AdminSelect
              placeholder="请选择紧急程度"
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' }
              ]}
            />
          </label>
          <label>
            <span>跟进人</span>
            <AdminSelect
              placeholder="请选择跟进人"
              options={[
                { label: 'A001·管理员', value: 'admin' },
                { label: 'A002·运维人员', value: 'ops' },
                { label: 'A003·审核人员', value: 'reviewer' }
              ]}
            />
          </label>
          <label className="design-system-page__drawer-form-full">
            <span>问题描述</span>
            <AdminTextArea rows={5} placeholder="请输入问题描述" />
          </label>
          <label className="design-system-page__drawer-form-full">
            <span>处理备注</span>
            <AdminTextArea rows={4} placeholder="请输入处理备注" />
          </label>
        </div>
      </AdminDrawer>

      <AdminDrawer
        title="表格抽屉"
        width="calc(100vw - 180px)"
        open={tableDrawerOpen}
        rootClassName="design-system-page__table-drawer-root"
        className="design-system-page__table-drawer"
        onClose={() => setTableDrawerOpen(false)}
      >
        <AdminParagraph>
          表格抽屉用于在不离开当前页面的情况下查看关联数据，必须包含查询、表格、页码和操作。
        </AdminParagraph>
        <div ref={tableDrawerContainerRef} className="design-system-page__drawer-table">
          <CompactFilterBar
            items={tableDrawerFilterItems}
            expanded={tableDrawerFilterExpanded}
            visibleCount={4}
            onExpandChange={setTableDrawerFilterExpanded}
            onSearch={() => {
              setTableDrawerAppliedFilters(tableDrawerDraftFilters);
              setTableDrawerCurrentPage(1);
              setTableDrawerSelectedRowKeys([]);
              setTableDrawerSelectedRows([]);
            }}
            onReset={() => {
              setTableDrawerDraftFilters(defaultDrawerTableFilters);
              setTableDrawerAppliedFilters(defaultDrawerTableFilters);
              setTableDrawerCurrentPage(1);
              setTableDrawerSelectedRowKeys([]);
              setTableDrawerSelectedRows([]);
            }}
          />

          <div className="design-system-page__drawer-table-body">
            <SearchTable<DrawerTableRecord>
              className="design-system-page__drawer-search-table"
              columns={drawerTableColumns}
              dataSource={tableDrawerRows}
              options={false}
              pagination={false}
              rowSelection={{
                selectedRowKeys: tableDrawerSelectedRowKeys,
                onChange: (keys, rows) => {
                  setTableDrawerSelectedRowKeys(keys);
                  setTableDrawerSelectedRows(rows);
                }
              }}
              search={false}
              scroll={{ x: 1600, y: tableDrawerScrollY }}
              tableAlertRender={false}
            />
          </div>

          <TableFooterBar
            selectedCount={tableDrawerSelectedRowKeys.length}
            actions={(
              <AdminSpace size={8}>
                <AdminButton size="small">批量指派</AdminButton>
                <AdminButton size="small" disabled={tableDrawerSelectedRows.length === 0}>批量状态变更</AdminButton>
                <ConfirmAction
                  danger
                  size="small"
                  disabled={tableDrawerSelectedRows.length === 0}
                  title="确认批量删除"
                  description={`删除后选中的 ${tableDrawerSelectedRows.length} 项工单将无法恢复，确认删除？`}
                  successMessage={`已删除 ${tableDrawerSelectedRows.length} 项工单`}
                  onConfirm={() => {
                    setTableDrawerSelectedRowKeys([]);
                    setTableDrawerSelectedRows([]);
                  }}
                >
                  批量删除
                </ConfirmAction>
              </AdminSpace>
            )}
            extra={(
              <TablePagination
                current={tableDrawerCurrentPage}
                pageSize={tableDrawerPageSize}
                getPopupContainer={() => document.body}
                total={tableDrawerFilteredRows.length}
                onChange={(page, pageSize) => {
                  setTableDrawerCurrentPage(page);
                  setTableDrawerPageSize(pageSize);
                  setTableDrawerSelectedRowKeys([]);
                  setTableDrawerSelectedRows([]);
                }}
                onShowSizeChange={(_, pageSize) => {
                  setTableDrawerCurrentPage(1);
                  setTableDrawerPageSize(pageSize);
                  setTableDrawerSelectedRowKeys([]);
                  setTableDrawerSelectedRows([]);
                }}
              />
            )}
          />
        </div>
      </AdminDrawer>
    </div>
  );
}

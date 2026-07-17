import type { ReactNode } from 'react';

export type LayoutPattern = {
  title: string;
  description: string;
  preview: ReactNode;
  rules: string[];
};

export const layoutPatterns: LayoutPattern[] = [
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

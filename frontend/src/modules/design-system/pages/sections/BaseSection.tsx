import { ReactNode } from 'react';
import {
  BellOutlined,
  ColumnHeightOutlined,
  FullscreenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  TableOutlined,
  UserOutlined
} from '@ant-design/icons';
import { ComponentEntry } from '../components/ComponentEntry';
import {
  ActionBar,
  AdminButton,
  AdminCard,
  AdminDeleteIconAction,
  AdminEditIconAction,
  AdminIconAction,
  AdminSpace,
  AdminTextAction,
  AdminToggleStatusIconAction,
  ExpandToggleButton,
  OverdueTag,
  PriorityTag,
  StatusTag
} from '../../../../components/admin';

type SpecItem = {
  label: string;
  value: ReactNode;
};

const baseComponentSpecs: SpecItem[] = [
  { label: '按钮', value: '主按钮只放页面主动作，危险操作必须二次确认' },
  { label: '文字操作', value: '用于表格行操作和轻量命令，不承载高风险动作' },
  { label: '业务状态标签', value: '状态、优先级、逾期分开设计，不混用样式' },
  { label: '图标按钮', value: '适合工具操作，必须有清晰悬浮说明' }
];

export function BaseSection() {
  return (
    <div className="design-system-page__base">
      <AdminCard title="基础组件规范">
        <div className="design-system-page__base-rule-grid">
          {baseComponentSpecs.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="基础组件">
        <div className="design-system-page__base-grid">
          <section className="design-system-page__base-panel is-wide">
            <div className="design-system-page__base-panel-head">
              <h3>按钮</h3>
              <p>按视觉层级区分主次、边框、无背景、危险和加载状态，避免页面动作层级混乱。</p>
            </div>
            <div className="design-system-page__button-demo-grid">
              <div className="design-system-page__button-demo">
                <h4>实心按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton type="primary" icon={<PlusOutlined />}>新增</AdminButton>
                  <AdminButton type="primary">保存</AdminButton>
                </ActionBar>
              </div>
              <div className="design-system-page__button-demo">
                <h4>边框按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton>重置</AdminButton>
                  <AdminButton>返回</AdminButton>
                </ActionBar>
              </div>
              <div className="design-system-page__button-demo">
                <h4>无背景按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton type="text">展开</AdminButton>
                  <AdminButton type="text" icon={<ReloadOutlined />}>刷新</AdminButton>
                </ActionBar>
              </div>
              <div className="design-system-page__button-demo">
                <h4>危险按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton danger>批量删除</AdminButton>
                  <AdminButton type="primary" danger>确认删除</AdminButton>
                </ActionBar>
              </div>
              <div className="design-system-page__button-demo">
                <h4>禁用按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton disabled>不可操作</AdminButton>
                  <AdminButton type="primary" disabled>无权限</AdminButton>
                </ActionBar>
              </div>
              <div className="design-system-page__button-demo">
                <h4>加载按钮</h4>
                <ComponentEntry name="AdminButton" />
                <ActionBar>
                  <AdminButton loading>处理中</AdminButton>
                  <AdminButton type="primary" loading>提交中</AdminButton>
                </ActionBar>
              </div>
            </div>
          </section>

          <section className="design-system-page__base-panel is-wide">
            <div className="design-system-page__base-panel-head">
              <h3>文字操作</h3>
              <p>用于表格行操作、详情跳转和轻量命令，视觉风格需贴近列表操作列。</p>
            </div>
            <div className="design-system-page__text-action-demo">
              <div className="design-system-page__button-demo">
                <h4>普通操作</h4>
                <ComponentEntry name="AdminTextAction" />
                <AdminSpace size={10}>
                  <AdminTextAction>查看</AdminTextAction>
                  <AdminTextAction>编辑</AdminTextAction>
                  <AdminTextAction>状态变更</AdminTextAction>
                  <AdminTextAction>更多</AdminTextAction>
                </AdminSpace>
              </div>
              <div className="design-system-page__button-demo">
                <h4>危险操作</h4>
                <ComponentEntry name="AdminTextAction" />
                <AdminSpace size={10}>
                  <AdminTextAction danger>删除</AdminTextAction>
                  <AdminTextAction danger>移除权限</AdminTextAction>
                </AdminSpace>
              </div>
            </div>
          </section>

          <section className="design-system-page__base-panel is-wide">
            <div className="design-system-page__base-panel-head">
              <h3>业务状态标签</h3>
              <p>状态、紧急程度、逾期是三套语义，颜色和样式必须能区分。</p>
            </div>
            <div className="design-system-page__status-demo">
              <div className="design-system-page__button-demo">
                <h4>流程状态</h4>
                <ComponentEntry name="StatusTag" />
                <AdminSpace wrap size={[8, 8]}>
                  <StatusTag status="pending" />
                  <StatusTag status="processing" />
                  <StatusTag status="success" text="已完成" />
                  <StatusTag status="disabled" text="已关闭" />
                </AdminSpace>
              </div>
              <div className="design-system-page__button-demo">
                <h4>系统状态</h4>
                <ComponentEntry name="StatusTag" />
                <AdminSpace wrap size={[8, 8]}>
                  <StatusTag status="enabled" />
                  <StatusTag status="disabled" />
                  <StatusTag status="error" />
                </AdminSpace>
              </div>
              <div className="design-system-page__button-demo">
                <h4>紧急程度</h4>
                <ComponentEntry name="PriorityTag" />
                <AdminSpace wrap size={[8, 8]}>
                  <PriorityTag level="critical" />
                  <PriorityTag level="high" />
                  <PriorityTag level="medium" />
                  <PriorityTag level="low" />
                </AdminSpace>
              </div>
              <div className="design-system-page__button-demo">
                <h4>逾期状态</h4>
                <ComponentEntry name="OverdueTag" />
                <AdminSpace wrap size={[8, 8]}>
                  <OverdueTag />
                  <OverdueTag overdueDays={3} />
                </AdminSpace>
              </div>
            </div>
          </section>

          <section className="design-system-page__base-panel is-wide">
            <div className="design-system-page__base-panel-head">
              <h3>图标按钮</h3>
              <p>适合刷新、设置、搜索、全屏等工具型操作；只展示图标时必须有悬浮提示。</p>
            </div>
            <ComponentEntry name="AdminIconAction / ExpandToggleButton / AdminEditIconAction / AdminToggleStatusIconAction / AdminDeleteIconAction" />
            <AdminSpace wrap size={8}>
              <AdminIconAction label="刷新" icon={<ReloadOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="查询" icon={<SearchOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="设置" icon={<SettingOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="密度" icon={<ColumnHeightOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="列设置" icon={<TableOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="全屏" icon={<FullscreenOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="消息" icon={<BellOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="用户" icon={<UserOutlined />} onClick={(event) => event.preventDefault()} />
              <AdminIconAction label="暂无权限" disabled icon={<SettingOutlined />} />
              <AdminIconAction label="加载中" loading />
              <ExpandToggleButton expanded={false} onClick={(event) => event.preventDefault()} />
              <ExpandToggleButton expanded onClick={(event) => event.preventDefault()} />
              <AdminEditIconAction onClick={(event) => event.preventDefault()} />
              <AdminToggleStatusIconAction
                active
                preview
                targetName="示例数据"
                onConfirm={() => undefined}
                successMessage={false}
              />
              <AdminToggleStatusIconAction
                active={false}
                preview
                targetName="示例数据"
                onConfirm={() => undefined}
                successMessage={false}
              />
              <AdminDeleteIconAction
                entityName="示例数据"
                preview
                targetName="示例数据"
                onConfirm={() => undefined}
                successMessage={false}
              />
            </AdminSpace>
          </section>

        </div>
      </AdminCard>
    </div>
  );
}

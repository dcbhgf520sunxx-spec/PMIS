import {
  AdminButton,
  AdminSpace,
  DetailMetaList,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

export function DetailTemplateDemo() {
  return (
    <div className="design-system-page__layout-pattern-template">
      <div className="design-system-page__input-panel-head">
        <h3>TemplateDetailPage</h3>
        <ComponentEntry name="TemplateDetailPage / TemplateDetailSection / DetailMetaList" />
        <p>详情页统一从这个入口接入。左侧只放业务信息分组，状态和单据信息固定进入右侧区，避免每个页面自己决定位置。</p>
      </div>
      <div className="design-system-page__template-demo is-detail">
        <TemplateDetailPage
          title="详情模板：用户详情"
          titleExtra={<StatusTag status="enabled" />}
          actions={(
            <AdminSpace size={8}>
              <AdminButton>返回</AdminButton>
              <AdminButton type="primary">编辑</AdminButton>
            </AdminSpace>
          )}
          statusSection={{
            items: [
              { label: '状态', value: <StatusTag status="enabled" />, wide: true },
              { label: '最近登录', value: '2026-07-04 09:30', wide: true }
            ]
          }}
          documentSection={{
            items: [
              { label: '创建人', value: '系统管理员' },
              { label: '创建时间', value: '2026-06-30 10:12', wide: true },
              { label: '更新人', value: '业务管理员' },
              { label: '更新时间', value: '2026-07-04 09:00', wide: true }
            ]
          }}
        >
          <TemplateDetailSection title="基本信息">
            <DetailMetaList
              items={[
                { label: '工号', value: '10086' },
                { label: '姓名', value: '张三' },
                { label: '手机号', value: '13800000000' },
                { label: '所属角色', value: '系统管理员 / 业务管理员' }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="权限范围">
            <DetailMetaList
              items={[
                { label: '管理范围', value: '用户、角色、运维工单', wide: true },
                { label: '数据权限', value: '本部门及下级部门' },
                { label: '账号来源', value: 'HR 同步' }
              ]}
            />
          </TemplateDetailSection>
        </TemplateDetailPage>
      </div>
    </div>
  );
}

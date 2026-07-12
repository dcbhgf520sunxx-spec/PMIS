import { useState } from 'react';
import {
  AdminButton,
  AdminSegmented,
  DetailNeighborNav,
  DetailMetaList,
  HistoryTimeline,
  StatusTag,
  TemplateDetailPage,
  TemplateDetailSection
} from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

export function DetailTemplateDemo() {
  const [demoState, setDemoState] = useState<'normal' | 'loading' | 'error' | 'notFound'>('normal');

  return (
    <div className="design-system-page__layout-pattern-template">
      <div className="design-system-page__input-panel-head">
        <h3>TemplateDetailPage</h3>
        <ComponentEntry name="TemplateDetailPage / DetailNeighborNav / TemplateDetailSection / DetailMetaList" />
        <p>详情页统一从这个入口接入。标题标签、上一条/下一条、记录操作和状态操作分别由模板固定位置。</p>
        <div className="design-system-page__template-mode-switch">
          <AdminSegmented
            size="small"
            value={demoState}
            options={[
              { label: '正常', value: 'normal' },
              { label: '加载中', value: 'loading' },
              { label: '加载失败', value: 'error' },
              { label: '记录不存在', value: 'notFound' }
            ]}
            onChange={(value) => setDemoState(value as typeof demoState)}
          />
        </div>
      </div>
      <div className="design-system-page__template-demo is-detail">
        <TemplateDetailPage
          title="详情模板：用户详情"
          loading={demoState === 'loading'}
          error={demoState === 'error' ? '详情数据加载失败，请稍后重试' : undefined}
          notFound={demoState === 'notFound'}
          onRetry={() => setDemoState('normal')}
          onBack={() => {}}
          titleTags={<StatusTag status="enabled" />}
          titleCenter={(
            <DetailNeighborNav
              placement="title"
              prevId="10085"
              nextId="10087"
              ordinal={8}
              total={24}
              onNavigate={() => {}}
            />
          )}
          actions={<AdminButton type="primary">编辑</AdminButton>}
          sectionNavigation
          statusSection={{
            items: [
              { label: '状态', value: <StatusTag status="enabled" />, wide: true },
              { label: '最近登录', value: '2026-07-04 09:30', wide: true }
            ]
          }}
          statusAction={<AdminButton block type="primary">状态变更</AdminButton>}
          documentSection={{
            items: [
              { label: '创建人', value: '系统管理员' },
              { label: '创建时间', value: '2026-06-30 10:12', wide: true },
              { label: '更新人', value: '业务管理员' },
              { label: '更新时间', value: '2026-07-04 09:00', wide: true }
            ]
          }}
        >
          <TemplateDetailSection title="基本信息" sectionKey="basic">
            <DetailMetaList
              items={[
                { label: '工号', value: '10086' },
                { label: '姓名', value: '张三' },
                { label: '手机号', value: '13800000000' },
                { label: '所属角色', value: '系统管理员 / 业务管理员' }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="权限范围" sectionKey="permissions">
            <DetailMetaList
              items={[
                { label: '管理范围', value: '用户、角色、运维工单', wide: true },
                { label: '数据权限', value: '本部门及下级部门' },
                { label: '账号来源', value: 'HR 同步' }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="负责区域" sectionKey="regions">
            <DetailMetaList
              items={[
                { label: '总部园区', value: '综合楼、研发楼、数据中心' },
                { label: '华东区域', value: '上海、杭州、南京' },
                { label: '授权边界', value: '仅查看已授权区域数据', wide: true }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="所属组织" sectionKey="organization">
            <DetailMetaList
              items={[
                { label: '一级部门', value: '数字化中心' },
                { label: '二级部门', value: '平台产品部' },
                { label: '直属主管', value: '李经理' },
                { label: '协作团队', value: '研发一组、运维组' }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="安全设置" sectionKey="security">
            <DetailMetaList
              items={[
                { label: '双因素认证', value: '已开启' },
                { label: '登录限制', value: '仅企业网络' },
                { label: '密码更新时间', value: '2026-06-18 14:20', wide: true }
              ]}
            />
          </TemplateDetailSection>
          <TemplateDetailSection title="变更历史" sectionKey="history">
            <HistoryTimeline
              items={[
                { id: 'history-1', operator: '业务管理员', action: '更新负责区域', time: '2026-07-12 09:30', changes: [{ field: '负责区域', before: '总部园区', after: '总部园区、华东区域' }] },
                { id: 'history-2', operator: '系统管理员', action: '调整角色权限', time: '2026-07-10 16:45', changes: [{ field: '所属角色', before: '业务管理员', after: '系统管理员 / 业务管理员' }] },
                { id: 'history-3', operator: '张三', action: '完成安全验证', time: '2026-07-08 11:20' }
              ]}
            />
          </TemplateDetailSection>
        </TemplateDetailPage>
      </div>
    </div>
  );
}

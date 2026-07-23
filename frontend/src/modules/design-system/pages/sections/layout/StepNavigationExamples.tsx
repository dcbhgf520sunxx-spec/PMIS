import { useState } from 'react';
import { AdminCard, AdminStepNavigation } from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

const steps = [
  { title: '上传材料', description: '选择并确认材料' },
  { title: '确认范围', description: '确认审核口径' },
  { title: '执行审核', description: '等待任务完成' },
  { title: '查看报告', description: '核对结果并导出' }
];

export function StepNavigationExamples() {
  const [current, setCurrent] = useState(1);

  return (
    <AdminCard title="多步骤流程">
      <div className="design-system-page__split-pane-panel">
        <div className="design-system-page__input-panel-head">
          <h3>步骤导航</h3>
          <ComponentEntry name="AdminStepNavigation" />
          <p>适用于有明确阶段的办理流程。点击步骤仅请求切换；业务页面负责每一步的数据校验、保存和是否允许进入下一步。</p>
        </div>
        <AdminStepNavigation current={current} items={steps} onChange={setCurrent} />
      </div>
    </AdminCard>
  );
}

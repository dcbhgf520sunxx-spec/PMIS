import { useState } from 'react';
import { AdminCard } from '../../../../components/admin';
import { FeedbackConfirmations } from './feedback/FeedbackConfirmations';
import { FeedbackMessages } from './feedback/FeedbackMessages';
import { FeedbackOverlays } from './feedback/FeedbackOverlays';
import { FeedbackProgress } from './feedback/FeedbackProgress';
import { FeedbackTableDrawer } from './feedback/FeedbackTableDrawer';
import './FeedbackSection.css';

const feedbackSpecs = [
  { label: '轻提示与横幅', value: '用于即时反馈和页面内持续提示，短句中文，靠近相关内容' },
  { label: '通知提醒', value: '用于后台任务或跨区域提醒，标题说事件，正文说下一步' },
  { label: '气泡确认框', value: '用于按钮或文字操作旁的二次确认，高风险动作必须说明后果' },
  { label: '进度反馈', value: '用于导入、导出、批处理等可量化任务，明确展示完成比例' },
  { label: '加载状态', value: '用于局部等待和提交中状态，只加载正在处理的区域' },
  { label: '弹窗与抽屉', value: '弹窗承接短流程，抽屉承接侧向补充，不替代详情页' }
];

export function FeedbackSection() {
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  return (<>
    <div className="design-system-page__section design-system-page__feedback">
      <AdminCard title="反馈组件">
        <div className="design-system-page__base-rule-grid">
          {feedbackSpecs.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.label}>
              <h3>{item.label}</h3><p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>
      <FeedbackMessages />
      <FeedbackConfirmations />
      <FeedbackProgress />
      <FeedbackOverlays onOpenTableDrawer={() => setTableDrawerOpen(true)} />
    </div>
    <FeedbackTableDrawer open={tableDrawerOpen} onClose={() => setTableDrawerOpen(false)} />
  </>);
}

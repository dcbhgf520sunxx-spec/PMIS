import { AdminAsyncTaskStatus, AdminCard } from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

export function AsyncTaskStatusExamples() {
  return (
    <AdminCard title="6. 长任务处理">
      <div className="design-system-page__input-grid">
        <section className="design-system-page__input-panel is-wide">
          <div className="design-system-page__input-panel-head">
            <h3>长任务处理状态</h3>
            <ComponentEntry name="AdminAsyncTaskStatus" />
            <p>用于文件解析、AI 审核、数据导入和报告生成等需要几十秒或几分钟完成的后台任务。业务页面只展示当前一种状态。</p>
          </div>
          <div className="design-system-page__async-task-state-grid">
            <div className="design-system-page__async-task-state-item">
              <h4>等待处理</h4>
              <AdminAsyncTaskStatus
                description="任务正在排队，前方还有 3 个任务。"
                state="waiting"
                title="材料解析任务"
              />
            </div>
            <div className="design-system-page__async-task-state-item">
              <h4>处理过程中</h4>
              <AdminAsyncTaskStatus
                description="正在解析材料，完成后页面会自动更新。"
                progress={38}
                state="running"
                title="材料解析任务"
              />
            </div>
            <div className="design-system-page__async-task-state-item">
              <h4>处理成功</h4>
              <AdminAsyncTaskStatus
                description="材料解析已经完成，可以继续下一步。"
                state="success"
                title="材料解析任务"
              />
            </div>
            <div className="design-system-page__async-task-state-item">
              <h4>处理失败</h4>
              <AdminAsyncTaskStatus
                description="本次任务没有完成。"
                errorMessage="文件解析服务暂不可用，请稍后重试。"
                onRetry={() => new Promise((resolve) => window.setTimeout(resolve, 500))}
                state="error"
                title="材料解析任务"
              />
            </div>
          </div>
        </section>
      </div>
    </AdminCard>
  );
}

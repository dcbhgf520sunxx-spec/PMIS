import {
  AdminButton, AdminCard, AdminProgress, AdminSpin, AdminTextAction
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

export function FeedbackProgress() {
  return (
    <>
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
    </>
  );
}

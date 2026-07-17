import {
  AdminCard, BubbleConfirmAction, DeleteConfirmAction, StatusConfirmAction, useAdminFeedback
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

export function FeedbackConfirmations() {
  const { message } = useAdminFeedback();
  return (<>
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
  </>);
}

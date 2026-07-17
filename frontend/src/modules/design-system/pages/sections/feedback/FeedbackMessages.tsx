import { AdminAlert, AdminButton, AdminCard, useAdminFeedback } from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

export function FeedbackMessages() {
  const { message, notification } = useAdminFeedback();
  return (<>
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
  </>);
}

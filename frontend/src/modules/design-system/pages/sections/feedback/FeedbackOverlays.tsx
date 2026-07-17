import { useState } from 'react';
import {
  AdminButton, AdminCard, AdminDatePicker, AdminDrawer, AdminFormItem, AdminInput,
  AdminModal, AdminParagraph, AdminSelect, AdminTextArea, StatusFlowModal, useAdminFeedback
} from '../../../../../components/admin';
import type { WorkOrderStatus } from '../../../../work-order/types';
import { renderWorkOrderStatus, statusOptions } from '../../../../work-order/helpers';
import { ComponentEntry } from '../../components/ComponentEntry';

type FeedbackOverlaysProps = { onOpenTableDrawer: () => void };

export function FeedbackOverlays({ onOpenTableDrawer }: FeedbackOverlaysProps) {
  const { message } = useAdminFeedback();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [statusFlowOpen, setStatusFlowOpen] = useState(false);
  const [statusFlowTarget, setStatusFlowTarget] = useState<WorkOrderStatus | undefined>();

  return (<>
            <AdminCard title="6. 弹窗与抽屉">
              <div className="design-system-page__input-grid">
                <section className="design-system-page__input-panel">
                  <div className="design-system-page__input-panel-head">
                    <h3>弹窗与抽屉</h3>
                    <ComponentEntry name="AdminModal / AdminDrawer / TemplateDrawerTable / StatusFlowModal" />
                    <p>弹窗用于短流程，抽屉用于侧向补充。通用按钮统一使用取消和确认。</p>
                  </div>
                  <div className="design-system-page__input-demo-list">
                    <div className="design-system-page__input-demo">
                      <h4>普通弹窗</h4>
                      <AdminButton onClick={() => setModalOpen(true)}>打开弹窗</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>状态流转弹窗</h4>
                      <AdminButton
                        onClick={() => {
                          setStatusFlowTarget(undefined);
                          setStatusFlowOpen(true);
                        }}
                      >
                        打开状态流转
                      </AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>侧向抽屉</h4>
                      <AdminButton onClick={() => setDrawerOpen(true)}>打开抽屉</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>表单抽屉</h4>
                      <AdminButton onClick={() => setFormDrawerOpen(true)}>打开表单抽屉</AdminButton>
                    </div>
                    <div className="design-system-page__input-demo">
                      <h4>表格抽屉</h4>
                      <AdminButton onClick={onOpenTableDrawer}>打开表格抽屉</AdminButton>
                    </div>
                  </div>
                </section>
              </div>
            </AdminCard>
      <StatusFlowModal<WorkOrderStatus>
        open={statusFlowOpen}
        currentValue={renderWorkOrderStatus(0)}
        targetValue={statusFlowTarget}
        targetText={statusFlowTarget !== undefined ? renderWorkOrderStatus(statusFlowTarget) : undefined}
        targetOptions={statusOptions.filter((item) => item.value !== 0)}
        onTargetChange={setStatusFlowTarget}
        onCancel={() => {
          setStatusFlowOpen(false);
          setStatusFlowTarget(undefined);
        }}
        onConfirm={() => {
          message.success('状态已变更');
          setStatusFlowOpen(false);
          setStatusFlowTarget(undefined);
        }}
        renderExtra={(target) => (
          target === 2 ? (
            <>
              <AdminFormItem
                name="resolveDate"
                label="实际修复时间"
                rules={[{ required: true, message: '请选择实际修复时间' }]}
              >
                <AdminDatePicker
                  placeholder="请选择实际修复时间"
                />
              </AdminFormItem>
              <AdminFormItem
                name="resultDesc"
                label="处理结果"
                rules={[{ required: true, message: '请输入处理结果' }]}
              >
                <AdminTextArea rows={5} maxLength={100} showCount placeholder="请输入处理结果" />
              </AdminFormItem>
            </>
          ) : null
        )}
      />

      <AdminModal
        title="演示弹窗"
        open={modalOpen}
        width={560}
        onCancel={() => setModalOpen(false)}
        onOk={() => setModalOpen(false)}
      >
        <AdminParagraph>
          弹窗用于短流程确认和少量字段录入，内容要聚焦，不承载复杂列表。
        </AdminParagraph>
        <div className="design-system-page__modal-form">
          <label>
            <span>工单标题</span>
            <AdminInput placeholder="请输入工单标题" />
          </label>
          <label>
            <span>问题类型</span>
            <AdminSelect
              placeholder="请选择问题类型"
              options={[
                { label: '日常操作', value: 'daily' },
                { label: '系统优化', value: 'optimize' },
                { label: '故障报障', value: 'fault' }
              ]}
            />
          </label>
          <label>
            <span>紧急程度</span>
            <AdminSelect
              placeholder="请选择紧急程度"
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' }
              ]}
            />
          </label>
          <label>
            <span>跟进人</span>
            <AdminSelect
              placeholder="请选择跟进人"
              options={[
                { label: 'A001·管理员', value: 'admin' },
                { label: 'A002·运维人员', value: 'ops' },
                { label: 'A003·审核人员', value: 'reviewer' }
              ]}
            />
          </label>
          <label className="design-system-page__modal-form-full">
            <span>备注说明</span>
            <AdminTextArea rows={3} placeholder="请输入备注说明" />
          </label>
        </div>
      </AdminModal>

      <AdminDrawer
        title="演示抽屉"
        width={420}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="design-system-page__drawer-footer">
            <AdminButton onClick={() => setDrawerOpen(false)}>取消</AdminButton>
            <AdminButton type="primary" onClick={() => setDrawerOpen(false)}>确认</AdminButton>
          </div>
        }
      >
        <AdminParagraph>
          抽屉用于中等复杂度的表单和上下文操作。
        </AdminParagraph>
        <AdminTextArea rows={4} placeholder="抽屉输入区" />
      </AdminDrawer>

      <AdminDrawer
        title="表单抽屉"
        width={720}
        open={formDrawerOpen}
        onClose={() => setFormDrawerOpen(false)}
        footer={
          <div className="design-system-page__drawer-footer">
            <AdminButton onClick={() => setFormDrawerOpen(false)}>取消</AdminButton>
            <AdminButton type="primary" onClick={() => setFormDrawerOpen(false)}>确认</AdminButton>
          </div>
        }
      >
        <AdminParagraph>
          表单抽屉用于承载较完整的上下文数据，适合不离开当前列表的新增、编辑和补充信息。
        </AdminParagraph>
        <div className="design-system-page__drawer-form">
          <label>
            <span>工单标题</span>
            <AdminInput placeholder="请输入工单标题" />
          </label>
          <label>
            <span>问题类型</span>
            <AdminSelect
              placeholder="请选择问题类型"
              options={[
                { label: '日常操作', value: 'daily' },
                { label: '系统优化', value: 'optimize' },
                { label: '故障报障', value: 'fault' }
              ]}
            />
          </label>
          <label>
            <span>紧急程度</span>
            <AdminSelect
              placeholder="请选择紧急程度"
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' }
              ]}
            />
          </label>
          <label>
            <span>跟进人</span>
            <AdminSelect
              placeholder="请选择跟进人"
              options={[
                { label: 'A001·管理员', value: 'admin' },
                { label: 'A002·运维人员', value: 'ops' },
                { label: 'A003·审核人员', value: 'reviewer' }
              ]}
            />
          </label>
          <label className="design-system-page__drawer-form-full">
            <span>问题描述</span>
            <AdminTextArea rows={5} placeholder="请输入问题描述" />
          </label>
          <label className="design-system-page__drawer-form-full">
            <span>处理备注</span>
            <AdminTextArea rows={4} placeholder="请输入处理备注" />
          </label>
        </div>
      </AdminDrawer>
  </>);
}

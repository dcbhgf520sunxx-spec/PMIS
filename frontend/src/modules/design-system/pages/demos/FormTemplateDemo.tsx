import {
  AdminProFormSelect,
  AdminProFormText,
  AdminProFormTextArea,
  TemplateFormPage,
  TemplateFormSection,
  useAdminFeedback
} from '../../../../components/admin';
import { ComponentEntry } from '../components/ComponentEntry';

export function FormTemplateDemo() {
  const { message } = useAdminFeedback();

  return (
    <div className="design-system-page__layout-pattern-template">
      <div className="design-system-page__input-panel-head">
        <h3>TemplateFormPage</h3>
        <ComponentEntry name="TemplateFormPage / TemplateFormSection / AdminProForm*" />
        <p>新增和编辑页统一从这个入口接入。页面标题、右上角取消/保存、表单分组、字段网格都由模板承接，业务页只替换字段和提交逻辑。</p>
      </div>
      <div className="design-system-page__template-demo is-form">
        <TemplateFormPage<Record<string, unknown>>
          title="表单模板：新增用户"
          formId="design-system-template-form"
          initialValues={{
            employeeNo: '10086',
            realName: '张三',
            phone: '13800000000',
            roleIds: ['admin'],
            remark: '按业务字段替换，不在页面里重写标题、按钮和分组样式。'
          }}
          onCancel={() => message.info('已触发表单模板取消')}
          onSubmit={async () => {
            message.success('已触发表单模板保存');
          }}
        >
          <TemplateFormSection title="基本信息">
            <div className="admin-template-form-page__grid">
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="employeeNo"
                label="工号"
                rules={[{ required: true, message: '请输入工号' }]}
              />
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="realName"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              />
              <AdminProFormText
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="phone"
                label="手机号"
                rules={[{ required: true, message: '请输入手机号' }]}
              />
              <AdminProFormSelect
                className="admin-template-form-page__field"
                formItemProps={{ className: 'admin-template-form-page__field' }}
                name="roleIds"
                label="所属角色"
                mode="multiple"
                options={[
                  { label: '系统管理员', value: 'admin' },
                  { label: '业务管理员', value: 'operator' }
                ]}
                rules={[{ required: true, message: '请选择所属角色' }]}
              />
            </div>
          </TemplateFormSection>
          <TemplateFormSection title="补充信息">
            <div className="admin-template-form-page__grid">
              <AdminProFormTextArea
                className="admin-template-form-page__field is-wide"
                formItemProps={{ className: 'admin-template-form-page__field is-wide' }}
                name="remark"
                label="备注"
                fieldProps={{ rows: 3 }}
              />
            </div>
          </TemplateFormSection>
        </TemplateFormPage>
      </div>
    </div>
  );
}

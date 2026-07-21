import {
  AdminCard,
  AdminProFormEditableList,
  AdminProFormMoney,
  AdminProFormText,
  FormPage
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

type StageRecord = {
  stageName?: string;
  plannedAmount?: string;
};

type EditableDetailExampleValues = {
  stages?: StageRecord[];
};

const stageColumns = [
  {
    key: 'stageName',
    title: '阶段名称',
    width: 280,
    render: () => (
      <AdminProFormText
        name="stageName"
        placeholder="请输入阶段名称"
        rules={[{ required: true, message: '请输入阶段名称' }]}
      />
    )
  },
  {
    key: 'plannedAmount',
    title: '计划金额（元）',
    width: 220,
    render: () => (
      <AdminProFormMoney
        name="plannedAmount"
        placeholder="请输入计划金额"
        rules={[
          { required: true, message: '请输入计划金额' }
        ]}
      />
    )
  }
];

export function EditableDetailListExamples() {
  return (
    <AdminCard title="5. 可编辑明细表单">
      <div className="design-system-page__input-panel-head">
        <h3>多行结构化录入</h3>
        <p>电脑端按表格录入，窄屏自动变为卡片；序号、增删和最少行数由底座统一处理。</p>
      </div>
      <ComponentEntry name="AdminProFormEditableList" />
      <FormPage<EditableDetailExampleValues>
        initialValues={{
          stages: [
            { stageName: '合同签订', plannedAmount: '300000.00' },
            { stageName: '项目验收', plannedAmount: '700000.00' }
          ]
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      >
        <AdminProFormEditableList<StageRecord>
          name="stages"
          label="付款阶段"
          columns={stageColumns}
          creatorRecord={() => ({ stageName: '', plannedAmount: '' })}
          minRows={1}
        />
      </FormPage>
    </AdminCard>
  );
}

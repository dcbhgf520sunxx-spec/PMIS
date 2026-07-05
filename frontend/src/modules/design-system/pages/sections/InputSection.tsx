import { useState } from 'react';
import type { DefaultOptionType } from 'antd/es/select';
import { CloudUploadOutlined } from '@ant-design/icons';
import { ComponentEntry } from '../components/ComponentEntry';
import {
  AdminAutoComplete,
  AdminButton,
  AdminCard,
  AdminCascader,
  AdminCheckbox,
  AdminCheckboxGroup,
  AdminColorPicker,
  AdminDatePicker,
  AdminInput,
  AdminNumberInput,
  AdminPasswordInput,
  AdminRadio,
  AdminRadioButton,
  AdminRadioGroup,
  AdminRangePicker,
  AdminRate,
  AdminSelect,
  AdminSlider,
  AdminSpace,
  AdminSwitch,
  AdminTextArea,
  AdminTimePicker,
  AdminTransfer,
  AdminTreeSelect,
  AdminUpload,
  AdminUploadDragger,
  RichDescriptionEditor
} from '../../../../components/admin';

const inputComponentSpecs = [
  { label: '高度', value: '默认 32px，同一区域控件高度必须一致' },
  { label: '宽度', value: '同一行字段宽度一致，长文本独占整行' },
  { label: '必填', value: '红星只标识必填，不替代校验提示' },
  { label: '校验', value: '错误提示必须中文、明确、可执行' },
  { label: '悬浮 / 聚焦', value: '统一蓝色边框和轻量外圈' },
  { label: '文案', value: '占位、选项、空状态和提示不出现英文' }
];

const selectOptions = [
  { label: '日常操作', value: 'daily' },
  { label: '系统优化', value: 'optimize' },
  { label: '故障报障', value: 'fault' },
  { label: '后台维护', value: 'maintenance' },
  { label: '其他', value: 'other' }
];

const filterSelectOption = (input: string, option?: DefaultOptionType) => {
  const keyword = input.trim().toLowerCase();
  if (!keyword) return true;

  return String(option?.label ?? '').toLowerCase().includes(keyword)
    || String(option?.value ?? '').toLowerCase().includes(keyword);
};

const permissionOptions = ['读取', '编辑', '删除'];

const organizationTreeData = [
  {
    title: '技术中心',
    value: 'tech',
    children: [
      { title: '平台部', value: 'platform' },
      { title: '运维部', value: 'ops' }
    ]
  },
  {
    title: '业务中心',
    value: 'business',
    children: [
      { title: '游戏业务组', value: 'game' },
      { title: '数据运营组', value: 'data' }
    ]
  }
];

const regionOptions = [
  {
    label: '浙江省',
    value: 'zhejiang',
    children: [
      {
        label: '杭州市',
        value: 'hangzhou',
        children: [
          { label: '西湖区', value: 'xihu' },
          { label: '滨江区', value: 'binjiang' }
        ]
      },
      {
        label: '宁波市',
        value: 'ningbo',
        children: [
          { label: '海曙区', value: 'haishu' },
          { label: '鄞州区', value: 'yinzhou' }
        ]
      }
    ]
  },
  {
    label: '上海市',
    value: 'shanghai',
    children: [
      {
        label: '上海市',
        value: 'shanghai-city',
        children: [
          { label: '浦东新区', value: 'pudong' },
          { label: '徐汇区', value: 'xuhui' }
        ]
      }
    ]
  }
];

const transferDataSource = [
  { key: 'read', title: '读取权限', description: '查看基础信息和详情' },
  { key: 'edit', title: '编辑权限', description: '修改基础字段和状态' },
  { key: 'delete', title: '删除权限', description: '执行高风险删除操作' },
  { key: 'export', title: '导出权限', description: '导出列表和明细数据' },
  { key: 'audit', title: '审核权限', description: '处理审批和复核动作' },
  { key: 'dispatch', title: '指派权限', description: '分配工单处理人' }
];

const transferLocale = {
  itemUnit: '项',
  itemsUnit: '项',
  searchPlaceholder: '请输入关键词',
  notFoundContent: '暂无数据'
};

type InputSectionProps = {
  richText: string;
  setRichText: (value: string) => void;
};

export function InputSection({ richText, setRichText }: InputSectionProps) {
  const [limitedNumber, setLimitedNumber] = useState<number | null>(null);
  const [transferTargetKeys, setTransferTargetKeys] = useState<string[]>(['read', 'export']);
  const [searchTransferTargetKeys, setSearchTransferTargetKeys] = useState<string[]>(['read', 'edit']);
  const [permissionCheckedList, setPermissionCheckedList] = useState<string[]>(['读取', '编辑']);
  const isPermissionAllChecked = permissionOptions.length === permissionCheckedList.length;
  const isPermissionIndeterminate = permissionCheckedList.length > 0 && !isPermissionAllChecked;

  return (
    <div className="design-system-page__input">
      <AdminCard title="输入组件规范">
        <div className="design-system-page__base-rule-grid">
          {inputComponentSpecs.map((item) => (
            <section className="design-system-page__base-rule-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </section>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="1. 基础输入">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>文本输入</h3>
              <p>单行输入保持统一高度，多行文本独占整行。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础输入</h4>
                <ComponentEntry name="AdminInput" />
                <AdminInput placeholder="请输入问题描述" allowClear />
              </div>
              <div className="design-system-page__input-demo">
                <h4>不可用</h4>
                <ComponentEntry name="AdminInput" />
                <AdminInput placeholder="禁用状态" disabled />
              </div>
              <div className="design-system-page__input-demo">
                <h4>前缀 / 后缀</h4>
                <ComponentEntry name="AdminInput" />
                <AdminInput prefix="RQ" suffix="工单" placeholder="请输入编号" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>前置 / 后置标签</h4>
                <ComponentEntry name="AdminInput" />
                <AdminInput prefix="系统" suffix="生产环境" placeholder="请输入模块名称" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>密码输入</h4>
                <ComponentEntry name="AdminPasswordInput" />
                <AdminPasswordInput placeholder="请输入密码" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>自动完成</h4>
                <ComponentEntry name="AdminAutoComplete" />
                <AdminAutoComplete
                  placeholder="请输入关键词"
                  options={[
                    { value: '用户管理' },
                    { value: '角色管理' },
                    { value: '组件工作台' }
                  ]}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>标签输入</h4>
                <ComponentEntry name="AdminSelect" />
                <AdminSelect
                  mode="tags"
                  maxTagCount="responsive"
                  placeholder="请输入或选择标签"
                  defaultValue={['后台', '运维']}
                  options={[
                    { value: '后台', label: '后台' },
                    { value: '运维', label: '运维' },
                    { value: '高频', label: '高频' }
                  ]}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>校验状态</h4>
                <ComponentEntry name="AdminInput" />
                <AdminInput status="error" placeholder="错误状态" defaultValue="字段不能为空" />
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>长文本</h4>
                <ComponentEntry name="AdminTextArea" />
                <AdminTextArea rows={4} placeholder="请输入较长内容，支持换行展示" />
              </div>
            </div>
          </section>

          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>数字输入</h3>
              <p>适合数量、金额、时长、比例等精确数值。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础数字（最多 8 位）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput
                  value={limitedNumber}
                  min={0}
                  placeholder="请输入数字"
                  onChange={(value) => {
                    const nextValue = String(value ?? '').replace(/\D/g, '').slice(0, 8);
                    setLimitedNumber(nextValue ? Number(nextValue) : null);
                  }}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>默认值（默认 12）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput defaultValue={12} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>步长（每次加减 2）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput step={2} defaultValue={2} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>上下限（1 到 10）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput min={1} max={10} defaultValue={1} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>小数精度（保留 2 位）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput precision={2} defaultValue={1.23} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>单位后缀（小时）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput
                  min={0}
                  defaultValue={4}
                  formatter={(value) => (value === undefined || value === null ? '' : `${value} 小时`)}
                  parser={(value) => value?.replace(/\s*小时$/, '') || ''}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>禁用状态（不可编辑）</h4>
                <ComponentEntry name="AdminNumberInput" />
                <AdminNumberInput defaultValue={2} disabled />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="2. 日期与时间">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>日期时间</h3>
              <p>参考日期选择器的常用形态，日期必须中文化，今天空心蓝，选中实心蓝。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>日期选择（年月日）</h4>
                <ComponentEntry name="AdminDatePicker" />
                <AdminDatePicker placeholder="请选择日期" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>时间选择（时分秒）</h4>
                <ComponentEntry name="AdminTimePicker" />
                <AdminTimePicker placeholder="请选择时间" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>日期时间（日期 + 时间）</h4>
                <ComponentEntry name="AdminDatePicker" />
                <AdminDatePicker
                  showTime
                  placeholder="请选择日期时间"
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>年月选择（按月统计）</h4>
                <ComponentEntry name="AdminDatePicker" />
                <AdminDatePicker
                  picker="month"
                  placeholder="请选择年月"
                />
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>日期范围（开始日期 到 结束日期）</h4>
                <ComponentEntry name="AdminRangePicker" />
                <AdminRangePicker
                  placeholder={['开始日期', '结束日期']}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="3. 下拉选择">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>基础下拉</h3>
              <p>用于枚举类字段，单选和多选都要保持 32px 高度，选项文案中文化。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>单选下拉</h4>
                <ComponentEntry name="AdminSelect" />
                <AdminSelect
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  filterOption={filterSelectOption}
                  notFoundContent="暂无数据"
                  placeholder="请选择或搜索问题类型"
                  options={selectOptions}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>多选下拉</h4>
                <ComponentEntry name="AdminSelect" />
                <AdminSelect
                  allowClear
                  mode="multiple"
                  maxTagCount="responsive"
                  optionFilterProp="label"
                  filterOption={filterSelectOption}
                  notFoundContent="暂无数据"
                  placeholder="请选择问题类型"
                  defaultValue={['daily', 'other']}
                  options={selectOptions}
                />
              </div>
            </div>
          </section>

          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>树选择器</h3>
              <p>适合组织、权限、分类等树形数据，单选用于明确归属，多选用于批量授权。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>树选择器（单选）</h4>
                <ComponentEntry name="AdminTreeSelect" />
                <AdminTreeSelect
                  popupClassName="design-system-page__tree-select-popup"
                  treeDefaultExpandAll
                  placeholder="请选择组织"
                  treeData={organizationTreeData}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>树选择器（多选）</h4>
                <ComponentEntry name="AdminTreeSelect" />
                <AdminTreeSelect
                  popupClassName="design-system-page__tree-select-popup"
                  treeCheckable
                  treeDefaultExpandAll
                  placeholder="请选择组织"
                  defaultValue={['tech']}
                  showCheckedStrategy={AdminTreeSelect.SHOW_PARENT}
                  treeData={organizationTreeData}
                />
              </div>
            </div>
          </section>

          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>级联选择</h3>
              <p>适合省市区这类逐级收敛的数据，路径必须清晰，避免只展示末级造成歧义。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>级联选择（单选，省市区）</h4>
                <ComponentEntry name="AdminCascader" />
                <AdminCascader
                  placeholder="请选择省市区"
                  options={regionOptions}
                />
              </div>
              <div className="design-system-page__input-demo">
                <h4>级联选择（多选，省市区）</h4>
                <ComponentEntry name="AdminCascader" />
                <AdminCascader
                  multiple
                  maxTagCount="responsive"
                  placeholder="请选择省市区"
                  defaultValue={[
                    ['zhejiang', 'hangzhou', 'xihu'],
                    ['shanghai', 'shanghai-city', 'pudong']
                  ]}
                  options={regionOptions}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="4. 单选框与复选框">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>单选框</h3>
              <p>用于同一组互斥选项，选项数量少且需要直接露出时使用。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础单选</h4>
                <ComponentEntry name="AdminRadioGroup / AdminRadio" />
                <AdminRadioGroup defaultValue="enabled">
                  <AdminRadio value="enabled">启用</AdminRadio>
                  <AdminRadio value="disabled">停用</AdminRadio>
                  <AdminRadio value="pending">待确认</AdminRadio>
                </AdminRadioGroup>
              </div>
              <div className="design-system-page__input-demo">
                <h4>按钮单选</h4>
                <ComponentEntry name="AdminRadioGroup / AdminRadioButton" />
                <AdminRadioGroup defaultValue="week" optionType="button" buttonStyle="solid">
                  <AdminRadioButton value="day">日</AdminRadioButton>
                  <AdminRadioButton value="week">周</AdminRadioButton>
                  <AdminRadioButton value="month">月</AdminRadioButton>
                </AdminRadioGroup>
              </div>
              <div className="design-system-page__input-demo">
                <h4>禁用单选</h4>
                <ComponentEntry name="AdminRadioGroup / AdminRadio" />
                <AdminRadioGroup defaultValue="readonly" disabled>
                  <AdminRadio value="readonly">只读</AdminRadio>
                  <AdminRadio value="edit">可编辑</AdminRadio>
                </AdminRadioGroup>
              </div>
            </div>
          </section>

          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>复选框</h3>
              <p>用于多项并行选择，支持全选、半选和禁用状态。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础复选</h4>
                <ComponentEntry name="AdminCheckboxGroup" />
                <AdminCheckboxGroup options={permissionOptions} defaultValue={['读取']} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>全选 / 半选</h4>
                <ComponentEntry name="AdminCheckbox / AdminCheckboxGroup" />
                <AdminSpace direction="vertical" size={6}>
                  <AdminCheckbox
                    checked={isPermissionAllChecked}
                    indeterminate={isPermissionIndeterminate}
                    onChange={(event) => {
                      setPermissionCheckedList(event.target.checked ? permissionOptions : []);
                    }}
                  >
                    全部权限
                  </AdminCheckbox>
                  <AdminCheckboxGroup
                    options={permissionOptions}
                    value={permissionCheckedList}
                    onChange={(checkedValues) => {
                      setPermissionCheckedList(checkedValues as string[]);
                    }}
                  />
                </AdminSpace>
              </div>
              <div className="design-system-page__input-demo">
                <h4>禁用复选</h4>
                <ComponentEntry name="AdminCheckboxGroup" />
                <AdminCheckboxGroup disabled options={['短信通知', '邮件通知']} defaultValue={['短信通知']} />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="5. 穿梭选择器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>穿梭选择器</h3>
              <p>适合从候选集合中批量分配权限、人员或资源，左右列表必须有清晰标题。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo is-wide">
                <h4>基础穿梭（权限分配）</h4>
                <ComponentEntry name="AdminTransfer" />
                <AdminTransfer
                  dataSource={transferDataSource}
                  targetKeys={transferTargetKeys}
                  locale={transferLocale}
                  onChange={(nextTargetKeys) => setTransferTargetKeys(nextTargetKeys.map(String))}
                  render={(item) => item.title || ''}
                  titles={['可选权限', '已选权限']}
                />
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>带搜索穿梭（大量选项）</h4>
                <ComponentEntry name="AdminTransfer" />
                <AdminTransfer
                  dataSource={transferDataSource}
                  targetKeys={searchTransferTargetKeys}
                  locale={transferLocale}
                  onChange={(nextTargetKeys) => setSearchTransferTargetKeys(nextTargetKeys.map(String))}
                  render={(item) => item.title || ''}
                  showSearch
                  titles={['可选权限', '已选权限']}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="6. 开关">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>开关</h3>
              <p>用于明确的二元状态，文案要表达开和关分别代表什么。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础开关</h4>
                <ComponentEntry name="AdminSwitch" />
                <AdminSwitch className="design-system-page__switch" defaultChecked checkedChildren="启用" unCheckedChildren="停用" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>禁用开关</h4>
                <ComponentEntry name="AdminSwitch" />
                <AdminSwitch className="design-system-page__switch" disabled defaultChecked checkedChildren="启用" unCheckedChildren="停用" />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="7. 滑动选择器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>滑动选择器</h3>
              <p>适合比例、进度、阈值这类连续数值，区间选择要明确上下限含义。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo is-wide">
                <h4>基础滑动</h4>
                <ComponentEntry name="AdminSlider" />
                <AdminSlider defaultValue={36} />
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>区间滑动</h4>
                <ComponentEntry name="AdminSlider" />
                <AdminSlider range defaultValue={[20, 60]} />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="8. 评分">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>评分</h3>
              <p>用于满意度、质量、优先级这类轻量评价，不承担复杂打分逻辑。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础评分</h4>
                <ComponentEntry name="AdminRate" />
                <AdminRate defaultValue={3} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>半星评分</h4>
                <ComponentEntry name="AdminRate" />
                <AdminRate allowHalf defaultValue={3.5} />
              </div>
              <div className="design-system-page__input-demo">
                <h4>只读评分</h4>
                <ComponentEntry name="AdminRate" />
                <AdminRate disabled defaultValue={4} />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="9. 上传">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>上传</h3>
              <p>用于附件、截图、导入文件，上传入口要清晰，限制条件写在提示里。</p>
            </div>
            <div className="design-system-page__input-demo-list design-system-page__input-demo-list--stack">
              <div className="design-system-page__input-demo">
                <h4>基础上传</h4>
                <ComponentEntry name="AdminUpload" />
                <AdminUpload beforeUpload={() => false} maxCount={1}>
                  <AdminButton icon={<CloudUploadOutlined />}>选择文件</AdminButton>
                </AdminUpload>
              </div>
              <div className="design-system-page__input-demo is-wide">
                <h4>拖拽上传</h4>
                <ComponentEntry name="AdminUploadDragger" />
                <AdminUploadDragger beforeUpload={() => false} maxCount={1}>
                  <div className="design-system-page__upload-drag-content">
                    <p className="ant-upload-text">
                      <CloudUploadOutlined />
                      <span>拖拽文件到此处，或点击上传</span>
                    </p>
                    <p className="ant-upload-hint">支持图片、文档，单个文件不超过 20MB</p>
                  </div>
                </AdminUploadDragger>
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="10. 颜色选择器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel">
            <div className="design-system-page__input-panel-head">
              <h3>颜色选择器</h3>
              <p>只用于需要人工配置色值的场景，默认色要和主题变量保持一致。</p>
            </div>
            <div className="design-system-page__input-demo-list">
              <div className="design-system-page__input-demo">
                <h4>基础颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker className="design-system-page__color-picker" defaultValue="#2563eb" />
              </div>
              <div className="design-system-page__input-demo">
                <h4>预设颜色</h4>
                <ComponentEntry name="AdminColorPicker" />
                <AdminColorPicker
                  className="design-system-page__color-picker"
                  defaultValue="#0f42d2"
                  presets={[
                    {
                      label: '主题色',
                      colors: ['#2563eb', '#0f42d2', '#0891b2', '#475569']
                    }
                  ]}
                />
              </div>
            </div>
          </section>
        </div>
      </AdminCard>

      <AdminCard title="11. 富文本编辑器">
        <div className="design-system-page__input-grid">
          <section className="design-system-page__input-panel is-wide">
            <div className="design-system-page__input-panel-head">
              <h3>富文本编辑器</h3>
              <ComponentEntry name="RichDescriptionEditor" />
              <p>适合问题描述、处理记录，支持粘贴图片并调整图片大小。</p>
            </div>
            <RichDescriptionEditor value={richText} onChange={setRichText} />
          </section>
        </div>
      </AdminCard>
    </div>
  );
}

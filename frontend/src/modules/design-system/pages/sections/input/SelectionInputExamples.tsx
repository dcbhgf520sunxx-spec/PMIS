import type { DefaultOptionType } from 'antd/es/select';
import {
  AdminCard, AdminCascader, AdminDatePicker, AdminRangePicker, AdminSelect,
  AdminTimePicker, AdminTreeSelect
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

const selectOptions = [
  { label: '日常操作', value: 'daily' }, { label: '系统优化', value: 'optimize' },
  { label: '故障报障', value: 'fault' }, { label: '后台维护', value: 'maintenance' },
  { label: '其他', value: 'other' }
];
const filterSelectOption = (input: string, option?: DefaultOptionType) => {
  const keyword = input.trim().toLowerCase();
  if (!keyword) return true;
  return String(option?.label ?? '').toLowerCase().includes(keyword)
    || String(option?.value ?? '').toLowerCase().includes(keyword);
};
const organizationTreeData = [
  { title: '技术中心', value: 'tech', children: [{ title: '平台部', value: 'platform' }, { title: '运维部', value: 'ops' }] },
  { title: '业务中心', value: 'business', children: [{ title: '游戏业务组', value: 'game' }, { title: '数据运营组', value: 'data' }] }
];
const regionOptions = [
  { label: '浙江省', value: 'zhejiang', children: [
    { label: '杭州市', value: 'hangzhou', children: [{ label: '西湖区', value: 'xihu' }, { label: '滨江区', value: 'binjiang' }] },
    { label: '宁波市', value: 'ningbo', children: [{ label: '海曙区', value: 'haishu' }, { label: '鄞州区', value: 'yinzhou' }] }
  ] },
  { label: '上海市', value: 'shanghai', children: [
    { label: '上海市', value: 'shanghai-city', children: [{ label: '浦东新区', value: 'pudong' }, { label: '徐汇区', value: 'xuhui' }] }
  ] }
];



export function SelectionInputExamples() {
  return (
    <>
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
    </>
  );
}

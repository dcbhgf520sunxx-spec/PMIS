import { useState } from 'react';
import {
  AdminCard, AdminCheckbox, AdminCheckboxGroup, AdminRadio, AdminRadioButton,
  AdminRadioGroup, AdminRate, AdminSlider, AdminSpace, AdminSwitch, AdminTransfer
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

const permissionOptions = ['读取', '编辑', '删除'];
const transferDataSource = [
  { key: 'read', title: '读取权限', description: '查看基础信息和详情' },
  { key: 'edit', title: '编辑权限', description: '修改基础字段和状态' },
  { key: 'delete', title: '删除权限', description: '执行高风险删除操作' },
  { key: 'export', title: '导出权限', description: '导出列表和明细数据' },
  { key: 'audit', title: '审核权限', description: '处理审批和复核动作' },
  { key: 'dispatch', title: '指派权限', description: '分配工单处理人' }
];
const transferLocale = { itemUnit: '项', itemsUnit: '项', searchPlaceholder: '请输入关键词', notFoundContent: '暂无数据' };

export function ChoiceInputExamples() {
  const [transferTargetKeys, setTransferTargetKeys] = useState<string[]>(['read', 'export']);
  const [searchTransferTargetKeys, setSearchTransferTargetKeys] = useState<string[]>(['read', 'edit']);
  const [permissionCheckedList, setPermissionCheckedList] = useState<string[]>(['读取', '编辑']);
  const isPermissionAllChecked = permissionOptions.length === permissionCheckedList.length;
  const isPermissionIndeterminate = permissionCheckedList.length > 0 && !isPermissionAllChecked;

  return (
    <>
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
    </>
  );
}

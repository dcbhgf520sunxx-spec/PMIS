import { useState } from 'react';
import {
  AdminAutoComplete, AdminCard, AdminInput, AdminNumberInput, AdminPasswordInput,
  AdminSelect, AdminTextArea
} from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';

export function BasicInputExamples() {
  const [limitedNumber, setLimitedNumber] = useState<number | null>(null);

  return (
    <>
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
    </>
  );
}

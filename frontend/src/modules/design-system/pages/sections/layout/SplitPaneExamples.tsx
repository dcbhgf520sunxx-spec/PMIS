import { useState } from 'react';
import { AdminButton, AdminCard, AdminSplitPane } from '../../../../../components/admin';
import { ComponentEntry } from '../../components/ComponentEntry';
import './SplitPaneExamples.css';

export function SplitPaneExamples() {
  const [selectedRule, setSelectedRule] = useState('评审要点 1');

  return (
    <AdminCard title="双栏工作台">
      <div className="design-system-page__split-pane-panel">
        <div className="design-system-page__input-panel-head">
          <h3>可拖拽分栏</h3>
          <ComponentEntry name="AdminSplitPane" />
          <p>适用于左侧目录、规则或记录列表，右侧承接预览、详情或处理内容的页面。拖动中间分隔线可调宽；刷新后保留本次调整。基础档案已使用同一组件承接左侧类型与右侧档案明细。</p>
        </div>
        <AdminSplitPane
          ariaLabel="调整规则列表与内容预览宽度"
          defaultLeftWidth={300}
          minLeftWidth={220}
          minRightWidth={320}
          storageKey="design-system-split-pane-example"
          left={(
            <div className="design-system-page__split-pane-list">
              <strong>审核规则</strong>
              {['评审要点 1', '评审要点 2', '风险提示 3', '材料完整性'].map((item) => (
                <AdminButton
                  adminVariant="subtle"
                  className={item === selectedRule ? 'is-selected' : undefined}
                  key={item}
                  onClick={() => setSelectedRule(item)}
                  type="text"
                >
                  {item}
                </AdminButton>
              ))}
            </div>
          )}
          right={(
            <div className="design-system-page__split-pane-preview">
              <span>当前查看</span>
              <strong>{selectedRule}</strong>
              <p>右侧内容由业务页面传入。底座只负责两栏布局、拖拽、宽度边界、窄屏堆叠和可选的个人宽度记忆。</p>
            </div>
          )}
        />
      </div>
    </AdminCard>
  );
}

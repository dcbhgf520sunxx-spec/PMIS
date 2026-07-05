import {
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import {
  AdminEmptyState,
  AdminInput,
  AdminDeleteIconAction,
  AdminEditIconAction,
  AdminToggleStatusIconAction
} from '../../../components/admin';
import type { ArchiveTypeRecord } from '../../../api/archiveApi';

type ArchiveTypeSidebarProps = {
  items: ArchiveTypeRecord[];
  keyword: string;
  selectedId?: string;
  onKeywordChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (record: ArchiveTypeRecord) => void;
  onToggleStatus: (record: ArchiveTypeRecord) => Promise<void> | void;
  onDelete: (record: ArchiveTypeRecord) => Promise<void> | void;
};

export function ArchiveTypeSidebar({
  items,
  keyword,
  selectedId,
  onKeywordChange,
  onSelect,
  onCreate,
  onEdit,
  onToggleStatus,
  onDelete
}: ArchiveTypeSidebarProps) {
  return (
    <aside className="archive-page__sidebar">
      <div className="archive-page__sidebar-header">
        <Typography.Text strong>档案类型</Typography.Text>
      </div>
      <div className="archive-page__sidebar-search">
        <AdminInput
          allowClear
          size="small"
          prefix={<SearchOutlined />}
          placeholder="搜索类型名称"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>
      <div className="archive-page__type-list">
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className={[
              'archive-page__type-item',
              selectedId === item.id ? 'is-active' : '',
              item.status === 'disabled' ? 'is-disabled' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <span className="archive-page__type-main">
              <span className="archive-page__type-name" title={item.name}>{item.name}</span>
            </span>
            {item.status === 'disabled' ? <span className="archive-page__type-badge">停用</span> : null}
            <span className="archive-page__type-actions" onClick={(event) => event.stopPropagation()}>
              <AdminEditIconAction
                onClick={() => onEdit(item)}
              />
              <AdminToggleStatusIconAction
                active={item.status === 'enabled'}
                targetName={item.name}
                onConfirm={() => onToggleStatus(item)}
                successMessage={false}
              />
              <AdminDeleteIconAction
                entityName="档案类型"
                targetName={item.name}
                onConfirm={() => onDelete(item)}
                successMessage={false}
              />
            </span>
          </div>
        ))}
        {items.length === 0 ? (
          <AdminEmptyState description="无匹配类型" />
        ) : null}
      </div>
      <div className="archive-page__sidebar-footer">
        <Button block size="small" type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新增类型
        </Button>
      </div>
    </aside>
  );
}

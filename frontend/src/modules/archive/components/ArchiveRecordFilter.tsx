import { AdminInput, AdminSelect, CompactFilterBar } from '../../../components/admin';
import type { ArchiveRecord } from '../../../api/archiveApi';

export type ArchiveRecordFilters = {
  code: string;
  name: string;
  status?: ArchiveRecord['status'];
};

type ArchiveRecordFilterProps = {
  filters: ArchiveRecordFilters;
  onChange: (filters: ArchiveRecordFilters) => void;
  onSearch: () => void;
  onReset: () => void;
};

export function ArchiveRecordFilter({
  filters,
  onChange,
  onSearch,
  onReset
}: ArchiveRecordFilterProps) {
  return (
    <div className="archive-page__filter">
      <CompactFilterBar
        visibleCount={3}
        items={[
          {
            key: 'code',
            label: '档案编码',
            node: (
              <AdminInput
                allowClear
                size="small"
                placeholder="请输入"
                value={filters.code}
                onChange={(event) => onChange({ ...filters, code: event.target.value })}
                onPressEnter={onSearch}
              />
            )
          },
          {
            key: 'name',
            label: '档案名称',
            node: (
              <AdminInput
                allowClear
                size="small"
                placeholder="请输入"
                value={filters.name}
                onChange={(event) => onChange({ ...filters, name: event.target.value })}
                onPressEnter={onSearch}
              />
            )
          },
          {
            key: 'status',
            label: '状态',
            node: (
              <AdminSelect
                size="small"
                placeholder="全部"
                value={filters.status}
                options={[
                  { label: '启用', value: 'enabled' },
                  { label: '停用', value: 'disabled' }
                ]}
                onChange={(value) => onChange({ ...filters, status: value })}
              />
            )
          }
        ]}
        onSearch={onSearch}
        onReset={onReset}
      />
    </div>
  );
}

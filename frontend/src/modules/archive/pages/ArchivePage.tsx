import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Form } from 'antd';
import { AdminButton, AdminEmptyState, AdminSplitPane, AdminText, PageShell, useTemplateListPageData } from '../../../components/admin';
import {
  batchUpdateArchiveSort,
  createArchive,
  createArchiveType,
  deleteArchive,
  deleteArchiveType,
  getArchives,
  getArchiveTypes,
  toggleArchiveStatus,
  toggleArchiveTypeStatus,
  updateArchive,
  updateArchiveType,
  type ArchiveRecord,
  type ArchiveTypeRecord
} from '../../../api/archiveApi';
import { ArchiveRecordFilter, type ArchiveRecordFilters } from '../components/ArchiveRecordFilter';
import { ArchiveRecordModal, type ArchiveFormValue } from '../components/ArchiveRecordModal';
import { ArchiveRecordTable } from '../components/ArchiveRecordTable';
import { ArchiveTypeModal, type TypeFormValue } from '../components/ArchiveTypeModal';
import { ArchiveTypeSidebar } from '../components/ArchiveTypeSidebar';
import './ArchivePage.css';

const MIN_ARCHIVE_SIDEBAR_WIDTH = 280;
const MAX_ARCHIVE_SIDEBAR_WIDTH = 460;

export function ArchivePage() {
  const { message } = App.useApp();
  const [typeForm] = Form.useForm<TypeFormValue>();
  const [archiveForm] = Form.useForm<ArchiveFormValue>();

  const [typeList, setTypeList] = useState<ArchiveTypeRecord[]>([]);
  const [archiveRows, setArchiveRows] = useState<ArchiveRecord[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>();
  const [typeKeyword, setTypeKeyword] = useState('');
  const [archiveFilters, setArchiveFilters] = useState<ArchiveRecordFilters>({ code: '', name: '', status: undefined });
  const [filterRevision, setFilterRevision] = useState(0);
  const [, setLoadingTypes] = useState(false);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ArchiveTypeRecord>();
  const [editingArchive, setEditingArchive] = useState<ArchiveRecord>();
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [draggingId, setDraggingId] = useState<string>();
  const archiveFiltersRef = useRef(archiveFilters);

  useEffect(() => {
    archiveFiltersRef.current = archiveFilters;
  }, [archiveFilters]);

  const selectedType = useMemo(
    () => typeList.find((item) => item.id === selectedTypeId),
    [selectedTypeId, typeList]
  );

  const filteredTypeList = useMemo(() => {
    const keyword = typeKeyword.trim().toLowerCase();
    if (!keyword) return typeList;
    return typeList.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [typeKeyword, typeList]);

  const enabledTypeOptions = useMemo(
    () => typeList
      .filter((item) => item.status === 'enabled')
      .map((item) => ({ label: item.name, value: item.id })),
    [typeList]
  );

  const {
    pagedRows: pagedArchiveRows,
    pagination,
    renderIndex
  } = useTemplateListPageData({
    rows: archiveRows,
    resetOn: [selectedTypeId, filterRevision],
    urlSync: true
  });

  const loadTypes = useCallback(async (preferredTypeId?: string) => {
    setLoadingTypes(true);
    try {
      const result = await getArchiveTypes({ pageSize: 1000 });
      setTypeList(result.list);
      setSelectedTypeId((current) => {
        if (preferredTypeId && result.list.some((item) => item.id === preferredTypeId)) return preferredTypeId;
        if (current && result.list.some((item) => item.id === current)) return current;
        return result.list.find((item) => item.status === 'enabled')?.id || result.list[0]?.id;
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取档案类型失败');
    } finally {
      setLoadingTypes(false);
    }
  }, [message]);

  const loadArchives = useCallback(async (archiveTypeId?: string, filters = archiveFiltersRef.current) => {
    if (!archiveTypeId) {
      setArchiveRows([]);
      return;
    }

    setLoadingArchives(true);
    try {
      const result = await getArchives({
        pageSize: 10000,
        archiveTypeId,
        code: filters.code || undefined,
        name: filters.name || undefined,
        status: filters.status
      });
      setArchiveRows([...result.list].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取档案列表失败');
    } finally {
      setLoadingArchives(false);
    }
  }, [message]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    void loadArchives(selectedTypeId);
  }, [loadArchives, selectedTypeId]);

  const handleSearchArchives = () => {
    setFilterRevision((value) => value + 1);
    void loadArchives(selectedTypeId);
  };

  const handleResetArchives = () => {
    const resetFilters = { code: '', name: '', status: undefined };
    setArchiveFilters(resetFilters);
    setFilterRevision((value) => value + 1);
    void loadArchives(selectedTypeId, resetFilters);
  };

  const openTypeModal = (record?: ArchiveTypeRecord) => {
    setEditingType(record);
    typeForm.setFieldsValue(record ? { name: record.name, codePrefix: record.codePrefix } : { name: '', codePrefix: '' });
    setTypeModalOpen(true);
  };

  const openArchiveModal = (record?: ArchiveRecord) => {
    setEditingArchive(record);
    archiveForm.setFieldsValue(record
      ? { archiveTypeId: record.archiveTypeId, name: record.name }
      : { archiveTypeId: selectedTypeId || '', name: '' });
    setArchiveModalOpen(true);
  };

  const handleTypeSubmit = async (values: TypeFormValue) => {
    setTypeSubmitting(true);
    try {
      if (editingType) {
        await updateArchiveType(editingType.id, { name: values.name });
        message.success('保存成功');
        await loadTypes(editingType.id);
      } else {
        const result = await createArchiveType({
          name: values.name,
          codePrefix: values.codePrefix || ''
        });
        message.success(`创建成功，编码：${result.code}`);
        await loadTypes(String(result.id));
      }
      setTypeModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setTypeSubmitting(false);
    }
  };

  const handleArchiveSubmit = async (values: ArchiveFormValue) => {
    setArchiveSubmitting(true);
    try {
      if (editingArchive) {
        await updateArchive(editingArchive.id, {
          name: values.name,
          sortOrder: editingArchive.sortOrder
        });
        message.success('保存成功');
      } else {
        const result = await createArchive({
          archiveTypeId: values.archiveTypeId,
          name: values.name
        });
        message.success(`创建成功，编码：${result.code}`);
      }
      setArchiveModalOpen(false);
      await loadArchives(selectedTypeId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const handleTypeStatusChange = async (record: ArchiveTypeRecord) => {
    const nextStatus = record.status === 'enabled' ? 'disabled' : 'enabled';
    await toggleArchiveTypeStatus(record.id, { status: nextStatus });
    message.success(nextStatus === 'enabled' ? '启用成功' : '停用成功');
    await loadTypes(record.id);
  };

  const handleArchiveStatusChange = async (record: ArchiveRecord) => {
    const nextStatus = record.status === 'enabled' ? 'disabled' : 'enabled';
    await toggleArchiveStatus(record.id, { status: nextStatus });
    message.success(nextStatus === 'enabled' ? '启用成功' : '停用成功');
    await loadArchives(selectedTypeId);
  };

  const handleDeleteType = async (record: ArchiveTypeRecord) => {
    await deleteArchiveType(record.id);
    message.success('删除成功');
    const fallback = typeList.find((item) => item.id !== record.id)?.id;
    await loadTypes(fallback);
  };

  const handleDeleteArchive = async (record: ArchiveRecord) => {
    await deleteArchive(record.id);
    message.success('删除成功');
    await loadArchives(selectedTypeId);
  };

  const saveSort = async (rows: ArchiveRecord[]) => {
    const sortedRows = rows.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setArchiveRows(sortedRows);
    await batchUpdateArchiveSort(
      sortedRows.map((item) => ({ id: item.id, sortOrder: item.sortOrder }))
    );
    message.success('排序已更新');
  };

  const handleDropArchive = async (targetRecord: ArchiveRecord) => {
    if (!draggingId || draggingId === targetRecord.id) return;

    const fromIndex = archiveRows.findIndex((item) => item.id === draggingId);
    const toIndex = archiveRows.findIndex((item) => item.id === targetRecord.id);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextRows = [...archiveRows];
    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);
    setDraggingId(undefined);

    try {
      await saveSort(nextRows);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '排序更新失败');
      await loadArchives(selectedTypeId);
    }
  };

  return (
    <PageShell
      compact
      title="基础档案"
    >
      <AdminSplitPane
        ariaLabel="调整档案类型区域宽度"
        className="archive-page"
        defaultLeftWidth={MIN_ARCHIVE_SIDEBAR_WIDTH}
        left={(
          <ArchiveTypeSidebar
            items={filteredTypeList}
            keyword={typeKeyword}
            selectedId={selectedTypeId}
            onKeywordChange={setTypeKeyword}
            onSelect={setSelectedTypeId}
            onCreate={() => openTypeModal()}
            onEdit={openTypeModal}
            onToggleStatus={handleTypeStatusChange}
            onDelete={handleDeleteType}
          />
        )}
        maxLeftWidth={MAX_ARCHIVE_SIDEBAR_WIDTH}
        minLeftWidth={MIN_ARCHIVE_SIDEBAR_WIDTH}
        minRightWidth={420}
        right={(
          <section className="archive-page__main">
          <div className="archive-page__main-header">
            <div className="archive-page__main-title">
              <AdminText strong>{selectedType ? selectedType.name : '档案明细'}</AdminText>
              {selectedType ? (
                <span className="archive-page__main-prefix">编码前缀：{selectedType.codePrefix}</span>
              ) : (
                <span className="archive-page__main-prefix">请先选择或新增档案类型</span>
              )}
            </div>
            <AdminButton
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedType || selectedType.status === 'disabled'}
              onClick={() => openArchiveModal()}
            >
              新增档案
            </AdminButton>
          </div>

          {selectedType ? (
            <ArchiveRecordTable
              rows={pagedArchiveRows}
              filter={(
                <ArchiveRecordFilter
                  filters={archiveFilters}
                  onChange={setArchiveFilters}
                  onSearch={handleSearchArchives}
                  onReset={handleResetArchives}
                />
              )}
              pagination={pagination}
              renderIndex={renderIndex}
              loading={loadingArchives}
              onEdit={openArchiveModal}
              onToggleStatus={handleArchiveStatusChange}
              onDelete={handleDeleteArchive}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(undefined)}
              onDrop={handleDropArchive}
            />
          ) : (
            <div className="archive-page__empty">
              <AdminEmptyState description="请先新增档案类型" />
            </div>
          )}
          </section>
        )}
        storageKey="archive-type-list"
      />

      <ArchiveTypeModal
        form={typeForm}
        open={typeModalOpen}
        editingType={editingType}
        submitting={typeSubmitting}
        onCancel={() => setTypeModalOpen(false)}
        onSubmit={handleTypeSubmit}
      />

      <ArchiveRecordModal
        form={archiveForm}
        open={archiveModalOpen}
        editingArchive={editingArchive}
        submitting={archiveSubmitting}
        typeOptions={enabledTypeOptions}
        onCancel={() => setArchiveModalOpen(false)}
        onSubmit={handleArchiveSubmit}
      />
    </PageShell>
  );
}

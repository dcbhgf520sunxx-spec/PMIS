import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Typography } from 'antd';
import { AdminEmptyState, PageShell } from '../../../components/admin';
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
import { useAuthStore } from '../../../stores/authStore';
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
  const currentUserId = useAuthStore((state) => state.user?.id) || 1;
  const [typeForm] = Form.useForm<TypeFormValue>();
  const [archiveForm] = Form.useForm<ArchiveFormValue>();

  const [typeList, setTypeList] = useState<ArchiveTypeRecord[]>([]);
  const [archiveRows, setArchiveRows] = useState<ArchiveRecord[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>();
  const [typeKeyword, setTypeKeyword] = useState('');
  const [archiveFilters, setArchiveFilters] = useState<ArchiveRecordFilters>({ code: '', name: '', status: undefined });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [, setLoadingTypes] = useState(false);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ArchiveTypeRecord>();
  const [editingArchive, setEditingArchive] = useState<ArchiveRecord>();
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [draggingId, setDraggingId] = useState<string>();
  const [sidebarWidth, setSidebarWidth] = useState(MIN_ARCHIVE_SIDEBAR_WIDTH);

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

  const pagedArchiveRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return archiveRows.slice(start, start + pageSize);
  }, [archiveRows, page, pageSize]);

  const loadTypes = async (preferredTypeId?: string) => {
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
  };

  const loadArchives = async (archiveTypeId?: string) => {
    if (!archiveTypeId) {
      setArchiveRows([]);
      return;
    }

    setLoadingArchives(true);
    try {
      const result = await getArchives({
        pageSize: 10000,
        archiveTypeId,
        code: archiveFilters.code || undefined,
        name: archiveFilters.name || undefined,
        status: archiveFilters.status
      });
      setArchiveRows([...result.list].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取档案列表失败');
    } finally {
      setLoadingArchives(false);
    }
  };

  useEffect(() => {
    void loadTypes();
  }, []);

  useEffect(() => {
    setPage(1);
    void loadArchives(selectedTypeId);
  }, [selectedTypeId]);

  const handleSearchArchives = () => {
    setPage(1);
    void loadArchives(selectedTypeId);
  };

  const handleResetArchives = () => {
    setArchiveFilters({ code: '', name: '', status: undefined });
    setPage(1);
    setTimeout(() => void loadArchives(selectedTypeId));
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
        await updateArchiveType(editingType.id, { name: values.name, updaterId: currentUserId });
        message.success('保存成功');
        await loadTypes(editingType.id);
      } else {
        const result = await createArchiveType({
          name: values.name,
          codePrefix: values.codePrefix || '',
          creatorId: currentUserId
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
          sortOrder: editingArchive.sortOrder,
          updaterId: currentUserId
        });
        message.success('保存成功');
      } else {
        const result = await createArchive({
          archiveTypeId: values.archiveTypeId,
          name: values.name,
          creatorId: currentUserId
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
    await toggleArchiveTypeStatus(record.id, { status: nextStatus, updaterId: currentUserId });
    message.success(nextStatus === 'enabled' ? '启用成功' : '停用成功');
    await loadTypes(record.id);
  };

  const handleArchiveStatusChange = async (record: ArchiveRecord) => {
    const nextStatus = record.status === 'enabled' ? 'disabled' : 'enabled';
    await toggleArchiveStatus(record.id, { status: nextStatus, updaterId: currentUserId });
    message.success(nextStatus === 'enabled' ? '启用成功' : '停用成功');
    await loadArchives(selectedTypeId);
  };

  const handleDeleteType = async (record: ArchiveTypeRecord) => {
    await deleteArchiveType(record.id, currentUserId);
    message.success('删除成功');
    const fallback = typeList.find((item) => item.id !== record.id)?.id;
    await loadTypes(fallback);
  };

  const handleDeleteArchive = async (record: ArchiveRecord) => {
    await deleteArchive(record.id, currentUserId);
    message.success('删除成功');
    await loadArchives(selectedTypeId);
  };

  const saveSort = async (rows: ArchiveRecord[]) => {
    const sortedRows = rows.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setArchiveRows(sortedRows);
    await batchUpdateArchiveSort(
      sortedRows.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
      currentUserId
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

  const handleSidebarResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = event.currentTarget.closest('.archive-page');
    if (!(container instanceof HTMLElement)) return;

    const containerLeft = container.getBoundingClientRect().left;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: WindowEventMap['pointermove']) => {
      const nextWidth = moveEvent.clientX - containerLeft;
      setSidebarWidth(Math.min(Math.max(nextWidth, MIN_ARCHIVE_SIDEBAR_WIDTH), MAX_ARCHIVE_SIDEBAR_WIDTH));
    };

    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <PageShell
      compact
      title="基础档案"
    >
      <div
        className="archive-page"
        style={{ gridTemplateColumns: `${sidebarWidth}px 8px minmax(0, 1fr)` }}
      >
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

        <div
          className="archive-page__resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整档案类型区域宽度"
          onPointerDown={handleSidebarResizeStart}
        />

        <section className="archive-page__main">
          <div className="archive-page__main-header">
            <div className="archive-page__main-title">
              <Typography.Text strong>{selectedType ? selectedType.name : '档案明细'}</Typography.Text>
              {selectedType ? (
                <span className="archive-page__main-prefix">编码前缀：{selectedType.codePrefix}</span>
              ) : (
                <span className="archive-page__main-prefix">请先选择或新增档案类型</span>
              )}
            </div>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedType || selectedType.status === 'disabled'}
              onClick={() => openArchiveModal()}
            >
              新增档案
            </Button>
          </div>

          <ArchiveRecordFilter
            filters={archiveFilters}
            onChange={setArchiveFilters}
            onSearch={handleSearchArchives}
            onReset={handleResetArchives}
          />

          {selectedType ? (
            <ArchiveRecordTable
              rows={archiveRows}
              pagedRows={pagedArchiveRows}
              page={page}
              pageSize={pageSize}
              loading={loadingArchives}
              onPageChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
              onPageSizeChange={(nextPageSize) => {
                setPage(1);
                setPageSize(nextPageSize);
              }}
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
      </div>

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

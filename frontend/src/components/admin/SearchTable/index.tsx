import type { ProColumns, ProTableProps } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { SettingOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import './index.css';

export type SearchTableProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = ProTableProps<T, P> & {
  columns: ProColumns<T>[];
};

type ResizeHeaderCellProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  width?: number;
  columnKey?: string;
  onColumnResize?: (width: number) => void;
};

let activeResizeCleanup: (() => void) | null = null;
let suppressHeaderClickUntil = 0;

type TableDensitySize = 'large' | 'middle' | 'small';

function readTableJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeTableJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ResizeHeaderCell({
  width,
  columnKey,
  onColumnResize,
  children,
  ...restProps
}: ResizeHeaderCellProps) {
  const handleHeaderClickCapture: React.MouseEventHandler<HTMLTableCellElement> = (event) => {
    if (Date.now() < suppressHeaderClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    restProps.onClickCapture?.(event);
  };

  const stopResizeHandleEvent: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMouseDown: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    if (!width || !columnKey || !onColumnResize) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = width;
    let hasDragged = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const offsetX = moveEvent.clientX - startX;
      if (Math.abs(offsetX) > 2) hasDragged = true;
      const nextWidth = Math.max(56, startWidth + offsetX);
      onColumnResize(nextWidth);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', cleanup);
      document.body.classList.remove('admin-table-resizing');
      if (hasDragged) {
        suppressHeaderClickUntil = Date.now() + 160;
      }
      activeResizeCleanup = null;
    };

    activeResizeCleanup?.();
    activeResizeCleanup = cleanup;
    document.body.classList.add('admin-table-resizing');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', cleanup);
  };

  return (
    <th {...restProps} onClickCapture={handleHeaderClickCapture}>
      {children}
      {width && onColumnResize ? (
        <span
          className="admin-table-resize-handle"
          onClick={stopResizeHandleEvent}
          onDoubleClick={stopResizeHandleEvent}
          onMouseDown={handleMouseDown}
        />
      ) : null}
    </th>
  );
}

function getColumnKey<T extends Record<string, unknown>>(column: ProColumns<T>, index: number) {
  if (column.key) return String(column.key);
  if (Array.isArray(column.dataIndex)) return column.dataIndex.join('.');
  if (column.dataIndex) return String(column.dataIndex);
  return `column-${index}`;
}

export function SearchTable<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
>(props: SearchTableProps<T, P>) {
  const { className, columns, components, locale, pagination, ...restProps } = props;
  const location = useLocation();
  const userId = useAuthStore((state) => state.user?.id);
  const tablePreferenceKey = useMemo(
    () => `admin-table:${userId || 'anonymous'}:${location.pathname}`,
    [location.pathname, userId]
  );
  const columnWidthsKey = `${tablePreferenceKey}:column-widths`;
  const tableSizeKey = `${tablePreferenceKey}:density`;
  const columnsStateKey = `${tablePreferenceKey}:columns-state`;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => readTableJson(columnWidthsKey, {}));
  const [tableSize, setTableSize] = useState<TableDensitySize>(() => readTableJson(tableSizeKey, 'small'));
  const hasCustomColumnWidths = Object.keys(columnWidths).length > 0;
  const paginationConfig = typeof pagination === 'object' ? pagination : {};
  const scrollX = typeof restProps.scroll === 'object' && typeof restProps.scroll?.x === 'number'
    ? restProps.scroll.x
    : undefined;
  const mergedPagination = pagination === false ? false : {
    defaultPageSize: 20,
    showSizeChanger: true,
    size: 'small' as const,
    locale: { items_per_page: '条/页' },
    hideOnSinglePage: false,
    showTotal: (total: number, range: [number, number]) => `第 ${total === 0 ? 0 : range[0]}-${total === 0 ? 0 : range[1]} 条/总共 ${total} 条`,
    ...paginationConfig
  };

  useEffect(() => () => {
    activeResizeCleanup?.();
  }, []);

  useEffect(() => {
    setColumnWidths(readTableJson(columnWidthsKey, {}));
    setTableSize(readTableJson(tableSizeKey, 'small'));
  }, [columnWidthsKey, tableSizeKey]);

  const handleColumnWidthsChange = (nextWidths: Record<string, number>) => {
    setColumnWidths(nextWidths);
    writeTableJson(columnWidthsKey, nextWidths);
  };

  const handleTableSizeChange = (nextSize?: TableDensitySize) => {
    if (!nextSize) return;
    setTableSize(nextSize);
    writeTableJson(tableSizeKey, nextSize);
  };

  const resizableColumns = useMemo<ProColumns<T>[]>(() => columns.map((column, index) => {
    const columnKey = getColumnKey(column, index);
    const rawWidth = columnWidths[columnKey] ?? column.width;
    const width = typeof rawWidth === 'number' ? rawWidth : Number(rawWidth);
    const canLockWidth = Number.isFinite(width) && !column.hideInTable && column.valueType === 'option';
    const canResize = Number.isFinite(width)
      && !column.hideInTable
      && column.valueType !== 'index'
      && column.valueType !== 'option';

    if (canLockWidth) {
      return {
        ...column,
        width,
        onHeaderCell: (currentColumn: unknown) => ({
          ...(typeof column.onHeaderCell === 'function' ? column.onHeaderCell(currentColumn as never) : {}),
          style: {
            width,
            minWidth: width,
            maxWidth: width
          }
        }),
        onCell: (record: T, rowIndex?: number) => ({
          ...(typeof column.onCell === 'function' ? column.onCell(record, rowIndex) : {}),
          style: {
            width,
            minWidth: width,
            maxWidth: width
          }
        })
      } as ProColumns<T>;
    }

    if (!canResize) return column;

    return {
      ...column,
      width,
      onHeaderCell: (currentColumn: unknown) => ({
        ...(typeof column.onHeaderCell === 'function' ? column.onHeaderCell(currentColumn as never) : {}),
        width,
        columnKey,
        onColumnResize: (nextWidth: number) => {
          setColumnWidths((prev) => {
            const nextWidths = { ...prev, [columnKey]: nextWidth };
            writeTableJson(columnWidthsKey, nextWidths);
            return nextWidths;
          });
        }
      })
    } as ProColumns<T>;
  }), [columnWidths, columnWidthsKey, columns]);

  const adjustedColumns = useMemo<ProColumns<T>[]>(() => {
    if (!scrollX) return resizableColumns;

    const visibleColumns = resizableColumns.filter((column) => !column.hideInTable);
    const totalWidth = visibleColumns.reduce((sum, column) => {
      const width = typeof column.width === 'number' ? column.width : Number(column.width);
      return Number.isFinite(width) ? sum + width : sum;
    }, 0);
    const extraWidth = scrollX - totalWidth;

    if (extraWidth <= 0) return resizableColumns;

    const targetIndex = [...resizableColumns]
      .map((column, index) => ({ column, index }))
      .reverse()
      .find(({ column }) => {
        const width = typeof column.width === 'number' ? column.width : Number(column.width);
        return Number.isFinite(width)
          && !column.hideInTable
          && column.valueType !== 'index'
          && column.valueType !== 'option'
          && !column.fixed;
      })?.index;

    if (targetIndex === undefined) return resizableColumns;

    return resizableColumns.map((column, index) => {
      if (index !== targetIndex) return column;

      const currentWidth = typeof column.width === 'number' ? column.width : Number(column.width);
      const width = currentWidth + extraWidth;

      return {
        ...column,
        width,
        onHeaderCell: (currentColumn: unknown) => ({
          ...(typeof column.onHeaderCell === 'function' ? column.onHeaderCell(currentColumn as never) : {}),
          width
        })
      } as ProColumns<T>;
    });
  }, [resizableColumns, scrollX]);

  return (
    <ProTable<T, P>
      rowKey="id"
      className={['admin-search-table', className].filter(Boolean).join(' ')}
      columns={adjustedColumns}
      search={{ labelWidth: 88, defaultCollapsed: true }}
      options={{ density: true, fullScreen: true, reload: false, setting: true }}
      optionsRender={(_, defaultDoms) => [
        <Popover
          key="table-settings"
          trigger="click"
          placement="bottomRight"
          content={(
            <Space size={10} className="admin-table-settings-popover">
              <Tooltip title="重置列宽">
                <Button
                  aria-label="重置列宽"
                  className="admin-table-settings-popover__reset"
                  disabled={!hasCustomColumnWidths}
                  icon={<UndoOutlined />}
                  size="small"
                  type="text"
                  onClick={() => handleColumnWidthsChange({})}
                />
              </Tooltip>
              {defaultDoms.map((item, index) => (
                <span className="admin-table-settings-popover__item" key={index}>
                  {item}
                </span>
              ))}
            </Space>
          )}
        >
          <Button aria-label="表格设置" className="admin-table-settings-trigger" icon={<SettingOutlined />} type="text" />
        </Popover>
      ]}
      locale={{ emptyText: '暂无数据', ...locale }}
      pagination={mergedPagination}
      columnsState={{
        persistenceKey: columnsStateKey,
        persistenceType: 'localStorage'
      }}
      defaultSize={tableSize}
      onSizeChange={handleTableSizeChange}
      components={{
        ...components,
        header: {
          ...components?.header,
          cell: ResizeHeaderCell
        }
      }}
      {...restProps}
    />
  );
}

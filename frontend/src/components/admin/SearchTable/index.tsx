import type { ProColumns, ProTableProps } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { SettingOutlined, UndoOutlined } from '@ant-design/icons';
import { Popover, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { AdminIconAction } from '../AdminIconAction';
import './index.css';
import { enforceFixedColumnState, type ColumnStateEntry } from './columnState';

export type SearchTableProps<
  T extends Record<string, unknown>,
  P extends Record<string, unknown> = Record<string, unknown>
> = ProTableProps<T, P> & {
  columns: ProColumns<T>[];
  preferenceKey?: string;
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
  const [isResizing, setIsResizing] = useState(false);

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
      setIsResizing(false);
      if (hasDragged) {
        suppressHeaderClickUntil = Date.now() + 160;
      }
      activeResizeCleanup = null;
    };

    activeResizeCleanup?.();
    activeResizeCleanup = cleanup;
    setIsResizing(true);
    document.body.classList.add('admin-table-resizing');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', cleanup);
  };

  return (
    <th {...restProps} onClickCapture={handleHeaderClickCapture}>
      {children}
      {width && onColumnResize ? (
        <span
          className={isResizing ? 'admin-table-resize-handle is-resizing' : 'admin-table-resize-handle'}
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
  const { className, columns, components, locale, pagination, preferenceKey, ...restProps } = props;
  const location = useLocation();
  const userId = useAuthStore((state) => state.user?.id);
  const tablePreferenceKey = useMemo(
    () => `admin-table:${userId || 'anonymous'}:${preferenceKey || location.pathname}`,
    [location.pathname, preferenceKey, userId]
  );
  const columnWidthsKey = `${tablePreferenceKey}:column-widths`;
  const tableSizeKey = `${tablePreferenceKey}:density`;
  const columnsStateKey = `${tablePreferenceKey}:columns-state`;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => readTableJson(columnWidthsKey, {}));
  const [tableSize, setTableSize] = useState<TableDensitySize>(() => readTableJson(tableSizeKey, 'small'));
  const fixedColumnsSignature = columns.map((column, index) => `${getColumnKey(column, index)}:${column.fixed || ''}`).join('|');
  const fixedColumns = useMemo(() => columns.map((column, index) => ({
    key: getColumnKey(column, index),
    fixed: column.fixed
  })), [fixedColumnsSignature]);
  const [columnState, setColumnState] = useState<Record<string, ColumnStateEntry>>(() => enforceFixedColumnState(
    fixedColumns,
    readTableJson(columnsStateKey, {})
  ));
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
    setColumnState(enforceFixedColumnState(fixedColumns, readTableJson(columnsStateKey, {})));
  }, [columnWidthsKey, columnsStateKey, fixedColumns, tableSizeKey]);

  const handleColumnStateChange = (nextState: Record<string, ColumnStateEntry>) => {
    const enforcedState = enforceFixedColumnState(fixedColumns, nextState);
    setColumnState(enforcedState);
    writeTableJson(columnsStateKey, enforcedState);
  };

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
      && column.title !== '序号'
      && column.valueType !== 'index'
      && column.valueType !== 'option';

    if (canLockWidth) {
      return {
        ...column,
        key: columnKey,
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

    if (!canResize) return { ...column, key: columnKey };

    return {
      ...column,
      key: columnKey,
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
          && column.title !== '序号'
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
              <AdminIconAction
                className="admin-table-settings-popover__reset"
                disabled={!hasCustomColumnWidths}
                icon={<UndoOutlined />}
                label="重置列宽"
                onClick={() => handleColumnWidthsChange({})}
              />
              {defaultDoms.map((item, index) => (
                <span className="admin-table-settings-popover__item" key={index}>
                  {item}
                </span>
              ))}
            </Space>
          )}
        >
          <AdminIconAction
            className="admin-table-settings-trigger"
            icon={<SettingOutlined />}
            label="表格设置"
          />
        </Popover>
      ]}
      locale={{ emptyText: '暂无数据', ...locale }}
      pagination={mergedPagination}
      columnsState={{
        value: columnState,
        onChange: handleColumnStateChange
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

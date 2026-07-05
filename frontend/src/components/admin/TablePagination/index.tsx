import type { PaginationProps, SelectProps } from 'antd';
import { Pagination } from 'antd';
import './index.css';

type TablePaginationProps = Omit<
  PaginationProps,
  'hideOnSinglePage' | 'locale' | 'showSizeChanger' | 'showTotal' | 'size'
> & {
  getPopupContainer?: SelectProps['getPopupContainer'];
};

function defaultPopupContainer(triggerNode: HTMLElement) {
  if (typeof document === 'undefined') return triggerNode;
  return document.fullscreenElement instanceof HTMLElement
    ? document.fullscreenElement
    : document.body;
}

export function TablePagination({
  className,
  current = 1,
  getPopupContainer = defaultPopupContainer,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  total = 0,
  ...props
}: TablePaginationProps) {
  return (
    <Pagination
      {...props}
      className={['admin-table-pagination', className].filter(Boolean).join(' ')}
      current={total === 0 ? 1 : current}
      hideOnSinglePage={false}
      locale={{ items_per_page: '条/页' }}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      showLessItems
      showSizeChanger={{
        placement: 'topLeft',
        getPopupContainer,
        showSearch: false
      }}
      showTotal={(value, range) => (
        `第 ${value === 0 ? 0 : range[0]}-${value === 0 ? 0 : range[1]} 条/总共 ${value} 条`
      )}
      size="small"
      total={total}
    />
  );
}

import { Tag } from 'antd';
import './index.css';

export function OverdueTag({ overdueDays }: { overdueDays?: number }) {
  if (!overdueDays || overdueDays <= 0) {
    return <Tag className="admin-overdue-tag admin-overdue-tag--normal">未逾期</Tag>;
  }

  return <Tag className="admin-overdue-tag admin-overdue-tag--overdue">逾期 {overdueDays} 天</Tag>;
}

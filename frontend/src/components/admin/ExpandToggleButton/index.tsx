import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import './index.css';

type ExpandToggleButtonProps = Omit<ButtonProps, 'children' | 'icon' | 'size' | 'type'> & {
  expanded: boolean;
  expandLabel?: string;
  collapseLabel?: string;
};

export function ExpandToggleButton({
  expanded,
  expandLabel = '展开',
  collapseLabel = '收起',
  className,
  ...props
}: ExpandToggleButtonProps) {
  const label = expanded ? collapseLabel : expandLabel;

  return (
    <Button
      {...props}
      aria-label={label}
      className={['admin-expand-toggle-button', className].filter(Boolean).join(' ')}
      icon={expanded ? <MinusOutlined /> : <PlusOutlined />}
      size="small"
      type="text"
    />
  );
}

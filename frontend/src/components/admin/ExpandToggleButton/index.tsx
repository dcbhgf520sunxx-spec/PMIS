import {
  MinusOutlined,
  MinusSquareOutlined,
  PlusOutlined,
  PlusSquareOutlined
} from '@ant-design/icons';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import './index.css';

type ExpandToggleButtonProps = Omit<ButtonProps, 'children' | 'icon' | 'size' | 'type' | 'variant'> & {
  expanded: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  variant?: 'plain' | 'square';
};

export function ExpandToggleButton({
  expanded,
  expandLabel = '展开',
  collapseLabel = '收起',
  variant = 'plain',
  className,
  ...props
}: ExpandToggleButtonProps) {
  const label = expanded ? collapseLabel : expandLabel;
  const icon = variant === 'square'
    ? (expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />)
    : (expanded ? <MinusOutlined /> : <PlusOutlined />);

  return (
    <Button
      {...props}
      aria-label={label}
      className={[
        'admin-expand-toggle-button',
        variant === 'square' ? 'is-square' : '',
        className
      ].filter(Boolean).join(' ')}
      icon={icon}
      size="small"
      title={label}
      type="text"
    />
  );
}

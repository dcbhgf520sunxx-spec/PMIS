import type { ComponentProps } from 'react';
import { Modal } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './index.css';

type ModalProps = ComponentProps<typeof Modal>;

const modalWidthMap = {
  small: 460,
  medium: 560,
  large: 720
} as const;

type AdminModalProps = Omit<ModalProps, 'width'> & {
  size?: keyof typeof modalWidthMap;
  width?: ModalProps['width'];
};

export function AdminModal({
  className,
  centered = true,
  okText = '确认',
  cancelText = '取消',
  size = 'medium',
  width,
  title,
  ...props
}: AdminModalProps) {
  const mergedClassName = className ? `admin-modal ${className}` : 'admin-modal';
  const mergedTitle = typeof title === 'string'
    ? (
      <span className="admin-modal__title">
        <InfoCircleOutlined />
        <span>{title}</span>
      </span>
    )
    : title;

  return (
    <Modal
      {...props}
      title={mergedTitle}
      centered={centered}
      className={mergedClassName}
      okText={okText}
      cancelText={cancelText}
      width={width ?? modalWidthMap[size]}
    />
  );
}

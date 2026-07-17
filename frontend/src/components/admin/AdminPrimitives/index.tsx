import { forwardRef } from 'react';
import type { ComponentProps, ComponentRef } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  ColorPicker,
  Form,
  List,
  Popover,
  Progress,
  Radio,
  Rate,
  Segmented,
  Slider,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Transfer,
  Tree,
  Typography,
  Upload
} from 'antd';
import './index.css';

type AdminButtonProps = ComponentProps<typeof Button> & {
  adminVariant?: 'subtle';
};

export const AdminButton = forwardRef<ComponentRef<typeof Button>, AdminButtonProps>(function AdminButton(
  { adminVariant, className, ...props },
  ref
) {
  return <Button ref={ref} {...props} className={['admin-button', adminVariant ? `is-${adminVariant}` : '', className].filter(Boolean).join(' ')} />;
});

export function AdminCard({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card {...props} className={['admin-card', className].filter(Boolean).join(' ')} />;
}

export function AdminParagraph(props: ComponentProps<typeof Typography.Paragraph>) {
  return <Typography.Paragraph {...props} />;
}

export function AdminText(props: ComponentProps<typeof Typography.Text>) {
  return <Typography.Text {...props} />;
}

export function AdminFormItem(props: ComponentProps<typeof Form.Item>) {
  return <Form.Item {...props} />;
}

export function AdminSpace(props: ComponentProps<typeof Space>) {
  return <Space {...props} />;
}

export function AdminRadioGroup(props: ComponentProps<typeof Radio.Group>) {
  return <Radio.Group {...props} />;
}

export function AdminRadio(props: ComponentProps<typeof Radio>) {
  return <Radio {...props} />;
}

export function AdminRadioButton(props: ComponentProps<typeof Radio.Button>) {
  return <Radio.Button {...props} />;
}

export function AdminCheckbox(props: ComponentProps<typeof Checkbox>) {
  return <Checkbox {...props} />;
}

export function AdminCheckboxGroup(props: ComponentProps<typeof Checkbox.Group>) {
  return <Checkbox.Group {...props} />;
}

export function AdminSwitch({ className, ...props }: ComponentProps<typeof Switch>) {
  return <Switch {...props} className={['admin-switch', className].filter(Boolean).join(' ')} />;
}

export function AdminSlider(props: ComponentProps<typeof Slider>) {
  return <Slider {...props} />;
}

export function AdminRate(props: ComponentProps<typeof Rate>) {
  return <Rate {...props} />;
}

export function AdminUpload(props: ComponentProps<typeof Upload>) {
  return <Upload {...props} />;
}

export function AdminUploadDragger(props: ComponentProps<typeof Upload.Dragger>) {
  return <Upload.Dragger {...props} />;
}

export function AdminColorPicker({ className, ...props }: ComponentProps<typeof ColorPicker>) {
  return <ColorPicker {...props} className={['admin-color-picker', className].filter(Boolean).join(' ')} />;
}

export function AdminTransfer(props: ComponentProps<typeof Transfer>) {
  return <Transfer {...props} />;
}

export function AdminProgress(props: ComponentProps<typeof Progress>) {
  return <Progress {...props} />;
}

export function AdminSpin(props: ComponentProps<typeof Spin>) {
  return <Spin {...props} />;
}

export function AdminAlert(props: ComponentProps<typeof Alert>) {
  return <Alert {...props} />;
}

export function AdminTree(props: ComponentProps<typeof Tree>) {
  return <Tree {...props} />;
}

export function AdminPopover(props: ComponentProps<typeof Popover>) {
  return <Popover {...props} />;
}

export function AdminTag(props: ComponentProps<typeof Tag>) {
  return <Tag {...props} />;
}

export function AdminBadge(props: ComponentProps<typeof Badge>) {
  return <Badge {...props} />;
}

export function AdminAvatar(props: ComponentProps<typeof Avatar>) {
  return <Avatar {...props} />;
}

export function AdminAvatarGroup(props: ComponentProps<typeof Avatar.Group>) {
  return <Avatar.Group {...props} />;
}

export function AdminStatistic(props: ComponentProps<typeof Statistic>) {
  return <Statistic {...props} />;
}

export function AdminCollapse(props: ComponentProps<typeof Collapse>) {
  return <Collapse {...props} />;
}

export function AdminList<T = unknown>(props: ComponentProps<typeof List<T>>) {
  return <List<T> {...props} />;
}

export function AdminListItem(props: ComponentProps<typeof List.Item>) {
  return <List.Item {...props} />;
}

export function AdminListItemMeta(props: ComponentProps<typeof List.Item.Meta>) {
  return <List.Item.Meta {...props} />;
}

type AdminSegmentedProps<T extends string | number = string> = ComponentProps<typeof Segmented<T>> & {
  adminVariant?: 'filter';
};

export function AdminSegmented<T extends string | number = string>({
  adminVariant,
  className,
  ...props
}: AdminSegmentedProps<T>) {
  return <Segmented<T> {...props} className={['admin-segmented', adminVariant ? `is-${adminVariant}` : '', className].filter(Boolean).join(' ')} />;
}

import { AutoComplete, DatePicker, Input, InputNumber, TimePicker } from 'antd';
import type { ComponentProps } from 'react';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import './index.css';

export function AdminInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={['admin-input', className].filter(Boolean).join(' ')}
    />
  );
}

export function AdminTextArea({ className, ...props }: ComponentProps<typeof Input.TextArea>) {
  return (
    <Input.TextArea
      {...props}
      className={['admin-input', 'admin-textarea', className].filter(Boolean).join(' ')}
    />
  );
}

export function AdminPasswordInput({ className, ...props }: ComponentProps<typeof Input.Password>) {
  return (
    <Input.Password
      {...props}
      className={['admin-input', className].filter(Boolean).join(' ')}
    />
  );
}

export function AdminAutoComplete({ className, ...props }: ComponentProps<typeof AutoComplete>) {
  return (
    <AutoComplete
      {...props}
      className={['admin-input', 'admin-auto-complete', className].filter(Boolean).join(' ')}
      notFoundContent={props.notFoundContent ?? '暂无数据'}
    />
  );
}

export function AdminNumberInput({ className, style, ...props }: ComponentProps<typeof InputNumber>) {
  return (
    <InputNumber
      {...props}
      className={['admin-input', 'admin-number-input', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
    />
  );
}

export function AdminDatePicker({ className, locale, style, ...props }: ComponentProps<typeof DatePicker>) {
  return (
    <DatePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
    />
  );
}

export function AdminTimePicker({ className, locale, style, ...props }: ComponentProps<typeof TimePicker>) {
  return (
    <TimePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', 'admin-time-picker', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
    />
  );
}

export function AdminRangePicker({ className, locale, style, ...props }: ComponentProps<typeof DatePicker.RangePicker>) {
  return (
    <DatePicker.RangePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', 'admin-range-picker', className].filter(Boolean).join(' ')}
      style={{ width: '100%', ...style }}
    />
  );
}

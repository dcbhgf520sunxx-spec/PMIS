import { AutoComplete, DatePicker, Input, InputNumber, TimePicker } from 'antd';
import type { ComponentProps } from 'react';
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN';
import './index.css';

const defaultPopupContainer = () => document.body;
const adaptivePickerOverflow = { adjustX: 1, adjustY: 1, shiftX: true, shiftY: true } as const;
const adaptivePickerPlacements: NonNullable<ComponentProps<typeof DatePicker>['builtinPlacements']> = {
  bottomLeft: { points: ['tl', 'bl'], offset: [0, 0], overflow: adaptivePickerOverflow },
  bottomRight: { points: ['tr', 'br'], offset: [0, 0], overflow: adaptivePickerOverflow },
  topLeft: { points: ['bl', 'tl'], offset: [0, 0], overflow: adaptivePickerOverflow },
  topRight: { points: ['br', 'tr'], offset: [0, 0], overflow: adaptivePickerOverflow }
};

function mergePickerClassNames<T extends { popup?: { root?: string } }>(classNames?: T): T {
  return {
    ...classNames,
    popup: {
      ...classNames?.popup,
      root: ['admin-date-picker-popup', classNames?.popup?.root].filter(Boolean).join(' ')
    }
  } as T;
}

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

export function AdminDatePicker({ className, classNames, getPopupContainer, locale, style, ...props }: ComponentProps<typeof DatePicker>) {
  return (
    <DatePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', className].filter(Boolean).join(' ')}
      classNames={mergePickerClassNames(classNames)}
      builtinPlacements={adaptivePickerPlacements}
      getPopupContainer={getPopupContainer ?? defaultPopupContainer}
      style={{ width: '100%', ...style }}
    />
  );
}

export function AdminTimePicker({ className, classNames, getPopupContainer, locale, style, ...props }: ComponentProps<typeof TimePicker>) {
  return (
    <TimePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', 'admin-time-picker', className].filter(Boolean).join(' ')}
      classNames={mergePickerClassNames(classNames)}
      builtinPlacements={adaptivePickerPlacements}
      getPopupContainer={getPopupContainer ?? defaultPopupContainer}
      style={{ width: '100%', ...style }}
    />
  );
}

export function AdminRangePicker({ className, classNames, getPopupContainer, locale, style, ...props }: ComponentProps<typeof DatePicker.RangePicker>) {
  return (
    <DatePicker.RangePicker
      {...props}
      locale={locale || zhCNDatePicker}
      className={['admin-date-picker', 'admin-range-picker', className].filter(Boolean).join(' ')}
      classNames={mergePickerClassNames(classNames)}
      builtinPlacements={adaptivePickerPlacements}
      getPopupContainer={getPopupContainer ?? defaultPopupContainer}
      style={{ width: '100%', ...style }}
    />
  );
}

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Dropdown } from 'antd';
import type { ButtonProps } from 'antd';
import { CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { AdminInput } from '../AdminInput';
import './index.css';

export type AdminSearchDropdownOption = {
  label: ReactNode;
  value: string;
  searchText?: string;
};

type AdminSearchDropdownBaseProps = {
  options: AdminSearchDropdownOption[];
  children: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  buttonProps?: ButtonProps;
  confirmText?: string;
};

type AdminSearchDropdownSingleProps = AdminSearchDropdownBaseProps & {
  multiple?: false;
  onSelect: (value: string, option: AdminSearchDropdownOption) => void | Promise<void>;
  onConfirm?: never;
};

type AdminSearchDropdownMultipleProps = AdminSearchDropdownBaseProps & {
  multiple: true;
  onSelect?: never;
  onConfirm: (values: string[]) => void | Promise<void>;
};

type AdminSearchDropdownProps = AdminSearchDropdownSingleProps | AdminSearchDropdownMultipleProps;

function textOf(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export function AdminSearchDropdown({
  options,
  children,
  disabled,
  placeholder = '请输入关键字',
  emptyText = '暂无数据',
  buttonProps,
  multiple = false,
  onSelect,
  onConfirm,
  confirmText = '下一步'
}: AdminSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const filteredOptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return options;

    return options.filter((option) => {
      const text = [option.searchText, textOf(option.label), option.value].filter(Boolean).join(' ').toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [keyword, options]);

  return (
    <Dropdown
      trigger={['click']}
      open={open}
      disabled={disabled}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setKeyword('');
        setSelectedValues([]);
      }}
      popupRender={() => (
        <div className="admin-search-dropdown">
          <div className="admin-search-dropdown__search">
            <AdminInput
              autoFocus
              allowClear
              prefix={<SearchOutlined />}
              value={keyword}
              placeholder={placeholder}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
          <div className="admin-search-dropdown__list">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`admin-search-dropdown__item${selectedValues.includes(option.value) ? ' is-selected' : ''}`}
                onClick={async () => {
                  if (multiple) {
                    setSelectedValues((current) => current.includes(option.value)
                      ? current.filter((value) => value !== option.value)
                      : [...current, option.value]);
                    return;
                  }
                  await onSelect?.(option.value, option);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {multiple && selectedValues.includes(option.value) ? <CheckOutlined /> : null}
              </button>
            )) : (
              <div className="admin-search-dropdown__empty">
                {emptyText}
              </div>
            )}
          </div>
          {multiple ? (
            <div className="admin-search-dropdown__footer">
              <span>已选择 {selectedValues.length} 项</span>
              <div className="admin-search-dropdown__footer-actions">
                <Button size="small" onClick={() => setOpen(false)}>取消</Button>
                <Button
                  type="primary"
                  size="small"
                  disabled={selectedValues.length === 0}
                  onClick={async () => {
                    await onConfirm?.(selectedValues);
                    setOpen(false);
                  }}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    >
      <Button size="small" disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    </Dropdown>
  );
}

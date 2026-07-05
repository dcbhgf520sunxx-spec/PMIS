import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Dropdown } from 'antd';
import type { ButtonProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { AdminInput } from '../AdminInput';
import './index.css';

export type AdminSearchDropdownOption = {
  label: ReactNode;
  value: string;
  searchText?: string;
};

type AdminSearchDropdownProps = {
  options: AdminSearchDropdownOption[];
  children: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  buttonProps?: ButtonProps;
  onSelect: (value: string, option: AdminSearchDropdownOption) => void | Promise<void>;
};

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
  onSelect
}: AdminSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
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
        if (!nextOpen) setKeyword('');
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
                className="admin-search-dropdown__item"
                onClick={async () => {
                  await onSelect(option.value, option);
                  setOpen(false);
                  setKeyword('');
                }}
              >
                {option.label}
              </button>
            )) : (
              <div className="admin-search-dropdown__empty">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    >
      <Button size="small" disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    </Dropdown>
  );
}

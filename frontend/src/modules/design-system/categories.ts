export type DesignCategory =
  | 'overview'
  | 'foundation'
  | 'layout'
  | 'base'
  | 'input'
  | 'display'
  | 'feedback';

export const designCategoryNavItems: Array<{ key: DesignCategory; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'foundation', label: '设计基础' },
  { key: 'layout', label: '页面模式' },
  { key: 'base', label: '基础组件' },
  { key: 'input', label: '输入组件' },
  { key: 'feedback', label: '反馈组件' },
  { key: 'display', label: '数据展示' }
];

export function isDesignCategory(value: string | null): value is DesignCategory {
  return designCategoryNavItems.some((item) => item.key === value);
}

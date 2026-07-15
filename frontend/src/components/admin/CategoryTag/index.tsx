import type { ComponentProps } from 'react';
import { Tag } from 'antd';
import type { CategoryTone } from './categoryTones';

export { categoryTones, defineCategoryToneMap } from './categoryTones';
export type { CategoryTone } from './categoryTones';

const categoryToneColors: Record<CategoryTone, string> = {
  blue: 'blue',
  cyan: 'cyan',
  indigo: 'geekblue',
  violet: 'purple',
  magenta: 'magenta'
};

const cyanTagStyle = {
  color: '#0ea5e9',
  backgroundColor: 'rgba(14, 165, 233, 0.1)',
  borderColor: 'rgba(14, 165, 233, 0.35)'
};

export type CategoryTagProps = Omit<ComponentProps<typeof Tag>, 'color'> & {
  tone: CategoryTone;
};

export function CategoryTag({ tone, style, ...props }: CategoryTagProps) {
  return <Tag {...props} color={tone === 'cyan' ? undefined : categoryToneColors[tone]} style={tone === 'cyan' ? { ...cyanTagStyle, ...style } : style} />;
}

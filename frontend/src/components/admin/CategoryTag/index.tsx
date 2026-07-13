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

export type CategoryTagProps = Omit<ComponentProps<typeof Tag>, 'color'> & {
  tone: CategoryTone;
};

export function CategoryTag({ tone, ...props }: CategoryTagProps) {
  return <Tag {...props} color={categoryToneColors[tone]} />;
}

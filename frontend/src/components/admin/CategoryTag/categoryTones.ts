export const categoryTones = ['blue', 'cyan', 'indigo', 'violet', 'magenta'] as const;

export type CategoryTone = (typeof categoryTones)[number];

export function defineCategoryToneMap<const T extends Record<string, CategoryTone>>(mapping: T): Readonly<T> {
  const tones = Object.values(mapping);
  if (new Set(tones).size !== tones.length) {
    throw new Error('同一分类维度的不同值不能使用相同色调');
  }
  return Object.freeze({ ...mapping });
}

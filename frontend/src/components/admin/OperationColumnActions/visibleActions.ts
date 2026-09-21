import { Children, Fragment, cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

type VisibilityProps = {
  children?: ReactNode;
  hidden?: boolean;
  permission?: string;
  unauthorizedMode?: 'hidden' | 'disabled';
};

// 可见性先于折叠计算；业务状态应通过条件渲染在调用处排除。
export function visibleOperationActions(children: ReactNode, permissions: readonly string[], prefix = ''): ReactNode[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement<VisibilityProps>(child)) return [child];
    const key = `${prefix}${child.key ?? index}`;
    if (child.type === Fragment) return visibleOperationActions(child.props.children, permissions, `${key}/`);
    const { hidden, permission, unauthorizedMode } = child.props;
    if (hidden || (permission && !permissions.includes(permission) && unauthorizedMode !== 'disabled')) return [];
    return [cloneElement(child, { key })];
  });
}

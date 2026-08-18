import type { Key } from 'react';
import type { DataNode } from 'antd/es/tree';
import type { MenuRecord } from '../../api/roleApi';

export function buildMenuTree(menus: MenuRecord[]): DataNode[] {
  const nodeMap = new Map<number, DataNode>();
  const roots: DataNode[] = [];
  menus.forEach((menu) => nodeMap.set(menu.id, { key: menu.id, title: menu.name, children: [] }));
  menus.forEach((menu) => {
    const node = nodeMap.get(menu.id);
    if (!node) return;
    if (menu.parent_id === 0) roots.push(node);
    else {
      const parent = nodeMap.get(menu.parent_id);
      if (parent) parent.children = [...(parent.children || []), node];
    }
  });
  return roots;
}

export function collectTreeKeys(nodes: DataNode[]): Key[] {
  return nodes.flatMap((node) => [node.key, ...collectTreeKeys(node.children || [])]);
}

export function collectHalfCheckedKeys(nodes: DataNode[], checkedKeys: Key[]): Key[] {
  const checkedKeySet = new Set(checkedKeys);
  const halfCheckedKeys: Key[] = [];

  const hasCheckedNode = (node: DataNode): boolean => {
    const hasCheckedChild = (node.children || []).map(hasCheckedNode).some(Boolean);
    const isChecked = checkedKeySet.has(node.key);
    if (!isChecked && hasCheckedChild) halfCheckedKeys.push(node.key);
    return isChecked || hasCheckedChild;
  };

  nodes.forEach(hasCheckedNode);
  return halfCheckedKeys;
}

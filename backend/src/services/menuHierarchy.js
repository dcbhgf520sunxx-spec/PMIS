function includeParentMenus(menus, allMenus) {
  const result = [...menus]
  const menuMap = new Map(allMenus.map((menu) => [menu.id, menu]))
  const includedIds = new Set(result.map((menu) => menu.id))
  const pendingIds = [...includedIds]

  while (pendingIds.length > 0) {
    const menu = menuMap.get(pendingIds.pop())
    const parentId = menu?.parent_id
    if (!parentId || includedIds.has(parentId)) continue
    const parent = menuMap.get(parentId)
    if (!parent) continue
    result.push(parent)
    includedIds.add(parentId)
    pendingIds.push(parentId)
  }

  return result.sort((left, right) => (left.sort_order - right.sort_order) || (left.id - right.id))
}

module.exports = { includeParentMenus }

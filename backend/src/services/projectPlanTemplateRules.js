function positiveId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function validDate(value) {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

function requiredName(value, label, maxLength) {
  const name = String(value || '').trim()
  if (!name) throw new Error(`请填写${label}名称`)
  if (name.length > maxLength) throw new Error(`${label}名称不能超过${maxLength}个字符`)
  return name
}

function optionalText(value, maxLength, label) {
  const text = String(value || '').trim()
  if (text.length > maxLength) throw new Error(`${label}不能超过${maxLength}个字符`)
  return text || null
}

function buildTemplateApplication(template, configurations) {
  const templateStages = Array.isArray(template?.stages) ? template.stages : []
  const templateStageById = new Map(templateStages.map((stage) => [Number(stage.id), stage]))
  const configs = Array.isArray(configurations) ? configurations : []
  if (!configs.length) throw new Error('请至少保留一个阶段')

  const usedTemplateStageIds = new Set()
  const stageNames = new Set()

  return configs.map((config, stageIndex) => {
    const templateStageId = positiveId(config.template_stage_id)
    const templateStage = templateStageId ? templateStageById.get(templateStageId) : null
    if (config.template_stage_id && !templateStage) throw new Error('模板阶段不存在，请刷新后重试')
    if (templateStageId && usedTemplateStageIds.has(templateStageId)) throw new Error('同一模板阶段不能重复添加')
    if (templateStageId) usedTemplateStageIds.add(templateStageId)

    const stageName = templateStage
      ? templateStage.name
      : requiredName(config.name, '阶段', 100)
    if (stageNames.has(stageName)) throw new Error('阶段名称不能重复')
    stageNames.add(stageName)

    const itemConfigs = Array.isArray(config.items) ? config.items : []

    const templateItems = Array.isArray(templateStage?.items) ? templateStage.items : []
    const templateItemById = new Map(templateItems.map((item) => [Number(item.id), item]))
    const usedTemplateItemIds = new Set()
    const itemNames = new Set()
    const items = itemConfigs.map((itemConfig, itemIndex) => {
      const templateItemId = positiveId(itemConfig.template_item_id)
      const templateItem = templateItemId ? templateItemById.get(templateItemId) : null
      if (itemConfig.template_item_id && !templateItem) throw new Error('模板关键事项不存在，请刷新后重试')
      if (templateItemId && usedTemplateItemIds.has(templateItemId)) throw new Error('同一模板关键事项不能重复添加')
      if (templateItemId) usedTemplateItemIds.add(templateItemId)

      const name = templateItem
        ? templateItem.name
        : requiredName(itemConfig.name, '关键事项', 200)
      if (itemNames.has(name)) throw new Error(`${stageName}的关键事项名称不能重复`)
      itemNames.add(name)

      const ownerId = positiveId(itemConfig.owner_id)
      const dueDate = itemConfig.due_date
      if (!ownerId) throw new Error(`请选择${name}的负责人`)
      if (!validDate(dueDate)) throw new Error(`请选择${name}的计划完成时间`)

      const deliveryFileValue = itemConfig.requires_delivery_file
      if (
        deliveryFileValue !== undefined
        && deliveryFileValue !== null
        && deliveryFileValue !== ''
        && deliveryFileValue !== 0
        && deliveryFileValue !== 1
      ) {
        throw new Error(`${name}的需交付文件配置无效`)
      }
      const requiresDeliveryFile = deliveryFileValue === undefined || deliveryFileValue === null || deliveryFileValue === ''
        ? (templateItem && Number(templateItem.requires_delivery_file) === 1 ? 1 : 0)
        : deliveryFileValue
      const deliveryRequirement = requiresDeliveryFile
        ? optionalText(
          templateItem ? templateItem.delivery_requirement : itemConfig.delivery_requirement,
          200,
          '交付文件要求'
        ) || '关键交付文件'
        : null

      return {
        templateItemId,
        name,
        ownerId,
        dueDate,
        requiresDeliveryFile,
        deliveryRequirement,
        remark: templateItem
          ? (templateItem.remark || null)
          : optionalText(itemConfig.remark, 500, '备注'),
        sortOrder: itemIndex,
      }
    })

    return {
      templateStageId,
      name: stageName,
      description: templateStage
        ? (templateStage.description || null)
        : optionalText(config.description, 500, '阶段说明'),
      sortOrder: stageIndex,
      items,
    }
  })
}

module.exports = { buildTemplateApplication }

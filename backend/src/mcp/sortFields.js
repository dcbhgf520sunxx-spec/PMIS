const SORT_FIELDS = {
  product_search: ['name', 'owner_name', 'description', 'status', 'creator_name', 'created_at'],
  project_search: ['name', 'product_name', 'requirement_name', 'owner_name', 'priority', 'status', 'start_date', 'expected_end_date', 'members', 'creator_name', 'created_at'],
  requirement_search: ['title', 'requirement_type', 'status', 'product_name', 'owner_name', 'priority', 'submitter_name', 'submit_date', 'expected_end_date', 'creator_name', 'created_at'],
  task_search: ['name', 'source_name', 'owner_names', 'task_type_name', 'priority', 'status', 'expected_end_date', 'created_at'],
  bug_search: ['title', 'source_name', 'assignee_name', 'bug_type_name', 'severity', 'status', 'creator_name', 'created_at'],
  work_order_search: ['problem_desc', 'product_id', 'problem_type', 'urgency', 'status', 'is_overdue', 'follower_name', 'follower_id', 'submitter_name', 'submitter_dept', 'submit_time', 'expected_resolve_date', 'creator_name', 'created_at'],
  stage_plan_search: ['project_name', 'stage_name', 'item_name', 'status', 'current_due_date', 'created_at'],
  contract_search: ['project_name', 'contract_code', 'contract_name', 'signed_date', 'contract_amount', 'created_at'],
  payment_search: ['project_name', 'stage_name', 'payment_month', 'payment_amount', 'handler_name', 'created_at'],
}

const LEGACY_SORT_FIELD_ALIASES = {
  product_search: { ownerName: 'owner_name', creatorName: 'creator_name', createdAt: 'created_at' },
  project_search: {
    productName: 'product_name', requirementName: 'requirement_name', ownerName: 'owner_name',
    startDate: 'start_date', expectedEndDate: 'expected_end_date', creatorName: 'creator_name', createdAt: 'created_at',
  },
  requirement_search: {
    requirementType: 'requirement_type', productName: 'product_name', ownerName: 'owner_name',
    submitterName: 'submitter_name', submitDate: 'submit_date', expectedEndDate: 'expected_end_date',
    creatorName: 'creator_name', createdAt: 'created_at',
  },
  task_search: {
    sourceName: 'source_name', ownerNames: 'owner_names', taskTypeName: 'task_type_name',
    expectedEndTime: 'expected_end_date', createdAt: 'created_at',
  },
  bug_search: {
    sourceName: 'source_name', assigneeName: 'assignee_name', bugTypeName: 'bug_type_name',
    creatorName: 'creator_name', createdAt: 'created_at',
  },
}

const CONTROLLER_SORT_FIELDS = Object.fromEntries(
  Object.entries(LEGACY_SORT_FIELD_ALIASES).map(([toolName, aliases]) => [
    toolName,
    Object.fromEntries(Object.entries(aliases).map(([controllerField, publicField]) => [publicField, controllerField])),
  ])
)

function normalizeSortField(toolName, value) {
  return LEGACY_SORT_FIELD_ALIASES[toolName]?.[value] || value
}

function controllerSortField(toolName, value) {
  return CONTROLLER_SORT_FIELDS[toolName]?.[value] || value
}

module.exports = {
  SORT_FIELDS,
  controllerSortField,
  normalizeSortField,
}

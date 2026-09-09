const PERIOD_SECTIONS = ['period_flows', 'current_stock', 'plan_outlook', 'comparison', 'trend', 'groupings',
  'quality_and_delivery', 'financials', 'flow_candidates', 'risk_candidates', 'report_people']

const PERIOD_DETAIL_METRICS = {
  flow: ['created', 'completed', 'important_adjustments', 'became_overdue', 'new_overdue_unresolved', 'paused', 'resumed', 'fixed', 'activated', 'reopened'],
  stock: ['total', 'unfinished', 'in_progress', 'paused', 'overdue'],
  plan: ['planned', 'completed', 'pending'],
  risk: ['overdue', 'due_soon', 'paused', 'missing_delivery', 'missing_plan_date', 'workload_concentration'],
}

module.exports = { PERIOD_SECTIONS, PERIOD_DETAIL_METRICS }

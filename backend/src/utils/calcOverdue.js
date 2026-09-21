const { calculateOverdue } = require('../services/overdueRules')

function calcOverdue(date, status) {
  return calculateOverdue('work_order', { date, status }).isOverdue
}
module.exports = { calcOverdue }

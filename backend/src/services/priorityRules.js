const PRIORITY_VALUES = [0, 1, 2]
const DEFAULT_PRIORITY = 0

function parsePriority(value) {
  const priority = Number(value)
  return PRIORITY_VALUES.includes(priority) ? priority : null
}

module.exports = { DEFAULT_PRIORITY, PRIORITY_VALUES, parsePriority }

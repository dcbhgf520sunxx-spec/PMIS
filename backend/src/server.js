const app = require('./app')
const { start: startOverdueCron } = require('./services/overdueCron')
const { start: startMaintenanceContractReminder } = require('./services/productMaintenanceContractReminderService')
const { start: startIntegrationScheduler } = require('./services/integrationService')

const PORT = process.env.PORT || 3103
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (process.send) process.send('ready')
  startOverdueCron()
  startMaintenanceContractReminder()
  startIntegrationScheduler()
})

module.exports = server

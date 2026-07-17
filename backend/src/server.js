const app = require('./app')
const { start: startOverdueCron } = require('./services/overdueCron')

const PORT = process.env.PORT || 3103
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  if (process.send) process.send('ready')
  startOverdueCron()
})

module.exports = server

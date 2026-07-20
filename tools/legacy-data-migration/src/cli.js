const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')
const { Client } = require('pg')
const { readConfig } = require('./config')
const { runImport, runSourcePrecheck, verifyImportedData } = require('./migration')

function writeReport(reportPath, report) {
  if (!reportPath) return
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--apply') ? 'apply' : args.includes('--verify') ? 'verify' : 'precheck'
  if (mode === 'apply' && !args.includes('--user-approved')) {
    throw new Error('正式导入必须同时提供 --apply --user-approved')
  }
  const reportIndex = args.indexOf('--report')
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : null
  const config = readConfig()
  console.log(`迁移连接：${config.summary.legacy} -> ${config.summary.target}`)

  const source = await mysql.createConnection(config.legacy)
  const target = new Client(config.target)
  await target.connect()
  try {
    const result = mode === 'apply'
      ? await runImport({ source, target })
      : mode === 'verify'
        ? await verifyImportedData({ source, target })
        : { source: await runSourcePrecheck(source) }
    const report = { mode, executedAt: new Date().toISOString(), ...result }
    writeReport(reportPath, report)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await source.end()
    await target.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { main, writeReport }

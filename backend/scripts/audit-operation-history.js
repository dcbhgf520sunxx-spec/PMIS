const { readdirSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

function findViolations(controllersDir) {
  return readdirSync(controllersDir)
    .filter((name) => name.endsWith('.js'))
    .flatMap((name) => {
      const source = readFileSync(join(controllersDir, name), 'utf8')
      if (!/groupOperationLogs\(/.test(source)) return []
      const usesSharedFormatter = /formatHistoryChanges\(/.test(source)
        && /fieldLabels\s*:/.test(source)
        && /\b(?:valueLookups|valueResolver)\b/.test(source)
      const hasExplicitDisplayMapping = /FIELD_LABEL/.test(source) && /resolveValue\(/.test(source)
      return usesSharedFormatter || hasExplicitDisplayMapping ? [] : [name]
    })
}

function controllersDirFromArgs(args) {
  const index = args.indexOf('--controllers-dir')
  return index >= 0 ? resolve(args[index + 1]) : resolve(__dirname, '../src/controllers')
}

if (require.main === module) {
  const violations = findViolations(controllersDirFromArgs(process.argv.slice(2)))
  console.log('变更历史转译审计')
  console.log(`阻断项：${violations.length}`)
  for (const file of violations) {
    console.log(`BLOCK ${file}：变更历史必须转成中文字段名和业务展示值后再返回`)
  }
  if (violations.length) process.exit(1)
}

module.exports = { findViolations }

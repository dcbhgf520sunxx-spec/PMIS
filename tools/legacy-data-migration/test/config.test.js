const test = require('node:test')
const assert = require('node:assert/strict')

const { readConfig } = require('../src/config')

test('readConfig requires separate legacy and target database credentials', () => {
  assert.throws(() => readConfig({}), /缺少迁移环境变量/)
})

test('readConfig parses ports and never exposes passwords in the returned summary', () => {
  const config = readConfig({
    LEGACY_DB_HOST: '127.0.0.1',
    LEGACY_DB_PORT: '3306',
    LEGACY_DB_USER: 'legacy',
    LEGACY_DB_PASSWORD: 'legacy-secret',
    LEGACY_DB_NAME: 'project_manage',
    TARGET_DB_HOST: '127.0.0.1',
    TARGET_DB_PORT: '5433',
    TARGET_DB_USER: 'pms',
    TARGET_DB_PASSWORD: 'target-secret',
    TARGET_DB_NAME: 'pmis',
  })

  assert.equal(config.legacy.port, 3306)
  assert.equal(config.target.port, 5433)
  assert.deepEqual(config.summary, {
    legacy: 'legacy@127.0.0.1:3306/project_manage',
    target: 'pms@127.0.0.1:5433/pmis',
  })
  assert.doesNotMatch(JSON.stringify(config.summary), /secret/)
})

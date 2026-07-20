const REQUIRED_KEYS = [
  'LEGACY_DB_HOST',
  'LEGACY_DB_PORT',
  'LEGACY_DB_USER',
  'LEGACY_DB_PASSWORD',
  'LEGACY_DB_NAME',
  'TARGET_DB_HOST',
  'TARGET_DB_PORT',
  'TARGET_DB_USER',
  'TARGET_DB_PASSWORD',
  'TARGET_DB_NAME',
]

function readConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key])
  if (missing.length) throw new Error(`缺少迁移环境变量：${missing.join(', ')}`)
  const legacy = {
    host: env.LEGACY_DB_HOST,
    port: Number(env.LEGACY_DB_PORT),
    user: env.LEGACY_DB_USER,
    password: env.LEGACY_DB_PASSWORD,
    database: env.LEGACY_DB_NAME,
    timezone: '+08:00',
    dateStrings: true,
  }
  const target = {
    host: env.TARGET_DB_HOST,
    port: Number(env.TARGET_DB_PORT),
    user: env.TARGET_DB_USER,
    password: env.TARGET_DB_PASSWORD,
    database: env.TARGET_DB_NAME,
    options: '-c timezone=Asia/Shanghai',
  }
  if (!Number.isInteger(legacy.port) || !Number.isInteger(target.port)) {
    throw new Error('数据库端口必须是整数')
  }
  return {
    legacy,
    target,
    summary: {
      legacy: `${legacy.user}@${legacy.host}:${legacy.port}/${legacy.database}`,
      target: `${target.user}@${target.host}:${target.port}/${target.database}`,
    },
  }
}

module.exports = { readConfig }

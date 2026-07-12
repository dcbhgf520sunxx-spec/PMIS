const PLACEHOLDER_SECRETS = new Set([
  '',
  'your_jwt_secret_key_change_this',
  'change-me',
  'changeme',
  'placeholder'
])

function validateRuntimeConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production'
  const allowedOrigin = env.ALLOWED_ORIGIN || (isProduction ? '' : 'http://localhost:3104')
  const secret = String(env.JWT_SECRET || '').trim()

  if (isProduction && !allowedOrigin) {
    throw new Error('生产环境必须配置 ALLOWED_ORIGIN')
  }
  if (isProduction && (PLACEHOLDER_SECRETS.has(secret.toLowerCase()) || secret.length < 32)) {
    throw new Error('生产环境必须配置不少于 32 位的非占位 JWT_SECRET')
  }

  return { allowedOrigin }
}

module.exports = { validateRuntimeConfig }

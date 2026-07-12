const assert = require('node:assert/strict')
const test = require('node:test')

const { validateRuntimeConfig } = require('../src/config/runtimeConfig')

test('production requires an explicit allowed origin', () => {
  assert.throws(
    () => validateRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'a-production-secret-with-more-than-32-characters' }),
    /ALLOWED_ORIGIN/
  )
})

test('production rejects placeholder jwt secrets', () => {
  assert.throws(
    () => validateRuntimeConfig({ NODE_ENV: 'production', ALLOWED_ORIGIN: 'https://pms.example.com', JWT_SECRET: 'your_jwt_secret_key_change_this' }),
    /JWT_SECRET/
  )
})

test('development keeps the local origin default', () => {
  assert.deepEqual(
    validateRuntimeConfig({ NODE_ENV: 'development', JWT_SECRET: 'local-development-secret' }),
    { allowedOrigin: 'http://localhost:3104' }
  )
})

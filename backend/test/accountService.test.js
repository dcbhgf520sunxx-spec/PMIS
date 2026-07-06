const assert = require('node:assert/strict')
const test = require('node:test')

const {
  normalizePreference,
  validatePhoneChangePayload,
  validatePasswordChangePayload,
  toAvatarResponse,
  validateAvatarPayload
} = require('../src/services/accountService')

test('normalizes empty preference to default settings', () => {
  assert.deepEqual(normalizePreference({}), {
    default_route: '/home',
    default_page_size: 20,
    appearance_mode: 'light'
  })
})

test('normalizes removed appearance modes to light', () => {
  assert.equal(normalizePreference({ appearance_mode: 'dark' }).appearance_mode, 'light')
  assert.equal(normalizePreference({ appearance_mode: 'system' }).appearance_mode, 'light')
})

test('rejects unsupported appearance mode and page size', () => {
  assert.throws(
    () => normalizePreference({ default_page_size: 30, appearance_mode: 'blue' }),
    /偏好设置参数不正确/
  )
})

test('accepts 10 as preference page size', () => {
  assert.equal(normalizePreference({ default_page_size: 10 }).default_page_size, 10)
})

test('validates avatar upload payload', () => {
  const content = Buffer.from('avatar').toString('base64')
  assert.deepEqual(validateAvatarPayload({
    fileName: 'me.png',
    mimeType: 'image/png',
    contentBase64: content
  }), {
    extension: '.png',
    buffer: Buffer.from('avatar')
  })
})

test('allows avatar payload up to 5MB', () => {
  const content = Buffer.alloc(5 * 1024 * 1024).toString('base64')
  const result = validateAvatarPayload({
    fileName: 'me.png',
    mimeType: 'image/png',
    contentBase64: content
  })
  assert.equal(result.extension, '.png')
  assert.equal(result.buffer.length, 5 * 1024 * 1024)
})

test('rejects avatar payload over 5MB', () => {
  assert.throws(
    () => validateAvatarPayload({
      fileName: 'me.png',
      mimeType: 'image/png',
      contentBase64: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')
    }),
    /头像大小不能超过 5MB/
  )
})

test('rejects unsupported avatar type', () => {
  assert.throws(
    () => validateAvatarPayload({
      fileName: 'me.gif',
      mimeType: 'image/gif',
      contentBase64: Buffer.from('avatar').toString('base64')
    }),
    /头像仅支持/
  )
})

test('normalizes reset avatar response to empty avatar url', () => {
  assert.deepEqual(toAvatarResponse(null), { avatar_url: null })
})

test('requires password when changing phone', () => {
  assert.throws(
    () => validatePhoneChangePayload({ phone: '13800000000' }),
    /请输入登录密码/
  )
})

test('rejects password change when new password equals old password', () => {
  assert.throws(
    () => validatePasswordChangePayload({ oldPassword: 'vv123456', newPassword: 'vv123456' }),
    /新密码不能与原密码一致/
  )
})

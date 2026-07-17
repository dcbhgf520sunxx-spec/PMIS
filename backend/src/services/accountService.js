const fs = require('fs/promises')
const path = require('path')
const bcrypt = require('bcryptjs')
const db = require('../db')

const AVATAR_MAX_MB = 5
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024
const avatarTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

const allowedPageSizes = new Set([10, 20, 50, 100])
const allowedAppearanceModes = new Set(['light'])
const legacyAppearanceModes = new Set(['system', 'dark'])

function createValidationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function normalizePreference(input = {}) {
  const rawAppearanceMode = input.appearance_mode || 'light'
  const preference = {
    default_route: input.default_route || '/home',
    default_page_size: Number(input.default_page_size || 20),
    appearance_mode: allowedAppearanceModes.has(rawAppearanceMode) ? rawAppearanceMode : 'light'
  }

  if (!allowedPageSizes.has(preference.default_page_size) || (!allowedAppearanceModes.has(rawAppearanceMode) && !legacyAppearanceModes.has(rawAppearanceMode))) {
    throw new Error('偏好设置参数不正确')
  }

  return preference
}

function validateAvatarPayload(payload = {}) {
  const extension = avatarTypes[payload.mimeType]
  if (!extension) throw new Error('头像仅支持 JPG、PNG、WEBP 格式')
  if (!payload.contentBase64) throw new Error('头像文件不能为空')

  const buffer = Buffer.from(payload.contentBase64, 'base64')
  if (!buffer.length) throw new Error('头像文件不能为空')
  if (buffer.length > AVATAR_MAX_BYTES) throw new Error(`头像大小不能超过 ${AVATAR_MAX_MB}MB`)
  const signatures = {
    '.jpg': Buffer.from([0xff, 0xd8, 0xff]),
    '.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    '.webp': Buffer.from('RIFF')
  }
  const signature = signatures[extension]
  if (!signature || !buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error('头像文件内容与声明类型不一致')
  }
  if (extension === '.webp' && buffer.subarray(8, 12).toString() !== 'WEBP') {
    throw new Error('头像文件内容与声明类型不一致')
  }

  return { extension, buffer }
}

function toAvatarResponse(avatarUrl) {
  return { avatar_url: avatarUrl || null }
}

function validatePhoneChangePayload(payload = {}) {
  if (!payload.password) throw new Error('请输入登录密码')
  if (!payload.phone) throw new Error('请输入手机号')
  if (!/^1\d{10}$/.test(payload.phone)) throw new Error('请输入 11 位手机号')
  return {
    phone: payload.phone,
    password: payload.password
  }
}

function validatePasswordChangePayload(payload = {}) {
  if (!payload.oldPassword || !payload.newPassword) throw createValidationError('参数不完整')
  validateNewPassword(payload.newPassword)
  if (payload.oldPassword === payload.newPassword) throw createValidationError('新密码不能与原密码一致')
  return {
    oldPassword: payload.oldPassword,
    newPassword: payload.newPassword
  }
}

function validateNewPassword(password) {
  if (!password || password.length < 6) throw createValidationError('密码至少需要 6 位')
  return password
}

async function getCurrentUser(userId) {
  const row = await db.prepare(`
    SELECT
      u.id, u.employee_no, u.real_name, u.phone, u.status, u.avatar_url,
      u.created_at, u.updated_at,
      u1.real_name as creator_name,
      u2.real_name as updater_name,
      (
        SELECT l.login_at
        FROM pms_access_log l
        WHERE l.user_id = u.id AND l.result = 'success' AND l.login_at IS NOT NULL
        ORDER BY l.login_at DESC, l.id DESC
        LIMIT 1
      ) as last_login_at
    FROM pms_user u
    LEFT JOIN pms_user u1 ON u.creator_id = u1.id
    LEFT JOIN pms_user u2 ON u.updater_id = u2.id
    WHERE u.id = ? AND u.is_deleted = 0
  `).get(userId)

  if (!row) return null
  const roles = await db.prepare(`
    SELECT r.id, r.name
    FROM pms_user_role ur
    LEFT JOIN pms_role r ON ur.role_id = r.id
    WHERE ur.user_id = ?
    ORDER BY r.id
  `).all(userId)

  return { ...row, roles }
}

async function updateProfile(userId) {
  return getCurrentUser(userId)
}

async function changePhone(userId, payload = {}) {
  const { phone, password } = validatePhoneChangePayload(payload)
  const user = await db.prepare('SELECT id, password FROM pms_user WHERE id = ? AND is_deleted = 0').get(userId)
  if (!user) {
    const error = new Error('用户不存在')
    error.statusCode = 404
    throw error
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    const error = new Error('登录密码错误')
    error.statusCode = 401
    throw error
  }

  const exists = await db.prepare('SELECT id FROM pms_user WHERE phone = ? AND id != ? AND is_deleted = 0').get(phone, userId)
  if (exists) {
    const error = new Error('手机号已存在')
    error.statusCode = 400
    throw error
  }

  await db.prepare('UPDATE pms_user SET phone = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(phone, userId, userId)
  return getCurrentUser(userId)
}

async function saveAvatar(userId, payload = {}) {
  const { extension, buffer } = validateAvatarPayload(payload)
  const uploadDir = path.join(__dirname, '../../uploads/avatars')
  await fs.mkdir(uploadDir, { recursive: true })

  const fileName = `${userId}-${Date.now()}${extension}`
  const filePath = path.join(uploadDir, fileName)
  await fs.writeFile(filePath, buffer)

  const previous = await db.prepare('SELECT avatar_url FROM pms_user WHERE id = ?').get(userId)
  const avatarUrl = `/uploads/avatars/${fileName}`
  await db.prepare('UPDATE pms_user SET avatar_url = ?, updater_id = ?, updated_at = NOW() WHERE id = ?').run(avatarUrl, userId, userId)
  await removeManagedAvatar(previous?.avatar_url)
  return toAvatarResponse(avatarUrl)
}

async function resetAvatar(userId) {
  const previous = await db.prepare('SELECT avatar_url FROM pms_user WHERE id = ?').get(userId)
  await db.prepare('UPDATE pms_user SET avatar_url = NULL, updater_id = ?, updated_at = NOW() WHERE id = ?').run(userId, userId)
  await removeManagedAvatar(previous?.avatar_url)
  return toAvatarResponse(null)
}

async function removeManagedAvatar(avatarUrl) {
  if (!avatarUrl?.startsWith('/uploads/avatars/')) return
  const filePath = path.join(__dirname, '../../uploads/avatars', path.basename(avatarUrl))
  await fs.unlink(filePath).catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
}

async function getPreference(userId) {
  const row = await db.prepare(
    'SELECT default_route, default_page_size, appearance_mode FROM pms_user_preference WHERE user_id = ?'
  ).get(userId)
  return normalizePreference(row || {})
}

async function savePreference(userId, input = {}) {
  const preference = normalizePreference(input)
  await db.prepare(`
    INSERT INTO pms_user_preference (user_id, default_route, default_page_size, appearance_mode)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      default_route = EXCLUDED.default_route,
      default_page_size = EXCLUDED.default_page_size,
      appearance_mode = EXCLUDED.appearance_mode,
      updated_at = NOW()
  `).run(userId, preference.default_route, preference.default_page_size, preference.appearance_mode)
  return preference
}

module.exports = {
  normalizePreference,
  validatePhoneChangePayload,
  validatePasswordChangePayload,
  validateNewPassword,
  toAvatarResponse,
  validateAvatarPayload,
  getCurrentUser,
  updateProfile,
  changePhone,
  saveAvatar,
  resetAvatar,
  getPreference,
  savePreference
}

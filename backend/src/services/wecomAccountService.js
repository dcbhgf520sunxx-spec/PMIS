const defaultDb = require('../db')

class WecomAccountError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

async function resolveWecomAccount(userId, db = defaultDb) {
  const user = await db.prepare(
    `SELECT id, employee_no, real_name, phone, avatar_url, status, first_login
     FROM pms_user
     WHERE employee_no = ? AND is_deleted = 0`
  ).get(userId)

  if (!user) {
    throw new WecomAccountError('WECOM_ACCOUNT_NOT_FOUND', '账号尚未开通，请联系管理员')
  }
  if (Number(user.status) !== 1) {
    throw new WecomAccountError('WECOM_ACCOUNT_DISABLED', '账号已停用，请联系管理员')
  }
  return user
}

module.exports = {
  resolveWecomAccount,
  WecomAccountError
}

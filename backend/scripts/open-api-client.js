// 本机管理员使用；凭证只写入指定的 0600 文件，不写日志。
const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const db = require('../src/db')
const { hash } = require('../src/services/openApiContract')
const { allocateOpenClientCode } = require('../src/services/openClientCode')

async function configure(action, config, outputFile, database = db) {
  if (!['create','configure','rotate','enable','disable'].includes(action)) throw new Error('action 必须为 create/configure/rotate/enable/disable')
  if (Object.keys(config).some((key) => !['code','name','expiresAt'].includes(key))) throw new Error('配置仅支持 code、name、expiresAt，不再配置权限或人员白名单')
  if (action !== 'create' && !/^[A-Za-z0-9_-]{1,50}$/.test(config.code || '')) throw new Error('code 格式不正确')
  if (['create','configure'].includes(action)) {
    if (typeof config.name !== 'string' || !config.name.trim() || config.name.length > 100) throw new Error('name 不正确')
    if (config.expiresAt && (Number.isNaN(Date.parse(config.expiresAt)) || Date.parse(config.expiresAt) <= Date.now())) throw new Error('expiresAt 必须为未来时间')
  }
  let token
  let handle
  if (['create','rotate'].includes(action)) {
    if (!outputFile) throw new Error('必须指定凭证输出文件，不可使用已有文件')
    handle = await fs.open(outputFile,'wx',0o600)
    token = `sidm_open_${crypto.randomBytes(32).toString('base64url')}`
    try { await handle.writeFile(`${token}\n`); await handle.sync() } finally { await handle.close() }
  }
  if (action === 'create') {
    const identity = await allocateOpenClientCode(database)
    const result = await database.prepare('INSERT INTO pms_open_client(id,code,name,token_hash,expires_at) VALUES(?,?,?,?,?)').run(identity.id,identity.code,config.name.trim(),hash(token),config.expiresAt || null)
    return { id:result.lastInsertRowid,code:identity.code,enabled:false,credentialFile:outputFile }
  }
  let result
  // 本机命令没有网页登录身份，不沿用上一次网页更新人。
  if (action === 'configure') result = await database.prepare('UPDATE pms_open_client SET name=?,expires_at=?,updated_by=NULL,updated_at=NOW() WHERE code=?').run(config.name.trim(),config.expiresAt || null,config.code)
  if (action === 'rotate') result = await database.prepare('UPDATE pms_open_client SET token_hash=?,updated_by=NULL,updated_at=NOW() WHERE code=?').run(hash(token),config.code)
  if (['enable','disable'].includes(action)) result = await database.prepare('UPDATE pms_open_client SET enabled=?,updated_by=NULL,updated_at=NOW() WHERE code=?').run(action === 'enable' ? 1 : 0,config.code)
  if (!result.changes) throw new Error('接入系统不存在；若已生成凭证文件，该凭证未生效')
  return { code:config.code,action,...(outputFile ? {credentialFile:outputFile} : {}) }
}
if (require.main === module) {
  const [action,file,outputFile] = process.argv.slice(2)
  Promise.resolve().then(async () => {
    if (!file) throw new Error('用法：node scripts/open-api-client.js <create|configure|rotate|enable|disable> <配置.json> [新凭证文件]')
    console.log(JSON.stringify(await configure(action,JSON.parse(await fs.readFile(file,'utf8')),outputFile)))
  }).catch((e) => {console.error(e.message);process.exitCode=1}).finally(() => db.pool.end())
}
module.exports = { configure }

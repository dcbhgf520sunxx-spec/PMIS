const dbDefault = require('../db');
const { encryptSecret, decryptSecret } = require('./modelSecret');
const { validateModelUrl, resolvePublicAddress, requestChat } = require('./modelTransport');
const invalid = (field, message, statusCode = 400) => Object.assign(new Error(message), { field, statusCode, status: statusCode });
function validateConfig(body, editing) {
  const allowed = ['name', 'provider', 'baseUrl', 'modelName', 'apiKey', 'timeoutSeconds'];
  if (!body || Object.keys(body).some(key => !allowed.includes(key))) throw invalid('name', '配置包含不支持的字段');
  for (const key of ['name', 'provider', 'modelName']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 100 || /[\r\n]/.test(body[key])) throw invalid(key, '请输入100字符以内的有效内容');
  if (typeof body.baseUrl !== 'string' || body.baseUrl.length > 500) throw invalid('baseUrl', '模型地址最多500字符');
  const baseUrl = validateModelUrl(body.baseUrl.trim()).href.replace(/\/+$/, '');
  const apiKey = body.apiKey ?? '';
  if (typeof apiKey !== 'string' || (!editing && !apiKey.trim()) || apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw invalid('apiKey', '请输入有效的 API 密钥');
  if (!Number.isInteger(body.timeoutSeconds) || body.timeoutSeconds < 5 || body.timeoutSeconds > 60) throw invalid('timeoutSeconds', '超时须为5至60秒');
  return { name: body.name.trim(), provider: body.provider.trim(), baseUrl, modelName: body.modelName.trim(), apiKey: apiKey.trim(), timeoutSeconds: body.timeoutSeconds };
}
const fields = 'c.id,c.name,c.provider,c.base_url,c.model_name,c.enabled,c.is_default,c.timeout_seconds,c.created_at,c.updated_at,c.creator_id,c.updater_id,u.real_name creator_name,(SELECT real_name FROM pms_user WHERE id=c.updater_id) updater_name,(c.api_key_ciphertext IS NOT NULL) key_configured';
function createModelConnectionService({ db = dbDefault, chat = requestChat } = {}) {
  async function get(id, tx = db, lock = false) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw invalid(null, '模型配置不存在', 404);
    const row = await tx.prepare(`SELECT ${fields} FROM pms_llm_connection c LEFT JOIN pms_user u ON u.id=c.creator_id WHERE c.id=?${lock ? ' FOR UPDATE OF c' : ''}`).get(id);
    if (!row) throw invalid(null, '模型配置不存在', 404);
    return row;
  }
  async function save(id, raw, userId, ip) {
    const body = validateConfig(raw, Boolean(id));
    try { await resolvePublicAddress(new URL(body.baseUrl).hostname.replace(/^\[|\]$/g, '')); }
    catch (error) { if (error.field) throw error; throw invalid('baseUrl', '模型地址解析失败，请检查服务地址和网络'); }
    return db.transaction(async tx => {
      const old = id ? await get(id, tx, true) : null;
      const changes = [ ['name','名称',body.name], ['provider','供应商',body.provider], ['base_url','模型地址',body.baseUrl], ['model_name','模型标识',body.modelName], ['timeout_seconds','请求超时',body.timeoutSeconds] ]
        .filter(([key, , value]) => !old || String(old[key]) !== String(value))
        .map(([key, label, value]) => ({ field: label, oldVal: old?.[key], newVal: value }));
      let encrypted;
      if (body.apiKey) {
        const previous = id ? await tx.prepare('SELECT api_key_ciphertext FROM pms_llm_connection WHERE id=?').get(id) : null;
        let unchanged = false;
        if (previous) { try { unchanged = decryptSecret(previous.api_key_ciphertext) === body.apiKey; } catch { /* An explicit replacement can recover a lost credential. */ } }
        if (!unchanged) {
          encrypted = encryptSecret(body.apiKey);
          changes.push({ field: 'API密钥', oldVal: old ? '已配置' : null, newVal: '已更换' });
        }
      }
      if (old && !changes.length) return old;
      if (old) await tx.prepare('UPDATE pms_llm_connection SET name=?,provider=?,base_url=?,model_name=?,timeout_seconds=?,api_key_ciphertext=COALESCE(?,api_key_ciphertext),updater_id=?,updated_at=NOW() WHERE id=?').run(body.name, body.provider, body.baseUrl, body.modelName, body.timeoutSeconds, encrypted ?? null, userId, id);
      else id = (await tx.prepare('INSERT INTO pms_llm_connection(name,provider,base_url,model_name,timeout_seconds,api_key_ciphertext,creator_id,updater_id) VALUES(?,?,?,?,?,?,?,?)').run(body.name, body.provider, body.baseUrl, body.modelName, body.timeoutSeconds, encrypted, userId, userId)).lastInsertRowid;
      if (old) await tx.writeLogs(userId, '编辑', '模型中心', id, changes, ip, body.name);
      else await tx.writeLog(userId, '新增', '模型中心', id, null, null, null, ip, body.name);
      return get(id, tx);
    });
  }
  async function action(id, operation, userId, ip) {
    return db.transaction(async tx => {
      // Serialize default changes and disable actions before locking individual rows.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('sidm-model-default'))");
      const row = await get(id, tx, true);
      if (!['enable', 'disable', 'default'].includes(operation)) throw invalid(null, '模型操作不正确');
      if (operation === 'default') {
        if (!row.enabled) throw invalid(null, '请先启用模型');
        if (row.is_default) return null;
        const previous = await tx.prepare('SELECT id,name FROM pms_llm_connection WHERE is_default=1').get();
        await tx.prepare('UPDATE pms_llm_connection SET is_default=0,updater_id=?,updated_at=NOW() WHERE is_default=1').run(userId);
        await tx.prepare('UPDATE pms_llm_connection SET is_default=1,updater_id=?,updated_at=NOW() WHERE id=?').run(userId, id);
        if (previous) await tx.writeLogs(userId, '取消默认', '模型中心', previous.id, [{ field: '默认模型', oldVal: '是', newVal: '否' }], ip, previous.name);
        await tx.writeLogs(userId, '设为默认', '模型中心', id, [{ field: '默认模型', oldVal: '否', newVal: '是' }], ip, row.name);
      } else {
        const enabled = operation === 'enable' ? 1 : 0;
        if (Number(row.enabled) === enabled) return null;
        await tx.prepare('UPDATE pms_llm_connection SET enabled=?,is_default=CASE WHEN ?=0 THEN 0 ELSE is_default END,updater_id=?,updated_at=NOW() WHERE id=?').run(enabled, enabled, userId, id);
        const changes = [{ field: '状态', oldVal: row.enabled ? '启用' : '停用', newVal: enabled ? '启用' : '停用' }];
        if (!enabled && row.is_default) changes.push({ field: '默认模型', oldVal: '是', newVal: '否' });
        await tx.writeLogs(userId, enabled ? '启用' : '停用', '模型中心', id, changes, ip, row.name);
      }
      return null;
    });
  }
  function toConnection(row) {
    try { return { id: String(row.id), provider: row.provider, baseUrl: row.base_url, model: row.model_name, apiKey: decryptSecret(row.api_key_ciphertext), timeoutSeconds: row.timeout_seconds, revision: `${row.id}:${row.updated_at}` }; }
    catch { throw invalid(null, '模型密钥无法解密，请检查服务密钥文件或重新保存 API 密钥', 503); }
  }
  async function active() {
    const row = await db.prepare('SELECT * FROM pms_llm_connection WHERE enabled=1 AND is_default=1').get();
    if (row) return toConnection(row);
    const count = await db.prepare('SELECT COUNT(*) count FROM pms_llm_connection').get();
    if (Number(count.count)) throw invalid(null, '请在模型中心启用并设置默认模型', 503);
    return null;
  }
  async function testConnection(id) {
    await get(id);
    const row = await db.prepare('SELECT * FROM pms_llm_connection WHERE id=?').get(id);
    const started = Date.now();
    try {
      const choice = await chat({ ...toConnection(row), messages: [{ role: 'user', content: '连接测试，请仅回复“连接成功”。' }] });
      if (choice?.finish_reason !== 'stop' || !choice.message?.content?.trim()) throw new Error('invalid model result');
      return { success: true, elapsedMs: Date.now() - started, model: row.model_name };
    } catch { throw invalid(null, '连接测试失败，请检查地址、模型、密钥及服务可用性', 502); }
  }
  return { get, save, action, active, testConnection, list: () => db.prepare(`SELECT ${fields} FROM pms_llm_connection c LEFT JOIN pms_user u ON u.id=c.creator_id ORDER BY c.id DESC`).all() };
}
module.exports = { createModelConnectionService, validateConfig };

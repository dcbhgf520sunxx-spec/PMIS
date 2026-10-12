const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const integration = process.env.MODEL_CENTER_INTEGRATION === '1' || process.env.RUN_DB_INTEGRATION === '1';
const schema = `model_center_test_${crypto.randomBytes(6).toString('hex')}`;
if (integration) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`;

test('模型中心拒绝内网、带凭据、非HTTPS和重定向目标，保留公共模型地址', async () => {
  const { validateModelUrl, resolvePublicAddress } = require('../src/services/modelTransport');
  assert.equal(validateModelUrl('https://api.deepseek.com/').href, 'https://api.deepseek.com/');
  for (const url of ['http://api.deepseek.com', 'https://user:pass@example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://169.254.169.254', 'https://example.com?key=secret']) {
    assert.throws(() => validateModelUrl(url));
  }
  await assert.rejects(resolvePublicAddress('example.com', async () => [{ address: '10.0.0.1', family: 4 }]));
  await assert.rejects(resolvePublicAddress('example.com', async () => [{ address: '8.8.8.8', family: 4 }, { address: '::ffff:127.0.0.1', family: 6 }]));
  assert.equal((await resolvePublicAddress('example.com', async () => [{ address: '8.8.8.8', family: 4 }])).address, '8.8.8.8');
});

test('密钥加密可恢复且随机，主密钥权限受限，篡改密文无法读取', () => {
  const { encryptSecret, decryptSecret } = require('../src/services/modelSecret');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sidm-model-secret-'));
  const file = path.join(directory, 'llm.key');
  try {
    const a = encryptSecret('test-secret', file), b = encryptSecret('test-secret', file);
    assert.notEqual(a, b); assert.ok(!a.includes('test-secret'));
    assert.equal(decryptSecret(a, file), 'test-secret');
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.throws(() => decryptSecret(a.slice(0, -3) + 'xyz', file));
    fs.unlinkSync(file);
    assert.throws(() => decryptSecret(a, file));
    assert.equal(fs.existsSync(file), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('模型配置校验不接受身份篡改和非法超时，编辑空密钥保留原值', () => {
  const { validateConfig } = require('../src/services/modelConnectionService');
  const body = { name: 'DeepSeek', provider: 'DeepSeek', baseUrl: 'https://api.deepseek.com', modelName: 'deepseek-flash', timeoutSeconds: 30, apiKey: '' };
  assert.equal(validateConfig(body, true).apiKey, '');
  assert.throws(() => validateConfig(body, false));
  for (const bad of [{ ...body, creator_id: 1 }, { ...body, timeoutSeconds: 0 }, { ...body, name: '' }, { ...body, modelName: '\ninvalid' }]) assert.throws(() => validateConfig(bad, true));
});

test('模型中心真实数据库和HTTP：密钥不回显、默认唯一、停用无回退、菜单权限和调用', { skip: !integration }, async () => {
  const db = require('../src/db');
  const { createModelConnectionService } = require('../src/services/modelConnectionService');
  const { createModelConnectionRouter } = require('../src/routes/modelConnections');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sidm-model-integration-'));
  const prior = process.env.PMIS_MODEL_KEY_FILE;
  process.env.PMIS_MODEL_KEY_FILE = path.join(directory, 'llm.key');
  let server;
  try {
    await db.exec(`CREATE SCHEMA ${schema}`);
    const init = fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, '');
    await db.exec(init);
    const user = await db.prepare('SELECT id,employee_no FROM pms_user WHERE is_deleted=0 ORDER BY id LIMIT 1').get();
    const role = await db.prepare("SELECT id FROM pms_role WHERE code='admin'").get();
    await db.prepare('INSERT INTO pms_user_role(user_id,role_id) VALUES(?,?) ON CONFLICT DO NOTHING').run(user.id,role.id);
    const service = createModelConnectionService({db,chat:async config => { assert.equal(config.apiKey, 'test-secret'); return {finish_reason:'stop',message:{content:'连接成功'}}; }});
    const body = {name:'连接一',provider:'测试模型',baseUrl:'https://api.deepseek.com',modelName:'test-model',apiKey:'test-secret',timeoutSeconds:30};
    const first = await service.save(null,body,user.id,'127.0.0.1');
    assert.equal(first.enabled,0); assert.equal(first.key_configured,true);
    assert.ok(!JSON.stringify(first).includes('test-secret')); assert.ok(!Object.hasOwn(first,'api_key_ciphertext'));
    await assert.rejects(service.action(first.id,'default',user.id,''));
    await service.action(first.id,'enable',user.id,''); await service.action(first.id,'default',user.id,'');
    assert.equal((await service.active()).apiKey,'test-secret');
    const encrypted = (await db.prepare('SELECT api_key_ciphertext FROM pms_llm_connection WHERE id=?').get(first.id)).api_key_ciphertext;
    await service.save(first.id,{...body,name:'修改名称',apiKey:''},user.id,'');
    assert.equal((await db.prepare('SELECT api_key_ciphertext FROM pms_llm_connection WHERE id=?').get(first.id)).api_key_ciphertext,encrypted);
    const second = await service.save(null,{...body,name:'连接二'},user.id,''); await service.action(second.id,'enable',user.id,'');
    await Promise.all([service.action(first.id,'default',user.id,''),service.action(second.id,'default',user.id,'')]);
    assert.equal(Number((await db.prepare('SELECT COUNT(*) count FROM pms_llm_connection WHERE is_default=1').get()).count),1);
    const active = await service.active();
    await service.action(active.id,'disable',user.id,''); await assert.rejects(service.active(),{statusCode:503});
    assert.equal((await service.testConnection(first.id)).success,true);
    const failed = createModelConnectionService({db,chat:async () => {throw new Error('upstream response test-secret');}});
    await assert.rejects(failed.testConnection(first.id),error => error.statusCode===502 && !error.message.includes('test-secret'));
    const logs = await db.prepare("SELECT * FROM pms_op_log WHERE module='模型中心'").all();
    assert.ok(logs.length > 0); assert.ok(!JSON.stringify(logs).includes('test-secret')); assert.ok(!JSON.stringify(logs).includes(encrypted));
    const app = require('express')(); app.use(require('express').json());
    const {verifyToken} = require('../src/middleware/auth'); const {checkPermission} = require('../src/middleware/checkPermission');
    app.use('/api/model-connections',verifyToken,checkPermission('/model-connections'),createModelConnectionRouter(service));
    server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
    const origin = `http://127.0.0.1:${server.address().port}/api/model-connections`;
    assert.equal((await fetch(origin)).status,401);
    await db.prepare('UPDATE pms_user SET first_login=0 WHERE id=?').run(user.id);
    const {recordLoginSuccess} = require('../src/services/accessLogService');
    const sessionId = await recordLoginSuccess({user,account:user.employee_no,req:{headers:{},ip:'127.0.0.1'}});
    const token = require('jsonwebtoken').sign({userId:Number(user.id),employeeNo:user.employee_no,sessionId},process.env.JWT_SECRET || 'PMIS-dev-secret',{expiresIn:'5m'});
    const headers = {authorization:`Bearer ${token}`};
    const response = await fetch(origin,{headers}); assert.equal(response.status,200);
    assert.ok(!JSON.stringify(await response.json()).includes('test-secret'));
    await db.prepare("DELETE FROM pms_role_menu WHERE menu_id=(SELECT id FROM pms_menu WHERE code='model_center')").run();
    assert.equal((await fetch(origin,{headers})).status,403);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await db.pool.end();
    if (prior === undefined) delete process.env.PMIS_MODEL_KEY_FILE; else process.env.PMIS_MODEL_KEY_FILE = prior;
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

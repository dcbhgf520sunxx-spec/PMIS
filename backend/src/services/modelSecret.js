const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const keyFile = () => process.env.PMIS_MODEL_KEY_FILE || path.resolve(__dirname, '../../.secrets/llm.key');
function readKey(file, create) {
  if (create && !fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try { fs.writeFileSync(file, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const key = fs.readFileSync(file);
  if (key.length !== 32 || (fs.statSync(file).mode & 0o077)) throw new Error('模型加密主密钥格式或权限不正确');
  return key;
}
function encryptSecret(value, file = keyFile()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', readKey(file, true), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64')).join('.');
}
function decryptSecret(value, file = keyFile()) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('模型密钥格式不正确');
  const [iv, tag, data] = parts.map(v => Buffer.from(v, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', readKey(file, false), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
module.exports = { encryptSecret, decryptSecret };

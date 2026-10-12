const dns = require('node:dns/promises');
const https = require('node:https');
const { BlockList, isIP } = require('node:net');

const blocked = new BlockList();
for (const [network, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(network, prefix, 'ipv4');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
function publicIp(address) {
  if (isIP(address) === 4) return !blocked.check(address, 'ipv4');
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !blocked.check(address, 'ipv6');
}
const invalid = () => Object.assign(new Error('请输入不带凭据或查询参数的公共 HTTPS 模型地址'), { statusCode: 400, field: 'baseUrl' });
function validateModelUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || (isIP(hostname) && !publicIp(hostname))) throw invalid();
  return url;
}
async function resolvePublicAddress(hostname, lookup = dns.lookup) {
  let timer;
  const records = await Promise.race([lookup(hostname, { all: true }), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('模型地址解析超时')), 10000);
  })]).finally(() => clearTimeout(timer));
  if (!records.length || records.some(row => !publicIp(row.address))) throw invalid();
  return records[0];
}
async function requestChat({ baseUrl, apiKey, model, messages, timeoutSeconds = 30 }) {
  const base = validateModelUrl(baseUrl);
  const hostname = base.hostname.replace(/^\[|\]$/g, '');
  const address = await resolvePublicAddress(hostname);
  const url = new URL(base.href.replace(/\/+$/, '') + '/chat/completions');
  const payload = JSON.stringify({ model, messages, max_tokens: 500, stream: false,
    ...(hostname === 'api.deepseek.com' ? { thinking: { type: 'disabled' } } : {}) });
  return new Promise((resolve, reject) => {
    // Pin the checked address so a second DNS lookup cannot redirect credentials into the private network.
    const req = https.request(url, { method: 'POST', agent: false, lookup: (_host, options, callback) => {
      if (options.all) callback(null, [address]); else callback(null, address.address, address.family);
    }, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('模型请求失败')); return; }
      let size = 0; const chunks = [];
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 256 * 1024) { req.destroy(new Error('模型响应过大')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).choices?.[0]); } catch { reject(new Error('模型响应格式不正确')); } });
    });
    const timer = setTimeout(() => req.destroy(new Error('模型请求超时')), timeoutSeconds * 1000);
    req.on('error', reject); req.on('close', () => clearTimeout(timer));
    req.end(payload);
  });
}
module.exports = { validateModelUrl, resolvePublicAddress, requestChat };

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('../deploy/install-and-start.sh', import.meta.url).pathname;

test('Linux 一键部署脚本具备可执行的帮助入口和合法语法', () => {
  execFileSync('bash', ['-n', script]);
  const help = execFileSync('bash', [script, '--help'], { encoding: 'utf8' });
  assert.match(help, /sudo bash deploy\/install-and-start\.sh/);
  assert.match(help, /--env-file/);
});

test('Node 版本检查接受 22.18 及以上并拒绝更低版本', () => {
  const accepted = spawnSync('bash', [script, '--check-node-version', '22.18.0'], { encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stderr);

  const rejected = spawnSync('bash', [script, '--check-node-version', '22.17.9'], { encoding: 'utf8' });
  assert.equal(rejected.status, 1);
});

test('Nginx 配置预览写入实际发布目录和域名', () => {
  const config = execFileSync('bash', [
    script,
    '--print-nginx-config',
    '/srv/sidm',
    'sidm.example.com'
  ], { encoding: 'utf8' });

  assert.match(config, /server_name sidm\.example\.com;/);
  assert.match(config, /root \/srv\/sidm\/current\/frontend\/dist;/);
  assert.doesNotMatch(config, /\/path\/to\/(?:PMIS|SIDM)/);
});

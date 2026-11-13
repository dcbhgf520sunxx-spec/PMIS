import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('请求只清理自身的失效会话，延迟响应不影响新登录', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  } });
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { request } = await server.ssrLoadModule('/src/api/requestClient.ts');
    const { logoutAccessSession } = await server.ssrLoadModule('/src/api/accessLogApi.ts');
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/authStore.ts');
    const signIn = token => useAuthStore.getState().setAuth({ token, user: { id: 1, employee_no: 'admin', real_name: '测试用户' }, menus: [], permissions: [], accessSessionId: token, mustChangePassword: false });
    const unauthorized = (config, httpStatus) => {
      const response = { config, status: httpStatus, statusText: 'Unauthorized', headers: {}, data: { code: 401, message: '登录已失效', data: null } };
      if (httpStatus === 401) throw Object.assign(new Error('Unauthorized'), { config, response });
      return response;
    };

    for (const httpStatus of [200, 401]) {
      await t.test(`旧会话延迟返回${httpStatus}时保留新会话`, async () => {
        signIn('old-token');
        let release;
        let started;
        const sent = new Promise(resolve => { started = resolve; });
        const pending = request.get('/old-request', { adapter: async config => {
          started();
          await new Promise(resolve => { release = resolve; });
          return unauthorized(config, httpStatus);
        } });
        await sent;
        signIn('new-token');
        release();
        await assert.rejects(pending);
        assert.equal(useAuthStore.getState().token, 'new-token');
        assert.equal(values.get('access_token'), 'new-token');
      });
    }

    await t.test('当前会话失效仍会清理登录状态', async () => {
      signIn('current-token');
      await assert.rejects(request.get('/expired', { adapter: async config => unauthorized(config, 401) }));
      assert.equal(useAuthStore.getState().token, '');
      assert.equal(values.has('access_token'), false);
    });

    await t.test('退出请求保留旧会话令牌，旧401不能退出新账号', async () => {
      signIn('new-token');
      let sent;
      request.defaults.adapter = async config => {
        sent = config;
        return unauthorized(config, 401);
      };
      await assert.rejects(logoutAccessSession('old-session', { token: 'old-token' }));
      assert.equal(sent.headers.Authorization, 'Bearer old-token');
      assert.deepEqual(JSON.parse(sent.data), { session_id: 'old-session', preserve_last_active: 0 });
      assert.equal(useAuthStore.getState().token, 'new-token');
    });
  } finally {
    await server.close();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

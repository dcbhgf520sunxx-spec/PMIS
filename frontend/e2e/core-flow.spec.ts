import { expect, test } from '@playwright/test';

test('首次登录改密、核心页面和失效会话形成真实闭环', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const signIn = async (reload = true) => {
    if (reload) await page.goto('/login');
    await expect(page.getByRole('img', { name: '图形验证码', exact: true })).toBeVisible();
    await page.getByPlaceholder('请输入账号或手机号').fill('admin');
    await page.getByPlaceholder('请输入密码').fill('vv123456');
    await page.getByLabel('验证码', { exact: true }).fill('22222');
    await page.getByRole('button', { name: '登录系统' }).click();
    await expect(page.getByRole('dialog', { name: '首次登录请修改密码' })).toBeVisible();
  };

  // 图片来自真实验证码接口；固定答案只存在于独立测试服务的随机边界。
  await page.goto('/login');
  await expect(page.getByRole('img', { name: '图形验证码', exact: true })).toBeVisible();
  await page.getByPlaceholder('请输入账号或手机号').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('vv123456');
  await page.getByLabel('验证码', { exact: true }).fill('WRONG');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page.locator('#login-captcha-help')).toContainText('验证码错误或已过期');
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue('');
  await page.getByLabel('验证码', { exact: true }).fill('22222');
  await page.getByRole('button', { name: '刷新验证码', exact: true }).click();
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue('');

  const forcedModal = page.getByRole('dialog', { name: '首次登录请修改密码' });
  for (const close of ['close', 'escape', 'logout']) {
    await signIn();
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}` };
    const blocked = await page.request.get('/api/users', { headers });
    expect(blocked.status()).toBe(403);
    const ended = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'));
    if (close === 'close') await forcedModal.getByRole('button', { name: 'Close', exact: true }).click();
    else if (close === 'escape') {
      await forcedModal.getByLabel('原密码').focus();
      await page.keyboard.press('Escape');
    }
    else await forcedModal.getByRole('button', { name: '退出登录', exact: true }).click();
    expect((await ended).status()).toBe(200);
    await expect(forcedModal).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
    const revoked = await page.request.get('/api/users', { headers });
    expect(revoked.status()).toBe(401);
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login$/);
  }

  await signIn();
  const oldToken = await page.evaluate(() => localStorage.getItem('access_token'));
  let releaseLogout!: () => void;
  let markLogout!: () => void;
  const logoutGate = new Promise<void>(resolve => { releaseLogout = resolve; });
  const logoutIssued = new Promise<void>(resolve => { markLogout = resolve; });
  await page.route('**/api/auth/logout', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    markLogout();
    await logoutGate;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401, message: '登录已失效', data: null }) });
  });
  await forcedModal.getByRole('button', { name: 'Close', exact: true }).click();
  await logoutIssued;
  await expect(forcedModal).toBeHidden();
  await signIn(false);
  const newToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(newToken).toBeTruthy();
  expect(newToken).not.toBe(oldToken);
  const lateResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'));
  releaseLogout();
  await lateResponse;
  await expect(page.getByText('退出请求未完成，已清除本地登录状态', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe(newToken);
  await expect(forcedModal).toBeVisible();
  await page.unroute('**/api/auth/logout');
  // 空字段校验失败可恢复，随后正常改密；提交期间关闭入口禁用。
  await forcedModal.getByRole('button', { name: '确认修改并进入系统' }).click();
  await expect(forcedModal.getByText('请输入原密码', { exact: true })).toBeVisible();
  await forcedModal.getByLabel('原密码').fill('vv123456');
  await forcedModal.getByLabel('新密码', { exact: true }).fill('vv1234567');
  await forcedModal.getByLabel('确认新密码').fill('vv1234567');
  let releasePassword!: () => void;
  const passwordGate = new Promise<void>(resolve => { releasePassword = resolve; });
  await page.route('**/api/auth/password', async route => { await passwordGate; await route.continue(); });
  await forcedModal.getByRole('button', { name: '确认修改并进入系统' }).click();
  await expect(forcedModal.getByRole('button', { name: '退出登录', exact: true })).toBeDisabled();
  await expect(forcedModal.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(forcedModal).toBeVisible();
  releasePassword();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: '不怕事情多，就怕没着落' })).toBeVisible();

  await page.goto('/work-orders');
  await expect(page).toHaveURL(/\/work-orders$/);
  await expect(page.getByText('运维工单', { exact: true }).first()).toBeVisible();

  await page.goto('/users');
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText('用户管理', { exact: true }).first()).toBeVisible();

  const session = await page.evaluate(() => ({
    token: localStorage.getItem('access_token'),
    sessionId: localStorage.getItem('access_session_id'),
    user: JSON.parse(localStorage.getItem('user_info') || '{}') as { id?: number }
  }));
  expect(session.token).toBeTruthy();
  expect(session.sessionId).toBeTruthy();
  expect(session.user.id).toBeTruthy();

  const headers = { Authorization: `Bearer ${session.token}` };
  const resetResponse = await page.request.put(`/api/users/${session.user.id}/reset-password`, { headers });
  expect(resetResponse.ok()).toBeTruthy();
  const logoutResponse = await page.request.post('/api/auth/logout', {
    headers,
    data: { session_id: session.sessionId }
  });
  expect(logoutResponse.ok()).toBeTruthy();

  await page.goto('/work-orders');
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  expect(pageErrors).toEqual([]);
});

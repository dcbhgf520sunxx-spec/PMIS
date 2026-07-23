import { expect, test } from '@playwright/test';

test('首次登录改密、核心页面和失效会话形成真实闭环', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByPlaceholder('请输入账号或手机号').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('vv123456');
  await page.getByRole('button', { name: '登录系统' }).click();

  const forcedModal = page.getByRole('dialog', { name: '首次登录请修改密码' });
  await expect(forcedModal).toBeVisible();
  await expect(forcedModal.getByRole('button', { name: /取消|关闭/ })).toHaveCount(0);
  await forcedModal.getByLabel('原密码').fill('vv123456');
  await forcedModal.getByLabel('新密码', { exact: true }).fill('vv1234567');
  await forcedModal.getByLabel('确认新密码').fill('vv1234567');
  await forcedModal.getByRole('button', { name: '确认修改并进入系统' }).click();

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

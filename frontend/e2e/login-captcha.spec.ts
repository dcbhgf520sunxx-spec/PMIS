import { expect, test } from '@playwright/test';

test('验证码错误后显示字段错误并换图，保留账号密码', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  const image = page.getByRole('img', { name: '图形验证码' });
  await expect(image).toBeVisible();
  const previous = await image.getAttribute('src');
  await page.getByLabel('账号或手机号', { exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('saved-password');
  await page.getByLabel('验证码', { exact: true }).fill('WRONG');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page.getByText('验证码错误或已过期，请重新输入')).toBeVisible();
  await expect(image).toBeVisible();
  await expect(image).not.toHaveAttribute('src', previous || '');
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('账号或手机号', { exact: true })).toHaveValue('admin');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('saved-password');
  expect(errors).toEqual([]);
});

test('验证码加载失败可重试，成功之前禁止登录', async ({ page }) => {
  let fail = true;
  await page.route('**/api/auth/captcha', async route => {
    if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '验证码暂时不可用', data: null }) });
    return route.continue();
  });
  await page.goto('/login');
  await expect(page.getByText('验证码暂时不可用')).toBeVisible();
  await expect(page.getByRole('button', { name: '登录系统' })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: '重试验证码' }).click();
  await expect(page.getByRole('img', { name: '图形验证码' })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录系统' })).toBeEnabled();
});

test('窄屏验证码可刷新、无横向溢出，空字段就地提示', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  const image = page.getByRole('img', { name: '图形验证码' });
  await expect(image).toBeVisible();
  const previous = await image.getAttribute('src');
  await page.getByRole('button', { name: '刷新验证码' }).click();
  await expect(image).not.toHaveAttribute('src', previous || '');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page.getByText('请输入账号或手机号', { exact: true })).toBeVisible();
  await expect(page.getByText('请输入密码', { exact: true })).toBeVisible();
  await expect(page.getByText('请输入验证码', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

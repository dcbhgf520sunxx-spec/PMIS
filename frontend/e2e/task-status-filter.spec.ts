import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);

test('真实父子任务状态筛选只显示命中记录，刷新、分页和详情返回保持一致', async ({ page }) => {
  test.setTimeout(60_000);
  expect(process.env.INTEGRATION_DB_ISOLATED).toBe('1');
  const { Pool } = require('../../backend/node_modules/pg');
  const db = new Pool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, options: process.env.DB_OPTIONS
  });
  expect(['localhost', '127.0.0.1', '::1']).toContain(db.options.host);
  const prefix = `status-e2e-${Date.now()}`;
  const tasks: Array<{ id: number; name: string; status: number }> = [];
  let userId: number | undefined;
  let session: { token: string; access_session_id: string } | undefined;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const password = await require('../../backend/node_modules/bcryptjs').hash('vv123456', 4);
    userId = Number((await db.query('INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login)VALUES($1,$2,$3,$4,1,0)RETURNING id', [prefix, '状态验收', `138${String(Date.now()).slice(-8)}`, password])).rows[0].id);
    const role = (await db.query("SELECT id FROM pms_role WHERE code='admin' AND is_deleted=0")).rows[0];
    await db.query('INSERT INTO pms_user_role(user_id,role_id)VALUES($1,$2)', [userId, role.id]);
    const archive = (await db.query('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1')).rows[0];
    for (const [index, status, parentIndex] of [[0, 1, null], [1, 3, 0], [2, 4, 0], [3, 3, null], [4, 1, 3], [5, 3, 3], [6, 4, null]] as const) {
      const name = `${prefix}-${index}`;
      const result = await db.query('INSERT INTO pms_task(name,status,parent_task_id,source_type,task_type,creator_id)VALUES($1,$2,$3,3,$4,$5)RETURNING id', [name, status, parentIndex === null ? null : tasks[parentIndex].id, archive.id, userId]);
      const id = Number(result.rows[0].id);
      await db.query('INSERT INTO pms_task_owner(task_id,user_id)VALUES($1,$2)', [id, userId]);
      tasks.push({ id, name, status });
    }
    const captcha = (await (await page.request.get('/api/auth/captcha')).json()).data;
    const login = await page.request.post('/api/auth/login', { data: { account: prefix, password: 'vv123456', captcha_id: captcha.captcha_id, captcha_code: '22222' } });
    expect(login.ok()).toBeTruthy();
    const auth = (await login.json()).data;
    session = auth;
    await page.addInitScript(auth => {
      localStorage.setItem('access_token', auth.token);
      localStorage.setItem('user_info', JSON.stringify(auth.user));
      localStorage.setItem('user_menus', JSON.stringify(auth.menus));
      localStorage.setItem('user_permissions', '[]');
      localStorage.setItem('access_session_id', auth.access_session_id || '');
      localStorage.setItem('must_change_password', '0');
    }, auth);
    const rows = page.locator('tbody tr.ant-table-row');
    const stateField = page.locator('.admin-compact-filter__item').filter({ has: page.locator('.admin-compact-filter__label', { hasText: /^状态：$/ }) });
    await page.goto(`/tasks?view=all&q_name=${prefix}&sort=name&order=ascend`);
    await expect(rows).toHaveCount(3);
    await expect(page.getByRole('button', { name: `展开 ${tasks[0].name} 的子任务`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '展开', exact: true }).click();
    for (const label of ['已暂停', '已关闭']) {
      const input = stateField.getByRole('combobox');
      await input.focus();
      await input.press('ArrowDown');
      await input.fill(label);
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
      await expect(stateField.locator(`.ant-select-selection-item[title="${label}"]`)).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(rows).toHaveCount(3); // 草稿不能提前切换展示模式。
    await page.getByRole('button', { name: /^查\s*询$/ }).click();
    await expect(rows).toHaveCount(5);
    for (const record of tasks) {
      const link = rows.locator('.admin-text-action').filter({ hasText: record.name });
      if ([3, 4].includes(record.status)) await expect(link).toBeVisible();
      else await expect(link).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: /展开 .* 的子任务/ })).toHaveCount(0);
    await expect(page).toHaveURL(/q_status=3%2C4/);
    await page.reload();
    await expect(rows).toHaveCount(5);
    const returnUrl = page.url();
    await rows.first().locator('.admin-text-action').first().click();
    await expect(page.locator('.admin-template-detail-page__panel').first()).toBeVisible();
    await expect(page.locator('.admin-detail-neighbor-nav__position')).toHaveText('1 / 5');
    await page.getByRole('button', { name: '下一条', exact: true }).click();
    await expect(page.getByText(tasks[2].name, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /返回列表/ }).click();
    await expect(rows).toHaveCount(5);
    expect(page.url()).toBe(returnUrl);
    await page.goto(`/tasks?view=all&q_name=${prefix}&q_status=3,4&sort=name&order=ascend&pageSize=2`);
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(tasks[1].name);
    await page.locator('.ant-pagination-next button').click();
    await expect(rows.first()).toContainText(tasks[3].name);
    await page.getByRole('columnheader', { name: '任务名称', exact: true }).click();
    await expect(rows.first()).toContainText(tasks[6].name);
    await expect(page).not.toHaveURL(/page=2/);
    await page.goto(`/tasks?view=all&q_name=${prefix}&q_status=3,4&sort=name&order=ascend`);
    await expect(rows).toHaveCount(5);
    await page.getByRole('button', { name: '展开', exact: true }).click();
    await stateField.locator('.ant-select-selector').hover();
    await stateField.locator('.ant-select-clear').click();
    await page.getByRole('button', { name: /^查\s*询$/ }).click();
    await expect(rows).toHaveCount(3);
    await page.getByRole('button', { name: `展开 ${tasks[0].name} 的子任务`, exact: true }).click();
    await expect(rows).toHaveCount(5);
    expect(errors).toEqual([]);
  } finally {
    if (session) await page.request.post('/api/auth/logout', { headers: { Authorization: `Bearer ${session.token}` }, data: { session_id: session.access_session_id } }).catch(() => undefined);
    for (const task of [...tasks].reverse()) await db.query('DELETE FROM pms_task WHERE id=$1', [task.id]);
    if (userId) {
      await db.query('DELETE FROM pms_access_log WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM pms_user_role WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM pms_user WHERE id=$1', [userId]);
    }
    await db.end();
  }
});

import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);

test('真实任务状态变更：同状态最近更新优先，跨页定位、高亮、子任务展开及筛选移出提示', async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(process.env.INTEGRATION_DB_ISOLATED).toBe('1');
  const { Pool } = require('../../backend/node_modules/pg');
  const db = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, options: process.env.DB_OPTIONS });
  expect(['localhost', '127.0.0.1', '::1']).toContain(db.options.host);
  const prefix = `locate-e2e-${Date.now()}`;
  const tasks: Array<{ id: number; name: string }> = [];
  let userId: number | undefined;
  let auth: any;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const password = await require('../../backend/node_modules/bcryptjs').hash('vv123456', 4);
    userId = Number((await db.query('INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login)VALUES($1,$2,$3,$4,1,0)RETURNING id', [prefix, '定位验收', `137${String(Date.now()).slice(-8)}`, password])).rows[0].id);
    const role = (await db.query("SELECT id FROM pms_role WHERE code='admin' AND is_deleted=0")).rows[0];
    await db.query('INSERT INTO pms_user_role(user_id,role_id)VALUES($1,$2)', [userId, role.id]);
    const archive = (await db.query('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1')).rows[0];
    for (const [index, status, parentIndex, updated] of [
      [0, 0, null, '2026-02-01'], [1, 0, null, '2026-01-03'],
      [2, 0, null, '2026-01-01'], [3, 0, 2, '2026-01-01'],
      [4, 0, null, '2026-01-02'], [5, 1, null, '2026-01-01'], [6, 1, null, '2026-01-02']
    ] as const) {
      const name = `${prefix}-${index}`;
      const result = await db.query('INSERT INTO pms_task(name,status,parent_task_id,source_type,task_type,creator_id,updated_at)VALUES($1,$2,$3,3,$4,$5,$6)RETURNING id', [name, status, parentIndex === null ? null : tasks[parentIndex].id, archive.id, userId, updated]);
      const id = Number(result.rows[0].id);
      tasks.push({ id, name });
      await db.query('INSERT INTO pms_task_owner(task_id,user_id)VALUES($1,$2)', [id, userId]);
    }
    const captcha = (await (await page.request.get('/api/auth/captcha')).json()).data;
    const login = await page.request.post('/api/auth/login', { data: { account: prefix, password: 'vv123456', captcha_id: captcha.captcha_id, captcha_code: '22222' } });
    expect(login.ok()).toBeTruthy();
    auth = (await login.json()).data;
    await page.addInitScript(auth => {
      localStorage.setItem('access_token', auth.token);
      localStorage.setItem('user_info', JSON.stringify(auth.user));
      localStorage.setItem('user_menus', JSON.stringify(auth.menus));
      localStorage.setItem('user_permissions', '[]');
      localStorage.setItem('access_session_id', auth.access_session_id || '');
      localStorage.setItem('must_change_password', '0');
    }, auth);
    const rows = page.locator('tbody tr.ant-table-row');
    const row = (index: number) => rows.locator(`:scope[data-row-key="${tasks[index].id}"]`);
    const changeToProcessing = async (index: number, waitForClose = true) => {
      await row(index).getByRole('button', { name: '状态变更', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '状态变更' });
      await dialog.getByRole('combobox').click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '处理中' }).click();
      await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
      if (waitForClose) await expect(dialog).not.toBeVisible();
    };
    const listUrl = `/tasks?view=mine&q_name=${prefix}&sort=status&order=ascend&pageSize=2`;
    // 保存响应变慢时通过浏览器后退离开列表，旧定位回调不得重新导航回来。
    await page.goto('/home');
    await page.getByRole('menuitem', { name: /任务管理/ }).click();
    await page.evaluate(path => {
      history.replaceState(history.state, '', path);
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, listUrl);
    await expect(rows.first()).toContainText(tasks[0].name);
    let releaseResponse!: () => void;
    let responseReady!: () => void;
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
    const saved = new Promise<void>(resolve => { responseReady = resolve; });
    const writeUrl = `**/api/tasks/${tasks[0].id}/status`;
    await page.route(writeUrl, async route => {
      const response = await route.fetch();
      responseReady();
      await responseGate;
      await route.fulfill({ response });
    });
    await changeToProcessing(0, false);
    await saved;
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);
    const staleLocate = page.waitForRequest(request => new URL(request.url()).pathname === '/api/tasks/neighbors', { timeout: 2000 }).then(() => true, () => false);
    releaseResponse();
    expect(await staleLocate).toBe(false);
    await expect(page).toHaveURL(/\/home$/);
    expect((await db.query('SELECT status FROM pms_task WHERE id=$1', [tasks[0].id])).rows[0].status).toBe(1);
    await page.unroute(writeUrl);
    await db.query('UPDATE pms_task SET status=0,updated_at=$1 WHERE id=$2', ['2026-02-01', tasks[0].id]);
    await page.goto(listUrl);
    await expect(rows.first()).toContainText(tasks[0].name);
    await changeToProcessing(0);
    await expect(page).toHaveURL(/page=2/);
    await expect(row(0)).toHaveClass(/task-list-row--updated/);
    await expect(row(0)).toContainText('处理中');
    await expect(row(0)).toBeInViewport();
    // 固定操作列必须使用不透明底色，不能透出被它覆盖的创建人等字段。
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.appearance = theme; }, theme);
      await expect.poll(() => row(0).locator('td').evaluateAll(cells => cells.map(cell => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        const color = getComputedStyle(cell).backgroundColor;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3];
      })), { message: `${theme} 高亮行的普通列和固定列均须完全不透明`, timeout: 1500 })
        .toEqual(Array(await row(0).locator('td').count()).fill(255));
    }
    await page.evaluate(() => { document.documentElement.dataset.appearance = 'light'; });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page).toHaveURL(/view=mine/);
    await expect(page).toHaveURL(new RegExp(`q_name=${prefix}`));
    await page.reload();
    await expect(row(0)).toContainText('处理中');
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole('columnheader', { name: '状态', exact: true })).toHaveAttribute('aria-sort', 'ascending');
    // 进入详情后上下条与新排序一致，返回保留定位页。
    await row(0).locator('.admin-text-action').first().click();
    await expect(page.locator('.admin-detail-neighbor-nav__position')).toHaveText('5 / 7');
    await page.getByRole('button', { name: '下一条', exact: true }).click();
    await expect(page.getByText(tasks[6].name, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /返回列表/ }).click();
    await expect(row(0)).toBeVisible();
    await page.getByRole('button', { name: `展开 ${tasks[2].name} 的子任务`, exact: true }).click();
    await changeToProcessing(3);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(row(3)).toHaveClass(/task-list-row--updated/);
    await expect(row(3)).toBeInViewport();
    await expect(rows.first()).toContainText(tasks[2].name);
    await expect(rows.nth(1)).toContainText(tasks[3].name);
    const screenshot = process.env.TASK_FOCUS_SCREENSHOT;
    if (screenshot) await page.screenshot({ path: screenshot, animations: 'disabled' });
    await expect(row(3)).not.toHaveClass(/task-list-row--updated/, { timeout: 7000 });
    // 当前状态筛选会排除刚修改的记录，保留筛选并解释去向。
    await page.goto(`/tasks?view=mine&q_name=${prefix}&q_status=0&sort=status&order=ascend&pageSize=2`);
    await changeToProcessing(1);
    await expect(page.getByText('任务状态已更新，已不符合当前筛选条件', { exact: true })).toBeVisible();
    await expect(row(1)).toHaveCount(0);
    await expect(page).toHaveURL(/q_status=0/);
    await expect(page.locator('.task-list-row--updated')).toHaveCount(0);
    // 定位服务异常不应把已保存的变更报成失败，也不能重复执行写入。
    await page.route('**/api/tasks/neighbors?**', route => route.fulfill({ status: 500, json: { code: 500, message: '定位测试失败' } }));
    await changeToProcessing(4);
    await expect(page.getByText('任务状态已更新，列表定位失败，请刷新后查询', { exact: true })).toBeVisible();
    expect((await db.query('SELECT status FROM pms_task WHERE id=$1', [tasks[4].id])).rows[0].status).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    if (auth) await page.request.post('/api/auth/logout', { headers: { Authorization: `Bearer ${auth.token}` }, data: { session_id: auth.access_session_id } }).catch(() => undefined);
    for (const task of [...tasks].reverse()) {
      await db.query("DELETE FROM pms_op_log WHERE module='任务' AND target_id=$1", [task.id]);
      await db.query('DELETE FROM pms_task WHERE id=$1', [task.id]);
    }
    if (userId) {
      await db.query('DELETE FROM pms_access_log WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM pms_user_role WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM pms_user WHERE id=$1', [userId]);
    }
    await db.end();
  }
});

import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);

test('真实列表排序：姓名、权限、时长及分页、地址恢复保持一致', async ({ page }) => {
  test.setTimeout(90_000);
  expect(process.env.INTEGRATION_DB_ISOLATED).toBe('1');
  const db = require('../../backend/src/db');
  expect(['localhost', '127.0.0.1', '::1']).toContain(db.pool.options.host);
  const prefix = `sorting-e2e-${Date.now()}`;
  const admin = await db.prepare("SELECT id,password,first_login FROM pms_user WHERE employee_no='admin'").get();
  const users: number[] = [], roles: number[] = [], menus: number[] = [], orders: number[] = [];
  let productId: number | undefined;
  let token = '', sessionId = '';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const captcha = (await (await page.request.get('/api/auth/captcha')).json()).data;
    const response = await page.request.post('/api/auth/login', { data: { account: 'admin', password: 'vv123456', captcha_id: captcha.captcha_id, captcha_code: '22222' } });
    expect(response.ok()).toBeTruthy();
    const session = (await response.json()).data;
    token = session.token;
    sessionId = session.access_session_id;
    if (session.first_login === 1) {
      const changed = await page.request.put('/api/auth/password', { headers: { Authorization: `Bearer ${token}` }, data: { old_password: 'vv123456', new_password: 'vv1234567' } });
      expect(changed.ok()).toBeTruthy();
    }
    for (const [index, name] of ['Zulu', 'Alpha'].entries()) {
      const user = await db.prepare('INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login) VALUES(?,?,?,?,1,0)').run(`${prefix}-${index}`, name, `136${String(Date.now() + index).slice(-8)}`, admin.password);
      users.push(Number(user.lastInsertRowid));
    }
    const archive = await db.prepare('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1').get();
    const product = await db.prepare('INSERT INTO pms_product(name,owner_id,creator_id,updater_id) VALUES(?,?,?,?)').run(prefix, admin.id, admin.id, admin.id);
    productId = Number(product.lastInsertRowid);
    for (const [index, follower] of users.entries()) {
      const order = await db.prepare('INSERT INTO pms_work_order(product_id,problem_type,problem_desc,follower_id,submitter_name,submitter_dept,submit_time,creator_id) VALUES(?,?,?,?,?,?,NOW(),?)').run(productId, archive.id, `${prefix}-work-${index}`, follower, '排序验收', '隔离环境', admin.id);
      orders.push(Number(order.lastInsertRowid));
    }
    for (const [index, parentName, leafName] of [[0, 'Zulu-parent', 'Alpha-leaf'], [1, 'Alpha-parent', 'Zulu-leaf']] as const) {
      const role = await db.prepare('INSERT INTO pms_role(code,name,creator_id) VALUES(?,?,?)').run(`${prefix}-${index}`, `${prefix}-role-${index}`, admin.id);
      roles.push(Number(role.lastInsertRowid));
      const parent = await db.prepare('INSERT INTO pms_menu(name,code,sort_order) VALUES(?,?,?)').run(parentName, `${prefix}-parent-${index}`, index * 2);
      const leaf = await db.prepare('INSERT INTO pms_menu(parent_id,name,code,sort_order) VALUES(?,?,?,?)').run(parent.lastInsertRowid, leafName, `${prefix}-leaf-${index}`, index * 2 + 1);
      for (const menu of [parent.lastInsertRowid, leaf.lastInsertRowid]) {
        menus.push(Number(menu));
        await db.prepare('INSERT INTO pms_role_menu(role_id,menu_id) VALUES(?,?)').run(role.lastInsertRowid, menu);
      }
    }
    for (const seconds of [3600, 2]) await db.prepare("INSERT INTO pms_access_log(account,event_type,result,duration_seconds) VALUES(?,'login','success',?)").run(prefix, seconds);
    await page.addInitScript(session => {
      localStorage.setItem('access_token', session.token);
      localStorage.setItem('user_info', JSON.stringify(session.user));
      localStorage.setItem('user_menus', JSON.stringify(session.menus));
      localStorage.setItem('user_permissions', JSON.stringify(session.menus.flatMap((m: { code: string; path?: string }) => [m.code, m.path].filter(Boolean))));
      localStorage.setItem('must_change_password', '0');
    }, session);

    const firstRow = page.locator('tbody tr.ant-table-row').first();
    for (const [url, title, low, high] of [
      [`/work-orders?view=all&q_problemDesc=${prefix}-work&sort=followerId&order=ascend&pageSize=1`, '跟进人', 'Alpha', 'Zulu'],
      [`/roles?q_name=${prefix}-role&sort=permissions&order=ascend&pageSize=1`, '权限范围', 'Alpha-leaf', 'Zulu-leaf'],
      [`/access-logs?q_account=${prefix}&sort=durationText&order=ascend&pageSize=1`, '在线时长', '2秒', '1小时0分钟']
    ]) {
      await page.goto(url);
      const header = page.getByRole('columnheader', { name: title, exact: true });
      await expect(firstRow).toContainText(low);
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await page.locator('.ant-pagination-next button').click();
      await expect(firstRow).toContainText(high);
      await header.click();
      await expect(firstRow).toContainText(high);
      await expect(page).not.toHaveURL(/page=2/);
      await expect(header).toHaveAttribute('aria-sort', 'descending');
      await page.reload();
      await expect(firstRow).toContainText(high);
      await expect(header).toHaveAttribute('aria-sort', 'descending');
    }
    await page.goto(`/roles?q_name=${prefix}-role&sort=permissions&order=ascend`);
    const permissionHeader = page.getByRole('columnheader', { name: '权限范围', exact: true });
    await expect(permissionHeader).toHaveAttribute('aria-sort', 'ascending');
    await permissionHeader.evaluate(element => element.setAttribute('data-sort-focus-probe', 'same-table'));
    await permissionHeader.click();
    await expect(permissionHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(permissionHeader).toHaveAttribute('data-sort-focus-probe', 'same-table');
    await page.goBack();
    await expect(firstRow).toContainText('Alpha-leaf');
    await expect(permissionHeader).toHaveAttribute('aria-sort', 'ascending');
    await page.goForward();
    await expect(firstRow).toContainText('Zulu-leaf');
    await expect(permissionHeader).toHaveAttribute('aria-sort', 'descending');
    await permissionHeader.focus();
    await permissionHeader.press('Enter');
    await expect.poll(() => permissionHeader.getAttribute('aria-sort')).toBeNull();
    await expect(permissionHeader).toBeFocused();
    await permissionHeader.press('Enter');
    await expect(firstRow).toContainText('Alpha-leaf');
    await expect(permissionHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(permissionHeader).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    if (token) await page.request.post('/api/auth/logout', { headers: { Authorization: `Bearer ${token}` }, data: { session_id: sessionId } }).catch(() => undefined);
    for (const id of orders) await db.prepare('DELETE FROM pms_work_order WHERE id=?').run(id);
    if (productId) await db.prepare('DELETE FROM pms_product WHERE id=?').run(productId);
    for (const id of roles) {
      await db.prepare('DELETE FROM pms_role_menu WHERE role_id=?').run(id);
      await db.prepare('DELETE FROM pms_role WHERE id=?').run(id);
    }
    for (const id of menus.reverse()) await db.prepare('DELETE FROM pms_menu WHERE id=?').run(id);
    for (const id of users) await db.prepare('DELETE FROM pms_user WHERE id=?').run(id);
    await db.prepare('DELETE FROM pms_access_log WHERE account=?').run(prefix);
    await db.prepare('UPDATE pms_user SET password=?,first_login=? WHERE id=?').run(admin.password, admin.first_login, admin.id);
    await db.pool.end();
  }
});

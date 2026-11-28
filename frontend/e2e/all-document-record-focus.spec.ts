import { createRequire } from 'node:module';
import { expect, test as base, type Locator, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
type Kind = 'products' | 'requirements' | 'projects' | 'tasks' | 'bugs' | 'work-orders';
type Row = { id: string; name: string };
const documents = {
  products: { label: '产品', table: 'pms_product', filter: 'name', initial: 0, target: 1, text: '启用' },
  requirements: { label: '需求', table: 'pms_requirement', filter: 'title', initial: 30, target: 31, text: '实施中' },
  projects: { label: '项目', table: 'pms_project', filter: 'name', initial: 0, target: 1, text: '进行中' },
  tasks: { label: '任务', table: 'pms_task', filter: 'name', initial: 0, target: 1, text: '处理中' },
  bugs: { label: 'BUG', table: 'pms_bug', filter: 'title', initial: 0, target: 2, text: '已关闭' },
  'work-orders': { label: '工单', table: 'pms_work_order', filter: 'problemDesc', initial: 0, target: 1, text: '处理中' }
} as const;
type FocusFixture = {
  db: any;
  prefix: string;
  userId: number;
  productId: number;
  projectId: number;
  archiveId: number;
  insert: (table: string, values: Record<string, unknown>) => Promise<number>;
  seed: (kind: Kind, count?: number, tag?: string) => Promise<{ rows: Row[]; url: string }>;
};

const test = base.extend<{ records: FocusFixture }>({
  records: async ({ page }, use) => {
    expect(process.env.INTEGRATION_DB_ISOLATED).toBe('1');
    expect(Number(process.env.DB_PORT)).not.toBe(5433);
    const { Pool } = require('../../backend/node_modules/pg');
    const db = new Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, options: process.env.DB_OPTIONS });
    expect(['localhost', '127.0.0.1', '::1']).toContain(db.options.host);
    // CI owns a disposable PostgreSQL service; local runs use a dedicated schema.
    if (!process.env.CI) expect((await db.query('SELECT current_schema() AS name')).rows[0].name).not.toBe('public');
    const prefix = `focus-e2e-${Date.now()}`;
    const created: Array<{ table: string; id: number }> = [];
    let auth: any;
    let userId: number | undefined;
    const insert = async (table: string, values: Record<string, unknown>) => {
      const columns = Object.keys(values);
      const result = await db.query(`INSERT INTO ${table}(${columns.join(',')})VALUES(${columns.map((_, index) => `$${index + 1}`).join(',')})RETURNING id`, Object.values(values));
      const id = Number(result.rows[0].id);
      created.push({ table, id });
      return id;
    };
    try {
      const password = await require('../../backend/node_modules/bcryptjs').hash('vv123456', 4);
      userId = await insert('pms_user', { employee_no: prefix, real_name: '全单据定位验收', phone: `138${String(Date.now()).slice(-8)}`, password, status: 1, first_login: 0 });
      const role = (await db.query("SELECT id FROM pms_role WHERE code='admin' AND is_deleted=0")).rows[0];
      expect(role).toBeTruthy();
      await db.query('INSERT INTO pms_user_role(user_id,role_id)VALUES($1,$2)', [userId, role.id]);
      const archiveTypeId = await insert('pms_archive_type', { code: prefix, code_prefix: 'FOCUS', name: prefix });
      const archiveId = await insert('pms_archive', { code: prefix, name: '定位验收专属档案', archive_type_id: archiveTypeId });
      const productId = await insert('pms_product', { name: `${prefix}-anchor`, owner_id: userId, creator_id: userId });
      const projectId = await insert('pms_project', { name: `${prefix}-anchor`, product_id: productId, owner_id: userId, expected_end_date: '2099-12-31', creator_id: userId });
      const seed: FocusFixture['seed'] = async (kind, count = 4, tag = 'main') => {
        const config = documents[kind];
        const namePrefix = `${prefix}-${kind}-${tag}`;
        const rows: Row[] = [];
        for (let index = 0; index < count; index++) {
          const name = `${namePrefix}-${index}`;
          const common = { status: index === count - 1 ? config.target : config.initial, creator_id: userId, updated_at: index === 0 ? '2026-02-01' : `2026-01-${String(25 - index).padStart(2, '0')}` };
          const values: Record<Kind, Record<string, unknown>> = {
            products: { ...common, name, owner_id: userId },
            requirements: { ...common, title: name, requirement_type: 4, product_id: productId, owner_id: userId, submitter_name: '隔离验收', submit_date: '2026-01-01', expected_end_date: '2099-12-31' },
            projects: { ...common, name, product_id: productId, owner_id: userId, expected_end_date: '2099-12-31' },
            tasks: { ...common, name, source_type: 3, task_type: archiveId },
            bugs: { ...common, title: name, source_type: 1, project_id: projectId, bug_type_id: archiveId, severity: 2, assignee_id: userId },
            'work-orders': { ...common, product_id: productId, problem_type: archiveId, problem_desc: name, follower_id: userId, submitter_name: '隔离验收', submitter_dept: '隔离环境', submit_time: '2026-01-01' }
          };
          const id = await insert(config.table, values[kind]);
          if (kind === 'tasks') await db.query('INSERT INTO pms_task_owner(task_id,user_id)VALUES($1,$2)', [id, userId]);
          rows.push({ id: String(id), name });
        }
        return { rows, url: `/${kind}?view=all&q_${config.filter}=${namePrefix}&sort=status&order=ascend&pageSize=2` };
      };
      const captcha = (await (await page.request.get('/api/auth/captcha')).json()).data;
      const login = await page.request.post('/api/auth/login', { data: { account: prefix, password: 'vv123456', captcha_id: captcha.captcha_id, captcha_code: '22222' } });
      expect(login.ok()).toBeTruthy();
      auth = (await login.json()).data;
      await page.addInitScript(auth => {
        localStorage.setItem('access_token', auth.token);
        localStorage.setItem('user_info', JSON.stringify(auth.user));
        localStorage.setItem('user_menus', JSON.stringify(auth.menus));
        localStorage.setItem('user_permissions', JSON.stringify([...new Set(auth.menus.flatMap((menu: { code?: string; path?: string }) => [menu.code, menu.path].filter(Boolean)))]));
        localStorage.setItem('access_session_id', auth.access_session_id || '');
        localStorage.setItem('must_change_password', '0');
      }, auth);
      await page.setViewportSize({ width: 1920, height: 1080 });
      page.setDefaultTimeout(10_000);
      await use({ db, prefix, userId, productId, projectId, archiveId, insert, seed });
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      if (auth) await page.request.post('/api/auth/logout', { headers: { Authorization: `Bearer ${auth.token}` }, data: { session_id: auth.access_session_id } }).catch(() => undefined);
      if (userId) {
        await db.query('DELETE FROM pms_op_log WHERE user_id=$1', [userId]);
        await db.query('DELETE FROM pms_access_log WHERE user_id=$1', [userId]);
        await db.query('DELETE FROM pms_user_role WHERE user_id=$1', [userId]);
      }
      for (const record of created.reverse()) await db.query(`DELETE FROM ${record.table} WHERE id=$1`, [record.id]);
      await db.end();
    }
  }
});

const recordRow = (page: Page, row: Row) => page.locator(`tbody tr.ant-table-row[data-row-key="${row.id}"]`);
async function chooseStatus(page: Page, trigger: Locator, target: string, dialogTitle = '状态变更', confirm = true, closedDateRequired = false) {
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: dialogTitle });
  await dialog.getByRole('combobox').first().click();
  await page.locator('.ant-select-dropdown:visible').getByText(target, { exact: true }).click();
  if (closedDateRequired) {
    const date = dialog.getByRole('textbox', { name: /关闭时间/ });
    await date.fill('2026-11-27');
    await date.press('Enter');
  }
  if (target === '已终止') {
    const date = dialog.getByRole('textbox', { name: /终止时间/ });
    await date.fill('2026-11-27');
    await date.press('Enter');
    await dialog.getByRole('textbox', { name: /终止原因/ }).fill('隔离环境验证状态更新定位');
  }
  await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
  if (confirm) await expect(dialog).not.toBeVisible();
}
async function changeStatus(page: Page, kind: Kind, row?: Row, waitForClose = true) {
  const scope = row ? recordRow(page, row) : page;
  if (kind === 'products') {
    await scope.getByRole('button', { name: row ? /^启\s*用$/ : '启用产品', exact: !row }).click();
    const dialog = page.getByRole('dialog', { name: '确认启用产品' });
    await dialog.getByRole('button', { name: /^启\s*用$/ }).click();
    if (waitForClose) await expect(dialog).not.toBeVisible();
    return;
  }
  let trigger = scope.getByRole('button', { name: '状态变更', exact: true });
  if (row && !(await trigger.isVisible())) {
    await scope.getByRole('button', { name: '更多', exact: true }).click();
    trigger = page.locator('.admin-operation-column-actions__popover:visible').getByRole('button', { name: '状态变更', exact: true });
  }
  await chooseStatus(page, trigger, documents[kind].text, '状态变更', waitForClose, kind === 'bugs');
}

for (const kind of Object.keys(documents) as Kind[]) {
  test(`${documents[kind].label}：真实状态变更跨页定位、详情保存返回原查询、筛选移出`, async ({ page, records }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const { rows, url } = await records.seed(kind);
    const config = documents[kind];
    await page.goto(url);
    await expect(page.locator('tbody tr.ant-table-row').first()).toContainText(rows[0].name);
    await changeStatus(page, kind, rows[0]);
    await expect(page).toHaveURL(/page=2/);
    await expect(recordRow(page, rows[0])).toHaveClass(/admin-record-row--updated/);
    await expect(recordRow(page, rows[0])).toContainText(config.text);
    await expect(recordRow(page, rows[0])).toBeInViewport();
    expect(Number((await records.db.query(`SELECT status FROM ${config.table} WHERE id=$1`, [rows[0].id])).rows[0].status)).toBe(config.target);

    // 详情页只保存返回意图，用户主动返回后才恢复完整查询并定位。
    await records.db.query(`UPDATE ${config.table} SET status=$1,updated_at=$2${kind === 'bugs' ? ',closed_date=NULL' : ''} WHERE id=$3`, [config.initial, '2026-02-01', rows[0].id]);
    await page.goto(url);
    await recordRow(page, rows[0]).getByRole('button', { name: rows[0].name, exact: true }).click();
    const detailPath = new URL(page.url()).pathname;
    expect(detailPath).toBe(`/${kind}/${rows[0].id}`);
    await expect(page.getByRole('button', { name: /返回列表/ })).toBeVisible();
    await changeStatus(page, kind);
    expect(new URL(page.url()).pathname).toBe(detailPath);
    if (['requirements', 'tasks', 'bugs', 'work-orders'].includes(kind)) await expect(page.locator('.admin-detail-neighbor-nav__position')).toHaveText('3 / 4');
    await page.getByRole('button', { name: /返回列表/ }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(recordRow(page, rows[0])).toHaveClass(/admin-record-row--updated/);
    const restored = new URL(page.url()).searchParams;
    expect(restored.get(`q_${config.filter}`)).toBe(new URL(url, 'http://local').searchParams.get(`q_${config.filter}`));
    expect(restored.get('view')).toBe('all');
    expect(restored.get('sort')).toBe('status');
    expect(restored.get('order')).toBe('ascend');
    expect(restored.get('pageSize')).toBe('2');
    await page.reload();
    await expect(recordRow(page, rows[0])).toContainText(config.text);
    await expect(recordRow(page, rows[0])).not.toHaveClass(/admin-record-row--updated/);

    await page.goto(`${url}&q_status=${config.initial}`);
    await expect(recordRow(page, rows[1])).toBeVisible();
    await changeStatus(page, kind, rows[1]);
    await expect(page.getByText('状态已更新，已不符合当前筛选条件', { exact: true })).toBeVisible();
    await expect(recordRow(page, rows[1])).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('q_status')).toBe(String(config.initial));
    await expect(page.locator('.admin-record-row--updated')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const kind of ['tasks', 'bugs', 'work-orders'] as const) {
  test(`${documents[kind].label}：批量按变更后的首个匹配项定位并高亮本页全部变更记录`, async ({ page, records }) => {
    test.setTimeout(90_000);
    for (const count of [4, 5]) {
      const { rows, url } = await records.seed(kind, count, `batch-${count}`);
      await page.goto(url);
      await expect(recordRow(page, rows[0])).toBeVisible();
      await recordRow(page, rows[0]).getByRole('checkbox').check();
      await recordRow(page, rows[1]).getByRole('checkbox').check();
      // 第二项稍晚写入，使新排序首项与传入 ids 首项不同。
      const delayed = `**/api/${kind}/${rows[1].id}/status`;
      await page.route(delayed, async route => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const response = await route.fetch();
        await route.fulfill({ response });
      });
      await chooseStatus(page, page.getByRole('button', { name: '批量状态变更', exact: true }), documents[kind].text, '状态变更', true, kind === 'bugs');
      await expect(recordRow(page, rows[1])).toHaveClass(/admin-record-row--updated/);
      if (count === 4) {
        await expect(page).not.toHaveURL(/page=2/);
        await expect(recordRow(page, rows[0])).toHaveCount(0);
      } else {
        await expect(page).toHaveURL(/page=2/);
        await expect(recordRow(page, rows[0])).toHaveClass(/admin-record-row--updated/);
      }
      for (const row of rows.slice(0, 2)) expect(Number((await records.db.query(`SELECT status FROM ${documents[kind].table} WHERE id=$1`, [row.id])).rows[0].status)).toBe(documents[kind].target);
      await page.unroute(delayed);
    }
  });
}

test('定位响应乱序：变更筛选并完成新操作后，旧定位不得回跳或覆盖新高亮', async ({ page, records }) => {
  test.setTimeout(60_000);
  const { rows, url } = await records.seed('products');
  let release!: () => void;
  let ready!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { ready = resolve; });
  let count = 0;
  await page.route('**/api/products/neighbors?**', async route => {
    const response = await route.fetch();
    if (++count === 1) { ready(); await gate; }
    await route.fulfill({ response });
  });
  try {
    await page.goto(url);
    await changeStatus(page, 'products', rows[0], false);
    await requested;
    const filtered = `/products?view=all&q_name=${rows[1].name}&sort=status&order=ascend&pageSize=2`;
    await page.evaluate(path => {
      history.pushState(history.state, '', path);
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, filtered);
    await expect(recordRow(page, rows[1])).toBeVisible();
    await changeStatus(page, 'products', rows[1]);
    await expect(recordRow(page, rows[1])).toHaveClass(/admin-record-row--updated/);
    const staleResponse = page.waitForResponse(response => {
      const responseUrl = new URL(response.url());
      return responseUrl.pathname === '/api/products/neighbors' && responseUrl.searchParams.get('ids') === rows[0].id;
    });
    release();
    await staleResponse;
    await page.waitForLoadState('networkidle');
    await expect.poll(() => new URL(page.url()).searchParams.get('q_name')).toBe(rows[1].name);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(recordRow(page, rows[1])).toHaveClass(/admin-record-row--updated/);
    await expect(recordRow(page, rows[0])).toHaveCount(0);
    expect((await records.db.query('SELECT status FROM pms_product WHERE id=ANY($1::bigint[])', [rows.slice(0, 2).map(row => row.id)])).rows.every((row: { status: number }) => row.status === 1)).toBe(true);
  } finally { release(); }
});

test('局部表格：项目关键事项、产品运维合同、任务详情子任务使用共享行高亮', async ({ page, records }) => {
  test.setTimeout(90_000);
  const stageId = await records.insert('pms_project_plan_stage', { project_id: records.projectId, name: `${records.prefix}-stage`, creator_id: records.userId });
  const itemId = await records.insert('pms_project_plan_item', { stage_id: stageId, name: `${records.prefix}-item`, owner_id: records.userId, original_due_date: '2099-12-31', current_due_date: '2099-12-31', creator_id: records.userId });
  await page.goto(`/projects/${records.projectId}/stage-plan`);
  const planRow = page.locator('tbody tr.ant-table-row').filter({ hasText: `${records.prefix}-item` });
  await chooseStatus(page, planRow.getByRole('button', { name: '状态变更', exact: true }), '进行中');
  await expect(planRow).toHaveClass(/admin-record-row--updated/);
  expect(Number((await records.db.query('SELECT status FROM pms_project_plan_item WHERE id=$1', [itemId])).rows[0].status)).toBe(1);

  const contractId = await records.insert('pms_product_maintenance_contract', { product_id: records.productId, contract_code: records.prefix, contract_name: `${records.prefix}-contract`, supplier_id: records.archiveId, signed_date: '2026-01-01', service_start_date: '2026-01-01', service_end_date: '2099-12-31', contract_amount: 1000, creator_id: records.userId });
  await page.goto(`/products/${records.productId}/maintenance-contracts`);
  const contractRow = page.locator(`tbody tr.ant-table-row[data-row-key="${contractId}"]`);
  let terminate = contractRow.getByRole('button', { name: '终止合同', exact: true });
  if (!(await terminate.isVisible())) {
    await contractRow.getByRole('button', { name: '更多', exact: true }).click();
    terminate = page.locator('.admin-operation-column-actions__popover:visible').getByRole('button', { name: '终止合同', exact: true });
  }
  await chooseStatus(page, terminate, '已终止', '终止运维合同');
  await expect(contractRow).toHaveClass(/admin-record-row--updated/);
  await expect(contractRow).toContainText('已终止');
  expect((await records.db.query('SELECT termination_reason FROM pms_product_maintenance_contract WHERE id=$1', [contractId])).rows[0].termination_reason).toBe('隔离环境验证状态更新定位');

  const { rows } = await records.seed('tasks', 3, 'children');
  await records.db.query('UPDATE pms_task SET parent_task_id=$1 WHERE id=$2', [rows[0].id, rows[1].id]);
  await page.goto(`/tasks/${rows[0].id}`);
  await expect(recordRow(page, rows[1])).toBeVisible();
  await changeStatus(page, 'tasks', rows[1]);
  await expect(recordRow(page, rows[1])).toHaveClass(/admin-record-row--updated/);
  await expect(recordRow(page, rows[1])).toBeInViewport();
  expect(Number((await records.db.query('SELECT status FROM pms_task WHERE id=$1', [rows[1].id])).rows[0].status)).toBe(1);
});

test('子任务详情返回主任务、合同详情返回合同列表仍定位刚修改的记录', async ({ page, records }) => {
  const { rows } = await records.seed('tasks', 4, 'nested-return');
  await records.db.query('UPDATE pms_task SET parent_task_id=$1 WHERE id=ANY($2::bigint[])', [rows[0].id, [rows[1].id, rows[2].id]]);
  await page.goto(`/tasks/${rows[0].id}`);
  await recordRow(page, rows[1]).getByRole('button', { name: rows[1].name, exact: true }).click();
  await expect(page.getByRole('button', { name: /^返\s*回$/ })).toBeVisible();
  await changeStatus(page, 'tasks');
  await page.getByRole('button', { name: /^返\s*回$/ }).click();
  await expect(recordRow(page, rows[1])).toHaveClass(/admin-record-row--updated/);
  await expect(recordRow(page, rows[1])).toBeInViewport();

  const contractId = await records.insert('pms_product_maintenance_contract', { product_id: records.productId, contract_code: records.prefix, contract_name: `${records.prefix}-return-contract`, supplier_id: records.archiveId, signed_date: '2026-01-01', service_start_date: '2026-01-01', service_end_date: '2099-12-31', contract_amount: 1000, creator_id: records.userId });
  const contractListPath = `/products/${records.productId}/maintenance-contracts`;
  await page.goto(contractListPath);
  const contractRow = page.locator(`tbody tr.ant-table-row[data-row-key="${contractId}"]`);
  await contractRow.getByRole('button', { name: records.prefix, exact: true }).click();
  await expect(page.getByRole('button', { name: /返回列表/ })).toBeVisible();
  await chooseStatus(page, page.getByRole('button', { name: '终止合同', exact: true }), '已终止', '终止运维合同');
  await page.getByRole('button', { name: /返回列表/ }).click();
  await expect(page).toHaveURL(new RegExp(`${contractListPath}$`));
  await expect(contractRow).toHaveClass(/admin-record-row--updated/);
  await expect(contractRow).toContainText('已终止');
});

test('组件工作台：共享定位示例支持状态重排、跨页定位、批量高亮及自动消退', async ({ page, records }) => {
  test.setTimeout(60_000);
  expect(records.userId).toBeGreaterThan(0);
  await page.goto('/system/design-system?category=layout&sort=status&order=ascend&pageSize=2');
  const demo = page.locator('.design-system-page__layout-pattern-template').filter({ has: page.getByRole('heading', { name: 'TemplateListPage', exact: true }) });
  const row = demo.locator('tbody tr.ant-table-row').first();
  await expect(row).toBeVisible();
  const id = await row.getAttribute('data-row-key');
  await chooseStatus(page, row.getByRole('button', { name: '状态变更', exact: true }), '处理中');
  const updated = demo.locator(`tbody tr.ant-table-row[data-row-key="${id}"]`);
  await expect(updated).toHaveClass(/admin-record-row--updated/);
  await expect(updated).toBeInViewport();
  expect(Number(new URL(page.url()).searchParams.get('page'))).toBeGreaterThan(1);
  await expect(updated).not.toHaveClass(/admin-record-row--updated/, { timeout: 7000 });
  await demo.getByText('批量列表', { exact: true }).click();
  await demo.locator('tbody tr.ant-table-row').nth(0).getByRole('checkbox').check();
  await demo.locator('tbody tr.ant-table-row').nth(1).getByRole('checkbox').check();
  await chooseStatus(page, demo.getByRole('button', { name: '批量状态变更', exact: true }), '已关闭');
  await expect(demo.locator('.admin-record-row--updated')).toHaveCount(2);
});

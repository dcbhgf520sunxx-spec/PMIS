import { expect, test, type Page } from '@playwright/test';

// 只隔离前端用例的账号和数据；真实 SQL、权限与详情接口由后端隔离集成测试验证。
async function prepare(page: Page, endpoint: string, data: unknown) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'sorting-ui-fixture');
    localStorage.setItem('user_info', JSON.stringify({ id: 1, employee_no: 'sort-test', real_name: '排序验收', roles: ['admin'] }));
    localStorage.setItem('user_menus', '[]');
    localStorage.setItem('user_permissions', '[]');
    localStorage.setItem('user_preference', JSON.stringify({ default_route: '/home', default_page_size: 10, appearance_mode: 'light' }));
    localStorage.removeItem('must_change_password');
  });
  await page.route(/^https?:\/\/[^/]+\/api\//, route => {
    const url = new URL(route.request().url());
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, message: 'success', data: url.pathname === endpoint ? data : [] }) });
  });
}

const values = Array.from({ length: 23 }, (_, index) => 23 - index);
const pad = (value: number) => String(value).padStart(2, '0');

for (const kind of ['model', 'client'] as const) {
  test(`${kind} 全部可排序列支持升降序、跨页排序、重载和筛选`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const models = values.map(i => ({ id: i, name: `模型${pad(i)}`, provider: `供应商${pad(i)}`, base_url: 'https://example.invalid', model_name: `model${pad(i)}`, enabled: i % 2, is_default: i % 2, key_configured: false, timeout_seconds: 30, creator_name: `人员${pad(i)}`, updater_name: '', created_at: `2026-01-${pad(i)} 10:00:00`, updated_at: '2026-01-01' }));
    const clients = values.map(i => ({ id: i, code: `client-${i}`, name: `系统${pad(i)}`, enabled: i % 2, expires_at: i === 23 ? null : `2027-01-${pad(i)} 10:00:00`, scopes: [], operator_ids: [], creator_name: `人员${pad(i)}`, updater_name: '', created_at: `2026-01-${pad(i)} 10:00:00`, updated_at: '2026-01-01' }));
    await prepare(page, kind === 'model' ? '/api/model-connections' : '/api/open-clients', kind === 'model' ? models : clients);
    await page.goto(kind === 'model' ? '/model-connections' : '/integrations');
    const firstCell = (index: number) => page.locator('tbody tr.ant-table-row').first().locator('td').nth(index);
    const fields = kind === 'model'
      ? [['接入名称', 1, '模型01', '模型23'], ['供应商', 2, '供应商01', '供应商23'], ['模型', 3, 'model01', 'model23'], ['默认模型', 4, '否', '是'], ['状态', 5, '停用', '启用'], ['创建人', 6, '人员01', '人员23'], ['创建时间', 7, '2026-01-01', '2026-01-23']] as const
      : [['系统名称', 1, '系统01', '系统23'], ['状态', 2, '停用', '启用'], ['凭证有效期', 3, '2027-01-01', '长期有效'], ['创建人', 4, '人员01', '人员23'], ['创建时间', 5, '2026-01-01', '2026-01-23']] as const;
    for (const [title, index, low, high] of fields) {
      const header = page.getByRole('columnheader', { name: title, exact: true });
      await header.click();
      await expect(firstCell(index)).toContainText(low);
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await header.click();
      await expect(firstCell(index)).toContainText(high);
      await expect(header).toHaveAttribute('aria-sort', 'descending');
    }
    const name = kind === 'model' ? '接入名称' : '系统名称';
    const prefix = kind === 'model' ? '模型' : '系统';
    const header = page.getByRole('columnheader', { name, exact: true });
    await header.click();
    await expect(firstCell(1)).toContainText(prefix + '01');
    await page.locator('.ant-pagination-next button').click();
    await expect(firstCell(1)).toContainText(prefix + '11');
    await header.click();
    await expect(firstCell(1)).toContainText(prefix + '23');
    await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('name');
    await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe('descend');
    await page.reload();
    await expect(firstCell(1)).toContainText(prefix + '23');
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await page.getByRole('textbox').first().fill('01');
    await page.getByRole('button', { name: /查\s*询/ }).click();
    await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(1);
    await expect(firstCell(1)).toContainText(prefix + '01');
    await page.getByRole('button', { name: /重\s*置/ }).click();
    await expect(page.locator('tbody tr.ant-table-row')).toHaveCount(10);
    expect(errors).toEqual([]);
  });
}

test('访问日志按秒数排序，旧在线时长链接也保持箭头与结果一致', async ({ page }) => {
  await prepare(page, '', []);
  const requested: string[] = [];
  await page.route('**/api/access-logs?**', route => {
    const url = new URL(route.request().url());
    const field = url.searchParams.get('sort_field') || '';
    requested.push(field);
    const rows = [3600, 2, 120, 20].map((seconds, index) => ({ id: index + 1, employee_no: 'test', account: 'test', real_name: '排序验收', event_type: 'login', result: 'success', duration_seconds: seconds, created_at: `2026-01-0${index + 1} 10:00:00` }));
    if (field === 'duration_seconds') rows.sort((a, b) => (a.duration_seconds - b.duration_seconds) * (url.searchParams.get('sort_order') === 'ascend' ? 1 : -1));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data: { list: rows, total: rows.length, page: 1, pageSize: 10 } }) });
  });
  await page.goto('/access-logs');
  const header = page.getByRole('columnheader', { name: '在线时长', exact: true });
  await header.click();
  await expect(page.locator('tbody tr.ant-table-row').first()).toContainText('2秒');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(requested.at(-1)).toBe('duration_seconds');
  await header.click();
  await expect(page.locator('tbody tr.ant-table-row').first()).toContainText('1小时0分钟');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await page.goto('/access-logs?sort=durationText&order=ascend');
  await expect(page.locator('tbody tr.ant-table-row').first()).toContainText('2秒');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
});

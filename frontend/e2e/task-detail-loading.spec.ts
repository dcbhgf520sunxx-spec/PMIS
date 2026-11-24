import { expect, test } from '@playwright/test';

const task = {
  id: 17, name: '请求时序验收任务', source_type: 3, owners: [], owner_names: '',
  task_type: 1, task_type_name: '测试', priority: 0, status: 0, is_overdue: 0,
  overdue_days: 0, child_count: 0
};

for (const scenario of ['没有子任务', '有子任务', '当前为子任务', '子任务数量缺失'] as const) {
  test(`任务详情并行读取历史和跟进：${scenario}`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'detail-loading-fixture');
      localStorage.setItem('user_info', JSON.stringify({ id: 1, employee_no: 'test', real_name: '加载验收', roles: ['admin'] }));
      localStorage.setItem('user_menus', '[]');
      localStorage.setItem('user_permissions', '[]');
    });
    const requested: string[] = [];
    let releaseMain!: () => void;
    let mainReleased = false;
    let mainReads = 0;
    const mainGate = new Promise<void>(resolve => { releaseMain = resolve; });
    await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
      const path = new URL(route.request().url()).pathname;
      requested.push(path);
      let data: unknown = [];
      if (path === '/api/tasks/17') {
        mainReads += 1;
        await mainGate;
        mainReleased = true;
        data = {
          ...task,
          child_count: scenario === '子任务数量缺失' && mainReads === 1 ? undefined : scenario === '有子任务' ? 1 : 0,
          parent_task_id: scenario === '当前为子任务' ? 9 : undefined
        };
      } else if (path === '/api/tasks/17/subtasks') {
        expect(mainReleased).toBe(true);
        data = [{ ...task, id: 18, name: '可见子任务', parent_task_id: 17 }];
      }
      await route.fulfill({ json: { code: 0, data } });
    });
    await page.goto('/tasks/17');
    try {
      // 主单仍未返回时，独立的历史和跟进必须已经发出。
      await expect.poll(() => requested.includes('/api/tasks/17/history')).toBe(true);
      await expect.poll(() => requested.includes('/api/tasks/17/follow-ups')).toBe(true);
      expect(requested).not.toContain('/api/tasks/17/subtasks');
    } finally {
      releaseMain();
    }
    if (scenario === '子任务数量缺失') {
      await expect(page.getByText('接口数据字段不符合约定', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '重新加载', exact: true }).click();
      await expect(page.getByText(task.name, { exact: true }).first()).toBeVisible();
      expect(mainReads).toBe(2);
    } else {
      await expect(page.getByText(task.name, { exact: true }).first()).toBeVisible();
      if (scenario === '有子任务') await expect(page.getByText('可见子任务', { exact: true })).toBeVisible();
    }
    await page.waitForLoadState('networkidle');
    expect(requested.filter(path => path === '/api/tasks/17/subtasks')).toHaveLength(scenario === '有子任务' ? 1 : 0);
  });
}

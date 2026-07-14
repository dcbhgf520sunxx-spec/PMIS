import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDetailNeighborPath, createDetailNeighborContext, isDetailNeighborContextFresh } from '../src/components/admin/DetailNeighborNav/detailNeighbors.ts';

test('详情邻居导航按路由根和记录 id 生成详情路径', () => {
  assert.equal(buildDetailNeighborPath('/work-orders', 12), '/work-orders/12');
  assert.equal(buildDetailNeighborPath('/work-orders/', '13'), '/work-orders/13');
});

test('详情邻居上下文保留模块、路由和查询参数', () => {
  const context = createDetailNeighborContext({
    moduleKey: 'work-order',
    routeBase: '/work-orders',
    sourcePath: '/work-orders?view=all&q_problemTypes=1%2C2&sort=problemDesc&order=ascend',
    params: {
      status: 1,
      sort_field: 'submit_time',
      sort_order: 'ascend'
    }
  });

  assert.equal(context.moduleKey, 'work-order');
  assert.equal(context.routeBase, '/work-orders');
  assert.equal(context.sourcePath, '/work-orders?view=all&q_problemTypes=1%2C2&sort=problemDesc&order=ascend');
  assert.deepEqual(context.params, {
    status: 1,
    sort_field: 'submit_time',
    sort_order: 'ascend'
  });
  assert.equal(typeof context.savedAt, 'number');
});

test('详情邻居上下文超过有效期后失效', () => {
  const context = createDetailNeighborContext({ moduleKey: 'task', routeBase: '/tasks', params: {} });
  assert.equal(isDetailNeighborContextFresh(context, context.savedAt + 29 * 60 * 1000), true);
  assert.equal(isDetailNeighborContextFresh(context, context.savedAt + 31 * 60 * 1000), false);
});

test('详情邻居切换记录时保留当前返回链路', () => {
  assert.equal(
    buildDetailNeighborPath('/tasks', 26, '?returnTo=%2Ftasks%3Fpage%3D2'),
    '/tasks/26?returnTo=%2Ftasks%3Fpage%3D2'
  );
});

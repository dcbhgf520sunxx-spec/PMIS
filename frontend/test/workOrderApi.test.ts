import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPageResult } from '../src/api/pageResult.ts';
import { buildWorkOrderQueryParams } from '../src/api/workOrderQueryParams.ts';

test('工单列表适配分页响应中的 records', () => {
  const result = mapPageResult({
    list: [{
      id: 1,
      problem_type: 2,
      problem_desc: '接口返回分页对象',
      follower_id: 1,
      urgency: 1,
      status: 0,
      is_overdue: 0,
      submitter_name: '管理员',
      submitter_dept: '运维部',
      submit_time: '2026-07-10 10:00:00'
    }],
    total: 68,
    page: 1,
    pageSize: 1000
  }, (row) => ({ problemDesc: row.problem_desc }));

  assert.equal(result.total, 68);
  assert.equal(result.list[0]?.problemDesc, '接口返回分页对象');
});

test('工单列表保留服务端视图总数', () => {
  const result = mapPageResult({
    list: [],
    total: 6,
    page: 1,
    pageSize: 20,
    viewCounts: {
      all: 66,
      mine: 6
    }
  }, (row) => row);

  assert.deepEqual(result.viewCounts, { all: 66, mine: 6 });
});

test('工单 neighbors 复用列表查询参数口径', () => {
  const params = buildWorkOrderQueryParams({
    problemDesc: '数据库',
    systemId: '2',
    problemType: ['1', '3'],
    urgency: 2,
    status: 1,
    isOverdue: true,
    filterFollowerId: '5',
    viewKey: 'mine',
    submitterName: '张三',
    submitTimeFrom: '2026-07-01',
    submitTimeTo: '2026-07-10',
    expectedResolveDateFrom: '2026-07-11',
    expectedResolveDateTo: '2026-07-20',
    current: 3,
    pageSize: 20,
    sortField: 'submitTime',
    sortOrder: 'ascend'
  });

  assert.deepEqual(params, {
    problem_desc: '数据库',
    system_id: '2',
    problem_type: '1,3',
    urgency: 2,
    status: 1,
    is_overdue: 1,
    filter_follower_id: '5',
    view_key: 'mine',
    current_user_id: undefined,
    submitter_name: '张三',
    submit_time_from: '2026-07-01',
    submit_time_to: '2026-07-10',
    expected_resolve_date_from: '2026-07-11',
    expected_resolve_date_to: '2026-07-20',
    page: 3,
    pageSize: 20,
    sort_field: 'submit_time',
    sort_order: 'ascend'
  });
});

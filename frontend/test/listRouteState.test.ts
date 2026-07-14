import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeListFilters,
  decodeListRouteState,
  encodeListFilters,
  encodeListRouteState,
  listRouteCodecs
} from '../src/components/admin/TemplateListPage/listRouteState.ts';

test('列表只把已提交筛选写入 URL 并保留无关参数', () => {
  const search = encodeListFilters('?returnTo=%2Fhome', {
    keyword: '数据库',
    status: 2,
    overdue: true,
    types: ['1', '3']
  }, {
    keyword: '',
    status: undefined,
    overdue: undefined,
    types: [] as string[]
  }, {
    status: listRouteCodecs.number,
    overdue: listRouteCodecs.boolean,
    types: listRouteCodecs.stringArray
  });

  assert.equal(search, '?returnTo=%2Fhome&q_keyword=%E6%95%B0%E6%8D%AE%E5%BA%93&q_status=2&q_overdue=1&q_types=1%2C3');
});

test('重新提交查询时清除旧页码但保留每页条数和排序', () => {
  const search = encodeListFilters('?page=4&pageSize=50&sort=createdAt&order=descend', { keyword: '任务' }, { keyword: '' });
  assert.equal(search, '?pageSize=50&sort=createdAt&order=descend&q_keyword=%E4%BB%BB%E5%8A%A1');
});

test('列表从 URL 恢复筛选类型并对非法值回退默认值', () => {
  const filters = decodeListFilters('?q_keyword=%E4%BB%BB%E5%8A%A1&q_status=bad&q_overdue=1&q_types=1%2C3', {
    keyword: '',
    status: undefined as number | undefined,
    overdue: undefined as boolean | undefined,
    types: [] as string[]
  }, {
    status: listRouteCodecs.number,
    overdue: listRouteCodecs.boolean,
    types: listRouteCodecs.stringArray
  });

  assert.deepEqual(filters, { keyword: '任务', status: undefined, overdue: true, types: ['1', '3'] });
});

test('分页排序和视图状态可往返且默认值不污染地址', () => {
  const search = encodeListRouteState('', {
    page: 3,
    pageSize: 50,
    sortField: 'createdAt',
    sortOrder: 'descend',
    view: 'mine'
  }, { pageSize: 20, view: 'all' });

  assert.deepEqual(decodeListRouteState(search, { pageSize: 20, view: 'all' }, ['all', 'mine']), {
    page: 3,
    pageSize: 50,
    sortField: 'createdAt',
    sortOrder: 'descend',
    view: 'mine'
  });
  assert.equal(encodeListRouteState(search, { page: 1, pageSize: 20, view: 'all' }, { pageSize: 20, view: 'all' }), '');
});

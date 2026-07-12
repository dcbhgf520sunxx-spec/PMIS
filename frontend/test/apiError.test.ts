import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createApiError } from '../src/api/apiError.ts';

test('API error preserves structured field errors', () => {
  const error = createApiError({
    message: '请检查表单字段',
    fieldErrors: { problem_desc: ['问题描述已存在'] }
  });

  assert.ok(error instanceof ApiError);
  assert.equal(error.message, '请检查表单字段');
  assert.deepEqual(error.fieldErrors, { problem_desc: ['问题描述已存在'] });
});

test('API error falls back to a regular request message', () => {
  const error = createApiError(undefined, '网络异常');
  assert.equal(error.message, '网络异常');
  assert.equal(error.fieldErrors, undefined);
});

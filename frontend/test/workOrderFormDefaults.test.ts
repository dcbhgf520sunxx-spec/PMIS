import assert from 'node:assert/strict';
import test from 'node:test';
import dayjs from 'dayjs';

test('新增工单默认跟进人为登录用户且提出时间为当天', async () => {
  let module: typeof import('../src/modules/work-order/pages/workOrderFormDefaults.ts') | undefined;
  try {
    module = await import('../src/modules/work-order/pages/workOrderFormDefaults.ts');
  } catch {
    module = undefined;
  }

  assert.equal(typeof module?.buildWorkOrderCreateInitialValues, 'function');

  const initialValues = module!.buildWorkOrderCreateInitialValues(
    27,
    dayjs('2026-07-27 15:30:00')
  );

  assert.equal(initialValues.followerId, '27');
  assert.equal(initialValues.submitTime.format('YYYY-MM-DD'), '2026-07-27');
});

test('没有登录用户时不伪造新增工单跟进人', async () => {
  let module: typeof import('../src/modules/work-order/pages/workOrderFormDefaults.ts') | undefined;
  try {
    module = await import('../src/modules/work-order/pages/workOrderFormDefaults.ts');
  } catch {
    module = undefined;
  }

  assert.equal(typeof module?.buildWorkOrderCreateInitialValues, 'function');

  const initialValues = module!.buildWorkOrderCreateInitialValues(
    undefined,
    dayjs('2026-07-27 15:30:00')
  );

  assert.equal(initialValues.followerId, undefined);
  assert.equal(initialValues.submitTime.format('YYYY-MM-DD'), '2026-07-27');
});

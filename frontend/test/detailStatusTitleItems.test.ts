import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleStatusTitleItems } from '../src/components/admin/TemplateDetailPage/statusTitleItems.ts';

test('标题过滤空值状态项但保留右侧真实状态项顺序', () => {
  const items = [
    { label: '状态', value: '处理中' },
    { label: '空值', value: null },
    { label: '空字符串', value: '  ' },
    { label: '占位符', value: '-' },
    { label: '紧急程度', value: '高' },
    { label: '数字零', value: 0 }
  ];

  assert.deepEqual(
    visibleStatusTitleItems(items).map((item) => item.label),
    ['状态', '紧急程度', '数字零']
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/modules/requirement/helpers.tsx', import.meta.url), 'utf8');
function renderAt(now, overdue, date) {
  const exports = {};
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Date: FixedDate, Intl,
    require: (name) => name === 'react/jsx-runtime' ? { jsx: (type, props) => ({type, props}) } : { OverdueTag: 'OverdueTag' }
  });
  return exports.renderRequirementOverdue(overdue, date).props.overdueDays;
}
test('需求逾期按上海自然日计算，08点前后不跳一天', () => {
  for (const now of ['2026-09-21T00:01:00+08:00','2026-09-21T07:59:00+08:00','2026-09-21T08:01:00+08:00','2026-09-21T23:59:00+08:00']) {
    assert.equal(renderAt(now, true, '2026-09-20'), 1);
  }
  assert.equal(renderAt('2026-10-01T00:01:00+08:00', true, '2026-09-29'), 2);
  assert.equal(renderAt('2026-09-21T12:00:00+08:00', false, '2026-09-20'), 0);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { ProForm } = require('@ant-design/pro-components');
const originalTsx = require.extensions['.tsx'];
const originalCss = require.extensions['.css'];
let inputs;
try {
  require.extensions['.tsx'] = (module, filename) => {
    // Node SSR uses the equivalent CommonJS locale distributed by antd.
    const source = readFileSync(filename, 'utf8').replaceAll('antd/es/date-picker/locale/zh_CN', 'antd/lib/date-picker/locale/zh_CN');
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
    } });
    module._compile(outputText, filename);
  };
  require.extensions['.css'] = () => {};
  inputs = require('../src/components/admin/AdminProFormInput/index.tsx');
} finally {
  if (originalTsx) require.extensions['.tsx'] = originalTsx;
  else delete require.extensions['.tsx'];
  if (originalCss) require.extensions['.css'] = originalCss;
  else delete require.extensions['.css'];
}

test('文本表单字段保留禁用、只读和字段级占位配置', () => {
  for (const name of ['AdminProFormText', 'AdminProFormTextArea']) {
    const render = (props, formProps = {}) => renderToStaticMarkup(createElement(ProForm, { initialValues: { value: '原有内容' }, submitter: false, ...formProps }, createElement(inputs[name], { name: 'value', label: '说明', ...props })));
    assert.match(render({ fieldProps: { disabled: true } }), /disabled=""/, name);
    assert.match(render({}, { fieldProps: { disabled: true } }), /disabled=""/, name);
    assert.match(render({ fieldProps: { readOnly: true } }), /readonly=""/, name);
    assert.match(render({ fieldProps: { placeholder: '请保留这个提示' } }), /placeholder="请保留这个提示"/, name);
    const readonly = render({ readonly: true });
    assert.doesNotMatch(readonly, /class="ant-input\b|<textarea/, name);
    assert.doesNotMatch(render({}, { readonly: true }), /class="ant-input\b|<textarea/, name);
    assert.match(readonly, /原有内容/, name);
    assert.doesNotMatch(render({}), /disabled=""|readonly=""/, name);
  }
});

test('通用数值表单字段提供数字控件并保留零值和边界配置', () => {
  assert.equal(typeof inputs.AdminProFormNumber, 'function');
  const markup = renderToStaticMarkup(createElement(ProForm, { initialValues: { quantity: 0 }, submitter: false }, createElement(inputs.AdminProFormNumber, {
    name: 'quantity', label: '数量', initialValue: 0,
    fieldProps: { min: 0, max: 100, precision: 0, step: 1 }
  })));
  assert.match(markup, /role="spinbutton"/);
  assert.match(markup, /aria-valuemin="0"/);
  assert.match(markup, /aria-valuemax="100"/);
  assert.match(markup, /aria-valuenow="0"/);
});

test('长文本的字数统计保留在编辑态，字段与整表只读不产生 DOM 警告', () => {
  const warnings = [];
  const originalConsoleError = console.error;
  console.error = (...args) => warnings.push(args);
  try {
    for (const formReadonly of [false, true]) {
      const markup = renderToStaticMarkup(createElement(ProForm, {
        readonly: formReadonly, initialValues: { note: '第一行\n第二行' }, submitter: false
      }, createElement(inputs.AdminProFormTextArea, {
        name: 'note', readonly: !formReadonly, fieldProps: { showCount: true, maxLength: 200 }
      })));
      assert.doesNotMatch(markup, /<textarea/);
      assert.match(markup, /第一行\n第二行/);
    }
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(warnings, []);
  let showCount;
  const customMarkup = renderToStaticMarkup(createElement(ProForm, {
    initialValues: { note: 'abc' }, submitter: false
  }, createElement(inputs.AdminProFormTextArea, {
    name: 'note', fieldProps: { showCount: true, maxLength: 200 },
    renderFormItem: (_value, config, defaultDom) => {
      showCount = config.showCount;
      return defaultDom;
    }
  })));
  assert.equal(showCount, true);
  assert.match(customMarkup, /3 \/ 200/);
});

test('金额字段保留公共输入样式、两位精度和高精度字符串', () => {
  const markup = renderToStaticMarkup(createElement(ProForm, {
    initialValues: { amount: '9007199254740993.12' }, submitter: false
  }, createElement(inputs.AdminProFormMoney, { name: 'amount', label: '金额' })));
  assert.match(markup, /admin-input admin-number-input/);
  assert.match(markup, /step="0.01"/);
  assert.match(markup, /value="9007199254740993.12"/);
});

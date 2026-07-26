import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modalStyles = readFileSync(new URL('../src/components/admin/AdminModal/index.css', import.meta.url), 'utf8');
const inputSource = readFileSync(new URL('../src/components/admin/AdminInput/index.tsx', import.meta.url), 'utf8');
const inputStyles = readFileSync(new URL('../src/components/admin/AdminInput/index.css', import.meta.url), 'utf8');
const feedbackOverlaysSource = readFileSync(new URL('../src/modules/design-system/pages/sections/feedback/FeedbackOverlays.tsx', import.meta.url), 'utf8');

function readCssBlock(source, selector, startAt = 0) {
  const selectorIndex = source.indexOf(selector, startAt);
  assert.notEqual(selectorIndex, -1, `未找到样式选择器：${selector}`);

  const blockStart = source.indexOf('{', selectorIndex + selector.length);
  assert.notEqual(blockStart, -1, `未找到样式块：${selector}`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(blockStart + 1, index);
  }

  assert.fail(`样式块未闭合：${selector}`);
}

test('AdminModal 保持统一最小高度，长内容限制在视口内并只滚动正文', () => {
  const contentStyles = readCssBlock(modalStyles, '.admin-modal .ant-modal-content');
  const bodyStyles = readCssBlock(modalStyles, '.admin-modal .ant-modal-body');
  const fixedChromeStyles = readCssBlock(
    modalStyles,
    '.admin-modal .ant-modal-header,\n.admin-modal .ant-modal-footer',
  );
  const responsiveStyles = readCssBlock(modalStyles, '@media (max-width: 767px), (max-height: 639px)');
  const responsiveContentStyles = readCssBlock(responsiveStyles, '.admin-modal .ant-modal-content');

  assert.match(contentStyles, /min-height:\s*min\(280px,\s*calc\(100(?:dvh|vh)\s*-\s*32px\)\)/);
  assert.match(contentStyles, /max-height:\s*calc\(100(?:dvh|vh)\s*-\s*32px\)/);
  assert.match(contentStyles, /display:\s*flex/);
  assert.match(contentStyles, /flex-direction:\s*column/);
  assert.match(contentStyles, /overflow:\s*hidden/);
  assert.match(bodyStyles, /flex:\s*1 1 auto/);
  assert.match(bodyStyles, /min-height:\s*0/);
  assert.match(bodyStyles, /overflow-y:\s*auto/);
  assert.match(fixedChromeStyles, /flex:\s*0 0 auto/);
  assert.match(responsiveContentStyles, /min-height:\s*min\(280px,\s*calc\(100dvh\s*-\s*16px\)\)/);
  assert.match(responsiveContentStyles, /max-height:\s*calc\(100dvh\s*-\s*16px\)/);
});

test('日期类浮层挂到页面顶层并在极小视口内滚动', () => {
  assert.match(inputSource, /const defaultPopupContainer = \(\) => document\.body/);
  assert.equal((inputSource.match(/getPopupContainer=\{getPopupContainer \?\? defaultPopupContainer\}/g) || []).length, 3);
  assert.match(inputSource, /const adaptivePickerOverflow[\s\S]*shiftX:\s*true[\s\S]*shiftY:\s*true/);
  assert.equal((inputSource.match(/offset:\s*\[0, 0\]/g) || []).length, 4);
  assert.equal((inputSource.match(/builtinPlacements=\{adaptivePickerPlacements\}/g) || []).length, 3);
  assert.equal((inputSource.match(/admin-date-picker-popup/g) || []).length >= 1, true);
  assert.match(inputStyles, /\.admin-date-picker-popup\s*\{[\s\S]*padding-block:\s*8px/);
  assert.match(inputStyles, /\.admin-date-picker-popup \.ant-picker-panel-container\s*\{[\s\S]*max-height:\s*calc\(100dvh\s*-\s*32px\)[\s\S]*overflow:\s*auto/);
});

test('长文本默认高度不可向上缩小且计数器不制造弹窗溢出', () => {
  assert.match(inputSource, /function getTextAreaMinHeight\(rows\?: number, hasCount = false\)/);
  assert.match(inputSource, /return baseHeight \+ \(hasCount \? 20 : 0\)/);
  assert.match(inputSource, /style=\{mergeTextAreaStyle\(rows, style, hasCount\)\}/);
  assert.match(inputSource, /styles=\{mergeTextAreaStyles\(rows, styles, hasCount\)\}/);
  assert.match(inputStyles, /\.admin-textarea\.ant-input-textarea-show-count \.ant-input-data-count\s*\{[\s\S]*bottom:\s*6px/);
  assert.match(inputStyles, /\.admin-textarea\.ant-input-textarea-show-count > textarea\.ant-input\s*\{[\s\S]*padding-bottom:\s*26px/);
  assert.match(inputStyles, /\.admin-input\.ant-input-affix-wrapper:not\(\.ant-input-textarea-affix-wrapper\)[\s\S]*height:\s*32px/);
  assert.match(feedbackOverlaysSource, /<AdminTextArea rows=\{5\} maxLength=\{100\} showCount placeholder="请输入处理结果" \/>/);
});

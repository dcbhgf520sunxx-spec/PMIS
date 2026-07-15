import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modalStyles = readFileSync(new URL('../src/components/admin/AdminModal/index.css', import.meta.url), 'utf8');
const inputSource = readFileSync(new URL('../src/components/admin/AdminInput/index.tsx', import.meta.url), 'utf8');
const inputStyles = readFileSync(new URL('../src/components/admin/AdminInput/index.css', import.meta.url), 'utf8');

test('AdminModal 将长内容限制在视口内并只滚动正文', () => {
  assert.match(modalStyles, /\.admin-modal \.ant-modal-content\s*\{[\s\S]*max-height:\s*calc\(100(?:dvh|vh)\s*-\s*32px\)/);
  assert.match(modalStyles, /\.admin-modal \.ant-modal-content\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*overflow:\s*hidden/);
  assert.match(modalStyles, /\.admin-modal \.ant-modal-body\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
  assert.match(modalStyles, /\.admin-modal \.ant-modal-header,[\s\S]*\.admin-modal \.ant-modal-footer\s*\{[\s\S]*flex:\s*0 0 auto/);
  assert.match(modalStyles, /@media[^\{]*(?:max-width|max-height)[\s\S]*\.admin-modal \.ant-modal-content\s*\{[\s\S]*max-height:\s*calc\(100dvh\s*-\s*16px\)/);
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

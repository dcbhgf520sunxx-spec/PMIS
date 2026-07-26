import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADMIN_ATTACHMENT_IMAGE_FORMATS,
  matchesAttachmentAccept,
  validateAttachmentSelection
} from '../src/components/admin/AdminAttachmentUpload/validation.ts';

test('PNG 使用标准类型、旧类型或缺少类型时都能通过图片校验', () => {
  const pngFiles = [
    new File(['png'], '示例.png', { type: 'image/png' }),
    new File(['png'], '示例.png', { type: 'image/x-png' }),
    new File(['png'], '示例.PNG')
  ];

  for (const file of pngFiles) {
    assert.equal(matchesAttachmentAccept(file, 'image/png'), true);
    assert.equal(matchesAttachmentAccept(file, 'image/*'), true);
  }
});

test('底座明确列出统一支持识别的图片格式', () => {
  assert.deepEqual(ADMIN_ATTACHMENT_IMAGE_FORMATS, [
    'JPG',
    'JPEG',
    'PNG',
    'GIF',
    'WEBP',
    'BMP',
    'SVG',
    'AVIF',
    'HEIC'
  ]);
});

test('不支持的文件在选择阶段直接拒绝，不进入上传列表', () => {
  const unsupportedFile = new File(['script'], '脚本.exe', {
    type: 'application/vnd.microsoft.portable-executable'
  });
  const supportedFile = new File(['pdf'], '材料.pdf', { type: 'application/pdf' });

  assert.deepEqual(
    validateAttachmentSelection(unsupportedFile, {
      accept: 'image/*,.pdf',
      currentCount: 0,
      multiple: true
    }),
    { accepted: false, error: '不支持该文件格式' }
  );
  assert.deepEqual(
    validateAttachmentSelection(supportedFile, {
      accept: 'image/*,.pdf',
      currentCount: 0,
      multiple: true
    }),
    { accepted: true }
  );
});

test('选择阶段同时拒绝超过数量的文件', () => {
  const file = new File(['pdf'], '材料.pdf', { type: 'application/pdf' });

  assert.deepEqual(
    validateAttachmentSelection(file, {
      currentCount: 2,
      maxCount: 2,
      multiple: true
    }),
    { accepted: false, error: '最多上传 2 个附件' }
  );
});

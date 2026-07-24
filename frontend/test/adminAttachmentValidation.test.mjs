import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADMIN_ATTACHMENT_IMAGE_FORMATS,
  matchesAttachmentAccept
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

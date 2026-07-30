import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editor = fs.readFileSync(path.join(root, 'src/components/admin/RichDescriptionEditor/index.tsx'), 'utf8');

test('富文本编辑器通过上传回调插入URL且不再生成Base64', () => {
  assert.match(editor, /onUploadImage/)
  assert.match(editor, /await onUploadImage\(image\)/)
  assert.doesNotMatch(editor, /readAsDataURL/)
  assert.doesNotMatch(editor, /new FileReader/)
})

test('所有业务富文本表单都接入OSS图片上传', () => {
  const files = [
    'src/modules/requirement/pages/RequirementFormPage.tsx',
    'src/modules/task/pages/TaskFormPage.tsx',
    'src/modules/bug/pages/BugFormPage.tsx',
    'src/modules/work-order/pages/WorkOrderFormPage.tsx',
  ]
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /uploadRichTextImage/, file)
    assert.match(source, /onUploadImage=\{uploadRichTextImage\}/, file)
  }
})

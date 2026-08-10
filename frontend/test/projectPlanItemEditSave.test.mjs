import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('已完成事项补设交付要求时先上传附件再保存且失败会清理', () => {
  const helper = fs.readFileSync(path.join(frontendRoot, 'src/modules/project/projectPlanItemEditSave.ts'), 'utf8');
  const page = fs.readFileSync(path.join(frontendRoot, 'src/modules/project/pages/ProjectStagePlanPage.tsx'), 'utf8');
  assert.match(helper, /item\.status\s*===\s*2[\s\S]*?!item\.requiresDeliveryFile[\s\S]*?values\.requiresDeliveryFile[\s\S]*?item\.fileCount\s*===\s*0/);
  assert.ok(helper.indexOf('await upload(file)') < helper.indexOf('await save()'));
  assert.match(helper, /Promise\.allSettled\(uploadedIds\.map\(\(fileId\)\s*=>\s*remove\(fileId\)\)\)/);
  assert.match(page, /requiresPendingDeliveryUpload\(itemModal\.item,itemModal\.values\)/);
  assert.match(page, /<AdminAttachmentUpload[\s\S]*?pendingAttachments/);
});

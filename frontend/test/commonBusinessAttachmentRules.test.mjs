import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('业务附件入口统一使用包含 TXT 和 Markdown 的公共类型规则', () => {
  const rules = read('src/components/business/businessAttachmentRules.ts');
  assert.match(rules, /'\.txt'/);
  assert.match(rules, /'\.md'/);

  for (const file of [
    'src/components/business/BusinessAttachmentField.tsx',
    'src/modules/project/pages/ProjectContractFormPage.tsx',
    'src/modules/product/pages/ProductMaintenanceContractFormPage.tsx',
    'src/modules/project/pages/ProjectStagePlanPage.tsx',
    'src/modules/project/components/ProjectPlanStatusChangeAction.tsx',
  ]) {
    const source = read(file);
    assert.match(source, /COMMON_ATTACHMENT_ACCEPT/, `${file} 未使用公共附件类型规则`);
    assert.match(source, /COMMON_ATTACHMENT_MAX_SIZE/, `${file} 未使用公共附件大小规则`);
  }
});

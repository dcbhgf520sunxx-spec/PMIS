import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(currentDir, '..');

test('知识库菜单位于运维工单之后并接入独立建设中页面', () => {
  const layoutSource = fs.readFileSync(path.join(frontendRoot, 'src/layouts/AdminLayout/index.tsx'), 'utf8');
  const routesSource = fs.readFileSync(path.join(frontendRoot, 'src/app/routes.tsx'), 'utf8');
  const pageSource = fs.readFileSync(path.join(frontendRoot, 'src/modules/knowledge-base/pages/KnowledgeBasePage.tsx'), 'utf8');
  const pageStyles = fs.readFileSync(path.join(frontendRoot, 'src/modules/knowledge-base/pages/KnowledgeBasePage.css'), 'utf8');
  const workOrderIndex = layoutSource.indexOf("label: '运维工单'");
  const knowledgeBaseIndex = layoutSource.indexOf("label: '知识库'");
  const baseSettingsIndex = layoutSource.indexOf("label: '基础设置'");
  assert.ok(workOrderIndex >= 0 && workOrderIndex < knowledgeBaseIndex && knowledgeBaseIndex < baseSettingsIndex);
  assert.match(routesSource, /path:\s*'knowledge-base'[\s\S]*?<KnowledgeBasePage\s*\/>/);
  assert.match(pageSource, /<PageShell\s+title="知识库"/);
  assert.match(pageSource, /<AdminEmptyState[\s\S]*?description="知识库正在建设中，敬请期待"/);
  assert.match(pageStyles, /\.knowledge-base-page__empty\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s);
});

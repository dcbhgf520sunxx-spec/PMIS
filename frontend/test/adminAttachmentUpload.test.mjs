import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  const file = `${root}/${path}`;
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

test('底座提供完整附件组件并保持业务限制可选', () => {
  const source = read('src/components/admin/AdminAttachmentUpload/index.tsx');
  const validation = read('src/components/admin/AdminAttachmentUpload/validation.ts');
  const exports = read('src/components/admin/index.ts');

  assert.match(exports, /AdminAttachmentUpload/);
  assert.match(source, /export type AdminAttachment/);
  assert.match(source, /onUpload:/);
  assert.match(source, /onPreview\?:/);
  assert.match(source, /onDownload\?:/);
  assert.match(source, /onRemove\?:/);
  assert.match(source, /accept\?:/);
  assert.match(source, /maxCount\?:/);
  assert.match(source, /maxSize\?:/);
  assert.match(validation, /options\.maxSize !== undefined/);
  assert.match(validation, /if \(options\.accept/);
  assert.match(source, /capacity !== undefined/);
  assert.doesNotMatch(source, /20\s*\*\s*1024|MAX_FILE_SIZE|MAX_ATTACHMENT_COUNT/);
  assert.doesNotMatch(validation, /20\s*\*\s*1024|MAX_FILE_SIZE|MAX_ATTACHMENT_COUNT/);
});

test('两个附件组件共用上传状态、失败重试、预览、下载和删除能力', () => {
  const source = read('src/components/admin/AdminAttachmentUpload/index.tsx');
  const styles = read('src/components/admin/AdminAttachmentUpload/index.css');

  assert.match(source, /export function AdminAttachmentDragger/);
  assert.match(source, /uploading/);
  assert.match(source, /errorMessage/);
  assert.match(source, /handleRetry/);
  assert.match(source, /handlePreview/);
  assert.match(source, /handleDownload/);
  assert.match(source, /AdminIconAction/);
  assert.match(source, /AdminDeleteIconAction/);
  assert.match(source, /DownloadOutlined/);
  assert.match(source, /RedoOutlined/);
  assert.match(source, /label="重试"/);
  assert.doesNotMatch(source, /AdminTextAction/);
  assert.match(source, /上传失败/);
  assert.doesNotMatch(source, /上传成功/);
  assert.doesNotMatch(source, /CheckCircleFilled/);
  assert.match(styles, /admin-attachment-upload__file-name/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});

test('已上传附件保持单行紧凑布局且窄屏不把操作换行', () => {
  const source = read('src/components/admin/AdminAttachmentUpload/index.tsx');
  const styles = read('src/components/admin/AdminAttachmentUpload/index.css');
  const rules = read('../docs/ai-development-rules.md');

  assert.match(source, /admin-attachment-upload__size/);
  assert.match(styles, /admin-attachment-upload__item\.is-done/);
  assert.match(styles, /grid-template-columns:\s*28px\s+minmax\(0,\s*1fr\)\s+auto\s+auto/);
  assert.match(styles, /admin-attachment-upload__item:not\(\.is-done\)/);
  assert.match(rules, /已上传附件保持单行/);
});

test('附件名称前根据文件格式展示对应图标', () => {
  const source = read('src/components/admin/AdminAttachmentUpload/index.tsx');

  assert.match(source, /FilePdfOutlined/);
  assert.match(source, /FileWordOutlined/);
  assert.match(source, /FileExcelOutlined/);
  assert.match(source, /FilePptOutlined/);
  assert.match(source, /FileImageOutlined/);
  assert.match(source, /FileZipOutlined/);
  assert.match(source, /VideoCameraOutlined/);
  assert.match(source, /AudioOutlined/);
});

test('组件工作台只展示基础上传和拖拽上传两套完整附件场景', () => {
  const example = read('src/modules/design-system/pages/sections/input/AdvancedInputExamples.tsx');

  assert.match(example, /AdminAttachmentUpload/);
  assert.match(example, /AdminAttachmentDragger/);
  assert.match(example, /基础上传/);
  assert.match(example, /拖拽上传/);
  assert.match(example, /已有附件/);
  assert.match(example, /模拟上传失败/);
  assert.doesNotMatch(example, /<h4>完整附件<\/h4>/);
  assert.doesNotMatch(example, /<h4>业务规则示例<\/h4>/);
  assert.doesNotMatch(example, /\bAdminUpload(?:Dragger)?\b/);
});

test('附件工作台的两段说明复用输入区统一的辅助文字样式', () => {
  const example = read('src/modules/design-system/pages/sections/input/AdvancedInputExamples.tsx');
  const styles = read('src/modules/design-system/pages/DesignSystemShared.css');

  assert.equal(
    (example.match(/className="design-system-page__input-demo-description"/g) ?? []).length,
    2,
  );
  assert.match(
    styles,
    /\.design-system-page__input-panel-head p,\s*\.design-system-page__input-demo-description\s*\{/,
  );
});

test('AI 规则明确附件限制由业务传入且底座不设默认限制', () => {
  const rules = read('../docs/ai-development-rules.md');

  assert.match(rules, /AdminAttachmentUpload/);
  assert.match(rules, /AdminAttachmentDragger/);
  assert.match(rules, /底座不内置文件格式、附件数量和附件大小限制/);
  assert.match(rules, /业务方未传对应规则时不限制/);
});

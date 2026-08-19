import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routesSource = readFileSync(new URL('../src/app/routes.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../src/layouts/AdminLayout/index.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../src/modules/release-notes/pages/ReleaseNotesPage.tsx', import.meta.url), 'utf8');
const releaseNotesSource = readFileSync(new URL('../src/modules/release-notes/releaseNotes.ts', import.meta.url), 'utf8');
const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

test('registers the version update page as a lazy authenticated route', () => {
  assert.match(routesSource, /ReleaseNotesPage/);
  assert.match(routesSource, /path:\s*'release-notes'/);
  assert.match(layoutSource, /版本更新/);
  assert.match(layoutSource, /navigate\('\/release-notes'\)/);
  assert.match(layoutSource, /location\.pathname === '\/release-notes'\s*\? ''/);
  assert.doesNotMatch(layoutSource, /currentRelease/);
  assert.doesNotMatch(layoutSource, /admin-layout__version/);
});

test('reuses the detail page template and displays release categories', () => {
  assert.match(pageSource, /TemplateDetailPage/);
  assert.match(pageSource, /TemplateDetailSection/);
  assert.match(releaseNotesSource, /新增功能/);
  assert.match(releaseNotesSource, /功能优化/);
  assert.match(releaseNotesSource, /问题修复/);
  assert.match(releaseNotesSource, /安全与稳定性/);
  assert.match(pageSource, /CategoryTag/);
  assert.doesNotMatch(pageSource, /AdminTag\s+color=/);
});

test('renders release notes as one vertical page without duplicate history metadata or category cards', () => {
  assert.doesNotMatch(pageSource, /sectionNavigation/);
  assert.doesNotMatch(pageSource, /sectionKey=/);
  assert.doesNotMatch(pageSource, /AdminCard/);
  assert.match(pageSource, /children:\s*<ReleaseCategories release=\{release\}/);
  assert.doesNotMatch(pageSource, /children:\s*<ReleaseSummary release=\{release\}/);
  assert.doesNotMatch(pageSource, /技术信息/);
  assert.doesNotMatch(pageSource, /__APP_GIT_COMMIT__/);
  assert.doesNotMatch(pageSource, /__APP_BUILD_TIME__/);
  assert.match(pageSource, /release-notes__current-summary/);
  assert.match(pageSource, /release-notes__history-summary/);
  assert.match(pageSource, /release-notes__history-date/);
});

test('injects Git commit and build time into the frontend build', () => {
  assert.match(viteSource, /__APP_GIT_COMMIT__/);
  assert.match(viteSource, /__APP_BUILD_TIME__/);
});

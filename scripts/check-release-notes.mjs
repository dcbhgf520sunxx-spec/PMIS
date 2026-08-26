import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^v(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_KEYS = ['features', 'improvements', 'fixes', 'security'];

function versionKey(version) {
  const match = VERSION_PATTERN.exec(version || '');
  if (!match) return null;
  const [, year, month, day, sequence] = match;
  return [Number(year), Number(month), Number(day), Number(sequence)];
}

function compareVersionKeys(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

export function validateReleaseNotes(source) {
  const errors = [];
  const releases = source?.releases;
  if (!Array.isArray(releases) || releases.length === 0) {
    return ['版本记录至少包含一个版本'];
  }

  const seenVersions = new Set();
  const versionKeys = [];
  releases.forEach((release, index) => {
    const label = `第 ${index + 1} 个版本`;
    const key = versionKey(release?.version);
    if (!key) {
      errors.push(`${label}版本号必须使用 vYYYY.MM.DD.N 格式`);
    } else {
      versionKeys.push({ index, key });
    }
    if (seenVersions.has(release?.version)) errors.push(`${label}版本号重复：${release.version}`);
    seenVersions.add(release?.version);
    if (!DATE_PATTERN.test(release?.releasedAt || '')) errors.push(`${label}发布日期格式必须为 YYYY-MM-DD`);
    if (!String(release?.summary || '').trim()) errors.push(`${label}缺少发布摘要`);

    let itemCount = 0;
    CATEGORY_KEYS.forEach((category) => {
      const items = release?.[category];
      if (!Array.isArray(items)) {
        errors.push(`${label}的 ${category} 必须是数组`);
        return;
      }
      itemCount += items.length;
      if (items.some((item) => !String(item || '').trim())) errors.push(`${label}的 ${category} 包含空内容`);
    });
    if (itemCount === 0) errors.push(`${label}至少填写一条发布内容`);
  });

  for (let index = 1; index < versionKeys.length; index += 1) {
    if (compareVersionKeys(versionKeys[index - 1].key, versionKeys[index].key) > 0) {
      errors.push('版本记录必须按新到旧排序');
      break;
    }
  }
  return errors;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const rootDir = dirname(dirname(scriptPath));
  const notesPath = resolve(rootDir, 'frontend/src/modules/release-notes/release-notes.json');
  const notes = JSON.parse(readFileSync(notesPath, 'utf8'));
  const errors = validateReleaseNotes(notes);
  if (errors.length) {
    console.error(`版本记录检查失败：\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`版本记录检查通过：${notes.releases.length} 个版本。`);
}

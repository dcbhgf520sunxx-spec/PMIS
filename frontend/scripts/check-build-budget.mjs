import { readdirSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILD_BUDGETS = {
  maxJavaScriptBytes: 800 * 1024,
  maxMediaBytes: 1.5 * 1024 * 1024,
  maxTotalBytes: 7 * 1024 * 1024
};

const MEDIA_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.mp4', '.png', '.webm', '.webp']);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function largestFile(files) {
  return files.reduce((largest, file) => file.bytes > largest.bytes ? file : largest, { path: '-', bytes: 0 });
}

export function collectBuildMetrics(directory) {
  const files = listFiles(directory).map((path) => ({ path, bytes: statSync(path).size }));
  const javaScript = files.filter((file) => extname(file.path) === '.js');
  const media = files.filter((file) => MEDIA_EXTENSIONS.has(extname(file.path)));
  return {
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    largestJavaScript: largestFile(javaScript),
    largestMedia: largestFile(media)
  };
}

export function assertBuildBudget(metrics, budgets = BUILD_BUDGETS) {
  const violations = [];
  if (metrics.largestJavaScript.bytes > budgets.maxJavaScriptBytes) {
    violations.push(`最大 JavaScript 文件超过 800 KiB：${metrics.largestJavaScript.path}`);
  }
  if (metrics.largestMedia.bytes > budgets.maxMediaBytes) {
    violations.push(`最大媒体文件超过 1.5 MiB：${metrics.largestMedia.path}`);
  }
  if (metrics.totalBytes > budgets.maxTotalBytes) {
    violations.push('构建产物总大小超过 7 MiB');
  }
  if (violations.length > 0) throw new Error(violations.join('\n'));
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const directory = resolve(process.env.BUILD_BUDGET_DIR || 'dist');
  const metrics = collectBuildMetrics(directory);
  assertBuildBudget(metrics);
  console.log([
    '构建体积预算通过',
    `最大 JavaScript：${formatMiB(metrics.largestJavaScript.bytes)}`,
    `最大媒体文件：${formatMiB(metrics.largestMedia.bytes)}`,
    `构建总大小：${formatMiB(metrics.totalBytes)}`
  ].join('\n'));
}

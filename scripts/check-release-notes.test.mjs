import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleaseNotes } from './check-release-notes.mjs';

function validNotes() {
  return {
    releases: [
      {
        version: 'v2026.08.19.1',
        releasedAt: '2026-08-19',
        summary: '新增版本更新页面',
        features: ['新增版本更新页面'],
        improvements: [],
        fixes: [],
        security: []
      }
    ]
  };
}

test('accepts date-based release versions with at least one business change', () => {
  assert.deepEqual(validateReleaseNotes(validNotes()), []);
});

test('rejects duplicate versions, invalid dates and empty releases', () => {
  const notes = validNotes();
  notes.releases = [
    { ...notes.releases[0], releasedAt: '2026/08/19', features: [] },
    { ...notes.releases[0] }
  ];

  const errors = validateReleaseNotes(notes);
  assert.ok(errors.some((error) => error.includes('版本号重复')));
  assert.ok(errors.some((error) => error.includes('发布日期格式')));
  assert.ok(errors.some((error) => error.includes('至少填写一条发布内容')));
});

test('requires newest release first', () => {
  const notes = validNotes();
  notes.releases.push({
    ...notes.releases[0],
    version: 'v2026.08.20.1',
    releasedAt: '2026-08-20'
  });

  assert.ok(validateReleaseNotes(notes).some((error) => error.includes('按新到旧排序')));
});

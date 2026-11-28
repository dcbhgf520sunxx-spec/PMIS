import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve: (specifier, context, next) => next(specifier.endsWith('/PageNavigation/pageNavigation') ? `${specifier}.ts` : specifier, context) });
const { recordFocusSources, saveRecordFocus, takeRecordFocus } = await import('../src/components/admin/ListRecordFocus/recordFocus.ts');

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};

test('detail return follows the original nested source and preserves list conditions', () => {
  const list = '/tasks?view=mine&page=3&sort=status';
  const parent = `/tasks/12?returnTo=${encodeURIComponent(list)}`;
  assert.deepEqual(recordFocusSources('/tasks', parent), [parent, list]);
  assert.deepEqual(recordFocusSources('/tasks', '/digital-twin'), []);
  assert.deepEqual(recordFocusSources('/tasks', '//evil.test/tasks'), []);
  assert.deepEqual(recordFocusSources('/tasks', '/tasks/12?returnTo=%2Fbugs'), ['/tasks/12?returnTo=%2Fbugs']);
});

test('return intent merges changed IDs, consumes once, and stays within the exact source', () => {
  const storage = memoryStorage();
  const source = '/bugs?page=2&sort=status';
  saveRecordFocus(source, ['1', '2'], storage, 100);
  saveRecordFocus(source, ['2', '3'], storage, 200);
  assert.deepEqual(takeRecordFocus(source, storage, 300), ['1', '2', '3']);
  assert.deepEqual(takeRecordFocus(source, storage, 300), []);
  saveRecordFocus(source, ['4'], storage, 100);
  assert.deepEqual(takeRecordFocus('/bugs?view=mine', storage, 300), []);
  assert.deepEqual(takeRecordFocus(source, storage, 300), ['4']);
});

test('expired, malformed or externally scoped return intent is ignored', () => {
  const storage = memoryStorage();
  saveRecordFocus('/projects', ['1'], storage, 100);
  assert.deepEqual(takeRecordFocus('/projects', storage, 100 + 30 * 60 * 1000 + 1), []);
  saveRecordFocus('https://evil.test/tasks', ['2'], storage, 100);
  assert.deepEqual(takeRecordFocus('/tasks', storage, 101), []);
  storage.setItem('pmis:record-focus:/tasks', '{broken');
  assert.deepEqual(takeRecordFocus('/tasks', storage, 101), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getFocusedRecords, normalizeFocus, mergeNodeAlerts } from '../src/modules/digital-twin/components/priorityFocus.ts';
import type { TwinRecord } from '../src/modules/digital-twin/types.ts';

function record(id: string, priorityCode: number, needsAttention: boolean, kind = 'tasks'): TwinRecord {
    return { id, kind, name: id, code: id, status: '处理中', statusCode: 1, owner: '负责人', value: '负责人', parentName: '产品', chain: [], description: '', dueDate: '', updatedAt: '', url: `/tasks/${id}`, priorityCode, needsAttention };
}
test('重点明细按等级和未结束标记过滤，保留创建时间顺序而不重排编号', () => {
    const records = [record('3', 2, true), record('9', 2, false), record('2', 2, true), record('1', 1, false), record('8', 2, true, 'orders')];
    assert.deepEqual(getFocusedRecords(records, 'tasks', 'high').map(row => row.id), ['3', '2']);
    assert.deepEqual(getFocusedRecords(records, 'tasks', '').map(row => row.id), ['3', '9', '2', '1']);
    assert.equal(records.length, 5);
});
test('缺陷合并入口包含高与致命未关闭对象，仍保留原有倒序', () => {
    const records = [record('8', 4, true, 'bugs'), record('7', 3, true, 'bugs'), record('6', 4, false, 'bugs'), record('5', 2, false, 'bugs')];
    assert.equal(normalizeFocus('bugs', 'attention'), 'attention');
    assert.equal(normalizeFocus('tasks', 'attention'), '');
    assert.deepEqual(getFocusedRecords(records, 'bugs', 'attention').map(row => row.id), ['8', '7']);
});
test('多个等级合并总数，分级明细保留在提示中，没有提醒时不展示', () => {
    const alerts = [{ level: 'critical' as const, label: '致命', count: 1, detail: '' }, { level: 'high' as const, label: '高严重程度', count: 2, detail: '' }];
    const merged = mergeNodeAlerts('bugs', alerts);
    assert.equal(merged?.text, '高危 3');
    assert.match(merged?.description ?? '', /致命未结束 1 项/);
    assert.match(merged?.description ?? '', /高严重程度未结束 2 项/);
    assert.equal(merged?.level, 'critical');
    assert.equal(merged?.focus, 'attention');
    assert.equal(mergeNodeAlerts('bugs', [alerts[0]])?.text, '高危 1');
    assert.equal(mergeNodeAlerts('bugs', [alerts[1]])?.text, '高危 2');
    assert.equal(mergeNodeAlerts('projects', [alerts[1]])?.text, '高优 2');
    assert.equal(mergeNodeAlerts('bugs', []), null);
});
test('高严重程度与致命筛选互不混入，非法焦点恢复全部', () => {
    const records = [record('3', 3, true, 'bugs'), record('4', 4, true, 'bugs'), record('5', 4, false, 'bugs')];
    assert.deepEqual(getFocusedRecords(records, 'bugs', 'high').map(row => row.id), ['3']);
    assert.deepEqual(getFocusedRecords(records, 'bugs', 'critical').map(row => row.id), ['4']);
    assert.equal(normalizeFocus('tasks', 'critical'), '');
    assert.equal(normalizeFocus('contracts', 'high'), '');
    assert.equal(normalizeFocus('bugs', 'unknown'), '');
    assert.equal(normalizeFocus('bugs', 'critical'), 'critical');
});

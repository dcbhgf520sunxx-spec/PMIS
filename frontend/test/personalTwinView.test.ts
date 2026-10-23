import test from 'node:test';
import assert from 'node:assert/strict';
import { personalView, personalViewRecords } from '../src/modules/digital-twin/components/personalView.ts';
import type { PersonalTwinRecord } from '../src/modules/digital-twin/types.ts';

const row = (id: string, extra: Partial<PersonalTwinRecord> = {}) => ({ id, kind: 'tasks', relationship: 'responsible', isOpen: true, isOverdue: false, needsAttention: true, dueSoon: false, createdAt: '2026-10-14 08:00:00', ...extra } as PersonalTwinRecord);
test('个人视角默认本人负责，非法分类和筛选回退；参与不混入重点工作', () => {
    assert.deepEqual(personalView(new URLSearchParams('kind=users&role=secret&focus=unknown')), { kind: 'all', role: 'responsible', focus: 'all' });
    const data = [row('1'), row('2', { relationship: 'participant' }), row('3', { relationship: 'collaborator', kind: 'planItems' }), row('4', { isOpen: false }), row('10', { isOverdue: true })];
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'participating', focus: 'all' }).map(r => r.id), ['3', '2']);
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'all', focus: 'attention' }).map(r => r.id), ['10', '1']);
    assert.deepEqual(personalViewRecords(data, { kind: 'tasks', role: 'responsible', focus: 'overdue' }).map(r => r.id), ['10']);
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'responsible', focus: 'priority' }).map(r => r.id), ['10', '1']);
    assert.deepEqual(data.map(r => r.id), ['1', '2', '3', '4', '10']);
});

test('工作简报筛选分清当前、下一步与本人最近操作', () => {
    const data = [row('1', { workState: 'active', needsAttention: false }), row('2', { workState: 'pending' }), row('3', { workState: 'waiting', needsAttention: false }), row('4', { workState: 'ended', isOpen: false }), row('5', { workState: 'active', relationship: 'participant' })];
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'responsible', focus: 'current' }).map(r => r.id), ['1']);
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'responsible', focus: 'next' }).map(r => r.id), ['3', '2']);
    assert.deepEqual(personalViewRecords(data, { kind: 'all', role: 'all', focus: 'recent' }, [{ kind: 'tasks', recordId: '4' }]).map(r => r.id), ['4']);
});

test('周期明细只展示本期范围，完成/未完成和责任关系不交叉，搜索及关注条件共同生效', async () => {
    const { filterPersonalPeriodRecords }=await import('../src/modules/digital-twin/components/personalView.ts');
    const rows=[row('1',{name:'接口联调',included:true,completed:true,statisticStatus:'completed'}),row('2',{name:'公告去重',included:true,completed:false,statisticStatus:'unfinished',isOverdue:true}),row('3',{name:'协作',relationship:'collaborator',included:true,completed:false,statisticStatus:'unfinished'}),row('4',{name:'未知',included:null,completed:null,statisticStatus:'unknown'}),row('5',{name:'活动',included:false,statisticStatus:'excluded'})];
    const base={kind:'all',role:'responsible',focus:'all',attention:'all',search:''};
    assert.deepEqual(filterPersonalPeriodRecords(rows,base).map(r=>r.id),['1','2','4']);
    assert.deepEqual(filterPersonalPeriodRecords(rows,{...base,focus:'completed'}).map(r=>r.id),['1']);
    assert.deepEqual(filterPersonalPeriodRecords(rows,{...base,focus:'unfinished',attention:'overdue',search:'公告'}).map(r=>r.id),['2']);
    assert.deepEqual(filterPersonalPeriodRecords(rows,{...base,role:'collaborating'}).map(r=>r.id),['3']);
});

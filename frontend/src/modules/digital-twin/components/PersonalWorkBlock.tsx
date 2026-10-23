import { AdminEmptyState, AdminTextAction, OverdueTag } from '../../../components/admin';
import { groupRecentUpdates } from './groupRecentUpdates';
import { personalKinds } from './personalView';
import { renderTwinRecordStatus } from './recordStatus';
import { renderTwinRecordPriority } from './recordPriority';
import { kindNames, type PersonalTwinRecord, type PersonalTwinSnapshot } from '../types';

type Stage = 'recent' | 'next';
const titles = { recent: '近期工作进展', next: '下一步重点' };
const empty = { recent: '最近7天暂无该人员工作记录', next: '暂无待安排或需优先处理的事项' };

export function PersonalWorkBlock({ stage, data, onOpen, onShow }: {
    stage: Stage;
    data: PersonalTwinSnapshot;
    onOpen: (row: PersonalTwinRecord) => void;
    onShow: (stage: Stage, kind?: string) => void;
}) {
    const events = new Map(data.events.map(event => [`${event.kind}:${event.recordId}`, event]));
    const records = stage === 'recent'
        ? data.events.flatMap(event => data.records.filter(row => row.kind === event.kind && row.id === event.recordId))
        : data.workBoard[stage];
    const groups = groupRecentUpdates(records, personalKinds);
    return <section className="rb-week rb-work-block" aria-label={titles[stage]}>
        <div className="rb-work-stage-title"><strong>{titles[stage]}</strong><span>{stage === 'recent' ? '最近7天' : `${records.length} 项`}</span></div>
        {groups.length ? <div className="rb-work-groups">{groups.map(group => <div className="rb-work-kind" key={group.kind} role="group" aria-label={`${kindNames[group.kind]}${titles[stage]}`}>
            <div className="rb-work-kind-heading"><strong>{kindNames[group.kind]}</strong><span>{group.records.length} 项</span></div>
            {group.records.slice(0, 2).map(row => {
                const event = events.get(`${row.kind}:${row.id}`);
                const message = stage === 'recent' ? event?.action : row.nextAction;
                return <div className="rb-work-item" key={`${row.kind}:${row.id}`}>
                    <div className="rb-work-item-heading"><AdminTextAction title={row.name} onClick={() => onOpen(row)}>{row.name}</AdminTextAction>
                        <span className="rb-work-item-meta">{stage === 'recent' ? event?.createdAt.slice(5, 10).replace('-', '.') : renderTwinRecordStatus(row)}</span>
                    </div>
                    <div className="rb-work-item-content"><span title={message}>{message}</span>{stage !== 'recent' && row.isOverdue ? <OverdueTag overdue/> : null}{stage !== 'recent' && row.needsAttention ? renderTwinRecordPriority(row) : null}<small>{stage !== 'recent' && row.dueDate ? `计划 ${row.dueDate.slice(5).replace('-', '.')}` : ''}</small></div>
                    {stage === 'recent' && row.progressNote ? <p className="rb-work-progress" title={row.progressNote}>{row.progressNote}</p> : null}
                </div>;
            })}
            {group.records.length > 2 ? <AdminTextAction className="rb-work-more" onClick={() => onShow(stage, group.kind)}>查看该类 {group.records.length} 项 ↗</AdminTextAction> : null}
        </div>)}</div> : <AdminEmptyState description={empty[stage]}/>}
        {records.length ? <AdminTextAction className="rb-work-footer" onClick={() => onShow(stage)}>查看全部 {records.length} 项 ↗</AdminTextAction> : null}
    </section>;
}

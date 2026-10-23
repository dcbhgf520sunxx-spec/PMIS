import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AdminButton, AdminProgress, AdminTextAction, PriorityTag } from '../../../components/admin';
import type { PersonalCompletion, TwinFocus, TwinNode } from '../types';
import { mergeNodeAlerts } from './priorityFocus';
import { edges, graphLayout, personalEdges, personalGraphLayout } from './graphLayout';
export function TwinGraph({ nodes, selected, view, focus, onSelect, onFocus, personal = false, onPeriodFilter, completions }: {
    nodes: TwinNode[];
    selected: string;
    view: string;
    focus: TwinFocus | '';
    onSelect: (key: string) => void;
    onFocus: (key: string, level: TwinFocus) => void;
    personal?: boolean;
    onPeriodFilter?: (key: string, filter: 'all' | 'completed' | 'unfinished' | 'overdue' | 'unknown' | 'participating' | 'collaborating') => void;
    completions?: Record<string, PersonalCompletion>;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 640, heights: {} as Record<string, number> });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const resize = () => {
            const width = el.clientWidth;
            const heights = Object.fromEntries(Array.from(el.querySelectorAll<HTMLElement>('[data-node]')).map(item => [item.dataset.node || '', item.offsetHeight]));
            setSize(previous => previous.width === width && Object.keys(heights).every(key => previous.heights[key] === heights[key]) ? previous : { width, heights });
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        el.querySelectorAll('[data-node]').forEach(node => observer.observe(node));
        return () => observer.disconnect();
    }, [nodes]);
    const nodeHeight = Math.max(110, ...Object.values(size.heights));
    const layout = personal ? personalGraphLayout(size.width, nodeHeight, selected, size.heights) : graphLayout(size.width, nodeHeight, selected, view, size.heights);
    const links = personal ? personalEdges : edges;
    return <div className="rb-graph"><div className="rb-scene-heading">
      <div className="rb-scene-label">{personal ? '点击节点或数字查看工作明细' : '产品关联 · 点击节点查看明细'}</div>
      <div className="rb-scene-key" aria-label="连线图例"><span><b className="rb-key-line"/>{personal ? '责任与参与关联' : '建设关联'}</span>{!personal ? <span><b className="rb-key-line dashed"/>产品服务</span> : null}</div>
    </div><div className="rb-scene" ref={ref} style={{ minHeight: layout.height }}>
    <svg className="rb-wires" aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`}>
      {layout.wires.map((wire, index) => <g key={wire.key} opacity={wire.opacity}>
        <path data-edge={wire.key} className={`rb-wire ${wire.service ? 'rb-service' : ''} ${wire.lit ? 'is-lit' : ''}`} d={wire.path}/>
        {!wire.service ? <path className={`rb-wire-current ${wire.lit ? 'is-lit' : ''}`} d={wire.path} pathLength={100} style={{ animationDelay: `${-index * .18}s` }}/> : null}
        <circle cx={wire.last[0]} cy={wire.last[1]} r={2.2} fill={wire.lit ? '#2154e8' : '#9fb7de'}/>
        {wire.label ? <text className="rb-edge-label" x={wire.labelX} y={wire.labelY} textAnchor="middle">{wire.label}</text> : null}
      </g>)}
    </svg>
    {nodes.map(node => {
            const box = layout.boxes[node.key];
            const alert = mergeNodeAlerts(node.kind, node.priorityAlerts);
            const nearby = node.key === selected || links.some(([a, b]) => (a === selected || b === selected) && (a === node.key || b === node.key));
            const central = node.key === 'product' || node.key === 'person';
            const c = completions?.[node.key];
            if(c) return <div key={node.key} className={`rb-node-wrap rb-period-node ${alert?'has-alert':''}`} data-node={node.key} style={{left:box.x,top:box.y,width:box.w,'--rb-alert-width':alert?`${alert.text.length*6+20}px`:'0px'} as CSSProperties}>
              <AdminButton className="rb-node" aria-pressed={selected===node.key} aria-label={`${node.title}本期纳入`} onClick={()=>onSelect(node.key)}>
                <span className="rb-node-top">{node.title}</span>
                <span className="rb-period-node-values"><span><b>{node.available?c.included??'—':'—'}</b><small>项纳入</small></span><span className="rb-period-node-rate"><strong>{!node.available?'未授权':c.unknown?'待核实':c.rate===null?'—':`${c.rate}%`}</strong><small>完成率</small></span></span>
                {c.rate!==null?<AdminProgress percent={c.rate} showInfo={false} size="small"/>:null}
              </AdminButton>
              {node.available?<div className="rb-period-node-details"><div className="rb-period-node-counts"><AdminTextAction aria-label={`${node.title}已完成`} onClick={()=>onPeriodFilter?.(node.key,'completed')}>已完成 <b>{c.completed??'—'}</b></AdminTextAction><AdminTextAction aria-label={`${node.title}未完成`} onClick={()=>onPeriodFilter?.(node.key,'unfinished')}>未完成 <b>{c.unfinished}</b></AdminTextAction></div><div className="rb-period-node-meta">{c.carried?<span title="纳入本期的期初逾期未完成工作">期初遗留 {c.carried}</span>:null}{c.participating?<AdminTextAction onClick={()=>onPeriodFilter?.(node.key,'participating')}>参与 {c.participating}</AdminTextAction>:null}{c.collaborating?<AdminTextAction onClick={()=>onPeriodFilter?.(node.key,'collaborating')}>协作 {c.collaborating}</AdminTextAction>:null}{c.unknown?<AdminTextAction title={`已知完成 ${c.knownCompleted}／纳入 ${c.knownIncluded}`} onClick={()=>onPeriodFilter?.(node.key,'unknown')}>待核实 {c.unknown}</AdminTextAction>:null}{node.periodStats?.overdue?<AdminTextAction className="rb-period-overdue" onClick={()=>onPeriodFilter?.(node.key,'overdue')}>逾期 {node.periodStats.overdue}</AdminTextAction>:null}</div></div>:null}
              {alert?<div className="rb-node-alerts"><AdminButton type="text" className="rb-node-alert" aria-label={`${node.title} · ${alert.description}`} title={alert.description} onClick={()=>onFocus(node.key,alert.focus)}><PriorityTag level={alert.level} text={alert.text}/></AdminButton></div>:null}
            </div>;
            return <div key={node.key} className={`rb-node-wrap ${alert ? 'has-alert' : ''} ${node.periodStats ? 'has-period-stats' : ''}`} data-node={node.key} style={{ left: box.x, top: box.y, width: box.w, opacity: view === 'focus' && !nearby ? .25 : 1, '--rb-alert-width': alert ? `${alert.text.length * 6 + 20}px` : '0px' } as CSSProperties}><AdminButton className={`rb-node ${central ? 'product' : ''}`} aria-pressed={selected === node.key} onClick={() => onSelect(node.key)}>
      <span className="rb-node-top">{node.title}</span><span className="rb-node-name">{central ? node.value : <><b>{node.value}</b> {node.unit}</>}</span><span className="rb-node-bottom">{node.note}</span>
    </AdminButton>{node.periodStats ? <div className="rb-node-period-actions"><AdminTextAction onClick={()=>onPeriodFilter?.(node.key,'unfinished')}>未完成 {node.periodStats.unfinished}</AdminTextAction>{node.periodStats.overdue ? <AdminTextAction onClick={()=>onPeriodFilter?.(node.key,'overdue')}>逾期 {node.periodStats.overdue}</AdminTextAction> : null}{node.periodStats.unknown ? <AdminTextAction onClick={()=>onPeriodFilter?.(node.key,'unknown')}>待核实 {node.periodStats.unknown}</AdminTextAction> : null}</div> : null}{alert ? <div className="rb-node-alerts"><AdminButton type="text" className="rb-node-alert" aria-pressed={selected === node.key && Boolean(focus)} aria-label={`${node.title} · ${alert.description}`} title={`${alert.description}，点击查看明细`} onClick={() => onFocus(node.key, alert.focus)}><PriorityTag level={alert.level} text={alert.text}/></AdminButton></div> : null}</div>;
        })}
  </div></div>;
}

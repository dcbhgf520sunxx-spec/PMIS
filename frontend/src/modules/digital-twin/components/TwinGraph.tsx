import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AdminButton, PriorityTag } from '../../../components/admin';
import type { TwinFocus, TwinNode } from '../types';
import { mergeNodeAlerts } from './priorityFocus';
import { edges, graphLayout } from './graphLayout';
export function TwinGraph({ nodes, selected, view, focus, onSelect, onFocus }: {
    nodes: TwinNode[];
    selected: string;
    view: string;
    focus: TwinFocus | '';
    onSelect: (key: string) => void;
    onFocus: (key: string, level: TwinFocus) => void;
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
    const layout = graphLayout(size.width, Math.max(110, ...Object.values(size.heights)), selected, view, size.heights);
    return <div className="rb-graph"><div className="rb-scene-heading">
      <div className="rb-scene-label">产品关联 · 点击节点查看明细</div>
      <div className="rb-scene-key" aria-label="连线图例"><span><b className="rb-key-line"/>建设关联</span><span><b className="rb-key-line dashed"/>产品服务</span></div>
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
            const nearby = node.key === selected || edges.some(([a, b]) => (a === selected || b === selected) && (a === node.key || b === node.key));
            return <div key={node.key} className={`rb-node-wrap ${alert ? 'has-alert' : ''}`} data-node={node.key} style={{ left: box.x, top: box.y, width: box.w, opacity: view === 'focus' && !nearby ? .25 : 1, '--rb-alert-width': alert ? `${alert.text.length * 6 + 20}px` : '0px' } as CSSProperties}><AdminButton className={`rb-node ${node.key === 'product' ? 'product' : ''}`} aria-pressed={selected === node.key} onClick={() => onSelect(node.key)}>
      <span className="rb-node-top">{node.title}</span><span className="rb-node-name">{node.key === 'product' ? node.value : <><b>{node.value}</b> {node.unit}</>}</span><span className="rb-node-bottom">{node.note}</span>
    </AdminButton>{alert ? <div className="rb-node-alerts"><AdminButton type="text" className="rb-node-alert" aria-pressed={selected === node.key && Boolean(focus)} aria-label={`${node.title} · ${alert.description}`} title={`${alert.description}，点击查看明细`} onClick={() => onFocus(node.key, alert.focus)}><PriorityTag level={alert.level} text={alert.text}/></AdminButton></div> : null}</div>;
        })}
  </div></div>;
}

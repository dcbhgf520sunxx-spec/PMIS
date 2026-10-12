import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { OntologyClass, OntologyLink } from '../types';
import { relationKey } from '../relationExpansion';
import { relationCurve } from './relationCurve';
// SVG expresses ontology directions; page controls use existing SIDM admin components.
export function OntologyGraph({ selected, classes, links, activeRelation, onSelect, onRelation }: {
  selected: string; activeRelation: string; classes: OntologyClass[]; links: OntologyLink[];
  onSelect: (id: string) => void; onRelation: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const center = () => { element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2); };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selected]);
  const activeLink = links.find(link => relationKey(link) === activeRelation);
  const highlighted = (id: string) => activeLink?.source === id || activeLink?.target === id;
  const byId = Object.fromEntries(classes.map(c => [c.id, c]));
  const incoming = [...new Set(links.filter(r => r.target === selected && r.source !== selected).map(r => r.source))];
  const outgoing = [...new Set(links.filter(r => r.source === selected && r.target !== selected).map(r => r.target))];
  const loops = links.filter(r => r.source === selected && r.target === selected);
  const height = Math.max(490, Math.max(incoming.length, outgoing.length) * 86 + 130), cy = height / 2;
  const loopPath = `M 370 ${cy - 24} C 320 ${cy - 112} 480 ${cy - 112} 430 ${cy - 24}`;
  const loopActive = loops.some(r => relationKey(r) === activeRelation);
  useLayoutEffect(() => {
    const bounds = contentRef.current?.getBBox();
    if (!bounds) return;
    // Center the occupied graph, including labels and loops, rather than empty columns.
    const x = bounds.x + bounds.width / 2 - 400;
    const y = bounds.y + bounds.height / 2 - height / 2;
    setOrigin(previous => previous.x === x && previous.y === y ? previous : { x, y });
  }, [selected, links, activeRelation, height]);
  const keyboard = (action: () => void) => (e: KeyboardEvent<SVGElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); } };
  const node = (id: string, x: number, y: number, focus = false) => <g key={'node-' + id + x} className={'bo-node' + (focus ? ' is-selected' : '') + (highlighted(id) ? ' is-related-selected' : '')} transform={`translate(${x - 70},${y - 24})`} tabIndex={0} role="button" aria-label={'查看' + byId[id].label} onClick={() => onSelect(id)} onKeyDown={keyboard(() => onSelect(id))}><rect width={140} height={48} rx={6}/><text x={70} y={29} textAnchor="middle">{byId[id].label}</text></g>;
  const bundle = (ids: string[], left: boolean) => ids.map((id, i) => {
    const y = 80 + i * 86 + (height - (ids.length * 86 + 100)) / 2;
    const rows = links.filter(r => left ? r.source === id && r.target === selected : r.source === selected && r.target === id);
    const derived = rows.every(r => r.inferred);
    const active = rows.some(r => relationKey(r) === activeRelation);
    const curve = relationCurve(left, y, cy);
    return <g key={(left ? 'in-' : 'out-') + id}>
      <path d={curve.path} className={'bo-edge' + (derived ? ' is-derived' : '') + (active ? ' is-active' : '')} markerEnd={`url(#bo-${active ? 'active' : derived ? 'derived' : 'direct'})`}/>
      {!derived ? <path d={curve.path} pathLength={100} aria-hidden="true" className={'bo-edge-current' + (active ? ' is-active' : '')} style={{ animationDelay: `${-i * .18}s` }}/> : null}
      <text x={curve.labelX} y={curve.labelY} textAnchor="middle" dominantBaseline="central" className="bo-edge-label">{rows.map((r, index) => <tspan key={r.id}>{index ? <tspan aria-hidden="true" className="bo-edge-label-separator"> / </tspan> : null}<tspan className={relationKey(r) === activeRelation ? 'is-active' : undefined} aria-pressed={relationKey(r) === activeRelation} tabIndex={0} role="button" aria-label={'查看' + r.label + '说明'} onClick={() => onRelation(relationKey(r))} onKeyDown={keyboard(() => onRelation(relationKey(r)))}>{r.label}{r.inferred ? '（推导）' : ''}</tspan></tspan>)}</text>
      {node(id, left ? 95 : 705, y)}
    </g>;
  });
  return <div ref={scrollRef} className="bo-graph-scroll"><svg viewBox={`${origin.x} ${origin.y} 800 ${height}`} role="img" aria-label={byId[selected].label + '的本体关系图'}>
    <defs>{['direct', 'derived', 'active'].map(id => <marker key={id} id={'bo-' + id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className={'bo-arrow bo-arrow-' + id}/></marker>)}</defs>
    <g ref={contentRef}>
    {bundle(incoming, true)}{bundle(outgoing, false)}
    {loops.length ? <g><path d={loopPath} className={'bo-edge' + (loops.some(r => relationKey(r) === activeRelation) ? ' is-active' : '')} markerEnd={loops.some(r => relationKey(r) === activeRelation) ? 'url(#bo-active)' : 'url(#bo-direct)'}/><path d={loopPath} pathLength={100} aria-hidden="true" className={'bo-edge-current' + (loopActive ? ' is-active' : '')}/><text x={400} y={cy - 90} dominantBaseline="central" textAnchor="middle" className={'bo-edge-label' + (loops.some(r => relationKey(r) === activeRelation) ? ' is-active' : '')} aria-pressed={loops.some(r => relationKey(r) === activeRelation)} tabIndex={0} role="button" aria-label={'查看' + loops[0].label + '说明'} onClick={() => onRelation(relationKey(loops[0]))} onKeyDown={keyboard(() => onRelation(relationKey(loops[0])))}>{loops.map(r => r.label).join(' / ')}</text></g> : null}
    {node(selected, 400, cy, true)}
    </g>
  </svg></div>;
}

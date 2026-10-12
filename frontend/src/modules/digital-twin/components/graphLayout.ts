export const edges: [
    string,
    string,
    string
][] = [['product', 'requirement', '归属'], ['requirement', 'project', '转项目'], ['project', 'contract', '合同'], ['project', 'work', '项目任务'], ['requirement', 'work', '需求任务'], ['project', 'quality', '项目缺陷'], ['requirement', 'quality', '需求缺陷'], ['project', 'plan', '阶段计划'], ['contract', 'payment', '分期付款'], ['product', 'maintenance', '维保'], ['product', 'order', '工单']];
type Point = [
    number,
    number
];
type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export function graphLayout(w: number, height: number, selected: string, view: string, heights: Record<string, number> = {}) {
    const narrow = w < 460, pad = 16;
    const size = narrow ? Math.min(168, Math.floor((w - 48) / 2)) : Math.min(168, Math.floor((w - 64) / 3));
    const gap = narrow ? 42 : 64, step = height + gap, top = 14;
    const center = (w - size) / 2, right = w - size - pad;
    const pos: Record<string, Point> = narrow ? { maintenance: [pad, top], order: [right, top], product: [center, top + step], requirement: [pad, top + 2 * step], project: [right, top + 2 * step], work: [pad, top + 3 * step], quality: [pad, top + 4 * step], plan: [right, top + 3 * step], contract: [right, top + 4 * step], payment: [right, top + 5 * step] } :
        { requirement: [pad, top], project: [center, top], contract: [right, top], product: [pad, top + step], work: [center, top + step], payment: [right, top + step], maintenance: [pad, top + 2 * step], quality: [center, top + 2 * step], plan: [right, top + 2 * step], order: [pad, top + 3 * step] };
    const boxes: Record<string, Box> = Object.fromEntries(Object.entries(pos).map(([id, [x, y]]) => [id, { x, y, w: size, h: heights[id] || height }]));
    const h = Math.max(...Object.values(boxes).map(box => box.y + box.h)) + 16;
    const isLit = (a: string, b: string) => selected === a || selected === b;
    const port = (id: string, side: string, f = .5): Point => { const b = boxes[id]; return side === 'top' ? [b.x + b.w * f, b.y] : side === 'bottom' ? [b.x + b.w * f, b.y + b.h] : side === 'left' ? [b.x, b.y + b.h * f] : [b.x + b.w, b.y + b.h * f]; };
    const roundedRoute = (points: Point[]) => { let path = 'M' + points[0].join(' '); for (let i = 1; i < points.length - 1; i++) {
        const A = points[i - 1], B = points[i], C = points[i + 1], before = Math.hypot(B[0] - A[0], B[1] - A[1]), after = Math.hypot(C[0] - B[0], C[1] - B[1]), radius = Math.min(8, before / 2, after / 2);
        const enter = [B[0] + (A[0] - B[0]) * radius / before, B[1] + (A[1] - B[1]) * radius / before], leave = [B[0] + (C[0] - B[0]) * radius / after, B[1] + (C[1] - B[1]) * radius / after];
        path += ' L' + enter.join(' ') + ' Q' + B.join(' ') + ' ' + leave.join(' ');
    } return path + ' L' + points[points.length - 1].join(' '); };
    const wires = edges.map(([a, b, label]) => {
        let points: Point[], curve = false, customPath: string | undefined, labelX: number | undefined;
        if (!narrow) {
            if (b === 'quality') {
                const A = port(a, 'right', .9), B = port(b, a === 'requirement' ? 'left' : 'right');
                points = [A, B];
                if (a === 'requirement')
                    curve = true;
                else {
                    const corridor = boxes.payment.x - A[0], clearance = Math.min(28, corridor * .55), control = A[0] + clearance / .75;
                    customPath = `M${A.join(' ')} C${control} ${A[1]} ${control} ${B[1]} ${B.join(' ')}`;
                    labelX = A[0] + clearance + 8;
                }
            }
            else if (a === 'product' && b === 'requirement')
                points = [port(a, 'top'), port(b, 'bottom')];
            else if (a === 'product' && b === 'maintenance')
                points = [port(a, 'bottom'), port(b, 'top')];
            else if (a === 'product' && b === 'order') {
                const A = port(a, 'right'), B = port(b, 'right');
                const clearance = Math.min(28, (boxes.work.x - A[0]) * .35), rail = A[0] + clearance;
                points = [A, [rail, A[1]], [rail, B[1]], B];
                customPath = roundedRoute(points);
                labelX = rail + 9;
            }
            else if (a === 'project' && b === 'work')
                points = [port(a, 'bottom'), port(b, 'top')];
            else if (a === 'contract')
                points = [port(a, 'bottom'), port(b, 'top')];
            else if (a === 'project' && b === 'plan') {
                const A = port(a, 'right'), B = port(b, 'left'), bend = A[0] + (B[0] - A[0]) * .85;
                points = [A, B];
                customPath = `M${A.join(' ')} C${bend} ${A[1]} ${B[0]} ${B[1]} ${B.join(' ')}`;
            }
            else {
                points = [port(a, 'right'), port(b, 'left')];
                curve = points[0][1] !== points[1][1];
            }
        }
        else {
            if (a === 'requirement' && b === 'quality') {
                const A = port(a, 'left'), B = port(b, 'left');
                points = [A, [3, A[1]], [3, B[1]], B];
            }
            else if (a === 'project' && b === 'quality') {
                const A = port(a, 'left', 1), B = port(b, 'right'), rail = A[0] - 3;
                points = [A, [rail, A[1]], [rail, B[1]], B];
            }
            else if (a === 'project' && b === 'plan')
                points = [port(a, 'bottom'), port(b, 'top')];
            else if (a === 'product' && ['maintenance', 'order'].includes(b))
                points = [port(a, 'top', b === 'maintenance' ? .25 : .75), port(b, 'bottom')];
            else if (a === 'product' && b === 'requirement')
                points = [port(a, 'bottom', .25), port(b, 'top')];
            else if (a === 'requirement' && b === 'project')
                points = [port(a, 'right'), port(b, 'left')];
            else if (a === 'requirement' && b === 'work')
                points = [port(a, 'bottom'), port(b, 'top')];
            else if (a === 'project' && b === 'work')
                points = [port(a, 'left', .75), port(b, 'right')];
            else if (a === 'project' && b === 'contract') {
                const A = port(a, 'right'), B = port(b, 'right');
                points = [A, [w - 3, A[1]], [w - 3, B[1]], B];
            }
            else
                points = [port(a, 'bottom'), port(b, 'top')];
        }
        if (narrow && b === 'quality')
            customPath = roundedRoute(points);
        const first = points[0], last = points[points.length - 1], mx = (first[0] + last[0]) / 2, lit = isLit(a, b), service = ['maintenance', 'order'].includes(b);
        const path = customPath || (curve ? `M${first.join(' ')} C${mx} ${first[1]} ${mx} ${last[1]} ${last.join(' ')}` : points.map((p, i) => (i ? 'L' : 'M') + p.join(' ')).join(' '));
        const vertical = Math.abs(first[0] - last[0]) < 1, lx = (first[0] + last[0]) / 2 + (vertical ? 19 : 0), ly = (first[1] + last[1]) / 2 + (vertical ? 3 : -7);
        return { key: a + ':' + b, a, b, path, lit, service, opacity: view === 'focus' && !lit ? .12 : 1, last,
            label: narrow || w < 660 ? '' : label, labelX: labelX ?? (a === 'contract' ? w - 42 : lx), labelY: ly };
    });
    return { width: w, height: h, boxes, wires };
}

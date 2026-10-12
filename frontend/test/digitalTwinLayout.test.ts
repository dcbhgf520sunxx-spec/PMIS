import test from 'node:test';
import assert from 'node:assert/strict';
import { graphLayout } from '../src/modules/digital-twin/components/graphLayout.ts';
type Point = [
    number,
    number
];
function sample(path: string) {
    const tokens = path.match(/[MLCQ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || [];
    let index = 0;
    let last: Point = [0, 0];
    const result: Point[] = [];
    const point = (): Point => [Number(tokens[index++]), Number(tokens[index++])];
    while (index < tokens.length) {
        const command = tokens[index++];
        if (command === 'M') {
            last = point();
            result.push(last);
            continue;
        }
        const a = last;
        if (command === 'L') {
            const b = point();
            for (let step = 1; step <= 24; step++) {
                const t = step / 24;
                result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
            last = b;
        }
        if (command === 'C') {
            const b = point(), c = point(), d = point();
            for (let step = 1; step <= 160; step++) {
                const t = step / 160, u = 1 - t;
                result.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
            }
            last = d;
        }
        if (command === 'Q') {
            const b = point(), c = point();
            for (let step = 1; step <= 32; step++) {
                const t = step / 32, u = 1 - t;
                result.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]);
            }
            last = c;
        }
    }
    return result;
}
const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function intersects(a: Point, b: Point, c: Point, d: Point) { return cross(a, b, c) * cross(a, b, d) < -0.00001 && cross(c, d, a) * cross(c, d, b) < -0.00001; }
for (const width of [344, 1060])
    test(`全景宽度${width}：底边随实际卡片高度伸缩，不额外预留一行空间`, () => {
        const heights = { product: 154, order: 99, payment: 99 };
        const compact = graphLayout(width, 154, 'product', 'all', heights);
        const bottom = Math.max(...Object.values(compact.boxes).map(box => box.y + box.h));
        assert.equal(compact.height - bottom, 16);
        const lastNode = width < 460 ? 'payment' : 'order';
        const expanded = graphLayout(width, 154, 'product', 'all', { ...heights, [lastNode]: 240 });
        assert.equal(expanded.height - compact.height, 141);
        assert.equal(expanded.height - (expanded.boxes[lastNode].y + expanded.boxes[lastNode].h), 16);
        for (const key of Object.keys(compact.boxes)) {
            assert.equal(expanded.boxes[key].x, compact.boxes[key].x);
            assert.equal(expanded.boxes[key].y, compact.boxes[key].y);
        }
    });
for (const width of [264, 344, 459, 460, 580, 724, 1060])
    test(`全景宽度${width}：缺陷在任务下方，连线不穿卡片、不交叉`, () => {
        const heights = { product: 154, requirement: 110, project: 122, contract: 110, work: 127, quality: 110, plan: 128, payment: 110, maintenance: 110, order: 122 };
        const layout = graphLayout(width, 154, 'product', 'all', heights);
        assert.equal(layout.boxes.quality.x, layout.boxes.work.x);
        assert.ok(layout.boxes.quality.y > layout.boxes.work.y + layout.boxes.work.h);
        const wires = layout.wires.map(wire => ({ ...wire, points: sample(wire.path) }));
        if (width >= 460) {
            const service = wires.find(wire => wire.key === 'product:order')!;
            const cardRight = layout.boxes.product.x + layout.boxes.product.w;
            assert.equal(service.points[0][0], cardRight);
            const clearance = Math.max(...service.points.map(([x]) => x)) - cardRight;
            assert.ok(clearance > 0 && clearance <= 28, '工单连线在卡片右侧并保留间距');
        }
        for (const wire of wires)
            for (const [key, box] of Object.entries(layout.boxes)) {
                if (key === wire.a || key === wire.b)
                    continue;
                assert.ok(!wire.points.some(([x, y]) => x > box.x + 1 && x < box.x + box.w - 1 && y > box.y + 1 && y < box.y + box.h - 1), `${wire.key}穿过${key}`);
            }
        for (let i = 0; i < wires.length; i++)
            for (let j = i + 1; j < wires.length; j++) {
                const a = wires[i], b = wires[j];
                for (let m = 1; m < a.points.length; m++)
                    for (let n = 1; n < b.points.length; n++)
                        assert.ok(!intersects(a.points[m - 1], a.points[m], b.points[n - 1], b.points[n]), `${a.key}交叉${b.key}`);
            }
        assert.match(wires.find(wire => wire.key === 'requirement:quality')!.path, /C|Q/);
        assert.match(wires.find(wire => wire.key === 'project:quality')!.path, /C|Q/);
    });

import test from 'node:test';
import assert from 'node:assert/strict';
import { personalGraphLayout } from '../src/modules/digital-twin/components/graphLayout.ts';

test('个人图以人员为中心连接六类工作，窄屏不重叠或横向溢出', () => {
    for (const height of [120, 144, 160, 168]) for (const width of [320, 460, 640, 1000]) {
        const layout = personalGraphLayout(width, height, 'person', {});
        const boxes = Object.entries(layout.boxes);
        assert.equal(boxes.length, 7);
        assert.equal(layout.wires.length, 6);
        for (const [, box] of boxes) { assert.ok(box.x >= 0); assert.ok(box.x + box.w <= width); assert.ok(box.y + box.h <= layout.height); }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i][1], b = boxes[j][1];
            assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
        }
        assert.ok(layout.wires.every(wire => wire.a === 'person' && wire.lit));
    }
});

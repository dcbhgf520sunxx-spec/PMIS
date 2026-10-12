import test from 'node:test';
import assert from 'node:assert/strict';
import { relationCurve } from '../src/modules/business-ontology/components/relationCurve.ts';

for (const left of [true, false]) {
  for (const outerY of [80, 166, 252, 338, 424, 510, 596, 682]) {
    test(`${left ? '左' : '右'}侧节点高度${outerY}：标签锚点位于实际曲线上`, () => {
      const curve = relationCurve(left, outerY, 409);
      const coordinates = curve.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const [x0, y0, x1, y1, x2, y2, x3, y3] = coordinates;
      const t = 0.5, u = 1 - t;
      const x = u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3;
      const y = u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3;
      assert.equal(curve.labelX, x);
      assert.equal(curve.labelY, y);
      assert.ok(curve.labelX > x0 && curve.labelX < x3);
    });
  }
}

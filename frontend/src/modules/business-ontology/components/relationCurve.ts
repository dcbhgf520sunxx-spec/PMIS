export function relationCurve(left: boolean, outerY: number, centerY: number) {
  const xs = left ? [165, 230, 270, 330] : [470, 530, 570, 635];
  const ys = left ? [outerY, outerY, centerY, centerY] : [centerY, centerY, outerY, outerY];
  return {
    path: `M ${xs[0]} ${ys[0]} C ${xs[1]} ${ys[1]}, ${xs[2]} ${ys[2]}, ${xs[3]} ${ys[3]}`,
    labelX: (xs[0] + 3 * xs[1] + 3 * xs[2] + xs[3]) / 8,
    labelY: (ys[0] + 3 * ys[1] + 3 * ys[2] + ys[3]) / 8
  };
}

// The Hermes Agent mark, redrawn with the page's pen on a 24-unit square.
// The mark belongs to its owner.

import type { Rand } from '../ink';
import type { Layers } from './marks';

/** a point the pen passes through; a third number marks a corner, where the
    pen stops and turns instead of rounding the bend */
type P = readonly [number, number, 1?];

const n = (v: number) => v.toFixed(2);

/** the hand's wobble */
const shake = (r: Rand, pts: P[], w: number): P[] => pts.map(([x, y, c]) => [x + (r() - 0.5) * 2 * w, y + (r() - 0.5) * 2 * w, c]);

/** the pen's curve through the points (the same Catmull-Rom as ink.ts's
    curve, finer grained, with corners, and able to close on itself) */
function trace(q: P[], closed = false): string {
  const len = q.length;
  const at = (i: number) => (closed ? q[(i + len) % len] : q[Math.max(0, Math.min(len - 1, i))]);
  let d = `M${n(q[0][0])} ${n(q[0][1])}`;
  for (let i = 0; i < (closed ? len : len - 1); i++) {
    const p1 = at(i);
    const p2 = at(i + 1);
    const p0 = p1[2] ? p1 : at(i - 1);
    const p3 = p2[2] ? p2 : at(i + 2);
    d +=
      `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)}` +
      ` ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)}` +
      ` ${n(p2[0])} ${n(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

/** which way round a shape was drawn */
const turn = (q: P[]) => q.reduce((a, p, i) => a + p[0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * p[1], 0);

/** a filled shape. Every shape in a layer goes round the same way, so they
    add up; a `hole` goes the other way and takes its inside back out. */
const shape = (r: Rand, pts: P[], w = 0.06) => trace(shake(r, turn(pts) > 0 ? pts : [...pts].reverse(), w), true);
const hole = (r: Rand, pts: P[], w = 0.04) => trace(shake(r, turn(pts) < 0 ? pts : [...pts].reverse(), w), true);

/** an open stroke */
const pen = (r: Rand, pts: P[], w = 0.05) => trace(shake(r, pts, w));

/** hermes: the girl in three-quarter view under a black bob, a white band
    over the crown. Her hair is inked solid; the face, the band and the shine
    are paper laid on it, and her eyes and lips are holes left in that paper. */
export function hermes(r: Rand): Layers {
  // the shine across the fringe: a row of torn patches, their corners
  // kicking up and down, the row rising toward the band
  let shine = '';
  const patch = (x0: number, x1: number, y0: number, y1: number, upL: number, upR: number, dnL: number, dnR: number) => {
    const j = () => (r() - 0.5) * 0.18;
    const xm = (x0 + x1) / 2 + j();
    const ym = (y0 + y1) / 2;
    shine += shape(r, [
      [x0 + 0.1 + j(), y0 - 0.42 - upL, 1], [x0 + 0.45, y0 - 0.34 + j(), 1], [x1 - 0.42, y1 - 0.42 + j(), 1], [x1 - 0.08 + j(), y1 - 0.45 - upR, 1],
      [x1 + 0.02, y1 + 0.1 + j(), 1], [x1 - 0.14 + j(), y1 + 0.42 + dnR, 1], [x1 - 0.42, y1 + 0.36 + j(), 1], [xm, ym + 0.46 + j(), 1],
      [x0 + 0.42, y0 + 0.38 + j(), 1], [x0 + 0.1 + j(), y0 + 0.45 + dnL, 1], [x0 - 0.02, y0 + 0.05 + j(), 1],
    ], 0.02);
  };
  patch(3.3, 4.4, 5.4, 5.25, 0.1, 0.5, 0.5, 0.1);
  patch(4.52, 5.95, 5.3, 5.1, 0, 0.8, 0.15, 0.3);
  patch(6.07, 7.55, 5.15, 5, 0.25, 0.6, 0.3, 0);
  patch(7.67, 9.05, 5.05, 4.92, 0, 0.25, 0.1, 0.4);
  patch(9.17, 10.7, 4.92, 4.6, 0.3, 0.9, 0.5, 0.15);
  patch(10.82, 12.9, 4.35, 3.95, 0.5, 0.3, 0.2, 0.6);
  patch(15.8, 17.15, 4.8, 4.45, 0.2, 0.5, 0.5, 0.1);
  patch(17.27, 18.7, 4.3, 3.75, 0.1, 0.65, 0.3, 0.7);

  return {
    ink:
      // the hair: crown, the long side, the dark under her chin, the curls
      // at the left, the lock down the far cheek
      shape(r, [
        [11.6, 0.08], [13.6, 0.15], [15.9, 0.65], [18.2, 2.1], [20.05, 4.8], [21.05, 8.4], [21.65, 12], [22.2, 15], [22.5, 17.5], [22.38, 19.6],
        [21.95, 21.2], [21.4, 22.6], [20.8, 23.7, 1],
        [20.2, 22.8], [19.2, 21.85], [17.7, 21.3], [16.2, 21.3], [15, 21.6], [14.3, 21.95, 1], [12.6, 22.6], [11.1, 23.2],
        [10.2, 23.9, 1], [8, 23.9], [5.9, 23.9, 1], [6.35, 21.8, 1],
        [5.6, 22.5], [4.6, 22.7], [3.7, 22.2], [3.2, 21.3, 1],
        [2, 20.5], [1.1, 19.2], [0.85, 17.8], [1.15, 16.7], [1.8, 15.8, 1],
        [1.75, 17], [2.2, 18], [3, 18.25], [3.65, 17.4], [4, 15.6], [4.25, 13.4], [4.4, 11.5, 1],
        [3.2, 11.15], [2.3, 10], [1.95, 8.2], [2.15, 6.2], [3.1, 4.35], [4.65, 2.9], [6.7, 1.6], [9.3, 0.5],
      ], 0.08) +
      // the flip at the right, standing off the hair
      shape(r, [
        [23.4, 16.5, 1], [23.93, 18.2], [23.88, 20.1], [23.2, 21.6], [22.1, 22.7], [20.9, 23.6, 1],
        [21.9, 22.25], [22.85, 20.9], [23.32, 19.3], [23.42, 17.8],
      ], 0.05),
    paper:
      // her face: under the fringe, down the side lock, round the jaw, and
      // up the far cheek, where the far eye bites into it
      shape(r, [
        [4.75, 9.85, 1], [5.4, 9.6], [5.9, 9.42, 1], [5.85, 8.4, 1], [6.3, 9.3, 1], [7, 9.2], [7.45, 9.7, 1], [7.8, 9.15, 1],
        [9.4, 9.1], [11.2, 9.2, 1], [11.38, 8.9, 1], [11.5, 9.25, 1], [12.35, 9.45, 1],
        [12.4, 11.5], [12.25, 14], [11.9, 16.5], [11.55, 18.1], [11.1, 18.95, 1],
        [10.4, 18.05], [9.7, 17.55], [8.4, 17.5], [7.3, 17.4], [6.55, 16.9], [5.9, 15.7], [5.35, 14.3], [5.1, 13.1], [5.2, 12.2, 1],
        [5.7, 11.87], [6.05, 11.2], [6.03, 10.6], [5.7, 10.22], [5.25, 10.12], [4.9, 10.22, 1],
      ], 0.04) +
      // a parting in the fringe
      shape(r, [[8.7, 9.2, 1], [8.15, 7.05, 1], [9.05, 9.2, 1]], 0.03) +
      // the near eye: lid, iris and lower lashes in one dark almond...
      hole(r, [
        [7.85, 10, 1], [8.1, 9.7], [8.6, 9.45], [9.2, 9.36], [9.85, 9.45], [10.4, 9.75], [10.8, 10.05], [11.15, 10.2, 1],
        [10.8, 10.45, 1], [11, 10.64, 1], [10.7, 10.72], [10.52, 11.02], [10.05, 11.33], [9.3, 11.45], [8.6, 11.36], [8.05, 11.16, 1],
      ], 0.02) +
      // ...and the whites put back either side of the iris
      shape(r, [[7.72, 10.42, 1], [8.15, 10.3], [8.66, 10.1, 1], [8.52, 10.33], [8.49, 10.6], [8.6, 10.93], [8.83, 11.2, 1], [8.45, 11.2], [8.05, 11.02], [7.72, 11, 1]], 0.015) +
      shape(r, [[9.68, 10.1, 1], [10.15, 10.2], [10.62, 10.45, 1], [10.42, 10.85], [10.05, 11.14], [9.55, 11.26, 1], [9.75, 10.95], [9.85, 10.6], [9.8, 10.3]], 0.015) +
      // the light in the far eye
      shape(r, [[5.17, 10.95], [5.34, 10.85], [5.43, 11.25], [5.35, 11.65], [5.2, 11.5]], 0.015) +
      // the crease of the far lid
      shape(r, [[5.1, 10.52, 1], [5.5, 10.4], [5.93, 10.64, 1], [5.5, 10.52]], 0.01) +
      // her upper lip
      hole(r, [[5.7, 14.2, 1], [6.05, 14.12], [6.45, 14.25], [7, 14.5], [7.7, 14.85, 1], [7, 14.9], [6.4, 14.74], [5.95, 14.8, 1]], 0.02) +
      // the neck
      shape(r, [[11.85, 19.25, 1], [13.6, 20.9, 1], [10.85, 22.3, 1], [9.85, 20.4, 1]], 0.05) +
      // the band, over the crown and down to its tip by her ear
      shape(r, [
        [8.3, 0.98, 1], [9.9, 0.85], [11.1, 0.98], [12, 1.5], [12.9, 2.6], [13.7, 4.2], [14.25, 6.2, 1], [14.7, 6.4], [14.65, 6.8],
        [14.4, 7.25, 1], [14.95, 6.95], [15.4, 6.92], [15.9, 7.15, 1], [15.55, 6.6], [15.5, 6.3], [15.6, 6.1, 1],
        [15.35, 4.6], [14.65, 3], [13.6, 1.6], [12.35, 0.5, 1], [11, 0.42], [9.6, 0.62],
      ], 0.05) +
      shine +
      shape(r, [[2.8, 6.35, 1], [3.1, 5.2, 1], [3.75, 4.35, 1], [3.3, 5.5, 1]], 0.03) +
      // light on the curls, and through the hair by her ear
      shape(r, [[1.15, 18.5, 1], [1.9, 19.7], [3.1, 20.1], [4.2, 19.5], [4.9, 18.4, 1], [4, 19.1], [3, 19.5], [2, 19.2]], 0.04) +
      shape(r, [[3.6, 21.5, 1], [4.4, 21.6], [5.2, 21], [5.9, 19.7, 1], [5.3, 20.6], [4.5, 21.2]], 0.04) +
      shape(r, [[14.1, 14.9, 1], [14.3, 16.5, 1], [13.4, 17.05, 1]], 0.04) +
      shape(r, [[14.4, 17.3, 1], [14.5, 18.1], [13.9, 18.6], [13.3, 18.4], [13.2, 18, 1]], 0.04) +
      // strands catching the light
      shape(r, [[17, 6.2, 1], [18.05, 8.9], [18.95, 12], [19.45, 14.5, 1], [18.65, 11.95], [17.8, 8.95]], 0.03) +
      shape(r, [[14.9, 10.55, 1], [15.6, 10.18], [16.35, 10.4, 1], [15.6, 10.42]], 0.03) +
      // the brush running dry at the bottom
      shape(r, [[8.5, 24, 1], [9.9, 22.9, 1], [9.1, 24, 1]], 0.04) +
      shape(r, [[7.1, 24, 1], [8, 23.2, 1], [7.5, 24, 1]], 0.04),
    line:
      // nose, lower lip
      pen(r, [[5.25, 12.3], [5.25, 12.75], [5.6, 13.2], [5.9, 13.65], [5.8, 14], [5.6, 14.15]], 0.02) +
      pen(r, [[6.05, 12.85], [6.3, 13.1]], 0.02) +
      pen(r, [[5.95, 15.05], [6.1, 15.5], [6.45, 15.6], [6.8, 15.2]], 0.02) +
      // her collar
      pen(r, [[14.6, 22.2], [13.6, 23], [12.9, 23.9]], 0.06) +
      pen(r, [[16.7, 22.1], [15.7, 22.9], [15.2, 23.9]], 0.06),
  };
}

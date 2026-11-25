// The marks of the coding agents fleet sets up, redrawn with the page's own
// pen on a 24-unit square. Each mark belongs to its owner.

import { curve, stroke, strokes, type Pt, type Rand } from '../ink';
import { hermes } from './hermes';

/** a mark in layers, laid down in this order: solid ink, paper over it,
    strokes of paper for highlights, then the pen line */
export type Layers = { ink?: string; paper?: string; light?: string; line: string };

const W = 0.22; // how far the pen wanders at this size

const wob = (r: Rand, pts: Pt[], w = W): Pt[] => pts.map(([x, y]) => [x + (r() - 0.5) * 2 * w, y + (r() - 0.5) * 2 * w]);

/** a closed curve whose ends overlap, the way a hand closes a shape */
const loop = (r: Rand, pts: Pt[], w = W) => curve(wob(r, [...pts, pts[0], pts[1]], w));

/** claude code: the little pixel creature */
const claude = (r: Rand): Layers => ({ line:
  strokes(r, [
    [3, 5], [21, 5], [21, 11], [24, 11], [24, 14], [21, 14], [21, 17], [19.5, 17], [19.5, 20], [18, 20],
    [18, 17], [16.5, 17], [16.5, 20], [15, 20], [15, 17], [9, 17], [9, 20], [7.5, 20], [7.5, 17], [6, 17],
    [6, 20], [4.5, 20], [4.5, 17], [3, 17], [3, 14], [0, 14], [0, 11], [3, 11],
  ], W, true) +
  stroke(r, [7, 8.2], [7, 11], 0.1) + stroke(r, [7.6, 8.2], [7.6, 11], 0.1) +
  stroke(r, [16.4, 8.2], [16.4, 11], 0.1) + stroke(r, [17, 8.2], [17, 11], 0.1) });

/** codex: a prompt inside a cloud */
function codex(r: Rand): Layers {
  const cloud: Pt[] = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 - 0.4;
    const rad = 9.6 + 1.5 * Math.cos(a * 6);
    cloud.push([12 + Math.cos(a) * rad, 12 + Math.sin(a) * rad]);
  }
  return { line: loop(r, cloud, 0.15) + strokes(r, [[7.6, 8.8], [10.8, 12], [7.6, 15.2]], 0.15) + stroke(r, [12.6, 15.4], [17, 15.4], 0.15) };
}

/** opencode: a frame, shaded */
function opencode(r: Rand): Layers {
  let d = strokes(r, [[4.5, 2], [19.5, 2], [19.5, 22], [4.5, 22]], W, true) + strokes(r, [[8.3, 6], [15.7, 6], [15.7, 18], [8.3, 18]], W, true);
  for (let y = 3.4; y < 22; y += 1.7) d += stroke(r, [4.9, y], [8, y - 0.9], 0.12) + stroke(r, [16, y], [19.1, y - 0.9], 0.12);
  for (let x = 9; x < 16; x += 1.7) d += stroke(r, [x, 5.6], [x + 0.9, 2.6], 0.12) + stroke(r, [x, 21.4], [x + 0.9, 18.4], 0.12);
  return { line: d };
}

/** antigravity: the arch */
const antigravity = (r: Rand): Layers => ({ line:
  loop(r, [
    [0.9, 21.2], [4.6, 15.2], [7.6, 6], [12, 1.4], [16.4, 6], [19.4, 15.2], [23.1, 21.2], [22.6, 22.8], [20.6, 22],
    [17, 17.6], [14.4, 13], [12, 11.6], [9.6, 13], [7, 17.6], [3.4, 22], [1.4, 22.8],
  ], 0.18) });

/** t3 code: its name on a tile */
const t3 = (r: Rand): Layers => ({ line:
  loop(r, [[4, 2], [20, 2], [22, 4], [22, 20], [20, 22], [4, 22], [2, 20], [2, 4]], 0.15) +
  stroke(r, [5.4, 8], [11.6, 8], 0.12) + stroke(r, [8.5, 8], [8.5, 16.6], 0.12) +
  curve(wob(r, [[13.4, 8.6], [15.8, 7.7], [17.8, 9.2], [16.6, 11.6], [15, 12.1]], 0.1)) +
  curve(wob(r, [[15, 12.1], [17.4, 12.8], [18.2, 14.9], [16.2, 16.7], [13.2, 16]], 0.1)) });

/** name, and how to draw it */
export const MARKS: [string, (r: Rand) => Layers][] = [
  ['claude code', claude],
  ['codex', codex],
  ['opencode', opencode],
  ['hermes', hermes],
  ['antigravity', antigravity],
  ['t3 code', t3],
];

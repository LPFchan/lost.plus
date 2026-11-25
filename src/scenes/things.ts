// What is in an account, cut out of paper: the mail, the calendar, an
// address card, and a folder of files with a document and a spreadsheet
// standing up out of it. Each is drawn about its own middle, a hundred-odd
// units across, as a stack of layers: cut paper, and the pen on it.

import { ring, scribble, stroke, strokes, type Pt, type Rand } from '../ink';

export type Thing = 'mail' | 'calendar' | 'card' | 'files';

/** a layer is either cut paper (`fill`; `cast` if it throws a shadow) or a
    pen line (`pen` is its class). `t` moves the layer within the thing. */
export type Layer = { d: string; fill?: string; cast?: boolean; pen?: string; t?: string };

const CREAM = '#fffaf3';
const SWEATER = '#f2e8dd';
const TAN = '#ebdcca';
const ASH = '#e0d8ce';

/** paper cut with scissors: straight edges, corners not quite where they
    were meant to be */
function cut(r: Rand, pts: Pt[], w = 1.2): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + (r() - 0.5) * 2 * w).toFixed(1)} ${(y + (r() - 0.5) * 2 * w).toFixed(1)}`).join('') + 'Z';
}

const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** a full stop of ink */
const dot = (x: number, y: number, rad: number) =>
  `M${(x - rad).toFixed(1)} ${y.toFixed(1)}a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0Z`;

const moved = (layers: Layer[], t: string): Layer[] => layers.map((l) => ({ ...l, t }));

/** the back of an envelope: the flap, and the two folds that meet under it */
const envelope = (r: Rand, tone: string): Layer[] => [
  { d: cut(r, rect(-62, -41, 124, 82)), fill: tone, cast: true },
  { d: stroke(r, [-60, 39], [-17, -3], 0.5) + stroke(r, [60, 39], [17, -3], 0.5), pen: 'soft' },
  { d: strokes(r, [[-60, -39], [0, 10], [60, -39]], 0.5) },
];

/** a document: a sheet with its corner turned, a heading, lines */
const doc = (r: Rand): Layer[] => [
  { d: cut(r, [[-43, -55], [25, -55], [43, -37], [43, 55], [-43, 55]], 0.8), fill: CREAM },
  { d: strokes(r, [[25, -55], [25, -37], [43, -37]], 0.3) + stroke(r, [-30, -34], [2, -34], 0.4) },
  { d: [-18, -4].map((y) => scribble(r, -30, y, 60, 1.2)).join(''), pen: 'soft thin' },
];

/** a spreadsheet: a header row, and the grid under it */
const sheet = (r: Rand): Layer[] => [
  { d: cut(r, rect(-58, -43, 116, 86), 0.8), fill: SWEATER },
  { d: cut(r, rect(-58, -43, 116, 18), 0.5), fill: TAN },
  {
    d:
      [-25, -8, 9].map((y) => stroke(r, [-56, y], [56, y], 0.4)).join('') +
      [-26, 16].map((x) => stroke(r, [x, -41], [x, 20], 0.4)).join(''),
    pen: 'soft thin',
  },
];

export const THINGS: Record<Thing, (r: Rand) => Layer[]> = {
  // two letters, one lying on the other
  mail: (r) => [...moved(envelope(r, SWEATER), 'translate(14 -16) rotate(9)'), ...envelope(r, CREAM)],

  // a month off a wall calendar: the band it hung by, the days, and today
  calendar: (r) => {
    let days = '';
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 5; i++) {
        if (j === 3 && i > 2) continue;
        days += dot(-32 + i * 16 + (r() - 0.5), -8 + j * 16 + (r() - 0.5), 2.1);
      }
    return [
      { d: cut(r, rect(-47, -52, 94, 104)), fill: CREAM, cast: true },
      { d: cut(r, rect(-47, -52, 94, 24), 0.6), fill: TAN },
      { d: stroke(r, [-45, -28], [45, -28], 0.4) + stroke(r, [-22, -60], [-22, -45], 0.2) + stroke(r, [22, -60], [22, -45], 0.2) },
      { d: days, pen: 'dot' },
      { d: ring(r, 0, 8, 8, 8, 0.3) },
    ];
  },

  // an address card: whose it is, and the lines of how to reach them
  card: (r) => [
    { d: cut(r, rect(-56, -35, 112, 70)), fill: CREAM, cast: true },
    {
      d:
        ring(r, -30, -9, 9, 9, 0.3) +
        strokes(r, [[-47, 21], [-44, 10], [-36, 5], [-24, 5], [-16, 10], [-13, 21]], 0.3) +
        stroke(r, [0, -15], [40, -15], 0.4),
    },
    { d: scribble(r, 0, 1, 42, 1.2) + scribble(r, 0, 15, 30, 1.2), pen: 'soft thin' },
  ],

  // a folder with its tab, a document and a spreadsheet standing up out of
  // it, and a label on the front
  files: (r) => [
    { d: cut(r, [[-74, -28], [-68, -44], [-24, -44], [-16, -32], [74, -32], [74, 56], [-74, 56]]), fill: ASH, cast: true },
    ...moved(sheet(r), 'translate(26 -30) rotate(5) scale(0.86)'),
    ...moved(doc(r), 'translate(-28 -34) rotate(-6) scale(0.86)'),
    { d: cut(r, rect(-74, -14, 148, 70)), fill: TAN },
    { d: stroke(r, [-73, -14], [73, -14], 0.5) },
    { d: cut(r, rect(-56, 6, 54, 22), 0.5), fill: CREAM },
    { d: scribble(r, -49, 17, 40, 1.2), pen: 'thin' },
  ],
};

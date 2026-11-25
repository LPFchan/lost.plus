import { useMemo } from 'react';
import { box, ring, rng, stroke, torn, type Pt, type Rand } from '../ink';
import { Art, Knot, Label, Paper, Scene } from '../kit';
import { MACHINES, Machine, type Kind } from './hero';
import { MARKS } from './marks';
import { t } from '../i18n';

// 1: the state you are in before any of this. Three machines pasted along
// the top of a sheet, and under each one what it has of the four things
// fleet keeps in step: the coding agents installed, their instructions,
// their skills, and the ssh keys. What a machine has is inked; what it is
// missing is only dotted in.

const SHEET = { x: 170, y: 78, w: 660, h: 300 };
const COLS = [506, 636, 762];
const ROWS = [146, 208, 276, 342];

// which of three agents (claude code, codex, opencode) each machine has
const INSTALLED = [[true, true, true], [true, false, true], [false, false, false]];
const MARK = 25;

/** the machines, each on its own scrap: kind, scale, tone, tilt */
const HEADS: [Kind, number, string, number][] = [
  ['laptop', 0.42, '#fffaf3', -3],
  ['tower', 0.36, '#f1e6d9', 2.4],
  ['mini', 0.5, '#e3dace', -1.8],
];
const HEAD_Y = 56;
const CARD = { w: 112, h: 98 };

// ---- what goes in a cell ----

/** a page of writing with `lines` lines on it, the third struck if `old` */
export function page(r: Rand, [x, y]: Pt, lines: number, old = false): string {
  let d = box(r, x - 14, y - 18, 28, 36, 0.5);
  for (let i = 0; i < lines; i++) d += stroke(r, [x - 9, y - 11 + i * 6], [x + (i % 2 ? 5 : 9), y - 11 + i * 6], 0.3);
  if (old) d += stroke(r, [x - 11, y + 2], [x + 11, y - 1], 0.3);
  return d;
}

/** a count kept the way a hand keeps one: four strokes and a fifth across */
export function tally(r: Rand, [x, y]: Pt, n: number): string {
  const fives = Math.floor(n / 5);
  const rest = n % 5;
  const width = fives * 26 + (rest ? rest * 5 : -6);
  let px = x - width / 2;
  let d = '';
  for (let g = 0; g < fives; g++, px += 26) {
    for (let i = 0; i < 4; i++) d += stroke(r, [px + i * 5, y - 9], [px + i * 5 + 1, y + 9], 0.4);
    d += stroke(r, [px - 4, y + 6], [px + 19, y - 6], 0.4);
  }
  for (let i = 0; i < rest; i++) d += stroke(r, [px + i * 5, y - 9], [px + i * 5 + 1, y + 9], 0.4);
  return d;
}

/** a key: the bow, the shaft, two teeth */
export const key = (r: Rand, [x, y]: Pt) =>
  ring(r, x - 13, y, 7, 7, 0.4) +
  stroke(r, [x - 6, y], [x + 20, y], 0.4) +
  stroke(r, [x + 12, y], [x + 12, y + 7], 0.3) +
  stroke(r, [x + 18, y], [x + 18, y + 6], 0.3);

export default function DriftScene() {
  const ink = useMemo(() => {
    const r = rng(43);
    const at = (col: number, row: number): Pt => [COLS[col], ROWS[row]];
    let rules = '';
    for (let i = 1; i < ROWS.length; i++) {
      const y = (ROWS[i - 1] + ROWS[i]) / 2 + (i === 2 ? 8 : 0);
      rules += stroke(r, [SHEET.x + 22, y], [SHEET.x + SHEET.w - 22, y], 0.5);
    }
    const [p0, p1, p2] = COLS.map((x): Pt => [x, ROWS[1] - 8]);
    return {
      rules,
      marks: MARKS.slice(0, 3).map(([, draw]) => draw(r).line),
      has:
        page(r, p0, 5) + page(r, p1, 3, true) +
        tally(r, at(0, 2), 14) + tally(r, at(1, 2), 9) +
        key(r, at(0, 3)) + key(r, at(1, 3)),
      // the same shapes where there is nothing: an empty page, no count, no key
      lacks:
        page(r, p2, 0) + stroke(r, [COLS[2] - 7, ROWS[2]], [COLS[2] + 7, ROWS[2]], 0.3) +
        key(r, at(2, 3)),
    };
  }, []);

  const heads = useMemo(
    () =>
      HEADS.map(([kind, s], i) => {
        const [x0, y0, x1, y1] = MACHINES[kind].bb;
        const c: Pt = [COLS[i], HEAD_Y];
        return {
          paper: torn(rng(81 + i * 3), c[0] - CARD.w / 2, c[1] - CARD.h / 2, CARD.w, CARD.h, 5),
          at: [c[0] - ((x0 + x1) / 2) * s, c[1] - ((y0 + y1) / 2) * s] as Pt,
          c,
        };
      }),
    [],
  );

  return (
    <Scene
      seed={5}
      title={t.drift}
      art={
        <Art
          h={392}
          x={[160, 840]}
          labels={
            <>
              {t.rows.map((what, row) => (
                <Label key={what} at={[SHEET.x + 26, ROWS[row]]} from="left" paper>{what}</Label>
              ))}
              {t.ages.map((when, col) => (
                <Label key={when} at={[COLS[col], ROWS[1] + 24]} paper>
                  <span style={{ color: '#8c827a', fontSize: '0.84em' }}>{when}</span>
                </Label>
              ))}
            </>
          }
        >
          <g className="ink">
            <Paper seed={80} {...SHEET} rot={-0.5} />
            <path d={ink.rules} className="soft thin" />
            <path d={ink.has} />
            <path d={ink.lacks} className="soft thin" style={{ strokeDasharray: '2 4' }} />
            {INSTALLED.map((row, col) =>
              row.map((there, i) => (
                <path
                  key={`${col}-${i}`}
                  d={ink.marks[i]}
                  className={there ? 'thin' : 'soft thin'}
                  style={there ? undefined : { strokeDasharray: '2 4' }}
                  transform={`translate(${COLS[col] + (i - 1) * (MARK + 7) - MARK / 2} ${ROWS[0] - MARK / 2}) scale(${MARK / 24})`}
                />
              )),
            )}
          </g>
          {HEADS.map(([kind, s, tone, rot], i) => (
            <g key={kind} transform={`rotate(${rot} ${heads[i].c[0]} ${heads[i].c[1]})`}>
              <path d={heads[i].paper} className="shade" transform="translate(3 4)" />
              <path d={heads[i].paper} className="paper" style={{ fill: tone }} />
              <Machine kind={kind} at={heads[i].at} s={s} seed={91 + i} />
            </g>
          ))}
          <Knot at={[330, 60]} />
          <Knot at={[330, 384]} />
        </Art>
      }
    />
  );
}

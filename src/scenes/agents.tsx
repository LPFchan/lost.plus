import { useMemo } from 'react';
import { rng, scribble, stroke, strokes, type Pt, type Rand } from '../ink';
import { Art, Label, Paper, Knot, Scene } from '../kit';
import { MARKS } from './marks';
import { t } from '../i18n';

// 5: one file of instructions, and the six coding agents fleet points at it.
// Whichever one you open, it reads the same AGENTS.md.

const SHEET = { x: 285, y: 158, w: 420, h: 236 };

// the lines of the file: y, and either a rule you can read or the width of
// a line too small to read. The first is prose; the rest are bullets.
const LINES: [number, string | number][] = [
  [232, 372],
  [264, t.rules[0]],
  [296, 300],
  [330, t.rules[1]],
  [362, 236],
];

const CHIP = 84;
const MARK = 50;
const COLS = [290, 500, 710];
const ABOVE = 52; // the row over the sheet
const BELOW = 478; // and the row under it

const TILT = [-2.4, 1.8, -1.2, 2.2, -1.6, 1.4];

const spot = (i: number): Pt => [COLS[i % 3], i < 3 ? ABOVE : BELOW];

/** an arrow from an agent to the edge of the file */
function reads(r: Rand, from: Pt, to: Pt): string {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]) + Math.PI;
  const arm = (t: number): Pt => [to[0] + Math.cos(a + t) * 11, to[1] + Math.sin(a + t) * 11];
  return stroke(r, from, to, 0.6) + strokes(r, [arm(0.42), to, arm(-0.42)], 0.3);
}

export default function AgentsScene() {
  const marks = useMemo(() => MARKS.map(([, draw], i) => draw(rng(140 + i))), []);
  const { page, ties } = useMemo(() => {
    const r = rng(62);
    let page = stroke(r, [SHEET.x + 22, 206], [SHEET.x + SHEET.w - 22, 206], 0.6);
    LINES.forEach(([y, line], i) => {
      if (i > 0) page += stroke(r, [SHEET.x + 23, y], [SHEET.x + 36, y], 0.4);
      if (typeof line === 'number') page += scribble(r, SHEET.x + (i > 0 ? 43 : 23), y, line, 1.6);
    });
    let ties = '';
    MARKS.forEach((_, i) => {
      const [x] = spot(i);
      const in_ = 500 + (x - 500) * 0.72; // the arrows lean in toward the page
      ties += i < 3
        ? reads(r, [x, ABOVE + 74], [in_, SHEET.y - 8])
        : reads(r, [x, BELOW - 50], [in_, SHEET.y + SHEET.h + 10]);
    });
    return { page, ties };
  }, []);

  return (
    <Scene
      seed={20}
      title={t.agents}
      side="center"
      art={
        <Art
          h={556}
          x={[190, 810]}
          labels={
            <>
              <Label at={[SHEET.x + 23, 188]} from="left" mono paper>AGENTS.md</Label>
              {LINES.map(([y, line]) =>
                typeof line === 'string' ? (
                  <Label key={y} at={[SHEET.x + 41, y]} from="left" paper>{line}</Label>
                ) : null,
              )}
              {MARKS.map(([name], i) => (
                <Label key={name} at={[spot(i)[0], spot(i)[1] + 58]}>{name}</Label>
              ))}
            </>
          }
        >
          <path d={ties} className="thin" />
          <g className="ink">
            <Paper seed={61} x={SHEET.x} y={SHEET.y} w={SHEET.w} h={SHEET.h} rot={-0.6} />
            <path d={page} />
          </g>
          {MARKS.map(([name], i) => {
            const [x, y] = spot(i);
            return (
              <g className="ink" key={name}>
                <Paper seed={71 + i * 3} x={x - CHIP / 2} y={y - CHIP / 2} w={CHIP} h={CHIP} rot={TILT[i]} />
                <g transform={`rotate(${TILT[i]} ${x} ${y}) translate(${x - MARK / 2} ${y - MARK / 2}) scale(${MARK / 24})`}>
                  {marks[i].ink && <path d={marks[i].ink} className="dot" />}
                  {marks[i].paper && <path d={marks[i].paper} className="paper" />}
                  {marks[i].light && <path d={marks[i].light} className="thin" style={{ stroke: '#fffaf3' }} />}
                  <path d={marks[i].line} className={marks[i].ink ? 'thin' : undefined} />
                </g>
              </g>
            );
          })}
          <Knot at={[395, 40]} />
          <Knot at={[605, 520]} />
        </Art>
      }
    />
  );
}

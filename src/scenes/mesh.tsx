import { useMemo } from 'react';
import { rng, stroke, type Pt } from '../ink';
import { Art, Glyph, Knot, Paper, Scene, type Kind } from '../kit';
import { key, page, tally } from './drift';
import { MARKS } from './marks';
import { t } from '../i18n';

// 2: the answer to the table above it. Five machines, a line from each one
// to every other, and on every one of them the same four things, all inked
// now: an agent, its instructions, its skills, a key.

const CHIP = { w: 124, h: 112 };

const MACHINES: [Kind, Pt, number][] = [
  ['laptop', [500, 62], -1.6],
  ['tower', [690, 190], 2.2],
  ['rack', [618, 384], -1.2],
  ['nas', [382, 384], 1.8],
  ['mini', [310, 190], -2.4],
];

export default function MeshScene() {
  const lines = useMemo(() => {
    const r = rng(23);
    let d = '';
    MACHINES.forEach(([, a], i) => MACHINES.slice(i + 1).forEach(([, b]) => (d += stroke(r, a, b, 1.1))));
    return d;
  }, []);

  // what each machine has, drawn once per machine so no two are traced
  const sets = useMemo(
    () =>
      MACHINES.map((_, i) => {
        const r = rng(31 + i);
        return { agent: MARKS[0][1](r).line, rest: page(r, [-16, 0], 4) + tally(r, [22, 0], 5) + key(r, [62, 0]) };
      }),
    [],
  );

  return (
    <Scene
      seed={14}
      title={t.mesh}
      art={
        <Art h={446} x={[190, 810]}>
          <path d={lines} className="thin" />
          {MACHINES.map(([kind, [x, y], rot], i) => (
            <g className="ink" key={kind}>
              <Paper seed={61 + i * 3} x={x - CHIP.w / 2} y={y - CHIP.h / 2} w={CHIP.w} h={CHIP.h} rot={rot} />
              <Glyph kind={kind} at={[x, y - 20]} seed={71 + i} s={1.05} />
              <g transform={`translate(${x - 4} ${y + 30}) scale(0.56)`}>
                <path d={sets[i].agent} className="thin" transform="translate(-74 -13) scale(1.08)" />
                <path d={sets[i].rest} className="thin" />
              </g>
            </g>
          ))}
          <Knot at={[225, 40]} />
          <Knot at={[225, 420]} />
        </Art>
      }
    />
  );
}

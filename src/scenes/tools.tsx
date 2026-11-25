import { useEffect, useMemo, useState } from 'react';
import { curve, ring, rng, scribble, stroke, type Pt, type Rand } from '../ink';
import { Art, Label, Paper, Knot, Sky, Scene } from '../kit';
import { MACHINES, Machine, type Kind } from './hero';
import { MARKS } from './marks';
import { THINGS, type Thing } from './things';
import { t } from '../i18n';

// 5: the account page, with one account switched on, and what is in that
// account beside it: the mail, the calendar, an address card, a folder of
// files. Under them the machines, and on each the agents that live there.
// The thread leaves the switch, goes through the account, and then through
// the eyelet of every agent in turn: one connection, and all of them on it.

/** somewhere a thing is put down: its middle, its size, its lean */
type Seat = { x: number; y: number; s: number; rot: number };

/** where a point of a thing lands once the thing is put down */
function put(c: Seat, [px, py]: Pt): Pt {
  const a = (c.rot * Math.PI) / 180;
  const x = px * c.s;
  const y = py * c.s;
  return [c.x + x * Math.cos(a) - y * Math.sin(a), c.y + x * Math.sin(a) + y * Math.cos(a)];
}

const seat = (c: Seat) => `translate(${c.x} ${c.y}) rotate(${c.rot}) scale(${c.s})`;

// ---- the account page ----

const CARD = { w: 264, h: 196 };
const ROWS: [string, number][] = [['google', -22], ['icloud', 22], ['microsoft', 66]];
const SWITCH = { x: -106, w: 40, h: 20 };

/** the knob of the switch that is on, where the thread starts from, and the
    edge of the page level with it, where the thread comes out */
const KNOB: Pt = [SWITCH.x + SWITCH.w - 10, ROWS[0][1]];
const OUT: Pt = [CARD.w / 2 - 8, ROWS[0][1] + 4];

/** a switch: a pill, walked round at an even step */
function pill(r: Rand, x: number, y: number, w: number, h: number): string {
  const rad = h / 2;
  const pts: Pt[] = [];
  const arc = (cx: number, a0: number) => {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (Math.PI * i) / 5;
      pts.push([cx + Math.cos(a) * rad + (r() - 0.5) * 0.8, y + Math.sin(a) * rad + (r() - 0.5) * 0.8]);
    }
  };
  arc(x + w - rad, -Math.PI / 2);
  arc(x + rad, Math.PI / 2);
  return curve([...pts, pts[0], pts[1]]);
}

function Card({ at }: { at: Seat }) {
  const d = useMemo(() => {
    const r = rng(141);
    return {
      plus: stroke(r, [-104, -84], [-104, -62], 0.4) + stroke(r, [-115, -73], [-93, -73], 0.4),
      rule: stroke(r, [-118, -50], [118, -50], 0.5),
      // whose account it is, too small to read
      who: scribble(r, 62, ROWS[0][1] + 1, 52, 1.4),
      on: pill(r, SWITCH.x, ROWS[0][1], SWITCH.w, SWITCH.h),
      off: ROWS.slice(1).map(([, y]) => pill(r, SWITCH.x, y, SWITCH.w, SWITCH.h) + ring(r, SWITCH.x + 10, y, 5.5, 5.5, 0.3)).join(''),
    };
  }, []);
  return (
    <g transform={seat(at)}>
      <Paper seed={145} x={-CARD.w / 2} y={-CARD.h / 2} w={CARD.w} h={CARD.h} />
      <g className="ink">
        <path d={d.plus} style={{ stroke: 'var(--mark)', strokeWidth: 1.8 }} />
        <path d={d.rule} className="soft" />
        <path d={d.who} className="soft thin" />
        <path d={d.off} className="soft" />
        <path d={d.on} />
        <circle cx={KNOB[0]} cy={KNOB[1]} r={6} className="dot gold" />
      </g>
    </g>
  );
}

// ---- what is in the account ----

/** every thing keeps its own hand, whichever way the page is laid out */
const SEED: Record<Thing, number> = { mail: 153, calendar: 151, card: 150, files: 152 };

function Cut({ thing, at }: { thing: Thing; at: Seat }) {
  const layers = useMemo(() => THINGS[thing](rng(SEED[thing])), [thing]);
  return (
    <g transform={seat(at)} className="ink">
      {layers.map((l, i) => (
        <g key={i} transform={l.t}>
          {l.cast && <path d={l.d} className="shade" transform="translate(3 4)" />}
          {l.fill ? <path d={l.d} style={{ fill: l.fill, stroke: 'none' }} /> : <path d={l.d} className={l.pen} />}
        </g>
      ))}
    </g>
  );
}

// ---- the machines, and the agents on them ----

const CHIP = 74;
const MARK = 44;

/** the eyelet at the head of an agent's scrap: the thread goes through it,
    and it is lit the way the switch is */
const EYE: Pt = [0, -CHIP / 2 + 10];

/** an agent's mark on its scrap, as the agents scene pastes them */
function Chip({ mark, at, seed }: { mark: number; at: Seat; seed: number }) {
  const m = useMemo(() => MARKS[mark][1](rng(140 + mark)), [mark]);
  return (
    <g transform={seat(at)} className="ink">
      <Paper seed={seed} x={-CHIP / 2} y={-CHIP / 2} w={CHIP} h={CHIP} />
      <g transform={`translate(${-MARK / 2} ${-MARK / 2 + 7}) scale(${MARK / 24})`}>
        {m.ink && <path d={m.ink} className="dot" />}
        {m.paper && <path d={m.paper} className="paper" />}
        {m.light && <path d={m.light} className="thin" style={{ stroke: '#fffaf3' }} />}
        <path d={m.line} className={m.ink ? 'thin' : undefined} />
      </g>
      <circle cx={EYE[0]} cy={EYE[1]} r={4.5} className="dot gold" />
    </g>
  );
}

/** a machine on its sheet. `agents` are the marks pasted over the sheet's
    top edge, in the order the thread reaches them: which mark (its place in
    MARKS), how far along from the middle, how far up, and its lean. */
type Spot = {
  kind: Kind; x: number; y: number; s: number; rot: number; tone: string; seed: number;
  agents: [mark: number, dx: number, up: number, rot: number][];
};

const PAD = 26;

/** the sheet a machine needs, where the machine sits on it, and where its
    agents go: measured off the machine, so a machine redrawn a different
    size still gets a sheet that fits */
function lay(spot: Spot) {
  const [x0, y0, x1, y1] = MACHINES[spot.kind].bb;
  const w = (x1 - x0) * spot.s + PAD * 2;
  const h = (y1 - y0) * spot.s + PAD * 2;
  const at: Pt = [(-(x0 + x1) / 2) * spot.s, (-(y0 + y1) / 2) * spot.s];
  const chips = spot.agents.map(([mark, dx, up, rot]) => ({ mark, at: { x: spot.x + dx, y: spot.y - h / 2 - up, s: 1, rot } }));
  return { w, h, at, chips };
}

function Desk({ spot }: { spot: Spot }) {
  const { w, h, at, chips } = lay(spot);
  return (
    <>
      <g transform={`translate(${spot.x} ${spot.y}) rotate(${spot.rot})`}>
        <Paper seed={spot.seed} x={-w / 2} y={-h / 2} w={w} h={h} tone={spot.tone} />
        <Machine kind={spot.kind} at={at} s={spot.s} seed={spot.seed + 1} />
      </g>
      {chips.map((c, i) => (
        <Chip key={i} mark={c.mark} at={c.at} seed={spot.seed + 3 + i * 3} />
      ))}
    </>
  );
}

// ---- how it is laid out, wide and narrow ----

type Plan = {
  h: number;
  x: [number, number];
  card: Seat;
  /** back to front */
  things: (Seat & { thing: Thing })[];
  /** in the order the thread reaches them */
  spots: Spot[];
  /** the thread's way in, its way through what is in the account, and its
      way out */
  lead: Pt[];
  pass: Pt[];
  tail: Pt[];
};

const CREAM = '#fffaf3';
const SWEATER = '#f2e8dd';
const ASH = '#e0d8ce';

const WIDE: Plan = {
  h: 640,
  x: [50, 950],
  card: { x: 196, y: 122, s: 1, rot: -2 },
  things: [
    { thing: 'calendar', x: 642, y: 92, s: 1.25, rot: 4 },
    { thing: 'card', x: 678, y: 194, s: 1.15, rot: -5 },
    { thing: 'files', x: 828, y: 138, s: 1.2, rot: 3 },
    { thing: 'mail', x: 498, y: 150, s: 1.3, rot: -6 },
  ],
  spots: [
    { kind: 'mini', x: 800, y: 512, s: 1, rot: 2.5, tone: ASH, seed: 161, agents: [[0, 52, 26, 3], [3, -48, 20, -3]] },
    { kind: 'tower', x: 502, y: 484, s: 0.88, rot: -2, tone: SWEATER, seed: 171, agents: [[2, 48, 14, -2], [1, -44, 18, 3]] },
    { kind: 'laptop', x: 198, y: 504, s: 0.95, rot: -2.5, tone: CREAM, seed: 181, agents: [[1, 46, 21, 3], [0, -52, 15, -2]] },
  ],
  lead: [[196, -24]],
  pass: [[498, 150], [642, 118], [828, 150]],
  tail: [[150, 500], [250, 640]],
};

// On a phone the same things are stacked: the page and the calendar, the
// rest of the account under them, then the machines, two and one.
const NARROW: Plan = {
  h: 960,
  x: [0, 560],
  card: { x: 150, y: 112, s: 1, rot: -2 },
  things: [
    { thing: 'calendar', x: 436, y: 106, s: 1.25, rot: 4 },
    { thing: 'card', x: 284, y: 292, s: 1.15, rot: -5 },
    { thing: 'files', x: 456, y: 330, s: 1.2, rot: 3 },
    { thing: 'mail', x: 116, y: 340, s: 1.3, rot: -6 },
  ],
  spots: [
    { kind: 'laptop', x: 150, y: 646, s: 1, rot: -2.5, tone: CREAM, seed: 181, agents: [[0, -52, 16, -2], [1, 48, 22, 3]] },
    { kind: 'tower', x: 440, y: 640, s: 0.9, rot: 2, tone: SWEATER, seed: 171, agents: [[1, -44, 16, 3], [2, 48, 12, -2]] },
    { kind: 'mini', x: 296, y: 880, s: 1.05, rot: -2, tone: ASH, seed: 161, agents: [[0, 52, 20, 3], [3, -48, 14, -3]] },
  ],
  lead: [[150, -20]],
  pass: [[436, 120], [456, 340], [284, 300], [116, 340]],
  tail: [[280, 970]],
};

function Tools({ plan }: { plan: Plan }) {
  const knots: Pt[] = [
    ...plan.lead,
    put(plan.card, KNOB),
    put(plan.card, OUT),
    ...plan.pass,
    ...plan.spots.flatMap((s) => lay(s).chips.map((c) => put(c.at, EYE))),
    ...plan.tail,
  ];
  return (
    <Art
      h={plan.h}
      x={plan.x}
      labels={ROWS.map(([name, y]) => (
        <Label key={name} at={put(plan.card, [SWITCH.x + SWITCH.w + 14, y])} from="left" paper>
          <span style={{ display: 'inline-block', rotate: `${plan.card.rot}deg` }}>{name}</span>
        </Label>
      ))}
    >
      <Sky seed={72} h={plan.h} n={80} />
      {plan.things.map((t) => (
        <Cut key={t.thing} thing={t.thing} at={t} />
      ))}
      <Card at={plan.card} />
      {plan.spots.map((s) => (
        <Desk key={s.kind} spot={s} />
      ))}
      {knots.map((k, i) => (
        <Knot key={i} at={k} />
      ))}
    </Art>
  );
}

export default function ToolsScene() {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const m = matchMedia('(max-width: 760px)');
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  return (
    <Scene
      seed={25}
      title={t.tools}
      side="right"
      art={<Tools plan={narrow ? NARROW : WIDE} />}
    />
  );
}

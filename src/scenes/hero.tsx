import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { curve, rng, torn, type Pt } from '../ink';
import { Art, Plus, Scrap } from '../kit';
import { BB, DRAW, type Bounds, type Kind } from './machines';
import './hero.css';
import { t } from '../i18n';

// The opening: the title card, and around it six machines pasted up like
// photographs (a laptop, two mini PCs, a tower, a NAS and a rack server).
// The drawings themselves are in machines.ts. The thread starts under the
// card, runs under the pile, gathers at the plus, and goes on down the page.

export type { Kind } from './machines';

/** `bb` is the machine alone, as the small copies elsewhere on the page draw it */
export const MACHINES = Object.fromEntries(
  (Object.keys(BB) as Kind[]).map((k) => [k, { bb: BB[k] }]),
) as Record<Kind, { bb: Bounds }>;

type Spot = { kind: Kind; x: number; y: number; rot: number; s: number; tone: string; seed: number };
/** `card` is where the middle of the title card sits */
type Plan = { h: number; x: [number, number]; card: Pt; spots: Spot[]; thread: Pt[] };

const CREAM = '#fffaf3';
const SWEATER = '#f1e6d9';
const ASH = '#e3dace';
const TAN = '#ebdcca';

// a ring of six around the card
const WIDE: Plan = {
  h: 640,
  x: [0, 940],
  card: [470, 318],
  spots: [
    { kind: 'laptop', x: 150, y: 14, rot: -3, s: 1, tone: CREAM, seed: 215 },
    { kind: 'rack', x: 456, y: 30, rot: 2, s: 1, tone: ASH, seed: 209 },
    { kind: 'tower', x: 706, y: 196, rot: -2, s: 1, tone: SWEATER, seed: 205 },
    { kind: 'nas', x: 26, y: 212, rot: 2.5, s: 1, tone: TAN, seed: 207 },
    { kind: 'mini', x: 172, y: 430, rot: -2.5, s: 1.45, tone: CREAM, seed: 203 },
    { kind: 'puck', x: 508, y: 412, rot: 3, s: 1, tone: ASH, seed: 211 },
  ],
  thread: [[470, 360], [484, 430], [490, 520], [480, 600], [470, 640]],
};

// on a phone: two, then one, above the card, and the same below it
const NARROW: Plan = {
  h: 978,
  x: [0, 520],
  card: [260, 487],
  spots: [
    { kind: 'laptop', x: 0, y: 6, rot: -3, s: 1, tone: CREAM, seed: 215 },
    { kind: 'tower', x: 312, y: 0, rot: 2, s: 1, tone: SWEATER, seed: 205 },
    { kind: 'rack', x: 96, y: 204, rot: -2, s: 1, tone: ASH, seed: 209 },
    { kind: 'mini', x: 124, y: 594, rot: 2, s: 1.45, tone: CREAM, seed: 203 },
    { kind: 'nas', x: 4, y: 748, rot: 2.5, s: 1, tone: TAN, seed: 207 },
    { kind: 'puck', x: 312, y: 768, rot: -3, s: 1, tone: SWEATER, seed: 211 },
  ],
  thread: [[260, 540], [270, 742], [276, 842], [264, 932], [260, 978]],
};

/** the paper around a machine, in the drawing's own units */
const PAD = 22;

/** where a spot's paper and its drawing land */
function place(spot: Spot) {
  const [x0, y0, x1, y1] = BB[spot.kind];
  const w = (x1 - x0 + PAD * 2) * spot.s;
  const h = (y1 - y0 + PAD * 2) * spot.s;
  const at: Pt = [spot.x + (PAD - x0) * spot.s, spot.y + (PAD - y0) * spot.s];
  const c: Pt = [spot.x + w / 2, spot.y + h / 2];
  return { w, h, at, c };
}

/** a photograph's worth of paper, torn deeper than the kit's so the pile
    reads as paper at this size */
function Photo({ spot }: { spot: Spot }) {
  const { w, h, at, c } = place(spot);
  const d = useMemo(() => torn(rng(spot.seed), spot.x, spot.y, w, h, 7), [spot, w, h]);
  return (
    <g transform={`rotate(${spot.rot} ${c[0]} ${c[1]})`} data-machine={spot.kind}>
      <path d={d} className="shade" transform="translate(4 6)" />
      <path d={d} className="paper" style={{ fill: spot.tone }} />
      <Machine kind={spot.kind} at={at} s={spot.s} seed={spot.seed + 1} />
    </g>
  );
}

/** A small copy is pared down to its outline and a mark or two. */
export function Machine({ kind, at, s, seed }: { kind: Kind; at: Pt; s: number; seed: number }) {
  const lod = s < 0.7 ? 0 : 1;
  const p = useMemo(() => DRAW[kind](rng(seed), lod), [kind, seed, lod]);
  return (
    <g transform={`translate(${at[0]} ${at[1]}) scale(${s})`} className="ink">
      {p.soft && <path d={p.soft} className="soft thin" />}
      {p.fine && <path d={p.fine} className="hero-fine" />}
      <path d={p.d} />
    </g>
  );
}

function Pinboard({ plan }: { plan: Plan }) {
  const thread = useMemo(() => curve(plan.thread), [plan]);
  return (
    <Art
      h={plan.h}
      x={plan.x}
      labels={
        <>
          <div
            className="hero-card"
            style={{ left: `${((plan.card[0] - plan.x[0]) / (plan.x[1] - plan.x[0])) * 100}%`, top: `${(plan.card[1] / plan.h) * 100}%` }}
          >
            <Scrap seed={3} className="title hero-title">
              <h1 style={{ '--n': Math.max(17, [...t.title].length) } as CSSProperties}>{t.title}</h1>
              <p>{t.tagline}</p>
            </Scrap>
          </div>
          <span className="hero-plus">
            <Plus size={34} knot />
          </span>
        </>
      }
    >
      {/* the thread is laid down first: it runs under the photographs */}
      <path d={thread} className="gold" />
      {plan.spots.map((spot) => (
        <Photo key={spot.kind} spot={spot} />
      ))}
    </Art>
  );
}

// below this the ring no longer has room around the card
const STACK = '(max-width: 980px)';

export default function Hero() {
  const [narrow, setNarrow] = useState(() => matchMedia(STACK).matches);
  useEffect(() => {
    const m = matchMedia(STACK);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  return (
    <header className="hero">
      <div className="hero-stage">
        <Pinboard plan={narrow ? NARROW : WIDE} />
      </div>
    </header>
  );
}

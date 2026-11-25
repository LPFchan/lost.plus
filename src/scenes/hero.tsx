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

type Spot = { kind: Kind; x: number; y: number; rot: number; s: number; tone: string; seed: number; order: number };
/** `card` is where the middle of the title card sits */
type Plan = { h: number; x: [number, number]; card: Pt; spots: Spot[]; thread: Pt[] };

const CREAM = '#fffaf3';
const SWEATER = '#f1e6d9';
const ASH = '#e3dace';
const TAN = '#ebdcca';

// a ring of six around the card; `order` fans them out clockwise on load
// without disturbing the overlap order of the pile
const WIDE: Plan = {
  h: 640,
  x: [0, 940],
  card: [470, 318],
  spots: [
    { kind: 'laptop', x: 150, y: 14, rot: -3, s: 1, tone: CREAM, seed: 215, order: 0 },
    { kind: 'rack', x: 456, y: 30, rot: 2, s: 1, tone: ASH, seed: 209, order: 1 },
    { kind: 'tower', x: 706, y: 196, rot: -2, s: 1, tone: SWEATER, seed: 205, order: 2 },
    { kind: 'nas', x: 26, y: 212, rot: 2.5, s: 1, tone: TAN, seed: 207, order: 5 },
    { kind: 'mini', x: 172, y: 430, rot: -2.5, s: 1.45, tone: CREAM, seed: 203, order: 4 },
    { kind: 'puck', x: 508, y: 412, rot: 3, s: 1, tone: ASH, seed: 211, order: 3 },
  ],
  thread: [[470, 360], [484, 430], [490, 520], [480, 600], [470, 640]],
};

// on a phone: a tighter circular ring hugging right around the title card
const NARROW: Plan = {
  h: 700,
  x: [0, 680],
  card: [340, 344],
  spots: [
    { kind: 'laptop', x: 76, y: 14, rot: -3, s: 0.86, tone: CREAM, seed: 215, order: 0 },
    { kind: 'rack', x: 356, y: 26, rot: 2, s: 0.86, tone: ASH, seed: 209, order: 1 },
    { kind: 'tower', x: 522, y: 218, rot: -2, s: 0.78, tone: SWEATER, seed: 205, order: 2 },
    { kind: 'nas', x: 0, y: 244, rot: 2.5, s: 0.78, tone: TAN, seed: 207, order: 5 },
    { kind: 'mini', x: 96, y: 484, rot: -2.5, s: 1.22, tone: CREAM, seed: 203, order: 4 },
    { kind: 'puck', x: 386, y: 470, rot: 3, s: 0.86, tone: ASH, seed: 211, order: 3 },
  ],
  thread: [[340, 394], [352, 476], [358, 566], [350, 646], [340, 700]],
};

/** the paper around a machine, in the drawing's own units */
const PAD = 22;
/** room around the paper for its shadow and strokes that run past corners */
const BLEED = 18;

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
    reads as paper at this size. Rendered as its own HTML layer over the
    thread so its entrance animates on the compositor without re-stroking
    every path on the main thread. */
function Photo({ spot, plan }: { spot: Spot; plan: Plan }) {
  const { w, h, at, c } = place(spot);
  const d = useMemo(() => torn(rng(spot.seed), spot.x, spot.y, w, h, 7), [spot, w, h]);
  const span = plan.x[1] - plan.x[0];
  const vx = c[0] - plan.card[0];
  const vy = c[1] - plan.card[1];
  const dist = Math.hypot(vx, vy) || 1;
  const pull = 34;
  const dx = -(vx / dist) * pull;
  const dy = -(vy / dist) * pull;
  // snap delays to the 12fps stop-motion clock (83.33ms per frame)
  const delay = ((spot.order + 1) * 1000) / 12;
  const bx = spot.x - BLEED;
  const by = spot.y - BLEED;
  const bw = w + BLEED * 2;
  const bh = h + BLEED * 2;
  return (
    <div
      className="hero-photo"
      data-machine={spot.kind}
      style={{
        left: `${((bx - plan.x[0]) / span) * 100}%`,
        top: `${(by / plan.h) * 100}%`,
        width: `${(bw / span) * 100}%`,
        height: `${(bh / plan.h) * 100}%`,
        '--rot': `${spot.rot}deg`,
        '--dx': `${dx.toFixed(1)}px`,
        '--dy': `${dy.toFixed(1)}px`,
        '--w': `${spot.rot > 0 ? -5.5 : 5.5}deg`,
        '--delay': `${delay.toFixed(2)}ms`,
      } as CSSProperties}
    >
      <div className="hero-photo-in">
        <svg viewBox={`${bx} ${by} ${bw} ${bh}`} aria-hidden="true">
          <path d={d} className="shade" transform="translate(4 6)" />
          <path d={d} className="paper" style={{ fill: spot.tone }} />
          <Machine kind={spot.kind} at={at} s={spot.s} seed={spot.seed + 1} />
        </svg>
      </div>
    </div>
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
          {plan.spots.map((spot) => (
            <Photo key={spot.kind} spot={spot} plan={plan} />
          ))}
          <div
            className="hero-card"
            style={{ left: `${((plan.card[0] - plan.x[0]) / (plan.x[1] - plan.x[0])) * 100}%`, top: `${(plan.card[1] / plan.h) * 100}%` }}
          >
            <div className="hero-card-in">
              <Scrap seed={3} className="title hero-title">
                <h1 style={{ '--n': Math.max(17, [...t.title].length) } as CSSProperties}>{t.title}</h1>
                <p>{t.tagline}</p>
              </Scrap>
            </div>
          </div>
          <span className="hero-plus">
            <Plus size={34} knot />
          </span>
        </>
      }
    >
      {/* the thread is laid down first: it runs under the photographs */}
      <path d={thread} className="gold hero-thread" pathLength={1} />
    </Art>
  );
}

// below this the wide ring switches to the tighter circular ring
const STACK = '(max-width: 680px)';

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

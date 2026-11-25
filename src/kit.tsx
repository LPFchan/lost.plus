// The kit every scene is built from: scraps of torn paper for the words,
// and the frame, labels, pasted paper and machine glyphs for the drawings.
// A drawing is an SVG a thousand units wide, built with the pen in ink.ts;
// the few words on it are HTML laid over it, so they stay a readable size
// however small the drawing is scaled.

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { box, ring, rng, stroke, strokes, tearAround, torn, type Pt, type Rand } from './ink';

export const AUTH = 'https://auth.lost.plus';

const TONES = ['#fffaf3', '#f2e8dd', '#e0d8ce', '#ebdcca']; // lighter paper, sweater(95), ash(87), sweater(92)

/** a scrap of torn paper with something on it. Each seed tears, tints and
    tilts its own way; `tone` overrides the tint. */
export function Scrap({ seed, tag = 'div', tone, className = '', children, ...rest }: {
  seed: number; tag?: 'div' | 'button' | 'a'; tone?: string; className?: string; children: ReactNode;
} & Record<string, unknown>) {
  const Tag = tag as 'div';
  const look = useMemo(
    () =>
      ({
        '--tear': tearAround(seed),
        '--tone': tone ?? TONES[seed % TONES.length],
        '--tilt': `${(((seed * 37) % 9) - 4) * 0.45}deg`,
      }) as CSSProperties,
    [seed, tone],
  );
  return (
    <Tag className={`scrap ${className}`} style={look} {...rest}>
      {children}
    </Tag>
  );
}

/** one drawing, and its caption on a scrap; each line of `title` gets a
    scrap of its own. `side` is where the caption sits, `note` is a smaller
    scrap beside it, `after` goes under the drawing. */
export function Scene({ seed, title, side = 'left', art, note, after }: {
  seed: number; title: string; side?: 'left' | 'center' | 'right'; art: ReactNode;
  note?: ReactNode; after?: ReactNode;
}) {
  return (
    <section className={`scene ${side}`}>
      <div className="words">
        {title.split('\n').map((line, i) => (
          <Scrap key={i} seed={seed + i * 3} tone={`var(--cap${(i % 2) + 1})`}>
            <h2>{line}</h2>
          </Scrap>
        ))}
        {note}
      </div>
      {art}
      {after && <div className="after">{after}</div>}
    </section>
  );
}

const W = 1000;

/** the stretch of the drawing that is shown, and its height */
const Frame = createContext<[number, number, number]>([0, W, 1]);

// A drawing is composed across the full thousand, but only `x`, the span
// that has ink in it, is shown. On a wide page the span keeps its share of
// the width; on a phone it fills the screen (see `.art` in index.css).
export function Art({ h, x = [0, W], children, labels }: {
  h: number; x?: [number, number]; children: ReactNode; labels?: ReactNode;
}) {
  const span = x[1] - x[0];
  return (
    <div className="art" style={{ aspectRatio: `${span} / ${h}`, '--span': span / W } as CSSProperties}>
      <svg viewBox={`${x[0]} 0 ${span} ${h}`} aria-hidden="true">
        {children}
      </svg>
      <Frame.Provider value={[x[0], span, h]}>{labels}</Frame.Provider>
    </div>
  );
}

/** the mono face has only Latin in it, so only Latin is set in it */
const ascii = (text: ReactNode) => typeof text !== 'string' || /^[\x20-\x7e]*$/.test(text);

/** `from` hangs the label off its point to one side instead of centring it */
export function Label({ at, mono, from, paper, children }: {
  at: Pt; mono?: boolean; from?: 'left' | 'right'; paper?: boolean; children: ReactNode;
}) {
  const [x0, span, h] = useContext(Frame);
  return (
    <span
      className={'label' + (mono && ascii(children) ? ' mono' : '') + (from ? ` from-${from}` : '') + (paper ? ' on-paper' : '')}
      style={{ left: `${((at[0] - x0) / span) * 100}%`, top: `${(at[1] / h) * 100}%` }}
    >
      {children}
    </span>
  );
}

/** a scrap of paper pasted into a drawing, with the shadow it throws */
export function Paper({ seed, x, y, w, h, tone, rot = 0 }: {
  seed: number; x: number; y: number; w: number; h: number; tone?: string; rot?: number;
}) {
  const d = useMemo(() => torn(rng(seed), x, y, w, h), [seed, x, y, w, h]);
  return (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
      <path d={d} className="shade" transform="translate(3 4)" />
      <path d={d} className="paper" style={tone ? { fill: tone } : undefined} />
    </g>
  );
}

/** where the thread passes */
export const Knot = ({ at }: { at: Pt }) => <circle data-thread="" cx={at[0]} cy={at[1]} r={0.1} className="none" />;

// ---- the machines ----

export type Kind = 'laptop' | 'tower' | 'nas' | 'rack' | 'mini' | 'phone' | 'term';

const GLYPHS: Record<Kind, (r: Rand) => string> = {
  laptop: (r) => box(r, -20, -18, 40, 26) + strokes(r, [[-20, 8], [-27, 14], [27, 14], [20, 8]]),
  tower: (r) =>
    box(r, -11, -22, 22, 44) +
    ring(r, 0, -13, 2.2, 2.2, 0.3) +
    stroke(r, [-5, 4], [5, 4], 0.4) +
    stroke(r, [-5, 10], [5, 10], 0.4),
  nas: (r) =>
    box(r, -19, -15, 38, 30) +
    stroke(r, [-9, -9], [-9, 5], 0.4) +
    stroke(r, [0, -9], [0, 5], 0.4) +
    stroke(r, [9, -9], [9, 5], 0.4) +
    stroke(r, [-13, 10], [-9, 10], 0.3),
  rack: (r) =>
    [-17, -4.5, 8]
      .map((y) => box(r, -24, y, 48, 9, 0.6) + stroke(r, [-19, y + 4.5], [-15, y + 4.5], 0.3))
      .join(''),
  mini: (r) => box(r, -18, -8, 36, 16, 0.6) + stroke(r, [9, 3], [13, 3], 0.3),
  phone: (r) => box(r, -8, -16, 16, 32, 0.6) + stroke(r, [-2.5, 12], [2.5, 12], 0.3),
  term: (r) =>
    box(r, -20, -14, 40, 28) +
    strokes(r, [[-13, -5], [-8, 0], [-13, 5]], 0.4) +
    stroke(r, [-4, 5], [5, 5], 0.4),
};

export function Glyph({ kind, at, seed, s = 1, rot = 0, back, className }: {
  kind: Kind; at: Pt; seed: number; s?: number; rot?: number; back?: boolean; className?: string;
}) {
  const d = useMemo(() => GLYPHS[kind](rng(seed)), [kind, seed]);
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${rot}) scale(${s})`}>
      {back && <circle r={34} className="back" />}
      <path d={d} className={className} />
    </g>
  );
}

/** lost.plus's own mark: a plus, in two strokes. `knot` hangs the thread from it. */
export function Plus({ size = 28, knot }: { size?: number; knot?: boolean }) {
  const [v, h] = useMemo(() => {
    const r = rng(3);
    return [stroke(r, [0, -9], [0, 9], 0.5), stroke(r, [-9, 0], [9, 0], 0.5)] as const;
  }, []);
  return (
    <svg className="plus" width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true" data-thread={knot ? '' : undefined}>
      <path className="plus-v" d={v} pathLength={1} />
      <path className="plus-h" d={h} pathLength={1} />
    </svg>
  );
}

/** a field of faint stars, for the night sheet */
export function Sky({ seed, h, n = 110 }: { seed: number; h: number; n?: number }) {
  const stars = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: n }, () => [r() * W, r() * h, 0.5 + r() * 0.9] as const);
  }, []);
  return (
    <>
      {stars.map(([x, y, s], i) => (
        <circle key={i} cx={x} cy={y} r={s} className="dot faint" />
      ))}
    </>
  );
}

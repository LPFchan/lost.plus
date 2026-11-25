// The pen. Every line on the page is drawn by these few functions from a
// seeded random source, so the drawings wobble like a hand's and still come
// out the same on every visit.

export type Pt = readonly [number, number];
export type Rand = () => number;

/** mulberry32: a small seeded random source */
export function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);
const jit = (r: Rand, w: number) => (r() - 0.5) * 2 * w;

/** a smooth open curve through the points (Catmull-Rom as cubic Béziers) */
export function curve(p: Pt[]): string {
  if (p.length < 2) return '';
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}` +
      ` ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)}` +
      ` ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** one pen stroke from a to b: nearly straight, never quite */
export function stroke(r: Rand, a: Pt, b: Pt, w = 0.8): string {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 30));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      a[0] + (b[0] - a[0]) * t + jit(r, w),
      a[1] + (b[1] - a[1]) * t + jit(r, w),
    ]);
  }
  return curve(pts);
}

/** strokes joining the points in turn; every corner is a fresh stroke, the
    way a hand draws a box */
export function strokes(r: Rand, pts: Pt[], w = 0.8, close = false): string {
  let d = '';
  const n = close ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) d += stroke(r, pts[i], pts[(i + 1) % pts.length], w);
  return d;
}

export function box(r: Rand, x: number, y: number, w: number, h: number, wob = 0.8) {
  return strokes(r, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], wob, true);
}

/** a circle whose ends overlap without quite meeting */
export function ring(r: Rand, cx: number, cy: number, rx: number, ry = rx, w = 0.8): string {
  const n = Math.min(18, Math.max(7, Math.round((rx + ry) / 5)));
  const a0 = r() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= n + 1; i++) {
    const a = a0 + ((Math.PI * 2 + 0.25) * i) / (n + 1);
    const drift = 0.98 + (0.05 * i) / n;
    pts.push([
      cx + Math.cos(a) * rx * drift + jit(r, w),
      cy + Math.sin(a) * ry * drift + jit(r, w),
    ]);
  }
  return curve(pts);
}

/** a line of writing too small to read: jittery words with gaps between */
export function scribble(r: Rand, x: number, y: number, len: number, amp = 1.8): string {
  let d = '';
  let cx = x;
  while (cx < x + len - 6) {
    const word = Math.min(7 + r() * 22, x + len - cx);
    d += `M${f(cx)} ${f(y + jit(r, amp))}`;
    for (let px = cx + 2.4; px <= cx + word; px += 2.4) d += `L${f(px)} ${f(y + jit(r, amp))}`;
    cx += word + 4 + r() * 3;
  }
  return d;
}

/** a CSS polygon for a sheet of paper torn along its top and bottom */
export function tear(seed: number, depth = 9): string {
  const r = rng(seed);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = ((i / 48) * 100).toFixed(2);
    top.push(`${x}% ${(r() * depth).toFixed(1)}px`);
    bottom.unshift(`${x}% calc(100% - ${(r() * depth).toFixed(1)}px)`);
  }
  return `polygon(${[...top, ...bottom].join(',')})`;
}

/** a CSS polygon for a scrap torn on all four sides; now and then the tear
    runs deeper */
export function tearAround(seed: number, depth = 5, across = 14, down = 6): string {
  const r = rng(seed);
  const bite = () => (r() * depth * (r() < 0.14 ? 2.4 : 1)).toFixed(1);
  const pts: string[] = [];
  for (let i = 0; i < across; i++) pts.push(`${((i / across) * 100).toFixed(1)}% ${bite()}px`);
  for (let i = 0; i < down; i++) pts.push(`calc(100% - ${bite()}px) ${((i / down) * 100).toFixed(1)}%`);
  for (let i = across; i > 0; i--) pts.push(`${((i / across) * 100).toFixed(1)}% calc(100% - ${bite()}px)`);
  for (let i = down; i > 0; i--) pts.push(`${bite()}px ${((i / down) * 100).toFixed(1)}%`);
  return `polygon(${pts.join(',')})`;
}

/** the same scrap as an SVG path, for paper inside a drawing */
export function torn(r: Rand, x: number, y: number, w: number, h: number, depth = 3): string {
  const bite = () => r() * depth * (r() < 0.14 ? 2.4 : 1);
  const across = Math.max(5, Math.round(w / 16));
  const down = Math.max(4, Math.round(h / 16));
  let d = '';
  const to = (px: number, py: number) => (d += `${d ? 'L' : 'M'}${f(px)} ${f(py)}`);
  for (let i = 0; i < across; i++) to(x + (w * i) / across, y + bite());
  for (let i = 0; i < down; i++) to(x + w - bite(), y + (h * i) / down);
  for (let i = across; i > 0; i--) to(x + (w * i) / across, y + h - bite());
  for (let i = down; i > 0; i--) to(x + bite(), y + (h * i) / down);
  return d + 'Z';
}

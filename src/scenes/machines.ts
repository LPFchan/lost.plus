import { curve, rng, type Pt, type Rand } from '../ink';

// The six machines of the opening, as loose sketches of things sitting on
// a desk: seen from the front, a little from above and a little from one
// side. Every straight edge is its own quick stroke that runs past its
// corners, and the outline is gone over twice. The laptop is drawn flat;
// the other five are boxes with honest proportions, put through a small
// camera so each has a front, a top and a side.

export type Kind = 'laptop' | 'mini' | 'puck' | 'tower' | 'nas' | 'rack';
export type Bounds = readonly [number, number, number, number];
/** the outline, the parts on it, and the faint marks */
export type Parts = { d: string; fine: string; soft: string };

/** how much of a machine is drawn: 0 for the small copies, 1 in full */
export type Lod = 0 | 1;

const f = (n: number) => n.toFixed(1);
const jit = (r: Rand, w: number) => (r() - 0.5) * 2 * w;

/** one quick stroke from a to b: bowed a little, running up to `over` past
    both ends */
function seg(r: Rand, a: Pt, b: Pt, wob = 1, over = 0): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const o1 = over * (0.4 + 0.6 * r());
  const o2 = over * (0.4 + 0.6 * r());
  const end = Math.min(wob * 0.4, len / 24);
  const bow = jit(r, Math.min(wob, len / 14));
  const p = [a[0] - ux * o1 + jit(r, end), a[1] - uy * o1 + jit(r, end)];
  const q = [b[0] + ux * o2 + jit(r, end), b[1] + uy * o2 + jit(r, end)];
  return `M${f(p[0])} ${f(p[1])}Q${f((p[0] + q[0]) / 2 - uy * bow)} ${f((p[1] + q[1]) / 2 + ux * bow)} ${f(q[0])} ${f(q[1])}`;
}

/** a stroke for every edge, so corners are crossed lines and not joins */
const edges = (r: Rand, pts: Pt[], closed = true, wob = 1, over = 0) =>
  pts.map((p, i) => (i < pts.length - 1 || closed ? seg(r, p, pts[(i + 1) % pts.length], wob, over) : '')).join('');

/** an outline firmed up: gone over twice, the second pass a little off the
    first. A small copy gets the one pass. */
const firm = (r: Rand, pts: Pt[], lod: Lod, closed = true) =>
  lod ? edges(r, pts, closed, 1.8, 6) + edges(r, pts, closed, 2.4, 3) : edges(r, pts, closed, 2, 7);

const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** a quick loop that does not quite close: it stops short of where it
    began, or with `turn` over 1 runs on past it, a little wide */
function loop(r: Rand, cx: number, cy: number, rx: number, ry = rx, turn = 0.9 + 0.07 * r()): string {
  const n = Math.max(6, Math.round((rx + ry) / 3));
  const a0 = r() * Math.PI * 2;
  const w = Math.min(0.8, (rx + ry) / 16);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (Math.PI * 2 * turn * i) / n;
    const grow = 0.92 + (0.16 * i) / n;
    pts.push([cx + Math.cos(a) * rx * grow + jit(r, w), cy + Math.sin(a) * ry * grow + jit(r, w)]);
  }
  return curve(pts);
}

/** a small light or socket: a loop that overlaps itself */
const dot = (r: Rand, cx: number, cy: number, rx: number, ry = rx) => loop(r, cx, cy, rx, ry, 1.06);

const each = (n: number, draw: (i: number) => string) => Array.from({ length: n }, (_, i) => draw(i)).join('');

// ---- a box in front of you ----

type Face = (a: number, b: number) => Pt;

/** A box `w` wide, `h` high and `d` deep, turned `yaw` degrees to show its
    right side (its left, if negative) and seen from `pitch` degrees above,
    with a little perspective. `F`, `T` and `S` are places on its front,
    top and visible side: across from the left and down from the top on the
    front, across and back on the top, back and down on the side. */
function solid(w: number, h: number, d: number, yaw: number, pitch: number, dist = 900) {
  const cy = Math.cos((yaw * Math.PI) / 180);
  const sy = Math.sin((yaw * Math.PI) / 180);
  const cp = Math.cos((pitch * Math.PI) / 180);
  const sp = Math.sin((pitch * Math.PI) / 180);
  const P = (x: number, y: number, z: number): Pt => {
    const z1 = x * sy + z * cy;
    const k = dist / (dist - (y * sp + z1 * cp));
    return [(x * cy - z * sy) * k, -(y * cp - z1 * sp) * k];
  };
  const F: Face = (u, v) => P(u - w / 2, h / 2 - v, d / 2);
  const T: Face = (u, t) => P(u - w / 2, h / 2, d / 2 - t);
  const S: Face = (t, v) => P(yaw > 0 ? w / 2 : -w / 2, h / 2 - v, d / 2 - t);
  // the front's upright edge next to the side you can see, and its other one
  const near = yaw > 0 ? w : 0;
  const far = w - near;
  return {
    F, T, S,
    hull: [F(far, h), F(far, 0), T(far, d), T(near, d), S(d, h), F(near, h)],
    ribs: [[F(far, 0), F(near, 0)], [F(near, 0), T(near, d)], [F(near, 0), F(near, h)]] as [Pt, Pt][],
  };
}

/** the box inked: its outline firmed up, the three edges inside it once */
const shell = (r: Rand, b: ReturnType<typeof solid>, lod: Lod) =>
  firm(r, b.hull, lod) + b.ribs.map(([p, q]) => seg(r, p, q, 1.3, 4)).join('');

/** four corners on a face */
const quad = (at: Face, a: number, b: number, w: number, h: number): Pt[] =>
  [at(a, b), at(a + w, b), at(a + w, b + h), at(a, b + h)];

/** a foot under the box */
const foot = (r: Rand, [x, y]: Pt, len = 8) => seg(r, [x, y], [x + 0.6, y + len], 0.5, 1.5);

type Draw = (r: Rand, lod: Lod) => Parts;

/** a laptop, open */
const laptop: Draw = (r, lod) => ({
  d:
    firm(r, rect(-78, -76, 156, 102), lod) +
    edges(r, [[78, 26], [106, 64], [-106, 64], [-78, 26]], false, 1.5, lod ? 6 : 7) +
    (lod ? seg(r, [-104, 66], [104, 67], 1.5, 4) : ''),
  fine: lod ? edges(r, rect(-68, -66, 136, 82), true, 1.1, 3) : '',
  soft: lod
    ? edges(r, [[-64, 32], [64, 32], [74, 45], [-74, 45]], true, 0.9, 2) +
      edges(r, [[-18, 51], [18, 51], [20, 58], [-20, 58]], true, 0.6, 1) +
      seg(r, [28, -56], [44, -30], 0.8) +
      seg(r, [38, -58], [50, -40], 0.8)
    : '',
});

/** a tower PC: tall and deep, on feet. Two drive bays at the top of the
    front, ports and the power button under them, vent slits low down. */
const tower: Draw = (r, lod) => {
  const b = solid(74, 152, 158, 30, 13);
  const { F, S } = b;
  return {
    d: shell(r, b, lod) + foot(r, F(8, 152)) + foot(r, F(66, 152)) + foot(r, S(146, 152), 7),
    fine: lod
      ? edges(r, quad(F, 10, 13, 54, 13), true, 1, 3) +
        edges(r, quad(F, 10, 34, 54, 13), true, 1, 3) +
        edges(r, quad(F, 10, 60, 13, 7), true, 0.4, 1.2) +
        edges(r, quad(F, 30, 60, 13, 7), true, 0.4, 1.2) +
        loop(r, ...F(57, 63), 5, 5.5)
      : seg(r, F(10, 22), F(64, 22), 1.5) + seg(r, F(10, 44), F(64, 44), 1.5) + loop(r, ...F(54, 68), 6),
    soft: lod ? each(4, (i) => seg(r, F(10, 106 + i * 11), F(64 - r() * 22, 106 + i * 11), 1)) : '',
  };
};

/** a four-bay NAS: a compact cube, the drive trays side by side on the
    front, each with its latch, the lights and the power button beside them */
const nas: Draw = (r, lod) => {
  const b = solid(130, 108, 146, -28, 20);
  const { F } = b;
  return {
    d: shell(r, b, lod) + foot(r, F(10, 108), 6) + foot(r, F(120, 108), 6),
    fine:
      edges(r, quad(F, 10, 10, 94, 80), true, 1, 3) +
      each(3, (i) => seg(r, F(33.5 + i * 23.5, 10), F(33.5 + i * 23.5, 90), 0.9, 2)) +
      loop(r, ...F(117, 86), 5, 5.5) +
      (lod ? dot(r, ...F(117, 18), 2.6) + dot(r, ...F(117, 31), 2.6) : ''),
    soft: lod ? each(4, (i) => seg(r, F(15 + i * 23.5, 80), F(28 + i * 23.5, 80), 0.5)) : '',
  };
};

/** a rack server: a wide, flat, deep chassis with rack ears, a row of
    drive bays across the front and a seam across the lid */
const rack: Draw = (r, lod) => {
  const b = solid(170, 36, 190, 22, 22);
  const { F, T } = b;
  return {
    d:
      shell(r, b, lod) +
      edges(r, quad(F, -14, 0, 14, 36), true, 1, 2.5) +
      edges(r, quad(F, 170, 0, 14, 36), true, 1, 2.5),
    fine:
      edges(r, quad(F, 10, 7, 108, 22), true, 0.8, 2) +
      each(5, (i) => seg(r, F(28 + i * 18, 7), F(28 + i * 18, 29), 0.5, 1.5)) +
      (lod
        ? dot(r, ...F(-7, 18), 2.4) + dot(r, ...F(177, 18), 2.4) + dot(r, ...F(134, 13), 2.4) + dot(r, ...F(148, 13), 2.4)
        : '') +
      seg(r, T(0, 58), T(170, 58), 1.2, 1),
    soft: '',
  };
};

/** a small flat square PC: two ports, a jack and the power button on the
    front, vents along the side, rubber feet */
const mini: Draw = (r, lod) => {
  const b = solid(102, 27, 96, -30, 20);
  const { F, S } = b;
  return {
    d: shell(r, b, lod) + foot(r, F(9, 27), 5) + foot(r, F(93, 27), 5),
    fine:
      loop(r, ...F(86, 13.5), 4, 4.4) +
      (lod
        ? edges(r, quad(F, 12, 10, 12, 7), true, 0.4, 1.2) +
          edges(r, quad(F, 32, 10, 12, 7), true, 0.4, 1.2) +
          dot(r, ...F(54, 13.5), 2.2)
        : seg(r, F(12, 13.5), F(44, 13.5), 1)),
    soft: lod ? each(5, (i) => seg(r, S(20 + i * 13, 8 + r() * 2), S(20 + i * 13, 19 - r() * 2), 0.4)) : '',
  };
};

/** the other small one, a cube: two ports, a card slot and the power
    button on the front, and it breathes out through slits in its top */
const puck: Draw = (r, lod) => {
  const b = solid(98, 90, 98, 35, 27);
  const { F, T } = b;
  return {
    d: shell(r, b, lod) + foot(r, F(8, 90), 6) + foot(r, F(90, 90), 6),
    fine:
      loop(r, ...F(79, 70), 4.2, 5.2) +
      (lod
        ? edges(r, quad(F, 12, 64, 14, 8), true, 0.4, 1.2) +
          edges(r, quad(F, 34, 64, 14, 8), true, 0.4, 1.2) +
          seg(r, F(12, 46), F(50, 46), 0.6)
        : ''),
    soft: lod ? each(5, (i) => seg(r, T(16 + r() * 4, 28 + i * 13), T(82 - r() * 6, 28 + i * 13), 0.8)) : '',
  };
};

export const DRAW: Record<Kind, Draw> = { laptop, mini, puck, tower, nas, rack };

/** the box every stroke of a machine stays in, whatever its seed:
    `[x0, y0, x1, y1]` */
function bounds(kind: Kind): Bounds {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let seed = 1; seed <= 8; seed++) {
    const p = DRAW[kind](rng(seed), 1);
    for (const [, x, y] of (p.d + p.fine + p.soft).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
      b[0] = Math.min(b[0], +x);
      b[1] = Math.min(b[1], +y);
      b[2] = Math.max(b[2], +x);
      b[3] = Math.max(b[3], +y);
    }
  }
  return [Math.floor(b[0]), Math.floor(b[1]), Math.ceil(b[2]), Math.ceil(b[3])];
}

export const BB = Object.fromEntries(
  (Object.keys(DRAW) as Kind[]).map((k) => [k, bounds(k)]),
) as Record<Kind, Bounds>;

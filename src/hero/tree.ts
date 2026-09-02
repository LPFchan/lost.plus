// Procedural trees, translated from the Anthropic Fable 5.1 launch hero
// (www.anthropic.com/claude-fable-and-mythos-5-1). Theirs grew the whole
// scene's foliage in about four kilobytes of minified code: a seeded
// recursive brancher with golden-angle child spacing, bark-ridge noise on
// the trunk rings, per-vertex wind "flex", and leaf-anchor emission at the
// branch tips. This is that generator with names instead of letters; the
// constants and the geometry are unchanged.

export type Vec3 = [number, number, number];

export type TreeParams = {
  origin?: Vec3;
  rootDir?: Vec3 | null;
  trunkLen?: number;
  trunkRadius?: number;
  segLen?: number;
  wobble?: number;
  maxDepth?: number;
  childrenByDepth?: number[];
  radialByDepth?: number[];
  childAngle?: [number, number];
  twigLift?: number;
  tipLift?: number;
  leafDensity?: number;
  leafOuterDepth?: number;
  barkDark?: Vec3;
  barkLight?: Vec3;
};

export type LeafAnchor = {
  p: Vec3; // leaf position
  out: Vec3; // outward normal at the anchor
  along: Vec3; // branch direction at the anchor
  c: Vec3; // branch centre point
  r: number; // branch radius there
  d: number; // branch depth
  t: number; // 0..1 along the branch
  size: number;
  flex: number;
  roll: number;
  droop: number;
};

export type Perch = {
  c: Vec3;
  r: number;
  along: Vec3;
  d: number;
  t: number;
  flex: number;
  p?: Vec3;
};

export type TreeGeometry = {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  flex: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
  anchors: LeafAnchor[];
  perches: Perch[];
  bounds: { center: Vec3; radius: number };
  stats: { vertices: number; triangles: number; leaves: number; seed: number };
};

/** mulberry32: a small seeded PRNG so every visitor grows the same trees. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000;
  };
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const UP: Vec3 = [0, 1, 0];

type Out = {
  positions: number[];
  normals: number[];
  colors: number[];
  flex: number[];
  uvs: number[];
  indices: number[];
  min: Vec3;
  max: Vec3;
  vert(p: Vec3, n: Vec3, c: Vec3, flex: number, uv?: [number, number]): number;
  tri(a: number, b: number, c: number): void;
};

export function generate(seed: number, params?: TreeParams): TreeGeometry {
  const P = Object.assign(
    {
      origin: [0, 0, 0] as Vec3,
      rootDir: null as Vec3 | null,
      trunkLen: 1,
      trunkRadius: 0.045,
      segLen: 0.07,
      wobble: 0.22,
      maxDepth: 3,
      childrenByDepth: [5, 3, 2],
      radialByDepth: [10, 8, 6, 5],
      childAngle: [0.55, 1.05] as [number, number],
      twigLift: 0.05,
      tipLift: 0.09,
      leafDensity: 1,
      barkDark: [0.34, 0.27, 0.215] as Vec3,
      barkLight: [0.47, 0.395, 0.3] as Vec3,
    },
    params || {},
  );
  const rng = mulberry32(seed);
  const out: Out = {
    positions: [],
    normals: [],
    colors: [],
    flex: [],
    uvs: [],
    indices: [],
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    vert(p, n, c, flex, uv) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
      this.colors.push(c[0], c[1], c[2]);
      this.flex.push(flex || 0);
      this.uvs.push(uv ? uv[0] : 0.5, uv ? uv[1] : 0);
      for (let i = 0; i < 3; i++) {
        if (p[i] < this.min[i]) this.min[i] = p[i];
        if (p[i] > this.max[i]) this.max[i] = p[i];
      }
      return this.positions.length / 3 - 1;
    },
    tri(a, b, c) {
      this.indices.push(a, b, c);
    },
  };
  const anchors: LeafAnchor[] = [];

  const rootDir = P.rootDir
    ? norm(P.rootDir)
    : norm([0.92, 0.3, (rng() - 0.5) * 0.3]);

  function branch(
    start: Vec3,
    dir: Vec3,
    len: number,
    radius: number,
    depth: number,
    flexBase: number,
    isDead: boolean,
  ) {
    const segs = clamp(Math.round(len / P.segLen), 4, 16);
    const segLen = len / segs;

    // Walk the spine: each segment turns a little under wobble, with a
    // consistent sideways bias so the branch curves instead of jittering.
    const points: Vec3[] = [start.slice() as Vec3];
    const tangents: Vec3[] = [];
    let D = norm(dir);
    let C = start.slice() as Vec3;
    let side = cross(D, UP);
    if (Math.hypot(side[0], side[1], side[2]) < 1e-4) side = [1, 0, 0];
    side = scale(norm(side), rng() < 0.5 ? 1 : -1);
    const bias = (0.02 + 0.05 * rng()) * (depth === 0 ? 1.5 : 1);
    for (let s = 0; s < segs; s++) {
      const t = (s + 1) / segs;
      const wob = P.wobble * (0.75 + 0.45 * depth);
      const jitter: Vec3 = [
        (rng() - 0.5) * wob,
        (rng() - 0.5) * wob,
        (rng() - 0.5) * wob,
      ];
      const lift: Vec3 = [
        0,
        depth >= 2 ? P.twigLift : depth === 0 ? lerp(-0.04, P.tipLift, t) : 0.01,
        0,
      ];
      D = norm(add(add(D, add(jitter, lift)), scale(side, bias)));
      C = add(C, scale(D, segLen));
      points.push(C.slice() as Vec3);
      tangents.push(D.slice() as Vec3);
    }
    tangents.push(tangents[tangents.length - 1].slice() as Vec3);
    tangents.unshift(tangents[0].slice() as Vec3);

    // Parallel-transport frames along the spine so the rings do not twist.
    let B = cross(tangents[0], Math.abs(tangents[0][1]) > 0.9 ? UP : [1, 0, 0]);
    B = norm(B);
    const frames: { t: Vec3; n: Vec3; b: Vec3 }[] = [];
    for (let s = 0; s <= segs; s++) {
      const T = tangents[s];
      B = norm(add(B, scale(T, -dot(T, B))));
      frames.push({ t: T, n: B.slice() as Vec3, b: norm(cross(T, B)) });
    }

    const isOuter = depth >= P.maxDepth - 1;
    const tipRadius = isOuter ? Math.max(0.18 * radius, 0.0014) : 0.38 * radius;
    const ringR = [];
    for (let s = 0; s <= segs; s++)
      ringR.push(lerp(radius, tipRadius, Math.pow(s / segs, 0.72)));

    // Bark colour: depth lerps dark->light, plus one of three subtle tints.
    const depthT = clamp(depth / P.maxDepth, 0, 1);
    const tintPick = rng();
    const tint =
      tintPick < 0.35
        ? [0.015, 0.05, -0.02]
        : tintPick < 0.7
          ? [0.055, 0.005, -0.012]
          : [-0.025, -0.015, 0.012];
    let bark: Vec3 = [
      lerp(P.barkDark[0], P.barkLight[0], depthT) + tint[0],
      lerp(P.barkDark[1], P.barkLight[1], depthT) + tint[1],
      lerp(P.barkDark[2], P.barkLight[2], depthT) + tint[2],
    ];
    if (isDead) bark = [0.6, 0.58, 0.55];

    // Ring detail: ridge count, phases and a knot position for this branch.
    const radial = Math.max(4, P.radialByDepth[Math.min(depth, P.radialByDepth.length - 1)]);
    const ringStart: number[] = [];
    const ridgePhase = rng() * Math.PI * 2;
    const ridgeAmp = 0.05 + 0.06 * rng();
    const ridgeCount = Math.min(4 + Math.floor(4 * rng()), Math.floor(radial / 2));
    const ridgePhase2 = rng() * Math.PI * 2;
    const ridgeSlope = (rng() - 0.5) * 2;
    const ridgeWarp = 0.5 + 0.8 * rng();
    const swell = isOuter ? 0.05 : depth === 0 ? 0.17 : 0.15;
    const warpAmp = 0.05 + 0.09 * rng();
    const warpPhase = rng() * Math.PI;
    const knotSeg = Math.floor(rng() * segs * 2.5);

    for (let s = 0; s <= segs; s++) {
      ringStart.push(out.positions.length / 3);
      const f = frames[s];
      const t = s / segs;
      const absLen = flexBase + t * len;
      const vCoord = absLen / 0.3;
      const ringScale =
        1 +
        ridgeAmp * Math.sin(1.9 * s + ridgePhase) +
        0.13 * Math.pow(Math.max(0, Math.sin(0.83 * s + 1.7 * ridgePhase)), 10);
      const isKnot = s === knotSeg;
      const knotScale = isKnot ? 0.8 : 1;
      const circ = 2 * Math.PI * ringR[s] * ringScale * knotScale;
      let firstX = 0, firstZ = 0;
      for (let k = 0; k <= radial; k++) {
        const closing = k === radial;
        const ang = (k / radial) * Math.PI * 2;
        const w = add(scale(f.n, Math.cos(ang)), scale(f.b, Math.sin(ang)));
        const ridge = Math.pow(
          0.5 + 0.5 * Math.cos(ang * ridgeCount + ridgeSlope * absLen * 6 + ridgePhase2 + ridgeWarp * Math.sin(9 * absLen + ridgePhase)),
          2.2,
        );
        let r =
          ringR[s] * ringScale * knotScale *
          (1 + warpAmp * Math.cos(2 * ang + warpPhase)) *
          (1 + swell * (0.55 - ridge)) *
          (1 + (rng() - 0.5) * 0.1);
        let shade = (rng() - 0.5) * 0.05;
        if (k === 0) { firstX = r; firstZ = shade; }
        if (closing) { r = firstX; shade = firstZ; }
        const p = add(points[s], scale(w, r));
        const bump = ((r / (ringR[s] * ringScale)) - 1) * 1.9;
        const depthShade = depth > 0 ? 1 - 0.3 * Math.exp(-0.8 * s) : 1;
        const z = shade + 0.12 * bump + (isKnot ? -0.09 : 0);
        let col: Vec3 = [
          (bark[0] + z) * depthShade,
          (bark[1] + z) * depthShade,
          (bark[2] + 0.8 * z) * depthShade,
        ];
        if (isOuter) {
          // outer twigs drift toward a greener grey
          const m = 0.4 * t;
          col = [lerp(col[0], 0.42, m), lerp(col[1], 0.48, m), lerp(col[2], 0.29, m)];
        }
        out.vert(p, w, col, absLen, [(k / radial) * (circ / 0.3), vCoord]);
      }
    }
    for (let s = 0; s < segs; s++)
      for (let k = 0; k < radial; k++) {
        const a = ringStart[s] + k;
        const b = ringStart[s] + k + 1;
        const c = ringStart[s + 1] + k;
        const d = ringStart[s + 1] + k + 1;
        out.tri(a, c, b);
        out.tri(b, c, d);
      }

    // Tip cap.
    {
      const f = frames[segs];
      const p = add(points[segs], scale(f.t, 0.7 * ringR[segs]));
      const ci = out.vert(p, f.t, bark, flexBase + len);
      for (let k = 0; k < radial; k++) out.tri(ringStart[segs] + k, ci, ringStart[segs] + k + 1);
    }
    // Root flare and base cap on the trunk.
    if (depth === 0) {
      const f = frames[0];
      const down = scale(f.t, -1);
      const ci = out.vert(points[0], down, [0.62, 0.52, 0.38], 0);
      const base = out.positions.length / 3;
      for (let k = 0; k < radial; k++) {
        const ang = (k / radial) * Math.PI * 2;
        const w = add(scale(f.n, Math.cos(ang)), scale(f.b, Math.sin(ang)));
        out.vert(add(points[0], scale(w, ringR[0])), down, [0.58, 0.48, 0.35], 0);
      }
      for (let k = 0; k < radial; k++) out.tri(base + k, base + ((k + 1) % radial), ci);
    }

    const radiusAt = (t: number) => lerp(radius, tipRadius, Math.pow(t, 0.72));
    const frameAt = (t: number) => frames[clamp(Math.round(t * segs), 0, segs)];
    const pointAt = (t: number) => {
      const x = t * segs;
      const i = clamp(Math.floor(x), 0, segs - 1);
      const f = x - i;
      return add(scale(points[i], 1 - f), scale(points[i + 1], f));
    };

    // Perches: candidate landing points for the bird.
    if (!(anchors as unknown as { perches?: Perch[] }).perches)
      (anchors as unknown as { perches: Perch[] }).perches = [];
    const perches = (anchors as unknown as { perches: Perch[] }).perches;
    {
      const count = Math.max(1, Math.round(len / 0.06));
      for (let i = 0; i < count; i++) {
        const t = 0.15 + 0.7 * (count === 1 ? 0.5 : i / (count - 1));
        perches.push({
          c: pointAt(t),
          r: radiusAt(t),
          along: frameAt(t).t,
          d: depth,
          t,
          flex: flexBase + t * len,
        });
      }
    }

    // Occasionally a short dead stub on the lower depths.
    if (!isDead && depth <= 1) {
      const stubCount = +(rng() < 0.32);
      for (let i = 0; i < stubCount; i++) {
        const t = 0.15 + 0.7 * rng();
        const ang = rng() * Math.PI * 2;
        const f = frameAt(t);
        const w = add(scale(f.n, Math.cos(ang)), scale(f.b, Math.sin(ang)));
        const tilt = 0.9 + 0.5 * rng();
        const dir = norm(add(add(scale(f.t, Math.cos(tilt)), scale(w, Math.sin(tilt))), [0, -0.15 * rng(), 0]));
        branch(pointAt(t), dir, 0.035 + 0.05 * rng(), Math.max(0.42 * radiusAt(t), 0.0015), P.maxDepth, flexBase + t * len, true);
      }
    }

    // Children: golden-angle spacing around the parent.
    if (!isDead && depth < P.maxDepth) {
      const count = Math.max(
        0,
        Math.round(P.childrenByDepth[Math.min(depth, P.childrenByDepth.length - 1)] + (rng() - 0.5) * 1.5),
      );
      let ang = rng() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const t = clamp(0.14 + 0.78 * ((i + 0.8 * rng()) / Math.max(1, count)), 0.12, 0.92);
        ang += 2.39996323 + (rng() - 0.5) * 0.9;
        const f = frameAt(t);
        const w = add(scale(f.n, Math.cos(ang)), scale(f.b, Math.sin(ang)));
        const spread = lerp(P.childAngle[0], P.childAngle[1], rng());
        const dir = norm(add(scale(f.t, Math.cos(spread)), scale(w, Math.sin(spread))));
        const childLen = len * lerp(0.4, 0.62, rng()) * (1.25 - 0.55 * t);
        const childRad = Math.max(Math.min(0.72 * radiusAt(t), radiusAt(t) * (0.5 + 0.25 * rng())), 0.0022);
        const start = add(pointAt(t), scale(w, 0.6 * radiusAt(t)));
        if (childLen > 2.2 * P.segLen)
          branch(start, dir, childLen, childRad, depth + 1, flexBase + t * len, false);
      }
      // A few short twigs near the tip of each branch.
      if (depth <= P.maxDepth - 2) {
        const twigs = 1 + Math.round(1.5 * rng());
        for (let i = 0; i < twigs; i++) {
          const t = clamp(0.1 + 0.85 * rng(), 0.1, 0.95);
          ang += 4.079937491 + (rng() - 0.5);
          const f = frameAt(t);
          const w = add(scale(f.n, Math.cos(ang)), scale(f.b, Math.sin(ang)));
          const spread = lerp(0.7, 1.15, rng());
          const dir = norm(add(scale(f.t, Math.cos(spread)), scale(w, Math.sin(spread))));
          const twigLen = len * lerp(0.1, 0.2, rng());
          if (twigLen > 1.6 * P.segLen)
            branch(add(pointAt(t), scale(w, 0.6 * radiusAt(t))), dir, twigLen, Math.max(0.3 * radiusAt(t), 0.0016), P.maxDepth - 1, flexBase + t * len, false);
        }
      }
    }

    // Leaf anchors along the outer branches.
    if (!isDead && depth >= 1) {
      const rng2 = mulberry32(Math.floor(0xffffffff * rng()));
      const outer = depth >= (P.leafOuterDepth ?? P.maxDepth - 1);
      const density = outer ? P.leafDensity : 0.26 * P.leafDensity;
      const startT = outer ? 0.12 : 0.5;
      const count = Math.round((len / 0.05) * density);
      let ang = rng2() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const t = clamp(startT + (1 - startT) * Math.pow(i / Math.max(1, count - 1), 0.78), 0, 1);
        ang += 2.39996323 + (rng2() - 0.5) * 0.5;
        const cluster = rng2() < 0.35 ? 3 : rng2() < 0.75 ? 2 : 1;
        for (let c = 0; c < cluster; c++) {
          const tt = clamp(t + (c - (cluster - 1) / 2) * 0.055, 0.05, 1);
          const f = frameAt(tt);
          const a2 = ang + c * (2.4 + 0.6 * rng2());
          const w = add(scale(f.n, Math.cos(a2)), scale(f.b, Math.sin(a2)));
          anchors.push({
            p: add(add(pointAt(tt), scale(w, 0.8 * radiusAt(tt))), scale(f.t, (rng2() - 0.5) * 0.02)),
            out: w,
            along: f.t,
            c: pointAt(tt),
            r: radiusAt(tt),
            d: depth,
            t: tt,
            size: lerp(0.75, 1.15, rng2()) * (1.05 - 0.25 * tt),
            flex: flexBase + tt * len,
            roll: (rng2() - 0.5) * 2,
            droop: rng2(),
          });
        }
      }
      const f = frames[segs];
      anchors.push({
        p: add(points[segs], scale(f.t, ringR[segs])),
        out: f.n,
        along: f.t,
        c: points[segs],
        r: ringR[segs],
        d: depth,
        t: 1,
        size: lerp(0.85, 1.1, rng2()),
        flex: flexBase + len,
        roll: (rng2() - 0.5) * 2,
        droop: rng2(),
      });
    }
  }

  branch(P.origin as Vec3, rootDir, P.trunkLen, P.trunkRadius, 0, 0, false);

  // Normalise flex to 0..1^1.4 so the tips carry the wind.
  let maxFlex = 1e-6;
  for (const f of out.flex) if (f > maxFlex) maxFlex = f;
  for (const a of anchors) if (a.flex > maxFlex) maxFlex = a.flex;
  const flex = new Float32Array(out.flex.length);
  for (let i = 0; i < out.flex.length; i++) flex[i] = Math.pow(out.flex[i] / maxFlex, 1.4);
  for (const a of anchors) a.flex = Math.pow(a.flex / maxFlex, 1.4);
  const perches = (anchors as unknown as { perches: Perch[] }).perches || [];
  for (const p of perches) p.flex = Math.min(1, Math.pow(p.flex / maxFlex, 1.4));

  const vertexCount = out.positions.length / 3;
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  const center: Vec3 = [
    (out.min[0] + out.max[0]) / 2,
    (out.min[1] + out.max[1]) / 2,
    (out.min[2] + out.max[2]) / 2,
  ];
  const radius =
    0.5 * Math.hypot(out.max[0] - out.min[0], out.max[1] - out.min[1], out.max[2] - out.min[2]);

  return {
    positions: new Float32Array(out.positions),
    normals: new Float32Array(out.normals),
    colors: new Float32Array(out.colors),
    flex,
    uvs: new Float32Array(out.uvs),
    indices: new IndexArray(out.indices),
    anchors,
    perches,
    bounds: { center, radius },
    stats: {
      vertices: vertexCount,
      triangles: out.indices.length / 3,
      leaves: anchors.length,
      seed,
    },
  };
}

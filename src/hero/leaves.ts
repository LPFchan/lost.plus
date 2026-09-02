// Leaf textures and instancing, from the Fable hero. Two small canvas
// atlases are painted at boot (no image downloads): a 2x2 set of frond-like
// canopy leaves and a 2x2 set of simple oval leaves. The placement code —
// basis construction, clump averaging, tint spread — is the hero's, with
// names.

import * as THREE from 'three';
import type { LeafAnchor } from './tree';

/** 2x2 frond atlas on a 256px canvas (the canopy leaves). */
export function makeFrondAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  const kinds = ['h', 'h', 'y', 'd'];
  const cells: [number, number][] = [
    [0, 0],
    [128, 0],
    [0, 128],
    [128, 128],
  ];
  cells.forEach(([cx, cy], i) =>
    paintFrond(ctx, cx, cy, kinds[i] as 'h' | 'y' | 'd'),
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  tex.generateMipmaps = true;
  return tex;
}

/** One frond: a serrated blade with veins, speckles and a stem. */
function paintFrond(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  kind: 'h' | 'y' | 'd',
) {
  const cx = ox + 64 + (Math.random() - 0.5) * 8;
  const top = oy + 16;
  const bottom = oy + 128 - 26;
  const len = bottom - top;
  const size = 0.42 + 0.08 * Math.random();
  const width = (t: number) =>
    128 *
    size *
    Math.pow(Math.sin(Math.PI * Math.pow(Math.max(t, 0.01), 0.45) * 0.9), 1.1) *
    (1 - 0.85 * Math.pow(t, 2.5));
  const teeth = 8 + Math.floor(4 * Math.random());
  const toothAmp = 0.11 + 0.05 * Math.random();
  const bend = (Math.random() - 0.5) * 0.16;
  const saw = () =>
    Array.from({ length: 24 }, () => 0.55 + 0.9 * Math.random());
  const sawA = saw();
  const sawB = saw();
  const phaseA = Math.random();
  const phaseB = Math.random();
  const tooth = (t: number, phase: number, wave: number[]) => {
    const o = t * teeth + phase;
    const w = wave[((Math.floor(o) % 24) + 24) % 24];
    const env = Math.min(1, 5 * t) * Math.min(1, (1 - t) * 6 + 0.1);
    return 1 + toothAmp * Math.pow(1 - Math.abs(2 * (o - Math.floor(o)) - 1), 0.65) * w * env;
  };
  const path: [number, number][] = [];
  for (let s = 0; s <= 96; s++) {
    const t = s / 96;
    const drift = bend * Math.sin(Math.PI * t) * 23.04;
    path.push([cx + drift + width(1 - t) * tooth(t, phaseA, sawA), top + t * len]);
  }
  for (let s = 96; s >= 0; s--) {
    const t = s / 96;
    const drift = bend * Math.sin(Math.PI * t) * 23.04;
    path.push([cx + drift - width(1 - t) * tooth(t, phaseB, sawB), top + t * len]);
  }
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (const [x, y] of path) ctx.lineTo(x, y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, bottom, 0, top);
  const tone = 0.92 + 0.16 * Math.random();
  const hex = (v: number) =>
    Math.round(v * tone).toString(16).padStart(2, '0');
  if (kind === 'y') {
    grad.addColorStop(0, '#a89a4e');
    grad.addColorStop(0.55, '#8f8145');
    grad.addColorStop(1, '#7a6f3c');
  } else {
    grad.addColorStop(0, '#' + hex(139) + hex(143) + hex(92));
    grad.addColorStop(0.55, '#' + hex(112) + hex(120) + hex(74));
    grad.addColorStop(1, '#' + hex(91) + hex(101) + hex(64));
  }
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // speckles
  for (let s = 0; s < 40; s++) {
    const x = ox + 128 * Math.random();
    const y = top + Math.random() * len;
    const r = 5 + 18 * Math.random();
    ctx.fillStyle =
      Math.random() < 0.5 ? 'rgba(70,102,44,0.10)' : 'rgba(178,204,110,0.10)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }

  // midrib + side veins
  const vein = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number,
  ) => {
    ctx.strokeStyle = 'rgba(58,84,36,0.55)';
    ctx.lineWidth = w + 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + (x2 - x1) * 0.12, (y1 + y2) / 2, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(196,216,140,0.8)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + (x2 - x1) * 0.12, (y1 + y2) / 2, x2, y2);
    ctx.stroke();
  };
  vein(cx, bottom + 8, cx, top + 4, 1.6);
  for (let v = 0; v < 6; v++) {
    const t = 0.12 + 0.15 * v;
    const y = bottom - t * len;
    const half = 0.94 * width(t);
    vein(cx, y, cx + half, y - 0.13 * len, 1);
    vein(cx, y, cx - half, y - 0.13 * len, 1);
  }
  ctx.restore();

  // dry kind: a few holes
  if (kind === 'd')
    for (let h = 0; h < 3; h++) {
      const t = 0.22 + 0.6 * Math.random();
      const centred = h === 2;
      const side = Math.random() < 0.5 ? 1 : -1;
      const x = centred
        ? cx + (Math.random() - 0.5) * width(0.5)
        : cx + side * width(1 - t) * 0.85;
      const y = top + t * len;
      const r = centred ? 3 + 4 * Math.random() : 6 + 9 * Math.random();
      ctx.fillStyle = 'rgba(122,84,44,0.6)';
      ctx.beginPath();
      ctx.arc(x, y, r + 2.5, 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

  // stem
  ctx.strokeStyle = '#7d7a4a';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, bottom + 2);
  ctx.lineTo(cx, oy + 128 - 3);
  ctx.stroke();
  ctx.strokeStyle = '#96905c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, bottom + 2);
  ctx.lineTo(cx, oy + 128 - 3);
  ctx.stroke();
}

/** 2x2 oval-leaf atlas on a 128px canvas (the under-canopy leaves). */
export function makeOvalAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  const cells: [number, number][] = [
    [0, 0],
    [64, 0],
    [0, 64],
    [64, 64],
  ];
  cells.forEach(([ox, oy], i) => {
    const w = 64 * (0.36 + (i % 2) * 0.06);
    const h = 64 * (0.78 + 0.08 * (i >> 1));
    const cx = ox + 32;
    const base = oy + 58.88;
    const grad = ctx.createLinearGradient(0, base, 0, base - h);
    grad.addColorStop(0, i % 2 ? '#6b4d36' : '#7a5a40');
    grad.addColorStop(0.55, '#8a7448');
    grad.addColorStop(1, i >> 1 ? '#b5b060' : '#a8ad5a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.bezierCurveTo(cx - 0.62 * w, base - 0.25 * h, cx - 0.5 * w, base - 0.85 * h, cx, base - h);
    ctx.bezierCurveTo(cx + 0.5 * w, base - 0.85 * h, cx + 0.62 * w, base - 0.25 * h, cx, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,25,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,190,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - 0.16 * w, base - 0.55 * h, 0.14 * w, 0.3 * h, 0, 0, 2 * Math.PI);
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * The canopy leaf card: a plane curled along its length with a small stem
 * quad appended, matching the hero's geometry (which is why the uv strip
 * starts at 0.105 — the stem shares the card's texture cell).
 */
export function makeLeafCard(): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(1, 1, 1, 2);
  plane.translate(0, 0.5, 0);
  const pos = plane.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -0.16 * y * y + 0.09 * Math.abs(x));
  }
  plane.translate(0, 0.16, 0);
  const uv = plane.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.105 + 0.895 * uv.getY(i));
  plane.computeVertexNormals();

  const p = plane.attributes.position.array as Float32Array;
  const n = plane.attributes.normal.array as Float32Array;
  const u = plane.attributes.uv.array as Float32Array;
  const idx = plane.index!.array as Uint16Array;
  const verts = p.length / 3;
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(p.length + 12);
  P.set(p);
  P.set([-0.02, 0, 0, 0.02, 0, 0, -0.014, 0.16, 0, 0.014, 0.16, 0], p.length);
  const N = new Float32Array(n.length + 12);
  N.set(n);
  N.set([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], n.length);
  const U = new Float32Array(u.length + 8);
  U.set(u);
  U.set([0.485, 0.01, 0.515, 0.01, 0.485, 0.095, 0.515, 0.095], u.length);
  const I = new Uint16Array(idx.length + 6);
  I.set(idx);
  I.set([verts, verts + 1, verts + 2, verts + 1, verts + 3, verts + 2], idx.length);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  return g;
}

export type LeafInstances = {
  geometry: THREE.InstancedBufferGeometry;
  count: number;
};

const CELL_UV: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];

/**
 * Instance the canopy leaves on the anchors. Neighbouring leaves on a clump
 * have their facing averaged (and very close pairs pushed apart), which is
 * what makes the canopy read as rounded masses instead of confetti.
 */
export function buildCanopyLeaves(
  anchors: LeafAnchor[],
  seed: number,
): LeafInstances {
  const rng = (() => {
    let t = seed >>> 0 || 1;
    return () => (t = (1664525 * t + 0x3c6ef35f) >>> 0) / 0x100000000;
  })();
  const order = anchors.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const leaves = order;
  const count = leaves.length;

  const mats = new Float32Array(16 * count);
  const tints = new Float32Array(3 * count);
  const winds = new Float32Array(3 * count);
  const cells = new Float32Array(2 * count);
  const outs = new Float32Array(3 * count);
  const sides = new Float32Array(3 * count);
  const sizes = new Float32Array(count);
  const poss = new Float32Array(3 * count);

  const eU = new THREE.Vector3();
  const eH = new THREE.Vector3();
  const e_ = new THREE.Vector3();
  const eq = new THREE.Vector3();
  const ej = new THREE.Quaternion();
  const eO = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const a = leaves[i];
    eU.set(a.out[0], a.out[1], a.out[2])
      .addScaledVector(eH.set(a.along[0], a.along[1], a.along[2]), 0.55);
    eU.y += 0.05 - 0.6 * a.droop;
    eU.normalize();
    eq.crossVectors(eU, eH.set(0, 1, 0));
    if (eq.lengthSq() < 1e-6) eq.set(1, 0, 0);
    eq.normalize();
    e_.crossVectors(eq, eU).normalize();
    ej.setFromAxisAngle(eU, 0.8 * a.roll);
    e_.applyQuaternion(ej);
    outs.set([eU.x, eU.y, eU.z], 3 * i);
    sides.set([e_.x, e_.y, e_.z], 3 * i);
    sizes[i] = a.size;
    poss.set([a.p[0], a.p[1], a.p[2]], 3 * i);
  }

  // clump averaging: leaves whose tips land in the same cell face a little
  // more alike; close pairs are pushed apart and the smaller one shrinks
  {
    const cellOf = (x: number, y: number, z: number) => x + ',' + y + ',' + z;
    const tips = new Float32Array(3 * count);
    const grid = new Map<string, number[]>();
    for (let i = 0; i < count; i++) {
      const r = 0.094 * sizes[i] * 0.55;
      tips[3 * i] = poss[3 * i] + outs[3 * i] * r;
      tips[3 * i + 1] = poss[3 * i + 1] + outs[3 * i + 1] * r;
      tips[3 * i + 2] = poss[3 * i + 2] + outs[3 * i + 2] * r;
      const key = cellOf(
        Math.round(tips[3 * i] / 0.1034),
        Math.round(tips[3 * i + 1] / 0.1034),
        Math.round(tips[3 * i + 2] / 0.1034),
      );
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(i);
    }
    for (let pass = 0; pass < 3; pass++) {
      const separate = pass === 2;
      for (let i = 0; i < count; i++) {
        const cx = Math.round(tips[3 * i] / 0.1034);
        const cy = Math.round(tips[3 * i + 1] / 0.1034);
        const cz = Math.round(tips[3 * i + 2] / 0.1034);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const bucket = grid.get(cellOf(cx + dx, cy + dy, cz + dz));
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                const tx = tips[3 * j] - tips[3 * i];
                const ty = tips[3 * j + 1] - tips[3 * i + 1];
                const tz = tips[3 * j + 2] - tips[3 * i + 2];
                const dist = Math.hypot(tx, ty, tz);
                const reach = 0.1034 * (sizes[i] + sizes[j]) * 0.5;
                if (dist >= reach) continue;
                const k = 0.25 + 0.65 * (1 - dist / reach);
                const flip =
                  sides[3 * i] * sides[3 * j] +
                    sides[3 * i + 1] * sides[3 * j + 1] +
                    sides[3 * i + 2] * sides[3 * j + 2] <
                  0
                    ? -1
                    : 1;
                for (let c = 0; c < 3; c++) {
                  const a = sides[3 * i + c];
                  const b = sides[3 * j + c];
                  sides[3 * i + c] = a + b * flip * k;
                  sides[3 * j + c] = b + a * flip * k;
                }
                const m =
                  Math.hypot(sides[3 * i], sides[3 * i + 1], sides[3 * i + 2]) || 1;
                const nx = sides[3 * i] / m;
                const ny = sides[3 * i + 1] / m;
                const nz = sides[3 * i + 2] / m;
                if (separate && dist < 0.55 * reach) {
                  const sign = tx * nx + ty * ny + tz * nz >= 0 ? 1 : -1;
                  const push = Math.min(0.007, (0.55 * reach - dist) * 0.5);
                  for (let c = 0; c < 3; c++) {
                    const off = [nx, ny, nz][c] * sign * push;
                    poss[3 * j + c] += off;
                    poss[3 * i + c] -= off;
                  }
                  if (dist < 0.3 * reach) {
                    const smaller = sizes[i] < sizes[j] ? i : j;
                    sizes[smaller] = Math.max(0.5, 0.82 * sizes[smaller]);
                  }
                }
              }
            }
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const a = leaves[i];
    eU.set(outs[3 * i], outs[3 * i + 1], outs[3 * i + 2]);
    e_.set(sides[3 * i], sides[3 * i + 1], sides[3 * i + 2]).normalize();
    eq.crossVectors(eU, e_).normalize();
    e_.crossVectors(eq, eU).normalize();
    const r = 0.094 * sizes[i];
    const sx = r * (0.85 + 0.3 * Math.random());
    const sy = r;
    const sz = r * (0.7 + 0.9 * Math.random());
    eO.makeBasis(
      eq.multiplyScalar(sx),
      eU.multiplyScalar(sy),
      e_.multiplyScalar(sz),
    );
    eO.setPosition(poss[3 * i], poss[3 * i + 1], poss[3 * i + 2]);
    mats.set(eO.elements, 16 * i);

    const pick = Math.random();
    const base =
      pick < 0.1
        ? [1.14, 1.05, 0.7]
        : pick < 0.48
          ? [0.36, 0.41, 0.28]
          : pick < 0.68
            ? [0.62, 0.68, 0.5]
            : [1, 1, 1];
    const shade = (0.85 + 0.35 * Math.random()) * (0.62 + 0.42 * a.flex);
    tints.set([base[0] * shade, base[1] * shade, base[2] * shade], 3 * i);
    winds.set(
      [Math.random() * Math.PI * 2, a.flex, 0.5 + 0.55 * Math.random()],
      3 * i,
    );
    cells.set(CELL_UV[(4 * Math.random()) | 0], 2 * i);
  }

  const card = makeLeafCard();
  const g = new THREE.InstancedBufferGeometry();
  g.index = card.index;
  g.attributes.position = card.attributes.position;
  g.attributes.normal = card.attributes.normal;
  g.attributes.uv = card.attributes.uv;
  g.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(mats, 16));
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  g.setAttribute('aWindI', new THREE.InstancedBufferAttribute(winds, 3));
  g.setAttribute('aUvCell', new THREE.InstancedBufferAttribute(cells, 2));
  g.instanceCount = count;
  return { geometry: g, count };
}

/** Small oval leaves sprinkled through the canopy (the second instanced set). */
export function buildOvalLeaves(
  anchors: LeafAnchor[],
  seed: number,
): LeafInstances {
  const rng = (() => {
    let t = (7 * seed + 13) >>> 0 || 1;
    return () => (t = (1664525 * t + 0x3c6ef35f) >>> 0) / 0x100000000;
  })();
  const picked: LeafAnchor[] = [];
  const keep = Math.min(anchors.length, 1300) / anchors.length;
  for (const a of anchors) if (rng() < keep) picked.push(a);
  const count = picked.length;

  const mats = new Float32Array(16 * count);
  const tints = new Float32Array(3 * count);
  const winds = new Float32Array(3 * count);
  const cells = new Float32Array(2 * count);
  const eU = new THREE.Vector3();
  const eH = new THREE.Vector3();
  const e_ = new THREE.Vector3();
  const eq = new THREE.Vector3();
  const eO = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const a = picked[i];
    eU.set(a.along[0], a.along[1], a.along[2])
      .addScaledVector(eH.set(a.out[0], a.out[1], a.out[2]), 0.7)
      .normalize();
    eq.crossVectors(eU, eH.set(0, 1, 0));
    if (eq.lengthSq() < 1e-6) eq.set(1, 0, 0);
    eq.normalize();
    e_.crossVectors(eq, eU).normalize();
    const r = 0.013 + 0.01 * rng();
    eO.makeBasis(
      eq.multiplyScalar(0.55 * r),
      eU.multiplyScalar(r),
      e_.multiplyScalar(0.55 * r),
    );
    eO.setPosition(a.p[0], a.p[1], a.p[2]);
    mats.set(eO.elements, 16 * i);
    const tone = 0.85 + 0.3 * rng();
    tints.set([tone, tone * (0.96 + 0.06 * rng()), 0.9 * tone], 3 * i);
    winds.set([rng() * Math.PI * 2, a.flex, 0.15], 3 * i);
    cells.set(CELL_UV[(4 * rng()) | 0], 2 * i);
  }

  const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
  plane.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = plane.index;
  g.attributes.position = plane.attributes.position;
  g.attributes.normal = plane.attributes.normal;
  g.attributes.uv = plane.attributes.uv;
  g.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(mats, 16));
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  g.setAttribute('aWindI', new THREE.InstancedBufferAttribute(winds, 3));
  g.setAttribute('aUvCell', new THREE.InstancedBufferAttribute(cells, 2));
  g.instanceCount = count;
  return { geometry: g, count };
}

// The tit: GLB loading, the hero's mesh touch-ups, the wrist-bone graft,
// and the full behavioural state machine — cross the sky, land on a perch
// (the branch dips and springs back under the weight), idle with tail flicks
// and shuffles and peers, take off again. All timings and constants are the
// hero's; the code got names and structure.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BirdTextures = {
  map: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
};

export type Perch = {
  p: number[];
  flex: number;
  along?: number[];
  r?: number;
};

type Bones = {
  list: THREE.Object3D[];
  clean: THREE.Quaternion[];
  cleanScale: THREE.Vector3[];
  rest: Record<string, THREE.Quaternion>;
  wingL?: THREE.Object3D;
  wingR?: THREE.Object3D;
  wristL?: THREE.Object3D;
  wristR?: THREE.Object3D;
  tail?: THREE.Object3D;
  head?: THREE.Object3D;
  legs?: THREE.Object3D;
};

type BirdRig = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  flap: THREE.AnimationAction;
  perch: THREE.AnimationAction;
  fold: THREE.AnimationAction;
  bones: Bones;
};

const BONE_NAMES = ['wingL', 'wingR', 'wristL', 'wristR', 'tail', 'head', 'legs'];
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const smooth = (x: number) => {
  const e = Math.min(1, Math.max(0, x));
  return e * e * (3 - 2 * e);
};

export type BirdSystem = {
  group: THREE.Group;
  ready: boolean;
  materials: THREE.MeshStandardMaterial[];
  /** advance the state machine; dt in seconds, t = scene clock */
  update(dt: number, t: number, wind: number): void;
  /** current perch spring offset of the branch the bird sits on */
  perchOffset(out: THREE.Vector3, t: number, wind: number): THREE.Vector3;
  setPerch(p: Perch): void;
  setPointer(x: number, y: number): void;
  cue(): void;
  screenPos(): [number, number] | null;
  state: () => string;
};

export function loadBird(opts: {
  url: string;
  textures: BirdTextures;
  camera: THREE.PerspectiveCamera;
  view: {
    w: number;
    h: number;
    portrait: boolean;
    min: number;
    max: number;
    cy: number;
    zoom: number;
  };
  wind: {
    uTime: { value: number };
    uLag: { value: number };
    uLand: { value: THREE.Vector4 };
    uLandK: { value: THREE.Vector3 };
  };
  portraitScale: () => number;
  onReady?: () => void;
}): BirdSystem {
  const { camera, view, wind } = opts;
  const group = new THREE.Group();
  group.visible = false;

  const materials: THREE.MeshStandardMaterial[] = [];
  const rigs: BirdRig[] = [];
  const flocks: THREE.Group[] = [];

  let ready = false;
  let state: 'away' | 'cross' | 'in' | 'out' | 'perched' = 'away';
  let stateT = 0; // seconds inside the current state
  let stateDur = 0;
  let nextReturnAt = 0;
  let leaveAt = 0; // when a perched bird takes off
  let nextIdleAt = 0;
  let idleBias = 0;
  let idleBiasTarget = 0;

  // flight path control points
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const pathLen = { v: 1 };
  const arcTable = new Float32Array(65);
  let phase0 = 0;
  let wingFreq = 1;

  const perch: { current: Perch } = {
    current: { p: [0.4, 0.3, -2.6], flex: 0.5 },
  };

  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpV3 = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const quatFrom = new THREE.Quaternion();
  const quatTo = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion();
  const helper = new THREE.Object3D();

  // idle action
  let idle: { kind: string; t0: number; dur: number; a: number; b: number } | null = null;
  let hopLean = 0;
  let peerPitch = 0;
  let perchBlend = 1; // 1 = perched pose, 0 = flight pose
  let foldBlend = 0;
  let bankSmooth = 0;
  let landAt = -10;
  let landSettleAt = -10;
  let headYaw = 0;
  let headPitch = 0;
  let pointerX = -1;
  let pointerY = -1;
  let cueAwayAt = 0;
  let flyInQueued = false;

  const WING_BEAT = 10; // beats per second while crossing

  function collectBones(root: THREE.Object3D): Bones {
    const b: Bones = {
      list: [],
      clean: [],
      cleanScale: [],
      rest: {},
    };
    for (const name of BONE_NAMES) {
      const o = root.getObjectByName(name);
      if (o) {
        b.list.push(o);
        b.clean.push(o.quaternion.clone());
        b.cleanScale.push(o.scale.clone());
        b.rest[name] = o.quaternion.clone();
        (b as unknown as Record<string, THREE.Object3D>)[name] = o;
      }
    }
    return b;
  }

  function makeMaterial(opacity: number) {
    const mat = new THREE.MeshStandardMaterial({
      map: opts.textures.map,
      normalMap: opts.textures.normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: opts.textures.rough,
      roughness: 0.72,
      metalness: 0,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: opts.textures.map,
      emissiveIntensity: 0.18,
    });
    if (opacity < 1) {
      mat.transparent = true;
      mat.opacity = opacity;
      mat.depthWrite = false;
    }
    materials.push(mat);
    return mat;
  }

  function rigify(sceneRoot: THREE.Group, clips: THREE.AnimationClip[], opacity: number): BirdRig {
    sceneRoot.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.frustumCulled = false;
        (o as THREE.Mesh).material = makeMaterial(opacity);
      }
    });
    const mixer = new THREE.AnimationMixer(sceneRoot);
    const find = (name: string) =>
      clips.find((c) => c.name.toLowerCase().includes(name)) || clips[0];
    const flap = mixer.clipAction(find('flap'));
    const perchA = mixer.clipAction(find('perch'));
    const fold = mixer.clipAction(
      clips.find((c) => c.name.toLowerCase().includes('fold')) || find('perch'),
    );
    flap.play();
    perchA.play();
    fold.play();
    perchA.setEffectiveWeight(0);
    fold.setEffectiveWeight(0);
    return { root: sceneRoot, mixer, flap, perch: perchA, fold, bones: collectBones(sceneRoot) };
  }

  /** Pose blending between the flap/perch/fold clips + wing fold on glide. */
  function blendClips(rig: BirdRig, perchedW: number, beat: number, foldW = 0) {
    const r = Math.min(1, perchedW + foldW * (1 - perchedW));
    rig.flap.setEffectiveWeight(1 - r);
    rig.perch.setEffectiveWeight(perchedW);
    rig.fold.setEffectiveWeight(foldW * (1 - perchedW));
    rig.flap.time = ((0.52 * beat) % 1.04 + 1.04) % 1.04;
    const n = rig.bones;
    for (let i = 0; i < n.list.length; i++) {
      n.list[i].quaternion.copy(n.clean[i]);
      n.list[i].scale.copy(n.cleanScale[i]);
    }
    rig.mixer.update(0);
    for (let i = 0; i < n.list.length; i++) {
      n.clean[i].copy(n.list[i].quaternion);
      n.cleanScale[i].copy(n.list[i].scale);
    }
    const jitter = 0.07 * Math.sin(7.31 * Math.floor(beat) + 1.7) * (1 - r);
    const foldAmt = Math.min(1, Math.max(0, (1 - 0.9) * (1 - r) + jitter));
    if (foldAmt > 0.001) {
      if (n.wingL) n.wingL.quaternion.slerp(n.rest.wingL!, foldAmt);
      if (n.wingR) n.wingR.quaternion.slerp(n.rest.wingR!, foldAmt);
    }
    if (n.tail) n.tail.scale.x = 1 + 1.5 * foldBlend * (1 - perchedW);
    if (n.legs) {
      n.legs.quaternion.slerpQuaternions(
        n.rest.legs!,
        tmpQ.copy(n.rest.legs!).multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, 0.96)),
        1 - perchBlend,
      );
      n.legs.scale.setScalar(0.55 + 0.8 * perchBlend);
    }
    return (1 - r) * 0.9;
  }

  const rot = (o: THREE.Object3D, axis: THREE.Vector3, angle: number) =>
    o.quaternion.multiply(tmpQ.setFromAxisAngle(axis, angle));

  /** Wing-beat shape on top of the flap clip: fold on the upstroke. */
  function flapShape(rig: BirdRig, phase: number, amt: number) {
    if (amt <= 0.001) return;
    const o = rig.bones;
    const r = o.wingL;
    const n = o.wingR;
    if (!r || !n) return;
    const c = Math.cos((phase - 0.23 - 0.25) * 2 * Math.PI);
    const lift = Math.max(0, -c);
    const z = (c > 0 ? -0.14 * c : 0.3 * lift) * amt;
    const y = 0.3 * lift * amt;
    rot(r, AXIS_Z, z);
    rot(r, AXIS_Y, y);
    rot(n, AXIS_Z, -z);
    rot(n, AXIS_Y, -y);
    if (o.wristL && o.wristR) {
      const foldW = lift * lift * 0.62 * amt;
      const spread = 0.35 * lift * amt;
      const twist = 0.3 * Math.sin((phase - 0.23) * 2 * Math.PI) * amt;
      rot(o.wristL, AXIS_Z, foldW);
      rot(o.wristL, AXIS_X, twist - spread);
      rot(o.wristR, AXIS_Z, -foldW);
      rot(o.wristR, AXIS_X, twist - spread);
    }
  }

  // wing-beat burst table: bouts of flapping with glides between
  type BeatRow = { t0: number; on: number; off: number; beats: number; beat0: number };
  let beatRows: BeatRow[] = [];
  let beatAmp = 0;
  function buildBeats(span: number) {
    beatRows = [];
    let t = 0;
    let acc = 0;
    while (t < span + 2) {
      const beats = 24 + Math.floor(17 * Math.random());
      const on = beats / WING_BEAT;
      const off = 0.09 + 0.07 * Math.random();
      beatRows.push({ t0: t, on, off, beats, beat0: acc });
      t += on + off;
      acc += beats;
    }
    beatAmp = 0;
  }
  type Beat = { flapW: number; beat: number; y: number; burst: number };
  const beatA: Beat = { flapW: 1, beat: 0, y: 0, burst: 0 };
  function beatAt(t: number, out: Beat = beatA): Beat {
    if (!beatRows.length) buildBeats(6);
    let row = beatRows[beatRows.length - 1];
    for (const r of beatRows) {
      if (t >= r.t0) row = r;
      else break;
    }
    const o = t - row.t0;
    const on = o < row.on;
    const n = on ? o / row.on : Math.min(1, (o - row.on) / row.off);
    out.flapW = Math.min(smooth((o + 0.02) / 0.11), smooth((row.on + 0.05 - o) / 0.16));
    out.beat = row.beat0 + (on ? n * row.beats : row.beats);
    out.y = on ? -Math.cos(n * Math.PI) : Math.cos(n * Math.PI);
    out.burst = on ? Math.sin(n * Math.PI) : 0;
    return out;
  }

  // quadratic bezier flight path with arc-length parameterisation
  const pathPoint = (out: THREE.Vector3, t: number) => {
    const a = 1 - t;
    return out.set(
      a * a * pA.x + 2 * a * t * pB.x + t * t * pC.x,
      a * a * pA.y + 2 * a * t * pB.y + t * t * pC.y,
      a * a * pA.z + 2 * a * t * pB.z + t * t * pC.z,
    );
  };
  function buildArc() {
    let acc = 0;
    arcTable[0] = 0;
    pathPoint(tmpV, 0);
    for (let i = 1; i <= 64; i++) {
      pathPoint(tmpV2, i / 64);
      acc += tmpV2.distanceTo(tmpV);
      arcTable[i] = acc;
      tmpV.copy(tmpV2);
    }
    pathLen.v = acc || 1;
    for (let i = 1; i <= 64; i++) arcTable[i] /= pathLen.v;
  }
  const arcToT = (s: number) => {
    if (s <= 0) return 0;
    if (s >= 1) return 1;
    let lo = 0;
    let hi = 64;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arcTable[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = arcTable[hi] - arcTable[lo];
    return (lo + (span > 1e-9 ? (s - arcTable[lo]) / span : 0)) / 64;
  };
  const pathAt = (out: THREE.Vector3, s: number, bob?: Beat) => {
    pathPoint(out, arcToT(s));
    if (bob) out.y += beatAmp * bob.y * 0; // bob folded into glide below
    return out;
  };

  // ---- state transitions ------------------------------------------------

  function goAway(t: number) {
    state = 'away';
    group.visible = false;
    for (const f of flocks) f.visible = false;
    nextReturnAt = t + (t < 1 ? 3 : 14 + 20 * Math.random());
  }

  /** Cross the sky: enter on one side, leave on the other. */
  function startCross() {
    const tan = Math.tan(10.5 * Math.PI / 180);
    const dist = 3.55;
    const halfH = tan * dist;
    const dir = view.portrait ? 0.25 + 0.15 * Math.random() : 0.9 + 0.5 * Math.random();
    const d = dist - (dir < 0 ? -0.5 * dir : 0);
    const yFor = (ndc: number) => 0.183 * d + halfH * ((view.portrait ? ndc / view.zoom : ndc) + view.cy);
    const lo = yFor(view.portrait ? -0.24 : 0.14);
    const hi = yFor(view.portrait ? 0.1 : 0.52);
    const hiMax = yFor(view.portrait ? 0.14 : 0.58);
    const y1 = lo + Math.random() * (hi - lo);
    const y2 = lo + Math.random() * (hi - lo);
    const halfW = ((view.max - view.min) / 2) * halfH * (16 / 9) * (view.portrait ? 1 : camera.aspect / 1.78);
    const mid = view.portrait ? ((view.min + view.max) / 2) * halfH * (16 / 9) : 0;
    const margin = halfW + (view.portrait ? 0.35 : 0.5);
    const zOff = (Math.random() < 0.5 ? 1 : -1) * (view.portrait ? 0.45 + 0.2 * Math.random() : 0.9 + 0.5 * Math.random());
    pA.set(mid - margin, y1, -dist - zOff / 2 + (Math.random() - 0.5) * 0.2);
    pC.set(mid + margin, y2, pA.z + zOff);
    pB.copy(pA).lerp(pC, 0.4 + 0.2 * Math.random());
    pB.y = Math.min(pB.y + 0.04 + 0.12 * Math.random(), hiMax);
    pB.z += -dir;
    phase0 = 6.28 * Math.random();
    wingFreq = 0.8 + 0.5 * Math.random();
    buildArc();
    buildBeats(6);
    state = 'cross';
    stateDur = pathLen.v / (view.portrait ? 1.5 : 3);
    stateT = 0;
    group.visible = true;
  }

  /** Fly in from off-frame and land on the perch. */
  function startFlyIn() {
    if (!perch.current || !ready) return;
    pC.fromArray(perch.current.p as number[]);
    pC.y += 0.004;
    tmpV.copy(pC).project(camera);
    const ndcX = (tmpV.x + 1) / 2;
    const ndcY = (1 - tmpV.y) / 2;
    const dist = pC.distanceTo(camera.position);
    const unprojectAt = (out: THREE.Vector3, nx: number, ny: number, d: number) =>
      out
        .set(2 * nx - 1, -(2 * ny - 1), 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
        .multiplyScalar(d)
        .add(camera.position);
    unprojectAt(pA, 1.1, Math.min(0.96, ndcY + 0.17 + 0.06 * Math.random()), dist + 1.1 + 0.3 * Math.random());
    unprojectAt(pB, Math.min(0.98, ndcX + 0.1 + 0.03 * Math.random()), Math.min(0.97, ndcY + 0.1 + 0.03 * Math.random()), dist + 0.3);
    phase0 = 6.28 * Math.random();
    wingFreq = 0.8 + 0.5 * Math.random();
    buildArc();
    buildBeats(6);
    helper.position.copy(pC);
    helper.lookAt(pC.x - 1, pC.y + 0.02, pC.z + 0.22);
    helper.rotateX(-0.3);
    quatTo.copy(helper.quaternion);
    state = 'in';
    stateDur = 1.5;
    stateT = 0;
    cueAwayAt = 0;
    group.visible = true;
  }

  /** Take off from the perch. */
  function startTakeOff() {
    if (!perch.current) return;
    tmpV.fromArray(perch.current.p as number[]);
    pB.set(tmpV.x - 1.1, tmpV.y + 0.12 + 0.06 * Math.random(), tmpV.z + 0.2);
    const zEnd = tmpV.z - 1.4 - 0.4 * Math.random();
    const dist = -zEnd;
    const leftEdge = view.min * Math.tan(10.5 * Math.PI / 180) * dist * (16 / 9);
    pC.set(Math.min(tmpV.x - 2.6, leftEdge - 0.6), tmpV.y + 0.75 + 0.2 * Math.random(), zEnd);
    pA.copy(tmpV);
    phase0 = 6.28 * Math.random();
    wingFreq = 0.8 + 0.5 * Math.random();
    buildArc();
    buildBeats(4);
    state = 'out';
    stateDur = 2;
    stateT = 0;
    quatFrom.copy(group.quaternion);
    helper.position.copy(group.position);
    helper.lookAt(tmpV.x - 1, tmpV.y + 0.02, tmpV.z + 0.22);
    helper.rotateX(-0.3);
    quatTo.copy(helper.quaternion);
  }

  function landOn(p: Perch, t: number, speed: number) {
    state = 'perched';
    group.visible = true;
    perchBlend = 1;
    hopLean = 0;
    idle = null;
    peerPitch = 0;
    nextIdleAt = t + 2.5 + 2 * Math.random();
    landAt = t;
    landSettleAt = t;
    leaveAt = t + 12 + 14 * Math.random();
    nextIdleBiasAt(t);
    // the branch takes the weight
    const flex = p.flex;
    const r = Math.max(0.8, Math.min(1.2, speed / 1.4));
    wind.uLand.value.set(p.p[0], p.p[1], p.p[2], t);
    wind.uLandK.value.set((0.006 + 0.01 * flex) * r, 2 * Math.PI * (5 - 1.2 * flex), 6 + 2 * (1 - flex));
    void speed;
  }

  function nextIdleBiasAt(t: number) {
    idleBiasTarget = (Math.random() - 0.5) * 1.2;
    void t;
  }

  /** Where the perch's branch has swayed/springed to right now. */
  function perchOffset(out: THREE.Vector3, t: number, windV: number): THREE.Vector3 {
    const p = perch.current;
    const n = 0.7 * p.p[0] + 0.5 * p.p[2] + 0.3 * p.p[1] - 0.6 * p.flex * wind.uLag.value;
    const s1 = Math.sin(1.05 * t + n);
    const s2 = Math.sin(2.3 * t + 1.6 * n + 1.3);
    const s3 = Math.sin(4.7 * t + 2.9 * n + 4.1) * p.flex * p.flex;
    const amp = windV * p.flex * p.flex * (0.35 + 0.65 * p.flex);
    const u = (0.58 * s1 + 0.24 * s2 + 0.07 * s3) * amp * 0.085;
    const lt = t - wind.uLand.value.w;
    const dx = p.p[0] - wind.uLand.value.x;
    const dy = p.p[1] - wind.uLand.value.y;
    const dz = p.p[2] - wind.uLand.value.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const proxT = Math.min(1, Math.max(0, dist / 0.9));
    const prox = 1 - proxT * proxT * (3 - 2 * proxT);
    const k = wind.uLandK.value;
    const spring = lt > 0 && lt < 3 ? -Math.sin(lt * k.y) * Math.exp(-lt * k.z) * k.x * (0.3 + 0.7 * p.flex) * prox : 0;
    return out.set(0.72 * u, 0.18 * u + (0.45 * s2 + 0.15 * s3) * amp * 0.028 + spring, 0.55 * u);
  }

  /** Position on the perch including sway and hop lean. */
  function perchPos(out: THREE.Vector3, t: number, windV: number) {
    out.fromArray(perch.current.p as number[]);
    if (hopLean && perch.current.along)
      out.addScaledVector(tmpV3.fromArray(perch.current.along as number[]), hopLean);
    return out.add(perchOffset(tmpV2, t, windV));
  }

  // ---- per-frame ---------------------------------------------------------

  let prevPos = new THREE.Vector3();

  function poseFlight(
    obj: THREE.Object3D,
    rig: BirdRig,
    s: number,
    beat: number,
    beatInfo: Beat | null,
    t: number,
  ) {
    const wobble =
      0.022 * Math.sin(1.1 * t * wingFreq + phase0) * beatAmp +
      (state === 'in' ? 0 : 0.0015 * Math.sin(2 * beat * Math.PI - 1.2));
    const i = Math.min(1, Math.max(0, s + wobble));
    pathAt(tmpV, i);
    pathAt(tmpV2, Math.min(1, i + 0.02), beatInfo || undefined);
    obj.position.copy(tmpV);
    if (tmpV2.distanceToSquared(tmpV) > 1e-9) obj.lookAt(tmpV2);
    // bank into the turn
    pathAt(tmpV3, Math.min(1, i + 0.06), beatInfo || undefined);
    tmpV3.sub(tmpV2);
    qTmp.copy(obj.quaternion).invert();
    tmpV3.applyQuaternion(qTmp);
    let bank =
      Math.max(-0.26, Math.min(0.26, -(5 * (tmpV3.lengthSq() > 1e-9 ? Math.atan2(tmpV3.x, tmpV3.z) : 0)))) *
      (1 - foldBlend);
    if (obj === group) bankSmooth += (bank - bankSmooth) * (1 - Math.exp(-6 * 0.016));
    obj.rotateZ((obj === group ? bankSmooth : bank) + (state === 'cross' ? 0.06 : 0.05) * Math.sin(1.4 * t * wingFreq + phase0) * beatAmp);
    const burstPitch = beatInfo ? 0.012 * beatInfo.burst * 0 : 0;
    const phase = ((beat % 1) + 1) % 1;
    obj.rotateX(-burstPitch + 0.025 * Math.sin((phase - 0.23) * 2 * Math.PI) * (1 - perchBlend));
    if (state !== 'in') obj.position.y += 0.0025 * Math.sin(2 * beat * Math.PI - 0.6);
    const shapeAmt = blendClips(rig, perchBlend, beat, beatInfo ? 0.55 * (1 - beatInfo.flapW) * foldBlend : 0);
    if (beatInfo) {
      flapShape(rig, rig.flap.time % 0.52 / 0.52, shapeAmt);
      const b = obj === group ? bankSmooth : bank;
      const f = 1 - foldBlend;
      if (f > 0.001) {
        if (rig.bones.head) rot(rig.bones.head, AXIS_Y, -(0.65 * b) * f);
        if (rig.bones.tail) {
          rot(rig.bones.tail, AXIS_X, -(0.5 * burstPitch) * f);
          rot(rig.bones.tail, AXIS_Z, 0.6 * b * f);
        }
      }
    } else if (rig.bones.head && foldBlend > 0) {
      rot(rig.bones.head, AXIS_X, 0.55 * foldBlend);
    }
  }

  function update(dt: number, t: number, windV: number) {
    if (!ready) return;

    if (state === 'away') {
      if (cueAwayAt && t > cueAwayAt) {
        cueAwayAt = 0;
        startFlyIn();
      } else if (t > nextReturnAt) {
        startCross();
      }
      if (state === 'away') return;
    }

    if (state === 'out' && stateT < 0.42) {
      // lift-off: blend out of the perched pose along the first stretch
      stateT += dt;
      const a = stateT / 0.42;
      perchPos(tmpV, t, windV);
      group.position.copy(tmpV);
      const blend = Math.min(1, a / 0.55);
      group.quaternion.slerpQuaternions(quatFrom, quatTo, blend * blend * (3 - 2 * blend));
      group.position.y += 0.004 + 0.006 * Math.sin(Math.PI * blend) - 0.012 * Math.sin(Math.PI * a);
      group.rotateX(0.1 * Math.sin(Math.PI * a));
      perchBlend = 1 - Math.min(1, Math.max(0, (a - 0.3) / 0.7));
      foldBlend = 0;
      blendClips(rigs[0], perchBlend, 0, 0.23);
      return;
    }

    if (state === 'cross' || state === 'out' || state === 'in') {
      if (state !== 'out' || stateT >= 0.42) stateT += dt;
      const raw = state === 'out' ? stateT - 0.42 : stateT;
      const prog = Math.min(1, raw / stateDur);
      let s = prog;
      if (state === 'out') s = (prog < 0.16 ? 0.15 * prog + (0.425 * prog * prog) / 0.16 : 0.092 + (prog - 0.16)) / 0.932;
      if (state === 'in') {
        const e = prog - 0.7;
        s = (prog < 0.7 ? prog : 0.7 + e - (0.333 * e * e) / 0.3) / 0.9001;
      }
      const flare = state === 'in' ? smooth((prog - 0.76) / 0.24) : 0;
      beatAmp = Math.min(1, raw / 0.6) * (state === 'cross' ? 1 : 0.5 * +(state === 'out')) * (1 - flare);
      foldBlend = state === 'in' ? smooth((prog - 0.66) / 0.24) : 0;
      perchBlend =
        state === 'in'
          ? smooth((prog - 0.55) / 0.35)
          : state === 'out'
            ? 1 - Math.min(1, raw / 0.45)
            : 0;
      const beatInfo = beatAt(raw);
      const beat = beatInfo.beat * (state === 'in' || state === 'out' ? 1 : 1) + raw * 0;
      poseFlight(group, rigs[0], s, beat, beatInfo, raw);

      if (state === 'in' && flare > 0) {
        // settle onto the (moving) perch in the last stretch
        perchPos(lookTarget, t, windV);
        lookTarget.y += 0.004;
        group.position.lerp(lookTarget, flare);
      }
      if (state === 'out') {
        const e = Math.min(1, raw / 0.45);
        group.rotateX(-0.3 * e * (1 - Math.min(1, raw / 0.7)));
        group.position.addScaledVector(perchOffset(tmpV, t, windV), 1 - e);
      }
      const done = prog >= 1;
      const dist = prevPos.distanceTo(group.position) / Math.max(dt, 1e-4);
      prevPos.copy(group.position);
      if (done) {
        if (state === 'in') {
          landOn(perch.current, t, dist);
        } else {
          goAway(t);
          if (flyInQueued) {
            flyInQueued = false;
            cueAwayAt = t + 1.2 + Math.random();
          }
        }
      }
      return;
    }

    // perched
    const iT = idle ? Math.min(1, (t - idle.t0) / idle.dur) : 0;
    if (idle && idle.kind === 'hop') hopLean = idle.a + (idle.b - idle.a) * smooth(iT);
    group.position.copy(perchPos(tmpV, t, windV));
    group.position.y += 0.004;
    {
      // the landing bounce rides the branch for a moment
      const e = t - landSettleAt;
      if (e > 0 && e < 1) group.position.y -= 0.004 * Math.sin(17 * e) * Math.exp(-7 * e);
    }
    lookTarget.fromArray(perch.current.p as number[]);
    if (hopLean && perch.current.along)
      lookTarget.addScaledVector(tmpV3.fromArray(perch.current.along as number[]), hopLean);
    lookTarget.add(perchOffset(tmpV2, t, windV));
    lookTarget.x -= 1;
    lookTarget.y += 0.02;
    lookTarget.z += 0.22;
    group.lookAt(lookTarget);
    group.rotateX(-0.3);

    const sinceLand = t - landAt;
    if (sinceLand >= 0 && sinceLand < 0.4) {
      const e = smooth(sinceLand / 0.4);
      group.quaternion.slerpQuaternions(quatTo, group.quaternion, e);
    }
    foldBlend = 1 - smooth(sinceLand / 0.5);
    perchBlend = 1;
    blendClips(rigs[0], smooth(sinceLand / 0.28), 0, smooth((sinceLand - 0.18) / 0.32));

    // idle bias drift
    idleBias += (idleBiasTarget - idleBias) * (1 - Math.exp(-8 * dt));
    group.rotateY(0.04 * idleBias);

    if (idle) {
      const bones = rigs[0].bones;
      if (idle.kind === 'tail' && bones.tail) rot(bones.tail, AXIS_X, idle.a * Math.sin(iT * Math.PI));
      else if (idle.kind === 'shuffle') {
        group.rotateY(idle.a * Math.sin(2 * iT * Math.PI) * (1 - iT));
        group.position.y -= 0.003 * Math.sin(iT * Math.PI);
      } else if (idle.kind === 'peer') {
        peerPitch = idle.a * smooth(iT / 0.2) * smooth((1 - iT) / 0.25);
      } else if (idle.kind === 'hop') {
        group.position.y += 0.022 * Math.sin(iT * Math.PI);
        group.rotateX(-0.22 * Math.sin(iT * Math.PI));
      }
      if (iT >= 1) {
        if (idle.kind === 'hop') landSettleAt = t;
        peerPitch = 0;
        idle = null;
      }
    } else if (t > nextIdleAt && t > landSettleAt + 1.2 && t < leaveAt - 0.8) {
      const pick = Math.random();
      const kind =
        pick < 0.32 ? 'tail' : pick < 0.55 ? 'shuffle' : pick < 0.82 ? 'peer' : perch.current.along ? 'hop' : 'shuffle';
      idle = {
        kind,
        t0: t,
        dur: kind === 'tail' ? 0.26 : kind === 'shuffle' ? 0.42 : kind === 'peer' ? 1.6 : 0.34,
        a: 0,
        b: 0,
      };
      if (kind === 'hop') {
        const step = (0.025 + 0.02 * Math.random()) * (hopLean > 0.01 ? -1 : hopLean < -0.01 ? 1 : Math.random() < 0.5 ? -1 : 1);
        idle.a = hopLean;
        idle.b = hopLean + step;
      } else if (kind === 'peer') {
        idle.a = Math.random() < 0.6 ? 0.26 : -0.2;
      } else if (kind === 'shuffle') {
        idle.a = (Math.random() - 0.5) * 0.3;
      } else {
        idle.a = 0.3 + 0.15 * Math.random();
      }
      nextIdleAt = t + idle.dur + 2 + 4.5 * Math.random();
    }

    // head tracking: watch the pointer
    {
      const bones = rigs[0].bones;
      const head = bones.head;
      if (head) {
        let yaw = 0;
        if (pointerX >= 0 && !view.portrait) {
          tmpV
            .set((pointerX / view.w) * 2 - 1, -((pointerY / view.h) * 2 - 1), 0.5)
            .unproject(camera)
            .sub(camera.position)
            .normalize()
            .multiplyScalar(group.position.distanceTo(camera.position))
            .add(camera.position);
          group.worldToLocal(tmpV);
          head.getWorldPosition(tmpV2);
          group.worldToLocal(tmpV2);
          tmpV.sub(tmpV2);
          yaw = Math.max(-0.3, Math.min(0.3, 0.6 * Math.atan2(tmpV.x, tmpV.z)));
        }
        yaw += 0.5 * idleBias;
        const k = 1 - Math.exp(-3.2 * dt);
        headYaw += (yaw - headYaw) * k;
        headPitch += (peerPitch - headPitch) * k;
        rot(head, AXIS_Z, -(0.85 * headYaw));
        if (headPitch) rot(head, AXIS_X, headPitch);
      }
    }

    if (t > leaveAt) startTakeOff();
  }

  // ---- loading -----------------------------------------------------------

  new GLTFLoader().load(opts.url, (gltf) => {
    const clips = gltf.animations;
    const sceneRoot = gltf.scene;
    sceneRoot.scale.setScalar(1.1 * opts.portraitScale());

    // Mesh touch-ups from the hero: a rounder body, a tidier tail.
    const CENTER = new THREE.Vector3(0, 0.085, 0.545);
    const rel = new THREE.Vector3();
    sceneRoot.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const skinIndex = mesh.geometry.attributes.skinIndex as THREE.BufferAttribute;
      const skinWeight = mesh.geometry.attributes.skinWeight as THREE.BufferAttribute;
      const boneNames = mesh.skeleton.bones.map((b) => b.name);
      for (let i = 0; i < pos.count; i++) {
        let best = 0;
        let bestW = -1;
        for (let k = 0; k < 4; k++) {
          const w = skinWeight.getComponent(i, k);
          if (w > bestW) {
            bestW = w;
            best = skinIndex.getComponent(i, k);
          }
        }
        const bone = boneNames[best];
        tmpV.fromBufferAttribute(pos, i);
        if (bone === 'body' || bone === 'head') {
          const e = (tmpV.z - 0.06) / (tmpV.z < 0.06 ? 0.52 : 1);
          const s = Math.sqrt(Math.max(0.2, 1 - e * e));
          tmpV.x *= s;
          tmpV.y = 0.04 + (tmpV.y - 0.04) * s;
          const beak = 0.55 * smooth((tmpV.z - 0.38) / 0.14);
          const isBeak = tmpV.z > 0.64 && Math.abs(tmpV.x) < 0.08 && tmpV.y > 0.05 && tmpV.y < 0.17;
          if (beak > 0 && !isBeak) {
            rel.copy(tmpV).sub(CENTER);
            const l = rel.length() || 1;
            tmpV.lerp(rel.multiplyScalar(0.195 / l).add(CENTER), beak);
          }
        } else if (bone === 'tail') {
          const e = Math.max(0, (-0.218 - tmpV.z) / 0.544);
          tmpV.z = -0.218 + (tmpV.z - -0.218) * 0.85;
          tmpV.x *= 1 + (1.35 - 1) * e;
        }
        pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
      }
      pos.needsUpdate = true;
      const g = mesh.geometry;
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(3 * pos.count), 3));
      g.computeVertexNormals();
      const nrm = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < nrm.count; i++)
        if (Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) < 0.5) nrm.setXYZ(i, 0, 1, 0);
      g.computeBoundingSphere();
    });

    // Wrist graft: the GLB has no wrist bones, so one is derived per wing
    // from the skin weights and re-bound, giving the flap shape a fold point.
    {
      const bySkeleton = new Map<THREE.Skeleton, THREE.SkinnedMesh[]>();
      sceneRoot.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) {
          if (!bySkeleton.has(m.skeleton)) bySkeleton.set(m.skeleton, []);
          bySkeleton.get(m.skeleton)!.push(m);
        }
      });
      const mA = new THREE.Matrix4();
      const mB = new THREE.Matrix4();
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();
      for (const [skeleton, meshes] of bySkeleton) {
        const bones = skeleton.bones.slice();
        const inverses = skeleton.boneInverses.map((m) => m.clone());
        const slots = meshes.map((m) => ({
          mesh: m,
          geo: m.geometry,
          slotOf: new Int8Array(m.geometry.attributes.position.count),
          dist: new Float32Array(m.geometry.attributes.position.count),
        }));
        for (const side of ['L', 'R']) {
          const wi = bones.findIndex((b) => b.name === 'wing' + side);
          if (wi < 0) continue;
          mA.copy(inverses[wi]).invert();
          vA.setFromMatrixPosition(mA);
          let maxD = 0;
          vB.copy(vA);
          for (const s of slots) {
            const pos = s.geo.attributes.position as THREE.BufferAttribute;
            const si = s.geo.attributes.skinIndex as THREE.BufferAttribute;
            const sw = s.geo.attributes.skinWeight as THREE.BufferAttribute;
            mB.copy(s.mesh.bindMatrix);
            for (let i = 0; i < pos.count; i++) {
              let slot = -1;
              for (let k = 0; k < 4; k++)
                if (si.getComponent(i, k) === wi && sw.getComponent(i, k) > 0) slot = k;
              s.slotOf[i] = slot;
              if (slot < 0) continue;
              const d = (s.dist[i] = vC.fromBufferAttribute(pos, i).applyMatrix4(mB).distanceTo(vA));
              if (sw.getComponent(i, slot) >= 0.5 && d > maxD) {
                maxD = d;
                vB.copy(vC);
              }
            }
          }
          if (maxD < 1e-4) continue;
          const wrist = new THREE.Bone();
          wrist.name = 'wrist' + side;
          wrist.position.copy(vC.copy(vA).lerp(vB, 0.5).applyMatrix4(inverses[wi]));
          bones[wi].add(wrist);
          bones[wi].updateMatrixWorld(true);
          bones.push(wrist);
          inverses.push(mA.multiply(wrist.matrix).clone().invert());
          const newIdx = bones.length - 1;
          for (const s of slots) {
            const si = s.geo.attributes.skinIndex as THREE.BufferAttribute;
            const sw = s.geo.attributes.skinWeight as THREE.BufferAttribute;
            for (let i = 0; i < s.slotOf.length; i++) {
              const slot = s.slotOf[i];
              if (slot < 0) continue;
              const w = smooth((s.dist[i] / maxD - 0.39) / 0.22);
              if (w <= 0) continue;
              const cur = sw.getComponent(i, slot);
              let free = -1;
              for (let k = 0; k < 4; k++)
                if (k !== slot && sw.getComponent(i, k) === 0) {
                  free = k;
                  break;
                }
              if (free < 0) {
                if (w > 0.5) si.setComponent(i, slot, newIdx);
                continue;
              }
              si.setComponent(i, slot, cur * (1 - w));
              si.setComponent(i, free, newIdx);
              sw.setComponent(i, slot, cur * (1 - w));
              sw.setComponent(i, free, cur * w);
            }
            si.needsUpdate = true;
            sw.needsUpdate = true;
          }
        }
        const newSkeleton = new THREE.Skeleton(bones, inverses);
        for (const m of meshes) m.bind(newSkeleton, m.bindMatrix);
      }
    }

    group.add(sceneRoot);
    rigs.push(rigify(sceneRoot, clips, 1));

    // ghost companions for flock crossings (kept hidden; the hero spawned
    // them for a later feature and never shows more than the lead bird)
    for (const _ of [0.3, 0.14, 0.06]) {
      const g = new THREE.Group();
      const clone = sceneRoot.clone(true);
      // share nothing that would animate twice; companions are inert here
      g.add(clone);
      g.visible = false;
      flocks.push(g);
    }

    group.visible = false;
    ready = true;
    nextReturnAt = 1.5 + Math.random() * 2;
    opts.onReady?.();
  });

  return {
    group,
    get ready() {
      return ready;
    },
    materials,
    update,
    perchOffset,
    setPerch(p: Perch) {
      perch.current = p;
    },
    setPointer(x: number, y: number) {
      pointerX = x;
      pointerY = y;
    },
    cue() {
      if (state === 'perched') startTakeOff();
      else if (state === 'away') startFlyIn();
    },
    screenPos() {
      if (!group.visible) return null;
      tmpV.copy(group.position);
      tmpV.y += 0.045;
      tmpV.project(camera);
      return [((tmpV.x + 1) / 2) * view.w, ((1 - tmpV.y) / 2) * view.h];
    },
    state: () => state,
  };
}

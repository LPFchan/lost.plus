// The hero scene: sky, moon, clouds, procedural trees with wind, a tit that
// flies in and lands, and the lens post pipeline — ported from the Anthropic
// Fable 5.1 launch page and re-driven by the actual sun over Seoul (KST)
// instead of the page's three time-of-day swatches.
//
// The composited frame is rendered to an offscreen target, then blitted into
// the caller's GL state (Backdrops's single canvas), so the dock glass can
// refract the scene the same way it used to refract the mesh gradient:
// same canvas, same frame, no drift.

import * as THREE from 'three';
import { generate, type TreeGeometry, type TreeParams } from './tree';
import {
  makeFrondAtlas,
  makeOvalAtlas,
  buildCanopyLeaves,
  buildOvalLeaves,
} from './leaves';
import { makeSkyUniforms, makeSkyDome, makeMoon, makeCloudDome } from './sky';
import {
  makeWindUniforms,
  makeBarkMaterial,
  makeLeafMaterial,
} from './foliage';
import { makePostPipeline, type PostPipeline } from './post';
import { loadBird, type Perch } from './bird';
import { sunOverSeoul, lookMix, sunSceneDir } from './solar';

// Reach under three to the raw GL texture: Backdrop shares the GL context
// and binds this directly. Private API, stable across three versions.
declare module 'three' {
  interface Texture {
    __webglTexture?: WebGLTexture;
  }
}

export type HeroHandle = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  post: PostPipeline;
  finalRT: THREE.WebGLRenderTarget;
  /** render one frame into finalRT */
  renderFrame(dt: number, elapsed: number, pointer: [number, number]): void;
  resize(w: number, h: number, dpr: number): void;
  /** whether the scene is in its dark phase (drives the page theme) */
  isDark(): boolean;
  dispose(): void;
  // debug/inspection handle to the shared sky uniforms
  skyU: ReturnType<typeof makeSkyUniforms>;
  bird: ReturnType<typeof loadBird>;
};

// The four time-of-day looks, from the hero's own constants.
const LOOKS = {
  day: {
    zenith: new THREE.Color('#6180c3'),
    horizon: new THREE.Color('#6483c6'),
    glow: new THREE.Color('#ffe9c4'),
    sunCol: new THREE.Color('#fff3dc'),
    sunInt: 2.4,
    hemiSky: new THREE.Color('#bcd6f7'),
    hemiGround: new THREE.Color('#6e6252'),
    hemiInt: 1.1,
    leafSun: new THREE.Color('#fff3dc').multiplyScalar(1.7),
    leafSky: new THREE.Color('#b8c9dc').multiplyScalar(0.64),
    leafGround: new THREE.Color('#6b7355').multiplyScalar(0.6),
  },
  dusk: {
    zenith: new THREE.Color('#4a6cab'),
    horizon: new THREE.Color('#e59558'),
    glow: new THREE.Color('#ffb871'),
    sunCol: new THREE.Color('#f3c9a4'),
    sunInt: 1.35,
    hemiSky: new THREE.Color('#c3adb0'),
    hemiGround: new THREE.Color('#5a4a44'),
    hemiInt: 0.75,
    leafSun: new THREE.Color('#ffc188').multiplyScalar(1.7),
    leafSky: new THREE.Color('#b9a9b4').multiplyScalar(0.55),
    leafGround: new THREE.Color('#5a4a44').multiplyScalar(0.5),
  },
  night: {
    zenith: new THREE.Color('#030818'),
    horizon: new THREE.Color('#0a1631'),
    glow: new THREE.Color('#9fb0d4'),
    sunCol: new THREE.Color('#9fb3d8'),
    sunInt: 0.1,
    hemiSky: new THREE.Color('#182a4a'),
    hemiGround: new THREE.Color('#070b14'),
    hemiInt: 0.08,
    leafSun: new THREE.Color('#b4c6e6').multiplyScalar(0.45),
    leafSky: new THREE.Color('#3a5a8c').multiplyScalar(0.16),
    leafGround: new THREE.Color('#1a2436').multiplyScalar(0.12),
  },
  morning: {
    zenith: new THREE.Color('#5f7aa4'),
    horizon: new THREE.Color('#a29aa6'),
    glow: new THREE.Color('#e8bcae'),
    sunCol: new THREE.Color('#ffd8b8'),
    sunInt: 2.2,
    hemiSky: new THREE.Color('#d8dcea'),
    hemiGround: new THREE.Color('#a08c84'),
    hemiInt: 1.7,
    leafSun: new THREE.Color('#ffe4b4').multiplyScalar(1.6),
    leafSky: new THREE.Color('#d0dcea').multiplyScalar(0.7),
    leafGround: new THREE.Color('#7c8462').multiplyScalar(0.62),
  },
};

// The hero's four tree sites (its frame is a 21-degree lens; these sit just
// inside the lower corners).
const TREE_SITES: TreeParams[] = [
  { origin: [-1.35, -1.6, -2.55], rootDir: [0.62, 1, 0.08], trunkLen: 2, trunkRadius: 0.017 },
  { origin: [1.4, -1.78, -2.8], rootDir: [-0.5, 1, -0.02], trunkLen: 2.1, trunkRadius: 0.019 },
  { origin: [0.35, -1.9, -3.15], rootDir: [0.22, 1, 0.25], trunkLen: 1.7, trunkRadius: 0.015 },
  {
    origin: [1.75, -0.15, -2.3],
    rootDir: [-1, 0.3, 0.08],
    trunkLen: 1.9,
    trunkRadius: 0.034,
    leafDensity: 0.5,
    childrenByDepth: [4, 3, 2],
  },
];
const TREE_DEFAULTS = {
  segLen: 0.06,
  wobble: 0.36,
  maxDepth: 3,
  childrenByDepth: [6, 4, 2],
  radialByDepth: [16, 12, 9, 7],
  childAngle: [0.55, 1] as [number, number],
  leafDensity: 0.95,
  twigLift: 0.05,
  tipLift: 0.1,
  barkDark: [1.18, 1.06, 1.04] as [number, number, number],
  barkLight: [1.66, 1.54, 1.5] as [number, number, number],
};
const TREE_SEEDS = [0x326eb8d5, 0x794e9d91, 0x0c2ed8dc, 0x371915ac];

function mix4(
  out: THREE.Color,
  a: THREE.Color,
  b: THREE.Color,
  c: THREE.Color,
  d: THREE.Color,
  wb: number,
  wc: number,
  wd: number,
) {
  const wa = 1 - wb - wc - wd;
  out.setRGB(
    a.r * wa + b.r * wb + c.r * wc + d.r * wd,
    a.g * wa + b.g * wb + c.g * wc + d.g * wd,
    a.b * wa + b.b * wb + c.b * wc + d.b * wd,
  );
}

export function createHero(
  context: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  opts: { assets?: string; seed?: number } = {},
): HeroHandle {
  const assets = opts.assets ?? '/fx/hero/';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = true;
  // Backdrop owns the canvas and the GL state from here on; three's cached
  // state (bound textures, current program, viewport) goes stale every time
  // the lens pass runs, so never trust it across frames.
  renderer.state.reset();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(21, 1, 0.1, 700);
  camera.position.set(0, 0, 0);
  const lookTarget = new THREE.Vector3(0, 0.55, -3);
  camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
  const baseQuat = camera.quaternion.clone();

  const skyU = makeSkyUniforms();
  const windU = makeWindUniforms();
  const moonPos = new THREE.Vector3(48, 74, -268);

  const skyDome = makeSkyDome(skyU);
  scene.add(skyDome);
  const moon = makeMoon(skyU, moonPos);
  scene.add(moon);
  const cloudDome = makeCloudDome(skyU);
  // clouds render into their own scene so they composite over the sky in post
  const cloudScene = new THREE.Scene();
  cloudScene.add(cloudDome);

  const sunLight = new THREE.DirectionalLight(LOOKS.day.sunCol, 2.4);
  sunLight.position.copy(skyU.uSunDir.value).multiplyScalar(10);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(LOOKS.day.hemiSky, LOOKS.day.hemiGround, 1.1);
  scene.add(hemi);

  // ---- foliage -----------------------------------------------------------

  const texLoader = new THREE.TextureLoader();
  const tex = (name: string, srgb: boolean) => {
    const t = texLoader.load(assets + name);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 2;
    return t;
  };
  const barkDiff = tex('bark_diff.webp', true);
  const barkNorm = tex('bark_nor.webp', false);
  const barkMat = makeBarkMaterial(windU, barkDiff, barkNorm);

  const frondAtlas = makeFrondAtlas();
  const ovalAtlas = makeOvalAtlas();
  const leafMat = makeLeafMaterial(
    windU,
    frondAtlas,
    { uNight: skyU.uNight, uDusk: skyU.uDusk },
    skyU.uSunDir,
  );
  const ovalLeafMat = makeLeafMaterial(
    windU,
    ovalAtlas,
    { uNight: skyU.uNight, uDusk: skyU.uDusk },
    skyU.uSunDir,
  );

  const seed = opts.seed ?? TREE_SEEDS[0];
  const trees: TreeGeometry[] = TREE_SITES.map((site, i) =>
    generate(seed + 101 * i, { ...TREE_DEFAULTS, ...site, maxDepth: 4, leafOuterDepth: 2 }),
  );

  // merge the four trees into one bark mesh
  let vertTotal = 0;
  let idxTotal = 0;
  for (const t of trees) {
    vertTotal += t.positions.length / 3;
    idxTotal += t.indices.length;
  }
  const barkGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(vertTotal * 3);
    const nor = new Float32Array(vertTotal * 3);
    const col = new Float32Array(vertTotal * 3);
    const flx = new Float32Array(vertTotal);
    const uv = new Float32Array(vertTotal * 2);
    const idx = new (vertTotal > 65535 ? Uint32Array : Uint16Array)(idxTotal);
    let vo = 0;
    let io = 0;
    for (const t of trees) {
      pos.set(t.positions, vo * 3);
      nor.set(t.normals, vo * 3);
      col.set(t.colors, vo * 3);
      flx.set(t.flex, vo);
      uv.set(t.uvs, vo * 2);
      for (let i = 0; i < t.indices.length; i++) idx[io + i] = t.indices[i] + vo;
      vo += t.positions.length / 3;
      io += t.indices.length;
    }
    barkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    barkGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    barkGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    barkGeo.setAttribute('aFlex', new THREE.BufferAttribute(flx, 1));
    barkGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    barkGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const barkMesh = new THREE.Mesh(barkGeo, barkMat);
  barkMesh.frustumCulled = false;
  scene.add(barkMesh);

  const allAnchors = trees.flatMap((t) => t.anchors);
  const canopy = buildCanopyLeaves(allAnchors, seed);
  const canopyMesh = new THREE.Mesh(canopy.geometry, leafMat.material);
  canopyMesh.frustumCulled = false;
  scene.add(canopyMesh);
  const ovals = buildOvalLeaves(allAnchors, seed);
  const ovalMesh = new THREE.Mesh(ovals.geometry, ovalLeafMat.material);
  ovalMesh.frustumCulled = false;
  scene.add(ovalMesh);

  // ---- bird --------------------------------------------------------------

  const view = {
    w: 1,
    h: 1,
    portrait: false,
    min: -1,
    max: 1,
    cy: 0,
    zoom: 1,
  };
  const bird = loadBird({
    url: assets + 'tit.glb',
    textures: {
      map: (() => {
        const t = texLoader.load(assets + 'tit_diff.webp');
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        t.anisotropy = 4;
        return t;
      })(),
      normal: (() => {
        const t = texLoader.load(assets + 'tit_norm.webp');
        t.flipY = false;
        t.anisotropy = 4;
        return t;
      })(),
      rough: (() => {
        const t = texLoader.load(assets + 'tit_rgh.webp');
        t.flipY = false;
        t.anisotropy = 4;
        return t;
      })(),
    },
    camera,
    view,
    wind: windU,
    portraitScale: () => (view.portrait ? 0.82 : 1),
  });
  scene.add(bird.group);

  // pick the bird's perch from the generated perches: the one closest to
  // frame centre among sturdy, reachable branches (a simplified take on the
  // hero's perch scoring)
  {
    let best: Perch | null = null;
    let bestScore = Infinity;
    for (const t of trees)
      for (const p of t.perches) {
        if (p.r < 0.0035 || p.t > 0.85) continue;
        if (Math.abs(p.along[1]) > 0.7) continue;
        const depth = -p.c[2];
        if (depth < 1.7 || depth > 4.2) continue;
        const score =
          p.c[0] * p.c[0] +
          (p.c[1] - 0.3) * (p.c[1] - 0.3) +
          (p.c[2] + 2.6) * (p.c[2] + 2.6) +
          2 * Math.max(0, 0.007 - p.r);
        if (score < bestScore) {
          bestScore = score;
          const along = p.along;
          const side: [number, number, number] = [
            -along[0] * along[1],
            1 - along[1] * along[1],
            -along[2] * along[1],
          ];
          const l = Math.hypot(side[0], side[1], side[2]) || 1;
          const lift = 0.92 * p.r - 0.0025;
          best = {
            p: [p.c[0] + (side[0] / l) * lift, p.c[1] + (side[1] / l) * lift, p.c[2] + (side[2] / l) * lift],
            flex: p.flex,
            along: [...along],
            r: p.r,
          };
        }
      }
    if (best) bird.setPerch(best);
  }

  // ---- post ----------------------------------------------------------------

  let W = 2;
  let H = 2;
  const post = makePostPipeline(2, 2, {
    uTime: skyU.uTime,
    uNight: skyU.uNight,
    uDusk: skyU.uDusk,
  });
  const finalRT = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });

  const skyScene = new THREE.Scene();
  skyScene.add(skyDome);
  skyScene.add(moon);

  // ---- palette + per-frame state --------------------------------------------

  const tmpColor = new THREE.Color();
  const sway = { x: 0, y: 0 };
  const look = { day: 1, dusk: 0, night: 0, morning: 0 };
  let dark = false;

  function applyLook() {
    const { day, dusk, night, morning } = look;
    mix4(skyU.uZenith.value, LOOKS.day.zenith, LOOKS.dusk.zenith, LOOKS.night.zenith, LOOKS.morning.zenith, dusk, night, morning);
    mix4(skyU.uHorizon.value, LOOKS.day.horizon, LOOKS.dusk.horizon, LOOKS.night.horizon, LOOKS.morning.horizon, dusk, night, morning);
    mix4(skyU.uSunGlow.value, LOOKS.day.glow, LOOKS.dusk.glow, LOOKS.night.glow, LOOKS.morning.glow, dusk, night, morning);
    mix4(sunLight.color, LOOKS.day.sunCol, LOOKS.dusk.sunCol, LOOKS.night.sunCol, LOOKS.morning.sunCol, dusk, night, morning);
    sunLight.intensity =
      LOOKS.day.sunInt * day + LOOKS.dusk.sunInt * dusk + LOOKS.night.sunInt * night + LOOKS.morning.sunInt * morning;
    mix4(hemi.color, LOOKS.day.hemiSky, LOOKS.dusk.hemiSky, LOOKS.night.hemiSky, LOOKS.morning.hemiSky, dusk, night, morning);
    mix4(hemi.groundColor, LOOKS.day.hemiGround, LOOKS.dusk.hemiGround, LOOKS.night.hemiGround, LOOKS.morning.hemiGround, dusk, night, morning);
    hemi.intensity =
      LOOKS.day.hemiInt * day + LOOKS.dusk.hemiInt * dusk + LOOKS.night.hemiInt * night + LOOKS.morning.hemiInt * morning;
    for (const lm of [leafMat, ovalLeafMat]) {
      mix4(lm.uniforms.uSunCol.value, LOOKS.day.leafSun, LOOKS.dusk.leafSun, LOOKS.night.leafSun, LOOKS.morning.leafSun, dusk, night, morning);
      mix4(lm.uniforms.uSkyCol.value, LOOKS.day.leafSky, LOOKS.dusk.leafSky, LOOKS.night.leafSky, LOOKS.morning.leafSky, dusk, night, morning);
      mix4(lm.uniforms.uGroundCol.value, LOOKS.day.leafGround, LOOKS.dusk.leafGround, LOOKS.night.leafGround, LOOKS.morning.leafGround, dusk, night, morning);
    }
    // the bird's feathers keep a faint self-light so it never goes black
    for (const m of bird.materials) {
      m.emissiveIntensity = 0.12 * (1 - 0.88 * night) + 0.05 * dusk + 0.02 * morning;
      m.color.setRGB(
        1 - 0.4 * night + 0.06 * dusk + 0.03 * morning,
        1 - 0.34 * night - 0.06 * dusk,
        1 - 0.16 * night - 0.2 * dusk - 0.05 * morning,
      );
    }
    dark = night > 0.55;
  }

  function updateSolar() {
    // ?sun=<hour> pins the clock for testing; ?cloud=<0..1> pins coverage.
    const q = new URLSearchParams(location.search);
    let date: Date | undefined;
    if (q.has('sun')) {
      const h = parseFloat(q.get('sun') || '12');
      date = new Date();
      const kstNow = new Date(
        date.getTime() + (9 * 60 + date.getTimezoneOffset()) * 60000,
      );
      date = new Date(
        Date.UTC(
          kstNow.getFullYear(),
          kstNow.getMonth(),
          kstNow.getDate(),
          h - 9,
          (h % 1) * 60,
        ),
      );
    }
    const sun = sunOverSeoul(date);
    const target = lookMix(sun);
    // fast enough to track a clock jump, slow enough that the mix eases
    look.day = target.day;
    look.dusk = target.dusk;
    look.night = target.night;
    look.morning = target.morning;
    skyU.uNight.value = target.night;
    skyU.uDusk.value = target.dusk;
    skyU.uMorn.value = target.morning;
    if (q.has('cloud')) skyU.uClouds.value = parseFloat(q.get('cloud') || '0.8');
    const { dir, above } = sunSceneDir(sun);
    const mx = 0.18 * (1 - above) + dir[0] * above;
    const my = 0.74 * (1 - above) + dir[1] * above;
    const mz = -0.94;
    tmpColor.setRGB(mx, my, mz);
    skyU.uSunDir.value.set(tmpColor.r, tmpColor.g, tmpColor.b).normalize();
    skyU.uMoonDir.value.copy(moonPos).normalize();
    sunLight.position.copy(skyU.uSunDir.value).multiplyScalar(10);
    applyLook();
  }

  function resize(w: number, h: number, dpr: number) {
    W = Math.max(2, Math.round(w * dpr));
    H = Math.max(2, Math.round(h * dpr));
    view.w = w;
    view.h = h;
    view.portrait = w / h < 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(W, H);
    finalRT.setSize(W, H);
    const cloudMat = cloudDome.material as THREE.ShaderMaterial;
    cloudMat.uniforms.uRes.value.set(W, H);
  }

  const clock = { t: 0 };

  function renderFrame(dt: number, elapsed: number, pointer: [number, number]) {
    // The lens pass ran since our last frame: three's GL state cache no
    // longer matches reality. Reset it, or draws silently land nowhere.
    renderer.state.reset();
    clock.t += Math.min(dt, 0.1);
    const t = clock.t;
    skyU.uTime.value = t;
    windU.uTime.value = t;
    if (!reduced) skyU.uCloudT.value += Math.min(dt, 0.05);

    // wind: slow breathing around a base breeze
    windU.uWind.value = 0.42 * (0.62 + 0.28 * Math.sin(0.21 * t) + 0.1 * Math.sin(0.57 * t + 1.7));

    updateSolar();

    // pointer parallax: the camera sways a few pixels' worth
    sway.x += (pointer[0] - sway.x) * (1 - Math.exp(-3 * dt));
    sway.y += (pointer[1] - sway.y) * (1 - Math.exp(-3 * dt));
    const i = reduced ? 0 : 1;
    const yaw = (0.55 * Math.sin(0.062 * t) + 0.3 * Math.sin(0.151 * t + 2.1)) * 0.0022 * i - 0.0045 * sway.x * i;
    const pitch = (0.5 * Math.sin(0.083 * t + 1.2) + 0.3 * Math.sin(0.19 * t)) * 0.0018 * i - 0.00275 * sway.y * i;
    const e = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.copy(baseQuat).multiply(new THREE.Quaternion().setFromEuler(e));

    bird.setPointer(
      ((pointer[0] + 1) / 2) * view.w,
      ((pointer[1] + 1) / 2) * view.h,
    );
    bird.update(Math.min(dt, 0.05), t, windU.uWind.value);

    // Rack focus, as on the original. The composite's DoF mix is
    // smoothstep(0.25, 1.4, radius), so the radii have to stay in the few-px
    // band where blurred and sharp cross-dissolve; push them near uMaxCoC
    // (which is ~16px at this height) and the leaves snap fully onto the
    // half-res blur target and back, which is the seam. Keep the swing gentle
    // and low so the bokeh reads as a soft focus pull, not a mode switch.
    {
      const focus = 0.5 + 0.5 * Math.sin(t * 0.09); // 0 = sky, 1 = foliage
      const eased = focus * focus * (3 - 2 * focus);
      post.blurMat.uniforms.uFgBlur.value = 0.9 + (1 - eased) * 1.4;
      post.blurMat.uniforms.uBgBlur.value = 0.35 + eased * 0.9;
    }

    // ---- the post chain, exactly as the hero's aP() ------------------------
    renderer.setRenderTarget(post.skyRT);
    renderer.setClearColor(0x000000, 1);
    renderer.render(skyScene, camera);

    if (skyU.uClouds.value > 0.001) {
      renderer.setRenderTarget(post.cloudRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(cloudScene, camera);
      post.copyMat.uniforms.tSrc.value = post.cloudRT.texture;
      post.quad.material = post.copyMat;
      renderer.setRenderTarget(post.skyRT);
      renderer.autoClear = false;
      renderer.render(post.quadScene, post.quadCam);
      renderer.autoClear = true;
    }

    renderer.setRenderTarget(post.foliageRT);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    // foreground (foliage) blur
    post.quad.material = post.blurMat;
    post.blurMat.uniforms.tSrc.value = post.foliageRT.texture;
    post.blurMat.uniforms.uRadNow.value = post.blurMat.uniforms.uFgBlur.value;
    renderer.setRenderTarget(post.foliageBlurRT);
    renderer.render(post.quadScene, post.quadCam);

    // background (sky) blur
    post.blurMat.uniforms.tSrc.value = post.skyRT.texture;
    post.blurMat.uniforms.uRadNow.value = post.blurMat.uniforms.uBgBlur.value;
    renderer.setRenderTarget(post.skyBlurRT);
    renderer.render(post.quadScene, post.quadCam);

    // composite
    post.compMat.uniforms.tFol.value = post.foliageRT.texture;
    post.compMat.uniforms.tFolB.value = post.foliageBlurRT.texture;
    post.compMat.uniforms.tSky.value = post.skyRT.texture;
    post.compMat.uniforms.tSkyB.value = post.skyBlurRT.texture;
    post.compMat.uniforms.uGrainT.value = reduced ? 0.37 : elapsed % 1;
    post.quad.material = post.compMat;
    renderer.setRenderTarget(finalRT);
    renderer.render(post.quadScene, post.quadCam);
    renderer.setRenderTarget(null);
  }

  return {
    renderer,
    camera,
    post,
    finalRT,
    skyU,
    bird,
    renderFrame,
    resize,
    isDark: () => dark,
    dispose() {
      renderer.setRenderTarget(null);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) {
          for (const k in mat) {
            const v = (mat as unknown as Record<string, unknown>)[k];
            if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
          }
          mat.dispose();
        }
      });
      for (const t of [skyDome, moon, cloudDome]) {
        t.geometry.dispose();
        (t.material as THREE.Material).dispose();
      }
      post.dispose();
      finalRT.dispose();
      frondAtlas.dispose();
      ovalAtlas.dispose();
      barkDiff.dispose();
      barkNorm.dispose();
      renderer.dispose();
    },
  };
}

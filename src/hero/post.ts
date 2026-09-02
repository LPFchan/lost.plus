// The Fable hero's post pipeline: the scene renders in two halves (sky and
// foliage), each gets a separable radial bokeh blur at half resolution, and
// a composite pass fuses them with depth-of-field weights, wrap light over
// silhouettes, ACES grading and film grain. This is what makes the scene
// read as shot through a lens rather than rendered.

import * as THREE from 'three';

const fsGuard = /* glsl */ `
  vec4 finite4(vec4 v) {
    uvec4 b = floatBitsToUint(v);
    uvec4 keep = (uvec4(1u) - uvec4(equal(b & uvec4(0x7F800000u), uvec4(0x7F800000u)))) * uvec4(0xFFFFFFFFu);
    return uintBitsToFloat(b & keep);
  }
`;

const hash12 = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Spiral-tap radial blur; the tap pattern is generated once at build. */
function blurTaps(): string {
  let out = '';
  const ring = (n: number, r: number, a0: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + a0;
      const x = (Math.cos(a) * r).toFixed(4);
      const y = (Math.sin(a) * r).toFixed(4);
      out += `{
        vec2 uv2 = vUv + (ROT * vec2(${x}, ${y})) * uRadNow * uTexel;
        vec4 s = texture2D(tSrc, uv2);
        s.rgb *= 1.0 + smoothstep(1.15, 2.6, dot(s.rgb, vec3(0.3333))) * 0.7;
        accum += vec4(s.rgb * s.a, s.a);
      }\n`;
    }
  };
  ring(1, 0, 0);
  ring(5, 0.16, 0.7);
  ring(8, 0.38, 0.3);
  ring(10, 0.55, 0.5);
  ring(12, 0.72, 0);
  ring(20, 0.87, 0.4);
  ring(16, 1, 0.15);
  return out;
}

export type PostPipeline = {
  skyRT: THREE.WebGLRenderTarget;
  skyBlurRT: THREE.WebGLRenderTarget;
  foliageRT: THREE.WebGLRenderTarget;
  foliageBlurRT: THREE.WebGLRenderTarget;
  cloudRT: THREE.WebGLRenderTarget;
  blurMat: THREE.ShaderMaterial;
  compMat: THREE.ShaderMaterial;
  quadScene: THREE.Scene;
  quadCam: THREE.OrthographicCamera;
  quad: THREE.Mesh;
  copyMat: THREE.ShaderMaterial;
  setSize(w: number, h: number): void;
  dispose(): void;
};

export function makePostPipeline(
  w: number,
  h: number,
  shared: { uTime: { value: number }; uNight: { value: number }; uDusk: { value: number } },
): PostPipeline {
  const mk = (ww: number, hh: number, depth: boolean) =>
    new THREE.WebGLRenderTarget(ww, hh, {
      // ?byte=1 falls back to RGBA8 targets: the SwiftShader software
      // rasteriser (headless CI) renders into half-float targets with hard
      // rectangular tiling artifacts in the blur/cloud passes. Real GPUs are
      // fine with half float, so this stays an opt-in escape hatch.
      type: new URLSearchParams(location.search).has('byte')
        ? THREE.UnsignedByteType
        : THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: depth,
    });

  const skyRT = mk(w, h, true);
  const foliageRT = mk(w, h, true);
  const skyBlurRT = mk(Math.max(2, w >> 1), Math.max(2, h >> 1), false);
  const foliageBlurRT = mk(Math.max(2, w >> 1), Math.max(2, h >> 1), false);
  const cloudRT = new URLSearchParams(location.search).has('cloudfull')
    ? mk(w, h, false)
    : mk(Math.max(2, w >> 1), Math.max(2, h >> 1), false);

  const blurMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
      uRadNow: { value: 0 },
      uMaxCoC: { value: 36 },
      uBgCap: { value: 10 },
      uFgBlur: { value: 0 },
      uBgBlur: { value: 10 },
      uExposure: { value: 1 },
      uGrain: { value: 0.028 },
      uNear: { value: 0.1 },
      uFar: { value: 700 },
      uFocus: { value: 2.4 },
      uCocScale: { value: 96 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uRadNow;
      ${hash12}
      void main() {
        float kang = hash12(vUv * 517.3) * 6.28318;
        float kc = cos(kang), ks = sin(kang);
        mat2 ROT = mat2(kc, ks, -ks, kc);
        vec4 accum = vec4(0.0);
        ${blurTaps()}
        gl_FragColor = accum / 72.0;
      }
    `,
  });

  const compMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tFol: { value: null },
      tFolB: { value: null },
      tSky: { value: null },
      tSkyB: { value: null },
      uFgBlur: blurMat.uniforms.uFgBlur,
      uBgBlur: blurMat.uniforms.uBgBlur,
      uExposure: blurMat.uniforms.uExposure,
      uTime: shared.uTime,
      uGrain: blurMat.uniforms.uGrain,
      uGrainT: { value: 0.37 },
      uWrap: { value: 1 },
      uGlow: { value: 1 },
      uCA: { value: 0 },
      uNight: shared.uNight,
      uDusk: shared.uDusk,
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tFol, tFolB, tSky, tSkyB;
      uniform float uFgBlur, uBgBlur, uExposure, uTime, uGrain, uGrainT, uWrap, uGlow, uCA, uNight, uDusk;
      vec3 aces(vec3 x) {
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
      }
      ${hash12}
      ${fsGuard}
      vec4 caTex(sampler2D t, vec2 uv, vec2 off) {
        return finite4(vec4(texture2D(t, uv + off).r, texture2D(t, uv).g,
                            texture2D(t, uv - off).b, texture2D(t, uv).a));
      }
      void main() {
        // Lens toggle: chromatic fringing grows toward the frame edges
        vec2 caOff = (vUv - 0.5) * uCA * 0.0011;
        float kF = smoothstep(0.25, 1.4, uFgBlur);
        float kB = smoothstep(0.25, 1.4, uBgBlur);
        vec3 bgS = caTex(tSky, vUv, caOff).rgb;
        vec4 bgB = caTex(tSkyB, vUv, caOff);
        vec3 bg = mix(bgS, bgB.rgb / max(bgB.a, 1e-4), kB);
        vec4 fS = caTex(tFol, vUv, caOff);
        vec4 fB = caTex(tFolB, vUv, caOff);
        vec3 folCol = mix(fS.rgb, fB.rgb / max(fB.a, 1e-4), kF);
        float folA = mix(fS.a, fB.a, kF);
        // Wrap toggle: bright sky optically bleeds over sharp silhouettes
        folCol += bg * (uWrap * (1.0 - kF) * 0.55 * clamp(1.0 - fB.a, 0.0, 1.0));
        vec3 col = mix(bg, folCol, clamp(folA, 0.0, 1.0));
        // Finish toggle: gentle glow from the brightest content (moon, glints)
        vec3 glowSrc = max(bgB.rgb / max(bgB.a, 1e-4) - 1.15, 0.0)
                     + max(fB.rgb / max(fB.a, 1e-4) - 1.15, 0.0);
        col += glowSrc * 0.30 * uGlow;
        col = aces(col * uExposure);
        // half-step red trim: the day sky lands exactly on #648BBA; night lifts blue instead
        col = col * 0.972 + mix(vec3(0.0074, 0.006, 0.006), vec3(0.0, 0.0015, 0.006), uNight)
            + uDusk * vec3(0.005, 0.002, 0.0);
        // vignette: a whisper of warmth, nothing more
        float d2 = distance(vUv, vec2(0.5));
        col *= 1.0 - smoothstep(0.42, 0.86, d2) * mix(0.15, 0.20, uNight);
        float g = hash12(vUv * 913.0 + uGrainT * 517.0) - 0.5;
        // grain, but not in the blacks: added flat, it pushed near-black
        // pixels below zero and the clamp flipped them between black and dark
        // grey at random. Film grain is multiplicative in the darks anyway
        col += g * uGrain * (1.0 - uNight * 0.45) * (0.15 + 0.85 * smoothstep(0.0, 0.1, dot(col, vec3(0.333))));
        gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
      }
    `,
  });

  const copyMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tSrc;
      void main() { gl_FragColor = texture2D(tSrc, vUv); }
    `,
  });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat);
  quadScene.add(quad);

  return {
    skyRT,
    skyBlurRT,
    foliageRT,
    foliageBlurRT,
    cloudRT,
    blurMat,
    compMat,
    quadScene,
    quadCam,
    quad,
    copyMat,
    setSize(nw: number, nh: number) {
      skyRT.setSize(nw, nh);
      foliageRT.setSize(nw, nh);
      skyBlurRT.setSize(Math.max(2, nw >> 1), Math.max(2, nh >> 1));
      foliageBlurRT.setSize(Math.max(2, nw >> 1), Math.max(2, nh >> 1));
      if (new URLSearchParams(location.search).has('cloudfull')) cloudRT.setSize(nw, nh);
      else cloudRT.setSize(Math.max(2, nw >> 1), Math.max(2, nh >> 1));
      blurMat.uniforms.uTexel.value.set(1 / nw, 1 / nh);
      blurMat.uniforms.uMaxCoC.value = 0.018 * nh;
      blurMat.uniforms.uBgCap.value = 0.0095 * nh;
      blurMat.uniforms.uCocScale.value = 0.14 * nh;
    },
    dispose() {
      for (const rt of [skyRT, skyBlurRT, foliageRT, foliageBlurRT, cloudRT]) rt.dispose();
      blurMat.dispose();
      compMat.dispose();
      copyMat.dispose();
      quad.geometry.dispose();
    },
  };
}

// Mesh-gradient backdrop and the dock's liquid glass, drawn as one thing.
//
// Adapted from the lens on https://setup.lost.plus (LPFchan/setup index.html).
// The idea there: the background and the glass have to be one canvas and one
// draw, or they drift apart by a frame. Everything else follows from that.
//
// The setup page's backdrop is a video, so the dominant cost is copying each
// frame onto the GPU, and most of its code is about doing that once and only
// once. A mesh gradient has no frame to copy — the shader *is* the gradient —
// so the whole upload path, poster fallback and source bookkeeping is gone.
// What's left is the optics, which are the same three passes:
//
//   1. the gradient, over the whole viewport
//   2. the gradient again, over just the glass panel's rect, into a mipmapped
//      buffer (one generateMipmap builds the whole frost ladder)
//   3. the optics, back over the panel's rect on screen
//
// The panel in the DOM is then only a tint and a rim; the bending happens on
// the canvas underneath it, which is also why the dock icons sit *on* the
// glass rather than being refracted by it — they were never in the texture.
//
// Not an SVG filter, for the reason the setup page documents: no filter graph
// survives both engines. Chromium ignores feImage's placement and stretches
// the map over the whole filter region, WebKit drops backdrop-filter: url()
// outright.

import { RefObject, useEffect, useRef } from 'react';
import type { HeroHandle } from './hero';

/** A panel that should be rendered as glass. */
export type GlassTarget = {
  el: HTMLElement | null;
  /** corner radius in the element's own, undeformed px */
  radius: number;
  /** uniform CSS scale an ancestor applies to it (1 if none) */
  scale: number;
};

/** knobs the lens shader exposes, all in undeformed px unless noted */
export type LensConfig = {
  bleed: number;
  thick: number;
  disp: number;
  ior: number;
  /** frost: mip level the optics sample at */
  lod: number;
  /** CSS whiteness of the panel tint over the lens (0 = glass only) */
  tint: number;
};

const BLEED = 140; // px of scene kept outside the panel to bend inward
const THICK = 90; // width of the refracting rim band
const DISP = 110; // peak displacement
const IOR = 1.45;
const LOD = 1.0; // frost: base mip level the optics sample at

/**
 * ?lens=bleed,thick,disp,ior,lod,tint overrides the glass optics for tuning
 * in a live browser. Missing values keep the defaults. The tuning menu
 * persists overrides to localStorage ('lp-lens'), which the URL param wins
 * over when both are present.
 */
function lensConfig(): LensConfig {
  const def = { bleed: BLEED, thick: THICK, disp: DISP, ior: IOR, lod: LOD, tint: -1 };
  const q =
    new URLSearchParams(location.search).get('lens') ||
    localStorage.getItem('lp-lens');
  if (!q) return def;
  const v = q.split(',').map((s) => parseFloat(s));
  const keys: (keyof LensConfig)[] = ['bleed', 'thick', 'disp', 'ior', 'lod', 'tint'];
  const out = { ...def };
  keys.forEach((k, i) => {
    if (Number.isFinite(v[i])) out[k] = v[i];
  });
  return out;
}

/**
 * ?quality=<0.4..2> scales the hero's internal render resolution
 * (refresh to apply). The scene upsamples to the canvas, so below 1 it
 * softens a touch and gets a lot faster; above 1 sharpens on a strong GPU.
 */
function heroQuality(): number {
  const q = parseFloat(
    new URLSearchParams(location.search).get('quality') || '',
  );
  if (Number.isFinite(q)) return Math.min(Math.max(q, 0.4), 2);
  const s = parseFloat(localStorage.getItem('lp-quality') || '');
  if (Number.isFinite(s)) return Math.min(Math.max(s, 0.4), 2);
  return 1;
}

const FADE_MS = 320;
/**
 * The backdrop is now the ported Fable hero scene (see src/hero). The mesh
 * pass samples its composited output texture; the lens pass is unchanged, so
 * the dock glass refracts the sky, clouds, trees and bird exactly as it used
 * to refract the gradient.
 *
 * Glass optics still need a bright/dark split: the rim light that sells the
 * refraction is dark on a bright sky and pale on a night one.
 */
const GLASS_TINT = {
  bright: { edge: '#b4b1ac', fres: 0.5, spec: 0.18 },
  dark: { edge: '#f0ece2', fres: 0.35, spec: 0.24 },
} as const;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type GlassPal = { edge: Rgb; fres: number; spec: number };

const PAL: Record<'light' | 'dark', GlassPal> = {
  light: {
    edge: rgb(GLASS_TINT.bright.edge),
    fres: GLASS_TINT.bright.fres,
    spec: GLASS_TINT.bright.spec,
  },
  dark: {
    edge: rgb(GLASS_TINT.dark.edge),
    fres: GLASS_TINT.dark.fres,
    spec: GLASS_TINT.dark.spec,
  },
};

const VERT = `#version 300 es
  in vec2 a;
  void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

// The hero frame, drawn twice per frame at two different pixel windows —
// full screen for the backdrop, the panel's rect into the mipmapped buffer
// the optics read — so the two are the same image by construction, not by
// keeping two clocks in step.
const FRAG_MESH = `#version 300 es
  precision highp float;
  uniform sampler2D uScene;
  uniform vec2 uSize;      // this draw target, device px
  uniform vec2 uOrigin;    // its top-left corner, viewport CSS px
  uniform vec2 uViewport;  // the viewport, CSS px
  uniform float uDpr;
  out vec4 o;

  void main() {
    vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uDpr + uOrigin;
    vec2 uv = px / uViewport;
    // the hero's render target is bottom-up; the frame is addressed top-down
    o = vec4(texture(uScene, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);
  }`;

const FRAG_LENS = `#version 300 es
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uCanvas, uHalf, uLight, uOffset, uScale;
  uniform vec3 uEdge;
  uniform float uRadius, uThick, uDisp, uIOR, uPeak, uLod, uSpec, uFres, uFade;
  out vec4 o;

  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - (b - r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  // Convex squircle: Apple's profile, softer in the shoulder than a circle,
  // which is what keeps the rim from banding.
  float surf(float x) {
    x = clamp(x, 0.0, 1.0);
    return pow(1.0 - pow(1.0 - x, 4.0), 0.25);
  }

  void main() {
    vec2 p = gl_FragCoord.xy - uOffset;     // the lens rect's own axes
    // The dock is CSS-scaled down on narrow windows. Solve the optics on the
    // undeformed panel and push the result back out through uScale; solving in
    // the scaled frame instead would thin the rim as the window narrows.
    vec2 c = (p - uCanvas * 0.5) / uScale;
    float sd = sdBox(c, uHalf, uRadius);
    // Pass 1 already put the gradient here, so outside the panel there is
    // nothing to add; the last pixel of it feathers the edge, since there is
    // no CSS layer left to clip it.
    if (sd > 1.0) discard;

    float t = clamp(-sd / uThick, 0.0, 1.0);
    float e = 1e-3;
    float slope = (surf(t + e) - surf(t - e)) / (2.0 * e);
    // Snell, which bounds the bend where the slope runs away at the rim.
    float th1 = atan(slope);
    float th2 = asin(min(sin(th1) / uIOR, 1.0));
    float m = tan(th1 - th2) / uPeak;

    vec2 n = normalize(vec2(
      sdBox(c + vec2(1.0, 0.0), uHalf, uRadius) - sdBox(c - vec2(1.0, 0.0), uHalf, uRadius),
      sdBox(c + vec2(0.0, 1.0), uHalf, uRadius) - sdBox(c - vec2(0.0, 1.0), uHalf, uRadius)
    ) + 1e-6);
    vec2 off = n * m * uDisp * uScale;      // local displacement, back out

    // Interior frost: the flat face of the glass still scatters, so the
    // panel samples a deeper mip away from the rim. Rim stays sharp where
    // the bend is.
    float lod = uLod + 2.0 * (1.0 - t) * (1.0 - t);

    // Red bends furthest, blue least: dispersion fringes the rim.
    vec3 col;
    col.r = textureLod(uTex, (p + off * 1.00) / uCanvas, lod).r;
    col.g = textureLod(uTex, (p + off * 0.94) / uCanvas, lod).g;
    col.b = textureLod(uTex, (p + off * 0.88) / uCanvas, lod).b;

    // Schlick: glass turns mirror at grazing angles, which is most of why a
    // real rim reads as glass rather than as a blurred cutout. Blended toward
    // an edge colour rather than added, because adding white to a pale
    // backdrop just clips and the light-mode edge vanishes.
    col = mix(col, uEdge, uFres * (0.04 + 0.96 * pow(1.0 - cos(th1), 5.0)));

    // Blinn-Phong off the 2D normal lifted into 3D, lit from the upper left
    // like every other surface on the page.
    vec3 N = normalize(vec3(n * min(slope, 3.0) * 0.45, 1.0));
    vec3 H = normalize(vec3(uLight, 1.0) + vec3(0.0, 0.0, 1.0));
    col += uSpec * pow(max(dot(N, H), 0.0), 40.0);

    o = vec4(col, uFade * clamp(0.5 - sd, 0.0, 1.0));
  }`;

const MESH_UNIFORMS = [
  'uScene', 'uSize', 'uOrigin', 'uViewport', 'uDpr',
] as const;

const LENS_UNIFORMS = [
  'uTex', 'uCanvas', 'uHalf', 'uLight', 'uOffset', 'uScale', 'uRadius',
  'uThick', 'uDisp', 'uIOR', 'uPeak', 'uLod', 'uSpec', 'uFres', 'uFade', 'uEdge',
] as const;

type Uniforms = Record<string, WebGLUniformLocation | null>;
type Program = { p: WebGLProgram; u: Uniforms };

// Squircle profile and its Snell bend on the CPU, so the shader can normalise
// against the peak instead of guessing a scale. Recomputed when ?lens= pins a
// different IOR.
const surface = (x: number) =>
  Math.pow(1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 4), 0.25);

function bend(t: number, ior: number) {
  const e = 1e-4;
  const slope = (surface(t + e) - surface(t - e)) / (2 * e);
  const incidence = Math.atan(slope);
  const exit = Math.asin(Math.min(Math.sin(incidence) / ior, 1));
  return Math.tan(incidence - exit);
}

function peakBendFor(ior: number) {
  let peak = 0;
  for (let i = 0; i <= 256; i++) peak = Math.max(peak, bend(i / 256, ior));
  return peak;
}

export default function Backdrop({
  glass,
}: {
  /**
   * Candidate glass panels, most specific first. Whichever one is actually on
   * screen gets the optics — the others are `display: none` and measure zero,
   * so the breakpoint stays in the stylesheet and is never restated here.
   */
  glass: RefObject<GlassTarget[]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGL2RenderingContext | null = null;
    let meshProg: Program | null = null;
    let lensProg: Program | null = null;
    let fboTex: WebGLTexture | null = null;
    let fbo: WebGLFramebuffer | null = null;
    let fboW = 0;
    let fboH = 0;
    let stageW = 0;
    let stageH = 0;
    let maxTex = 0;
    let raf = 0;
    let fadeAt = 0;
    let quadVAO: WebGLVertexArrayObject | null = null;
    let hero: HeroHandle | null = null;
    let frameCount = 0;
    let lens = lensConfig();
    let quality = heroQuality();
    // pointer parallax target, viewport-normalised (-1..1); eased in render
    const pointer: [number, number] = [0, 0];
    let lastPointerMove = 0;
    // The drift is integrated rather than read off the clock, so pausing for a
    // hidden tab resumes where it left off instead of snapping.
    let elapsed = 0;
    let last = 0;
    // fps counters for the tuning menu (window.__perf), in EMA form
    let fpsEMA = 0;
    let frameEMA = 0;

    function shader(type: number, src: string) {
      const g = gl!;
      const s = g.createShader(type)!;
      g.shaderSource(s, src.replace(/^\s+/gm, ''));
      g.compileShader(s);
      return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
    }

    function program(fragSrc: string, names: readonly string[]): Program | null {
      const g = gl!;
      const vs = shader(g.VERTEX_SHADER, VERT);
      const fs = shader(g.FRAGMENT_SHADER, fragSrc);
      if (!vs || !fs) return null;
      const p = g.createProgram()!;
      g.attachShader(p, vs);
      g.attachShader(p, fs);
      g.bindAttribLocation(p, 0, 'a');
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;
      const u: Uniforms = {};
      for (const n of names) u[n] = g.getUniformLocation(p, n);
      return { p, u };
    }

    function initGL() {
      // alpha:false — this canvas *is* the background, not an overlay on one.
      gl = canvas!.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance',
      });
      if (!gl) return false;

      // The hero scene shares this GL context; it renders its own passes
      // into offscreen targets and hands back one composited texture. three.js
      // is heavy, so it streams in after first paint; the mesh pass shows the
      // flat fallback field until the module (and then the GLB) is ready.
      const g = gl;
      import('./hero')
        .then(({ createHero }) => {
          // The context may have been lost/recreated while the module loaded.
          if (gl !== g || !g || g.isContextLost()) return;
          try {
          hero = createHero(g, canvas!, { assets: '/fx/hero/' });
            hero.resize(
              window.innerWidth,
              window.innerHeight,
              Math.min(window.devicePixelRatio || 1, 2) * quality,
            );
          } catch (err) {
            console.error('[backdrop] hero init failed', err);
            hero = null;
          }
        })
        .catch((err) => console.error('[backdrop] hero module failed', err));

      meshProg = program(FRAG_MESH, MESH_UNIFORMS);
      lensProg = program(FRAG_LENS, LENS_UNIFORMS);
      if (!meshProg || !lensProg) {
        hero?.dispose();
        hero = null;
        gl = null;
        return false;
      }
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      const buf = gl.createBuffer();
      // three binds its own VAOs during the hero passes and its state reset
      // disables attribute 0, so this quad needs its own VAO instead of
      // relying on the default vertex-array state set up once here.
      quadVAO = gl.createVertexArray();
      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      // The lens feathers its own edge against the gradient underneath.
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      fboTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fboTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      fbo = gl.createFramebuffer();
      stageW = stageH = fboW = fboH = 0;
      return true;
    }

    function sizeFBO(W: number, H: number) {
      const g = gl!;
      if (fboW === W && fboH === H) return;
      fboW = W;
      fboH = H;
      g.bindTexture(g.TEXTURE_2D, fboTex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, W, H, 0, g.RGBA, g.UNSIGNED_BYTE, null);
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.framebufferTexture2D(
        g.FRAMEBUFFER,
        g.COLOR_ATTACHMENT0,
        g.TEXTURE_2D,
        fboTex,
        0,
      );
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    }

    function drawMesh(
      sceneTex: WebGLTexture | null,
      W: number,
      H: number,
      originX: number,
      originY: number,
      VW: number,
      VH: number,
      dpr: number,
    ) {
      const g = gl!;
      const u = meshProg!.u;
      g.useProgram(meshProg!.p);
      // The caller owns the framebuffer: pass 1 draws to the canvas, pass 2
      // draws into the mip FBO. Binding null here used to stomp pass 2's FBO
      // and paint the lens strip across the bottom of the screen — the seam.
      g.viewport(0, 0, W, H);
      g.bindVertexArray(quadVAO);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, sceneTex);
      g.uniform1i(u.uScene, 0);
      g.uniform2f(u.uSize, W, H);
      g.uniform2f(u.uOrigin, originX, originY);
      g.uniform2f(u.uViewport, VW, VH);
      g.uniform1f(u.uDpr, dpr);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.bindVertexArray(null);
    }

    function drawFallbackField(
      W: number,
      H: number,
      VW: number,
      VH: number,
      dpr: number,
      dark: boolean,
    ) {
      // no hero (GLTF/textures still loading or creation failed): a flat
      // field in the same palette family, so the glass still has something
      // quiet to bend
      const g = gl!;
      void W; void H; void VW; void VH; void dpr;
      g.clearColor(dark ? 0.05 : 0.93, dark ? 0.07 : 0.92, dark ? 0.13 : 0.87, 1);
      g.clear(g.COLOR_BUFFER_BIT);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const g = gl;
      if (!g) return;

      const VW = window.innerWidth;
      const VH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const CW = Math.round(VW * dpr);
      const CH = Math.round(VH * dpr);
      if (stageW !== CW || stageH !== CH) {
        canvas!.width = CW;
        canvas!.height = CH;
        stageW = CW;
        stageH = CH;
        hero?.resize(VW, VH, dpr * quality);
      }

      // When nothing is moving, the scene changes only through its slow
      // drifts (wind, clouds, the sun's crawl) — none of them need 60fps.
      // Idle frames render at 30; a pointer move returns to full rate within
      // one frame, and the four seconds after each move stay there so the
      // parallax ease finishes cleanly.
      const idle = now - lastPointerMove > 4000;
      if (idle && frameCount % 2 === 1) return;

      // Cap the step so a long stall (tab wake, GC pause) advances the drift
      // by one frame rather than teleporting it.
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
      if (last) elapsed += Math.min((now - last) / 1000, 0.1);
      last = now;
      if (last && dt > 0) {
        const fps = 1 / dt;
        fpsEMA = fpsEMA ? fpsEMA + (fps - fpsEMA) * 0.05 : fps;
        frameEMA = frameEMA
          ? frameEMA + (dt * 1000 - frameEMA) * 0.05
          : dt * 1000;
        (window as unknown as Record<string, unknown>).__perf = {
          fps: fpsEMA,
          ms: frameEMA,
        };
      }

      // The hero renders first: one composited texture for this frame. Its
      // dark phase also drives the page theme, replacing prefers-color-scheme
      // as the source of truth (App defers to the scene when it is running).
      let sceneTex: WebGLTexture | null = null;
      if (hero) {
        hero.renderFrame(dt, elapsed, pointer);
        // three only allocates the GL texture for a render-target texture
        // lazily; properties.get() is what does it. (initTexture no-ops on
        // render-target textures, and __webglTexture alone stays undefined.)
        const props = hero.renderer.properties.get(hero.finalRT.texture) as {
          __webglTexture?: WebGLTexture;
        };
        sceneTex = props.__webglTexture ?? hero.finalRT.texture.__webglTexture ?? null;
        const dark = hero.isDark();
        // The sky is the source of truth for the theme from here on; App's
        // prefers-color-scheme fallback defers once this attribute is set.
        if (!document.documentElement.hasAttribute('data-sky'))
          document.documentElement.setAttribute('data-sky', '');
        if (document.documentElement.classList.contains('dark') !== dark)
          document.documentElement.classList.toggle('dark', dark);
        frameCount++;
      }
      const pal = document.documentElement.classList.contains('dark')
        ? PAL.dark
        : PAL.light;

      // Pass 1: the hero frame, over the whole viewport. Redrawing all of it is
      // also what erases the panel's previous footprint — a single quad is far
      // cheaper on the GPU than tracking damage rects on the CPU.
      g.disable(g.BLEND);
      g.disable(g.SCISSOR_TEST);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, CW, CH);
      g.clearColor(0, 0, 0, 1);
      g.clear(g.COLOR_BUFFER_BIT);
      if (sceneTex) drawMesh(sceneTex, CW, CH, 0, 0, VW, VH, dpr);
      else drawFallbackField(CW, CH, VW, VH, dpr, pal === PAL.dark);
      // Whichever candidate panel is on screen. The rect already has the
      // dock's springs, its zoom and the icon magnification folded in, so
      // measuring every frame is what keeps the glass welded to it.
      const target = (glass.current ?? []).find((c) => {
        const r = c.el?.getBoundingClientRect();
        return r && r.width > 0 && r.height > 0;
      });
      const el = target?.el;
      if (!target || !el) return; // the gradient stands on its own

      const r = el.getBoundingClientRect();
      const scale = target.scale || 1;
      const lw = r.width / scale; // undeformed extents, what the optics solve on
      const lh = r.height / scale;
      const bx = lens.bleed * scale;
      const by = lens.bleed * scale;
      const vx = r.left - bx;
      const vy = r.top - by;
      const w = r.width + bx * 2;
      const h = r.height + by * 2;
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      if (W < 1 || H < 1 || W > maxTex || H > maxTex) return;

      // Pass 2: the same rect of the same frame, into the mip pyramid.
      sizeFBO(W, H);
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.viewport(0, 0, W, H);
      if (sceneTex) {
        drawMesh(sceneTex, W, H, vx, vy, VW, VH, dpr);
        g.bindTexture(g.TEXTURE_2D, fboTex);
        g.generateMipmap(g.TEXTURE_2D); // the whole frost ladder, one call
      } else {
        drawFallbackField(W, H, VW, VH, dpr, pal === PAL.dark);
        g.bindTexture(g.TEXTURE_2D, fboTex);
        g.generateMipmap(g.TEXTURE_2D);
      }

      if (!fadeAt) fadeAt = now;
      const fade = Math.min((now - fadeAt) / FADE_MS, 1);

      // Pass 3: the optics, into the panel's rect of the same canvas. Scissor
      // as well as viewport, because the shader samples outside the panel and
      // the viewport alone would not stop it writing there.
      const px = Math.round(vx * dpr);
      const py = Math.round(CH - (vy + h) * dpr);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(px, py, W, H);
      g.enable(g.SCISSOR_TEST);
      g.scissor(px, py, W, H);
      g.enable(g.BLEND);
      const u = lensProg!.u;
      g.useProgram(lensProg!.p);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, fboTex);
      g.uniform1i(u.uTex, 0);
      g.uniform2f(u.uOffset, px, py);
      g.uniform2f(u.uCanvas, W, H);
      g.uniform2f(u.uScale, scale, scale);
      g.uniform2f(u.uHalf, (lw / 2) * dpr, (lh / 2) * dpr);
      g.uniform1f(
        u.uRadius,
        Math.min(target.radius, lw / 2, lh / 2) * dpr,
      );
      g.uniform1f(u.uThick, lens.thick * dpr);
      g.uniform1f(u.uDisp, lens.disp * dpr);
      g.uniform1f(u.uIOR, lens.ior);
      g.uniform1f(u.uPeak, peakBendFor(lens.ior));
      g.uniform1f(u.uLod, lens.lod);
      g.uniform2f(u.uLight, -0.45, 0.75);
      g.uniform1f(u.uSpec, pal.spec);
      g.uniform1f(u.uFres, pal.fres);
      g.uniform3fv(u.uEdge, pal.edge);
      g.uniform1f(u.uFade, fade);
      g.bindVertexArray(quadVAO);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.bindVertexArray(null);
      g.disable(g.SCISSOR_TEST);
      g.disable(g.BLEND);
    }

    // No WebGL2: the canvas stays hidden and the CSS gradient plus the plain
    // backdrop-blur panel in index.css is the whole thing.
    if (!initGL()) return;
    document.body.classList.add('lensing');
    if (lens.tint >= 0)
      document.body.style.setProperty('--lens-tint', String(lens.tint));

    const onLost = (e: Event) => {
      e.preventDefault();
      hero?.dispose();
      hero = null;
      gl = null;
      // The canvas is the background, so it has to get out of the way and let
      // the CSS gradient show again — not just drop the glass.
      document.body.classList.remove('lensing');
    };
    const onRestored = () => {
      if (initGL()) {
        fadeAt = 0;
        document.body.classList.add('lensing');
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    // rAF-driven; a hidden tab throttles it on its own, and the long-stall
    // dt cap in frame() keeps the resume from jumping.

    const onPointer = (e: PointerEvent) => {
      pointer[0] = (e.clientX / window.innerWidth) * 2 - 1;
      pointer[1] = (e.clientY / window.innerHeight) * 2 - 1;
      lastPointerMove = performance.now();
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    // The tuning menu changes these live; URL params and localStorage are
    // re-read so the menu, the address bar and reloads all agree.
    const onTune = () => {
      lens = lensConfig();
      quality = heroQuality();
      stageW = stageH = 0; // force a resize so the new quality takes now
      if (lens.tint >= 0)
        document.body.style.setProperty('--lens-tint', String(lens.tint));
      else document.body.style.removeProperty('--lens-tint');
    };
    window.addEventListener('lp:tune', onTune);

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('lp:tune', onTune);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      hero?.dispose();
      document.body.classList.remove('lensing');
    };
  }, [glass]);

  return <canvas ref={canvasRef} className="backdrop-canvas" aria-hidden="true" />;
}

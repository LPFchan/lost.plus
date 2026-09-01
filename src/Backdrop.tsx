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

/** A panel that should be rendered as glass. */
export type GlassTarget = {
  el: HTMLElement | null;
  /** corner radius in the element's own, undeformed px */
  radius: number;
  /** uniform CSS scale an ancestor applies to it (1 if none) */
  scale: number;
};

const BLEED = 34; // px of gradient kept outside the panel to bend inward
const THICK = 22; // width of the refracting rim band
const DISP = 26; // peak displacement
const IOR = 1.5;
const LOD = 2.0; // frost: mip level the optics sample at
const FADE_MS = 320;
const FROZEN_T = 12; // where the drift parks under prefers-reduced-motion

/**
 * Quiet palettes: every blob sits within a few percent of the base, so the
 * field reads as depth rather than as colour. Loud gradients lose a fight
 * with eleven loud app icons.
 */
const PALETTES = {
  light: {
    base: '#f6f5f2',
    blobs: ['#f7e6d8', '#e4ecf6', '#efe7f4', '#e8f1ea', '#fbf4e7'],
    // A glass edge on a pale surface reads as a grey line, not a bright one.
    edge: '#b4b1ac',
    fres: 0.5,
    spec: 0.18,
  },
  dark: {
    // Dark ramps need a larger absolute step than pale ones before the eye
    // sees them at all, so these sit further from the base than the light
    // blobs do while reading just as quietly.
    base: '#131315',
    blobs: ['#211d33', '#112329', '#26181e', '#181a29', '#0d0d0f'],
    edge: '#dfe3f0',
    fres: 0.35,
    spec: 0.24,
  },
} as const;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type Palette = { base: Rgb; blobs: Rgb[]; edge: Rgb; fres: number; spec: number };

const PAL: Record<'light' | 'dark', Palette> = {
  light: {
    base: rgb(PALETTES.light.base),
    blobs: PALETTES.light.blobs.map(rgb),
    edge: rgb(PALETTES.light.edge),
    fres: PALETTES.light.fres,
    spec: PALETTES.light.spec,
  },
  dark: {
    base: rgb(PALETTES.dark.base),
    blobs: PALETTES.dark.blobs.map(rgb),
    edge: rgb(PALETTES.dark.edge),
    fres: PALETTES.dark.fres,
    spec: PALETTES.dark.spec,
  },
};

const VERT = `#version 300 es
  in vec2 a;
  void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

// The gradient. Drawn twice per frame at two different pixel windows onto the
// same viewport-space field — full screen for the backdrop, the panel's rect
// for the buffer the optics read — so the two are the same image by
// construction, not by keeping two clocks in step.
const FRAG_MESH = `#version 300 es
  precision highp float;
  uniform vec2 uSize;      // this draw target, device px
  uniform vec2 uOrigin;    // its top-left corner, viewport CSS px
  uniform vec2 uViewport;  // the viewport, CSS px
  uniform float uDpr, uTime;
  uniform vec3 uBase, uC0, uC1, uC2, uC3, uC4;
  out vec4 o;

  // Gaussian falloff, so a blob has no edge anywhere and there is nothing for
  // the ramp to band against.
  vec3 blob(vec3 c, vec3 col, vec2 p, vec2 at, float r) {
    vec2 d = p - at;
    return mix(c, col, exp(-dot(d, d) / (r * r)));
  }

  void main() {
    // gl_FragCoord is y-up in this target; the field is addressed in top-down
    // viewport CSS pixels, which is the space both draws share.
    vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uDpr + uOrigin;
    vec2 uv = px / uViewport;
    float a = uViewport.x / uViewport.y;   // keep blobs round, not stretched
    vec2 p = vec2(uv.x * a, uv.y);
    float t = uTime;

    // Five slow loops on frequencies that share no common period, so the
    // field never visibly repeats.
    vec3 c = uBase;
    c = blob(c, uC0, p, vec2(0.20 * a + 0.10 * sin(t * 0.11), 0.24 + 0.09 * cos(t * 0.14)), 0.46);
    c = blob(c, uC1, p, vec2(0.84 * a + 0.09 * cos(t * 0.09), 0.18 + 0.10 * sin(t * 0.12)), 0.42);
    c = blob(c, uC2, p, vec2(0.74 * a + 0.11 * sin(t * 0.07), 0.82 + 0.08 * cos(t * 0.10)), 0.50);
    c = blob(c, uC3, p, vec2(0.22 * a + 0.08 * cos(t * 0.13), 0.80 + 0.09 * sin(t * 0.08)), 0.44);
    c = blob(c, uC4, p, vec2(0.50 * a + 0.13 * sin(t * 0.06), 0.50 + 0.11 * cos(t * 0.05)), 0.38);

    // Ramps this soft cross a whole screen in a handful of 8-bit steps and
    // would band into visible stripes; a pixel-sized dither scatters the step.
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    o = vec4(c + (n - 0.5) / 255.0, 1.0);
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

    // Red bends furthest, blue least: dispersion fringes the rim.
    vec3 col;
    col.r = textureLod(uTex, (p + off * 1.00) / uCanvas, uLod).r;
    col.g = textureLod(uTex, (p + off * 0.94) / uCanvas, uLod).g;
    col.b = textureLod(uTex, (p + off * 0.88) / uCanvas, uLod).b;

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
  'uSize', 'uOrigin', 'uViewport', 'uDpr', 'uTime',
  'uBase', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4',
] as const;

const LENS_UNIFORMS = [
  'uTex', 'uCanvas', 'uHalf', 'uLight', 'uOffset', 'uScale', 'uRadius',
  'uThick', 'uDisp', 'uIOR', 'uPeak', 'uLod', 'uSpec', 'uFres', 'uFade', 'uEdge',
] as const;

type Uniforms = Record<string, WebGLUniformLocation | null>;
type Program = { p: WebGLProgram; u: Uniforms };

// Squircle profile and its Snell bend on the CPU, so the shader can normalise
// against the peak instead of guessing a scale.
const surface = (x: number) =>
  Math.pow(1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 4), 0.25);

function bend(t: number) {
  const e = 1e-4;
  const slope = (surface(t + e) - surface(t - e)) / (2 * e);
  const incidence = Math.atan(slope);
  const exit = Math.asin(Math.min(Math.sin(incidence) / IOR, 1));
  return Math.tan(incidence - exit);
}

let peakBend = 0;
for (let i = 0; i <= 256; i++) peakBend = Math.max(peakBend, bend(i / 256));

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

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    // The drift is integrated rather than read off the clock, so pausing for a
    // hidden tab resumes where it left off instead of snapping.
    let elapsed = 0;
    let last = 0;

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

      meshProg = program(FRAG_MESH, MESH_UNIFORMS);
      lensProg = program(FRAG_LENS, LENS_UNIFORMS);
      if (!meshProg || !lensProg) {
        gl = null;
        return false;
      }
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
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
      pal: Palette,
      W: number,
      H: number,
      originX: number,
      originY: number,
      VW: number,
      VH: number,
      dpr: number,
      t: number,
    ) {
      const g = gl!;
      const u = meshProg!.u;
      g.useProgram(meshProg!.p);
      g.uniform2f(u.uSize, W, H);
      g.uniform2f(u.uOrigin, originX, originY);
      g.uniform2f(u.uViewport, VW, VH);
      g.uniform1f(u.uDpr, dpr);
      g.uniform1f(u.uTime, t);
      g.uniform3fv(u.uBase, pal.base);
      g.uniform3fv(u.uC0, pal.blobs[0]);
      g.uniform3fv(u.uC1, pal.blobs[1]);
      g.uniform3fv(u.uC2, pal.blobs[2]);
      g.uniform3fv(u.uC3, pal.blobs[3]);
      g.uniform3fv(u.uC4, pal.blobs[4]);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
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
      }

      const pal = document.documentElement.classList.contains('dark')
        ? PAL.dark
        : PAL.light;
      // Cap the step so a long stall (tab wake, GC pause) advances the drift
      // by one frame rather than teleporting it.
      if (last) elapsed += Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = reduced.matches ? FROZEN_T : elapsed;

      // Pass 1: the gradient, over the whole viewport. Redrawing all of it is
      // also what erases the panel's previous footprint — a single quad is far
      // cheaper on the GPU than tracking damage rects on the CPU.
      g.disable(g.BLEND);
      g.disable(g.SCISSOR_TEST);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, CW, CH);
      drawMesh(pal, CW, CH, 0, 0, VW, VH, dpr, t);

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
      const bx = BLEED * scale;
      const by = BLEED * scale;
      const vx = r.left - bx;
      const vy = r.top - by;
      const w = r.width + bx * 2;
      const h = r.height + by * 2;
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      if (W < 1 || H < 1 || W > maxTex || H > maxTex) return;

      // Pass 2: the same rect of the same field, into the mip pyramid.
      sizeFBO(W, H);
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.viewport(0, 0, W, H);
      drawMesh(pal, W, H, vx, vy, VW, VH, dpr, t);
      g.bindTexture(g.TEXTURE_2D, fboTex);
      g.generateMipmap(g.TEXTURE_2D); // the whole frost ladder, one call

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
      g.uniform1f(u.uThick, THICK * dpr);
      g.uniform1f(u.uDisp, DISP * dpr);
      g.uniform1f(u.uIOR, IOR);
      g.uniform1f(u.uPeak, peakBend);
      g.uniform1f(u.uLod, LOD);
      g.uniform2f(u.uLight, -0.45, 0.75);
      g.uniform1f(u.uSpec, pal.spec);
      g.uniform1f(u.uFres, pal.fres);
      g.uniform3fv(u.uEdge, pal.edge);
      g.uniform1f(u.uFade, fade);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.disable(g.SCISSOR_TEST);
      g.disable(g.BLEND);
    }

    // No WebGL2: the canvas stays hidden and the CSS gradient plus the plain
    // backdrop-blur panel in index.css is the whole thing.
    if (!initGL()) return;
    document.body.classList.add('lensing');

    const onLost = (e: Event) => {
      e.preventDefault();
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

    // A hidden tab still gets rAF in some engines; stop drawing either way.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.body.classList.remove('lensing');
    };
  }, [glass]);

  return <canvas ref={canvasRef} className="backdrop-canvas" aria-hidden="true" />;
}

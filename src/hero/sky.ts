// The Fable hero's sky dome, moon and cloud deck, as three ShaderMaterials.
// Comments preserved from the original where it had them — the reasoning is
// the valuable part.

import * as THREE from 'three';

/** Shared uniforms the caller drives every frame. */
export type SkyUniforms = {
  uTime: { value: number };
  uNight: { value: number };
  uDusk: { value: number };
  uMorn: { value: number };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunGlow: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uMoonDir: { value: THREE.Vector3 };
  uCloudT: { value: number };
  uClouds: { value: number };
  uDuskMid: { value: THREE.Color };
  uDuskFar: { value: THREE.Color };
};

export function makeSkyUniforms(): SkyUniforms {
  return {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uDusk: { value: 0 },
    uMorn: { value: 0 },
    uZenith: { value: new THREE.Color('#6180c3') },
    uHorizon: { value: new THREE.Color('#6483c6') },
    uSunGlow: { value: new THREE.Color('#ffe9c4') },
    uSunDir: { value: new THREE.Vector3(0.45, 0.6, 0.42).normalize() },
    uMoonDir: { value: new THREE.Vector3(48, 74, -268).normalize() },
    uCloudT: { value: 0 },
    uClouds: { value: 1 },
    uDuskMid: { value: new THREE.Color('#e89a88') },
    uDuskFar: { value: new THREE.Color('#9aa6bc') },
  };
}

// GLSL: the sky gradient shared by the dome and the moon (the moon samples
// the sky along its own view ray so its shadow side can never read as a
// ghost disc).
const SKY_FN = /* glsl */ `
  uniform vec3 uZenith, uHorizon, uSunDir, uSunGlow, uDuskMid, uDuskFar, uMoonDir;
  uniform float uNight, uDusk, uSkyVar;
  vec3 skyColor(vec3 dir) {
    float h = smoothstep(-0.06, 0.6, dir.y);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.85));
    // sunset: the colour lives NEAR THE SUN. Overhead stays a dusky blue; a
    // thin salmon band hugs the horizon; gold builds toward the sun's azimuth
    // and the horizon away from it is hazy blue-grey
    vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-5));
    vec3 dirH = normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5));
    float az = smoothstep(-0.4, 1.0, dot(dirH, sunH));              // 1 = toward the sun
    vec3 hor = mix(uDuskFar, uHorizon, az);
    vec3 band = mix(mix(uDuskFar, uDuskMid, 0.35), uDuskMid, az);
    vec3 dc = mix(hor, band, smoothstep(-0.01, 0.07, dir.y));
    dc = mix(dc, uZenith, smoothstep(0.02, 0.17 + 0.10 * az, dir.y));   // the blue takes over low: the warmth is a band, not a wall
    col = mix(col, dc, uDusk);
    float sd = max(dot(dir, uSunDir), 0.0);
    // by day this is the sun's glow; at night uSunDir has swung to the moon
    // and the same term becomes a soft halo around it; at dusk it swells
    col += uSunGlow * pow(sd, 14.0) * (mix(0.22, 0.06, uNight) + 0.28 * uDusk);
    col += uSunGlow * pow(sd, 4.0) * 0.14 * uDusk;                     // golden haze low over the horizon
    // (no visible sun disc: the moon is the scene's only celestial body -
    //  the sunset lives in its glow and horizon colour alone)
    // real skies are never mathematically flat - and the moon's shadow side
    // must carry the same variation, or it shows as a ghost disc
    col *= 1.0 + uSkyVar * (0.011 * sin(dir.x * 4.1 + dir.y * 6.3) * sin(dir.y * 3.7 - dir.x * 2.3)
                          + 0.006 * sin(dir.x * 11.0) * sin(dir.y * 9.0));
    return col;
  }
`;

export function makeSkyDome(u: SkyUniforms): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(600, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uZenith: u.uZenith,
        uHorizon: u.uHorizon,
        uSunDir: u.uSunDir,
        uSunGlow: u.uSunGlow,
        uSkyVar: { value: 1 },
        uMoonDir: u.uMoonDir,
        uNight: u.uNight,
        uDusk: u.uDusk,
        uTime: u.uTime,
        uDuskMid: u.uDuskMid,
        uDuskFar: u.uDuskFar,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uTime;
        ${SKY_FN}
        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main() {
          vec3 dir = normalize(vDir);
          vec3 col = skyColor(dir);
          float g = pow(max(dot(dir, uSunDir), 0.0), 14.0);
          if (uNight > 0.001) {
            // star field on an azimuth / elevation grid (~0.5 deg cells): one
            // candidate star per cell, most faint, a few bright, all twinkling
            vec2 ae = vec2(atan(dir.x, -dir.z), asin(clamp(dir.y, -1.0, 1.0))) * 114.6;
            vec2 c = floor(ae);
            vec2 f = fract(ae) - 0.5;
            float hs = hash(vec3(c, 1.0));
            vec2 o = vec2(hash(vec3(c, 7.3)), hash(vec3(c, 13.9))) - 0.5;
            float mag = fract(hs * 41.7);                  // 0 faint .. 1 bright
            // pin-points, not discs: a tight core the size of a pixel or two,
            // the brightest few carrying a faint soft skirt
            float rad = 0.028 + 0.035 * mag * mag;
            float dd = length(f - o * 0.7);
            float core = smoothstep(rad, rad * 0.25, dd);
            float skirt = smoothstep(rad * 4.0, 0.0, dd) * 0.08 * mag * mag;
            // a bright moon washes out all but the brightest stars: very sparse
            float star = (core + skirt) * step(0.955, hs);
            // real stars scintillate, they do not blink: a slow, slight shimmer
            float tw = 0.93 + 0.07 * sin(uTime * (0.8 + 1.2 * hs) + hs * 80.0);
            float bright = (0.16 + 0.9 * mag * mag) * tw;
            col += mix(vec3(0.78, 0.85, 1.0), vec3(1.0, 0.95, 0.85), fract(hs * 9.1))
                 * star * bright * uNight * smoothstep(-0.02, 0.2, dir.y) * (1.0 - g * 0.85);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
}

export function makeMoon(u: SkyUniforms, moonPos: THREE.Vector3): THREE.Mesh {
  const moonLight = new THREE.Vector3(-0.86, 0.34, 0.18).normalize();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(10.2, 48, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        uMoonLight: { value: moonLight },
        uZenith: u.uZenith,
        uHorizon: u.uHorizon,
        uSunDir: u.uSunDir,
        uSunGlow: u.uSunGlow,
        uMoonGain: { value: 1 },
        uSkyVar: { value: 1 },
        uMoonDir: u.uMoonDir,
        uNight: u.uNight,
        uDusk: u.uDusk,
        uDuskMid: u.uDuskMid,
        uDuskFar: u.uDuskFar,
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vNv; varying vec3 vRay;
        void main() {
          vN = normalize(position);
          vNv = normalMatrix * normal;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vRay = wp.xyz - cameraPosition;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vNv; varying vec3 vRay;
        uniform vec3 uMoonLight;
        uniform float uMoonGain;
        ${SKY_FN}
        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vnoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n000 = hash(i), n100 = hash(i + vec3(1,0,0));
          float n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
          float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1));
          float n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
          return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
                     mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
        }
        float fbm(vec3 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.13; a *= 0.5; }
          return v;
        }
        void main() {
          vec3 n = normalize(vN);
          // the sky's own gradient along this exact view ray
          vec3 skyCol = skyColor(normalize(vRay));

          float edge = dot(normalize(vV), normalize(vNv));
          // broad, gentle terminator: illumination rolls off across the disc
          float litRaw = dot(n, uMoonLight);
          float lit = smoothstep(-0.22, 0.58, litRaw);
          lit = lit * lit * (3.0 - 2.0 * lit); // eased, curved terminator that wraps the sphere
          // BY DAY the moon reads as two gradients laid over the disc: a
          // LINEAR one, the moon fully there at top-left and gone into the
          // sky at bottom-right - times a RADIAL one anchored on the right
          // part of the disc, sky-coloured at the anchor and growing outward
          // from it, so the whole left limb is where the moon is strongest
          vec2 q = n.xy;                                                  // the disc as seen: x right, y up
          float g1 = smoothstep(-0.50, 0.62, dot(q, normalize(vec2(-1.0, 1.0))));
          float g2 = smoothstep(0.20, 1.25, length(q - vec2(0.62, -0.05)));
          lit = g1 * g2;                       // the same two gradients in every look, night included
          // surface: large maria patches + craters, strongest under grazing light
          float m = fbm(n * 3.1 + 7.0);
          float m2 = fbm(n * 1.6 + 2.0);
          float mare = 0.30 * smoothstep(0.44, 0.66, m)
                     + 0.16 * smoothstep(0.48, 0.72, m2);
          float term = smoothstep(-0.15, 0.15, litRaw) * smoothstep(0.75, 0.35, litRaw);
          float craters = (0.07 + 0.10 * term) * smoothstep(0.50, 0.85, fbm(n * 17.0 + 3.0))
                        + 0.06 * fbm(n * 9.0);
          // broad highland patches a step lighter than the rest (the lunar
          // highlands ARE brighter than the plains)
          float highland = 0.11 * smoothstep(0.52, 0.72, fbm(n * 2.3 + 13.0))
                         + 0.05 * smoothstep(0.58, 0.80, fbm(n * 5.1 + 27.0));
          float detail = 1.0 - mare - craters + highland;
          // night: maria read as large, soft, clearly darker basins, plus a
          // few bright ray craters - the texture a camera actually resolves
          float mareN = 0.30 * smoothstep(0.40, 0.62, m) + 0.13 * smoothstep(0.46, 0.70, m2);
          float rays = 0.06 * smoothstep(0.78, 0.94, fbm(n * 23.0 + 11.0));
          float grain = 0.06 * (fbm(n * 41.0 + 5.0) - 0.5); // fine regolith mottle
          float detailN = clamp(1.0 - mareN - craters * 0.9 + rays + grain, 0.0, 1.2);
          detailN *= 1.0 - 0.05 * term;
          detail = mix(detail, detailN, uNight);
          // pale by day: barely lighter than the sky, bluish, low contrast (a
          // daytime moon is a sunlit rock seen THROUGH the whole bright
          // atmosphere); at night the moon IS the light
          vec3 daySurf = skyCol * uMoonGain * vec3(2.9, 1.9, 1.24);
          vec3 nightSurf = vec3(0.30, 0.29, 0.26) * uMoonGain; // bright, not blinding
          vec3 moonSurf = mix(daySurf, nightSurf, uNight) * detail;
          float rim = pow(1.0 - abs(edge), 1.6);
          moonSurf = mix(moonSurf, moonSurf * vec3(1.13, 1.12, 1.09), rim); // the limb a tad lighter
          moonSurf = mix(moonSurf, mix(moonSurf, skyCol, 0.30), (1.0 - rim) * (1.0 - uNight));
          // the shaded side is not painted at all: the disc's opacity IS the
          // lit term, so whatever sky is behind it shows through untouched
          float limb = smoothstep(0.0, mix(0.34, 0.24, uNight), abs(edge));
          float alpha = smoothstep(0.02, mix(0.16, 0.12, uNight), abs(edge)) * lit * (limb * 0.97 + 0.03);
          gl_FragColor = vec4(moonSurf, alpha);
        }
      `,
    }),
  );
  mesh.position.copy(moonPos);
  return mesh;
}

export function makeCloudDome(u: SkyUniforms): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(200, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uClouds: u.uClouds,
        uCover: { value: 0.7 },
        uCloudT: u.uCloudT,
        uNight: u.uNight,
        uDusk: u.uDusk,
        uMorn: u.uMorn,
        uDeckFine: { value: 1 },
        uCoverBoost: { value: 0 },
        uWarmK: { value: 1 },
        // Shelter reach 0 disables the text-shelter: this backdrop has no
        // hero words to part the clouds around. With the default 0.2 the
        // empty (0,0,0,0) shelter rects still trigger the branch and boxDist
        // returns -rad for them, which parts the deck in a hard rectangle at
        // the top-left of the frame — the seam.
        uShelterReach: { value: 0 },
        uShelterA: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShelterB: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShelterC: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShelterShift: { value: new THREE.Vector2(0, 0) },
        uRes: { value: new THREE.Vector2(1, 1) },
        uSunDir: u.uSunDir,
        uSunGlow: u.uSunGlow,
        uMoonDir: u.uMoonDir,
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uClouds, uCover, uCloudT, uNight, uDusk, uMorn, uDeckFine, uCoverBoost, uWarmK, uShelterReach;
        uniform vec3 uSunDir, uSunGlow, uMoonDir;
        // Sine-free hash: fract(sin(dot(p, ...)) * 43758) loses every bit of
        // precision once p grows past a few hundred (the deck's noise coords
        // do), and on drivers with a lower fragment default precision that
        // collapse shows up as axis-aligned rectangular seams in the clouds.
        // This form keeps the argument small, so it is stable everywhere.
        float hash2(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x),
                     mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) { v += a * vn(p); p = R * p * 2.07 + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }
        float fbm3(vec2 p) {
          float v = 0.0, a = 0.5;
          mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 3; i++) { v += a * vn(p); p = R * p * 2.07 + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }
        // the cloud density field: broad masses, finer detail riding the other
        // way, a billow term that splits masses into rounded puffs, and a fine
        // grain for texture. (The lens is long - 21 degrees - so the frame
        // sees a tiny patch of the deck; the structure has to be FINE in deck
        // units to show several lobes across the frame.)
        float cloudField(vec2 p, vec2 drift, float seed) {
          float base = fbm(p * 3.2 + drift + seed);
          float fine = 0.16 * (fbm(p * 5.5 - drift * 1.4 + 4.0 + seed) - 0.5);
          float billow = 1.0 - abs(2.0 * fbm3(p * 11.0 + drift * 0.6 + 9.0 + seed) - 1.0);
          float grain = 0.06 * (fbm3(p * 26.0 + drift * 0.3 + 23.0 + seed) - 0.5);
          return base + fine + 0.14 * (billow - 0.5) + grain;
        }
        // one deck of cumulus: density, lobe-level light and shade, lit top
        // edges. sc scales the puffs (bigger = nearer), seed decorrelates the
        // layers. feather widens each puff's soft rim where a shelter has the
        // deck parting.
        vec4 deck(vec3 dir, vec2 p0, vec2 drift, float sc, float seed, float th0, float nearMoon, float feather) {
          p0 *= sc * uDeckFine;
          // weather mask: clouds come in families with clear sky between them
          float wx = fbm3(p0 * 0.9 + drift * 0.5 + 31.0 + seed);
          // domain warp: the deck is advected, so cells bend and curl
          vec2 warp = (vec2(fbm3(p0 * 1.4 + drift + 3.0 + seed), fbm3(p0 * 1.4 + drift + 17.0 + seed)) - 0.5) * 0.25;
          vec2 p = p0 + warp;
          float th = th0 + (0.5 - wx) * 0.08 + nearMoon * 0.16;
          float field = cloudField(p, drift, seed);
          float dens = smoothstep(th, th + 0.14, field);
          // the soft rim, wider where the shelter has the deck parting
          float fringe = smoothstep(th - 0.08 - 0.14 * feather, th, field) * (1.0 - dens);
          float thick = smoothstep(th, th + 0.40, field);
          // LIGHT AND SHADE, the way a cumulus reads: a puff is bright on the
          // side that faces the sun and dark where a neighbouring puff stands
          // between it and the light
          vec2 Ld = normalize(uSunDir.xz + vec2(1e-4, 0.0));
          float towardBig = cloudField(p + Ld * 0.045, drift, seed) - field;
          float lobeHere = fbm3(p * 11.0 + drift * 0.6 + 9.0 + seed);
          float towardLobe = fbm3((p + Ld * 0.012) * 11.0 + drift * 0.6 + 9.0 + seed) - lobeHere;
          float bigShade = smoothstep(0.08, -0.08, towardBig);
          float lobeShade = smoothstep(0.10, -0.10, towardLobe);
          float lam = 0.10 + 0.90 * (0.45 * bigShade + 0.55 * lobeShade);
          // the bellies: the mass ABOVE a point (toward the zenith) shades it
          float above = cloudField(p * 0.96, drift, seed);
          float belly = exp(-max(above - th, 0.0) * 7.0);
          float light = lam * belly;
          float topEdge = smoothstep(0.0, 0.10, th - above) * dens;
          // a GAMUT of crowns from mass to mass: each cloud family draws its
          // own hue, from a deep orange to a clear yellow
          float hue = smoothstep(0.36, 0.64, fbm3(p0 * 0.55 + drift * 0.3 + 57.0 + seed));
          vec3 litD = mix(vec3(1.66, 0.80, 0.24), vec3(1.50, 1.06, 0.44), hue) * (1.0 - uMorn) + vec3(1.62, 0.86, 0.30) * uMorn;
          litD = mix(vec3(dot(litD, vec3(0.333))), litD, uWarmK);
          vec3 midD = mix(vec3(0.98, 0.52, 0.26), vec3(0.92, 0.66, 0.34), hue), shdD = vec3(0.30, 0.27, 0.30);
          vec3 litK = vec3(1.04, 0.62, 0.46), midK = vec3(0.52, 0.33, 0.40), shdK = vec3(0.22, 0.18, 0.34); // sunset: pink / dusty rose / violet
          litD = mix(litD, litK, uDusk); midD = mix(midD, midK, uDusk); shdD = mix(shdD, shdK, uDusk);
          vec3 litN = vec3(0.080, 0.088, 0.120), midN = vec3(0.028, 0.032, 0.047), shdN = vec3(0.006, 0.007, 0.012); // moonlit
          litD = mix(litD, vec3(1.30, 0.62, 0.24), uMorn); midD = mix(midD, vec3(0.78, 0.44, 0.27), uMorn); shdD = mix(shdD, vec3(0.30, 0.27, 0.28), uMorn);
          float contrast = 0.84 - 0.36 * uDusk - 0.16 * uNight - 0.08 * uMorn;
          float lk = mix(0.5, clamp(light, 0.0, 1.0), contrast);
          vec3 dayCol = lk < 0.5 ? mix(shdD, midD, lk * 2.0) : mix(midD, litD, lk * 2.0 - 1.0);
          vec3 nightCol = lk < 0.5 ? mix(shdN, midN, lk * 2.0) : mix(midN, litN, lk * 2.0 - 1.0);
          vec3 col = mix(dayCol, nightCol, uNight);
          col += mix(litD, litN, uNight) * topEdge * 0.18;
          col *= mix(1.0, 0.90, thick);
          col *= mix(vec3(1.0), vec3(1.02, 1.0, 0.86), lk * (1.0 - uNight));
          // forward scatter: the sun (or moon) burns through the thin parts
          float gm = pow(max(dot(dir, uSunDir), 0.0), mix(24.0, 48.0, uNight));
          col += uSunGlow * gm * mix(0.55, 0.50, uNight) * (1.0 - thick * 0.8) * (1.0 - 0.7 * uDusk);
          return vec4(col, dens + fringe * 0.5);
        }
        uniform vec4 uShelterA, uShelterB, uShelterC;
        uniform vec2 uRes, uShelterShift;
        // signed distance from a point to one of the words' boxes, rounded to
        // a lozenge (negative inside). Both are in frame HEIGHTS, so the
        // clearing runs as far left and right of the words as above and below
        float boxDist(vec2 p, vec4 r, vec2 s) {
          if (r.z <= r.x) return 1e3;
          vec2 c = 0.5 * (r.xy + r.zw) * s, h = 0.5 * (r.zw - r.xy) * s;
          float rad = min(min(h.x, h.y), 0.12);
          vec2 d = abs(p - c) - (h - rad);
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - rad;
        }
        // the soft union of two distances: where two boxes meet, the join is
        // a curve, not a notch
        float smin(float a, float b, float k) {
          float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
          return mix(b, a, h) - k * h * (1.0 - h);
        }
        float shelterDist(vec2 p, vec2 warp, vec2 s) {
          p += warp;
          return smin(smin(boxDist(p, uShelterA, s), boxDist(p, uShelterB, s), 0.08), boxDist(p, uShelterC, s), 0.08);
        }
        void main() {
          vec3 dir = normalize(vDir);
          if (uClouds <= 0.001 || dir.y < -0.05) discard;
          // project the dome onto a flat cloud deck overhead: perspective
          // flattens the field toward the horizon, as a real sky does
          vec2 p0 = dir.xz / (max(dir.y, 0.0) + 0.5) * 0.85;
          vec2 drift = uCloudT * vec2(0.005, 0.002);
          float nearMoon = pow(max(dot(dir, uMoonDir), 0.0), 80.0);
          float th0 = mix(0.80, 0.46, clamp(uCover + uCoverBoost, 0.0, 1.0));
          // text shelter: where the page's words sit there are FEWER clouds -
          // the deck's threshold rises there, so the masses shrink and part
          vec2 sc = gl_FragCoord.xy / uRes; sc.y = 1.0 - sc.y; sc -= uShelterShift;
          vec2 s = vec2(uRes.x / uRes.y, 1.0);
          float shelter = 0.0;
          // only when a real shelter rect was fed in (reach > 0); with no
          // hero text there is nothing to part the deck around, and the
          // empty rects would otherwise carve a hard rectangle into it
          if (uShelterReach > 0.0 && shelterDist(sc * s, vec2(0.0), s) < uShelterReach + 0.06) {
            vec2 warp = (vec2(fbm3(p0 * 1.6 + drift + 5.0), fbm3(p0 * 1.6 + drift + 19.0)) - 0.5) * 0.08
                      + (vec2(fbm3(p0 * 4.5 + drift * 1.2 + 83.0), fbm3(p0 * 4.5 + drift * 1.2 + 97.0)) - 0.5) * 0.04;
            float d = shelterDist(sc * s, warp, s);
            shelter = 1.0 - smoothstep(0.06, uShelterReach, d);
            float margin = 1.0 - smoothstep(0.06, 0.14, d);
            shelter = mix(shelter * (0.6 + 0.8 * fbm3(p0 * 7.0 + drift * 0.8 + 77.0)), shelter, margin);
            th0 += 0.6 * shelter;
            th0 = max(th0, 1.3 * margin);
          }
          float feather = smoothstep(0.0, 0.45, shelter);
          // TWO decks for depth: a far one of smaller puffs, drifting slower
          // and a shade paler with distance, and the near one of big masses
          vec4 far = deck(dir, p0, drift * 0.6, 2.1, 41.0, th0 + 0.06, nearMoon, feather);
          far.rgb = mix(far.rgb, mix(vec3(0.82, 0.62, 0.48), vec3(0.030, 0.034, 0.050), uNight), 0.22);
          vec4 near = deck(dir, p0, drift, 1.0, 0.0, th0, nearMoon, feather);
          float alpha = near.a + far.a * 0.7 * (1.0 - near.a);
          vec3 col = (near.rgb * near.a + far.rgb * far.a * 0.7 * (1.0 - near.a)) / max(alpha, 1e-4);
          alpha *= uClouds;
          float gm = pow(max(dot(dir, uSunDir), 0.0), mix(24.0, 90.0, uNight));
          // high cirrus: a faint, streaky veil far above the decks
          vec2 pc = dir.xz / (max(dir.y, 0.0) + 0.5) * 0.55;
          vec2 q = vec2(pc.x * 0.8 + pc.y * 0.6, -pc.x * 0.6 + pc.y * 0.8);
          q = vec2(q.x * 0.5, q.y * 1.3) + drift * 0.35;
          float cir = fbm(q + 7.0) * 0.5 + fbm(q * 3.1 + 2.0) * 0.5;
          float cirMask = smoothstep(0.42, 0.64, fbm3(pc * 0.45 + drift * 0.2 + 11.0));
          float cirA = smoothstep(0.58, 0.82, cir) * 0.16 * cirMask * smoothstep(0.0, 0.5, uCover) * uClouds
                     * (1.0 - nearMoon * 0.6) * (1.0 - shelter);
          vec3 cirCol = mix(mix(vec3(0.98, 0.99, 1.02), vec3(1.1, 0.9, 0.82), uDusk), vec3(0.030, 0.034, 0.050), uNight);
          cirCol += uSunGlow * gm * mix(0.35, 0.25, uNight) * (1.0 - 0.6 * uDusk);
          float aAll = 1.0 - (1.0 - alpha) * (1.0 - cirA);
          col = (col * alpha + cirCol * cirA * (1.0 - alpha)) / max(aAll, 1e-4);
          // the deck thins toward the horizon
          alpha = aAll * mix(smoothstep(-0.03, 0.10, dir.y), smoothstep(-0.05, 0.02, dir.y), uNight);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );
}

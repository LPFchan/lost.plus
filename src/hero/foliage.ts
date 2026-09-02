// Wind GLSL + the leaf material from the Fable hero. The wind is three sine
// layers gated by a per-vertex "flex" (0 at the trunk, 1 at the tips), plus
// a damped spring where the bird last landed.

import * as THREE from 'three';

export const WIND_GLSL = /* glsl */ `
  uniform float uLag;
  uniform vec4 uLand;   // a landing: the perch (xyz) and the time it took the weight (w) - the wood there dips and springs back
  uniform vec3 uLandK;  // that perch's spring: amplitude (m), angular frequency, decay - a twig slow and deep, a bough short and firm
  float landSpring(vec3 wp, float flex, float t) {
    float lt = t - uLand.w;
    if (lt <= 0.0 || lt > 3.0) return 0.0;
    float prox = 1.0 - smoothstep(0.0, 0.9, distance(wp, uLand.xyz)); // the wood near the perch, fading out along the branch
    return -sin(lt * uLandK.y) * exp(-lt * uLandK.z) * uLandK.x * (0.3 + 0.7 * flex) * prox;  // an immediate dip, then fading bounces
  }
  // wood, not rubber: a branch bends as ONE piece (the phase changes slowly
  // across the canopy, so neighbouring points move together instead of
  // rippling along the twig), the wood near the trunk barely moves (the
  // amplitude rises steeply toward the tips), and the quick tremble lives
  // in the outermost twigs only
  vec3 windSway(vec3 wp, float flex, float t, float wind) {
    float ph = wp.x * 0.7 + wp.z * 0.5 + wp.y * 0.3 - flex * 0.6 * uLag;
    float s1 = sin(t * 1.05 + ph);
    float s2 = sin(t * 2.30 + ph * 1.6 + 1.3);
    float s3 = sin(t * 4.70 + ph * 2.9 + 4.1) * flex * flex;
    float amp = wind * flex * flex * (0.35 + 0.65 * flex);
    vec3 dir = vec3(0.72, 0.18, 0.55);
    return dir * (s1 * 0.58 + s2 * 0.24 + s3 * 0.07) * amp * 0.085
         + vec3(0.0, 1.0, 0.0) * ((s2 * 0.45 + s3 * 0.15) * amp * 0.028 + landSpring(wp, flex, t));
  }
`;

export type WindUniforms = {
  uTime: { value: number };
  uWind: { value: number };
  uLag: { value: number };
  uLand: { value: THREE.Vector4 };
  uLandK: { value: THREE.Vector3 };
};

export function makeWindUniforms(): WindUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: 0.42 },
    uLag: { value: 1 },
    uLand: { value: new THREE.Vector4(0, 0, 0, -100) },
    uLandK: { value: new THREE.Vector3(0.02, 15, 3.4) },
  };
}

/** Bark: a MeshStandardMaterial with the wind sway injected. */
export function makeBarkMaterial(
  wind: WindUniforms,
  barkDiff: THREE.Texture,
  barkNorm: THREE.Texture,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    map: barkDiff,
    normalMap: barkNorm,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.uniforms.uWind = wind.uWind;
    shader.uniforms.uLag = wind.uLag;
    shader.uniforms.uLand = wind.uLand;
    shader.uniforms.uLandK = wind.uLandK;
    shader.vertexShader =
      'attribute float aFlex;\nuniform float uTime;\nuniform float uWind;\n' +
      WIND_GLSL +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += windSway(position, aFlex, uTime, uWind);',
      );
  };
  return mat;
}

export type LeafMaterial = {
  material: THREE.ShaderMaterial;
  uniforms: {
    uSunCol: { value: THREE.Color };
    uSkyCol: { value: THREE.Color };
    uGroundCol: { value: THREE.Color };
  };
};

/**
 * The leaf shader: flutter hinged at the petiole, EPISODIC not constant —
 * individual leaves burst into trembling as gust fronts travel through the
 * canopy — plus branch sway, sun/sky/ground lighting with translucency.
 */
export function makeLeafMaterial(
  wind: WindUniforms,
  map: THREE.Texture,
  shared: { uNight: { value: number }; uDusk: { value: number } },
  sunDir: { value: THREE.Vector3 },
): LeafMaterial {
  const uSunCol = { value: new THREE.Color('#fff3dc').multiplyScalar(1.7) };
  const uSkyCol = { value: new THREE.Color('#b8c9dc').multiplyScalar(0.64) };
  const uGroundCol = { value: new THREE.Color('#6b7355').multiplyScalar(0.6) };
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: map },
      uTime: wind.uTime,
      uWind: wind.uWind,
      uLag: wind.uLag,
      uLand: wind.uLand,
      uLandK: wind.uLandK,
      uInertia: { value: 1 },
      uNight: shared.uNight,
      uDusk: shared.uDusk,
      uSunDir: sunDir,
      uSunCol,
      uSkyCol,
      uGroundCol,
    },
    vertexShader: /* glsl */ `
      attribute mat4 instanceMatrix;
      attribute vec3 aTint;
      attribute vec3 aWindI;      // phase, flex, flutter scale
      attribute vec2 aUvCell;     // which of the 4 atlas leaves this instance wears
      varying vec2 vUv; varying vec3 vTint; varying vec3 vN; varying vec3 vW;
      uniform float uTime, uWind, uInertia;
      ${WIND_GLSL}
      void main() {
        vUv = uv * 0.5 + aUvCell; vTint = aTint;
        vec3 pos = position;
        vec3 nrm = normal;
        // flutter: hinge at the petiole (y = 0) — but EPISODIC, not constant.
        // Real aspen leaves mostly rest; individual leaves burst into
        // trembling as gust fronts travel through the canopy.
        vec3 org0 = instanceMatrix[3].xyz;
        float front = 0.70 + 0.30 * sin(uTime * 0.6 - (org0.x + org0.z) * 0.9 + aWindI.x * 0.4);
        float episode = sin(uTime * (0.45 + fract(aWindI.x * 0.618) * 0.5) + aWindI.x * 7.0);
        // activity SWELLS in across most of the cycle - no sudden wake-up tingle
        float burst = smoothstep(0.12, 0.95, episode * 0.5 + 0.5);
        float fl = uWind * (0.35 + 0.65 * aWindI.y) * aWindI.z
                 * (0.30 + 0.70 * burst) * front;
        float ang = (sin(uTime * 3.1 + aWindI.x) * 0.45
                   + sin(uTime * 6.7 + aWindI.x * 1.7) * 0.25) * fl;
        // Inertia toggle: gust kick, overshoot, ringing settle - like a spring
        float tauI = fract((uTime * (0.45 + fract(aWindI.x * 0.618) * 0.5) + aWindI.x * 7.0) * 0.159155);
        float ringI = exp(-tauI * 3.2) * sin(tauI * 44.0 + aWindI.x);
        float angI = ringI * uWind * (0.35 + 0.65 * aWindI.y) * aWindI.z * front * 0.5;
        ang = mix(ang, angI, uInertia);
        // and a leaf is NEVER perfectly still: gentle ever-present breathing
        ang += sin(uTime * 1.6 + aWindI.x * 3.3) * 0.06 * uWind * (0.5 + 0.5 * aWindI.y);
        float ca = cos(ang), sa = sin(ang);
        pos = vec3(pos.x, ca * pos.y - sa * pos.z, sa * pos.y + ca * pos.z);
        nrm = vec3(nrm.x, ca * nrm.y - sa * nrm.z, sa * nrm.y + ca * nrm.z);
        vec4 wp = instanceMatrix * vec4(pos, 1.0);
        vec3 nw = normalize(mat3(instanceMatrix) * nrm);
        wp.xyz += windSway(instanceMatrix[3].xyz, aWindI.y, uTime, uWind);
        vW = wp.xyz; vN = nw;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol;
      uniform float uNight, uDusk;
      varying vec2 vUv; varying vec3 vTint; varying vec3 vN; varying vec3 vW;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.5) discard;
        vec3 albedo = tex.rgb * vTint;
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) {
          N = -N;
          // aspen-pale underside (kept subtle so shade stays shaded)
          albedo = albedo * vec3(1.18, 1.15, 1.06) + 0.03;
        }
        float ndl = dot(N, uSunDir);
        float diff = max(ndl, 0.0);
        float hemi = 0.5 + 0.5 * N.y;
        vec3 amb = mix(uGroundCol, uSkyCol, hemi);
        float trans = max(-ndl, 0.0);
        vec3 V = normalize(cameraPosition - vW);
        float spec = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 24.0);
        vec3 col = albedo * (amb + uSunCol * diff)
                 + albedo * uSunCol * trans * mix(vec3(1.0, 0.98, 0.55), vec3(0.75, 0.85, 1.0), uNight) * (mix(0.7, 0.35, uNight) + 0.35 * uDusk)
                 + uSunCol * spec * mix(0.06, 0.14, uNight); // moonlight glints harder
        // sun-washed blades: strongly lit surfaces go LIGHTER and PALER
        float energy = diff + trans * 0.7;
        float wash = smoothstep(0.55, 1.35, energy);
        float lumaW = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lumaW) * 1.28 + 0.055, wash * 0.5 * (1.0 - uNight * 0.9));
        // pull toward the muted khaki-olive
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, mix(0.80, 0.55, uNight)); // moonlight drains colour
        col = mix(col, col * vec3(0.8, 0.9, 1.15), uNight * 0.6); // and what is left is blue
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return { material, uniforms: { uSunCol, uSkyCol, uGroundCol } };
}

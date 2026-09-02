// Where the sun is over Seoul, and how to dress the sky for it.
//
// The launcher is yeowool's, she lives on KST, so the backdrop rides the sun
// over Seoul (37.5665 N, 126.9780 E) rather than the visitor's clock. The
// math is the standard NOAA solar-position approximation: declination from
// the day of year, hour angle from the solar time, elevation and azimuth
// from the two. Accurate to a minute or two of arc, which is far past what a
// gradient needs.

const SEOUL_LAT = 37.5665;
const SEOUL_LON = 126.978;

const rad = (d: number) => (d * Math.PI) / 180;

export type SunState = {
  /** degrees above the horizon; negative at night */
  elevation: number;
  /** degrees clockwise from north */
  azimuth: number;
  /** fractional day 0..1 in KST */
  dayFrac: number;
};

export function sunOverSeoul(date = new Date()): SunState {
  // KST is a fixed UTC+9 with no DST, so the clock is trivial.
  const kst = new Date(date.getTime() + (9 * 60 + date.getTimezoneOffset()) * 60000);
  const start = new Date(kst.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((kst.getTime() - start.getTime()) / 86400000);
  const dayFrac =
    (kst.getHours() * 3600 + kst.getMinutes() * 60 + kst.getSeconds()) / 86400;

  // NOAA: fractional year -> declination + equation of time.
  const g = (2 * Math.PI * (dayOfYear - 1 + dayFrac - 0.5)) / 365;
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));

  const trueSolarMin = dayFrac * 1440 + eqTime + 4 * SEOUL_LON - 540; // KST meridian is 135E
  const ha = rad(trueSolarMin / 4 - 180);
  const lat = rad(SEOUL_LAT);

  const cosZen =
    Math.sin(lat) * Math.sin(decl) +
    Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const elevation =
    90 - (Math.acos(Math.min(1, Math.max(-1, cosZen))) * 180) / Math.PI;
  const az =
    (Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat),
    ) *
      180) /
      Math.PI +
    180;

  return { elevation, azimuth: ((az % 360) + 360) % 360, dayFrac };
}

const ramp = (e: number, lo: number, hi: number) => {
  const t = Math.min(1, Math.max(0, (e - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/**
 * Palette mixes from elevation. Four looks, as on the Anthropic page, but
 * continuous: dusk and morning are the same event seen leaving and arriving,
 * told apart by which half of the sky the sun is in (azimuth under 180 is
 * the eastern half = morning).
 */
export function lookMix(sun: SunState): {
  day: number;
  dusk: number;
  night: number;
  morning: number;
} {
  const e = sun.elevation;
  const night = 1 - ramp(e, -14, -4);
  const twilight = ramp(e, -10, -2) * (1 - ramp(e, 3, 9));
  const morningSide = sun.azimuth < 180;
  const dusk = twilight * (morningSide ? 0 : 1);
  const morning = twilight * (morningSide ? 1 : 0);
  const day = Math.max(0, 1 - night - dusk - morning);
  return { day, dusk, night, morning };
}

/**
 * The light source as a scene direction for the hero's 21-degree frame.
 * The camera looks roughly south and slightly up (-z); elevation rides the
 * frame's vertical window, azimuth slides it sideways (east left of frame in
 * the morning, west right in the evening — the scene looks south). Below the
 * horizon the same slot hands over to the moon.
 */
export function sunSceneDir(sun: SunState): {
  dir: [number, number, number];
  above: number;
} {
  // above: 1 when the sun lights the scene, 0 when the moon does
  const above = ramp(sun.elevation, -2, 4);
  const el = rad(Math.min(38, Math.max(-4, sun.elevation)));
  // azimuth: 90 = east, 270 = west. The camera faces south (-z), so east is
  // +x in the left of frame... the hero's scene has the sun arcing right:
  // morning light comes from frame-left, evening from frame-right.
  const azFromSouth = rad(sun.azimuth - 180);
  const x = -Math.sin(azFromSouth) * Math.cos(el);
  const y = Math.sin(el);
  const z = -Math.cos(azFromSouth) * Math.cos(el) * 0.6 - 0.4; // bias into the scene
  const l = Math.hypot(x, y, z) || 1;
  return { dir: [x / l, y / l, z / l], above };
}

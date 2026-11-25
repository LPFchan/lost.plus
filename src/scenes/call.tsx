import { useMemo } from 'react';
import { box, curve, ring, rng, scribble, stroke, strokes, type Pt, type Rand } from '../ink';
import { Art, Label, Knot, Sky, Scene } from '../kit';
import './call.css';
import { call } from '../i18n';

// 7: one real call. The agent is working late, hits a thing only its owner
// can decide, and rings. It asks, it hears the answer, and it carries on.

/** a rounded rectangle walked at an even step, so the pen never overshoots
    a corner, and wobbling the way a hand does */
function roundRect(r: Rand, x: number, y: number, w: number, h: number, rad: number, wob = 0.6): string {
  const pts: Pt[] = [];
  const put = (px: number, py: number) => pts.push([px + (r() - 0.5) * wob * 2, py + (r() - 0.5) * wob * 2]);
  const step = 7;
  const arc = (cx: number, cy: number, a0: number) => {
    const n = Math.max(3, Math.round((rad * Math.PI) / 2 / step));
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      put(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
  };
  const edge = (a: Pt, b: Pt) => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 1; i < n; i++) put(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n);
  };
  arc(x + w - rad, y + rad, -90);
  edge([x + w, y + rad], [x + w, y + h - rad]);
  arc(x + w - rad, y + h - rad, 0);
  edge([x + w - rad, y + h], [x + rad, y + h]);
  arc(x + rad, y + h - rad, 90);
  edge([x, y + h - rad], [x, y + rad]);
  arc(x + rad, y + rad, 180);
  edge([x + rad, y], [x + w - rad, y]);
  return curve([...pts, pts[0], pts[1], pts[2]]);
}

/** two short strokes, for the head of a line */
function head(r: Rand, at: Pt, ang: number, len = 12): string {
  return (
    stroke(r, [at[0] - Math.cos(ang - 0.5) * len, at[1] - Math.sin(ang - 0.5) * len], at, 0.3) +
    stroke(r, [at[0] - Math.cos(ang + 0.5) * len, at[1] - Math.sin(ang + 0.5) * len], at, 0.3)
  );
}

const PHONE: Pt = [728, 138];

function Call() {
  const phone = useMemo(() => {
    const r = rng(140);
    return {
      body: roundRect(r, -39, -76, 78, 152, 13),
      screen: roundRect(r, -31, -64, 62, 128, 8, 0.4),
      slit: stroke(r, [-10, -70], [8, -70], 0.3),
      eye: ring(r, 16, -70, 2.4, 2.4, 0.2),
      keys: stroke(r, [41.5, -34], [41.5, -12], 0.2) + stroke(r, [-41.5, -40], [-41.5, -28], 0.2) + stroke(r, [-41.5, -22], [-41.5, -10], 0.2),
      // who is calling: lost.plus's mark in a ring, and a name under it
      face: ring(r, 0, -30, 13, 13, 0.4) + scribble(r, -15, -6, 30, 1) + scribble(r, -9, 3, 18, 0.8),
      plus: stroke(r, [0, -37], [0, -23], 0.3) + stroke(r, [-7, -30], [7, -30], 0.3),
      // decline, and answer
      no: ring(r, -15, 40, 9, 9, 0.3) + stroke(r, [-18.5, 36.5], [-11.5, 43.5], 0.2) + stroke(r, [-11.5, 36.5], [-18.5, 43.5], 0.2),
      yes: ring(r, 15, 40, 9, 9, 0.3),
      handset: curve([[10.5, 37.5], [11.5, 41.5], [15, 43.6], [18.5, 43]]) + stroke(r, [10, 37], [12.2, 36.2], 0.1) + stroke(r, [18.2, 44.2], [19.6, 42.2], 0.1),
    };
  }, []);

  const rings = useMemo(() => {
    const r = rng(141);
    return [68, 92, 117, 144].map((rad) => ring(r, PHONE[0], PHONE[1], rad, rad * 0.96, 1.3));
  }, []);

  // the desk nobody is sitting at: the screen still lit, the chair pushed back
  const desk = useMemo(() => {
    const r = rng(143);
    return {
      lines:
        strokes(r, [[286, 176], [512, 176], [512, 185], [286, 185]], 0.5, true) +
        box(r, 300, 185, 8, 51, 0.4) +
        box(r, 490, 185, 8, 51, 0.4) +
        // the monitor on its stand, a keyboard, a mug
        box(r, 340, 76, 128, 82, 0.7) +
        stroke(r, [404, 158], [404, 171], 0.3) +
        stroke(r, [382, 173], [426, 173], 0.4) +
        box(r, 306, 167, 60, 6, 0.3) +
        box(r, 478, 159, 14, 15, 0.3) +
        curve([[492, 163], [498, 164], [498, 170], [492, 171]]) +
        // the chair: its back, the seat, the post, the feet
        roundRect(r, 198, 122, 13, 62, 6, 0.4) +
        strokes(r, [[205, 186], [262, 186], [262, 196], [205, 196]], 0.4, true) +
        stroke(r, [233, 196], [233, 222], 0.3) +
        curve([[208, 232], [220, 224], [233, 222], [246, 224], [258, 232]]) +
        ring(r, 208, 234, 2.6, 2.6, 0.2) +
        ring(r, 258, 234, 2.6, 2.6, 0.2),
      floor: stroke(r, [176, 237], [270, 237], 0.6) + stroke(r, [282, 237], [530, 237], 0.6),
      work: scribble(r, 352, 96, 84, 1.3) + scribble(r, 352, 110, 58, 1.3) + scribble(r, 352, 124, 96, 1.3),
      caret: box(r, 352, 134, 5, 9, 0.2),
    };
  }, []);

  // out to the phone when it rings. The head is drawn solid, off the
  // dotted line, so it lands.
  const out = useMemo(() => {
    const r = rng(144);
    return {
      line: strokes(r, [[482, 122], [530, 132], [588, 140], [634, 143]], 0.8),
      tip: head(r, [640, 143], 0.05),
    };
  }, []);

  return (
    <Art
      h={452}
      x={[150, 895]}
      labels={
        <>
          <Label at={[404, 52]}>{call.yourAgent}</Label>

          <Label at={[186, 304]} from="left">
            <span className="call-who">{call.agent}</span>
            <span className="call-said">&ldquo;{call.asks[0]}<br />{call.asks[1]}&rdquo;</span>
          </Label>
          <Label at={[322, 390]} from="left">
            <span className="call-who">{call.you}</span>
            <span className="call-said">&ldquo;{call.answer}&rdquo;</span>
          </Label>
        </>
      }
    >
      <Sky seed={142} h={452} n={60} />

      {rings.map((d, i) => (
        <path key={i} d={d} className="gold" style={{ opacity: 0.9 - i * 0.19 }} />
      ))}

      <path d={out.line} className="gold dash wide" />
      <path d={out.tip} className="gold" />

      {/* the desk, with nobody at it */}
      <rect x={345} y={81} width={118} height={72} className="lit" />
      <path d={desk.lines} />
      <path d={desk.floor} className="soft thin" />
      <path d={desk.work} className="soft thin" />
      <path d={desk.caret} className="thin" />

      {/* the phone, lit, in the dark */}
      <g transform={`translate(${PHONE[0]} ${PHONE[1]}) scale(1.22)`}>
        <path d={phone.body} className="back" />
        <path d={phone.screen} style={{ fill: 'var(--thread)', fillOpacity: 0.85 }} className="none" />
        <path d={phone.body} />
        <path d={phone.keys} />
        <path d={phone.screen} className="thin" />
        <path d={phone.slit} className="thin" />
        <path d={phone.eye} className="thin" />
        <g className="ink">
          <path d={phone.face} className="thin" />
          <path d={phone.plus} />
          <path d={phone.no} className="thin" />
          <path d={phone.yes} style={{ fill: '#211811' }} />
          <path d={phone.handset} style={{ stroke: 'var(--thread)' }} />
        </g>
      </g>

      <Knot at={PHONE} />
      <Knot at={[770, 430]} />
    </Art>
  );
}

export default function CallScene() {
  return <Scene seed={32} title={call.title} side="right" art={<Call />} />;
}

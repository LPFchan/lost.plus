import { useMemo } from 'react';
import { box, curve, ring, rng, stroke, strokes, type Pt, type Rand } from '../ink';
import { Art, Label, Paper, Knot, Glyph, Sky, Scene } from '../kit';
import { t } from '../i18n';

// 6: the two sites, and the two boxes in the room that answer them. A
// search is typed in plain words; what it finds are files on disks of
// yours. Beside it, the photo library: a few prints.

/** the search bar */
const BAR = { x: 62, y: 66, w: 430, h: 56, rot: -1.2 };

/** the files a search turns up: where each sheet sits, and what is on it.
    The last one is the one that was looked for. */
const FILES: { at: Pt; rot: number; kind: 'text' | 'picture' | 'table' }[] = [
  { at: [112, 206], rot: -5, kind: 'picture' },
  { at: [212, 200], rot: 3, kind: 'table' },
  { at: [312, 208], rot: -2, kind: 'text' },
  { at: [420, 196], rot: 5, kind: 'text' },
];
const FILE = { w: 62, h: 78 };

/** what is written on a file, around its middle */
function file(r: Rand, kind: 'text' | 'picture' | 'table'): string {
  // the turned corner
  const fold = strokes(r, [[13, -39], [13, -21], [31, -21]], 0.3);
  if (kind === 'picture')
    return fold + strokes(r, [[-20, 22], [-8, 2], [2, 14], [10, 4], [20, 22]], 0.4) + ring(r, -10, -14, 5, 5, 0.3);
  if (kind === 'table')
    return (
      fold +
      [-6, 8, 22].map((y) => stroke(r, [-20, y], [20, y], 0.3)).join('') +
      stroke(r, [-6, -6], [-6, 22], 0.3)
    );
  return fold + [-8, 4, 16].map((y, i) => stroke(r, [-20, y], [i === 2 ? 4 : 20, y], 0.3)).join('');
}

/** the photo library: three prints, fanned */
const PRINTS: { at: Pt; rot: number }[] = [
  { at: [716, 132], rot: -8 },
  { at: [872, 128], rot: 7 },
  { at: [794, 112], rot: 1.5 },
];
const PRINT = { w: 112, h: 88, edge: 8 };

/** what each print is of, around its middle: a few strokes apiece */
const SHOTS: ((r: Rand) => string)[] = [
  // the sea, and the sun going into it
  (r) => stroke(r, [-44, 10], [44, 10], 0.4) + curve([[-14, 10], [-10, -4], [0, -9], [10, -4], [14, 10]]) + stroke(r, [-26, 22], [-8, 22], 0.3) + stroke(r, [6, 26], [26, 26], 0.3),
  // a road going off to the horizon
  (r) => stroke(r, [-44, -6], [44, -6], 0.4) + stroke(r, [-26, 34], [-2, -6], 0.4) + stroke(r, [30, 34], [4, -6], 0.4),
  // mountains, and the sun over them
  (r) => strokes(r, [[-46, 26], [-18, -10], [-2, 12], [14, -2], [46, 26]], 0.5) + ring(r, 26, -18, 7, 7, 0.3),
];

const FLOOR = 470;

/** text laid on the tilted bar lies along it */
const along = (text: string) => <span style={{ display: 'inline-block', rotate: `${BAR.rot}deg` }}>{text}</span>;

/** asleep under the desk: the one fox on the page */
function fox(r: Rand): string {
  const w = 0.5;
  const line = (pts: Pt[]) => curve(pts.map(([x, y]) => [x + (r() - 0.5) * w, y + (r() - 0.5) * w] as Pt));
  return (
    // the back, from the rump round to the neck
    line([[-50, 8], [-52, -14], [-38, -32], [-12, -38], [12, -34], [28, -24]]) +
    // the head, laid on the tail, nose to the right
    line([[28, -24], [38, -28], [56, -18], [76, -6], [58, -1], [44, 1]]) +
    // ears
    line([[30, -25], [30, -48], [41, -29]]) +
    line([[41, -29], [48, -50], [53, -23]]) +
    // a shut eye, and the nose
    line([[51, -14], [55, -12], [59, -14]]) +
    line([[73, -7], [76, -5], [74, -4]]) +
    // the tail, brought round in front: its underside, then its top
    line([[-50, 8], [-68, 10], [-66, 18], [-30, 19], [10, 18], [40, 14], [58, 6]]) +
    line([[58, 6], [38, 1], [10, -2], [-16, 2], [-32, 8]]) +
    // where the white tip begins
    line([[33, 15], [38, 11], [34, 8], [39, 4], [36, 1]])
  );
}

function Cloud() {
  // the magnifying glass on the bar
  const glass = useMemo(() => {
    const r = rng(121);
    return ring(r, BAR.x + 30, BAR.y + 26, 10, 10, 0.4) + stroke(r, [BAR.x + 37, BAR.y + 34], [BAR.x + 47, BAR.y + 45], 0.4);
  }, []);
  const files = useMemo(() => FILES.map((f, i) => file(rng(140 + i), f.kind)), []);
  const shots = useMemo(() => SHOTS.map((draw, i) => draw(rng(150 + i))), []);

  const room = useMemo(() => {
    const r = rng(124);
    return (
      // the floor
      stroke(r, [66, FLOOR], [916, FLOOR], 1.1) +
      // the desk: a top that overhangs two legs
      strokes(r, [[112, 398], [352, 398], [352, 408], [112, 408]], 0.5, true) +
      box(r, 146, 408, 9, FLOOR - 408, 0.4) +
      box(r, 309, 408, 9, FLOOR - 408, 0.4) +
      // the cabinet, open at the front, a shelf across it
      box(r, 676, 320, 224, 150, 0.8) +
      stroke(r, [676, 392], [900, 392], 0.6)
    );
  }, []);

  const clutter = useMemo(() => {
    const r = rng(125);
    return (
      // where the wall meets the floor, behind everything
      stroke(r, [66, FLOOR - 15], [142, FLOOR - 15], 0.4) +
      stroke(r, [360, FLOOR - 15], [634, FLOOR - 15], 0.4) +
      // a socket on the wall, and the cord from it to the power brick
      box(r, 640, 428, 20, 18, 0.4) +
      stroke(r, [645, 434], [645, 440], 0.3) +
      stroke(r, [654, 434], [654, 440], 0.3) +
      curve([[660, 440], [672, 446], [684, 440], [694, 436]]) +
      // a coiled cable and a power brick on the lower shelf
      ring(r, 852, 432, 19, 15, 0.5) +
      ring(r, 852, 432, 10, 8, 0.4) +
      box(r, 694, 418, 54, 28, 0.5) +
      curve([[748, 432], [776, 442], [804, 424], [830, 434]])
    );
  }, []);

  // the sites reach no further than the boxes in the room; the thread
  // itself runs from the file that was found to the box it is on
  const wires = useMemo(
    () =>
      curve([[112, 252], [130, 290], [176, 330], [228, 370]]) +
      curve([[872, 182], [880, 232], [862, 282], [858, 318]]),
    [],
  );

  const asleep = useMemo(() => fox(rng(127)), []);

  return (
    <Art
      h={520}
      x={[50, 950]}
      labels={
        <>
          <Label at={[66, 44]} from="left">shares.lost.plus</Label>
          <Label at={[794, 36]}>photos.lost.plus</Label>
          <Label at={[BAR.x + 62, BAR.y + 29]} from="left" paper>{along(t.search)}</Label>
          <Label at={[232, 496]}>{t.machines.laptop}</Label>
          <Label at={[788, 496]}>{t.machines.nas}</Label>
        </>
      }
    >
      <Sky seed={129} h={300} n={64} />

      <path d={room} />
      <path d={clutter} className="soft" />
      <Glyph kind="laptop" at={[232, 376]} seed={130} s={1.6} />
      <Glyph kind="nas" at={[788, 366]} seed={131} s={1.6} />
      <g transform="translate(240 453) scale(0.75)">
        <path d={asleep} />
      </g>
      <path d={wires} className="soft dash wide" />

      <Paper seed={132} x={BAR.x} y={BAR.y} w={BAR.w} h={BAR.h} rot={BAR.rot} />
      <g className="ink" transform={`rotate(${BAR.rot} ${BAR.x + BAR.w / 2} ${BAR.y + BAR.h / 2})`}>
        <path d={glass} />
      </g>

      {FILES.map((f, i) => {
        const found = i === FILES.length - 1;
        return (
          <g key={i} transform={`rotate(${f.rot} ${f.at[0]} ${f.at[1]})`}>
            <Paper seed={160 + i} x={f.at[0] - FILE.w / 2} y={f.at[1] - FILE.h / 2} w={FILE.w} h={FILE.h} tone={found ? undefined : 'var(--tan)'} />
            <g className="ink" transform={`translate(${f.at[0]} ${f.at[1]})`}>
              <path d={files[i]} className={found ? undefined : 'soft'} />
            </g>
          </g>
        );
      })}

      {PRINTS.map((p, i) => (
        <g key={i} transform={`rotate(${p.rot} ${p.at[0]} ${p.at[1]})`}>
          <Paper seed={170 + i} x={p.at[0] - PRINT.w / 2} y={p.at[1] - PRINT.h / 2} w={PRINT.w} h={PRINT.h} />
          <rect
            x={p.at[0] - PRINT.w / 2 + PRINT.edge}
            y={p.at[1] - PRINT.h / 2 + PRINT.edge}
            width={PRINT.w - PRINT.edge * 2}
            height={PRINT.h - PRINT.edge * 2}
            style={{ fill: 'var(--tan)', stroke: 'none' }}
          />
          <g className="ink" transform={`translate(${p.at[0]} ${p.at[1]})`}>
            <path d={shots[i]} />
          </g>
        </g>
      ))}

      <Knot at={[FILES[3].at[0], FILES[3].at[1]]} />
      <Knot at={[788, 366]} />
    </Art>
  );
}

export default function CloudScene() {
  return (
    <Scene
      seed={28}
      title={t.cloud}
      art={<Cloud />}
    />
  );
}

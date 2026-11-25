import { useMemo, type CSSProperties } from 'react';
import { ring, rng, tearAround } from '../ink';
import {
  Art, AUTH, Glyph, Knot, Label, Scene, Scrap, type Kind,
} from '../kit';
import './join.css';
import { t } from '../i18n';

// 9: the thread's last stop. Three of the machines already on it, standing
// in a row, and at the end of the row the place nobody is in yet. The page's
// last knot is tied inside it, so the thread stops at the visitor's machine.

const BASE = 152; // the line they all stand on
const FOOT: Record<Kind, number> = { laptop: 14, tower: 22, nas: 15, rack: 17, mini: 8, phone: 16, term: 14 };

// low, taller, tallest: the row climbs
const ON: [string, Kind][] = [[t.machines.mini, 'mini'], [t.machines.nas, 'nas'], [t.machines.desktop, 'tower']];
const AT = [235, 385, 550]; // closer on the left: the last name is the longest
const S = 1.9;
const MINE = 760;
const MINE_S = 2.9;
const MINE_Y = BASE - FOOT.laptop * MINE_S - 5 * MINE_S; // the middle of the empty screen

// a torn card under each machine. It is paper in the page, not in the
// drawing, so it is as wide as the name on it in any language.
const CARD_Y = 182;
const TILT = [-1.2, 0.8, -0.6, 1.4];
const card = (i: number, tone: string) =>
  ({ '--tear': tearAround(120 + i * 3, 3, 7, 3), '--tone': tone, '--tilt': `${TILT[i]}deg` }) as CSSProperties;

function End() {
  const tie = useMemo(() => ring(rng(77), MINE, MINE_Y, 8.5, 7, 0.7), []);
  return (
    <Art
      h={212}
      x={[195, 845]}
      labels={
        <>
          {ON.map(([name], i) => (
            <Label key={name} at={[AT[i], CARD_Y]} paper>
              <span className="scrap join-card" style={card(i, '#fffaf3')}>{name}</span>
            </Label>
          ))}
          <Label at={[MINE, CARD_Y]} paper>
            <span className="scrap join-card" style={card(3, 'var(--tan)')}>{t.yours}</span>
          </Label>
        </>
      }
    >
      {ON.map(([name, kind], i) => {
        const at: [number, number] = [AT[i], BASE - FOOT[kind] * S];
        return (
          <g key={name}>
            <Glyph kind={kind} at={at} seed={60 + i * 7} s={S} className="soft" />
            <circle cx={at[0]} cy={at[1]} r={2.6} className="dot gold" />
            <Knot at={at} />
          </g>
        );
      })}
      <Glyph kind="laptop" at={[MINE, BASE - FOOT.laptop * MINE_S]} seed={111} s={MINE_S} className="dash wide" />
      <path d={tie} className="gold" />
      <Knot at={[MINE, MINE_Y]} />
    </Art>
  );
}

export default function JoinScene() {
  return (
    <Scene
      seed={36}
      title={t.join}
      side="center"
      art={<End />}
      after={
        <Scrap seed={45} tag="a" tone="var(--ink)" className="door join-door" href={AUTH}>
          {t.door}
        </Scrap>
      }
    />
  );
}

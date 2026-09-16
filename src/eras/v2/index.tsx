// Era v2: a watchOS-style list. Everything rests small, dim and grey; the
// rows around the pointer (or the finger) magnify along y with the same
// curve the v1 dock uses along x, and the one under it comes to life in
// colour. Hold there and a ring fills clockwise around its icon; when it
// closes, the row opens into a short description, a picture and links.
//
// Click or tap launches, as in v1. Only the dwell opens the detail.

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ENTRIES, Entry } from '../../entries';
import { magnify, MagnifyTuning } from '../../magnify';
import { EraProps } from '../types';
import { MacosIcon } from '../v1/Dock';

const TUNING: MagnifyTuning & { mass: number; stiffness: number; damping: number } = {
  size: 44, // row pitch at rest, px
  scale: 1.5,
  distance: 110,
  nudge: 22,
  mass: 0.05,
  stiffness: 220,
  damping: 13,
};

/** how long the pointer has to stay on a row before it opens, ms */
const DWELL_MS = 2000;
/** room above and below the list for the end rows to magnify into, px */
const PAD = 24;
/** a touch that travels further than this is a scrub, not a tap */
const TAP_SLOP = 10;

export default function V2(_: EraProps) {
  return (
    <main className="relative z-10 flex h-full items-center justify-center">
      <WatchList entries={ENTRIES} />
    </main>
  );
}

function WatchList({ entries }: { entries: Entry[] }) {
  const tuning = TUNING;
  const spring = useMemo(
    () => ({ mass: tuning.mass, stiffness: tuning.stiffness, damping: tuning.damping }),
    [tuning],
  );
  // pointer position along the list, in list pixels; -Infinity when away
  const pointerY = useMotionValue(-Infinity);
  const listRef = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // touch bookkeeping: where the finger went down and whether the dwell has
  // already opened the row (in which case lifting the finger is not a tap)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const opened = useRef(false);

  const rowAt = (y: number): string | null => {
    const i = Math.floor(y / tuning.size);
    return i >= 0 && i < entries.length ? entries[i].name : null;
  };

  const track = (e: ReactPointerEvent) => {
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top - PAD;
    if (expanded) return; // the open row holds still
    pointerY.set(y);
    setHot(rowAt(y));
  };

  const leave = () => {
    pointerY.set(-Infinity);
    setHot(null);
  };

  // the dwell: hold on a row for DWELL_MS and it opens
  useEffect(() => {
    if (!hot || expanded) return;
    const id = setTimeout(() => {
      opened.current = true;
      setExpanded(hot);
      pointerY.set(-Infinity);
    }, DWELL_MS);
    return () => clearTimeout(id);
  }, [hot, expanded, pointerY]);

  // Escape, or a press anywhere outside the open row, closes it
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(null);
    };
    const onDown = (e: PointerEvent) => {
      const row = listRef.current?.querySelector('[data-expanded]');
      if (row && !row.contains(e.target as Node)) setExpanded(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [expanded]);

  return (
    <div
      ref={listRef}
      className="v2-list"
      style={{ '--size': tuning.size + 'px', '--pad': PAD + 'px' } as React.CSSProperties}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' && touch.current) {
          const t = touch.current;
          if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) t.moved = true;
        }
        track(e);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        touch.current = { x: e.clientX, y: e.clientY, moved: false };
        opened.current = false;
        if (expanded) return;
        track(e);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        leave();
      }}
      onPointerCancel={leave}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        leave();
        setExpanded(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) => (
        <Row
          key={entry.name}
          entry={entry}
          index={i}
          pointerY={pointerY}
          tuning={tuning}
          spring={spring}
          hot={hot === entry.name && !expanded}
          expanded={expanded === entry.name}
          onClick={(e) => {
            // a scrub or a completed dwell is not a launch
            if (touch.current?.moved || opened.current) e.preventDefault();
          }}
        />
      ))}
    </div>
  );
}

function Row({
  entry,
  index,
  pointerY,
  tuning,
  spring,
  hot,
  expanded,
  onClick,
}: {
  entry: Entry;
  index: number;
  pointerY: ReturnType<typeof useMotionValue<number>>;
  tuning: MagnifyTuning;
  spring: { mass: number; stiffness: number; damping: number };
  hot: boolean;
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const center = index * tuning.size + tuning.size / 2;
  const distance = useTransform(() => {
    const p = pointerY.get();
    return p === -Infinity ? -Infinity : p - center;
  });
  const scale = useSpring(
    useTransform(() => magnify(distance.get(), tuning).scale),
    spring,
  );
  const y = useSpring(
    useTransform(() => magnify(distance.get(), tuning).x),
    spring,
  );
  // how alive the row is: 1 right under the pointer, fading to 0 a row away;
  // pinned at 1 while open
  const pinned = useMotionValue(0);
  useEffect(() => pinned.set(expanded ? 1 : 0), [expanded, pinned]);
  const heat = useSpring(
    useTransform(() => {
      const d = distance.get();
      const near = d === -Infinity ? 0 : Math.max(0, 1 - Math.abs(d) / tuning.size);
      return Math.max(near, pinned.get());
    }),
    { stiffness: 300, damping: 30 },
  );
  const grey = useTransform(heat, (h) => 1 - h);
  const filter = useMotionTemplate`grayscale(${grey})`;
  const opacity = useTransform(heat, (h) => 0.42 + 0.58 * h);
  const host = new URL(entry.href).host;

  return (
    <motion.div
      className="v2-row"
      data-expanded={expanded ? '' : undefined}
      style={{ y, scale, opacity }}
    >
      <a
        className="v2-head"
        href={entry.href}
        target="_blank"
        rel="noopener"
        draggable={false}
        onClick={onClick}
      >
        <motion.span className="v2-icon" style={{ filter }}>
          <MacosIcon entry={entry} alt="" />
          {hot && (
            <svg className="v2-ring" viewBox="0 0 40 40" aria-hidden="true">
              <motion.circle
                cx="20"
                cy="20"
                r="18.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: DWELL_MS / 1000, ease: 'linear' }}
              />
            </svg>
          )}
        </motion.span>
        <span className="v2-label">{entry.name}</span>
      </a>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="v2-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
          >
            <div className="v2-detail-inner">
              {entry.about && <p className="v2-about">{entry.about}</p>}
              {entry.media?.kind === 'image' && (
                <img className="v2-media" src={entry.media.src} alt={entry.media.alt ?? ''} />
              )}
              {entry.media?.kind === 'video' && (
                <video className="v2-media" src={entry.media.src} autoPlay muted loop playsInline />
              )}
              <p className="v2-links">
                <a href={entry.href} target="_blank" rel="noopener">
                  {host}
                </a>
                {entry.links?.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener">
                    {l.label}
                  </a>
                ))}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

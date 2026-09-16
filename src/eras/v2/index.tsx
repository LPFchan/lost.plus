// Era v2: a watchOS-style list. Everything rests small, dim and grey; the
// rows around the pointer (or the finger) magnify along y with the same
// curve the v1 dock uses along x, and the one under it comes to life in
// colour. Hold there and the row opens into its links, a short description
// and a picture. The list keeps following the pointer while a row is open;
// moving on to another row closes it and starts that row's own dwell.
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
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ENTRIES, Entry } from '../../entries';
import { magnify } from '../../magnify';
import { ListTuning, readListTuning } from '../../tune';
import { EraProps } from '../types';
import { MacosIcon } from '../v1/Dock';

/** room above and below the list for the end rows to magnify into, px */
const PAD = 24;
/** a touch that travels further than this is a scrub, not a tap */
const TAP_SLOP = 10;

export default function V2(_: EraProps) {
  // the tuning console writes localStorage and fires lp:tune
  const [tuning, setTuning] = useState<ListTuning>(readListTuning);
  useEffect(() => {
    const onTune = () => setTuning(readListTuning());
    window.addEventListener('lp:tune', onTune);
    return () => window.removeEventListener('lp:tune', onTune);
  }, []);
  return (
    <main className="relative z-10 flex h-full items-center justify-center">
      <WatchList entries={ENTRIES} tuning={tuning} />
    </main>
  );
}

function WatchList({ entries, tuning }: { entries: Entry[]; tuning: ListTuning }) {
  const spring = useMemo(
    () => ({ mass: 0.05, stiffness: tuning.stiffness, damping: tuning.damping }),
    [tuning.stiffness, tuning.damping],
  );
  // pointer position in viewport pixels; -Infinity when away. Rows measure
  // themselves against it, so an open row's extra height is simply part of
  // the layout and the curve follows the real geometry.
  const pointerY = useMotionValue(-Infinity);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const [hot, setHot] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // touch bookkeeping: where the finger went down and whether the dwell has
  // already opened the row (in which case lifting the finger is not a tap)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const opened = useRef(false);

  const rowAt = useCallback((clientY: number): string | null => {
    for (const [name, el] of rows.current) {
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return name;
    }
    return null;
  }, []);

  const track = (e: ReactPointerEvent) => {
    pointerY.set(e.clientY);
    setHot(rowAt(e.clientY));
  };

  const leave = () => {
    pointerY.set(-Infinity);
    setHot(null);
  };

  // the dwell: hold on a row for a while and it opens
  useEffect(() => {
    if (!hot || hot === expanded) return;
    const id = setTimeout(() => {
      opened.current = true;
      setExpanded(hot);
    }, tuning.dwellMs);
    return () => clearTimeout(id);
  }, [hot, expanded, tuning.dwellMs]);

  // moving on to another row closes the open one straight away; a mouse
  // leaving the list closes it too. A lifted finger leaves it open so its
  // links can be tapped; Escape or a press outside closes it then.
  const lastPointer = useRef<string>('mouse');
  useEffect(() => {
    if (!expanded) return;
    if (hot && hot !== expanded) setExpanded(null);
    else if (!hot && lastPointer.current === 'mouse') setExpanded(null);
  }, [hot, expanded]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(null);
    };
    const onDown = (e: PointerEvent) => {
      const row = rows.current.get(expanded);
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
        lastPointer.current = e.pointerType;
        if (e.pointerType !== 'mouse' && touch.current) {
          const t = touch.current;
          if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) t.moved = true;
        }
        track(e);
      }}
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
        if (e.pointerType === 'mouse') return;
        touch.current = { x: e.clientX, y: e.clientY, moved: false };
        opened.current = false;
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
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry) => (
        <Row
          key={entry.name}
          entry={entry}
          register={(el) => {
            if (el) rows.current.set(entry.name, el);
            else rows.current.delete(entry.name);
          }}
          pointerY={pointerY}
          tuning={tuning}
          spring={spring}
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
  register,
  pointerY,
  tuning,
  spring,
  expanded,
  onClick,
}: {
  entry: Entry;
  register: (el: HTMLDivElement | null) => void;
  pointerY: ReturnType<typeof useMotionValue<number>>;
  tuning: ListTuning;
  spring: { mass: number; stiffness: number; damping: number };
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  // The outer div sits in flow and carries no transform, so its rect is the
  // row's true resting place (the head is its first `size` px); the inner
  // one is what magnifies and nudges.
  const outer = useRef<HTMLDivElement>(null);
  const distance = useTransform(() => {
    const p = pointerY.get();
    const el = outer.current;
    if (p === -Infinity || !el) return -Infinity;
    return p - (el.getBoundingClientRect().top + tuning.size / 2);
  });
  // pinned while open: the card holds its size, and stays fully alive
  const pinned = useMotionValue(0);
  useEffect(() => pinned.set(expanded ? 1 : 0), [expanded, pinned]);
  const scale = useSpring(
    useTransform(() => (pinned.get() ? 1 : magnify(distance.get(), tuning).scale)),
    spring,
  );
  const y = useSpring(
    useTransform(() => magnify(distance.get(), tuning).x),
    spring,
  );
  // how alive the row is: 1 right under the pointer, fading to 0 a row away
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
  const opacity = useTransform(heat, (h) => tuning.rest + (1 - tuning.rest) * h);
  const host = new URL(entry.href).host;

  return (
    <div
      ref={(el) => {
        outer.current = el;
        register(el);
      }}
      className="v2-row"
      data-expanded={expanded ? '' : undefined}
    >
      <motion.div className="v2-row-inner" style={{ y, scale, opacity }}>
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
                {entry.about && <p className="v2-about">{entry.about}</p>}
                {entry.media?.kind === 'image' && (
                  <img className="v2-media" src={entry.media.src} alt={entry.media.alt ?? ''} />
                )}
                {entry.media?.kind === 'video' && (
                  <video className="v2-media" src={entry.media.src} autoPlay muted loop playsInline />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

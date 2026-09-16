// Era v2: a watchOS-style list. Everything rests small, dim and grey; the
// rows around the pointer (or the finger) grow along y with the same curve
// the v1 dock uses along x, and the one under it comes to life in colour.
// Hold there (a ring draws itself around the icon) and the row opens into
// its links, a short description and a picture.
//
// Rows have real heights, not transforms: a row's height follows the curve,
// its head scales to fill it, and an open row's card is simply more height.
// Neighbours are pushed by layout. The resting grid is rows at `size`;
// growth and cards are extra inserted into it, and the list slides up by
// exactly the extra above the pointer's grid point, so what is under the
// pointer never moves and the geometry can never chase the cursor. An open
// row is still an ordinary row: its head grows and shrinks with the curve
// like any other, it just stays lit and carries a card. The pointer over
// the card counts as the bottom of that row's grid cell, so the row keeps
// some growth there and the rows below wake as the pointer nears them.
// Click or tap launches, as in v1. Only the dwell opens the detail.

import {
  AnimatePresence,
  MotionValue,
  animate,
  motion,
  motionValue,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
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

/** room above and below the list for the end rows to grow into, px */
const PAD = 24;
/** the list keeps this much clear of the viewport's top and bottom, px */
const MARGIN = 12;
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
  // a short viewport (phones) shrinks the resting row so the list fits
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const fitted = useMemo(() => {
    const room = (vh - 2 * PAD - 2 * MARGIN - 40) / ENTRIES.length;
    return { ...tuning, size: Math.min(tuning.size, Math.max(28, Math.floor(room))) };
  }, [tuning, vh]);
  return (
    <main className="relative z-10 flex h-full items-center justify-center">
      <WatchList entries={ENTRIES} tuning={fitted} />
    </main>
  );
}

type Layout = {
  heights: number[];
  heats: number[];
  shift: number;
  /** how far the list slid beyond the pointer's own shift to keep an open card on screen */
  slide: number;
};

function WatchList({ entries, tuning }: { entries: Entry[]; tuning: ListTuning }) {
  const spring = useMemo(
    () => ({ mass: 0.05, stiffness: tuning.stiffness, damping: tuning.damping }),
    [tuning.stiffness, tuning.damping],
  );
  const curve = useMemo(
    () => ({ size: tuning.size, scale: tuning.scale, distance: tuning.distance, nudge: 0 }),
    [tuning.size, tuning.scale, tuning.distance],
  );
  // pointer position in the wrap's resting frame, px from its top;
  // -Infinity when away
  const pointer = useMotionValue(-Infinity);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  // each row's open card height, animated; part of the resting layout
  const cards = useMemo(() => entries.map(() => motionValue(0)), [entries]);
  const [hot, setHot] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const expandedMV = useMotionValue<string | null>(null);
  useEffect(() => expandedMV.set(expanded), [expanded, expandedMV]);
  // touch bookkeeping: where the finger went down and whether the dwell has
  // already opened the row (in which case lifting the finger is not a tap)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const opened = useRef(false);
  const lastPointer = useRef<string>('mouse');

  // The whole list's geometry from the pointer alone, once per change.
  // Grid: rows stacked at `size`. A row's growth is the curve at its grid
  // centre; its extra is that growth plus its card. The shift is the extra accumulated above the pointer's grid
  // point, so that point stays where it is on screen. Then, if an open card
  // would run off the bottom of the viewport, the list slides up as far as
  // the top allows; rows below it may go off screen. The slide is held until
  // the pointer leaves the list altogether: releasing it while the pointer
  // is still browsing would move the rows under it.
  const held = useRef(0);
  const layout = useTransform((): Layout => {
    const v = pointer.get();
    const open = expandedMV.get();
    const size = tuning.size;
    const heights: number[] = [];
    const heats: number[] = [];
    let above = 0;
    let extraTotal = 0;
    let openBottom = -1; // the open row's bottom in the grown list, or -1
    for (let i = 0; i < entries.length; i++) {
      const top = PAD + i * size;
      const isOpen = entries[i].name === open;
      const d = v === -Infinity ? -Infinity : v - (top + size / 2);
      const grow = magnify(d, curve).scale;
      const h = size * grow;
      const extra = h - size + cards[i].get();
      if (v !== -Infinity) {
        if (v >= top + size) above += extra;
        else if (v > top) above += ((h - size) * (v - top)) / size;
      }
      const near = d === -Infinity ? 0 : Math.max(0, 1 - Math.abs(d) / size);
      heights.push(h);
      heats.push(isOpen ? 1 : near);
      extraTotal += extra;
      if (isOpen) openBottom = top + size + extraTotal;
    }
    let shift = v === -Infinity ? 0 : above;
    let slide = v === -Infinity ? 0 : held.current;
    if (openBottom >= 0) {
      const wrapTop = wrapRef.current?.getBoundingClientRect().top ?? 0;
      const overflow = wrapTop + openBottom - shift - (window.innerHeight - MARGIN);
      if (overflow > slide) slide = Math.min(overflow, Math.max(0, wrapTop - MARGIN - shift));
    }
    held.current = slide;
    shift += slide;
    return { heights, heats, shift, slide };
  });
  const shift = useSpring(
    useTransform(() => -layout.get().shift),
    spring,
  );

  // Where the pointer is, read off the rows as they are on screen right now:
  // the row under it, and its grid point (the resting coordinate the layout
  // works in). Walking the rows' live rects, rather than subtracting the
  // wrap's top, is what makes this right mid-transition too: the point is
  // always the one under the cursor, never where the cursor would be once
  // the springs settle.
  const locate = useCallback(
    (clientY: number): { v: number; name: string | null } => {
      const size = tuning.size;
      const open = expandedMV.get();
      const slide = layout.get().slide;
      let first: DOMRect | null = null;
      let last: DOMRect | null = null;
      for (let i = 0; i < entries.length; i++) {
        const el = rowEls.current.get(entries[i].name);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        first ??= r;
        last = r;
        const top = PAD + i * size;
        // An open row that the list slid up to keep on screen keeps the
        // pointer for the slide's worth above its head, too: the pointer was
        // on that head before the slide, and letting the row now under it
        // take over would close the card, undo the slide, and loop.
        if (entries[i].name === open && slide > 0 && clientY >= r.top - slide && clientY < r.top)
          return { v: top + size / 2, name: entries[i].name };
        // the head is the row's grid cell; its card, when open, is the
        // cell's bottom edge
        const headH = Math.max(1, r.height - cards[i].get());
        if (clientY >= r.top && clientY < r.top + headH)
          return { v: top + ((clientY - r.top) * size) / headH, name: entries[i].name };
        if (clientY >= r.top + headH && clientY < r.bottom)
          return { v: top + size - 0.5, name: entries[i].name };
      }
      if (first && clientY < first.top) return { v: PAD + (clientY - first.top), name: null };
      if (last) return { v: PAD + entries.length * size + (clientY - last.bottom), name: null };
      return { v: -Infinity, name: null };
    },
    [entries, cards, tuning.size, expandedMV, layout],
  );

  const track = (e: { clientY: number }) => {
    const { v, name } = locate(e.clientY);
    pointer.set(v);
    setHot(name);
  };

  // The mouse is followed on the window, not the wrap: rows are read by their
  // live rects, so a cursor over a row that has strayed outside the wrap's
  // resting box (pushed there by an open card) still counts, and a moment
  // over nothing mid-transition is not a leave. Off every row is a leave.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      lastPointer.current = 'mouse';
      const { v, name } = locate(e.clientY);
      if (name) {
        pointer.set(v);
        setHot(name);
      } else {
        pointer.set(-Infinity);
        setHot(null);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [locate, pointer]);

  const leave = () => {
    pointer.set(-Infinity);
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
      const row = rowEls.current.get(expanded);
      if (row && !row.contains(e.target as Node)) setExpanded(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [expanded]);

  const restHeight = entries.length * tuning.size + 2 * PAD;

  return (
    <div
      ref={wrapRef}
      className="v2-wrap"
      style={{ '--size': tuning.size + 'px', '--pad': PAD + 'px', height: restHeight } as React.CSSProperties}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') return; // the window listener has it
        lastPointer.current = e.pointerType;
        if (touch.current) {
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
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div className="v2-list" style={{ y: shift }}>
        {entries.map((entry, i) => (
          <Row
            key={entry.name}
            entry={entry}
            index={i}
            layout={layout}
            card={cards[i]}
            register={(el) => {
              if (el) rowEls.current.set(entry.name, el);
              else rowEls.current.delete(entry.name);
            }}
            tuning={tuning}
            spring={spring}
            hot={hot === entry.name && expanded !== entry.name}
            expanded={expanded === entry.name}
            onClick={(e) => {
              // a scrub or a completed dwell is not a launch
              if (touch.current?.moved || opened.current) e.preventDefault();
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

// the icon's rounded rectangle, a few px out, starting at top centre and
// running clockwise so the dwell ring draws like a clock
const RING = (() => {
  const x = 1.5, w = 37, r = 11;
  const e = x + w;
  return [
    `M ${x + w / 2} ${x}`,
    `H ${e - r} A ${r} ${r} 0 0 1 ${e} ${x + r}`,
    `V ${e - r} A ${r} ${r} 0 0 1 ${e - r} ${e}`,
    `H ${x + r} A ${r} ${r} 0 0 1 ${x} ${e - r}`,
    `V ${x + r} A ${r} ${r} 0 0 1 ${x + r} ${x}`,
    'Z',
  ].join(' ');
})();

function Row({
  entry,
  index,
  layout,
  card,
  register,
  tuning,
  spring,
  hot,
  expanded,
  onClick,
}: {
  entry: Entry;
  index: number;
  layout: MotionValue<Layout>;
  card: MotionValue<number>;
  register: (el: HTMLDivElement | null) => void;
  tuning: ListTuning;
  spring: { mass: number; stiffness: number; damping: number };
  hot: boolean;
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const height = useSpring(
    useTransform(() => layout.get().heights[index]),
    spring,
  );
  // the head fills the row: its box is the resting size, scaled up
  const scale = useTransform(height, (h) => h / tuning.size);
  const heat = useSpring(
    useTransform(() => layout.get().heats[index]),
    { stiffness: 300, damping: 30 },
  );
  const grey = useTransform(heat, (h) => 1 - h);
  const filter = useMotionTemplate`grayscale(${grey})`;
  const opacity = useTransform(heat, (h) => tuning.rest + (1 - tuning.rest) * h);
  const host = new URL(entry.href).host;

  // The card's height is animated by hand so the layout can read it, and
  // with the rows' own spring: card, heights and the list's shift then share
  // one set of dynamics, so the shift cancels the card's motion exactly and
  // nothing under the pointer moves while a card opens or closes above it.
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = expanded ? (inner.current?.scrollHeight ?? 0) : 0;
    const ctl = animate(card, target, { type: 'spring', ...spring });
    return () => ctl.stop();
  }, [expanded, card, spring]);

  return (
    <motion.div
      ref={register}
      className="v2-row"
      data-expanded={expanded ? '' : undefined}
      style={{ height: useTransform(() => height.get() + card.get()) }}
    >
      {/* the head's box takes the row's real height; the head inside is laid
          out at the resting size and scaled to fill it */}
      <motion.div style={{ height }}>
      <motion.a
        className="v2-head"
        href={entry.href}
        target="_blank"
        rel="noopener"
        draggable={false}
        onClick={onClick}
        style={{ scale, opacity }}
      >
        <motion.span className="v2-icon" style={{ filter }}>
          <MacosIcon entry={entry} alt="" />
          <AnimatePresence>
            {hot && (
              <motion.svg
                key="ring"
                className="v2-ring"
                viewBox="0 0 40 40"
                aria-hidden="true"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.path
                  d={RING}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: tuning.dwellMs / 1000, ease: 'linear' }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.span>
        <span className="v2-label">{entry.name}</span>
      </motion.a>
      </motion.div>
      <motion.div className="v2-card" style={{ height: card, opacity }}>
        <div ref={inner} className="v2-card-inner">
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
    </motion.div>
  );
}

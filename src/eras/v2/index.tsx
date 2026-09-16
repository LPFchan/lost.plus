// Era v2: a watchOS-style list. Everything rests small, dim and grey; the
// rows around the pointer (or the finger) grow along y with the same curve
// the v1 dock uses along x, and the one under it comes to life in colour.
// Hold there (a ring draws itself around the icon) and the row opens into
// its links, a short description and a picture.
//
// Rows have real heights, not transforms: a row's height follows the curve
// and its contents scale to fill it. An open row's card is simply more of
// the row: head and card are one block, laid out at rest and scaled
// together. Neighbours are pushed by layout.
//
// The geometry works in one resting grid: rows stacked at `size`, plus each
// open card, which is part of the grid because it depends only on state,
// never on the pointer. The pointer's grid point is its screen position
// minus the wrap's top, plus whatever the list is being held away from
// home by (below). Each row measures the curve to the centre of its whole
// extent, so an open row is just a taller item: it peaks when the pointer
// is at its middle, breathes as the pointer moves over it like any other
// row, and the rows past its card are as far from the pointer as they
// look. Growth is extra inserted into the grid; the list slides up by
// exactly the growth above the pointer's grid point, so what is under the
// pointer never moves, and nothing here can chase the cursor.
//
// The list is also held away from home by two things, until the pointer
// leaves: the slide that keeps an open card inside the viewport, and the
// height of a card that closed above the pointer (moving on to a lower row
// closes the open one; the rows under the pointer would otherwise ride up
// by the collapsing card). Both are steps into the sprung shift, and the
// card animates with the same spring, so the two cancel throughout.
//
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
  useLayoutEffect,
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
  /** each row's height: its resting extent (head, and card when open) grown by the curve */
  heights: number[];
  heats: number[];
  /** how far the list is translated up: growth above the pointer, plus the hold */
  shift: number;
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
  // the pointer's screen y; -Infinity when away
  const screenY = useMotionValue(-Infinity);
  // how far the list is held away from home, px (positive: up)
  const hold = useMotionValue(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wrapTop = useRef(0);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  // each row's open card height: its target, not the animated value, so
  // the grid and everything derived from it step and are sprung once, in
  // time with the card's own spring (see Row)
  const cards = useMemo(() => entries.map(() => motionValue(0)), [entries]);
  const [hot, setHot] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const expandedMV = useMotionValue<string | null>(null);
  // touch bookkeeping: where the finger went down and whether the dwell has
  // already opened the row (in which case lifting the finger is not a tap)
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const opened = useRef(false);
  const lastPointer = useRef<string>('mouse');

  useLayoutEffect(() => {
    const measure = () => {
      wrapTop.current = wrapRef.current?.getBoundingClientRect().top ?? 0;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** the pointer's grid point, from its screen position */
  const gridPoint = useCallback(
    () => (screenY.get() === -Infinity ? -Infinity : screenY.get() - wrapTop.current + hold.get()),
    [screenY, hold],
  );
  /** the top of row i's cell in the grid, with the cards as they are now */
  const cellTop = useCallback(
    (i: number) => {
      let top = PAD;
      for (let j = 0; j < i; j++) top += tuning.size + cards[j].get();
      return top;
    },
    [cards, tuning.size],
  );
  /** which row's cell (head or card) a grid point is in, or -1 */
  const cellAt = useCallback(
    (v: number) => {
      if (v === -Infinity || v < PAD) return -1;
      let top = PAD;
      for (let i = 0; i < entries.length; i++) {
        const bottom = top + tuning.size + cards[i].get();
        if (v < bottom) return i;
        top = bottom;
      }
      return -1;
    },
    [entries, cards, tuning.size],
  );

  // The whole list's geometry, once per change of anything it depends on.
  // If the open card runs off the bottom of the viewport, the list is held
  // up further, as far as its top allows, but never so far that the pointer
  // leaves the open row (that would close the card and loop). That moves
  // the pointer's grid point, so the geometry is worked out again with it.
  // The hold is written from in here on purpose: a value set from a change
  // handler during a React render is lost, because the recompute it
  // schedules is cancelled when the derived value resubscribes.
  const layout = useTransform((): Layout => {
    const p = screenY.get();
    const open = expandedMV.get();
    const size = tuning.size;
    const at = (held: number) => (p === -Infinity ? -Infinity : p - wrapTop.current + held);
    const pass = (v: number) => {
      const heights: number[] = [];
      const heats: number[] = [];
      let top = PAD;
      let above = 0; // growth above the pointer's grid point
      let stack = PAD; // the rows' laid-out heights so far
      let openCell = -1;
      let openBottom = 0; // the open row's bottom in the laid-out list
      for (let i = 0; i < entries.length; i++) {
        const c = cards[i].get();
        const extent = size + c;
        const d = v === -Infinity ? -Infinity : v - (top + extent / 2);
        const h = extent * magnify(d, curve).scale;
        if (v !== -Infinity) {
          if (v >= top + extent) above += h - extent;
          else if (v > top) above += ((h - extent) * (v - top)) / extent;
        }
        heights.push(h);
        const isOpen = entries[i].name === open;
        heats.push(isOpen ? 1 : d === -Infinity ? 0 : Math.max(0, 1 - Math.abs(d) / size));
        stack += h;
        if (isOpen) {
          openCell = i;
          openBottom = stack;
        }
        top += extent;
      }
      return { heights, heats, above, openCell, openBottom };
    };
    let held = hold.get();
    let r = pass(at(held));
    if (r.openCell >= 0) {
      const shift = r.above + held;
      const need = wrapTop.current + r.openBottom - shift - (window.innerHeight - MARGIN);
      const room = wrapTop.current + PAD - shift - MARGIN;
      let fit = Math.min(need, room);
      const v = at(held);
      if (v !== -Infinity && cellAt(v) === r.openCell) fit = Math.min(fit, cellTop(r.openCell + 1) - 1 - v);
      if (fit > 0.5) {
        held += fit;
        hold.set(held);
        r = pass(at(held));
      }
    }
    return { heights: r.heights, heats: r.heats, shift: r.above + held };
  });
  const shift = useSpring(
    useTransform(() => -layout.get().shift),
    spring,
  );

  /** the pointer is at this screen y; false if that is off every row */
  const point = useCallback(
    (clientY: number) => {
      wrapTop.current = wrapRef.current?.getBoundingClientRect().top ?? 0;
      const i = cellAt(clientY - wrapTop.current + hold.get());
      if (i < 0) return false;
      screenY.set(clientY);
      setHot(entries[i].name);
      return true;
    },
    [cellAt, entries, hold, screenY],
  );
  const leave = useCallback(() => {
    screenY.set(-Infinity);
    setHot(null);
    // nothing under the pointer and nothing open: the list goes home
    if (!expandedMV.get()) hold.set(0);
  }, [screenY, expandedMV, hold]);

  // The mouse is followed on the window, not the wrap: rows pushed outside
  // the wrap's resting box by an open card still count. Off every row is a
  // leave.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      lastPointer.current = 'mouse';
      if (!point(e.clientY)) leave();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [point, leave]);

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

  // A card closing above the pointer takes its height out of the grid
  // there; the list is held up by the same amount so the rows under the
  // pointer stay put. A layout effect, so it reads the card's target before
  // the Row's own effect zeroes it and starts the collapse; both land on
  // the same frame.
  const wasOpen = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = wasOpen.current;
    wasOpen.current = expanded;
    if (prev && prev !== expanded) {
      const i = entries.findIndex((e) => e.name === prev);
      const v = gridPoint();
      if (i >= 0 && v !== -Infinity && v >= cellTop(i + 1)) hold.set(hold.get() - cards[i].get());
    }
    expandedMV.set(expanded);
    if (!expanded && screenY.get() === -Infinity) hold.set(0);
  }, [expanded, entries, cards, cellTop, gridPoint, hold, expandedMV, screenY]);

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
        point(e.clientY);
      }}
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
        if (e.pointerType === 'mouse') return;
        touch.current = { x: e.clientX, y: e.clientY, moved: false };
        opened.current = false;
        point(e.clientY);
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
  // the card's height as shown, sprung from its target (below)
  const live = useMotionValue(0);
  // the block inside is laid out at the resting extent and scaled to fill
  // whatever height the row has grown to
  const scale = useTransform(() => height.get() / (tuning.size + live.get()));
  const heat = useSpring(
    useTransform(() => layout.get().heats[index]),
    { stiffness: 300, damping: 30 },
  );
  const grey = useTransform(heat, (h) => 1 - h);
  const filter = useMotionTemplate`grayscale(${grey})`;
  const opacity = useTransform(heat, (h) => tuning.rest + (1 - tuning.rest) * h);
  const host = new URL(entry.href).host;

  // The card's target height goes to the layout at once; the card itself
  // opens with the rows' own spring. Row height, list shift and card then
  // all step together and share one set of dynamics, so the shift cancels
  // the card's motion exactly and nothing under the pointer moves while a
  // card opens or closes above it. The block's scale stays put throughout,
  // because height and card sit on the same curve.
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = expanded ? (inner.current?.scrollHeight ?? 0) : 0;
    card.set(target);
    const ctl = animate(live, target, { type: 'spring', ...spring });
    return () => ctl.stop();
  }, [expanded, card, live, spring]);

  return (
    <motion.div
      ref={register}
      className="v2-row"
      data-expanded={expanded ? '' : undefined}
      style={{ height }}
    >
      <motion.div className="v2-row-inner" style={{ scale, opacity }}>
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
      </a>
      <motion.div className="v2-card" style={{ height: live }}>
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
    </motion.div>
  );
}

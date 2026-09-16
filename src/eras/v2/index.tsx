// Era v2: a watchOS-style list. Everything rests small, dim and grey; the
// rows around the pointer (or the finger) grow along y with the same curve
// the v1 dock uses along x, and the one under it comes to life in colour.
// Hold there (a ring draws itself around the icon) and the row opens into
// its links, a short description and a picture.
//
// Everything on the list is an item on one curve: a row's head, and, when
// the row is open, each line of its card (the links, the blurb, the
// picture) on its own. Items have real heights, not transforms: an item's
// height is its resting extent grown by the curve at the distance from the
// pointer to its centre, and what is inside is laid out at rest and scaled
// to fill it. Neighbours are pushed by layout. An open row is just a short
// run of items, each breathing on its own as the pointer passes.
//
// The geometry works in one resting grid of the items' extents. A card's
// lines are in it because their extents depend only on state, never on
// the pointer. The pointer's grid point is its screen position minus the
// wrap's top, plus whatever the list is being held away from home by
// (below). Growth is extra inserted into the grid; the list slides up by
// exactly the growth above the pointer's grid point, so what is under the
// pointer never moves, and nothing here can chase the cursor.
//
// The list is also held away from home by two things: the slide that
// keeps an open card inside the viewport, and the height of a card that
// closed above the pointer (moving on to a lower row closes the open one;
// the rows under the pointer would otherwise ride up by the collapsing
// card). Both are steps into the sprung shift, and the card's lines step
// with the same spring, so the two cancel throughout. While nothing is
// open, every pointer move pays part of the hold back, at half the
// pointer's speed, so the list finds its way home under cover of motion
// instead of creeping; the rest goes when the pointer leaves.
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
/** how much of the hold a pointer move pays back, per px moved */
const PAYBACK = 0.5;

/** the lines an entry's card has, in order */
type Part = 'links' | 'about' | 'media';
function partsOf(entry: Entry): Part[] {
  const parts: Part[] = ['links'];
  if (entry.about) parts.push('about');
  if (entry.media) parts.push('media');
  return parts;
}

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
  /** each item's height: its resting extent grown by the curve */
  heights: number[];
  /** each row's heat */
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
  const lastY = useRef(-Infinity);
  // how far the list is held away from home, px (positive: up)
  const hold = useMotionValue(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wrapTop = useRef(0);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  // The items, flat: each row's head, then its card's lines. A line's
  // extent is its target (its natural height when open, else 0), not the
  // animated value, so the grid and everything derived from it step and are
  // sprung once, in time with the line's own spring (see Row).
  const rows = useMemo(() => {
    let index = 0;
    return entries.map((entry) => {
      const parts = partsOf(entry).map((kind) => ({ kind, extent: motionValue(0) }));
      const row = { entry, index, parts };
      index += 1 + parts.length;
      return row;
    });
  }, [entries]);
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

  /** a row's resting extent: its head plus its card's lines as they are now */
  const rowExtent = useCallback(
    (r: number) => rows[r].parts.reduce((sum, p) => sum + p.extent.get(), tuning.size),
    [rows, tuning.size],
  );
  /** the top of row r's cell in the grid */
  const cellTop = useCallback(
    (r: number) => {
      let top = PAD;
      for (let j = 0; j < r; j++) top += rowExtent(j);
      return top;
    },
    [rowExtent],
  );
  /** which row's cell a grid point is in, or -1 */
  const cellAt = useCallback(
    (v: number) => {
      if (v === -Infinity || v < PAD) return -1;
      let top = PAD;
      for (let r = 0; r < rows.length; r++) {
        const bottom = top + rowExtent(r);
        if (v < bottom) return r;
        top = bottom;
      }
      return -1;
    },
    [rows, rowExtent],
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
      let stack = PAD; // the items' laid-out heights so far
      let openCell = -1;
      let openBottom = 0; // the open row's bottom in the laid-out list
      const item = (extent: number) => {
        if (extent <= 0) {
          heights.push(0);
          return;
        }
        const d = v === -Infinity ? -Infinity : v - (top + extent / 2);
        const h = extent * magnify(d, curve).scale;
        if (v !== -Infinity) {
          if (v >= top + extent) above += h - extent;
          else if (v > top) above += ((h - extent) * (v - top)) / extent;
        }
        heights.push(h);
        stack += h;
        top += extent;
      };
      for (let r = 0; r < rows.length; r++) {
        const isOpen = rows[r].entry.name === open;
        const d = v === -Infinity ? -Infinity : v - (top + size / 2);
        heats.push(isOpen ? 1 : d === -Infinity ? 0 : Math.max(0, 1 - Math.abs(d) / size));
        item(size);
        for (const part of rows[r].parts) item(part.extent.get());
        if (isOpen) {
          openCell = r;
          openBottom = stack;
        }
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
      // with nothing open, motion pays the hold back
      const held = hold.get();
      if (held !== 0 && !expandedMV.get() && lastY.current !== -Infinity) {
        const back = Math.min(Math.abs(held), Math.abs(clientY - lastY.current) * PAYBACK);
        hold.set(held - Math.sign(held) * back);
      }
      lastY.current = clientY;
      const r = cellAt(clientY - wrapTop.current + hold.get());
      if (r < 0) return false;
      screenY.set(clientY);
      setHot(rows[r].entry.name);
      return true;
    },
    [cellAt, rows, hold, screenY, expandedMV],
  );
  const leave = useCallback(() => {
    screenY.set(-Infinity);
    lastY.current = -Infinity;
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
  // pointer stay put. A layout effect, so it reads the lines' targets before
  // the Row's own effect zeroes them and starts the collapse; both land on
  // the same frame.
  const wasOpen = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = wasOpen.current;
    wasOpen.current = expanded;
    if (prev && prev !== expanded) {
      const r = rows.findIndex((row) => row.entry.name === prev);
      const p = screenY.get();
      const v = p === -Infinity ? -Infinity : p - wrapTop.current + hold.get();
      if (r >= 0 && v !== -Infinity && v >= cellTop(r + 1))
        hold.set(hold.get() - (rowExtent(r) - tuning.size));
    }
    expandedMV.set(expanded);
    if (!expanded && screenY.get() === -Infinity) hold.set(0);
  }, [expanded, rows, cellTop, rowExtent, tuning.size, hold, expandedMV, screenY]);

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
        {rows.map((row, r) => (
          <Row
            key={row.entry.name}
            entry={row.entry}
            index={row.index}
            row={r}
            parts={row.parts}
            layout={layout}
            register={(el) => {
              if (el) rowEls.current.set(row.entry.name, el);
              else rowEls.current.delete(row.entry.name);
            }}
            tuning={tuning}
            spring={spring}
            hot={hot === row.entry.name && expanded !== row.entry.name}
            expanded={expanded === row.entry.name}
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
  row,
  parts,
  layout,
  register,
  tuning,
  spring,
  hot,
  expanded,
  onClick,
}: {
  entry: Entry;
  /** the head's index among the items; the card's lines follow it */
  index: number;
  row: number;
  parts: { kind: Part; extent: MotionValue<number> }[];
  layout: MotionValue<Layout>;
  register: (el: HTMLDivElement | null) => void;
  tuning: ListTuning;
  spring: { mass: number; stiffness: number; damping: number };
  hot: boolean;
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const headHeight = useSpring(
    useTransform(() => layout.get().heights[index]),
    spring,
  );
  // the head is laid out at the resting size and scaled to fill whatever
  // height it has grown to
  const headScale = useTransform(headHeight, (h) => h / tuning.size);
  const heat = useSpring(
    useTransform(() => layout.get().heats[row]),
    { stiffness: 300, damping: 30 },
  );
  const grey = useTransform(heat, (h) => 1 - h);
  const filter = useMotionTemplate`grayscale(${grey})`;
  const opacity = useTransform(heat, (h) => tuning.rest + (1 - tuning.rest) * h);
  const host = new URL(entry.href).host;

  return (
    <motion.div ref={register} className="v2-row" data-expanded={expanded ? '' : undefined}>
      <motion.div className="v2-head-box" style={{ height: headHeight }}>
        <motion.a
          className="v2-head"
          href={entry.href}
          target="_blank"
          rel="noopener"
          draggable={false}
          onClick={onClick}
          style={{ scale: headScale, opacity }}
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
      {parts.map((part, k) => (
        <Line
          key={part.kind}
          index={index + 1 + k}
          extent={part.extent}
          layout={layout}
          spring={spring}
          opacity={opacity}
          expanded={expanded}
        >
          {part.kind === 'links' && (
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
          )}
          {part.kind === 'about' && <p className="v2-about">{entry.about}</p>}
          {part.kind === 'media' && entry.media?.kind === 'image' && (
            <img className="v2-media" src={entry.media.src} alt={entry.media.alt ?? ''} />
          )}
          {part.kind === 'media' && entry.media?.kind === 'video' && (
            <video className="v2-media" src={entry.media.src} autoPlay muted loop playsInline />
          )}
        </Line>
      ))}
    </motion.div>
  );
}

// One line of a card. Its target extent (its natural height, or 0 when the
// row is closed) goes to the layout at once, and the line itself opens
// with the rows' own spring: item height, list shift and the line's
// reveal then step together and share one set of dynamics, so the shift
// cancels the reveal exactly and nothing under the pointer moves while a
// card opens or closes above it. The content is laid out at rest and
// scaled by height over the sprung extent, which stays put throughout
// because both sit on the same curve; while the extent is still small the
// content is simply clipped, so a card unfolds rather than zooms.
function Line({
  index,
  extent,
  layout,
  spring,
  opacity,
  expanded,
  children,
}: {
  index: number;
  extent: MotionValue<number>;
  layout: MotionValue<Layout>;
  spring: { mass: number; stiffness: number; damping: number };
  opacity: MotionValue<number>;
  expanded: boolean;
  children: React.ReactNode;
}) {
  const height = useSpring(
    useTransform(() => layout.get().heights[index]),
    spring,
  );
  const live = useMotionValue(0);
  const scale = useTransform(() => (live.get() > 1 ? height.get() / live.get() : 1));
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = expanded ? (inner.current?.offsetHeight ?? 0) : 0;
    extent.set(target);
    const ctl = animate(live, target, { type: 'spring', ...spring });
    return () => ctl.stop();
  }, [expanded, extent, live, spring]);
  return (
    <motion.div className="v2-line" style={{ height }}>
      <motion.div ref={inner} className="v2-line-inner" style={{ scale, opacity }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

// Dock implementation taken verbatim from
// https://buildui.com/recipes/magnified-dock

'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import {
  MotionValue,
  Reorder,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { GlassTarget } from './Backdrop';

export type DockTuning = {
  size: number; // resting icon width in px
  gap: number; // spacing between icons in px
  scale: number; // max scale factor of an icon
  distance: number; // pixels before mouse affects an icon
  nudge: number; // pixels icons are moved away from mouse
  mass: number;
  stiffness: number;
  damping: number;
};

export const DEFAULT_TUNING: DockTuning = {
  size: 96,
  gap: 0,
  scale: 1.65,
  distance: 205,
  nudge: 61,
  mass: 0.05,
  stiffness: 220,
  damping: 11,
};

export type DockEntry = {
  name: string;
  href: string;
  icon: string;
  /** shown instead of `icon` in dark mode */
  darkIcon?: string;
  /**
   * How the artwork is treated inside the standard macOS icon canvas.
   * - cover:     raw rectangular image; pipeline crops and rounds it
   * - preshaped: artwork is already a finished macOS icon; passed through
   * - tile:      glyph on a colored rounded tile (github style)
   * Geometry (inset, radius, shadow) is owned by the pipeline and can never
   * vary per icon — only the treatment of its content.
   */
  treatment?: 'cover' | 'preshaped' | 'tile';
};

/**
 * Dock tray geometry, derived from the icon pipeline so the tray is always
 * visually concentric with the icons inside it:
 *   icon content box = slot * 13/16 (the pipeline's canvas inset)
 *   icon radius      = 22% of the content box (the pipeline's corner radius)
 *   tray radius      = icon radius + tray padding  (outer = inner + padding)
 * Tray padding is uniform on all four sides.
 */
function trayGeometry(tuning: DockTuning) {
  const content = tuning.size * (13 / 16);
  const iconRadius = content * 0.22;
  const padding = Math.max(8, Math.round(tuning.size * 0.2));
  return {
    padding,
    radius: iconRadius + padding,
    height: tuning.size + padding * 2,
  };
}

/** corner radius of the phone-sized folder grid; the tray derives its own */
const GRID_RADIUS = 32;

/**
 * The magnification curve: how much an icon `d` px from the cursor grows, and
 * how far it is pushed away. The single source of truth for it — the icons
 * transform with this, and the tray measures its end icons with it, so the two
 * can never disagree about where an icon's edge has got to.
 *
 * `d` is signed and in unzoomed dock pixels: positive means the cursor is to
 * the right of the icon, so the icon is pushed left.
 */
function magnify(d: number, tuning: DockTuning): { scale: number; x: number } {
  if (d === -Infinity) return { scale: 1, x: 0 };
  const t = Math.min(Math.abs(d) / tuning.distance, 1);
  const scale = 1 + (tuning.scale - 1) * (1 - t);
  const x =
    t >= 1
      ? Math.sign(d) * -tuning.nudge
      : (-d / tuning.distance) * tuning.nudge * scale;
  return { scale, x };
}

/** resting centre of the icon in slot `i`, in unzoomed dock pixels */
function slotCenter(i: number, tuning: DockTuning): number {
  return trayGeometry(tuning).padding + i * (tuning.size + tuning.gap) + tuning.size / 2;
}

/** natural (unzoomed) dock width: icons + gaps + tray padding on both sides */
export function dockNaturalWidth(entries: number, tuning: DockTuning): number {
  const tray = trayGeometry(tuning);
  return entries * tuning.size + (entries - 1) * tuning.gap + tray.padding * 2;
}

/** horizontal room magnification+nudge needs beyond the natural width */
export function dockOverflowReserve(tuning: DockTuning): number {
  return Math.ceil((tuning.size * (tuning.scale - 1)) / 2) + tuning.nudge;
}

function MacosIcon({ entry, alt }: { entry: DockEntry; alt: string }) {
  const treatment = entry.treatment ?? 'cover';
  const content =
    treatment === 'tile' ? (
      <span className="macos-icon-content treatment-tile">
        <img src={entry.icon} alt={alt} draggable={false} />
      </span>
    ) : entry.darkIcon ? (
      <>
        <img
          src={entry.icon}
          alt={alt}
          draggable={false}
          className={'macos-icon-content treatment-' + treatment + ' variant-light'}
        />
        <img
          src={entry.darkIcon}
          alt=""
          draggable={false}
          className={'macos-icon-content treatment-' + treatment + ' variant-dark'}
        />
      </>
    ) : (
      <img
        src={entry.icon}
        alt={alt}
        draggable={false}
        className={'macos-icon-content treatment-' + treatment}
      />
    );
  return <span className="macos-icon select-none">{content}</span>;
}

export default function Dock({
  entries,
  tuning,
  onReorder,
  zoom = 1,
  glass,
}: {
  entries: DockEntry[];
  tuning: DockTuning;
  onReorder: (entries: DockEntry[]) => void;
  /** whole-dock scale factor for the fit-to-width regime (A < width < B) */
  zoom?: number;
  /** filled with the panels the backdrop should render as glass */
  glass?: RefObject<GlassTarget[]>;
}) {
  const mouseLeft = useMotionValue(-Infinity);
  const spring = useMemo(
    () => ({ mass: tuning.mass, stiffness: tuning.stiffness, damping: tuning.damping }),
    [tuning.mass, tuning.stiffness, tuning.damping],
  );
  const tray = trayGeometry(tuning);

  // The tray hugs the icons at each end, keeping the same padding it has at
  // rest. It used to guess instead — a fixed 40px of stretch keyed off the
  // cursor — which broke the padding two different ways: an end icon shoved
  // away from the cursor travels `nudge` px and outran the tray, while an end
  // icon that *is* the hovered one isn't shoved at all and only grows, so the
  // tray ran away from it. Deriving both edges from the same magnify() the
  // icons use means there is no constant left to keep in sync, and
  // magnification is handled by the same measurement rather than separately.
  //
  // Only the straight edges follow. The corner radius stays put: it feeds the
  // glass shader, whose shape model has one radius for all four corners, so a
  // tray whose two ends had grown by different amounts could not be expressed.
  const endShift = (slot: number) => {
    const mouse = mouseLeft.get();
    const d = mouse === -Infinity ? -Infinity : mouse / zoom - slotCenter(slot, tuning);
    const { x, scale } = magnify(d, tuning);
    // the icon's own nudge, plus half its growth, since it scales about its
    // centre — together, how far its outer edge has moved from rest
    return { x, spread: ((scale - 1) * tuning.size) / 2 };
  };
  // Both are offsets from the resting edge, negative outward, and both are
  // sprung with the icons' own spring so the tray and the icon it is hugging
  // settle on exactly the same curve.
  const leftSpring = useSpring(
    useTransform(() => {
      const { x, spread } = endShift(0);
      return x - spread;
    }),
    spring,
  );
  const rightSpring = useSpring(
    useTransform(() => {
      const { x, spread } = endShift(entries.length - 1);
      return -x - spread;
    }),
    spring,
  );
  const naturalWidth = dockNaturalWidth(entries.length, tuning);
  // magnification grows icons beyond the dock's layout box on all sides.
  // reserve room inside the clip boundary so nothing is ever visually cut,
  // while the boundary itself stops the page from becoming scrollable
  const overflowReserve = dockOverflowReserve(tuning);
  // current dock rect in viewport coordinates, refreshed on every mousemove;
  // icons measure themselves against the same rect so zoom can't skew the
  // magnification distance math
  const dockRect = useRef<DOMRect | null>(null);

  // Both glass panels are always in the DOM; the breakpoint hides one with
  // display:none, which makes it measure zero. Handing the backdrop both and
  // letting it pick the one with a real rect keeps the 480px breakpoint in the
  // stylesheet as its single source of truth.
  const trayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!glass) return;
    glass.current = [
      { el: trayRef.current, radius: tray.radius, scale: zoom },
      { el: gridRef.current, radius: GRID_RADIUS, scale: 1 },
    ];
  });

  return (
    <>
      <div
        className="hidden min-[480px]:flex min-[480px]:items-end min-[480px]:justify-center"
        style={{
          width: (naturalWidth + overflowReserve * 2) * zoom,
          height: tray.height * zoom,
          overflowX: 'clip',
          overflowY: 'visible',
        }}
      >
      <Reorder.Group
        as="div"
        axis="x"
        values={entries}
        onReorder={onReorder}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          dockRect.current = rect;
          mouseLeft.set(e.clientX - rect.left);
        }}
        onMouseLeave={() => mouseLeft.set(-Infinity)}
        className="mx-auto flex items-end relative origin-center"
        style={{
          gap: tuning.gap,
          height: tray.height,
          padding: tray.padding,
          width: naturalWidth,
          transform: `scale(${zoom})`,
        }}
      >
        <motion.div
          ref={trayRef}
          className="glass-panel absolute inset-y-0 -z-10"
          style={{ left: leftSpring, right: rightSpring, borderRadius: tray.radius }}
        />

        {entries.map((entry) => (
          <AppIcon key={entry.name} mouseLeft={mouseLeft} entry={entry} tuning={tuning} spring={spring} dockRect={dockRect} zoom={zoom}>
            {entry.name}
          </AppIcon>
        ))}
      </Reorder.Group>
      </div>

      <div className="min-[480px]:hidden">
        <div
          ref={gridRef}
          className="glass-panel mx-auto grid w-full max-w-sm grid-cols-3 gap-x-2 gap-y-6 p-6"
          style={{ borderRadius: GRID_RADIUS }}
        >
          {entries.map((entry) => (
            <a
              key={entry.name}
              href={entry.href}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="aspect-square w-full max-w-20">
                <MacosIcon entry={entry} alt="" />
              </span>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                {entry.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

function AppIcon({
  mouseLeft,
  entry,
  tuning,
  spring,
  dockRect,
  zoom,
  children,
}: {
  mouseLeft: MotionValue;
  entry: DockEntry;
  tuning: DockTuning;
  spring: { mass: number; stiffness: number; damping: number };
  dockRect: React.RefObject<DOMRect | null>;
  zoom: number;
  children: ReactNode;
}) {
  // measure the button in viewport coordinates — the same space the mouse
  // position is reported in — so the distance math stays exact even when
  // the whole dock is zoomed by a CSS transform
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(() => {
    // always read mouseLeft first: framer subscribes this transform to
    // whichever motion values are .get() during compute, so an early return
    // before the read would leave the transform permanently unsubscribed
    const mouse = mouseLeft.get();
    // the Reorder.Item wrapper carries no interaction transforms (scale,
    // nudge, bounce live on the button inside), so its viewport rect marks
    // the icon's true resting position in the same coordinate space as the
    // mouse — exact under any dock zoom
    const el = ref.current;
    const dock = dockRect.current;
    if (!el || !dock || mouse === -Infinity) return -Infinity;
    const rect = el.getBoundingClientRect();
    const iconCenterInDock = rect.left + rect.width / 2 - dock.left;
    // normalize to natural-dock pixels: the magnification curve is tuned
    // for the unscaled dock (wide view is ground truth), so a zoomed dock
    // divides viewport distances back down and the wave shape stays
    // identical across window widths
    return (mouse - iconCenterInDock) / zoom;
  });

  const scale = useTransform(() => magnify(distance.get(), tuning).scale);
  const x = useTransform(() => magnify(distance.get(), tuning).x);

  const scaleSpring = useSpring(scale, spring);
  const xSpring = useSpring(x, spring);
  const y = useMotionValue(0);
  const dragging = useRef(false);
  const dragControls = useDragControls();
  const [draggingNow, setDraggingNow] = useState(false);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // radix's grace-period logic can leave the tooltip stuck open when the
  // cursor never fires a clean pointerleave — e.g. the magnified icon
  // springs out from under a stationary cursor. We never fight radix's
  // open state (controlling it breaks reopen); instead the content hides
  // itself whenever the trigger is not genuinely hovered.
  useMotionValueEvent(scaleSpring, 'change', () => {
    const el = triggerRef.current;
    if (!el) return;
    setTriggerHovered(el.matches(':hover'));
  });

  // radix anchors the tooltip to the trigger's *layout* box, which ignores
  // the scale transform — so while the icon magnifies upward, the tooltip
  // would hover at the unscaled edge. Offset the tooltip upward by exactly
  // the icon's visual growth, driven by the same spring, so it rides the
  // icon's real top edge. Applied as a CSS var on the content itself so we
  // don't wrap radix's node (wrapping breaks its close-animation detection).
  const lift = useTransform(scaleSpring, (s) => -((s - 1) * tuning.size) / 2);
  const contentRef = useRef<HTMLDivElement>(null);
  useMotionValueEvent(lift, 'change', (v) => {
    contentRef.current?.style.setProperty('--tooltip-lift', v + 'px');
  });

  return (
    <Reorder.Item
      as="div"
      ref={ref}
      value={entry}
      drag="x"
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => {
        dragging.current = true;
        setDraggingNow(true);
        mouseLeft.set(-Infinity);
      }}
      onDragEnd={() => {
        // suppress the click that follows a real drag
        setTimeout(() => {
          dragging.current = false;
          setDraggingNow(false);
        }, 0);
      }}
      style={{ position: 'relative' }}
    >
      <Tooltip.Provider delayDuration={0}>
        <Tooltip.Root open={draggingNow ? false : undefined}>
          <Tooltip.Trigger asChild>
            <motion.button
              ref={triggerRef}
              onPointerDown={(e) => {
                dragControls.start(e);
              }}
              onPointerEnter={() => setTriggerHovered(true)}
              onPointerLeave={() => setTriggerHovered(false)}
              style={{ x: xSpring, scale: scaleSpring, y, width: tuning.size }}
              onClick={() => {
                if (dragging.current) return;
                animate(y, [0, -40, 0], {
                  repeat: 2,
                  ease: [
                    [0, 0, 0.2, 1],
                    [0.8, 0, 1, 1],
                  ],
                  duration: 0.7,
                });
                window.open(entry.href, '_blank', 'noopener');
              }}
              className={
                'dock-icon-button aspect-square block origin-bottom' +
                (draggingNow ? ' pressed' : '')
              }
            >
              <MacosIcon entry={entry} alt={entry.name} />
            </motion.button>
          </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            ref={contentRef}
            sideOffset={10}
            className="relative z-50 rounded border border-black/10 bg-neutral-100 px-2 py-1.5 text-sm font-medium text-neutral-800 drop-shadow-[0_1px_2px_rgb(0_0_0/0.2)] dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
            style={{
              translate: '0 var(--tooltip-lift, 0px)',
              visibility: triggerHovered ? 'visible' : 'hidden',
            }}
          >
            {children}
            <span className="absolute left-1/2 top-full -ml-[5px] -mt-[6px] block h-2.5 w-2.5 rotate-45 rounded-[2px] border-b border-r border-black/10 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-700" />
          </Tooltip.Content>
        </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </Reorder.Item>
  );
}

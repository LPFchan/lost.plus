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
import { ReactNode, useMemo, useRef, useState } from 'react';

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
}: {
  entries: DockEntry[];
  tuning: DockTuning;
  onReorder: (entries: DockEntry[]) => void;
  /** whole-dock scale factor for the fit-to-width regime (A < width < B) */
  zoom?: number;
}) {
  const mouseLeft = useMotionValue(-Infinity);
  const mouseRight = useMotionValue(-Infinity);
  const spring = useMemo(
    () => ({ mass: tuning.mass, stiffness: tuning.stiffness, damping: tuning.damping }),
    [tuning.mass, tuning.stiffness, tuning.damping],
  );
  const left = useTransform(mouseLeft, [0, 40], [0, -40]);
  const right = useTransform(mouseRight, [0, 40], [0, -40]);
  const leftSpring = useSpring(left, spring);
  const rightSpring = useSpring(right, spring);
  const tray = trayGeometry(tuning);
  const naturalWidth = dockNaturalWidth(entries.length, tuning);
  // magnification grows icons beyond the dock's layout box on all sides.
  // reserve room inside the clip boundary so nothing is ever visually cut,
  // while the boundary itself stops the page from becoming scrollable
  const overflowReserve = dockOverflowReserve(tuning);
  // current dock rect in viewport coordinates, refreshed on every mousemove;
  // icons measure themselves against the same rect so zoom can't skew the
  // magnification distance math
  const dockRect = useRef<DOMRect | null>(null);

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
          const { left, right } = rect;
          const offsetLeft = e.clientX - left;
          const offsetRight = right - e.clientX;
          mouseLeft.set(offsetLeft);
          mouseRight.set(offsetRight);
        }}
        onMouseLeave={() => {
          mouseLeft.set(-Infinity);
          mouseRight.set(-Infinity);
        }}
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
          className="absolute inset-y-0 bg-white/60 dark:bg-neutral-800/60 border border-black/10 dark:border-white/10 -z-10 backdrop-blur-md"
          style={{ left: leftSpring, right: rightSpring, borderRadius: tray.radius }}
        />

        {entries.map((entry) => (
          <AppIcon key={entry.name} mouseLeft={mouseLeft} entry={entry} tuning={tuning} spring={spring} dockRect={dockRect}>
            {entry.name}
          </AppIcon>
        ))}
      </Reorder.Group>
      </div>

      <div className="min-[480px]:hidden">
        <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-x-2 gap-y-6 rounded-[2rem] bg-white/60 dark:bg-neutral-800/60 border border-black/10 dark:border-white/10 backdrop-blur-md p-6">
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
  children,
}: {
  mouseLeft: MotionValue;
  entry: DockEntry;
  tuning: DockTuning;
  spring: { mass: number; stiffness: number; damping: number };
  dockRect: React.RefObject<DOMRect | null>;
  children: ReactNode;
}) {
  // measure the button in viewport coordinates — the same space the mouse
  // position is reported in — so the distance math stays exact even when
  // the whole dock is zoomed by a CSS transform
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(() => {
    // the Reorder.Item wrapper carries no interaction transforms (scale,
    // nudge, bounce live on the button inside), so its viewport rect marks
    // the icon's true resting position in the same coordinate space as the
    // mouse — exact under any dock zoom
    const el = ref.current;
    const dock = dockRect.current;
    if (!el || !dock) return 0;
    const rect = el.getBoundingClientRect();
    const iconCenterInDock = rect.left + rect.width / 2 - dock.left;
    return mouseLeft.get() - iconCenterInDock;
  });

  const scale = useTransform(
    distance,
    [-tuning.distance, 0, tuning.distance],
    [1, tuning.scale, 1],
  );
  const x = useTransform(() => {
    const d = distance.get();
    if (d === -Infinity) {
      return 0;
    } else if (d < -tuning.distance || d > tuning.distance) {
      return Math.sign(d) * -1 * tuning.nudge;
    } else {
      return (-d / tuning.distance) * tuning.nudge * scale.get();
    }
  });

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
              className="aspect-square block origin-bottom"
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

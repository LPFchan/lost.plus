// Dock implementation taken verbatim from
// https://buildui.com/recipes/magnified-dock

'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import {
  MotionValue,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ReactNode, useMemo, useRef } from 'react';

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
  size: 40,
  gap: 12,
  scale: 2.25,
  distance: 110,
  nudge: 40,
  mass: 0.1,
  stiffness: 170,
  damping: 12,
};

export type DockEntry = {
  name: string;
  href: string;
  icon: string;
};

export default function Dock({
  entries,
  tuning,
}: {
  entries: DockEntry[];
  tuning: DockTuning;
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

  return (
    <>
      <motion.div
        onMouseMove={(e) => {
          const { left, right } = e.currentTarget.getBoundingClientRect();
          const offsetLeft = e.clientX - left;
          const offsetRight = right - e.clientX;
          mouseLeft.set(offsetLeft);
          mouseRight.set(offsetRight);
        }}
        onMouseLeave={() => {
          mouseLeft.set(-Infinity);
          mouseRight.set(-Infinity);
        }}
        className="mx-auto hidden items-end px-2 pb-3 sm:flex relative"
        style={{ gap: tuning.gap, height: tuning.size + 24 }}
      >
        <motion.div
          className="absolute rounded-2xl inset-y-0 bg-white/60 dark:bg-neutral-800/60 border border-black/10 dark:border-white/10 -z-10 backdrop-blur-md"
          style={{ left: leftSpring, right: rightSpring }}
        />

        {entries.map((entry) => (
          <AppIcon key={entry.name} mouseLeft={mouseLeft} entry={entry} tuning={tuning} spring={spring}>
            {entry.name}
          </AppIcon>
        ))}
      </motion.div>

      <div className="sm:hidden">
        <div
          className="mx-auto flex max-w-full items-end gap-4 overflow-x-scroll rounded-2xl bg-white/60 dark:bg-neutral-800/60 border border-black/10 dark:border-white/10 backdrop-blur-md px-4 pb-3 sm:hidden"
          style={{ height: tuning.size + 24 }}
        >
          {entries.map((entry) => (
            <a
              key={entry.name}
              href={entry.href}
              aria-label={entry.name}
              className="aspect-square flex-shrink-0"
              style={{ width: tuning.size }}
            >
              <span className="macos-icon">
                <img src={entry.icon} alt="" draggable={false} />
              </span>
            </a>
          ))}
        </div>
        <p className="mt-4 text-center text-xs font-medium text-neutral-400 dark:text-neutral-500">
          View at 640px with a mouse
          <br /> to see the interaction.
        </p>
      </div>
    </>
  );
}

function AppIcon({
  mouseLeft,
  entry,
  tuning,
  spring,
  children,
}: {
  mouseLeft: MotionValue;
  entry: DockEntry;
  tuning: DockTuning;
  spring: { mass: number; stiffness: number; damping: number };
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(() => {
    const bounds = ref.current
      ? { x: ref.current.offsetLeft, width: ref.current.offsetWidth }
      : { x: 0, width: 0 };

    return mouseLeft.get() - bounds.x - bounds.width / 2;
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

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.button
            ref={ref}
            style={{ x: xSpring, scale: scaleSpring, y, width: tuning.size }}
            onClick={() => {
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
            <span className="macos-icon select-none">
              <img src={entry.icon} alt={entry.name} draggable={false} />
            </span>
          </motion.button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={10}
            className="bg-neutral-100 shadow shadow-black/20 border border-black/10 dark:bg-neutral-700 dark:border-neutral-600 px-2 py-1.5 text-sm rounded text-neutral-800 dark:text-white font-medium z-50"
          >
            {children}
            <Tooltip.Arrow className="fill-neutral-100 dark:fill-neutral-700" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

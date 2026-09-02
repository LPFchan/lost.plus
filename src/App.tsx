import { useEffect, useRef, useState } from 'react';
import Backdrop, { GlassTarget } from './Backdrop';
import Dock, {
  DEFAULT_TUNING,
  DockEntry,
  DockTuning,
  dockNaturalWidth,
  dockOverflowReserve,
} from './Dock';
import heatmapIcon from './assets/raw/heatmap.png';
import eastselfIcon from './assets/raw/eastself.jpg';
import okdamIcon from './assets/raw/okdam.png';
import censorIcon from './assets/raw/censor.png';
import photopeaceIcon from './assets/raw/photopeace.png';
import gswIcon from './assets/raw/gsw.png';
import artmuIcon from './assets/raw/artmu.png';
import artmuDarkIcon from './assets/raw/artmu-dark.png';
import chatIcon from './assets/raw/chat.png';
import chatLightIcon from './assets/raw/chat-light.png';
import setupIcon from './assets/raw/setup.png';
import githubIcon from './assets/raw/github-mark.svg';
import markfopsIcon from './assets/raw/markfops.png';
import awareIcon from './assets/raw/aware.png';

const ENTRIES: DockEntry[] = [
  {
    name: 'github',
    href: 'https://github.com/LPFchan',
    icon: githubIcon,
    treatment: 'tile',
  },
  {
    name: 'heatmap',
    href: 'https://heatmap.lost.plus',
    icon: heatmapIcon,
    treatment: 'preshaped',
  },
  { name: 'okdam', href: 'https://okdam.lost.plus', icon: okdamIcon },
  {
    name: 'censor',
    href: 'https://censor.lost.plus',
    icon: censorIcon,
  },
  {
    name: 'photopeace',
    href: 'https://photopeace.lost.plus',
    icon: photopeaceIcon,
  },
  { name: 'gsw', href: 'https://gsw.lost.plus', icon: gswIcon },
  { name: 'setup', href: 'https://setup.lost.plus', icon: setupIcon },
  {
    name: 'chat',
    href: 'https://chat.lost.plus',
    icon: chatIcon,
    darkIcon: chatLightIcon,
  },
  {
    name: 'markfops',
    href: 'https://github.com/LPFchan/Markfops',
    icon: markfopsIcon,
    treatment: 'preshaped',
  },
  {
    name: 'aware',
    href: 'https://github.com/LPFchan/Aware',
    icon: awareIcon,
    treatment: 'preshaped',
  },
  {
    name: 'artmu',
    href: 'https://artmu.lost.plus',
    icon: artmuIcon,
    darkIcon: artmuDarkIcon,
  },
  { name: 'eastself', href: 'https://eastself.lost.plus', icon: eastselfIcon },
];

export default function App() {
  const [tuning] = useState<DockTuning>(DEFAULT_TUNING);
  // The dock fills this in with its glass panels; the backdrop reads it every
  // frame to know what to refract.
  const glass = useRef<GlassTarget[]>([]);

  const [entries, setEntries] = useState<DockEntry[]>(() => {
    try {
      // bump the version whenever the default order changes, so visitors
      // with a stale saved order get the new default
      const saved = JSON.parse(localStorage.getItem('dock-order-v3') ?? 'null');
      if (!Array.isArray(saved)) return ENTRIES;
      const ordered = saved
        .map((name) => ENTRIES.find((e) => e.name === name))
        .filter((e): e is DockEntry => Boolean(e));
      const missing = ENTRIES.filter((e) => !saved.includes(e.name));
      return [...ordered, ...missing];
    } catch {
      return ENTRIES;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // The backdrop's sky rides the sun over Seoul and owns the dark class
    // once it is running (it marks <html data-sky>); until then the OS
    // preference is the best guess for the first paint.
    const apply = () => {
      if (document.documentElement.hasAttribute('data-sky')) return;
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    localStorage.setItem('dock-order-v3', JSON.stringify(entries.map((e) => e.name)));
  }, [entries]);

  // three layout regimes by window width:
  //   < 640px (threshold A): iOS-springboard folder grid
  //   A..B:                  macOS dock, zoomed to fit the window
  //   > B (natural width):   macOS dock at its natural size
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    // zoom fits the dock *and* the room its magnification needs to breathe
    const natural =
      dockNaturalWidth(ENTRIES.length, tuning) +
      dockOverflowReserve(tuning) * 2 +
      32;
    const onResize = () =>
      setZoom(Math.min(1, (window.innerWidth - 16) / natural));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tuning]);

  return (
    <>
      <Backdrop glass={glass} />
      {/* The backdrop canvas is positioned, so unpositioned content would
          paint underneath it. Lift the page into its own layer above. */}
      <main className="relative z-10 flex h-full items-center justify-center">
        <Dock
          entries={entries}
          tuning={tuning}
          onReorder={setEntries}
          zoom={zoom}
          glass={glass}
        />
      </main>
    </>
  );
}

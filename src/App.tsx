import { useEffect, useState } from 'react';
import Dock, {
  DEFAULT_TUNING,
  DockEntry,
  DockTuning,
  dockNaturalWidth,
} from './Dock';
import heatmapIcon from './assets/raw/heatmap.png';
import eastselfIcon from './assets/raw/eastself.jpg';
import okdamIcon from './assets/raw/okdam.png';
import gswIcon from './assets/raw/gsw.svg';
import artmuIcon from './assets/raw/artmu.png';
import chatIcon from './assets/raw/chat.png';
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
  { name: 'gsw', href: 'https://gsw.lost.plus', icon: gswIcon },
  { name: 'setup', href: 'https://setup.lost.plus', icon: setupIcon },
  { name: 'chat', href: 'https://chat.lost.plus', icon: chatIcon },
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
  { name: 'artmu', href: 'https://artmu.lost.plus', icon: artmuIcon },
  { name: 'eastself', href: 'https://eastself.lost.plus', icon: eastselfIcon },
];

export default function App() {
  const [tuning] = useState<DockTuning>(DEFAULT_TUNING);

  const [entries, setEntries] = useState<DockEntry[]>(() => {
    try {
      // bump the version whenever the default order changes, so visitors
      // with a stale saved order get the new default
      const saved = JSON.parse(localStorage.getItem('dock-order-v2') ?? 'null');
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
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    localStorage.setItem('dock-order-v2', JSON.stringify(entries.map((e) => e.name)));
  }, [entries]);

  // three layout regimes by window width:
  //   < 640px (threshold A): iOS-springboard folder grid
  //   A..B:                  macOS dock, zoomed to fit the window
  //   > B (natural width):   macOS dock at its natural size
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const natural = dockNaturalWidth(ENTRIES.length, tuning) + 32; // breathing room
    const onResize = () =>
      setZoom(Math.min(1, (window.innerWidth - 16) / natural));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tuning]);

  return (
    <main className="flex h-full items-center justify-center">
      <Dock entries={entries} tuning={tuning} onReorder={setEntries} zoom={zoom} />
    </main>
  );
}

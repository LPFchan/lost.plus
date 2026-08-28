import { useEffect, useState } from 'react';
import Dock, { DEFAULT_TUNING, DockEntry, DockTuning } from './Dock';
import heatmapIcon from './assets/raw/heatmap.png';
import eastselfIcon from './assets/raw/eastself.jpg';
import okdamIcon from './assets/raw/okdam.png';
import gswIcon from './assets/raw/gsw.svg';
import artmuIcon from './assets/raw/artmu.png';
import chatIcon from './assets/raw/chat.svg';
import setupIcon from './assets/raw/setup.png';
import githubIcon from './assets/raw/github-mark.svg';
import markfopsIcon from './assets/raw/markfops.png';
import awareIcon from './assets/raw/aware.png';

const ENTRIES: DockEntry[] = [
  {
    name: 'heatmap',
    href: 'https://heatmap.lost.plus',
    icon: heatmapIcon,
    treatment: 'preshaped',
  },
  { name: 'eastself', href: 'https://eastself.lost.plus', icon: eastselfIcon },
  { name: 'okdam', href: 'https://okdam.lost.plus', icon: okdamIcon },
  { name: 'gsw', href: 'https://gsw.lost.plus', icon: gswIcon },
  { name: 'artmu', href: 'https://artmu.lost.plus', icon: artmuIcon },
  { name: 'chat', href: 'https://chat.lost.plus', icon: chatIcon },
  { name: 'setup', href: 'https://setup.lost.plus', icon: setupIcon },
  {
    name: 'github',
    href: 'https://github.com/LPFchan',
    icon: githubIcon,
    treatment: 'tile',
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
];

export default function App() {
  const [tuning] = useState<DockTuning>(DEFAULT_TUNING);

  const [entries, setEntries] = useState<DockEntry[]>(() => {
    try {
      const saved: string[] = JSON.parse(
        localStorage.getItem('dock-order') ?? 'null',
      );
      if (!Array.isArray(saved)) return ENTRIES;
      const ordered = saved
        .map((name) => ENTRIES.find((e) => e.name === name))
        .filter((e): e is DockEntry => Boolean(e));
      // entries added since the order was saved go at the end
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
    localStorage.setItem('dock-order', JSON.stringify(entries.map((e) => e.name)));
  }, [entries]);

  return (
    <main className="flex h-full items-center justify-center">
      <Dock entries={entries} tuning={tuning} onReorder={setEntries} />
    </main>
  );
}

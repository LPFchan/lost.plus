import { useEffect, useState } from 'react';
import Dock, { DEFAULT_TUNING, DockEntry, DockTuning } from './Dock';
import TuningPanel from './TuningPanel';
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
  { name: 'heatmap', href: 'https://heatmap.lost.plus', icon: heatmapIcon },
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
  const [tuning, setTuning] = useState<DockTuning>(() => {
    try {
      const saved = localStorage.getItem('dock-tuning');
      return saved ? { ...DEFAULT_TUNING, ...JSON.parse(saved) } : DEFAULT_TUNING;
    } catch {
      return DEFAULT_TUNING;
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
    localStorage.setItem('dock-tuning', JSON.stringify(tuning));
  }, [tuning]);

  return (
    <main className="flex h-full items-center justify-center">
      <Dock entries={ENTRIES} tuning={tuning} />
      <TuningPanel tuning={tuning} onChange={setTuning} />
    </main>
  );
}

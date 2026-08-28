import { useEffect } from 'react';
import Dock, { DockEntry } from './Dock';
import heatmapIcon from './assets/raw/heatmap.png';
import eastselfIcon from './assets/raw/eastself.jpg';
import okdamIcon from './assets/raw/okdam.png';
import gswIcon from './assets/raw/gsw.svg';
import artmuIcon from './assets/raw/artmu.png';
import chatIcon from './assets/raw/chat.svg';
import setupIcon from './assets/raw/setup.png';

const ENTRIES: DockEntry[] = [
  { name: 'heatmap', href: 'https://heatmap.lost.plus', icon: heatmapIcon },
  { name: 'eastself', href: 'https://eastself.lost.plus', icon: eastselfIcon },
  { name: 'okdam', href: 'https://okdam.lost.plus', icon: okdamIcon },
  { name: 'gsw', href: 'https://gsw.lost.plus', icon: gswIcon },
  { name: 'artmu', href: 'https://artmu.lost.plus', icon: artmuIcon },
  { name: 'chat', href: 'https://chat.lost.plus', icon: chatIcon },
  { name: 'setup', href: 'https://setup.lost.plus', icon: setupIcon },
];

export default function App() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <main className="flex h-full items-center justify-center">
      <Dock entries={ENTRIES} />
    </main>
  );
}

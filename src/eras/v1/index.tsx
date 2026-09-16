// Era v1: the macOS dock (and the phone-sized folder grid under 480px).

import { useEffect, useState } from 'react';
import { ENTRIES, Entry } from '../../entries';
import { EraProps } from '../types';
import Dock, { DEFAULT_TUNING, DockTuning, dockNaturalWidth, dockOverflowReserve } from './Dock';

export default function V1({ glass }: EraProps) {
  const [tuning] = useState<DockTuning>(DEFAULT_TUNING);

  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      // bump the version whenever the default order changes, so visitors
      // with a stale saved order get the new default
      const saved = JSON.parse(localStorage.getItem('dock-order-v4') ?? 'null');
      if (!Array.isArray(saved)) return ENTRIES;
      const ordered = saved
        .map((name) => ENTRIES.find((e) => e.name === name))
        .filter((e): e is Entry => Boolean(e));
      const missing = ENTRIES.filter((e) => !saved.includes(e.name));
      return [...ordered, ...missing];
    } catch {
      return ENTRIES;
    }
  });

  useEffect(() => {
    localStorage.setItem('dock-order-v4', JSON.stringify(entries.map((e) => e.name)));
  }, [entries]);

  // three layout regimes by window width:
  //   < 480px (threshold A): iOS-springboard folder grid
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
    <main className="relative z-10 flex h-full items-center justify-center">
      <Dock
        entries={entries}
        tuning={tuning}
        onReorder={setEntries}
        zoom={zoom}
        glass={glass}
      />
    </main>
  );
}

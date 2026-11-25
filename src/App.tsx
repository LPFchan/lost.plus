// lost.plus: the welcome page for fleet. One long sheet of paper, a scene
// per idea (src/scenes/), and a thread through all of them.

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import Thread from './Thread';
import { tear, tearAround } from './ink';
import { LANG } from './i18n';
import { Plus } from './kit';
import Hero from './scenes/hero';
import Drift from './scenes/drift';
import Mesh from './scenes/mesh';
import Agents from './scenes/agents';
import Tools from './scenes/tools';
import Cloud from './scenes/cloud';
import Call from './scenes/call';
import Join from './scenes/join';

// the phone call is shown to Korean readers alone (see `call` in i18n.ts)
const KOREAN = LANG === 'ko';

/** a sheet laid over the page: night runs edge to edge and is torn along
    its top and bottom, tan is a piece torn all round */
export function Band({ kind, seed, children }: { kind: 'night' | 'tan'; seed: number; children: ReactNode }) {
  const edge = useMemo(() => (kind === 'night' ? tear(seed) : tearAround(seed, 9, 44, 26)), [kind, seed]);
  return (
    <div className={`band ${kind}`} style={{ '--tear': edge } as CSSProperties}>
      {children}
    </div>
  );
}

export default function App() {
  const page = useRef<HTMLElement>(null);

  // A scene comes in once, when it is first scrolled to.
  useEffect(() => {
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('in');
            seen.unobserve(e.target);
          }
      },
      { rootMargin: '0px 0px -18% 0px' },
    );
    page.current!.querySelectorAll('.scene').forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, []);

  return (
    <main className="page" ref={page}>
      <Thread />

      <Hero />
      <Drift />
      <Mesh />

      <Band kind="tan" seed={4}>
        <Agents />
      </Band>

      <Band kind="night" seed={6}>
        <Tools />
        <Cloud />
        {KOREAN && <Call />}
      </Band>

      <Join />

      <footer>
        <Plus size={26} />
        <p>
          lost.plus · <a href="https://github.com/LPFchan">github</a>
        </p>
      </footer>
    </main>
  );
}

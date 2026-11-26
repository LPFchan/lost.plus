// lost.plus: the welcome page for fleet. One long sheet of paper, a scene
// per idea (src/scenes/), and a thread through all of them.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Thread from './Thread';
import { tear, tearAround } from './ink';
import { handReady, LANG } from './i18n';
import { ARTICLES as ALL_ARTICLES, NEWS as ALL_NEWS } from './articles';
import { Plus } from './kit';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
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

// the newest post on the blog, pinned above the page; the post only exists
// in English and Korean, so every other language gets the English one
const NEWS = KOREAN ? ALL_NEWS.ko : ALL_NEWS.en;

// everything on the blog, newest first, listed on a dark sheet near the end
// of the page; add a row in src/articles.ts when a post goes up
const ARTICLES = ALL_ARTICLES.map((a) => ({
  date: a.date,
  title: a.title,
  href: KOREAN ? `/${a.slug}?lang=ko` : `/${a.slug}`,
  text: KOREAN ? a.ko : a.en,
}));

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
  const [ready, setReady] = useState(false);

  // Hold the page on bare paper until the active language's hand and
  // Pretendard have loaded, so no fallback type flashes before the opening.
  useEffect(() => {
    let alive = true;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const wait = async () => {
      await handReady;
      if (document.fonts) {
        const root = page.current;
        const targets = root ? [...root.querySelectorAll('.hero h1, .hero p, .news, .news b, .news strong')] : [];
        if (targets.length) {
          await Promise.allSettled(
            targets.map((el) => {
              const s = getComputedStyle(el);
              return document.fonts.load(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, el.textContent ?? '');
            }),
          );
        } else {
          await document.fonts.ready;
        }
      }
      // Flush pre-entrance layout and wait one frame so CSS transitions always
      // run from their hidden starting state, even on cached reloads.
      void page.current?.offsetHeight;
      await frame();
    };
    const fallback = new Promise<void>((r) => setTimeout(r, 2500));
    Promise.race([wait(), fallback]).then(() => {
      if (alive) setReady(true);
    });
    return () => { alive = false; };
  }, []);

  // A scene comes in once, when it is first scrolled to.
  useEffect(() => {
    if (!ready) return;
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
  }, [ready]);

  return (
    <main className={`page${ready ? ' ready' : ''}`} ref={page}>
      <Thread ready={ready} />

      <a className="news" href={NEWS.href} lang={KOREAN ? 'ko' : 'en'}>
        <b>NEW</b>
        <span><strong>{NEWS.title}</strong>: {NEWS.text}</span>
        <span aria-hidden="true">→</span>
      </a>

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

      <div className="sheet">
        <section className="articles" lang={KOREAN ? 'ko' : 'en'}>
          <h2>Research &amp; articles</h2>
          <ul>
            {ARTICLES.map((a) => (
              <li key={a.href}>
                <a href={a.href}>
                  <time dateTime={a.date}>{a.date}</time>
                  <strong>{a.title}</strong>
                  <span>{a.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <footer>
          <Plus size={26} />
          <p>
            lost.plus · <a href="https://github.com/LPFchan">github</a>
          </p>
        </footer>
      </div>

    </main>
  );
}

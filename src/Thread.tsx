// The thread: one line from the top of the page to the bottom, through
// every element marked `data-thread`, in document order. It is laid out
// from where those elements actually are, so it follows the page through any
// width, and it is drawn only as far as the visitor has scrolled.

import { useEffect, useRef } from 'react';
import { curve, rng, type Pt } from './ink';

const NARROW = 760; // one column below this, as in index.css
const AHEAD = 0.62; // the pen stays this far down the viewport
const STIFFNESS = 90;
const DAMPING = 17; // a little under critical: the pen settles, barely

export default function Thread() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const path = pathRef.current!;
    const page = svg.parentElement!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let total = 0;
    let reach: { y: number; len: number }[] = []; // lowest y reached by each length
    let pos = 0;
    let vel = 0;
    let target = 0;
    let raf = 0;
    let last = 0;

    const show = () => {
      path.style.strokeDashoffset = String(Math.max(0, total - pos));
    };

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      vel += (STIFFNESS * (target - pos) - DAMPING * vel) * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 0.5 && Math.abs(vel) < 0.5) {
        pos = target;
        raf = 0;
      } else raf = requestAnimationFrame(tick);
      show();
    };

    // The thread stays drawn: scrolling back up does not unpick it.
    const aim = () => {
      const y = scrollY + innerHeight * AHEAD;
      let len = 0;
      for (const s of reach) {
        if (s.y > y) break;
        len = s.len;
      }
      // The last stretch sits below that line even at the foot of the page.
      if (scrollY + innerHeight >= page.scrollHeight - 2) len = total;
      target = Math.max(target, len);
      if (still) {
        pos = total;
        show();
      } else if (!raf && target !== pos) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const layout = () => {
      const base = page.getBoundingClientRect();
      const width = page.clientWidth;
      const marks: Pt[] = [...page.querySelectorAll('[data-thread]')].map((el) => {
        const b = el.getBoundingClientRect();
        return [b.left + b.width / 2 - base.left, b.top + b.height / 2 - base.top];
      });
      if (marks.length < 2) return;

      // Between two marks far apart the thread wanders from side to side
      // rather than falling straight. In one column it has the words to
      // cross, so there it barely wanders at all.
      const r = rng(7);
      const sway = width < NARROW ? 24 : Math.min(130, width * 0.14);
      const pts: Pt[] = [marks[0]];
      let side = 1;
      for (let i = 1; i < marks.length; i++) {
        const a = marks[i - 1];
        const b = marks[i];
        const bends = Math.floor((b[1] - a[1]) / 320);
        for (let j = 1; j <= bends; j++) {
          const t = j / (bends + 1);
          const x = a[0] + (b[0] - a[0]) * t + side * sway * (0.5 + r() * 0.7);
          pts.push([Math.min(width - 14, Math.max(14, x)), a[1] + (b[1] - a[1]) * t]);
          side = -side;
        }
        pts.push(b);
      }

      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(page.scrollHeight));
      path.setAttribute('d', curve(pts));
      total = path.getTotalLength();
      path.style.strokeDasharray = `${total} ${total}`;

      reach = [];
      let low = -Infinity;
      for (let len = 0; len <= total; len += 16) {
        low = Math.max(low, path.getPointAtLength(len).y);
        reach.push({ y: low, len });
      }
      target = 0;
      aim();
      pos = Math.min(pos, total);
      show();
    };

    layout();
    const sizes = new ResizeObserver(layout);
    sizes.observe(page);
    document.fonts?.ready.then(layout);
    addEventListener('scroll', aim, { passive: true });
    return () => {
      sizes.disconnect();
      removeEventListener('scroll', aim);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <svg ref={svgRef} className="thread" aria-hidden="true">
      <path ref={pathRef} />
    </svg>
  );
}

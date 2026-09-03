// Hidden diagnostic tuning console. Open and close it with the secret
// arrow sequence: up up down down left right left right (Konami-style).
// It live-tunes the backdrop (quality, glass lens, sun hour, clouds) and
// persists everything to localStorage. The menu writes localStorage and
// fires a lp:tune event; Backdrop and the hero re-read config on it.

import { useCallback, useEffect, useRef, useState } from 'react';

const SEQ = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
];

const GLYPH: Record<string, string> = {
  ArrowUp: '\u25B2',
  ArrowDown: '\u25BC',
  ArrowLeft: '\u25C0',
  ArrowRight: '\u25B6',
};

type Perf = { fps: number; ms: number };

function readPerf(): Perf | null {
  const p = (window as unknown as Record<string, unknown>).__perf as
    | Perf
    | undefined;
  return p && Number.isFinite(p.fps) ? p : null;
}

function getLS(key: string, fallback = ''): string {
  return localStorage.getItem(key) ?? fallback;
}

function setLS(key: string, value: string) {
  if (value === '') localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  window.dispatchEvent(new Event('lp:tune'));
}

// One lens parameter: where it sits in the stored array, its default, the
// drag range and how finely a pixel of dragging moves it.
type LensField = {
  key: number;
  label: string;
  def: number;
  min: number;
  max: number;
  step: number;
  digits: number; // decimals shown; -1 means "leave empty"
  emptyDef?: boolean; // default is "not set", shown blank
};

const LENS_FIELDS: LensField[] = [
  { key: 0, label: 'bleed', def: 140, min: 0, max: 400, step: 1, digits: 0 },
  { key: 1, label: 'thick', def: 90, min: 4, max: 200, step: 0.5, digits: 0 },
  { key: 2, label: 'disp', def: 110, min: 0, max: 300, step: 1, digits: 0 },
  { key: 3, label: 'ior', def: 1.45, min: 1.0, max: 2.5, step: 0.005, digits: 2 },
  { key: 4, label: 'lod', def: 1.0, min: 0, max: 5, step: 0.02, digits: 1 },
  { key: 5, label: 'tint', def: -1, min: -1, max: 1, step: 0.01, digits: 2, emptyDef: true },
];

function fmt(f: LensField, v: number): string {
  return v.toFixed(f.digits);
}

// The stored string keeps six slots; empty slots mean "default".
function readLens(): string[] {
  const raw = getLS('lp-lens');
  const parts = raw ? raw.split(',') : [];
  return LENS_FIELDS.map((f, i) => {
    const v = parseFloat(parts[i] ?? '');
    return Number.isFinite(v) ? fmt(f, v) : '';
  });
}

function writeLens(parts: string[]) {
  const out = [...parts];
  while (out.length && out[out.length - 1] === '') out.pop();
  setLS('lp-lens', out.join(','));
}

function numOr(f: LensField, s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : f.def;
}

export default function TuneMenu() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [perf, setPerf] = useState<Perf | null>(null);
  const [quality, setQuality] = useState(() => getLS('lp-quality', '0.7'));
  const [sun, setSun] = useState(() => getLS('lp-sun'));
  const [cloud, setCloud] = useState(() => getLS('lp-cloud'));
  const [lens, setLens] = useState<string[]>(readLens);
  const seqRef = useRef(0);
  const dragRef = useRef<{ i: number; startX: number; startV: number; moved: boolean } | null>(null);

  // Rolling prefix match. A wrong key restarts the match; if that key is
  // the first of the sequence it counts as a new start.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let n = seqRef.current;
      if (e.key === SEQ[n]) n += 1;
      else n = e.key === SEQ[0] ? 1 : 0;
      seqRef.current = n;
      setProgress(n);
      if (n === SEQ.length) {
        seqRef.current = 0;
        setProgress(0);
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setPerf(readPerf()), 500);
    return () => clearInterval(id);
  }, [open]);

  const applyQuality = useCallback((v: string) => {
    setQuality(v);
    setLS('lp-quality', v);
  }, []);
  const applySun = useCallback((v: string) => {
    setSun(v);
    setLS('lp-sun', v);
  }, []);
  const applyCloud = useCallback((v: string) => {
    setCloud(v);
    setLS('lp-cloud', v);
  }, []);

  const applyLens = useCallback((i: number, v: string) => {
    setLens((prev) => {
      const next = [...prev];
      next[i] = v;
      writeLens(next);
      return next;
    });
  }, []);

  // Drag-to-scrub: press on the value, drag right to increase, left to
  // decrease. A press that never moves is a click and focuses the input
  // for typing instead, so both gestures share one control.
  const onLensPointerDown = (i: number) => (e: React.PointerEvent) => {
    const f = LENS_FIELDS[i];
    dragRef.current = { i, startX: e.clientX, startV: numOr(f, lens[i]), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onLensPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const f = LENS_FIELDS[d.i];
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 3) return; // click slop
    d.moved = true;
    const range = f.max - f.min;
    const per = range / 200; // 200px of drag crosses the whole range
    let v = d.startV + dx * per;
    v = Math.round(v / f.step) * f.step;
    v = Math.min(f.max, Math.max(f.min, v));
    applyLens(d.i, fmt(f, v));
  };
  const onLensPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) {
      // treat as a click: focus for typing and select the value
      const input = (e.currentTarget as HTMLElement).querySelector('input');
      input?.focus();
      input?.select();
    }
  };

  const resetAll = () => {
    for (const k of ['lp-quality', 'lp-sun', 'lp-cloud', 'lp-lens'])
      localStorage.removeItem(k);
    setQuality('0.7');
    setSun('');
    setCloud('');
    setLens(readLens());
    window.dispatchEvent(new Event('lp:tune'));
  };

  if (!open)
    return progress > 0 ? (
      <div className="tune-progress" aria-hidden="true">
        {SEQ.slice(0, progress).map((k, i) => (
          <span key={i}>{GLYPH[k]}</span>
        ))}
      </div>
    ) : null;

  return (
    <div className="tune-menu" role="dialog" aria-label="tuning">
      <div className="tune-head">
        <span>tuning</span>
        <span className="tune-fps">
          {perf ? perf.fps.toFixed(0) + ' fps / ' + perf.ms.toFixed(1) + ' ms' : '...'}
        </span>
        <button className="tune-close" onClick={() => setOpen(false)} aria-label="close">
          x
        </button>
      </div>

      <label className="tune-row">
        <span>quality {quality}</span>
        <input type="range" min="0.4" max="2" step="0.05"
          value={quality || '0.7'} onChange={(e) => applyQuality(e.target.value)} />
      </label>

      <label className="tune-row">
        <span>sun hour {sun === '' ? '(live KST)' : sun}</span>
        <input type="range" min="0" max="24" step="0.25"
          value={sun === '' ? '12' : sun} onChange={(e) => applySun(e.target.value)} />
      </label>
      <button className="tune-link" onClick={() => applySun('')}>follow real time</button>

      <label className="tune-row">
        <span>clouds {cloud === '' ? '(auto)' : cloud}</span>
        <input type="range" min="0" max="1" step="0.02"
          value={cloud === '' ? '0.8' : cloud} onChange={(e) => applyCloud(e.target.value)} />
      </label>
      <button className="tune-link" onClick={() => applyCloud('')}>auto coverage</button>

      <div className="tune-lens">
        {LENS_FIELDS.map((f, i) => (
          <div
            key={f.key}
            className="tune-lens-field"
            onPointerDown={onLensPointerDown(i)}
            onPointerMove={onLensPointerMove}
            onPointerUp={onLensPointerUp}
            title="drag to scrub, click to type"
          >
            <span>{f.label}</span>
            <input
              type="text"
              inputMode="decimal"
              value={lens[i]}
              placeholder={f.emptyDef ? 'auto' : fmt(f, f.def)}
              onChange={(e) => applyLens(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button className="tune-reset" onClick={resetAll}>reset all</button>
    </div>
  );
}

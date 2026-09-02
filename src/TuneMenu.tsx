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

function lensParts(): string[] {
  const raw = getLS('lp-lens');
  const parts = raw ? raw.split(',') : [];
  while (parts.length < 6) parts.push('');
  return parts.slice(0, 6);
}

function writeLens(parts: string[]) {
  const out = [...parts];
  while (out.length && out[out.length - 1] === '') out.pop();
  setLS('lp-lens', out.join(','));
}

const LENS_FIELDS = [
  { key: 0, label: 'bleed', placeholder: '140' },
  { key: 1, label: 'thick', placeholder: '90' },
  { key: 2, label: 'disp', placeholder: '110' },
  { key: 3, label: 'ior', placeholder: '1.45' },
  { key: 4, label: 'lod', placeholder: '1.0' },
  { key: 5, label: 'tint', placeholder: '-1' },
] as const;

export default function TuneMenu() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [perf, setPerf] = useState<Perf | null>(null);
  const [quality, setQuality] = useState(() => getLS('lp-quality', '1'));
  const [sun, setSun] = useState(() => getLS('lp-sun'));
  const [cloud, setCloud] = useState(() => getLS('lp-cloud'));
  const [lens, setLens] = useState<string[]>(lensParts);
  const seqRef = useRef(0);

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
  const applyLens = useCallback(
    (i: number, v: string) => {
      const next = [...lens];
      next[i] = v;
      setLens(next);
      writeLens(next);
    },
    [lens],
  );

  const resetAll = () => {
    for (const k of ['lp-quality', 'lp-sun', 'lp-cloud', 'lp-lens'])
      localStorage.removeItem(k);
    setQuality('1');
    setSun('');
    setCloud('');
    setLens(lensParts());
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
          value={quality || '1'} onChange={(e) => applyQuality(e.target.value)} />
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
        {LENS_FIELDS.map((f) => (
          <label key={f.key} className="tune-lens-field">
            <span>{f.label}</span>
            <input type="text" inputMode="decimal" value={lens[f.key]}
              placeholder={f.placeholder} onChange={(e) => applyLens(f.key, e.target.value)} />
          </label>
        ))}
      </div>

      <button className="tune-reset" onClick={resetAll}>reset all</button>
    </div>
  );
}

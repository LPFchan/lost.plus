// Scrubbable tuning fields shared by the tuning console and whatever reads
// them. A group is a list of fields stored as one comma-separated string
// in localStorage; empty slots mean "default". The console writes and
// fires lp:tune; readers re-read on that event.

export type Field = {
  label: string;
  def: number;
  min: number;
  max: number;
  step: number;
  digits: number; // decimals shown; -1 means "leave empty"
  emptyDef?: boolean; // default is "not set", shown blank
};

export function fmt(f: Field, v: number): string {
  return v.toFixed(f.digits);
}

export function getLS(key: string, fallback = ''): string {
  return localStorage.getItem(key) ?? fallback;
}

export function setLS(key: string, value: string) {
  if (value === '') localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  window.dispatchEvent(new Event('lp:tune'));
}

/** the stored strings, one per field, '' for "default" */
export function readGroup(key: string, fields: Field[]): string[] {
  const raw = getLS(key);
  const parts = raw ? raw.split(',') : [];
  return fields.map((f, i) => {
    const v = parseFloat(parts[i] ?? '');
    return Number.isFinite(v) ? fmt(f, v) : '';
  });
}

export function writeGroup(key: string, parts: string[]) {
  const out = [...parts];
  while (out.length && out[out.length - 1] === '') out.pop();
  setLS(key, out.join(','));
}

/** the numbers, defaults filled in */
export function readValues(key: string, fields: Field[]): number[] {
  return readGroup(key, fields).map((s, i) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : fields[i].def;
  });
}

// ---- the v2 list ---------------------------------------------------------

export const LIST_KEY = 'lp-list';
export const LIST_FIELDS: Field[] = [
  { label: 'size', def: 44, min: 28, max: 80, step: 1, digits: 0 },
  { label: 'scale', def: 1.5, min: 1, max: 2.5, step: 0.01, digits: 2 },
  { label: 'dist', def: 110, min: 20, max: 400, step: 1, digits: 0 },
  { label: 'nudge', def: 22, min: 0, max: 80, step: 1, digits: 0 },
  { label: 'dwell', def: 2, min: 0.2, max: 6, step: 0.1, digits: 1 },
  { label: 'stiff', def: 220, min: 50, max: 600, step: 5, digits: 0 },
  { label: 'damp', def: 13, min: 4, max: 40, step: 0.5, digits: 1 },
  { label: 'rest', def: 0.42, min: 0.05, max: 1, step: 0.01, digits: 2 },
];

export type ListTuning = {
  size: number;
  scale: number;
  distance: number;
  nudge: number;
  dwellMs: number;
  stiffness: number;
  damping: number;
  rest: number;
};

export function readListTuning(): ListTuning {
  const [size, scale, distance, nudge, dwell, stiffness, damping, rest] = readValues(
    LIST_KEY,
    LIST_FIELDS,
  );
  return { size, scale, distance, nudge, dwellMs: dwell * 1000, stiffness, damping, rest };
}

// ---- the scene's dim, for eras that dim ------------------------------------

export const DIM_KEY = 'lp-dim';
export const DIM_FIELDS: Field[] = [
  { label: 'dim', def: -1, min: 0, max: 1, step: 0.01, digits: 2, emptyDef: true },
];

/** the console's dim, or null to use the era's own */
export function dimOverride(): number | null {
  const q = parseFloat(new URLSearchParams(location.search).get('dim') ?? '');
  if (Number.isFinite(q)) return Math.min(1, Math.max(0, q));
  const [v] = readGroup(DIM_KEY, DIM_FIELDS);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

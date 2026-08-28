import { DockTuning } from './Dock';

type SliderSpec = {
  key: keyof DockTuning;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderSpec[] = [
  { key: 'size', label: 'icon size', min: 24, max: 96, step: 1 },
  { key: 'gap', label: 'spacing', min: 0, max: 40, step: 1 },
  { key: 'scale', label: 'magnify factor', min: 1, max: 4, step: 0.05 },
  { key: 'distance', label: 'magnify range', min: 40, max: 300, step: 5 },
  { key: 'nudge', label: 'nudge', min: 0, max: 100, step: 1 },
  { key: 'mass', label: 'spring mass', min: 0.05, max: 1, step: 0.01 },
  { key: 'stiffness', label: 'spring stiffness', min: 40, max: 600, step: 5 },
  { key: 'damping', label: 'spring damping', min: 4, max: 60, step: 1 },
];

function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export default function TuningPanel({
  tuning,
  onChange,
}: {
  tuning: DockTuning;
  onChange: (t: DockTuning) => void;
}) {
  const copy = async () => {
    const text = JSON.stringify(tuning, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[min(92vw,26rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          dock tuning
        </span>
        <button
          onClick={copy}
          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          copy values
        </button>
      </div>
      <div className="grid grid-cols-[7.5rem_1fr_2.75rem] items-center gap-x-3 gap-y-1.5">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="contents">
            <label className="text-xs text-neutral-600 dark:text-neutral-300">
              {label}
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={tuning[key]}
              onChange={(e) =>
                onChange({ ...tuning, [key]: Number(e.target.value) })
              }
              className="h-1 w-full accent-neutral-800 dark:accent-neutral-200"
            />
            <span className="text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              {format(tuning[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

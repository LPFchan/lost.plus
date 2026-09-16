// The era selector: a small pill in the top-right corner, desktop only. Two
// words, the current one lit. It reads as a footnote, not a control bar.

import { ERAS } from './eras';

export default function EraSelector({
  era,
  onChange,
}: {
  era: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="era-selector" aria-label="site era">
      {ERAS.map((e) => (
        <button
          key={e.id}
          type="button"
          className={'era-option' + (e.id === era ? ' current' : '')}
          aria-current={e.id === era ? 'true' : undefined}
          onClick={() => onChange(e.id)}
        >
          {e.label}
        </button>
      ))}
    </nav>
  );
}

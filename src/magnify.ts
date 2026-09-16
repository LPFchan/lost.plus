// The magnification curve shared by the eras: how much an item `d` px from
// the pointer grows, and how far it is pushed away. v1 runs it along x for
// the dock, v2 along y for the list. It is the single source of truth for
// each: the items transform with it, and whatever hugs them (the v1 tray)
// measures with it too, so the two can never disagree about where an
// item's edge has got to.
//
// `d` is signed: positive means the pointer is past the item (right of it,
// or below it), so the item is pushed the other way.
//
// Items of different extents: `d` is measured to the item's *core*, which
// is what is left of the item after `size`/2 is taken off each end. For a
// standard item that is its centre point, and the curve is exactly the
// classic one. For an item longer than `size` it is a segment, so the item
// is at full scale across its extra length and the falloff starts from the
// core's ends rather than from the middle; the neighbours measure to the
// same core, so they only wake up when the pointer is really near them.
// `spanDistance` is that measurement. The v1 dock has only standard items;
// v2's open row (head plus card) is the long one.

export type MagnifyTuning = {
  size: number; // resting item extent in px, along the magnified axis
  scale: number; // max scale factor of an item
  distance: number; // pixels before the pointer affects an item
  nudge: number; // pixels items are moved away from the pointer
};

export function magnify(d: number, tuning: MagnifyTuning): { scale: number; x: number } {
  if (d === -Infinity) return { scale: 1, x: 0 };
  const t = Math.min(Math.abs(d) / tuning.distance, 1);
  const scale = 1 + (tuning.scale - 1) * (1 - t);
  const x =
    t >= 1
      ? Math.sign(d) * -tuning.nudge
      : (-d / tuning.distance) * tuning.nudge * scale;
  return { scale, x };
}

/** signed distance from `p` to the segment [a, b]: negative before it, 0 inside, positive past it */
export function spanDistance(p: number, a: number, b: number): number {
  return p < a ? p - a : p > b ? p - b : 0;
}

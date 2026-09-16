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
// Items of different extents: measure `d` to the centre of the item's whole
// extent and scale the whole extent by the result. A longer item is then
// just a taller wave: it peaks with the pointer at its middle, is part way
// up at its ends, and its neighbours measure to the same centre, so they
// start as far away as they look. The v1 dock has only standard items;
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

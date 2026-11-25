# lost.plus

The welcome page for fleet: what it is, what it does, and how to join. One
long sheet of paper, a drawing per idea with a line of caption, and a thread
running through all of them. The drawings do the explaining; the words stay
few.

Built with Vite + React. No UI library and no images: every line on the page
is drawn in the browser.

## How the page is drawn

- `src/ink.ts` is the pen. A seeded random source (`rng`) feeds a few
  functions that draw nearly straight strokes, circles that do not quite
  close, and lines of writing too small to read. The seed is fixed per
  drawing, so the wobble looks hand-made and comes out the same every visit.
- `src/scenes/` holds one file per section of the page (hero, drift,
  mesh, agents, tools, cloud, call, join). A scene owns its
  caption and its drawing, and may bring its own stylesheet beside it, with
  every class prefixed by the scene's name.
- `src/kit.tsx` is what scenes are built from: `Scene` and `Scrap` for the
  words, `Art`, `Label`, `Paper`, `Knot` and `Glyph` for the drawings. A
  drawing is composed on a canvas a thousand units wide and declares the span
  that has ink in it (`x`): a wide page gives that span its share of the
  width, a phone lets it fill the screen. The words on a drawing are HTML
  laid over it (`Label`), positioned in the drawing's own coordinates, so
  they stay a readable size however small the drawing is scaled. Strokes use
  `vector-effect: non-scaling-stroke` for the same reason. Machines on the
  page go by what they are (laptop, desktop, nas), never by a real hostname.
- `src/scenes/marks.ts` draws the coding agents' own marks with the same pen.
  `src/scenes/machines.ts` draws the six computers in the hero (loose
  sketched strokes, no fills), and `src/scenes/things.ts` the paper cut-outs
  in the connected-accounts scene.
- `src/i18n.ts` holds every word on the page, one catalog per language (29
  of them). The language is the first one the browser asks for that has a
  catalog, or `?lang=de` in the address. A caption breaks into one scrap of
  paper per line (`\n`). Japanese and Chinese mark where a line may break
  with `|`. Arabic turns the page right-to-left. The phone-call scene is
  written and shown in Korean only, because the call service only rings
  Korean numbers.
- `src/Thread.tsx` is the thread. It runs through every element marked
  `data-thread`, in document order; a drawing places one with `<Knot>`. The
  path is laid out from where those elements really are, so it follows the
  page at any width and is laid out again when the page resizes. It is drawn
  only as far as the visitor has scrolled (a spring chases the scroll
  position) and stays drawn when they scroll back up.
- `src/App.tsx` is the page: the order of the scenes, and the two sheets laid
  over the paper (`Band`: tan and night), whose torn edges are a
  generated `clip-path`.
- `src/index.css` holds the look. Surfaces and inks are the yeowool palette;
  the thread and the red plus are the only colour. The type is Gaegu Light,
  bundled from `@fontsource/gaegu`, which has English's letters and no
  others. Hangul is set in 나눔손글씨 암스테르담 (Naver, SIL Open Font
  License), subset to the 2,350 common syllables in `src/fonts/`. Japanese
  is Yomogi, Chinese LXGW WenKai Light, Hindi Kalam Light, Arabic Playpen
  Sans Arabic Light, and every other language Playpen Sans Light, scaled to
  Gaegu's size. Each comes from its npm package and is fetched only for its
  own language (`HANDS` in `src/i18n.ts`, the stacks in `src/index.css`).
- Torn paper comes from the same pen. `tearAround` makes the `clip-path` of a
  scrap in the page (`Scrap` in `src/kit.tsx`: captions, commands, the
  sign-in), and `torn` makes the same shape as a path for paper pasted inside
  a drawing (`Paper` in `src/kit.tsx`). Every scrap is the paper plus a
  copy of itself underneath as its shadow, and its seed picks its tear, tint
  and tilt.

`prefers-reduced-motion` shows the whole thread at once and drops the
scenes' entrance.

## Adding a scene

Add `src/scenes/<name>.tsx` that default-exports a component whose root is a
`<Scene>` (or any `<section className="scene">`), put a `<Knot>` in its
drawing where the thread should pass, and list it in `src/App.tsx`.

A scene makes one point. Its drawing shows the real thing (the real command,
the real file, what really appears on the screen) rather than a metaphor, and
its caption is a plain sentence or two saying what is true, not a slogan.
Add its words to every catalog in `src/i18n.ts`, and keep words that sit
on a drawing (labels, the lines on a sheet) about as short as the English. If the idea needs a paragraph, the drawing is
not carrying it yet. Check it at 1280px and at 390px wide. Every claim on the
page should be something fleet actually does: check it against `LPFchan/auth`
(`fleet/README.md`) first.

## The launcher this replaced

Until 2026-11 this site was a launcher for the services under lost.plus, with
two looks (a macOS dock, then a watchOS-style list) over a WebGL sky. It is in
the history before this README changed.

The launcher was an installable PWA whose service worker cached the whole
site. `vite.config.ts` therefore still ships a worker at `/sw.js`, one that
unregisters itself and clears those caches, so returning visitors get this
page instead of their stored copy. Keep it until nobody can still have the
old one.

## Develop

```sh
npm ci
npm run dev      # local server
npm run build    # type-check, then build into dist/
```

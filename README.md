# lost.plus

A static launcher for the web services I host, styled as a macOS dock
(magnify on hover, spring physics, bounce on click). Built with Vite + React +
Tailwind v4 + framer-motion; the dock interaction started as the
[buildui magnified-dock recipe](https://buildui.com/recipes/magnified-dock),
with the tray's edges reworked (see below).

## Dock tray

The tray hugs the icons at each end, holding the padding it has at rest.

The recipe stretched it by a fixed 40px keyed off the cursor position, which
broke that padding two separate ways once the tuning moved away from the
recipe's defaults. An end icon shoved away from the cursor travels `nudge`
(61px) and outran the tray, closing the gap to 7px. An end icon that *is* the
hovered one isn't shoved at all — it only magnifies — so the tray ran away from
it instead and the gap opened to 42px.

Both edges are now derived from the same `magnify()` the icons transform with,
so there is no constant left to keep in sync with the tuning, and growth is
handled by the same measurement as the nudge rather than being missed. Because
the tray hugs the icons' *button* box, the visible gap around any icon works out
to `padding + scale * inset` on all four sides at once — uniform all around,
whether that icon is magnified or not.

The corner radius deliberately does not follow: it feeds the glass shader,
whose shape model carries one radius for all four corners, so a tray whose two
ends had grown by different amounts could not be expressed.

## Backdrop and glass

The background is a small procedural landscape — sky, sun and moon, drifting
clouds, out-of-focus tree branches, and a tit that flies across now and then —
ported from the hero on
[anthropic.com/claude-fable-and-mythos-5-1](https://www.anthropic.com/claude-fable-and-mythos-5-1).
The dock tray (and the phone-sized folder grid) are rendered as refracting
glass on top of it. Both are drawn on a single full-screen WebGL2 canvas; the
glass lens is adapted from the one on
[setup.lost.plus](https://github.com/LPFchan/setup/blob/main/index.html), and
the scene itself is three.js plus custom GLSL, vendored into `src/hero/`.

The scene rides the sun over Seoul (KST), not the visitor's clock: a NOAA
solar-position fix gives the sun's elevation and azimuth, and the palette
mixes continuously between four looks — day, morning, dusk, night — instead
of snapping between the original's three swatches. When the scene is in its
dark phase it also flips the page to dark mode (and the dock glass to its
dark tint), taking over from `prefers-color-scheme`, which only guesses the
first paint. Almost everything is procedural: the sky dome, the moon, the
cloud decks, and the tree/leaf generator are pure shader and geometry; the
only bitmap assets are the bird's GLB and its feather/bark textures in
`public/fx/hero/`. A post pipeline adds the separable bokeh depth of field,
ACES tone mapping, vignette and grain.

They have to be one canvas and one draw, or the glass would be bending a
backdrop one frame stale. Each frame:

1. the scene, composited into one offscreen texture by the hero
2. that texture again over just the panel's rect, into a mipmapped buffer
   (one `generateMipmap` builds the whole frost ladder)
3. the optics, back over the panel's rect

The hero renders into its own render target and the mesh pass samples that
texture, so both draws read the same frame by construction and there is no
per-frame texture upload.

The panel elements in the DOM keep only a tint and a lit rim (`.glass-panel`
in `src/index.css`); the bending happens on the canvas underneath them. Dock
icons therefore sit *on* the glass rather than being refracted by it — they
were never in the texture.

Notes:

- The original's cloud shader parts the deck around the page's hero words
  (screen-space DOM rects fed in as 'shelters'). This backdrop has no hero
  text, so that feature is disabled; with no rects fed in it would otherwise
  carve a hard rectangle into the clouds. The wind, pointer parallax, bird
  behaviour and depth of field are all kept.
- `Dock` hands `Backdrop` both candidate panels; the one the 480px breakpoint
  hides measures zero, so the breakpoint stays in the stylesheet only.
- On narrow windows the whole dock is CSS-scaled. The shader solves the optics
  on the undeformed panel and pushes the result back out, so the rim doesn't
  thin as the window narrows.
- No WebGL2 (blocklisted GPU, VM, acceleration off): the canvas stays hidden
  and a CSS radial-gradient approximation on `body` plus the plain
  `backdrop-filter` panel is the whole effect.
- `prefers-reduced-motion` parks the drift; the refraction still runs.
- Two frame-rate escapes: the hero renders at an internal resolution scaled by
  `?quality=` (default 1; 0.6-0.8 is a good weak-GPU setting), and when the
  pointer has been idle for four seconds the whole canvas drops to 30fps - the
  only motion left at that point is wind, clouds and the sun's crawl, none of
  which need 60. A pointer move returns to full rate within a frame.
- The lens strength is tunable live with `?lens=bleed,thick,disp,ior,lod,tint`
  (all px in the undeformed panel, `tint` the CSS whiteness over the glass).
  The defaults pull 140px of scene into the rim and frost the panel interior
  by sampling a deeper mip away from the bend.
- three.js is code-split (`import('./hero')`) so it streams in after first
  paint; until it (and then the bird's GLB) is ready the canvas shows a flat
  field in the same palette family.
- Don't hand-write `-webkit-` prefixes in `index.css`. lightningcss collapses
  a prefixed/unprefixed pair down to the prefixed one and drops the standard
  property; it adds the prefixes correctly on its own.

## PWA

The site is installable as a PWA (standalone window, offline-capable) via
`vite-plugin-pwa`:

- `vite.config.ts` holds the web app manifest and the workbox config
  (precache the whole build, `navigateFallback: index.html`).
- Service worker is registered in `src/main.tsx` with
  `registerSW({ immediate: true })` and `registerType: 'autoUpdate'`, so
  returning visitors pick up new deploys automatically.
- Icons live in `public/` (not `src/assets/`, so they keep stable
  un-hashed URLs): `pwa-192x192.png` / `pwa-512x512.png` (standard),
  `maskable-*.png` (icon scaled to 80% on a `#f6f5f2` canvas, inside the
  Android safe zone), and `apple-touch-icon.png` (180px, opaque).

## Icons

Drop a **raw rectangular image** (png/jpg/svg) into `src/assets/raw/` and add an
entry in `src/App.tsx`. Every dock icon goes through a single CSS pipeline
(`.macos-icon` in `src/index.css`) that owns the macOS geometry from
[sundegan/macos-icon-generator](https://github.com/sundegan/macos-icon-generator):

- content is 13/16 of the canvas (`padding: 9.375%`, symmetric on all sides)
- corner radius is 22% of the content (`border-radius: 22%`)
- soft drop shadow via `filter: drop-shadow(...)`

Geometry is never per-icon. Each entry only picks a **treatment** for its
content inside the standard canvas:

| treatment    | use for | what happens |
| ------------ | ------- | ------------ |
| `cover` (default) | raw rectangular artwork | cover-fit, center-cropped, rounded |
| `preshaped`  | artwork that is already a finished macOS icon | passed through, scaled by 16/13 to undo its baked-in canvas inset |
| `tile`       | a glyph (e.g. the github octocat) | placed on a colored rounded tile; tile fills the standard content box, glyph scale is derived |

Because sizing lives in exactly one place, it is impossible for one icon to
come out bigger or smaller than another.

## Develop

```sh
npm install
npm run dev
npm run build   # outputs static site to dist/
```

## Deploy

Hosted on oci-ubuntu as static files served by `caddy` (file_server on
127.0.0.1:8400, root `/var/www/lost.plus`), fronted by the host-level
`cloudflared` tunnel (hostname `lost.plus` -> `http://localhost:8400`).
Deploy = `npm run build` + rsync `dist/` to `/var/www/lost.plus/`.

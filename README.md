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

The background is a slowly drifting mesh gradient — monochrome, warm, five
soft blobs that differ only in how light they are — and the dock tray (and the
phone-sized folder grid) are rendered as refracting glass on top of it. Both
are drawn by `src/Backdrop.tsx` on a single full-screen WebGL2 canvas, adapted
from the lens on [setup.lost.plus](https://github.com/LPFchan/setup/blob/main/index.html).

They have to be one canvas and one draw, or the glass would be bending a
backdrop one frame stale. Each frame:

1. the gradient, over the whole viewport
2. the gradient again over just the panel's rect, into a mipmapped buffer
   (one `generateMipmap` builds the whole frost ladder)
3. the optics, back over the panel's rect

Because the gradient is drawn by the shader rather than sampled from an image
or a video, both draws are the same field by construction, and there is no
per-frame texture upload at all — which is the expensive, fragile part of the
setup page that this version doesn't need.

The panel elements in the DOM keep only a tint and a lit rim (`.glass-panel`
in `src/index.css`); the bending happens on the canvas underneath them. Dock
icons therefore sit *on* the glass rather than being refracted by it — they
were never in the texture.

Notes:

- The gradient's two dials are how far each blob travels against how wide it
  is, and monochrome forces them apart: with no hue to carry the drift, wide
  blobs just overlap into a constant average and the field sits still. Each
  blob is tighter than its swing is long so it sweeps *past* a point rather
  than hovering over it. Tuned so the worst change over any ten seconds is a
  few levels out of 255 — never visibly animating, clearly somewhere else a
  minute later.
- `Dock` hands `Backdrop` both candidate panels; the one the 480px breakpoint
  hides measures zero, so the breakpoint stays in the stylesheet only.
- On narrow windows the whole dock is CSS-scaled. The shader solves the optics
  on the undeformed panel and pushes the result back out, so the rim doesn't
  thin as the window narrows.
- No WebGL2 (blocklisted GPU, VM, acceleration off): the canvas stays hidden
  and a CSS radial-gradient approximation on `body` plus the plain
  `backdrop-filter` panel is the whole effect.
- `prefers-reduced-motion` parks the drift; the refraction still runs.
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

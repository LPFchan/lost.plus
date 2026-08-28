# lost.plus

A static launcher for the web services I host, styled as a macOS dock
(magnify on hover, spring physics, bounce on click). Built with Vite + React +
Tailwind v4 + framer-motion; the dock interaction is the
[buildui magnified-dock recipe](https://buildui.com/recipes/magnified-dock)
used verbatim.

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


# lost.plus

A static launcher for the web services I host, styled as a macOS dock
(magnify on hover, spring physics, bounce on click). Built with Vite + React +
Tailwind v4 + framer-motion; the dock interaction is the
[buildui magnified-dock recipe](https://buildui.com/recipes/magnified-dock)
used verbatim.

## Icons

Drop a **raw rectangular image** (png/jpg/svg) into `src/assets/raw/` and
import it in `src/App.tsx`. The macOS treatment is baked into the site's CSS
(`.macos-icon` in `src/index.css`), using the geometry from
[sundegan/macos-icon-generator](https://github.com/sundegan/macos-icon-generator):

- content is 13/16 of the canvas (`padding: 9.375%`, symmetric on all sides)
- corner radius is 22% of the content (`border-radius: 22%`)
- soft drop shadow via `filter: drop-shadow(...)`
- non-square sources are cover-fit and center-cropped (`object-fit: cover`)

No preprocessing step is needed — the CSS pipeline does everything.

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


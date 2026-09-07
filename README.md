# Dice Wars — GitHub Pages

[Play Dice Wars](https://evgenyt1.github.io/dice-wars-pages/)

Native web port of the original Dice Wars, with original vector artwork and
sounds. This separate static publication starts from
[`evgenyt1/dice` at `5d56404`](https://github.com/evgenyt1/dice/commit/5d56404).
The original Sites project remains independently maintained.

## Development

Use Node.js 22.13 or newer and the committed npm lockfile:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

The Vite build outputs a static `dist/` folder. GitHub Actions validates and
publishes it automatically on pushes to `main`; built files are not committed.
The Pages base path is `/dice-wars-pages/`. Artwork and sound URLs are relative
to the document so they resolve within that path.

## Fidelity and attribution

Original Dice Wars artwork and audio are by GAMEDESIGN. The original SWF is not
included or executed. The engine, frame controller and extracted asset bytes
are retained from the upstream native restoration; the changes here are the
static entry point, hosting configuration and asset URL prefix.

All 47 upstream tests are retained, covering player counts 2–8 and exact asset
hashes. Final 1:1 certification still requires the comparisons listed in
[the implementation evidence](docs/flash-reference/IMPLEMENTATION.md). The
reference documents preserve the upstream checkpoint and its Sites deployment
history; this README describes the separate GitHub Pages publication.

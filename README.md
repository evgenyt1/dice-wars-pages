# Dicefront — GitHub Pages

[Play Dicefront](https://evgenyt1.github.io/dice-wars-pages/)

A dice strategy game: a native web port of the classic Dice Wars rules with a
full-screen board, two visual themes and tactile sounds. It installs to the home
screen, resumes a game where you left it, and plays offline after the first
online visit.

This repository is a publication mirror of the private `evgenyt1/dice`
repository. Application sources are copied from there by
`scripts/publish-pages.mjs`; each publish commit names the source revision.
Only `README.md`, `AGENTS.md` and `.github/` belong to this repository.

## Development

Use Node.js 22.13 or newer and the committed npm lockfile:

```sh
npm ci
npm test
npx tsc --noEmit
npx oxlint app pwa gh-pages
npm run build:pages
npm run preview:pages
```

`npm run build:pages` writes the static site to `dist-pages/` with the
`/dice-wars-pages/` base path (override with `PAGES_BASE`). GitHub Actions runs
the same checks and deploys on pushes to `main`; built files are not committed.

Game rules, fidelity evidence and design decisions are documented in `docs/`.
The original SWF is not included or executed. Final 1:1 fidelity certification
still requires the comparisons listed in
[the implementation evidence](docs/flash-reference/IMPLEMENTATION.md).

# Dicefront Pages instructions

This repository publishes Dicefront to GitHub Pages at
`https://evgenyt1.github.io/dice-wars-pages/`.

- It mirrors `evgenyt1/dice`. Make application changes there, then run
  `node scripts/publish-pages.mjs` from that repository and push this one.
  Direct edits to mirrored files here are overwritten by the next publish.
- This repository owns only `README.md`, `AGENTS.md` and `.github/`.
- The static build is `npm run build:pages` (`vite.pages.config.ts`, entry in
  `gh-pages/`). Keep public file URLs compatible with the `/dice-wars-pages/`
  base path and the service worker's registration scope.
- `.github/workflows/pages.yml` runs tests, TypeScript, authored lint and the
  static build, then deploys `dist-pages/`.
- Push normally to `evgenyt1/dice-wars-pages`. Never force-push, commit secrets,
  build output, dependencies or temporary decompiler exports.
- Do not claim final 1:1 fidelity while the documented comparison gaps remain.

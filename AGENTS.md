# Dice Wars Pages instructions

This repository publishes the native Dice Wars restoration to GitHub Pages.

- Read `docs/FLASH_PORT_REFERENCE.md`, `docs/FLASH_FIDELITY_PLAN.md` and
  `docs/flash-reference/README.md` before changing gameplay, timing or artwork.
- Preserve original vectors, glyphs, sounds, deterministic engine rules and
  historical quirks. Do not replace the native implementation with a SWF player.
- Keep the complete 800×600 stage proportional on all screen sizes, retaining
  keyboard input, accessible names, live announcements and sound controls.
- Keep model tools synchronous with UI legality and phase transitions.
- This is a static Vite/React application. Keep asset URLs compatible with the
  `/dice-wars-pages/` base path. No server or Sites identity is needed here.
- Before pushing, run `npm test`, `npm run build`, `npx tsc --noEmit`, and
  `npx oxlint app`. Inspect relevant interactions at desktop/mobile widths.
- Push normally to `evgenyt1/dice-wars-pages`. Never force-push, commit secrets,
  build output, dependencies or temporary decompiler exports.
- `.github/workflows/pages.yml` validates and publishes `main` to GitHub Pages.
- Do not claim final 1:1 fidelity while the documented comparison gaps remain.

# Dicefront / Midnight presentation

## User decisions (7 September 2026)

- Approved the Midnight shell, typography, screens, and confirmation design.
- Approved the Tactile sound bank after direct comparison with original and Glass.
- Requested presentation animation throughout the interface. Game rules, RNG,
  bot behavior, combat, reinforcement, and result timing must remain unchanged.
- Requested End Turn return to the original lower-right board position with a
  moderate increase in width. Rejected the 240px desktop/full-width mobile row.
- Rejected muted player colors, then the brighter same-hue dice/field pairing.
  Dice require stronger contrast against their territories.
- **Earlier approval:** sample 1, Classic contrast, using both hue and brightness.
  This supersedes palette B. Palette: Blue #487ae8, Orange #ff902c, Pink #f5a5d3,
  Forest #126c43, Violet #8c50d7, Ice #b7f3ee, Yellow #f7e33d, Crimson #c62f46.
  Blue is the human color; owner IDs and all underlying gameplay stay unchanged.
- **Earlier dice approval:** Larger bold resin, superseding Bold resin after the
  user's correction. Tinted faces, deep side shading, dark top pips and a compact
  grounding shadow match the approved third sample. Board stacks are 18% larger,
  anchored at their original base (22.75, 28.75) within the registered scale.
  Battle, reserve and title dice share the material at their existing layout sizes.
- Approved the name **Dicefront** and requested a new logo. A blue cube with
  a tinted resin face and an F on its side is used for the logo, loader and favicon;
  the title wordmark reads DICE / FRONT. The theme uses soft blue and ivory accents.
- Another map and Start game have equal-width columns in the preview action row.
  Another map includes a shuffle icon; End Turn keeps its approved position/width.
- Requested very faint contours within territories and smaller gaps between
  them. Shared interior hex edges use a 0.55-unit stroke at 10% opacity,
  clipped to the original territory paths. Normal territory borders are 1.6
  units instead of 4; selected borders are 2.5. No cells or adjacency change.
- Requested responsive phone/browser presentation, including live resizing and
  orientation changes, in preparation for a later Capacitor wrapper. A generated
  map must remain fixed while its display rectangle and controls change layout.
- Rejected the large player HUD/side column and requested much smaller indicators
  with no visible numbers. Players now use a compact row of header color dots;
  the human marker and active-turn outline remain.
- Clarified that generation itself must be responsive: preview grid dimensions
  follow the available rectangle and become fixed only when Start game confirms
  the map. This supersedes the initial fixed-32×28 responsive implementation.
- Requested a native-looking, full-viewport game without an outer border. Title,
  loading and gameplay now share one edge-to-edge surface, with no card frame,
  rounded outer corners, shadow, fixed width cap or gameplay height cap. Only
  device safe-area insets remain around the surface's content. Browser theme
  color matches the game background; title artwork retains a readable content
  width inside the full-screen surface.

- **Current colors and dice:** The user subsequently requested original gameplay
  colors and original dice again, with a dark theme and icon-only Home/Sound.
  The active palette now uses the exact eight Flash colors in engine order;
  human owner 0 is Violet. Board, battle, reserve and title dice use the preserved
  original S124/S43 vector symbols, including their original fills and paths.
  Selected source/target return to black fill and red outlines. The dark shell
  and branding use violet accents. Home and Sound retain accessible names, sound
  state, keyboard handling and 44px touch targets without visible text.
  The prior 18% stack enlargement, thin borders, faint hex contours and Tactile
  sounds remain; this request restores artwork/colors without changing rules.

## Implementation boundaries

This is an intentional presentation departure from the historical Flash
reference. Original vector paths, registrations, sound assets, and research
metadata remain preserved. The engine and controller are unchanged. New CSS
animations consume no game RNG and introduce no controller waits; reduced
motion disables decorative motion. The leave-game confirmation gates manual UI
and model actions synchronously, while automatic game timing continues.

The Tactile clips are separate, deterministic synthesis, reproduced by
`scripts/generate-tactile-audio.py`; original WAV/MP3 assets are untouched.
The playback gain is 0.65, matching the approved audition. Fonts are local with
SIL Open Font License files. The previous, now inactive resin bank recolored original vector geometry through
`scripts/export-midnight-art.py`.

The archived resin recipe blends each owner's color toward #f3ecd7 at 82% for the face,
#c2d3ca at 44% for the left side, #193947 at 72% for the right side, and #344d5b
at 88% for the top pips. Trim, side pips and the 24%-opacity ground shadow follow
the approved sample. Rounding matches JavaScript's preview calculations. A
separate SVG wrapper applies the 1.18 scale so settle/selection animations keep
the approved size and base position. Dice asset URLs are versioned together
across board, faces and preloading to avoid a stale palette after deployment.

## Previous Midnight verification

All 54 automated tests pass, including full 2–8-player campaigns, exact battle
counters/RNG, preserved original assets, Tactile hashes, audio gain, and
synchronous confirmation gates, displayed player identities and interior-only
hex contours. TypeScript, authored-app lint and the production build pass.
Browser checks cover desktop 1280×900, phone 390×844 and landscape 844×390,
title/preview, all eight colors, selection/cancel, dialog focus and Escape,
duplicate model attacks, and a complete human battle/supply/AI/human cycle.
CSS reduced-motion handling disables decorative animations and transitions;
the existing reduced-motion roll rendering does not change the controller.
All eight active WAVs match the approved audition byte for byte. Browser
warning/error logs are empty. Historical Flash runtime comparison gates remain
documented in the fidelity plan and are not claimed complete here.

## Larger bold resin verification (7 September 2026)

- Production build, TypeScript, authored-app lint, all 54 tests and diff whitespace
  checks pass. The engine, controller, game timing and audio payloads are unchanged.
- An independent comparison against the approved preview's material function
  verifies all 112 sprites / 1,728 vector elements: exact colors, original paths,
  registrations and resolved references. Original vector/audio preservation tests
  also pass. CSS still disables decorative motion for reduced-motion users.
- Browser checks at 1280×900, 390×844, 360×780, 320×700 and 844×390 confirm
  all eight palette colors, no horizontal overflow, larger stacks inside the stage
  (including eight dice), equal preview button widths and both icons. Title,
  board, battle and reserve artwork render correctly.
- Keyboard map reroll/start, territory selection/cancel/attack, dialog focus and
  Escape, plus a full human battle/reinforcement/AI/human cycle pass. The browser
  reports no warnings or errors. These checks used a separate disposable game.
- Historical Flash runtime comparison gates remain open as recorded above;
  this release is the user's approved presentation, not a new fidelity claim.

## Responsive board (7 September 2026)

- Generation retains 896 candidate cells (including empty space), up to 31
  territories, and the original growth/owner/dice rules. Preview dimensions
  choose 12–64 columns for the available map rectangle, with enough rows to hold
  the fixed cell budget; unused positions at the end of a partial final row are
  outside the board. This is the user's requested geometry extension, not a
  claim that adaptive maps appeared in Flash. Default 32×28 maps remain exact
  against the original deterministic fixtures, including RNG draw counts.
- ResizeObserver measures the actual preview rectangle. Changes to the chosen
  column count regenerate only an unconfirmed preview on the next build tick;
  changes arriving before that tick coalesce into the latest shape. Acceptance
  locks the exact displayed map and rejects stale acceptance during rebuilding.
  The model-tool preview bypass also uses the current preferred grid shape.
- The map has a separate SVG viewport with proportional `xMidYMid meet` fitting.
  Its bounds depend only on fixed cells and stack registrations; the full S124
  canvas, approved 1.18 display scale, focus, selection and animation margins are
  reserved at every stack. Once confirmed, ownership, dice, phases and resize
  cannot move those bounds. Resize callbacks only update the next preview's
  preferred dimensions; they cannot regenerate a campaign or consume its RNG.
- CSS allocates the available rectangle using dynamic viewport height. Touch
  controls retain at least 44px height, End Turn stays below the map on the right,
  and phone landscape moves preview actions into a side column. During play,
  color indicators occupy a 22px row in the header with no visible counts or HUD
  side column. On narrow portrait screens this row wraps below the header buttons.
  Battle and reserve dice have their own fixed-height tray. Original transforms,
  reveal ordering, triggers, RNG and scheduling remain intact.
- `viewport-fit=cover` and four safe-area insets accommodate browser/WebView
  notches and home indicators. Zoom remains enabled. This is web layout work;
  no Capacitor wrapper, native orientation lock or lifecycle persistence is added.
- Validation: production build, TypeScript, authored-app lint and 67 automated
  tests pass. New regression tests cover 70 generated maps plus edge-cell stack
  envelopes, camera invariance under ownership/dice changes, and a complete
  human battle/supply/AI/human cycle with identical state and RNG under repeated
  layout reads. Browser checks cover 1280×900, 390×844, 390×620, 360×640,
  320×700, 844×390 and 568×320: full map containment, no page overflow, touch
  control sizes, identical accepted map paths through live rotation, and selected
  territory/keyboard focus preservation. Dialog open/rotation/Escape recovery,
  keyboard attack and reinforcement remain functional.
- Adaptive-generation regression tests check shared hex edges and row boundaries
  for every supported column count, 70 maps with full stack envelopes, and 42
  complete numeric campaigns/replays across 2–8 players and six tall/wide shapes.
  They also check resize coalescing, acceptance locking, and repeated resize
  callbacks during a human battle/supply/AI/human cycle with identical RNG/timing.
- Browser generation checks at 390×844 and 844×390 produced 19-column and
  40-column previews respectively. Rotating after acceptance preserved the
  exact 19-column grid, viewBox and territory paths. A 320×700 resize, battle,
  duplicate-attack rejection and reinforcement also preserved that geometry;
  no browser warnings or errors were reported.
- Reduced-motion CSS and the controller's reduced-motion roll rendering are
  retained. Physical iOS/Android browser and Capacitor acceptance still need
  device testing; the historical Flash runtime comparison gates remain open.

## Original artwork / full-screen verification (7 September 2026)

- All 68 automated tests, TypeScript, authored-app lint, production build and
  diff whitespace checks pass. The active bank contains all 64 original stacks
  and 48 original faces; preserved original vector/audio payload checks pass.
- Local browser checks at 1440×1000, 390×844, 844×390 and 320×700 verify original
  palette/artwork, full-viewport surfaces with zero outer border/radius/shadow,
  no page overflow, and 44×44 icon controls without visible text. Title artwork,
  board stacks, battle faces, compact HUD and reserve rendering are retained.
- Preview changes from 35×26 to 19×48 with portrait resizing. After acceptance,
  rotating to landscape and narrowing the phone preserves every territory path.
  A human attack, reinforcement, AI turns and return to the human also preserve
  the same geometry. Keyboard start/selection, Home confirmation and Escape,
  and sound toggling pass; the browser reports no warnings or errors.
- Reduced-motion rules and audio scheduling remain unchanged. Original artwork
  restoration does not close the historical Flash runtime comparison gates.


## Selectable themes (7 September 2026)

- The header now includes a 44px icon switch beside Home and Sound. Off selects
  Original (the default); on selects Midnight with the earlier Classic contrast
  palette, blue human player and Larger bold resin artwork. Both retain the
  borderless dark layout, touch controls and responsive map fitting. The selection
  persists in local storage when available; unavailable storage does not prevent
  switching. Browser chrome color, branding, dialogs, HUD, territory labels,
  board/battle/reserve/title dice and model-tool player names follow the theme.
- Theme state is separate from the game controller and has its own subscription.
  Switching updates no campaign state, consumes no RNG and restarts no timers.
  Both preserved artwork banks preload; sounds remain the approved Tactile bank.
  Another map now uses a circular reload arrow instead of shuffle arrows.
- All 70 automated tests, TypeScript, authored-app lint, production build and
  whitespace checks pass. New checks resolve every sprite in both themes and
  compare repeated switches during selection, battles, reinforcement and AI
  against an unchanged deterministic game, including legal model actions.
- Local browser checks at 1280×900, 320×700 and 844×390 confirm the two themes,
  keyboard toggle and reload, saved preference after reload, icon touch targets,
  no overflow, and unchanged preview/confirmed territories and legal moves after
  switching. A live attack resolves normally across a theme switch. Browser
  warning/error logs are empty. Reduced-motion handling remains intact.

## Mobile audio, viewport lock and Dicefront branding (7 September 2026)

- The user reported no sound on iOS 27 with silent mode off. Audio now retries
  unlock on touch-end and click, handles rejected resume requests, and resumes
  both suspended and interrupted contexts after visibility/pageshow recovery.
  Playback-session support is feature-detected; unsupported/rejected sessions
  fall back to ordinary Web Audio. Hidden-page cues are cleared, and recovery
  does not replay them. Enabling Sound plays the existing button cue as feedback.
  Tactile payloads, gain, battle/supply scheduling and game RNG are unchanged.
- Relevant platform evidence: [WebKit audio session guidance](https://bugs.webkit.org/show_bug.cgi?id=237322)
  and [interrupted context states](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
  The silent-mode behavior alone does not explain the user's report; physical
  iPhone playback remains an acceptance check, not something proven by mocks.
- The document/body and game surface are locked to the viewport with hidden
  overflow and disabled overscroll. Touch panning is suppressed on the game
  surface while pinch zoom remains available. Safe-area insets and fixed-map
  fitting remain. Compact title layouts fit short portrait/landscape phones;
  dialog overflow is contained without chaining to the page.
- Removed visible GAMEDESIGN credits and website links from the title/history,
  and removed the unused historical title component's external navigation.
  Visible branding and metadata use Dicefront. Original research/assets remain
  preserved as source evidence. The hosted project's display title is Dicefront.
- All 73 automated tests, TypeScript, authored-app lint, production build and
  whitespace checks pass. New audio tests cover denied initial activation,
  touch-end retry, interrupted recovery, no duplicate/stale cues, playback-session
  selection and unsupported APIs. Browser checks at 320×568, 568×320, 390×844 and
  1280×900 verify visible controls, zero page scrolling after scroll input,
  unchanged confirmed territory paths across rotation, no external links,
  keyboard dialog dismissal and sound toggle state. Browser error logs are empty.

## Safari refill rendering (7 September 2026)

- The user reported dice blinking during refill in Safari while Chrome looked
  correct. The previous count/owner key unmounted the entire external SVG sprite
  at every refill to restart a CSS transform animation on a filtered group.
- DiceStack now keeps its group and `use` instance mounted. Count/owner changes
  restart only a native SVG translate animation (160ms; -4, +1, 0 vertical units).
  Reduced motion omits the animation element; no game clock, timers, sound cues,
  RNG, territory geometry, asset paths or registered stack scale change.
- Shadows use a separate native SVG filter with fixed user-space bounds covering
  the complete stack canvas plus motion and blur margins. This removes animated
  CSS-filter compositing and changing filter bounds from reinforcement updates.
- Direct local macOS Safari checks cover Original and Midnight reinforcement,
  visible stacks during supply, an AI cycle, and return to the human turn.
  A Chromium phone check at 390×844 confirms all 31 stack sprites remain rendered,
  no scrolling/clipping, and no browser warning/error logs. Physical iPhone
  acceptance remains separate from the desktop Safari check.
- All 73 existing automated tests, TypeScript, authored-app lint, production
  build and whitespace checks pass. Historical fidelity gates remain unchanged.

### Safari refill follow-up: resident vector paths

- The user still observed flickering after the first fix. Fetch preloading warmed
  the SVG files but did not retain their rendered external `use` instances; each
  frame still changed an external fragment reference. This is a suspected repaint
  path, not a confirmed network-cache failure on the user's device.
- Dice now render as direct, persistent SVG paths from a compiled resident bank.
  `scripts/compile-dice-art.py` resolves all 224 Original/Midnight stack and face
  display lists, preserving exact path strings, fills, opacity, use transforms,
  registration and draw order. Its check mode rejects stale output or unsupported
  SVG semantics. Both banks are present before gameplay; updates need no external
  image reference, decode or fetch. Redundant SVG preload requests are removed.
- Removed the additional live stack shadow filter to avoid filtering animated
  artwork. The source artwork's own shadow paths remain unchanged. Native 160ms
  settle motion, reduced-motion behavior, 1.18 display scale, map geometry,
  controller scheduling, sound cues and RNG remain unchanged.
- Validation: all 74 tests, TypeScript, authored-app lint and build pass. The new
  source comparison checks every resident frame. Local browser checks cover
  Original and Midnight, 390×844 and 1280×800, keyboard theme switching during
  AI play, reinforcement and return to the human. All stacks retain direct paths,
  no external dice references or live stack filters remain, and browser error
  logs are empty. Physical iPhone Safari confirmation remains open.
- The resident bank is about 92 KB gzip (1.06 MB uncompressed); the build emits
  a large-client-chunk advisory. It replaces the two previously fetched SVG banks.
  Preserved source assets and the historical fidelity acceptance gates remain.

### Attack animation follow-up

- The user clarified that flickering also occurs during attacks. BattleStrip
  still keyed each rolling die by its face to restart a CSS animation, replacing
  the entire subtree on face changes even after resident paths were introduced.
- RollingDie now retains its subtree and restarts native SVG rotate/scale motion
  through refs. It preserves the -6°/0.9 to 0°/1 settle, 80ms human and 40ms AI
  durations, source registration and ease-out curve. Reduced motion omits both
  animation elements. The controller's intentional random face changes, reveal
  sequence, totals, battle resolution, sounds and RNG are unchanged.
- Build, TypeScript, authored-app lint, whitespace checks and all 74 tests pass.
  Local keyboard attacks in Midnight at 390×844 and Original at 1280×800 show
  direct paths with native motion, no external dice references and no CSS roll
  animation. Physical iPhone Safari verification remains open.

## Home-screen identity and icon choices

- Removed the visible copyright line entirely from title and history, as requested.
  The obsolete shared component is removed. Historical research and bundled font
  license documents remain intact.
- Document title, application name, Apple home-screen title, web-app manifest
  name and short name are exactly Dicefront. The manifest requests standalone
  display without orientation locking. Added opaque 180px Apple touch, 192px and
  512px web-app icons, plus a 32px PNG fallback alongside the SVG favicon.
- Four vector icon options and previews are in `docs/icon-options/`, awaiting
  the user's choice. The installation assets currently retain the existing cube;
  selection will replace all favicon/home-screen variants together.
- Verified rendered title and Apple title metadata, icon/manifest links, PNG
  dimensions and opaque backgrounds. Title layouts at phone and desktop sizes
  have no copyright text. Build, TypeScript and authored-app lint pass. Actual
  phone installation and the final selected icon remain acceptance steps.

### Selected icon: Duel

- The user chose option 2, the overlapping violet and lime dice. It now supplies
  the SVG/PNG favicon, Apple touch icon and web-app manifest icons. A separate
  maskable variant provides safe padding for circular/adaptive Android masks.
- All icon PNGs are opaque and verified at their declared sizes. Icon and
  manifest URLs are versioned `duel-1`. Home-screen and document naming remains
  exactly Dicefront; copyright text remains removed. No gameplay changes.

- Follow-up: Duel now also appears beside DICEFRONT and in the loader in both
  themes. Header/loader artwork and SVG/PNG favicons have a transparent canvas;
  opaque home-screen assets remain unchanged. Favicon URLs use
  `duel-transparent-2` to request the revised assets. The generated 32px PNG's
  corner alpha is zero; no white or dark background rectangle is present.

## Resume, background audio and offline play (14 September 2026)

- The user asked for a home-screen app that reopens where it left off, reported
  sound sometimes stopping after minimizing and restoring on iPhone, and asked
  for offline play.
- Resume: `app/game-session.ts` stores a validated controller session in
  localStorage (`dicefront-session`): screen, phase, frame, campaign state,
  selection, pending battle rolls, AI move, supply counters, player count, sound
  setting and the persistent map-priority permutation. Saves are coalesced to
  meaningful changes (at most one per second) and flushed on `visibilitychange`
  and `pagehide`. Loading completes before the saved screen is entered. A rolling
  battle replays its stored rolls, so reopening cannot reroll it; a history replay
  reopens on its finished result. Invalid, tampered or old-version data is
  discarded. Rules, RNG consumption, timing and cue triggers are unchanged.
- Audio: the previous recovery only called `resume()`. WebKit can leave a
  backgrounded context suspended, interrupted, or reporting "running" with a
  frozen clock, and only a user gesture may start a replacement. After a hide or
  interruption the next tap now keeps a context whose clock advances and
  otherwise closes it and creates a new one inside that gesture, reusing the
  decoded Tactile buffers. Payloads, gain and scheduling are unchanged.
- Offline: `pwa/vite-plugin.ts` emits `/sw.js` in the client build. It precaches
  the page shell, all bundle JS/CSS, Tactile sounds, fonts, logo, icons and
  manifest; its cache version hashes those contents, so each deployment replaces
  the old cache. Navigation is network-first with a four-second cached fallback;
  hashed assets are cache-first; other same-origin assets are cached on first
  use; RSC requests pass through. Registration is production-only.
- Validation: 85 automated tests (session round trips for every screen/phase,
  tampering, autosave; context replacement and frozen-clock detection; worker
  generation, install, activation cleanup, offline launch and assets),
  TypeScript, authored lint and build pass. Headless Chrome against the
  production build resumed a mid-selection game with an identical board after
  reload, then relaunched with the server stopped, resumed and resolved an attack.
  Long eight-player sessions serialize to about 80 KB. The in-app preview browser
  cannot register service workers. Physical iPhone checks of background audio and
  home-screen offline launch remain acceptance steps.

### GitHub Pages publication (14 September 2026)

- The user asked to publish to the existing `evgenyt1/dice-wars-pages` GitHub
  Pages repository, which still held the 7 September "Dice Wars" snapshot.
- Public file URLs now go through `assetUrl()` (Vite's base URL), the manifest
  uses relative paths, and the service worker resolves its precache list, shell
  and caches against its registration scope. The same code serves Sites at `/`
  and Pages at `/dice-wars-pages/`.
- `npm run build:pages` builds a static client from `gh-pages/index.html`
  (metadata equivalent to `app/layout.tsx`) with a plain `<img>` stand-in for
  `next/image`. The entry folder is not named `pages/`, because vinext then
  treats it as a Next.js Pages Router and fails server rendering.
- `scripts/publish-pages.mjs` mirrors committed sources into the Pages checkout,
  keeping its own README, instructions and workflow. The Pages workflow runs
  tests, TypeScript, authored lint and the static build before deploying.
- Validation: 87 tests, TypeScript, lint, both builds. Headless Chrome against
  both the Sites build (`/`) and the static build (`/dice-wars-pages/`) resumed
  a mid-selection game after reload, then relaunched with the server stopped,
  resumed and resolved an attack. The offline subpath render was inspected.

### HUD reinforcement numbers (14 September 2026)

- The user asked for a number in each player's colored HUD box so the dice each
  player receives at End Turn are visible. Reinforcement is the largest
  connected group (`startSupply`), not the total territory count, so each chip
  shows that value; this is also the number the original HUD displayed.
- The color swatch became a small chip with the number inside. Text is dark or
  white, whichever contrasts more; a test keeps every Original and Midnight
  player color at WCAG 4.5:1 or better. Tooltips and accessible names state the
  dice gained. Game rules, timing and layout order are unchanged.
- Headless Chrome at 390×844 (7 players), 320×640 (8), 844×390 landscape (8)
  and 1280×800 Midnight (6) shows one HUD row without overflow.

### Silent switch and first-tap audio session (14 September 2026)

- The user reported sounds sometimes missing even after closing and reopening
  the app. The game persists only the Sound on/off choice; the iPhone ring/silent
  switch also persists across launches. Safari's default audio session is
  ambient, which the silent switch mutes. The context is created during loading,
  before any tap, and WebKit applies the session category when a context starts,
  so switching to `playback` on the first tap did not reach that context.
- The tap that switches the page to the `playback` session now rebuilds the
  context inside the same gesture, reusing the decoded buffers. Opening the page
  still never interrupts other audio. A tap during loading defers closing the
  decoding context until the sounds are ready.
- `dicefrontAudio()` in Safari Web Inspector reports context state, clock,
  session type, unlock state and rebuild count for on-device diagnosis.
- Evidence: [MDN AudioSession type](https://developer.mozilla.org/docs/Web/API/AudioSession/type),
  [WebKit 263627](https://bugs.webkit.org/show_bug.cgi?id=263627) (running
  context with a frozen clock after foregrounding, still open). Physical iPhone
  confirmation with the silent switch on and off remains open.

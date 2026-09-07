# Native implementation checkpoint — 2026-09-07

This implements the findings from `e0a88ee`. It is a functioning native rewrite,
not another research-only checkpoint. **Final 1:1 certification remains open.**
The pinned original SWF is unchanged and never included in production.

## Published release

Sites version 2 deployed successfully on 2026-09-07 at
<https://dice-wars-classic.evgeny-tukin.chatgpt.site>, from
`aa7c54b2ce6dc8f2dfc003578cae32e84267d514`. The existing project, hosting identity
and owner-only access are retained. Production title/assets, map preview and
starting gameplay were checked; browser error logs were empty.

Implementation checkpoints `7ee597f` (engine), `d19c0fe` (original assets) and
`aa7c54b` (native screens/clock/audio/replay) were pushed normally to
`evgenyt1/dice` and to the configured Sites source repository. Before pushing,
all 47 tests, `npm run build`, `npx tsc --noEmit`, `npx oxlint app`, and
`git diff --check` passed. Full generated-scaffold lint was not part of this
release check. The subsequent documentation commit records publication only.

## Delivered implementation

- `app/game-engine.ts`: injectable LCG/random source, persistent map priorities,
  separate preview/acceptance, exact owner Modulo draws, center/cell-zero rule,
  bounded original contours, setup early break, original eight-player AI,
  delayed combat application, early human loss, per-die supply and event history.
  Connected groups merge either direction of an adjacency, as AS2 does.
- `app/game-controller.ts`: independent native state machine and one 24 fps
  clock. AI f27/f30/f33 selection, human/AI reveal waits, shared flicker RNG,
  individual supply, sampled result frames and automatic history. Campaign
  replacement clears phase work synchronously. There are no battle callbacks
  that can resurrect a previous campaign.
- `app/flash-art.tsx`, `app/flash-art.json`, and production vector assets:
  original registered SVG paths, static text, numeric glyph outlines and
  authored placements. 64 stacks and 48 roll faces retain their own artwork.
  Separate shape/stack layers, width-4 outlines, black/red selections and
  cpos-ordered fixed-scale stacks replace the old per-cell redesign.
- `app/game-client.tsx`, `app/globals.css`: complete 800×600 title, preview,
  human instructions, living-player HUD, battle strip, supply, results/history,
  global title route, and proportional fitting. The sound control stays outside
  the original stage. Keyboard Enter/Space and Escape, live announcements,
  touch and reduced-motion rendering share the same legality and outcomes.
- `app/game-audio.ts`: all eight sound identities and press/release triggers,
  original relative gain, overlapping buffer sources, mute without clock resets.
  Original MP3 payloads remain intact. Offline decoded PCM is limited to the
  SWF sample count, with no second SeekSamples trim.

## Evidence and tests

`npm test` runs 47 engine, controller, audio-unlock and asset tests without new dependencies.
Coverage includes all players 2–8; exact saved maps, outlines and reroll; six
original AI probes; strict dominance/rank boundaries; ties and early loss;
0/1/64 supplied dice; full-territory reserves; setup early break; one-way
adjacency; every legal human/AI dice pair; exact reveal and RNG counts; stale
clock callbacks, rapid attacks and repeated mute/replacement; 21 complete
numeric campaigns and seven complete native phase campaigns with event replay.

The current paired oracle is saved separately as `native-oracle-report.json`.
The original `oracle-report.json` remains the historical redesign comparison;
map fixtures were not changed to match the port. Assets and audio have their
own source/hash/registration manifests. Asset tests cover every SVG and all
48 faces/64 stacks; that is not a claim that every frame has a live visual golden.

Local browser checks include 800×600 stage, 1600×1200 enlargement, 390×844 phone
portrait and 844×390 landscape viewports; title/picker, preview, complete map
edges, keyboard select/cancel, battle strip, individual supply, and a complete
human/AI turn, a completed two-player browser game through Game Over, and
automatic history restoring the initial colors/dice with the HUD removed,
running to completion, and returning to the title with the player count retained.
Two simultaneous model attack calls produced one accepted roll
and one synchronous rejection. Reduced motion removes flicker/blink/movement
only in rendering; the same clock/RNG/outcomes continue. A physical device and
all-browser audio/reduced-motion acceptance pass remains outstanding.

## Runtime observations and decisions

The unmodified original was inspected in Ruffle's official 2026-09-06 web
nightly, served separately from `/tmp`. A research copy subsequently added only
frame-name/GetTime traces to S149/S169, using `trace-flash-timelines.py` and FFDec
`-xml2swf`. **This is secondary emulator evidence, not an Adobe recording.**
Player, original/copy hashes and a curated trace are in
`runtime-observations.json`. It confirms S149 f4 -> f2 and completion -> f11
in the same player tick. Native supply therefore uses a two-tick placement
cadence and the source's f11 -> f23 twelve-tick final pause.

Title composition/picker, map preview, source/cancel, AI selection, human battle
strip, supply and elimination/recentering were visually observed in that
reference. Static authored vectors are the authority for exact paths and
matrices. Screenshots of different random maps are not pixel comparison goldens.

History restores the saved initial state and treats the one-past-end event as
an empty final step, without a JS exception or invented territory. Until the
history runtime gate is closed, its f5/f7/f12/f14 battle and f15/f16 supply
cadence are explicitly source-derived native interpretations.

PCM uses FFDec 26.2.1's seek-adjusted WAV output, then crops to the declared
SoundSampleCount. This fixes the previous unbounded raw MP3 playback and missing
button sound while avoiding a second skip. It is a **provisional decoder choice**:
no Adobe audio capture establishes exact onset, decoder delay, waveform or
endpoint equivalence. No source was normalized, denoised or re-encoded to MP3.

## Still required for 1:1 sign-off

1. Adobe Flash Player captures with provenance for all specified screens and
   min/max battles, including exact parent/child entry offsets.
2. Original-player audio captures for all eight effects, overlap, press/cancel
   triggers and decoded onset/end comparison against browsers.
3. Live history restoration, same-frame re-entry and final empty-step comparison.
4. Paired visual goldens at 1×/2×/3×, all buttons/frames and physical mobile/DPR
   and browser acceptance, including reduced motion and audio unlock.

Do not replace these gates with passing builds or simulations. Verified source
quirks remain the default; no rule correction or alternate game variant was added.

# Route to a 1:1 native Dice Wars port

**Presentation update:** the user has approved the Dicefront/Midnight redesign
and Tactile audio; see [current design decisions](MIDNIGHT_DESIGN.md). The
restoration milestones below remain historical evidence. Continue preserving
verified gameplay and timing while using the approved current presentation.

The user's requested permanent implementation route. The research checkpoint is preserved; the native restoration is implemented and deployed. Final 1:1 comparison gates remain open. Read [the full specification](FLASH_PORT_REFERENCE.md) before work.

## 0. Research checkpoint — completed

- [x] Refresh/inspect origin/main, initially clean at `8d8ff36`.
- [x] Pin SWF identity and inspect header, all 66 scripts, bytecode, timeline
  placements, 106 vector shapes, fonts, eight buttons and eight sounds.
- [x] Confirm owner Modulo in independent FFDec/SWFTools dumps.
- [x] Verify AI rank anomaly, gate boundary, RNG consumption, dominant focus,
  and uniform candidate choice with six original-code probes.
- [x] Compare 70 maps across all player counts and preserve original fixtures.
- [x] Complete 21 original-AI simulations with bounded completion.
- [x] Hash-check all seven current sounds; preserve missing button sound 15.
- [x] Save vector atlas, machine manifest, reports, regeneration tools and limits.

## 1. Finish runtime evidence

- [ ] Capture the original in a reference player, preferably Adobe Flash Player;
  label emulator comparisons as secondary evidence. Never modify `dice.swf`.
- [ ] Capture all screens and interactions listed in the specification.
- [ ] Resolve supply/history timeline re-entry and child-entry offsets.
- [ ] Resolve history's missing references and extra final step.
- [ ] Record all eight sounds, press/release triggers, rapid reveals, overlap,
  result delays and initial human-turn silence.
- [ ] Verify sample-offset/count and decoder compensation against capture.

Acceptance: identify source/player/capture provenance. Never relabel static
FFDec renders as live captures. Production work may proceed on established facts,
but final 1:1 sign-off requires closing these runtime gates.

## 2. Deterministic engine

Files: `app/game-engine.ts`, durable engine tests. Inject RNG before changing
randomized behavior; keep core logic independent of React.

- [x] Separate persistent map generator, preview, and acceptance/start.
- [x] Preserve `num` across rerolls/campaigns, biased swaps and consumed draws.
- [x] Restore owner ID order, >0 center-neighbor rule, setup early break,
  original ordered outlines/limit; remove minimum-map retries.
- [x] Use original ascending source/target/eligible-territory traversal.
- [x] Restore full eight-player AI ranking, last qualifying dominant ID,
  equal-dice RNG despite bypass, and uniform selection; remove heuristics.
- [x] Separate roll preparation from outcome application; apply after animation.
- [x] Check human elimination before global victory.
- [x] Split supply into start, one-die placement, and turn advancement.
- [x] Store initial arrays and individual battle/supply history events.
- [x] Retain connected-group reinforcement, stock carry, dice/stock caps and
  elimination skipping.

Acceptance: exact fixture comparisons for cells, centers, owners, dice,
outlines and order; repeated-generation tests; every player count 2–8. Cover
ties, win/loss, early human elimination, disconnected holdings, full-board
reserves, strict 40% boundary, two >40% players, rapid/repeated turns and
complete games. Never alter goldens to hide incorrect behavior.

## 3. Original artwork and stage

Files: curated production vectors/glyphs, renderer, client, CSS.

- [x] Derive visuals from original shapes/glyphs; retain source IDs, frames,
  registration, transforms and hashes. No substitute artwork or PNG upscaler.
- [x] Restore title wordmark/outlines/starburst, independently randomized dice,
  attribution, Play/Top page and original picker.
- [x] Restore preview labels, button states and global title icon.
- [x] Render original area paths at `(26.25,68.5)` with width-4 `#222244` border.
- [x] Separate area and stack layers; use fixed S124 scale/registration and
  `cpos` stack depth order.
- [x] Restore source/target black/red paint; remove pulses/brightening.
- [x] Restore instructions, die illustration, End Turn and recentered living
  HUD; remove modern dashboard/round chrome from the stage.
- [x] Restore sampled loss fade/movement, win blink, different result actions
  and original history display.

Acceptance: original comparison at 800 × 600 first, then 2×/3× and device pixel
ratios. Inspect all 64 stacks/48 faces, title randomness, glyphs, button states,
every player count, selections and overlaps. Similar appearance is insufficient.

## 4. Clock, audio, replay

- [x] Use one controlled frame scheduler, 24 fps, with injectable test clock;
  document native phases against original labels.
- [x] Restore AI source/target delays and progressive right-attacker/left-defender
  reveals, flicker RNG, totals, wait counters and delayed mutation.
- [x] Supply at source/secondary-emulator timeline cadence; render stock as two rows of 32
  S43 face-2 dice; preserve final pause.
- [x] Preserve all eight payloads, add sound 15, restore press/release/silent
  controls and source sample counts with the documented FFDec PCM interpretation.
- [ ] Verify decoder compensation and exact audio onset/end against Adobe capture.
- [x] Preserve relative gain, trigger counts and result sound frame offsets;
  retain master mute. Sound toggles must not restart phase timers.
- [x] Replay original events automatically with highlights/result sounds and
  documented source-derived final-step behavior; do not invent progress/replay controls.
- [x] Invalidate every scheduled callback when replacing a campaign or screen.

Acceptance: fake-clock traces for human/AI battles across dice counts, reveal
sound counts, supply 0/1/64, results and replay. Real playback compared to
original capture. Repeated mute toggles and stale callbacks cannot alter timing
or revive a prior game.

## 5. Devices, accessibility, browser tools

- [x] Fit complete stage on desktop and both mobile orientations; remove 150%
  crop. If outer ratio changes, preserve internal geometry and complete controls.
- [x] Retain keyboard shape/stack activation, cancellation, focus, live
  announcements and touch input. Preserve original mouse/touch visual states.
- [x] Deliberately support/document reduced motion without changing outcomes.
- [x] Gate `get_game_state` actions to actually interactive phases; report
  pending/displayed state consistently.
- [x] Share selection/attack pipeline between UI and `attack_territory`; reject
  busy/re-entrant requests synchronously.
- [x] Document preview bypass as a tool-only convenience if retained;
  `start_new_game` must clear old timers/history/overlays.

Acceptance: local desktop/mobile visual and interaction inspection, complete
human/AI turn, keyboard/cancel, map-edge touch, reduced motion, audio unlock,
and rapid model-tool calls. Tools cannot mutate hidden or resolving state.

## 6. Verified release checkpoints

- [x] Inspect working tree and refreshed origin/main; preserve unrelated work.
- [x] Run durable engine/clock/interaction tests proportional to changes.
- [x] Run `npm run build`, `npx tsc --noEmit`, `npx oxlint app` before behavior
  pushes. Report unrelated generated scaffold lint separately.
- [x] Commit small meaningful checkpoints and push normally to `evgenyt1/dice`.
- [x] Keep `.openai/hosting.json`; update the existing Sites project after
  meaningful verified production changes, never create a replacement.
- [x] Report deployed revision, validation, fidelity decisions and remaining
  discrepancies at `https://dice-wars-classic.evgeny-tukin.chatgpt.site`.

The native restoration is a coherent playable release. Production code is
validated before publishing; open original-player comparison gates remain explicit.
Checked implementation items do not close their broader acceptance gates.

## Next-iteration instructions

Read the specification, then take the first unfinished bounded milestone.
Original code/assets and verified runtime evidence are the authority. Before
changing a historical quirk, record source, observed effect, decision and test.
When evidence is missing, label uncertainty and investigate instead of
substituting a familiar Dice Wars variant or a visual approximation.

## Implementation checkpoint — 2026-09-07

The deterministic engine now matches all 70 paired original-code maps with zero
differences in cells, owners, dice, centers, adjacency, turn order and RNG count.
Durable tests additionally compare exact outline fixtures and persistent rerolls,
exercise the six original AI probes, delayed combat, early human loss, stock caps,
and 21 complete numeric games across 2–8 players with exact event replay. These
remain numeric tests, not Flash runtime campaign recordings.

The original artwork, native controller, eight sound identities, history, device
fitting and browser tools are implemented. See
[implementation evidence and remaining gates](flash-reference/IMPLEMENTATION.md).
Supply f4 -> f2 same-tick re-entry is confirmed in a separately instrumented
Ruffle research copy. This is secondary evidence, and does not close milestone 1.
The next unfinished work is original-player paired capture, audio decoder/onset
comparison, history runtime comparison, and the full device/browser matrix.

Sites version 2 successfully published `aa7c54b2ce6dc8f2dfc003578cae32e84267d514`
on 2026-09-07, retaining the original project identity and owner-only access.
Production title loading, map preview and starting gameplay were verified with
no browser error logs. Release details are in the implementation evidence above.

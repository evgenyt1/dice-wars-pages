# Dice Wars: original Flash fidelity specification

**Current presentation:** the user subsequently approved Dicefront/Midnight,
Classic contrast colors, Larger bold resin dice and Tactile sounds.
See [design decisions](MIDNIGHT_DESIGN.md).
The visual/audio restoration instructions below document the historical baseline;
the verified rules, RNG, geometry and timing remain the gameplay contract.

Audited 2026-09-07 against the actual SWF and web commit `8d8ff36`.

**Target: a native 1:1 reproduction of this SWF, with original graphics enlarged
cleanly, original sounds, screens, rules, and pacing.** This supersedes the old
handoff's permission to retain a redesigned interface and simplified AI.
Responsive presentation and accessibility must not silently change the game.

The `e0a88ee` research checkpoint is preserved. Its findings have now been
implemented in the native port; see [implementation and verification status](flash-reference/IMPLEMENTATION.md)
and [the implementation route](FLASH_FIDELITY_PLAN.md). **Final 1:1 certification
remains open.** Mentions below of “current port” or “current differences” describe
the audited `8d8ff36` baseline, not the new implementation. Source contracts remain binding.

## Evidence and confidence

| Evidence | Location / identity |
| --- | --- |
| Original artifact | `../dice.swf`, outside this Git repository |
| SHA-256 | `0690936010c150a0f2592e838dbbb9deebaef24e448c89f8c60f2f6667dbb7d1` |
| Size | 100,394 compressed bytes; 196,609 declared/decompressed bytes |
| Header | CWS/zlib, SWF 7, 800 × 600, 24 fps, 15 root frames, white background |
| Tools used | SWFTools `swfdump`; FFDec 26.2.1; OpenJDK 21; Python; Node |
| Machine evidence | [manifest.json](flash-reference/manifest.json) |
| Original vector plates | [atlas.html](flash-reference/atlas.html) |
| Deterministic comparison | [oracle-report.json](flash-reference/oracle-report.json) |
| Original map fixtures | [map-fixtures.json](flash-reference/map-fixtures.json) |
| Regeneration | [flash-reference/README.md](flash-reference/README.md) |

Source shorthand used here:

- **G.method**: `scripts/__Packages/dw/Game.as`, decompiled from the pinned SWF.
- **T170/f21**: `scripts/DefineSprite_170/frame_21/DoAction.as`; likewise for
  other sprite/frame numbers. Frame numbers are one-based.
- **S124/f8**: sprite 124, authored frame 8, including display-list transforms.
- **B130**: button 130, including its states and sound tag.
- **M**: committed manifest, indexed by sprite ID/frame.

Verified directly: SWF structure, vectors, embedded fonts, placements, labels,
all 66 script exports, button states, eight sounds, and significant bytecode.
The owner-assignment `Modulo` was independently confirmed by FFDec P-code and
SWFTools. Raw exports remain outside Git; curated evidence here is permanent.

Numeric AS2 classes were mechanically translated into isolated JavaScript
contexts for repeatable experiments: 70 paired maps (players 2–8, seeds 1–10),
six original-AI probes, and 21 full AI simulations. All simulations completed;
the maximum was 208 completed turns in this sample.

**These are not recordings of Adobe Flash Player.** FFDec renders authored
display lists without running ActionScript. Atlas plates show placeholder
title digits/default dice and omit procedural maps, as labeled. The oracle
verifies a numeric-class subset, not AVM1 timeline, drawing, or audio semantics.
It omits animation RNG in full simulations and continues after human elimination
to exercise completion. Do not call these original campaign traces or runtime
golden screenshots. Open runtime questions are listed at the end of this file.

## Binding fidelity decisions

1. Preserve verified historical gameplay quirks by default. Do not silently
   improve randomization, AI ranking, setup breaks, or contour limits.
2. Extract original vectors/glyph outlines. The existing PNGs are rasterized
   exports, not the highest-quality source. Do not redraw or use AI upscaling.
3. Restore original labels, composition, controls, layers, colors, and pacing.
   Remove the redesigned dashboard, round label, explanatory cards, battle
   modal, floating title art, extra gradients, and target pulses from the
   classic stage.
4. Use 800 × 600 logical coordinates and fit the complete stage proportionally.
   Phone orientation/outer ratio may differ as the user allows, but never crop
   playable territories, distort dice, or independently rearrange classic
   map/battle/HUD layers. Letterboxing is the default adaptation.
5. Preserve keyboard access, touch, live announcements, reduced motion, sound
   control, and browser tools. They must share the same legal state machine.
   Optional convenience controls belong outside the classic stage, without
   replacing the original screens or becoming their default design.
6. Production remains native web code: no SWF player, emulator, or plugin.
   A reference player used solely for research is separate from production.

## Artwork, fonts, and scaling

The source has **106 vector shape definitions** (30 DefineShape, 3 DefineShape2,
73 DefineShape3), **zero embedded bitmap definitions**, 24 sprites (including
five empty class-registration sprites), eight buttons, 19 static texts, five
dynamic texts, and five embedded font subsets. Enlarge SVG directly, or
rasterize from vectors at device resolution. No bitmap upscaler is needed.
[FFDec's maintainers document SVG and zoomed PNG export](https://www.free-decompiler.com/flash/issues/1205-zoom-command-line-parameter-for-frame-export).

| Symbol | Original visual |
| --- | --- |
| Shape 13 | Pale territory outlines behind title |
| Shape 21 | Extruded DICEWARS wordmark |
| Shape 22; sprite 44 | Starburst and three independent title dice |
| Sprite 43 | Die faces, reused by title, battle, HUD and stock |
| Sprite 124 | Territory stacks, 64 active color/count combinations |
| Sprite 54 | Complete authored title composition |
| Sprite 134 | Map-building message and Yes/No controls |
| Sprite 141 | HUD, static frame 1 and active backing frame 2 |
| Shape 144 | Human die illustration within turn instructions |
| Sprite 154 / font 152 | GAMEOVER lettering |
| Sprite 162 / shape 161 | YOU WIN! drawing and original outline/shadow |
| B137 | Top-right icon, hover text “Back to Title” |
| B168 | History website link with over/down states |

Do not replace the logo with Impact, the buttons with modern cards, the active
HUD with generic chips, or result lettering with similar fonts. Original title
background lines, gradient buttons, starburst, win outlines and die shading
are artwork, not approximate design instructions.

Fonts: 9 = A-OTF 新ゴ Pro M (51 embedded glyphs), 17 = Monotone (52),
126 = A-OTF 新ゴ Pro L (10), 128 = Arial Black (17), 152 = Slicker (7).
Use outlines for static text. Dynamic digits must retain their original glyph
shapes, advances, sizes, alignment, field bounds, and transforms. Exported TTFs
are subsets, not complete system fonts. M records their codepoint tables.

### Colors and frames

| Player ID | Territory fill | First S43 / S124 frame |
| ---: | --- | ---: |
| 0 | `#b37ffe` | 1 |
| 1 | `#b3ff01` | 11 |
| 2 | `#009302` | 21 |
| 3 | `#ff7ffe` | 31 |
| 4 | `#ff7f01` | 41 |
| 5 | `#b3fffe` | 51 |
| 6 | `#ffff01` | 61 |
| 7 | `#ff5858` | 71 |

S43 face lookup: `1 + owner*10 + zeroBasedFace` (six faces). S124 stack lookup:
`owner*10 + diceCount` (1–8). Both timelines contain 90 authored frames; held
or unused frames are not extra players/counts. S124/f81 is labeled `MCのダイス`.
Dice have their own shaded palette; do not tint one grayscale image with the
territory fill colors.

### Registration and drawing depth

S43 local export bounds: `(-164,-176.85,328,350.85)` pixels. S124 bounds:
`(-11.5,-53.05,70.65,81.8)`. FFDec shifts its outer SVG group when cropping;
compensate that crop shift when restoring registration coordinates. PNG canvas
dimensions rounded to 328 × 351 / 71 × 82 do not define a new center.

Territory stack instances retain authored scale **0.80233765**. `new_map()`
changes their position, not scale. Their full S124 registration canvas is thus
about 56.685 × 65.630 stage pixels at every dice count; only its internal
drawing changes. Current per-count width/height formulas distort this.

Area shapes and dice stacks are separate layers. Stack depths are ordered by
increasing `cpos` (row-major center position). `swap_area_mc` raises selected
**area shapes**, not their dice above all other stacks. One SVG group per
area+die, rendered by territory ID, cannot reproduce original overlaps.

## Screen flow

Root frame 2 contains loader control; root frame 7 contains the game. S170 has
**76 authored frames**. Stopped states jump by labels; unused frames between
labels do not imply transition delays.

| S170 label | Frame | Screen / controls |
| --- | ---: | --- |
| init | 1 | Create game and helpers; attach sounds at f2 |
| title | 5 | DICEWARS, attribution, Play, Top page, Players 2–8 |
| map | 10 | Build map; “Do you play this one?”, Yes, No; title icon |
| start_player | 15 | Refresh/recenter living-player HUD; human/AI branch |
| man | 21 | Original two-step instruction and End Turn |
| com | 26 | AI choice; source f27, target f30, battle jump f33 |
| battle | 34 | Roll strip below map; map/HUD remain visible |
| supply | 41 | Up to 64 stock dice, individual placement |
| gameover | 47 | Loss animation, then Title and History |
| youwin | 56 | Blinking YOU WIN!, then History |
| history | 63 | Automatic map replay and website link; HUD removed |

### Loader and title

S11/f2 reads bytes loaded/total, updates floored percent/bar, and loops to f1
until loaded. At f4, subtract 20 alpha per `onEnterFrame`; after five updates
call `after_load()`. A web loader should represent real readiness, not an
invented slow transfer.

S54 is placed in S170/f5 with matrix
`[1.0001373,0,0,1.0006561,0,-20]`; internal matrices are in M. Restore this
single composition rather than modern two-column cards.

S44 performs eight full-range swaps of colors 0–7, takes the first three, and
chooses three random faces. Title dice are not always violet or a single flat
image. They do not float. S52 sets player digits to 2–8, initially 7 selected;
unselected `#999999`, selected `#cc0000`. Count stays on the persistent game
object across return-to-title. Picker clicks are silent.

Play enters `map`; Top page opens `http://www.gamedesign.jp/`. Keep original
attribution “Copyright 2001-2006 GAMEDESIGN”.

### Preview and playing HUD

S134/f1 shows “Please wait...”; f2 calls `new_map()`; f3 stops and installs
Yes/No release handlers. No returns to f1; Yes calls `start_game()`.
Turn-order randomization occurs **on Yes**, not during preview generation.
T170/f10 refers to `mcMakeMap`, but the placed instance is `mcMapmake` and
runs its own timeline. Preserve visible behavior, not a JS crash from a typo.

B137 is placed near `(770,10)` with its authored scale. “Back to Title” appears
on over/down, extending left of the icon. It is silent. Small non-unit scales
and exact preview/button/text placements are retained in M.

Living players only, in shuffled turn order, at y=568, spacing 100:
`x=400-(livingCount-1)*100/2+visibleIndex*100`. Elimination removes/recenters
them. Their number is largest connected group, not territory count or stock.
HUD die uses S43 first face for owner, scale 0.09629822, registration near
`(-22.05,0.05)`. Frame 2 adds the orange/yellow active backing.

Human screen text is “1. Click your area. 2. Click neighbor to attack.” with
its authored die illustration and End Turn. It disappears on AI turns. There
is no visible round number, sidebar, named-player list, thinking banner,
in-game replay slider, or battle-result prose.

## Map geometry and generation

G constructor: 32 × 28 = 896 cells; 32 territory slots, active IDs 1–31;
eight player records; `pmax=7`, `user=0`, `put_dice=3`, `STOCK_MAX=64`.
Inactive AreaData size/dice start at zero; `make_map()` sets all owners to -1.

Odd-row hex grid: width 23, row step 14, odd-row shift 11.5. Directions 0–5:
NE, E, SE, SW, W, NW. Off-grid neighbor is -1. Vertices:
`(11.5,-3),(23,3),(23,11),(11.5,17),(0,11),(0,3)`.
Map registration is exactly `(26.25,68.5)` from T170/f1. Stack registration
is this offset plus the `cpos` cell origin, without a half-cell correction.

G.make_map(), in order:

1. Perform 896 full-range swaps on `num`. **Initialize `num` only once in the
   constructor; reuse it across rerolls and subsequent campaigns.**
2. Clear `cel/rcel`; choose one random frontier cell.
3. Choose minimum-priority unassigned marked cell. G.percolate(start,8,id)
   claims a priority-selected connected frontier, then absorbs remaining
   immediate frontier cells and marks their neighbors for later territories.
   Stop at exhaustion or before ID 32.
4. Fill isolated empty cells in row-major order only if no in-grid neighbor is
   empty; use the last nonempty neighbor encountered in direction order.
5. Remove territories of size ≤5, compute bounds/center/adjacency.
6. Assign owners round-robin in ascending surviving ID order (quirk below).
7. Trace each original single exterior outline.
8. Put one die on each active territory. Attempt `activeCount*2` extras,
   rotating owners from 0; choose uniformly among that owner's eligible IDs
   in ascending order. **Break the entire setup loop** if this owner has no
   eligible territory, rather than skipping them and continuing.

No minimum-territory retry appears in the original. The port's retry below
`playerCount*2` is an added rule, not original robustness behavior.

### Historical quirks: preserve explicitly

- Owner assignment bytecode calls random, **Modulo**, floor:
  `floor(random()%candidateCount)`. With a normal [0,1) RNG, index is always 0.
  Still consume one random draw per assignment. Replacing `%` with `*` or
  removing these draws changes behavior.
- Center/adjacency scan checks neighboring **cell index >0**, not ≥0. It
  ignores cell 0 and off-grid neighbors for boundary scoring. An in-grid
  neighbor of a different territory, including background 0, adds a +4
  penalty and sets adjacency. Current code penalizes off-grid boundaries.
  Center score is Manhattan distance to floored bounds midpoint; the first
  strictly smaller score in row-major order wins.
- `set_area_line` starts at first in-grid unlike neighbor, advances directions,
  moves into same-area neighbors and subtracts two from direction. It stores
  up to 101 entries including closure; drawing is bounded too. Preserve this
  path/limit instead of replacing with every exposed edge, repairing contours,
  or inventing interior outlines.
- Preserve persistent permutation, biased swaps, and setup early break.

Normal outline: decimal 2236996 = **`#222244`**, width **4**. Normal fill is
owner color. Selected source **and target**: black fill, pure `#ff0000` width-4
outline. Potential targets do not pulse or receive white outlines. Original
single filled paths also avoid per-cell anti-aliasing seams.

Across 70 paired first-map runs, cells, active adjacency sets, turn order, and
RNG counts matched. Owners, dice arrays and at least one center differed in
**all 70**. This is sample evidence, not proof over every seed/pathological
map. Seven full original fixtures and a persistent-object reroll are saved.

## Turns, human interaction, combat

G.start_game resets `jun` to 0–7, then performs `pmax` full-range swaps inside
the first `pmax` entries. `ban=0` indexes this order. Recreate eight players,
compute connected groups, save initial owners/dice for history. Human need
not start. A human first turn is silent; `myturn.wav` plays only when
`next_player()` advances into player 0.

T170/f21 enables only owned territories with ≥2 dice and an adjacent enemy.
Both shape and stack accept presses. Source press plays sound 5, blackens and
raises source, then restricts clicks to source and adjacent enemies. Source
again plays sound 5, restores paint and cancels. Enemy press plays sound 5,
blackens/raises target, disables all area/stack handlers and enters battle.
There is no source-switch shortcut during target selection. End Turn restores
source paint and enters supply.

Roll attacking dice first, defending dice second; each is `floor(random()*6)+1`.
Only strictly greater attacker sum wins. Ties defend. Win: target gets attacker
owner and `sourceDice-1`, source gets 1. Loss: only source becomes 1.
T170/f34 applies mutation **after** animation, plays success/fail, restores
both paints, and records one `(from,to,result)` history event.

On capture, recompute connected groups for affected owners. Then **check human
elimination first**: zero human group immediately means Game Over even with
several surviving AIs. Otherwise one active owner means You Win. Otherwise
return to `start_player` for the same player, allowing more attacks. Human
ends explicitly; AI ends when no candidate. Next-player wraps and skips
eliminated players.

The current port mutates before its modal and checks only whether one player
remains afterward. Both are verified fidelity differences.

## Exact AI policy

G.com_thinking recomputes area/dice totals for all **eight** players. Set
`dice_jun[i]=i`; for i=0..6, j=i+1..7, if `dice_c[i]<dice_c[j]`, swap the
`dice_jun` values only. Dice totals never move. This is **not normal ranking**:
totals `[2,1,4,3,0,0,0,0]` yield `[3,2,1,0,4,5,6,7]`, verified by a saved probe.

Scan IDs 0–7; each player with dice **strictly greater** than `totalDice*2/5`
replaces `dominant`. If two exceed 40%, use the **last qualifying ID**, not
necessarily the largest total.

Enumerate source IDs 1–31, target IDs 1–31, ascending. Require active current
owner source with ≥2 dice and active adjacent enemy target. When dominant is
set, source or target must belong to that player. Reject a target with more
dice than source. Equal dice are accepted if either player's `dice_jun` is
zero or `random()*10>1`. **Still consume that random call when rank already
bypasses the gate.** Exactly 0.1 fails the random test. Unequal eligible attacks
do not consume it.

Choose uniformly from all surviving pairs with one draw. No advantage score,
sort, top-four shortlist or random comparator. No candidates returns 0;
success sets `area_from/area_to` and returns undefined. Callers compare to 0,
not falsiness.

T170 computes at f26, selects source f27, target f30, jumps into battle f33.
AI selections do not play click sounds. Restore frame pacing instead of the
current generic 560 ms delay.

## Battle reveal and timing

S147 has 40 authored frames but stops on initialization at f1. It uses
`onEnterFrame` and jumps to label `end` at f15. Movie length is not duration.

1. Precompute both roll arrays/totals. Hide all 16 dice; blank totals.
2. Reveal attacker on the **right**, defender on the **left**. At every reveal
   step, play sound 4 once. All dice on that side become visible: indices up
   through the reveal index show final faces; each later index consumes one
   new random draw for a flicker face. Other side stays hidden until its turn.
3. Once a side settles, show its total on a separate update. Pause, reveal
   other side, show total, pause, then apply the battle.

Counter condition is `++cnt; if(cnt<=wait)return; cnt=0`. A wait value of
**1 means two ticks**, and **12 means thirteen ticks**. The old handoff's
description could incorrectly be read as one-/twelve-tick intervals.

| Current player | Reveal wait | Side/total wait | Derived resolution tick |
| --- | ---: | ---: | --- |
| Human | 1 | 12 | `2*(attackerDice+defenderDice)+27` |
| AI | 0 | 2 | `attackerDice+defenderDice+7` |

Count from initialization, first callback tick 1. Human 8-v-8: 59 ticks,
~2.458 s; AI 8-v-8: 23 ticks, ~0.958 s, excluding AI selection. These are
callback-derived timings; cross-movie entry offset needs runtime confirmation.

Approximate registrations: attacker `(426.35+35*i,502.65)`; defender
`(369.95-35*i,502.65)`; scale ~0.0999. Retain small per-clip position/scale
differences in M. Total x is `418+35*attackerDice` or `322-35*defenderDice`;
y remains 477, font 17 height 44, with authored field bounds/alignment.
No full-screen backdrop, blur or modal. Map/HUD remain in view.

Flicker uses the same original RNG as gameplay. Whole-movie deterministic
tests must consume these draws in order. Numeric-engine simulations may omit
them only when explicitly labeled; their winners are not campaign goldens.

## Reinforcement and connected groups

`area_tc` is largest connected owned component. Original repeatedly merges
labels. An equivalent algorithm is acceptable with the same adjacency
semantics and verified results.

T170/f41 recalculates group, adds it to existing stock, caps at 64. Each supply
step rebuilds eligible IDs in ascending order (active, owned, below 8 dice).
If none or stock empty, finish. Otherwise decrement stock, choose uniformly,
add one die, redraw, update remaining-stock visibility, record `(id,0,0)`.
Unused stock survives full territories. **One supplied die is one history event.**

Stock icons use **S43 face 2**, not territory-stack frame 2, scale 0.065582275.
For i=0..63: `(20+(i%32)*24,490+floor(i/32)*28)`. Disappear from end as stock
decreases. Supply has no sound call.

S149/f1 starts supply; f2 label `supply` places a die; f4 jumps back to f2 and
plays. Completion jumps to label `wait` f11 and plays; f23 advances player.
The effective cadence of `gotoAndStop();play()` re-entry needs a reference
runtime trace before fixing a millisecond constant. Do not assume 23 frames
per die or replace the sequence with instant distribution.

## Results and history

Loss S159 placement `(2,-43.2)`. Shape 150 is black with alpha 204/255, local
bounds `(20,160)`–`(780,440)`, not a full-stage backdrop. Sound 151 starts f7.
S154 logo enters f8 with alpha 0/y=160, then moves/fades through the exact
per-frame matrices/color transforms in M until y=230/full alpha at f50. Title
and History appear f50, then stop. Use recorded samples, not invented easing.

Win S163 has **42 authored frames, stops f40**. Sound 160 at f10; S162 logo
at f11, local `(134.75,189.75)`. Visibility true 11, false 13, true 14,
false 16, true 17, false 19, true 20. History appears f40. **No Title button
is inside this win sprite**; persistent B137 remains available. It does not
dim the whole stage. The previous handoff incorrectly made result actions alike.

History records initial arrays and battle/individual-supply events. T170/f63
restores initial state, disables interaction, sets replay index 0, starts S169;
player HUD clips are removed. Battle replay highlights source then target,
applies result, restores paints, and plays success/fail. Supply adds one die.

S169/f1 branches by event `to`; f5 source, f7 target, f12 result, f14 advance;
f15 supply, f16 advance; f20 stop. Original history is automatic replay, not
the current manual snapshot slider.

Preserve observed behavior around these source peculiarities:

- `start_history` checks `adat[i].size`, not `game.adat[i].size`. AVM1's
  undefined behavior differs from JS exceptions. Confirm effective restoration
  in runtime; never reproduce an unresolved dereference as a native crash.
- `his_next` stops on `replay_c>his_c`, not ≥, attempting one event past end.
  Confirm the likely empty final step. Do not invent a die placement or crash.
- Scripts mention `mcBar.mcSlider` and `mcReplay`, but **none of these
  instances is placed in this SWF**. The old handoff promoted dead references
  into visible UI. Do not draw a progress slider/replay button without contrary
  runtime evidence.

Footer B168 links to `http://www.gamedesign.jp/`, silently. Global B137 remains
the title route from history.

## Audio: eight original sounds

Every payload is mono MPEG-2.5 Layer III, 11,025 Hz, 16 kbps, with SWF
`SeekSamples=1661`. Seven existing MP3s match embedded MP3 frames byte-for-byte.
**Missing production sound 15** is saved as [button-sound.mp3](flash-reference/button-sound.mp3).

| ID | Linkage / use | SWF samples | Declared seconds |
| ---: | --- | ---: | ---: |
| 1 | success.wav | 2470 | 0.224036 |
| 2 | myturn.wav | 1883 | 0.170794 |
| 3 | fail.wav | 4234 | 0.384036 |
| 4 | dice.wav | 158 | 0.014331 |
| 5 | click.wav, territory press | 678 | 0.061497 |
| 15 | Button press | 1817 | 0.164807 |
| 151 | Loss timeline | 12425 | 1.126984 |
| 160 | Win timeline | 33075 | 3.000000 |

These are sample-count/rate values, **not exported MP3 durations**. Raw MP3
export drops SWF latency metadata. Adobe defines initial sample skipping for
event MP3s and a separate sample count. Byte-identical MP3 files therefore
do not establish exact playback; apply and verify metadata, including decoder
delay compensation, rather than blindly trimming twice.
[Adobe SWF specification, Sound / MP3 sound data](https://open-flash.github.io/mirrors/swf-spec-19.pdf).

FFDec WAV export is not automatically a finished fidelity asset: its dice WAV
had 1219 samples in this audit, versus 158 declared by SWF. Compare onset/end
with reference-player capture before selecting decoded buffers. Preserve source
payloads; do not denoise, normalize, remaster or re-encode to MP3.

### Exact trigger contract

- **Sound 15:** B16 Play, B19 Top page, B130 Yes/No/End Turn, B155 Title,
  B157 History. Their `buttonSoundChar2` binds to entry into pressed state;
  actions execute on release. A cancelled release outside can still have
  sounded. Adobe calls this OverUpToOverDown in the
  [button sound definition](https://open-flash.github.io/mirrors/swf-spec-19.pdf).
- **Sound 5:** human source, source cancel, target presses; no AI selection click.
- **Sound 4:** each reveal, `attackerDice+defenderDice` times per battle.
- **1/3:** battle outcome and history battle outcome.
- **2:** next-player transition into human turn, not initial human startup.
- **151/160:** result f7/f10, not immediate battle resolution.
- **Silent:** player-number picker, B137 title icon, B168 website link, supply.

No script sets gain. Flash defaults to volume 100; the port's 0.42/0.55/0.65
effect gains are modern changes. Keep original relative gain, with explicit
master mute/gain if retained.
[Adobe AS2 Sound reference](https://open-flash.github.io/mirrors/as2-language-reference/Sound.html).

There are SoundStreamHead2 tags but **no SoundStreamBlock tags**. FFDec's empty
`-1.wav` is not a ninth sound or background music.

## Audited baseline discrepancies

The roadmap is the actionable checklist. Also account for these verified code
differences when rebuilding the client:

- Turn order is currently generated during preview; original generates on Yes.
  Priority values are currently recreated, not retained across rerolls.
- History currently groups supply into a single snapshot and is available
  mid-game; original stores every die and replays after results.
- Mobile CSS uses 150% map width/-25% margin, cropping playable edges.
- Battle timer lacks a playing-mode guard. Returning to title can leave a
  callback alive; a winning/losing pending battle can replace title with a
  result. Sound toggles also recreate timing effects.
- `get_game_state` exposes apparent moves while battle is resolving or outside
  active play. `start_new_game` skips preview and does not close an open history
  overlay. Attack-tool phase locking is synchronous, but all rebuilt phases
  still need rapid/re-entrant tests.

Keep mode, phase, selection, pending outcome, player, and campaign generation
coherent synchronously. Old callbacks must not mutate a replacement game.
UI and model actions must share legality. Accessibility describes displayed
state, not an already-mutated hidden future snapshot.

## Remaining evidence gates

1. Capture original-player title, preview, source/target/cancel, AI selections,
   min/max human/AI battles, supply, human elimination, victory and history.
   Record player version and SWF hash. Emulator evidence is secondary.
2. Establish same-frame supply/history jump cadence and parent/child entry
   offsets. Actual frame numbers/code are verified; full runtime timing is not.
3. Compare all audio onsets, end points, overlap, and decoder compensation with
   a reference recording and then target browsers.
4. Resolve undefined history references and the extra final event visibly.
5. Compare vectors/glyphs at 800 × 600, enlarged resolutions and both mobile
   orientations. Distinguish anti-aliasing variation from incorrect artwork,
   geometry, registration, layering, color or timing.

Do not close these gates merely because a build or numeric simulation passes.
Record each new observation and revise decisions only when evidence supports it.

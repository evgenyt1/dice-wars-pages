# Original Flash evidence bundle

Permanent evidence for the native 1:1 port. The application uses registered
production copies generated from the original vectors; it contains no SWF emulator.
See [implemented behavior and remaining acceptance gates](IMPLEMENTATION.md).

- [Specification](../FLASH_PORT_REFERENCE.md): verified behavior and open gates.
- [Implementation route](../FLASH_FIDELITY_PLAN.md): ordered acceptance checklist.
- [Vector atlas](atlas.html): six authored-layer compositions, all 64 territory
  stacks and 48 rolling faces. Enlarges without changing the source paths.
- [Manifest](manifest.json): source identity, script hashes, tag inventory,
  per-frame transforms, font subsets, sound/button mappings.
- [Baseline oracle report](oracle-report.json): historical redesign comparison.
- [Native oracle report](native-oracle-report.json): 70 zero-difference map comparisons.
- [Native art](native-art-manifest.json): production vectors, registration and hashes.
- [Native audio](native-audio-manifest.json): payloads, PCM sample counts and decoder caveat.
- [Runtime observations](runtime-observations.json): secondary player provenance and supply trace.
- [Map fixtures](map-fixtures.json): original maps for players 2–8 and a reroll.
- [Button sound](button-sound.mp3): missing symbol 15, raw payload evidence.
- [Artwork hashes](art-sha256.json): integrity for the curated vector plates.

## Reproduce

Use FFDec **26.2.1**, Java, SWFTools, Python 3, and the repo's Node/npm tools.
No additional production dependency is needed. Original source is `../dice.swf`.
From repository root:

```bash
python3 scripts/audit-flash.py \
  --ffdec-jar /tmp/dice-ffdec/unpacked/ffdec-cli.jar \
  --java /opt/homebrew/opt/openjdk@21/bin/java \
  --work-dir /tmp/dice-permanent-audit \
  --reference-dir /tmp/dice-reference-check

node scripts/flash-oracle.mjs \
  /tmp/dice-permanent-audit/as \
  /tmp/dice-reference-check

python3 scripts/verify-flash-reference.py
```

Adjust Java/FFDec locations for the machine. Headless Java is intentional:
native AWT startup aborted on this Mac during initial export. Raw XML, logs,
P-code and exports stay under work-dir, outside Git.

For a deliberate reference refresh, pass `--reference-dir docs/flash-reference`
and the same oracle destination. Review differences; never refresh goldens to
hide a mismatch. SWF digest and FFDec version are pinned. The numeric oracle
checks decompiled class hashes against the committed manifest before execution.

The committed evidence was regenerated from the pinned artifact. Owner Modulo
was also confirmed in the independently generated SWFTools dump.

## Interpret correctly

The oracle changes AS2 class declaration syntax into JS class syntax and
injects a recorded uint32 LCG in an isolated context. It is not a Flash runtime.
The current TypeScript engine runs in a second isolated context with the same
random stream. The report stores the compared engine-source digest.

Seventy paired maps use seeds 1–10 for players 2–8. Owners, dice and at least
one center differ in every run. Cells, active adjacency, order and RNG counts
match in this sample, not necessarily for all possible seeds. After engine
changes, rerun comparisons; keep historical baselines identifiable in Git.

Six controlled probes test the original chooser's edge cases. Full simulations
use original AI with a separately reviewed small combat/supply harness, run AI
for player 0, omit animation RNG, and continue after human elimination to test
completion. They are not original-player campaign recordings or winner goldens.

FFDec does not run title initialization, map generation, rolling or replay
while rendering. Title digits in its authored plate remain seven `1`
placeholders; live Flash changes them to 2–8. Default faces/colors are not live
random choices. Result plates omit the board behind overlays. The atlas labels
these limitations; no plate should be called a runtime screenshot.

MP3 hashes cover frames after the two-byte SWF SeekSamples prefix. Seek/count
metadata remains in the manifest. Seven production payloads match; sound 15
was absent at the research checkpoint and is now restored in the application. Hashes cannot establish playback trimming,
gain, timing or overlap. The raw audio player in the atlas ignores SWF metadata.

## Superseded handoff

Old guidance is retained in Git at `8d8ff36`. It incorrectly counted seven
sounds, treated dead history references as real UI, missed stack scale and
cell-zero scoring, and generalized win/loss controls. The new specification
corrects these and leaves unverified runtime behavior explicitly open.

## Regenerate production copies

After the pinned FFDec export, run `python3 scripts/export-native-art.py WORK_DIR`.
It copies original paths, restores registration, generates a shared SVG symbol
file and extracts original numeric glyphs. It does not redraw artwork.

Export WAVs with FFDec 26.2.1 (`-format sound:wav -export sound WAV_DIR ../dice.swf`),
then run `python3 scripts/export-native-audio.py WAV_DIR`. FFDec has already applied
SeekSamples; the script crops once to SoundSampleCount and verifies preserved
MP3 hashes. Decoder equivalence is pending reference capture.

Run `npm test` for native engine/clock/assets tests. Keep new oracle output separate
from the historical report; never refresh original map fixtures to hide differences.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  DICE_ART_URL,
  PLAYER_PALETTE,
  THEMES,
  diceHref,
} from '../app/game-presentation.ts';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('all original vector registrations and payloads match the production manifest', () => {
  const manifest = JSON.parse(
    read('docs/flash-reference/native-art-manifest.json'),
  );
  assert.equal(Object.keys(manifest.assets).length, 171);
  for (const [name, asset] of Object.entries(manifest.assets)) {
    const svg = read(`public/game-assets/vector/${name}.svg`);
    assert.equal(hash(svg), asset.sha256);
    assert.deepEqual(
      svg
        .toString()
        .match(/viewBox="([^"]+)"/)[1]
        .split(' ')
        .map(Number),
      [asset.x, asset.y, asset.width, asset.height],
    );
    assert.ok(!svg.includes('<image'));
  }
  for (let owner = 0; owner < 8; owner++)
    for (let dice = 1; dice <= 8; dice++)
      assert.ok(manifest.assets[`s124-f${owner * 10 + dice}`]);
  for (let owner = 0; owner < 8; owner++)
    for (let face = 1; face <= 6; face++)
      assert.ok(manifest.assets[`s43-f${owner * 10 + face}`]);
});
test('eight original MP3 payloads preserved; PCM has exact SWF sample rate/count', () => {
  const manifest = JSON.parse(
    read('docs/flash-reference/native-audio-manifest.json'),
  );
  assert.equal(manifest.sounds.length, 8);
  for (const s of manifest.sounds) {
    assert.equal(
      hash(read(`public/game-assets/audio/${s.name}.mp3`)),
      s.mp3Sha256,
    );
    const wav = read(`public/game-assets/audio/${s.name}.wav`);
    assert.equal(hash(wav), s.wavSha256);
    assert.equal(wav.readUInt32LE(24), 11025);
    assert.equal(wav.readUInt32LE(40) / 2, s.soundSampleCount);
    assert.equal(s.seekSamples, 1661);
  }
});

test('approved Tactile bank is preserved without clipping or cut-edge clicks', () => {
  const manifest = JSON.parse(
    read('public/game-assets/audio/tactile/manifest.json'),
  );
  assert.equal(Object.keys(manifest.sounds).length, 8);
  for (const [name, asset] of Object.entries(manifest.sounds)) {
    const wav = read(`public/game-assets/audio/tactile/${name}.wav`);
    assert.equal(hash(wav), asset.sha256);
    assert.notEqual(
      hash(wav),
      hash(read(`public/game-assets/audio/${name}.wav`)),
    );
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), manifest.sample_rate);
    assert.equal(
      wav.readUInt32LE(40) / 2 / manifest.sample_rate,
      asset.duration,
    );
    assert.equal(wav.readInt16LE(44), 0);
    assert.equal(wav.readInt16LE(wav.length - 2), 0);
    for (let i = 44; i < wav.length; i += 2)
      assert.ok(Math.abs(wav.readInt16LE(i)) < 32767);
  }
});

test('Midnight contains every face and stack with unique, resolved vector references', () => {
  const svg = read('public/game-assets/vector/midnight.svg').toString();
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size);
  for (const match of svg.matchAll(/href="#([^"]+)"/g))
    assert.ok(unique.has(match[1]));
  for (let owner = 0; owner < 8; owner++) {
    for (let count = 1; count <= 8; count++)
      assert.ok(unique.has(`stack-${owner}-${count}`));
    for (let face = 1; face <= 6; face++)
      assert.ok(unique.has(`face-${owner}-${face}`));
  }
  assert.ok(!svg.includes('<image'));
});

test('active presentation uses the original eight colors and all original dice sprites', () => {
  assert.deepEqual(
    PLAYER_PALETTE.map((p) => p.color),
    [
      '#b37ffe',
      '#b3ff01',
      '#009302',
      '#ff7ffe',
      '#ff7f01',
      '#b3fffe',
      '#ffff01',
      '#ff5858',
    ],
  );
  assert.equal(DICE_ART_URL, '/game-assets/vector/symbols.svg');
  const svg = read(`public${DICE_ART_URL}`).toString();
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (let owner = 0; owner < 8; owner++) {
    for (let dice = 1; dice <= 8; dice++)
      assert.ok(ids.has(`vs124-f${owner * 10 + dice}`));
    for (let face = 1; face <= 6; face++)
      assert.ok(ids.has(`vs43-f${owner * 10 + face}`));
  }
});

test('both selectable themes resolve every board stack and die face from preserved artwork', () => {
  for (const theme of ['original', 'midnight']) {
    const svg = read(`public${THEMES[theme].diceUrl.split('?')[0]}`).toString();
    const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (let owner = 0; owner < 8; owner++) {
      for (const [kind, max] of [
        ['stack', 8],
        ['face', 6],
      ]) {
        for (let count = 1; count <= max; count++) {
          const [url, symbol] = diceHref(theme, kind, owner, count).split('#');
          assert.equal(url, THEMES[theme].diceUrl);
          assert.ok(ids.has(symbol), `${theme}: ${symbol}`);
        }
      }
    }
  }
});

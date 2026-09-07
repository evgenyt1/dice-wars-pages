import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('resident dice retain all 224 original and Midnight frames without external references', () => {
  // Re-resolve the source display lists, including use transforms and draw order.
  // Fail if a source edit was omitted or cannot be represented losslessly.
  execFileSync('python3', ['scripts/compile-dice-art.py', '--check'], {
    cwd: new URL('..', import.meta.url),
  });
  const art = JSON.parse(
    readFileSync(new URL('../app/dice-art.json', import.meta.url)),
  );
  assert.equal(Object.keys(art.frames).length, 224);
  for (const theme of ['original', 'midnight']) {
    for (const [kind, max] of [
      ['stack', 8],
      ['face', 6],
    ]) {
      for (let owner = 0; owner < 8; owner++) {
        for (let count = 1; count <= max; count++) {
          const frame = art.frames[`${theme}-${kind}-${owner}-${count}`];
          assert.ok(frame.length > 0);
          for (const draw of frame) {
            assert.ok(art.paths[draw.path].startsWith('M'));
            assert.match(draw.fill, /^#[a-f0-9]{6}$/i);
            assert.equal(draw.href, undefined);
          }
        }
      }
    }
  }
});

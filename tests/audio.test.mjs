import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../app/game-audio.ts';
test('first physical press schedules its sound while audio unlock is pending, without dropping it', async (t) => {
  const nodes = [];
  class Context {
    state = 'suspended';
    destination = {};
    decodeAudioData = async () => ({});
    resume = async () => {
      await Promise.resolve();
      this.state = 'running';
    };
    close = async () => {
      this.state = 'closed';
    };
    createBufferSource = () => {
      const source = {
        connect() {},
        disconnect() {},
        start() {
          source.started = true;
        },
        stop() {
          source.stopped = true;
        },
      };
      nodes.push(source);
      return source;
    };
  }
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    text: async () => '<svg/>',
    arrayBuffer: async () => new ArrayBuffer(0),
  }));
  const prior = globalThis.AudioContext;
  globalThis.AudioContext = Context;
  t.after(() => {
    if (prior) globalThis.AudioContext = prior;
    else delete globalThis.AudioContext;
  });
  const audio = new GameAudio();
  await audio.load(() => {});
  audio.play('button');
  assert.equal(nodes.length, 0);
  audio.unlock();
  audio.play('button');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].started, true);
  audio.play('dice');
  assert.equal(nodes.length, 2);
  assert.ok(!nodes[0].stopped);
  audio.silence();
  assert.ok(nodes.every((n) => n.stopped));
  audio.close();
});

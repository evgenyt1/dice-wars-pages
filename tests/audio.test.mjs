import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../app/game-audio.ts';

async function setupAudio(t, session, now) {
  const nodes = [];
  const contexts = [];
  let context;
  class Context {
    state = 'suspended';
    destination = {};
    currentTime = 0;
    resumes = 0;
    rejectResume = false;
    constructor() {
      context = this;
      contexts.push(this);
    }
    decodeAudioData = async () => {
      const data = Float32Array.from([0, 0.5, -0.5, 0]);
      return { numberOfChannels: 1, getChannelData: () => data };
    };
    resume = async () => {
      this.resumes++;
      if (this.rejectResume) throw new Error('User activation required');
      await Promise.resolve();
      this.state = 'running';
    };
    close = async () => {
      this.state = 'closed';
    };
    createBufferSource = () => {
      const source = {
        context: this,
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
  const priorSession = Object.getOwnPropertyDescriptor(
    navigator,
    'audioSession',
  );
  globalThis.AudioContext = Context;
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: session,
  });
  t.after(() => {
    if (prior) globalThis.AudioContext = prior;
    else delete globalThis.AudioContext;
    if (priorSession)
      Object.defineProperty(navigator, 'audioSession', priorSession);
    else delete navigator.audioSession;
  });
  const audio = new GameAudio(now);
  const progress = [];
  await audio.load((value) => progress.push(value));
  assert.equal(progress.at(-1), 100);
  return { audio, context, contexts, nodes };
}

test('first physical press schedules its sound while audio unlock is pending, without dropping it', async (t) => {
  const { audio, nodes } = await setupAudio(t);
  audio.play('button');
  assert.equal(nodes.length, 0);
  audio.unlock();
  audio.play('button');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].started, true);
  const samples = nodes[0].buffer.getChannelData(0);
  assert.ok(Math.abs(samples[1] - 0.325) < 1e-7);
  assert.ok(Math.abs(samples[2] + 0.325) < 1e-7);
  audio.play('button');
  assert.equal(nodes[1].buffer, nodes[0].buffer);
  assert.ok(
    Math.abs(samples[1] - 0.325) < 1e-7,
    'gain is applied once, not per play',
  );
  audio.play('dice');
  assert.equal(nodes.length, 3);
  assert.ok(!nodes[0].stopped);
  audio.silence();
  assert.ok(nodes.every((n) => n.stopped));
  audio.close();
});

test('iPhone playback session is requested on interaction, with retry after rejected touch-start', async (t) => {
  const session = { type: 'ambient' };
  const { audio, context, nodes } = await setupAudio(t, session);
  assert.equal(session.type, 'ambient');
  audio.recover();
  assert.equal(context.resumes, 0, 'page visibility must not unlock autoplay');
  context.rejectResume = true;
  audio.unlock();
  audio.play('button');
  await Promise.resolve();
  assert.equal(session.type, 'playback');
  assert.equal(context.state, 'suspended');
  context.rejectResume = false;
  audio.unlock(); // touch-end / click gets a fresh user activation
  await Promise.resolve();
  assert.equal(context.state, 'running');
  assert.equal(context.resumes, 2);
  assert.equal(nodes.length, 1, 'recovery must not duplicate the queued cue');
  audio.close();
});

test('returning from an iOS interruption resumes audio without replaying old cues', async (t) => {
  const { audio, context, nodes } = await setupAudio(t);
  audio.unlock();
  await Promise.resolve();
  audio.play('dice');
  context.state = 'interrupted';
  audio.background(); // visibilitychange to hidden
  audio.recover();
  await Promise.resolve();
  assert.equal(context.state, 'running');
  assert.equal(context.resumes, 2);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].stopped, true);
  audio.play('success');
  assert.equal(nodes.length, 2);
  assert.equal(nodes[1].started, true);
  audio.close();
  audio.recover();
  assert.equal(context.resumes, 2);
});

test('unsupported or rejected AudioSession does not block ordinary Web Audio', async (t) => {
  const session = {
    get type() {
      return 'ambient';
    },
    set type(_) {
      throw new Error('Unavailable');
    },
  };
  const { audio, context, nodes } = await setupAudio(t, session);
  audio.unlock();
  await Promise.resolve();
  audio.play('button');
  assert.equal(context.state, 'running');
  assert.equal(nodes.length, 1);
  audio.close();
});

test('first tap after backgrounding replaces a context that stayed suspended or interrupted', async (t) => {
  for (const stuck of ['suspended', 'interrupted']) {
    const { audio, contexts, nodes } = await setupAudio(t);
    audio.unlock();
    await Promise.resolve();
    audio.play('dice');
    const original = contexts[0];
    audio.background();
    original.state = stuck;
    original.rejectResume = true; // WebKit ignores resume() without a gesture
    audio.recover();
    await Promise.resolve();
    assert.equal(contexts.length, 1, 'no replacement without a user gesture');
    audio.unlock();
    await Promise.resolve();
    assert.equal(contexts.length, 2);
    assert.equal(original.state, 'closed');
    assert.equal(contexts[1].state, 'running');
    audio.play('dice');
    assert.equal(nodes.at(-1).context, contexts[1]);
    assert.equal(
      nodes.at(-1).buffer,
      nodes[0].buffer,
      'decoded buffers are reused',
    );
    audio.unlock();
    assert.equal(contexts.length, 2, 'a healthy replacement is kept');
    audio.close();
  }
});

test('a "running" context with a frozen clock is replaced; an advancing one is kept', async (t) => {
  let time = 0;
  for (const frozen of [true, false]) {
    const { audio, contexts } = await setupAudio(t, undefined, () => time);
    audio.unlock();
    await Promise.resolve();
    const original = contexts[0];
    audio.background();
    audio.recover();
    await Promise.resolve();
    assert.equal(original.state, 'running');
    time += 100;
    audio.unlock(); // too soon to judge the clock
    assert.equal(contexts.length, 1);
    time += 400;
    if (!frozen) original.currentTime += 0.5;
    audio.unlock();
    assert.equal(contexts.length, frozen ? 2 : 1);
    time += 1000;
    audio.unlock();
    assert.equal(
      contexts.length,
      frozen ? 2 : 1,
      'health is judged once per return',
    );
    audio.close();
  }
});

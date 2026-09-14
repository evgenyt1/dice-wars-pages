import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../app/game-controller.ts';
import { seededRandom } from '../app/game-engine.ts';
import {
  SESSION_KEY,
  autosave,
  loadSession,
  parseSession,
  storeSession,
} from '../app/game-session.ts';

const ticks = (controller, n) => {
  for (let i = 0; i < n; i++) controller.tick();
};
const until = (controller, done, act = () => {}) => {
  for (let i = 0; !done(controller.getSnapshot()); i++) {
    act(controller.getSnapshot());
    controller.tick();
    assert.ok(i < 200000, 'state was not reached');
  }
};
/** Saves through JSON, as storage does, and reopens in a fresh application. */
function reopen(controller, seed = 99) {
  const saved = parseSession(JSON.parse(JSON.stringify(controller.session())));
  assert.ok(saved, 'saved session must validate');
  const sounds = [];
  const next = new GameController(seededRandom(seed), (s) => sounds.push(s));
  next.restore(saved);
  next.ready();
  ticks(next, 5);
  return { next, sounds };
}
function humanTurn(seed = 4, count = 5) {
  const c = new GameController(seededRandom(seed));
  c.startNewGame(count);
  until(
    c,
    (s) => s.phase === 'source',
    (s) => s.phase === 'source',
  );
  return c;
}
const board = (game) =>
  game.territories.map((t) => [t.owner, t.dice]).concat([game.turnIndex]);

test('title and preview reopen with count, sound and the persistent map permutation', () => {
  const c = new GameController(seededRandom(1));
  c.ready();
  ticks(c, 5);
  c.chooseCount(4);
  c.toggleSound();
  let { next } = reopen(c);
  assert.equal(next.getSnapshot().mode, 'title');
  assert.equal(next.getSnapshot().count, 4);
  assert.equal(next.getSnapshot().sound, false);
  c.preview();
  ticks(c, 1);
  ({ next } = reopen(c));
  const s = next.getSnapshot();
  assert.equal(s.mode, 'preview');
  assert.deepEqual(s.game.territories, c.getSnapshot().game.territories);
  assert.deepEqual(next.generator.priority, c.generator.priority);
  next.accept();
  assert.equal(next.getSnapshot().mode, 'playing');
  assert.equal(next.getSnapshot().game.turnOrder.length, 4);
});

test('human source and target selections resume with identical legal moves', () => {
  const c = humanTurn();
  let { next, sounds } = reopen(c);
  assert.equal(next.getSnapshot().phase, 'source');
  assert.deepEqual(next.publicState(), c.publicState());
  const { from } = c.publicState().validAttacks[0];
  c.territory(from);
  ({ next, sounds } = reopen(c));
  assert.equal(next.getSnapshot().phase, 'target');
  assert.equal(next.getSnapshot().selected, from);
  assert.deepEqual(
    next.publicState().validAttacks,
    c.publicState().validAttacks,
  );
  assert.deepEqual(sounds, [], 'resuming is silent');
});

test('a rolling battle resumes with its stored rolls and cannot be rerolled', () => {
  const c = humanTurn();
  const { from, to } = c.publicState().validAttacks[0];
  c.attack(from, to);
  ticks(c, 3);
  const reopened = [7, 8].map((seed) => reopen(c, seed));
  until(c, (s) => s.phase !== 'battle');
  for (const { next, sounds } of reopened) {
    assert.equal(next.getSnapshot().phase, 'battle');
    until(next, (s) => s.phase !== 'battle');
    assert.deepEqual(
      board(next.getSnapshot().game),
      board(c.getSnapshot().game),
    );
    assert.ok(sounds.includes('dice'));
  }
});

test('AI selection and reinforcement resume where they stopped', () => {
  const c = humanTurn(11, 6);
  until(
    c,
    (s) => s.phase === 'ai' && s.frame === 28,
    (s) => s.phase === 'source' && c.endTurn(),
  );
  const { next } = reopen(c);
  assert.equal(next.getSnapshot().phase, 'ai');
  assert.equal(next.getSnapshot().selected, c.getSnapshot().selected);
  until(next, (s) => s.phase === 'battle');
  until(c, (s) => s.phase === 'battle');
  assert.equal(next.getSnapshot().battle.from, c.getSnapshot().battle.from);
  assert.equal(next.getSnapshot().battle.to, c.getSnapshot().battle.to);

  until(
    c,
    (s) => s.phase === 'supply' && s.game.players.some((p) => p.stock > 1),
  );
  const current = c.getSnapshot().game.turnIndex;
  const { next: supply } = reopen(c);
  assert.equal(supply.getSnapshot().phase, 'supply');
  assert.deepEqual(
    supply.getSnapshot().game.players.map((p) => p.stock),
    c.getSnapshot().game.players.map((p) => p.stock),
  );
  until(supply, (s) => s.phase !== 'supply');
  assert.notEqual(supply.getSnapshot().game.turnIndex, current);
  assert.equal(
    supply.getSnapshot().game.events.length,
    c.getSnapshot().game.events.length +
      c.getSnapshot().game.players[c.getSnapshot().game.turnOrder[current]]
        .stock -
      supply.getSnapshot().game.players[c.getSnapshot().game.turnOrder[current]]
        .stock,
  );
});

test('finished campaigns reopen on their result, including from history replay', () => {
  const c = new GameController(seededRandom(2));
  c.startNewGame(2);
  until(
    c,
    (s) => s.mode !== 'playing',
    (s) => {
      if (s.phase !== 'source') return;
      const move = c
        .publicState()
        .validAttacks.find(
          (m) =>
            s.game.territories[m.from].dice > s.game.territories[m.to].dice,
        );
      if (move) c.attack(move.from, move.to);
      else c.endTurn();
    },
  );
  const result = c.getSnapshot().mode;
  ticks(c, 60);
  const final = c.getSnapshot().game;
  c.history();
  ticks(c, 30);
  assert.equal(c.getSnapshot().mode, 'history');
  const { next, sounds } = reopen(c);
  assert.equal(next.getSnapshot().mode, result);
  assert.deepEqual(board(next.getSnapshot().game), board(final));
  assert.deepEqual(sounds, [], 'result sound is not replayed');
  next.history();
  assert.equal(next.getSnapshot().mode, 'history');
});

test('invalid or tampered sessions are discarded and start fresh', () => {
  const c = humanTurn();
  const good = JSON.parse(JSON.stringify(c.session()));
  const variants = [
    { ...good, version: 0 },
    { ...good, count: 9 },
    { ...good, priority: good.priority.slice(1) },
    {
      ...good,
      game: {
        ...good.game,
        territories: good.game.territories.map((t) =>
          t.size ? { ...t, dice: 9 } : t,
        ),
      },
    },
    { ...good, game: { ...good.game, turnOrder: [0, 0, 1, 2, 3] } },
    { ...good, mode: 'lost' },
    {
      ...good,
      phase: 'battle',
      battle: { from: 1, to: 2, attackerRolls: [6], defenderRolls: [1] },
    },
  ];
  for (const variant of variants) assert.equal(parseSession(variant), null);

  const values = new Map([[SESSION_KEY, '{not json']]);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  assert.equal(loadSession(storage), null);
  assert.equal(values.has(SESSION_KEY), false);
  storeSession(storage, c.session());
  assert.deepEqual(
    board(loadSession(storage).game),
    board(c.getSnapshot().game),
  );
  storeSession(
    {
      ...storage,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    },
    c.session(),
  );
  assert.equal(loadSession(null), null);
});

test('autosave coalesces animation updates, flushes on demand, and never clobbers during loading', () => {
  const writes = [];
  const timers = [];
  const clock = {
    set: (fn) => timers.push(fn),
    clear: () => {},
  };
  const loading = new GameController(seededRandom(3));
  const idle = autosave(loading, (s) => writes.push(s), 1000, clock);
  idle.flush();
  assert.equal(
    writes.length,
    0,
    'loading without a restored session writes nothing',
  );
  idle.stop();

  const c = new GameController(seededRandom(3));
  const saver = autosave(c, (s) => writes.push(s), 1000, clock);
  c.startNewGame(3);
  until(c, (s) => s.phase === 'source' || s.mode !== 'playing');
  assert.equal(timers.length, 1, 'many updates schedule one save');
  timers.shift()();
  assert.equal(writes.length, 1);
  saver.flush();
  assert.equal(writes.length, 2);
  assert.deepEqual(board(writes[1].game), board(c.getSnapshot().game));
  saver.stop();

  const restored = new GameController(seededRandom(5));
  restored.restore(writes[1]);
  restored.startNewGame(2); // Explicit replacement discards the pending resume.
  ticks(restored, 10);
  assert.equal(restored.getSnapshot().game.playerCount, 2);
  const late = parseSession(JSON.parse(JSON.stringify(writes[1])));
  restored.restore(late);
  assert.equal(
    restored.getSnapshot().game.playerCount,
    2,
    'restore only applies while loading',
  );
});

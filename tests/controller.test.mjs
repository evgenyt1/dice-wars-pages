import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleAnimation, GameController } from '../app/game-controller.ts';
import { seededRandom } from '../app/game-engine.ts';
const ticks = (controller, n) => {
  for (let i = 0; i < n; i++) controller.tick();
};
for (const human of [true, false])
  test(`${human ? 'human' : 'AI'}: exact battle counters, totals, sound count and flicker RNG for every dice pair`, () => {
    for (let a = 2; a <= 8; a++)
      for (let d = 1; d <= 8; d++) {
        let draws = 0,
          reveals = 0,
          totalUpdates = 0;
        const battle = {
          attackerRolls: Array(a).fill(4),
          defenderRolls: Array(d).fill(3),
        };
        const animation = new BattleAnimation(battle, human, () => {
          draws++;
          return 0.1;
        });
        while (true) {
          const event = animation.tick();
          if (event === 'done') break;
          if (event === 'reveal') reveals++;
          if (event === 'total') totalUpdates++;
          assert.ok(animation.ticks < 100);
        }
        assert.equal(animation.ticks, human ? 2 * (a + d) + 27 : a + d + 7);
        assert.equal(reveals, a + d);
        assert.equal(totalUpdates, 2);
        assert.equal(draws, (a * (a - 1)) / 2 + (d * (d - 1)) / 2);
        assert.deepEqual(animation.totals, [4 * a, 3 * d]);
        assert.deepEqual(animation.rolls, [
          battle.attackerRolls,
          battle.defenderRolls,
        ]);
      }
  });
function humanGame(count = 7) {
  const sounds = [];
  const c = new GameController(seededRandom(4), (name) => sounds.push(name));
  c.startNewGame(count);
  for (let i = 0; c.getSnapshot().phase !== 'source'; i++) {
    c.tick();
    assert.ok(i < 20000);
  }
  return { c, sounds };
}
test('preview RNG is separate; count persists across title return; title controls silent', () => {
  const sounds = [];
  const c = new GameController(seededRandom(1), (name) => sounds.push(name));
  c.ready();
  ticks(c, 5);
  c.chooseCount(3);
  c.preview();
  assert.equal(c.getSnapshot().mode, 'building');
  ticks(c, 1);
  assert.deepEqual(c.getSnapshot().game.turnOrder, []);
  c.accept();
  assert.equal(c.getSnapshot().game.turnOrder.length, 3);
  c.title();
  assert.equal(c.getSnapshot().count, 3);
  assert.deepEqual(sounds, []);
});
test('source/cancel/target pipeline and synchronous rejection of re-entrant tool calls', () => {
  const { c } = humanGame();
  const pairs = c.publicState().validAttacks;
  const { from, to } = pairs[0];
  c.territory(from);
  assert.deepEqual(c.publicState().validSources, [from]);
  const other = pairs.find((p) => p.from !== from);
  if (other) assert.throws(() => c.attack(other.from, other.to));
  c.cancel();
  assert.equal(c.getSnapshot().phase, 'source');
  const before = c.getSnapshot().game;
  assert.equal(c.attack(from, to).status, 'rolling');
  assert.equal(c.getSnapshot().game, before);
  assert.deepEqual(c.publicState().validSources, []);
  assert.deepEqual(c.publicState().validAttacks, []);
  assert.throws(() => c.attack(from, to));
  c.endTurn();
  assert.equal(c.getSnapshot().phase, 'battle');
});
test('mute toggles do not restart battle counters; returning to title cancels pending outcome', () => {
  const { c } = humanGame();
  const { from, to } = c.publicState().validAttacks[0];
  const a = c.getSnapshot().game.territories[from].dice,
    d = c.getSnapshot().game.territories[to].dice;
  c.attack(from, to);
  const before = c.getSnapshot().game.events.length;
  for (let i = 0; i < 2 * (a + d) + 26; i++) {
    c.toggleSound();
    c.tick();
  }
  assert.equal(c.getSnapshot().game.events.length, before);
  c.tick();
  assert.equal(c.getSnapshot().game.events.length, before + 1);
  const next = c.publicState().validAttacks[0];
  if (next) c.attack(next.from, next.to);
  c.title();
  ticks(c, 1000);
  assert.equal(c.getSnapshot().mode, 'title');
  assert.equal(c.getSnapshot().game, null);
});
test('replacement game clears selection, battle, history and all old phase work', () => {
  const { c } = humanGame();
  const move = c.publicState().validAttacks[0];
  c.attack(move.from, move.to);
  c.startNewGame(2);
  assert.equal(c.getSnapshot().battle, null);
  assert.equal(c.getSnapshot().selected, null);
  assert.equal(c.getSnapshot().replayIndex, 0);
  assert.equal(c.getSnapshot().game.events.length, 0);
  assert.equal(c.getSnapshot().game.playerCount, 2);
});
test('a stopped frame clock cannot deliver an old callback', () => {
  const { c } = humanGame();
  let callback;
  const stop = c.runClock(
    (fn) => {
      callback = fn;
      return 1;
    },
    () => {},
  );
  stop();
  const state = c.getSnapshot();
  callback(1000);
  assert.equal(c.getSnapshot(), state);
});
for (let count = 2; count <= 8; count++)
  test(`${count} players: full native phase campaign, delayed result sound and automatic history`, () => {
    const sounds = [];
    const c = new GameController(seededRandom(count), (name) =>
      sounds.push(name),
    );
    c.startNewGame(count);
    let tick = 0;
    while (c.getSnapshot().mode === 'playing') {
      const s = c.getSnapshot();
      if (s.phase === 'source') {
        const moves = c.publicState().validAttacks;
        // Deterministic human policy: choose greatest local advantage, otherwise end.
        const move = moves.find(
          (m) =>
            s.game.territories[m.from].dice > s.game.territories[m.to].dice,
        );
        if (move) c.attack(move.from, move.to);
        else c.endTurn();
      }
      c.tick();
      assert.ok(++tick < 200000);
    }
    const result = c.getSnapshot().mode;
    assert.ok(['won', 'lost'].includes(result));
    const name = result === 'lost' ? 'game-over' : 'victory',
      frame = result === 'lost' ? 7 : 10,
      end = result === 'lost' ? 50 : 40;
    assert.equal(sounds.filter((s) => s === name).length, 0);
    ticks(c, frame - 1);
    assert.equal(sounds.filter((s) => s === name).length, 1);
    ticks(c, end - frame);
    const final = c.getSnapshot().game;
    c.history();
    assert.equal(c.getSnapshot().mode, 'history');
    assert.deepEqual(c.publicState().validAttacks, []);
    for (let i = 0; c.getSnapshot().frame !== 20; i++) {
      c.tick();
      assert.ok(i < 100000);
    }
    assert.deepEqual(c.getSnapshot().game.territories, final.territories);
    assert.equal(c.getSnapshot().replayIndex, final.events.length + 1);
    c.title();
    ticks(c, 100);
    assert.equal(c.getSnapshot().mode, 'title');
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MapGenerator,
  placeInitialDice,
  acceptMap,
  seededRandom,
  createGame,
  pickAiAttack,
  aiPolicy,
  playerStates,
  prepareBattle,
  applyBattle,
  gameResult,
  startSupply,
  supplyOne,
  advanceTurn,
  endTurn,
  startHistory,
  applyHistoryEvent,
} from '../app/game-engine.ts';
const fixtures = JSON.parse(
  readFileSync(
    new URL('../docs/flash-reference/map-fixtures.json', import.meta.url),
  ),
);
const oracle = JSON.parse(
  readFileSync(
    new URL('../docs/flash-reference/oracle-report.json', import.meta.url),
  ),
);
function compare(game, expected) {
  assert.deepEqual(game.cellTerritory, expected.cells);
  for (const t of expected.territories.filter((t) => t.size)) {
    const { cells: _, ...actual } = game.territories[t.id];
    assert.deepEqual(actual, t);
  }
  assert.deepEqual(game.turnOrder, expected.turnOrder);
}
for (const fixture of fixtures.fixtures)
  test(`${fixture.playerCount} players: exact original map, outlines, order and RNG draws`, () => {
    const rng = seededRandom(fixture.seed);
    let calls = 0;
    const random = () => {
      calls++;
      return rng();
    };
    const generator = new MapGenerator(random);
    const preview = generator.preview(fixture.playerCount);
    assert.deepEqual(preview.turnOrder, []);
    const game = acceptMap(preview, random);
    compare(game, fixture);
    assert.equal(calls, fixture.rngCalls);
  });
test('persistent priority across accepted map and reroll', () => {
  let calls = 0;
  const rng = seededRandom(17),
    random = () => {
      calls++;
      return rng();
    };
  const generator = new MapGenerator(random);
  const initial = acceptMap(generator.preview(7), random);
  const reroll = generator.preview(7);
  compare(
    { ...reroll, turnOrder: initial.turnOrder },
    fixtures.reroll.secondMap,
  );
  assert.equal(calls, fixtures.reroll.secondMap.rngCalls);
});
function scenario(areas, owner = 0) {
  const game = createGame(8, seededRandom(1));
  game.territories = game.territories.map((t) => ({
    ...t,
    size: 0,
    owner: -1,
    dice: 0,
    neighbors: [],
  }));
  for (const a of areas)
    Object.assign(game.territories[a.id], {
      ...a,
      size: 6,
      neighbors: a.neighbors ?? [],
    });
  game.players = playerStates(game.territories);
  game.turnOrder = [0, 1, 2, 3, 4, 5, 6, 7];
  game.turnIndex = owner;
  return game;
}
for (const probe of oracle.aiProbes)
  test(`original AI: ${probe.name}`, () => {
    const game = scenario(probe.areas, probe.currentPlayer);
    let calls = 0;
    const random = () => {
      assert.ok(calls < probe.randomValues.length);
      return probe.randomValues[calls++];
    };
    assert.deepEqual(aiPolicy(game).rank, probe.rank);
    assert.deepEqual(pickAiAttack(game, random), probe.move);
    assert.equal(calls, probe.calls);
  });
test('strict 40% and last qualifying ID dominance', () => {
  assert.equal(
    aiPolicy(
      scenario([
        { id: 1, owner: 0, dice: 4 },
        { id: 2, owner: 1, dice: 3 },
        { id: 3, owner: 2, dice: 3 },
      ]),
    ).dominant,
    -1,
  );
  assert.equal(
    aiPolicy(
      scenario([
        { id: 1, owner: 0, dice: 5 },
        { id: 2, owner: 1, dice: 4 },
        { id: 3, owner: 2, dice: 0 },
      ]),
    ).dominant,
    1,
  );
});
test('roll preparation leaves displayed map unchanged; ties defend; stale resolution rejected', () => {
  const game = scenario([
    { id: 1, owner: 0, dice: 2, neighbors: [2] },
    { id: 2, owner: 1, dice: 2 },
  ]);
  const before = structuredClone(game);
  const battle = prepareBattle(game, 1, 2, () => 0);
  assert.deepEqual(game, before);
  assert.equal(battle.won, false);
  const next = applyBattle(game, battle);
  assert.equal(next.territories[1].dice, 1);
  assert.equal(next.territories[2].owner, 1);
  assert.equal(next.events.length, 1);
  assert.throws(() => applyBattle(next, battle), /Stale/);
});
test('human elimination is game over with multiple surviving AIs', () => {
  const game = scenario(
    [
      { id: 1, owner: 1, dice: 3, neighbors: [2] },
      { id: 2, owner: 0, dice: 1 },
      { id: 3, owner: 2, dice: 3 },
    ],
    1,
  );
  const battle = prepareBattle(game, 1, 2, () => 0.5);
  const next = applyBattle(game, battle);
  assert.equal(gameResult(next), 'lost');
  assert.equal(next.players.filter((p) => p.connected).length, 2);
  assert.equal(next.territories[2].dice, 2);
});
test('largest connected group, full-territory reserve carry/cap and eliminated turn skipping', () => {
  let game = scenario([
    { id: 1, owner: 0, dice: 8, neighbors: [2] },
    { id: 2, owner: 0, dice: 8, neighbors: [1] },
    { id: 3, owner: 0, dice: 8 },
    { id: 4, owner: 2, dice: 1 },
  ]);
  assert.equal(game.players[0].connected, 2);
  game.players[0].stock = 63;
  game = startSupply(game);
  assert.equal(game.players[0].stock, 64);
  const step = supplyOne(game, () => {
    throw Error('No RNG for full territory');
  });
  assert.equal(step.id, null);
  assert.equal(step.game.players[0].stock, 64);
  assert.equal(advanceTurn(game).turnIndex, 2);
});
for (let count = 2; count <= 8; count++)
  test(`${count} players: three complete deterministic games and event replay`, () => {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = seededRandom(seed);
      let game = createGame(count, rng),
        turns = 0;
      // Numeric stress simulation: drive human with AI and continue after human loss.
      // Animation RNG is deliberately omitted; this is not a runtime campaign golden.
      while (
        game.players.filter((p) => p.connected).length > 1 &&
        turns < 2000
      ) {
        for (let battleCount = 0; battleCount < 10000; battleCount++) {
          const pair = pickAiAttack(game, rng);
          if (!pair) break;
          game = applyBattle(game, prepareBattle(game, ...pair, rng));
          if (game.players.filter((p) => p.connected).length === 1) break;
          assert.ok(battleCount < 9999);
        }
        if (game.players.filter((p) => p.connected).length > 1)
          game = endTurn(game, rng).game;
        turns++;
        assert.ok(
          game.territories
            .filter((t) => t.size)
            .every((t) => t.dice >= 1 && t.dice <= 8),
        );
        assert.ok(game.players.every((p) => p.stock >= 0 && p.stock <= 64));
      }
      assert.ok(turns < 2000);
      let replay = startHistory(game);
      for (const event of game.events)
        replay = applyHistoryEvent(replay, event);
      assert.deepEqual(replay.territories, game.territories);
    }
  });

test('connected groups merge even a one-way historical adjacency', () => {
  const game = scenario([
    { id: 1, owner: 0, dice: 2 },
    { id: 2, owner: 0, dice: 2, neighbors: [1] },
  ]);
  assert.equal(game.players[0].connected, 2);
});

test('setup stops at the first owner without an eligible territory', () => {
  const game = scenario([
    { id: 1, owner: 0, dice: 1 },
    { id: 2, owner: 2, dice: 1 },
  ]);
  let calls = 0;
  placeInitialDice(game.territories, 3, () => {
    calls++;
    return 0;
  });
  assert.equal(calls, 1);
  assert.equal(game.territories[1].dice, 2);
  assert.equal(game.territories[2].dice, 1);
});
for (const stock of [0, 1, 64])
  test(`${stock} stock dice are placed individually in ascending eligible order`, () => {
    const areas = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      owner: 0,
      dice: 1,
      neighbors: i < 9 ? [i + 2] : [],
    }));
    let game = scenario([...areas, { id: 11, owner: 1, dice: 1 }]);
    game.players[0].stock = stock;
    let calls = 0;
    for (let i = 0; i < stock; i++) {
      const step = supplyOne(game, () => {
        calls++;
        return 0;
      });
      assert.equal(step.id, Math.floor(i / 7) + 1);
      game = step.game;
      assert.equal(game.events.length, i + 1);
      assert.equal(game.players[0].stock, stock - i - 1);
    }
    assert.equal(
      supplyOne(game, () => {
        throw Error('Empty stock must not draw');
      }).id,
      null,
    );
    assert.equal(calls, stock);
  });

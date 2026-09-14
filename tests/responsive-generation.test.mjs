import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_COUNT,
  CLASSIC_GRID,
  MapGenerator,
  acceptMap,
  applyBattle,
  applyHistoryEvent,
  cellEdge,
  cellPolygon,
  endTurn,
  gridForColumns,
  neighborOf,
  pickAiAttack,
  prepareBattle,
  seededRandom,
  startHistory,
  territoryPath,
} from '../app/game-engine.ts';
import { GameController } from '../app/game-controller.ts';
import { gridForViewport, mapBounds } from '../app/game-layout.ts';
import { interiorHexPath } from '../app/game-presentation.ts';

test('grid selection matches portrait, square and landscape rectangles with a fixed cell budget', () => {
  const shapes = [
    [370, 590],
    [600, 600],
    [830, 262],
  ].map(([w, h]) => gridForViewport(w, h));
  assert.ok(shapes[0].columns < shapes[1].columns);
  assert.ok(shapes[1].columns < shapes[2].columns);
  for (let i = 0; i < shapes.length; i++) {
    const grid = shapes[i];
    assert.equal(grid.rows, Math.ceil(896 / grid.columns));
    assert.ok(Object.isFrozen(grid));
    assert.ok(grid.columns * grid.rows >= CELL_COUNT);
    assert.ok(grid.columns * (grid.rows - 1) < CELL_COUNT);
    const [w, h] = [
      [370, 590],
      [600, 600],
      [830, 262],
    ][i];
    assert.deepEqual(gridForViewport(w * 2, h * 2), grid);
  }
  assert.deepEqual(gridForViewport(0, 0), CLASSIC_GRID);
  assert.deepEqual(gridForViewport(Infinity, 300), CLASSIC_GRID);
});

test('every supported grid has shared hex edges and no row-wrap or phantom last-row cells', () => {
  for (let columns = 12; columns <= 64; columns++) {
    const grid = gridForColumns(columns);
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      for (let d = 0; d < 6; d++) {
        const next = neighborOf(cell, d, grid);
        if (next === -1) continue;
        assert.ok(next >= 0 && next < 896 && next !== cell);
        const opposite = (d + 3) % 6;
        assert.equal(neighborOf(next, opposite, grid), cell);
        const [x1, y1, x2, y2] = cellEdge(cell, d, grid);
        assert.deepEqual(cellEdge(next, opposite, grid), [x2, y2, x1, y1]);
      }
    }
    assert.equal(neighborOf(columns - 1, 1, grid), -1);
    assert.equal(neighborOf(895, 2, grid), -1);
    assert.equal(neighborOf(895, 3, grid), -1);
  }
});

for (let count = 2; count <= 8; count++) {
  test(`${count} players: adaptive grids preserve territory invariants and complete games with exact replay`, () => {
    const rng = seededRandom(count),
      generator = new MapGenerator(rng);
    // Reuse the same 896-element permutation when alternating board shapes.
    const permutation = generator.priority;
    for (const columns of [14, 18, 26, 32, 44, 64]) {
      let game = acceptMap(
        generator.preview(count, gridForColumns(columns)),
        rng,
      );
      assert.equal(generator.priority, permutation);
      assert.deepEqual(
        [...permutation].sort((a, b) => a - b),
        Array.from({ length: 896 }, (_, i) => i),
      );
      assert.equal(game.cellTerritory.length, 896);
      assert.equal(game.territories.length, 32);
      assert.equal(
        game.players.slice(0, count).every((p) => p.connected > 0),
        true,
      );
      const geometry = game.grid,
        cells = game.cellTerritory;
      const bounds = mapBounds(game.territories, game.grid);
      for (const t of game.territories.filter((t) => t.size)) {
        assert.equal(t.cells.length, t.size);
        assert.ok(t.id > 0 && t.id <= 31);
        assert.ok(t.owner >= 0 && t.owner < count);
        assert.ok(t.cells.includes(t.centerCell));
        const found = new Set([t.cells[0]]),
          queue = [...found];
        for (const cell of queue) {
          assert.equal(cells[cell], t.id);
          for (let d = 0; d < 6; d++) {
            const next = neighborOf(cell, d, geometry);
            if (cells[next] === t.id && !found.has(next)) {
              found.add(next);
              queue.push(next);
            }
          }
          for (const p of cellPolygon(cell, geometry).split(' ')) {
            const [x, y] = p.split(',').map(Number);
            assert.ok(
              x + 26.25 >= bounds.x && x + 26.25 <= bounds.x + bounds.width,
            );
            assert.ok(
              y + 68.5 >= bounds.y && y + 68.5 <= bounds.y + bounds.height,
            );
          }
        }
        assert.equal(found.size, t.size);
        assert.ok(territoryPath(t, geometry).startsWith('M'));
        assert.ok(!territoryPath(t, geometry).includes('NaN'));
        assert.ok(!interiorHexPath(t, geometry).includes('NaN'));
      }
      let turns = 0;
      // Numeric stress run: AI controls everyone, including after human loss.
      // Animation RNG is omitted; this is a completion check, not a Flash golden.
      while (
        game.players.filter((p) => p.connected).length > 1 &&
        turns < 2000
      ) {
        for (let attacks = 0; attacks < 10000; attacks++) {
          const move = pickAiAttack(game, rng);
          if (!move) break;
          game = applyBattle(game, prepareBattle(game, ...move, rng));
          if (game.players.filter((p) => p.connected).length === 1) break;
          assert.ok(attacks < 9999);
        }
        if (game.players.filter((p) => p.connected).length > 1)
          game = endTurn(game, rng).game;
        turns++;
        assert.equal(game.grid, geometry);
        assert.equal(game.cellTerritory, cells);
        assert.ok(
          game.territories
            .filter((t) => t.size)
            .every((t) => t.dice >= 1 && t.dice <= 8),
        );
        assert.ok(game.players.every((p) => p.stock >= 0 && p.stock <= 64));
      }
      assert.ok(turns < 2000, `grid ${columns}: game did not complete`);
      let replay = startHistory(game);
      for (const event of game.events)
        replay = applyHistoryEvent(replay, event);
      assert.deepEqual(replay.territories, game.territories);
      assert.equal(replay.grid, geometry);
      assert.deepEqual(mapBounds(replay.territories, geometry), bounds);
    }
  });
}

test('preview resize coalesces on the next build tick; acceptance locks the exact displayed map', () => {
  let draws = 0;
  const rng = seededRandom(4),
    c = new GameController(() => {
      draws++;
      return rng();
    });
  c.title();
  c.setPreviewGrid(gridForViewport(370, 590));
  c.preview();
  c.tick();
  const first = c.getSnapshot().game;
  c.setPreviewGrid(gridForViewport(830, 262));
  assert.equal(c.getSnapshot().mode, 'building');
  const before = draws;
  c.setPreviewGrid(gridForColumns(40));
  c.setPreviewGrid(gridForColumns(42));
  assert.equal(draws, before);
  c.accept();
  assert.equal(
    c.getSnapshot().mode,
    'building',
    'cannot accept a stale map during regeneration',
  );
  c.tick();
  const preview = c.getSnapshot().game;
  assert.equal(preview.grid.columns, 42);
  assert.notDeepEqual(preview.cellTerritory, first.cellTerritory);
  c.accept();
  const accepted = c.getSnapshot(),
    acceptedDraws = draws;
  assert.equal(accepted.game.grid, preview.grid);
  assert.equal(accepted.game.cellTerritory, preview.cellTerritory);
  for (const columns of [12, 32, 64, 20]) {
    c.setPreviewGrid(gridForColumns(columns));
    c.accept();
  }
  assert.equal(c.getSnapshot(), accepted);
  assert.equal(draws, acceptedDraws);
  c.startNewGame(8);
  assert.equal(
    c.getSnapshot().game.grid.columns,
    20,
    'tool bypass uses the current preferred shape',
  );
});

test('resizing through a confirmed human/AI cycle cannot consume RNG or change timing and geometry', () => {
  const make = () => {
    let draws = 0;
    const rng = seededRandom(4);
    const c = new GameController(() => {
      draws++;
      return rng();
    });
    c.setPreviewGrid(gridForColumns(18));
    c.startNewGame(7);
    return { c, draws: () => draws };
  };
  const resized = make(),
    control = make();
  let attacked = false,
    supplied = false,
    returned = false;
  for (let tick = 0; tick < 20000; tick++) {
    const s = resized.c.getSnapshot();
    resized.c.setPreviewGrid(gridForColumns(12 + (tick % 53)));
    assert.equal(resized.c.getSnapshot(), s);
    assert.deepEqual(s, control.c.getSnapshot());
    assert.equal(resized.draws(), control.draws());
    assert.equal(s.game.grid.columns, 18);
    if (s.phase === 'source') {
      if (!attacked) {
        const move = resized.c.publicState().validAttacks[0];
        assert.ok(move);
        for (const run of [resized, control]) run.c.attack(move.from, move.to);
        assert.throws(() => resized.c.attack(move.from, move.to));
        attacked = true;
      } else if (!supplied) {
        for (const run of [resized, control]) run.c.endTurn();
        supplied = true;
      } else {
        returned = true;
        break;
      }
    }
    resized.c.tick();
    control.c.tick();
  }
  assert.ok(attacked && supplied && returned);
});

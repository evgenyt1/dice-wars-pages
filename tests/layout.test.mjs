import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MapGenerator,
  cellPolygon,
  cellOrigin,
  seededRandom,
  gridForColumns,
  CLASSIC_GRID,
} from '../app/game-engine.ts';
import { GameController } from '../app/game-controller.ts';
import { mapBounds } from '../app/game-layout.ts';

const manifest = JSON.parse(
  readFileSync(
    new URL(
      '../docs/flash-reference/native-art-manifest.json',
      import.meta.url,
    ),
  ),
);

test('camera contains all hexes and the full registered stack canvas, including edge cells', () => {
  const maps = [];
  for (let count = 2; count <= 8; count++) {
    const generator = new MapGenerator(seededRandom(count));
    for (let i = 0; i < 10; i++)
      maps.push(
        generator.preview(
          count,
          gridForColumns([14, 18, 26, 32, 44, 64][i % 6]),
        ),
      );
  }
  // Explicitly exercise every possible edge registration, including cell zero.
  maps.push({
    grid: CLASSIC_GRID,
    territories: [0, 31, 864, 895].map((cell, id) => ({
      id,
      size: 1,
      cells: [cell],
      centerCell: cell,
    })),
  });
  for (const { territories, grid } of maps) {
    const camera = mapBounds(territories, grid);
    const inside = (x, y) => {
      assert.ok(
        x >= camera.x && x <= camera.x + camera.width,
        `clipped x ${x}`,
      );
      assert.ok(
        y >= camera.y && y <= camera.y + camera.height,
        `clipped y ${y}`,
      );
    };
    for (const t of territories.filter((t) => t.size)) {
      for (const cell of t.cells) {
        for (const point of cellPolygon(cell, grid).split(' ')) {
          const [x, y] = point.split(',').map(Number);
          inside(x + 26.25, y + 68.5);
        }
      }
      const [x, y] = cellOrigin(t.centerCell, grid);
      for (let dice = 1; dice <= 8; dice++) {
        const art = manifest.assets[`s124-f${dice}`];
        for (const sx of [art.x, art.x + art.width]) {
          for (const sy of [art.y, art.y + art.height]) {
            // Independent source-art registration plus approved display scale.
            const px = x + 26.25 + 0.80233765 * (22.75 + 1.18 * (sx - 22.75));
            const py = y + 68.5 + 0.80233765 * (28.75 + 1.18 * (sy - 28.75));
            inside(px - 3, py - 8); // focus shadow and selection/settle lift
            inside(px + 3, py + 3);
          }
        }
      }
    }
    const allFull = territories.map((t) => ({ ...t, dice: 8, owner: 0 }));
    assert.deepEqual(
      mapBounds(allFull, grid),
      camera,
      'ownership and stack size must not move the camera',
    );
  }
});

test('layout reads preserve campaign, RNG, selections, battle and reinforcement timing', () => {
  const make = () => {
    let draws = 0;
    const random = seededRandom(4);
    const controller = new GameController(() => {
      draws++;
      return random();
    });
    controller.startNewGame(8);
    return { controller, draws: () => draws };
  };
  const resized = make(),
    control = make();
  const originalBounds = mapBounds(
    resized.controller.getSnapshot().game.territories,
  );
  const originalCells = resized.controller.getSnapshot().game.cellTerritory;
  let attacked = false,
    supplied = false,
    returned = false;
  for (let tick = 0; tick < 20000; tick++) {
    const snapshot = resized.controller.getSnapshot();
    const draws = resized.draws();
    // Many layout reads between controller ticks model resize/re-render bursts.
    for (let i = 0; i < 3; i++)
      assert.deepEqual(mapBounds(snapshot.game.territories), originalBounds);
    assert.equal(resized.controller.getSnapshot(), snapshot);
    assert.equal(resized.draws(), draws);
    assert.equal(snapshot.game.cellTerritory, originalCells);
    assert.deepEqual(snapshot, control.controller.getSnapshot());
    assert.equal(resized.draws(), control.draws());
    if (snapshot.phase === 'source') {
      if (!attacked) {
        const move = resized.controller.publicState().validAttacks[0];
        assert.ok(move);
        for (const run of [resized, control])
          run.controller.attack(move.from, move.to);
        attacked = true;
      } else if (!supplied) {
        for (const run of [resized, control]) run.controller.endTurn();
        supplied = true;
      } else {
        returned = true;
        break;
      }
    }
    resized.controller.tick();
    control.controller.tick();
  }
  assert.ok(
    attacked && supplied && returned,
    'complete human battle / supply / AI / human cycle',
  );
});

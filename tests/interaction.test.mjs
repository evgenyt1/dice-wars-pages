import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../app/game-controller.ts';
import { GameInteraction } from '../app/game-interaction.ts';
import { seededRandom } from '../app/game-engine.ts';
import {
  interiorHexPath,
  PLAYER_PALETTE,
  THEMES,
  playerTerritoryLabel,
} from '../app/game-presentation.ts';

function setup() {
  const controller = new GameController(seededRandom(4));
  const input = new GameInteraction(controller);
  input.startNewGame(7);
  for (let i = 0; controller.getSnapshot().phase !== 'source'; i++) {
    controller.tick();
    assert.ok(i < 20000);
  }
  return { controller, input };
}

test('leave confirmation synchronously gates UI and model moves and restores selection', () => {
  const { controller, input } = setup();
  const { from, to } = input.publicState().validAttacks[0];
  input.territory(from);
  const selected = controller.getSnapshot();
  input.confirmationOpen = true;
  assert.equal(input.publicState().confirmation, 'leave-game');
  assert.deepEqual(input.publicState().validSources, []);
  assert.deepEqual(input.publicState().validAttacks, []);
  assert.equal(input.publicState().canEndTurn, false);
  input.territory(to);
  input.endTurn();
  assert.throws(() => input.attack(from, to), /confirmation/);
  assert.equal(controller.getSnapshot(), selected);
  input.confirmationOpen = false;
  assert.deepEqual(input.publicState().validSources, [from]);
  assert.equal(input.attack(from, to).status, 'rolling');
  assert.throws(() => input.attack(from, to));
});

test('confirmation never delays battle, reinforcement, AI, RNG, or sound cues', () => {
  const first = setup(),
    second = setup();
  const { from, to } = first.input.publicState().validAttacks[0];
  for (const run of [first, second]) run.input.attack(from, to);
  first.input.confirmationOpen = true;
  for (let i = 0; first.controller.getSnapshot().phase === 'battle'; i++) {
    first.controller.tick();
    second.controller.tick();
    assert.deepEqual(
      first.controller.getSnapshot(),
      second.controller.getSnapshot(),
    );
    assert.ok(i < 100);
  }
  first.input.confirmationOpen = false;
  first.input.endTurn();
  second.input.endTurn();
  first.input.confirmationOpen = true;
  for (let i = 0; first.controller.getSnapshot().phase !== 'source'; i++) {
    first.controller.tick();
    second.controller.tick();
    assert.deepEqual(
      first.controller.getSnapshot(),
      second.controller.getSnapshot(),
    );
    assert.ok(i < 20000);
  }
});

test('new game or completed campaign cannot leave the interaction gate stuck', () => {
  const { controller, input } = setup();
  input.confirmationOpen = true;
  input.startNewGame(2);
  assert.equal(input.confirmationOpen, false);
  assert.equal(controller.getSnapshot().game.playerCount, 2);
  input.confirmationOpen = true;
  controller.title();
  assert.equal(input.blocked, false);
  assert.equal(input.publicState().confirmation, null);
});

test('presentation reports original violet human identity without changing engine ownership', () => {
  const { controller, input } = setup();
  const before = controller.getSnapshot();
  const state = input.publicState();
  assert.equal(state.humanPlayer, 0);
  assert.deepEqual(state.playerPalette, PLAYER_PALETTE);
  assert.equal(state.playerPalette[0].name, 'Violet');
  const human = before.game.territories.find((t) => t.size && t.owner === 0);
  assert.match(playerTerritoryLabel(before.game, human.id), /You, Violet/);
  assert.equal(controller.getSnapshot(), before);
});

test('hex detailing draws only shared interior edges and never changes cells', () => {
  const territory = { cells: [20, 21] };
  assert.equal(interiorHexPath(territory), 'M483,3L483,11');
  assert.equal(interiorHexPath({ cells: [20] }), '');
  assert.equal(interiorHexPath({ cells: [20, 22] }), '');
  assert.deepEqual(territory.cells, [20, 21]);
});

test('theme switches preserve selection, battle timing, RNG, reinforcement and AI state', () => {
  const first = setup(),
    second = setup();
  const checkSwitch = () => {
    const before = first.controller.getSnapshot();
    const legal = first.input.publicState();
    for (const theme of ['midnight', 'original', 'midnight']) {
      first.input.setTheme(theme);
      const shown = first.input.publicState();
      assert.equal(shown.theme, theme);
      assert.deepEqual(shown.playerPalette, THEMES[theme].palette);
      assert.deepEqual(shown.validAttacks, legal.validAttacks);
      assert.deepEqual(shown.validSources, legal.validSources);
      assert.equal(shown.canEndTurn, legal.canEndTurn);
      assert.equal(first.controller.getSnapshot(), before);
      const human = before.game.territories.find(
        (t) => t.size && t.owner === 0,
      );
      if (human)
        assert.ok(
          playerTerritoryLabel(before.game, human.id, theme).includes(
            `You, ${THEMES[theme].palette[0].name}`,
          ),
        );
    }
  };
  const { from, to } = first.input.publicState().validAttacks[0];
  for (const run of [first, second]) run.input.territory(from);
  checkSwitch();
  for (const run of [first, second]) run.input.attack(from, to);
  const tick = () => {
    checkSwitch();
    first.controller.tick();
    second.controller.tick();
    assert.deepEqual(
      first.controller.getSnapshot(),
      second.controller.getSnapshot(),
    );
  };
  for (let i = 0; first.controller.getSnapshot().phase === 'battle'; i++) {
    tick();
    assert.ok(i < 100);
  }
  first.input.endTurn();
  second.input.endTurn();
  for (let i = 0; first.controller.getSnapshot().phase !== 'source'; i++) {
    tick();
    assert.ok(i < 20000);
  }
});

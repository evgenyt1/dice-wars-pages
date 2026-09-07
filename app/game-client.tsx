'use client';
/* SVG has no native button; transformed original vector paths are the hit regions. */
/* eslint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  art,
  Digits,
  FlashButton,
  Scene,
  TitleArt,
  Transform,
  Vector,
} from './flash-art';
import {
  cellOrigin,
  currentPlayer,
  PLAYER_COLORS,
  territoryLabel,
  territoryPath,
} from './game-engine';
import { GameController, INITIAL_VIEW } from './game-controller';
import type { ViewState } from './game-controller';
import { GameAudio } from './game-audio';
import type { GameState } from './game-engine';

function MapBoard({
  game,
  state,
  controller,
}: {
  game: GameState;
  state: ViewState;
  controller: GameController;
}) {
  const sources = controller.availableSources(),
    targets = controller.availableTargets();
  const active = game.territories.filter((t) => t.size);
  const shapeOrder = [
    ...active.filter((t) => t.id !== state.selected && t.id !== state.target),
    ...active.filter((t) => t.id === state.selected),
    ...active.filter((t) => t.id === state.target),
  ];
  const handlers = (id: number, stack = false) => {
    const enabled = sources.includes(id) || targets.includes(id);
    return {
      className: enabled ? 'territory-control' : undefined,
      role: enabled && !stack ? 'button' : undefined,
      tabIndex: enabled && !stack ? 0 : undefined,
      'aria-label': !stack ? territoryLabel(game, id) : undefined,
      onPointerDown: enabled
        ? (e: React.PointerEvent<SVGElement>) => {
            if (e.button === 0) controller.territory(id);
          }
        : undefined,
      onKeyDown: enabled
        ? (e: React.KeyboardEvent<SVGElement>) => {
            if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
              e.preventDefault();
              controller.territory(id);
            }
          }
        : undefined,
    };
  };
  return (
    <g transform="translate(26.25 68.5)" aria-label="Territory map">
      <g>
        {shapeOrder.map((t) => (
          <path
            key={t.id}
            data-territory={t.id}
            d={territoryPath(t)}
            fill={
              t.id === state.selected || t.id === state.target
                ? '#000000'
                : PLAYER_COLORS[t.owner]
            }
            stroke={
              t.id === state.selected || t.id === state.target
                ? '#ff0000'
                : '#222244'
            }
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            {...handlers(t.id)}
          />
        ))}
      </g>
      <g aria-hidden="true">
        {[...active]
          .sort((a, b) => a.centerCell - b.centerCell)
          .map((t) => {
            const [x, y] = cellOrigin(t.centerCell);
            return (
              <g
                key={t.id}
                transform={`translate(${x} ${y}) scale(.80233765)`}
                {...handlers(t.id, true)}
              >
                <use
                  href={`./game-assets/vector/symbols.svg#vs124-f${t.owner * 10 + t.dice}`}
                  pointerEvents="visiblePainted"
                />
              </g>
            );
          })}
      </g>
    </g>
  );
}
function Hud({ game }: { game: GameState }) {
  const living = game.turnOrder.filter((id) => game.players[id].connected > 0);
  return (
    <g aria-label="Player connected groups">
      {living.map((id, i) => (
        <g
          key={id}
          transform={`translate(${400 - (living.length - 1) * 50 + i * 100} 568)`}
        >
          <Scene
            id={141}
            frame={currentPlayer(game) === id ? 2 : 1}
            render={(p) => {
              if (p.characterId === 43)
                return <Vector symbol={`s43-f${id * 10 + 1}`} />;
              if (p.characterId === 139)
                return (
                  <Digits field={139} value={game.players[id].connected} />
                );
            }}
          />
        </g>
      ))}
    </g>
  );
}
function BattleStrip({ state }: { state: ViewState }) {
  if (!state.battle) return null;
  const battle = state.battle;
  return (
    <g aria-label="Battle rolls">
      {art.rollPlacements.map((p) => {
        if (p.characterId === 43) {
          const [side, index] = p.name!.slice(4).split('_').map(Number);
          const face = state.rolls[side][index];
          if (!face) return null;
          const owner = side === 0 ? battle.attacker : battle.defender;
          return (
            <Transform key={p.depth} matrix={p.matrix}>
              <Vector symbol={`s43-f${owner * 10 + face}`} />
            </Transform>
          );
        }
        const side = p.name === 'tf0' ? 0 : 1;
        const total = state.totals[side];
        if (total === null) return null;
        const matrix = [...p.matrix];
        matrix[4] =
          side === 0
            ? 418 + 35 * battle.attackerRolls.length
            : 322 - 35 * battle.defenderRolls.length;
        return (
          <Transform key={p.depth} matrix={matrix}>
            <Digits field={p.characterId} value={total} />
          </Transform>
        );
      })}
    </g>
  );
}
const placement = (id: number) =>
  art.placements.find((p) => p.characterId === id)!;
interface BrowserTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (
    tool: BrowserTool,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
}

export default function GameClient() {
  const [audio] = useState(() => new GameAudio());
  const [controller] = useState(
    () => new GameController(Math.random, audio.play),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    () => INITIAL_VIEW,
  );
  const [loadError, setLoadError] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    const stop = controller.runClock(
      requestAnimationFrame,
      cancelAnimationFrame,
    );
    let live = true;
    void audio
      .load(controller.progress)
      .then(() => {
        if (live) {
          controller.ready();
          change();
        }
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
      stop();
      media.removeEventListener('change', change);
    };
  }, [audio, controller]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const register = (tool: BrowserTool) => {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => undefined);
    };
    register({
      name: 'get_game_state',
      title: 'Get game state',
      description:
        'Read displayed Dice Wars state and only currently legal human actions.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => controller.publicState(),
    });
    register({
      name: 'start_new_game',
      title: 'Start new Dice Wars game',
      description:
        'Start a native 2–8 player game. Explicit tool-only convenience that bypasses map preview and cancels the old campaign.',
      inputSchema: {
        type: 'object',
        properties: {
          playerCount: { type: 'integer', minimum: 2, maximum: 8 },
        },
        required: ['playerCount'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) =>
        controller.startNewGame((input as { playerCount: number }).playerCount),
    });
    register({
      name: 'attack_territory',
      title: 'Attack territory',
      description:
        'Perform the same source and target presses as the human UI. During target selection only the selected source is legal. Returns rolling; read state after the animation.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'integer', minimum: 1, maximum: 31 },
          to: { type: 'integer', minimum: 1, maximum: 31 },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const { from, to } = input as { from: number; to: number };
        return controller.attack(from, to);
      },
    });
    return () => lifecycle.abort();
  }, [controller]);
  const press = () => controller.sound('button');
  const resultFrame = reduced ? (state.mode === 'lost' ? 50 : 40) : state.frame;
  const renderResult = (id: number) => (
    <Transform matrix={placement(id).matrix}>
      <Scene
        id={id}
        frame={resultFrame}
        render={(p) => {
          if (
            [156, 158].includes(p.characterId) &&
            state.frame < (state.mode === 'lost' ? 50 : 40)
          )
            return null;
          if (p.characterId === 155 || p.characterId === 157) {
            if (state.frame < (state.mode === 'lost' ? 50 : 40)) return null;
            return (
              <FlashButton
                id={p.characterId}
                label={p.characterId === 155 ? 'Title' : 'History'}
                press={press}
                action={
                  p.characterId === 155 ? controller.title : controller.history
                }
              />
            );
          }
          if (
            p.characterId === 162 &&
            !reduced &&
            [13, 16, 19].includes(state.frame)
          )
            return null;
        }}
      />
    </Transform>
  );
  return (
    <main
      className="game-shell"
      onPointerDownCapture={audio.unlock}
      onKeyDownCapture={(e) => {
        audio.unlock();
        if (e.key === 'Escape') controller.cancel();
      }}
    >
      <svg
        className="classic-stage"
        viewBox="0 0 800 600"
        role="group"
        aria-label="Dice Wars"
        data-mode={state.mode}
        data-phase={state.phase}
      >
        <title>Dice Wars</title>
        {state.mode === 'loading' && (
          <g
            opacity={
              state.loaded === 100 ? Math.max(0, 1 - (state.frame - 1) / 5) : 1
            }
          >
            <Transform matrix={[1, 0, 0, 1, 245.6, 274.4]}>
              <Scene
                id={11}
                render={(p) => {
                  if (p.characterId === 8)
                    return (
                      <g transform={`scale(${state.loaded / 100} 1)`}>
                        <Scene id={8} />
                      </g>
                    );
                  if (p.characterId === 10)
                    return (
                      <Digits
                        field={10}
                        value={`${Math.floor(state.loaded)}%`}
                        color="#999999"
                      />
                    );
                }}
              />
            </Transform>
          </g>
        )}
        {state.mode === 'title' && (
          <TitleArt
            count={state.count}
            dice={state.titleDice}
            choose={controller.chooseCount}
            play={controller.preview}
            press={press}
          />
        )}
        {state.game && state.mode !== 'building' && (
          <MapBoard game={state.game} state={state} controller={controller} />
        )}
        {['building', 'preview'].includes(state.mode) && (
          <Transform matrix={placement(134).matrix}>
            <Scene
              id={134}
              frame={state.mode === 'building' ? 1 : 3}
              render={(p) =>
                p.characterId === 130 ? (
                  <FlashButton
                    id={130}
                    label={p.name === 'btYes' ? 'Yes' : 'No'}
                    press={press}
                    action={
                      p.name === 'btYes'
                        ? controller.accept
                        : controller.preview
                    }
                  />
                ) : undefined
              }
            />
          </Transform>
        )}
        {state.game && ['playing', 'lost', 'won'].includes(state.mode) && (
          <Hud game={state.game} />
        )}
        {state.mode === 'playing' &&
          ['source', 'target'].includes(state.phase) &&
          art.placements
            .filter((p) => [130, 142, 143, 144].includes(p.characterId))
            .map((p) => (
              <Transform key={p.depth} matrix={p.matrix}>
                {p.characterId === 130 ? (
                  <FlashButton
                    id={130}
                    label="End Turn"
                    action={controller.endTurn}
                    press={press}
                  />
                ) : (
                  <Vector symbol={p.characterId} />
                )}
              </Transform>
            ))}
        {state.phase === 'battle' && (
          <BattleStrip
            state={
              reduced
                ? {
                    ...state,
                    rolls: state.rolls.map((r, i) =>
                      r.length
                        ? i === 0
                          ? state.battle!.attackerRolls
                          : state.battle!.defenderRolls
                        : r,
                    ),
                  }
                : state
            }
          />
        )}
        {state.phase === 'supply' && state.game && (
          <g aria-label="Reserve dice">
            {Array.from(
              { length: state.game.players[currentPlayer(state.game)].stock },
              (_, i) => (
                <g
                  key={i}
                  transform={`translate(${20 + (i % 32) * 24} ${490 + Math.floor(i / 32) * 28}) scale(.065582275)`}
                >
                  <Vector
                    symbol={`s43-f${currentPlayer(state.game!) * 10 + 2}`}
                  />
                </g>
              ),
            )}
          </g>
        )}
        {state.mode === 'lost' && renderResult(159)}
        {state.mode === 'won' && renderResult(163)}
        {state.mode === 'history' && (
          <Transform matrix={placement(169).matrix}>
            <Scene
              id={169}
              frame={20}
              render={(p) =>
                p.characterId === 168 ? (
                  <FlashButton
                    id={168}
                    label="GAMEDESIGN website"
                    action={() =>
                      window.open(
                        'http://www.gamedesign.jp/',
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  />
                ) : undefined
              }
            />
          </Transform>
        )}
        {!['title', 'loading'].includes(state.mode) && (
          <Transform matrix={placement(137).matrix}>
            <FlashButton
              id={137}
              label="Back to Title"
              action={controller.title}
            />
          </Transform>
        )}
      </svg>
      <div className="modern-controls">
        <button
          type="button"
          aria-pressed={state.sound}
          onClick={() => {
            controller.toggleSound();
            if (state.sound) audio.silence();
          }}
        >
          {state.sound ? 'Sound on' : 'Sound off'}
        </button>
      </div>
      <p
        className={loadError ? 'load-error' : 'sr-only'}
        role="status"
        aria-live="polite"
      >
        {loadError
          ? 'Unable to load artwork or sounds. Please reload.'
          : state.notice}
      </p>
    </main>
  );
}

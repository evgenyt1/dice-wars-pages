'use client';
/* SVG paths retain the original map hit regions; SVG has no native button. */
/* eslint-disable jsx-a11y/prefer-tag-over-role */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Home,
  Palette,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { art, Transform } from './flash-art';
import { cellOrigin, currentPlayer, territoryPath } from './game-engine';
import type { GameState } from './game-engine';
import { GameController, INITIAL_VIEW } from './game-controller';
import type { ViewState } from './game-controller';
import { GameAudio } from './game-audio';
import { GameInteraction } from './game-interaction';
import { autosave, loadSession, storeSession } from './game-session';
import { assetUrl } from './asset-url';
import {
  MAP_ORIGIN,
  STACK_BASE,
  STACK_DISPLAY_SCALE,
  STACK_SCALE,
  gridForViewport,
  mapBounds,
} from './game-layout';
import {
  THEMES,
  hudInk,
  interiorHexPath,
  playerTerritoryLabel,
} from './game-presentation';
import type { GameTheme } from './game-presentation';
import {
  Die,
  RollingDie,
  DiceStack,
  GameButton,
  MidnightTitle,
} from './midnight-art';

function MapBoard({
  game,
  state,
  input,
  theme,
  reduced,
}: {
  game: GameState;
  state: ViewState;
  input: GameInteraction;
  theme: GameTheme;
  reduced: boolean;
}) {
  const sources = input.blocked ? [] : input.controller.availableSources();
  const targets = input.blocked ? [] : input.controller.availableTargets();
  const active = game.territories.filter((t) => t.size);
  const clipId = useId().replaceAll(':', '');
  const hexes = useMemo(
    () =>
      game.territories
        .filter((t) => t.size)
        .map((t) => ({
          id: t.id,
          outline: territoryPath(t, game.grid),
          interior: interiorHexPath(t, game.grid),
        })),
    [game.territories, game.grid],
  );
  const shapes = [
    ...active.filter((t) => t.id !== state.selected && t.id !== state.target),
    ...active.filter((t) => t.id === state.selected),
    ...active.filter((t) => t.id === state.target),
  ];
  const handlers = (id: number, stack = false) => {
    const enabled = sources.includes(id) || targets.includes(id);
    return {
      className: `territory${enabled ? ' territory-control' : ''}${id === state.selected || id === state.target ? ' territory-selected' : ''}`,
      role: enabled && !stack ? 'button' : undefined,
      tabIndex: enabled && !stack ? 0 : undefined,
      'aria-label': !stack ? playerTerritoryLabel(game, id, theme) : undefined,
      // Click, not pointerdown: iOS can leave Pointer Events undelivered after a
      // backgrounded home-screen app resumes, while click keeps working (matching
      // every other control here, which all use onClick and stay responsive).
      onClick: enabled
        ? (e: React.MouseEvent<SVGElement>) => {
            if (e.button === 0) input.territory(id);
          }
        : undefined,
      onKeyDown: enabled
        ? (e: React.KeyboardEvent<SVGElement>) => {
            if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
              e.preventDefault();
              input.territory(id);
            }
          }
        : undefined,
    };
  };
  return (
    <g
      transform={`translate(${MAP_ORIGIN.x} ${MAP_ORIGIN.y})`}
      aria-label="Territory map"
    >
      <g className="map-fields">
        {shapes.map((t) => (
          <path
            key={t.id}
            data-territory={t.id}
            d={territoryPath(t, game.grid)}
            fill={
              t.id === state.selected || t.id === state.target
                ? THEMES[theme].selectedFill
                : THEMES[theme].palette[t.owner].color
            }
            stroke={
              t.id === state.selected || t.id === state.target
                ? THEMES[theme].selectedStroke
                : 'var(--dw-bg)'
            }
            strokeWidth={
              t.id === state.selected || t.id === state.target ? 2.5 : 1.6
            }
            strokeLinejoin="round"
            strokeLinecap="round"
            {...handlers(t.id)}
          />
        ))}
      </g>
      <g className="hex-contours" aria-hidden="true" pointerEvents="none">
        <defs>
          {hexes.map((t) => (
            <clipPath key={t.id} id={`${clipId}-area-${t.id}`}>
              <path d={t.outline} />
            </clipPath>
          ))}
        </defs>
        {hexes.map((t) => (
          <path
            key={t.id}
            d={t.interior}
            clipPath={`url(#${clipId}-area-${t.id})`}
          />
        ))}
      </g>
      <g aria-hidden="true">
        {[...active]
          .sort((a, b) => a.centerCell - b.centerCell)
          .map((t) => {
            const [x, y] = cellOrigin(t.centerCell, game.grid);
            return (
              <g
                key={t.id}
                transform={`translate(${x} ${y}) scale(${STACK_SCALE})`}
                {...handlers(t.id, true)}
              >
                <g className="stack-selection">
                  <g
                    transform={`translate(${STACK_BASE.x} ${STACK_BASE.y}) scale(${STACK_DISPLAY_SCALE}) translate(${-STACK_BASE.x} ${-STACK_BASE.y})`}
                  >
                    <DiceStack
                      owner={t.owner}
                      count={t.dice}
                      theme={theme}
                      reduced={reduced}
                    />
                  </g>
                </g>
              </g>
            );
          })}
      </g>
    </g>
  );
}

function Hud({ game, theme }: { game: GameState; theme: GameTheme }) {
  const living = game.turnOrder.filter((id) => game.players[id].connected > 0);
  return (
    <div className="player-hud" aria-label="Player connected groups">
      {living.map((id) => {
        const { name, color } = THEMES[theme].palette[id];
        // Reinforcement at end of turn equals the largest connected group.
        const dice = game.players[id].connected;
        const current = currentPlayer(game) === id;
        return (
          <div
            key={id}
            className={`hud-player${current ? ' active' : ''}`}
            title={`${name}${id === 0 ? ' (you)' : ''}: +${dice} dice at end of turn${current ? ' · Current turn' : ''}`}
            aria-label={`${name}${id === 0 ? ', you' : ''}: largest connected group ${dice}, gets ${dice} ${dice === 1 ? 'die' : 'dice'} at end of turn${current ? ', current turn' : ''}`}
          >
            <span
              className="hud-color"
              style={{ backgroundColor: color, color: hudInk(color) }}
              aria-hidden="true"
            >
              {dice}
            </span>
            {id === 0 && <small>YOU</small>}
          </div>
        );
      })}
    </div>
  );
}

function BattleStrip({
  state,
  theme,
  reduced,
}: {
  state: ViewState;
  theme: GameTheme;
  reduced: boolean;
}) {
  if (!state.battle) return null;
  const battle = state.battle;
  return (
    <g aria-label="Battle rolls" className="battle-strip">
      {art.rollPlacements.map((p) => {
        if (p.characterId === 43) {
          const [side, index] = p.name!.slice(4).split('_').map(Number),
            face = state.rolls[side][index];
          if (!face) return null;
          return (
            <Transform key={p.depth} matrix={p.matrix}>
              <RollingDie
                theme={theme}
                owner={side === 0 ? battle.attacker : battle.defender}
                face={face}
                reduced={reduced}
                duration={currentPlayer(state.game!) === 0 ? 80 : 40}
              />
            </Transform>
          );
        }
        const side = p.name === 'tf0' ? 0 : 1,
          total = state.totals[side];
        if (total === null) return null;
        return (
          <text
            className="battle-total"
            key={p.depth}
            x={
              side === 0
                ? 430 + 35 * battle.attackerRolls.length
                : 370 - 35 * battle.defenderRolls.length
            }
            y={515}
            textAnchor={side === 0 ? 'start' : 'end'}
          >
            {total}
          </text>
        );
      })}
    </g>
  );
}

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
  const [input] = useState(() => new GameInteraction(controller));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    () => INITIAL_VIEW,
  );
  const theme = useSyncExternalStore(
    input.subscribeTheme,
    input.getTheme,
    () => 'original' as const,
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dicefront-theme');
      if (saved === 'original' || saved === 'midnight') {
        input.setTheme(saved);
      }
    } catch {
      /* Storage may be unavailable in private or embedded browsers. */
    }
  }, [input]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEMES[theme].background);
  }, [theme]);
  const toggleTheme = () => {
    const next = input.getTheme() === 'original' ? 'midnight' : 'original';
    input.setTheme(next);
    try {
      localStorage.setItem('dicefront-theme', next);
    } catch {
      /* Switching still works without storage. */
    }
  };
  const [loadError, setLoadError] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const titlePlayRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const previousMode = useRef(state.mode);
  const showingBoard = !['loading', 'title'].includes(state.mode);
  const measureGrid = useCallback(() => {
    const board = boardRef.current;
    if (board && board.clientWidth > 0 && board.clientHeight > 0)
      return gridForViewport(board.clientWidth, board.clientHeight);
    // Model-tool preview bypass can start from the title before a board exists.
    const shell = shellRef.current;
    const panel = shell?.querySelector<HTMLElement>('.game-window');
    const style = shell ? getComputedStyle(shell) : null;
    const height =
      window.innerHeight -
      parseFloat(style?.paddingTop || '0') -
      parseFloat(style?.paddingBottom || '0');
    const header =
      panel?.querySelector('header')?.getBoundingClientRect().height ?? 74;
    return gridForViewport(
      panel?.clientWidth ?? window.innerWidth,
      height - header - 76,
    );
  }, []);
  useLayoutEffect(() => {
    const measure = () => controller.setPreviewGrid(measureGrid());
    const target = boardRef.current ?? shellRef.current;
    if (!target) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [controller, measureGrid, showingBoard]);
  const confirm = (open: boolean) => {
    input.setConfirmation(open);
    setExitOpen(open);
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener('change', change);
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Storage may be unavailable in private or embedded browsers. */
    }
    // Restored before loading completes, so the loader enters the saved screen.
    const saved = loadSession(storage);
    if (saved) controller.restore(saved);
    const saver = autosave(controller, (session) =>
      storeSession(storage, session),
    );
    const stop = controller.runClock(
      requestAnimationFrame,
      cancelAnimationFrame,
    );
    const pageHidden = () => {
      // iOS can end a backgrounded home-screen app without another event.
      saver.flush();
      audio.background();
    };
    const pageVisibility = () => {
      if (document.visibilityState === 'hidden') pageHidden();
      else if (controller.getSnapshot().sound) audio.recover();
    };
    document.addEventListener('visibilitychange', pageVisibility);
    window.addEventListener('pageshow', pageVisibility);
    window.addEventListener('pagehide', pageHidden);
    // Read-only audio diagnostics for Safari Web Inspector on a phone.
    (window as Window & { dicefrontAudio?: () => unknown }).dicefrontAudio =
      audio.status;
    let live = true;
    void audio
      .load(controller.progress)
      .then(() => {
        if (live) controller.ready();
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
      stop();
      saver.flush();
      saver.stop();
      audio.silence();
      document.removeEventListener('visibilitychange', pageVisibility);
      window.removeEventListener('pageshow', pageVisibility);
      window.removeEventListener('pagehide', pageHidden);
      media.removeEventListener('change', change);
    };
  }, [audio, controller]);
  useEffect(() => {
    // Offline play: the build generates sw.js with the complete app shell.
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return;
    void navigator.serviceWorker
      .register(assetUrl('sw.js'))
      .catch(() => undefined);
    // Ask the browser not to evict the saved game or offline cache under pressure.
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    // Screen changes restore keyboard focus without moving pointer focus every tick.
    if (previousMode.current !== state.mode && state.mode === 'title')
      titlePlayRef.current
        ?.querySelector<HTMLButtonElement>('.play-button')
        ?.focus({ preventScroll: true });
    previousMode.current = state.mode;
  }, [state.mode, input]);
  useEffect(
    () =>
      controller.subscribe(() => {
        if (
          controller.getSnapshot().mode !== 'playing' &&
          input.confirmationOpen
        ) {
          input.setConfirmation(false);
          setExitOpen(false);
        }
      }),
    [controller, input],
  );
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
        'Read displayed Dicefront state and only currently legal human actions, including open confirmations.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: input.publicState,
    });
    register({
      name: 'start_new_game',
      title: 'Start new Dicefront game',
      description:
        'Start a native 2–8 player game. Explicit tool-only convenience that bypasses map preview and cancels the old campaign and open confirmation.',
      inputSchema: {
        type: 'object',
        properties: {
          playerCount: { type: 'integer', minimum: 2, maximum: 8 },
        },
        required: ['playerCount'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (value) => {
        setExitOpen(false);
        controller.setPreviewGrid(measureGrid());
        return input.startNewGame(
          (value as { playerCount: number }).playerCount,
        );
      },
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
      execute: (value) => {
        const { from, to } = value as { from: number; to: number };
        return input.attack(from, to);
      },
    });
    return () => lifecycle.abort();
  }, [controller, input, measureGrid]);
  const unlockAudio = () => {
    if (controller.getSnapshot().sound) audio.unlock();
  };
  const press = () => controller.sound('button');
  const onHome = () => {
    if (controller.getSnapshot().mode === 'playing') confirm(true);
    else controller.title();
  };
  const humanTurn =
    state.mode === 'playing' && ['source', 'target'].includes(state.phase);
  const result = state.mode === 'won' || state.mode === 'lost';
  const resultVisible =
    result && state.frame >= (state.mode === 'won' ? 11 : 8);
  const resultReady = result && state.frame >= (state.mode === 'won' ? 40 : 50);
  const hasBoard =
    state.game && !['loading', 'title', 'building'].includes(state.mode);
  const bounds = useMemo(
    () => mapBounds(state.game?.territories ?? [], state.game?.grid),
    [state.game?.territories, state.game?.grid],
  );
  return (
    <main
      ref={shellRef}
      className="game-shell"
      data-theme={theme}
      onPointerDownCapture={unlockAudio}
      onTouchEndCapture={unlockAudio}
      onClickCapture={unlockAudio}
      onKeyDownCapture={(e) => {
        unlockAudio();
        if (e.key === 'Escape' && !input.blocked) controller.cancel();
      }}
    >
      <section
        className={`game-window${state.mode === 'title' || state.mode === 'loading' ? ' title-window' : ' board-window'}`}
        data-mode={state.mode}
        data-phase={state.phase}
        data-reduced-motion={reduced}
        aria-label="Dicefront"
      >
        <header className="game-header">
          <div className="small-brand">
            <Image
              className="brand-mark"
              src={THEMES[theme].logo}
              width={32}
              height={32}
              alt=""
            />
            DICEFRONT
          </div>
          {state.game && ['playing', 'lost', 'won'].includes(state.mode) && (
            <Hud game={state.game} theme={theme} />
          )}
          <div className="header-actions">
            <button
              type="button"
              role="switch"
              className="quiet-button theme-switch"
              aria-label="Midnight theme"
              aria-checked={theme === 'midnight'}
              title={`Switch to ${theme === 'original' ? 'Midnight' : 'Original'} theme`}
              onClick={toggleTheme}
            >
              <Palette size={20} aria-hidden="true" />
            </button>
            {!['title', 'loading'].includes(state.mode) && (
              <button
                ref={homeRef}
                type="button"
                className="quiet-button"
                aria-label="Home"
                title="Home"
                onClick={onHome}
              >
                <Home size={20} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="quiet-button"
              aria-pressed={state.sound}
              aria-label={`Sound ${state.sound ? 'on' : 'off'}`}
              title={`Sound ${state.sound ? 'on' : 'off'}`}
              onClick={() => {
                controller.toggleSound();
                if (controller.getSnapshot().sound) {
                  audio.unlock();
                  controller.sound('button');
                } else audio.silence();
              }}
            >
              {state.sound ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>
        {state.mode === 'loading' && (
          <div className="loading-scene">
            <Image
              className="loading-die"
              src={THEMES[theme].logo}
              width={38}
              height={38}
              alt=""
            />
            <p>
              {loadError
                ? 'Unable to load the game. Please reload.'
                : 'Getting ready…'}
            </p>
            <progress
              aria-label="Loading the game"
              max={100}
              value={state.loaded}
            />
          </div>
        )}
        {state.mode === 'title' && (
          <div className="title-content screen-enter" ref={titlePlayRef}>
            <MidnightTitle
              theme={theme}
              count={state.count}
              dice={state.titleDice}
              choose={controller.chooseCount}
              play={controller.preview}
              press={press}
            />
          </div>
        )}
        {!['loading', 'title'].includes(state.mode) && (
          <div className="board-content">
            <div className="board-scene" ref={boardRef}>
              <svg
                className="game-stage"
                data-columns={state.game?.grid.columns}
                data-rows={state.game?.grid.rows}
                viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="group"
                aria-label="Dicefront board"
              >
                <title>Dicefront territory map</title>
                {hasBoard && (
                  <g
                    className="board-enter"
                    key={state.mode === 'history' ? 'history' : 'campaign'}
                  >
                    <MapBoard
                      game={state.game!}
                      state={state}
                      input={input}
                      theme={theme}
                      reduced={reduced}
                    />
                  </g>
                )}
                {state.mode === 'building' && (
                  <text
                    x={bounds.x + bounds.width / 2}
                    y={bounds.y + bounds.height / 2}
                    textAnchor="middle"
                    className="building-label"
                  >
                    Making your map…
                  </text>
                )}
              </svg>
              {resultVisible && (
                <div className={`result-overlay ${state.mode}`}>
                  <div
                    className="result-card"
                    role="group"
                    aria-label={state.mode === 'won' ? 'You win' : 'Game over'}
                  >
                    {state.mode === 'won' && (
                      <div className="win-sparks" aria-hidden="true">
                        {THEMES[theme].palette.map(({ color }, i) => (
                          <span
                            key={color}
                            style={
                              {
                                '--spark-color': color,
                                '--spark-x': `${Math.cos((i * Math.PI) / 4) * 135}px`,
                                '--spark-y': `${Math.sin((i * Math.PI) / 4) * 90}px`,
                                '--spark-angle': `${i * 45}deg`,
                              } as CSSProperties
                            }
                          />
                        ))}
                      </div>
                    )}
                    <span className="dialog-kicker">
                      {state.mode === 'won'
                        ? 'The map is yours'
                        : 'Until the next roll'}
                    </span>
                    <h2>{state.mode === 'won' ? 'You win!' : 'Game over'}</h2>
                    {resultReady && (
                      <div className="result-actions screen-enter">
                        <GameButton
                          className="primary-button"
                          press={press}
                          onClick={controller.history}
                        >
                          View history
                          <ArrowRight size={17} aria-hidden="true" />
                        </GameButton>
                        {state.mode === 'lost' && (
                          <GameButton
                            className="secondary-button"
                            press={press}
                            onClick={controller.title}
                          >
                            Main screen
                          </GameButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="board-tray">
              {['battle', 'supply'].includes(state.phase) && (
                <svg
                  className="phase-stage"
                  viewBox="0 460 800 100"
                  preserveAspectRatio="xMidYMid meet"
                  role="group"
                  aria-label={
                    state.phase === 'battle' ? 'Battle rolls' : 'Reserve dice'
                  }
                >
                  {state.phase === 'battle' && (
                    <BattleStrip
                      theme={theme}
                      reduced={reduced}
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
                        {
                          length:
                            state.game.players[currentPlayer(state.game)].stock,
                        },
                        (_, i) => (
                          <g
                            key={i}
                            transform={`translate(${20 + (i % 32) * 24} ${490 + Math.floor(i / 32) * 28}) scale(.065582275)`}
                          >
                            <g className="reserve-die">
                              <Die
                                theme={theme}
                                owner={currentPlayer(state.game!)}
                                face={2}
                              />
                            </g>
                          </g>
                        ),
                      )}
                    </g>
                  )}
                </svg>
              )}
              {state.mode === 'playing' && (
                <div className="turn-controls">
                  {humanTurn && (
                    <>
                      <p className="turn-instructions" key={state.phase}>
                        {state.phase === 'source'
                          ? 'Select your area.'
                          : 'Choose a neighbor to attack.'}
                        <span>
                          {state.phase === 'source'
                            ? 'Choose a neighbor to attack.'
                            : 'Select your area again to cancel.'}
                        </span>
                      </p>
                      <GameButton
                        className="primary-button end-turn"
                        press={press}
                        onClick={input.endTurn}
                        disabled={input.blocked}
                      >
                        End turn
                      </GameButton>
                    </>
                  )}
                </div>
              )}
            </div>
            {['building', 'preview', 'history'].includes(state.mode) && (
              <div className="game-bottom">
                {['building', 'preview'].includes(state.mode) && (
                  <div className="preview-controls screen-enter">
                    <span>Play this map?</span>
                    <div className="preview-actions">
                      <GameButton
                        className="secondary-button"
                        disabled={state.mode === 'building'}
                        press={press}
                        onClick={controller.preview}
                      >
                        Another map
                        <RotateCw size={17} aria-hidden="true" />
                      </GameButton>
                      <GameButton
                        className="primary-button"
                        disabled={state.mode === 'building'}
                        press={press}
                        onClick={controller.accept}
                      >
                        Start game
                        <ArrowRight size={17} aria-hidden="true" />
                      </GameButton>
                    </div>
                  </div>
                )}

                {state.mode === 'history' && (
                  <div className="history-footer screen-enter">
                    <span>Game history</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      <AlertDialog
        open={exitOpen && state.mode === 'playing'}
        onOpenChange={confirm}
      >
        <AlertDialogContent
          className="leave-dialog"
          initialFocus={stayRef}
          finalFocus={homeRef}
        >
          <span className="dialog-kicker">Back to the main screen</span>
          <AlertDialogTitle className="leave-title">
            Leave this game?
          </AlertDialogTitle>
          <AlertDialogDescription className="leave-description">
            Your current game will be lost.
          </AlertDialogDescription>
          <div className="dialog-actions">
            <GameButton
              ref={stayRef}
              className="primary-button"
              press={press}
              onClick={() => confirm(false)}
            >
              Keep playing
            </GameButton>
            <GameButton
              className="secondary-button"
              press={press}
              onClick={() => {
                confirm(false);
                controller.title();
              }}
            >
              Leave game
            </GameButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <p className="sr-only" role="status" aria-live="polite">
        {loadError
          ? 'Unable to load artwork or sounds. Please reload.'
          : state.mode === 'loading'
            ? 'Loading Dicefront artwork and sounds.'
            : state.notice}
      </p>
    </main>
  );
}

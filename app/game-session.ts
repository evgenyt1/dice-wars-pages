import {
  AREA_LIMIT,
  CELL_COUNT,
  MAX_DICE,
  MAX_STOCK,
  applyBattle,
  currentPlayer,
  gameResult,
  gridForColumns,
  playerStates,
  validSources,
  validTargets,
} from './game-engine.ts';
import type {
  BattleResult,
  GameState,
  HistoryEvent,
  Territory,
} from './game-engine.ts';
import type { Mode, Phase, ViewState } from './game-controller.ts';

export const SESSION_KEY = 'dicefront-session';
export const SESSION_VERSION = 1;

/** A resumable controller snapshot. Transient animation state is rebuilt on restore. */
export interface SavedSession {
  version: typeof SESSION_VERSION;
  count: number;
  sound: boolean;
  /** MapGenerator's persistent priority permutation (G.num). */
  priority: number[];
  mode: Extract<
    Mode,
    'title' | 'building' | 'preview' | 'playing' | 'lost' | 'won'
  >;
  phase: Phase;
  frame: number;
  game: GameState | null;
  selected: number | null;
  target: number | null;
  battle: BattleResult | null;
  aiMove: [number, number] | null;
  supplyWait: number;
  supplyFinished: boolean;
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Fields = Record<string, unknown>;

const MODES = ['title', 'building', 'preview', 'playing', 'lost', 'won'];
const PHASES = [
  'idle',
  'source',
  'target',
  'ai',
  'battle',
  'supply',
  'result',
  'history',
];
const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;
const isInts = (
  value: unknown,
  min: number,
  max: number,
  length?: number,
): value is number[] =>
  Array.isArray(value) &&
  (length === undefined || value.length === length) &&
  value.every((item) => isInt(item, min, max));
const isPermutation = (value: unknown, length: number): value is number[] =>
  isInts(value, 0, length - 1, length) && new Set(value).size === length;
const isTerritoryId = (value: unknown): value is number | null =>
  value === null || isInt(value, 1, AREA_LIMIT - 1);

function parseTerritory(
  value: unknown,
  id: number,
  playerCount: number,
): Territory | null {
  if (
    !isRecord(value) ||
    value.id !== id ||
    !isInts(value.cells, 0, CELL_COUNT - 1) ||
    value.size !== value.cells.length ||
    !isInt(value.centerCell, 0, CELL_COUNT - 1) ||
    !isInts(value.neighbors, 1, AREA_LIMIT - 1) ||
    !Array.isArray(value.outline) ||
    !value.outline.every(
      (point) =>
        isRecord(point) &&
        isInt(point.cell, 0, CELL_COUNT - 1) &&
        isInt(point.direction, 0, 5),
    )
  )
    return null;
  const active = value.size > 0;
  if (
    active
      ? !isInt(value.owner, 0, playerCount - 1) ||
        !isInt(value.dice, 1, MAX_DICE)
      : !isInt(value.owner, -1, 7) || !isInt(value.dice, 0, MAX_DICE)
  )
    return null;
  return {
    id,
    cells: value.cells,
    size: value.size,
    owner: value.owner as number,
    dice: value.dice as number,
    centerCell: value.centerCell,
    neighbors: value.neighbors,
    outline: (value.outline as Fields[]).map((point) => ({
      cell: point.cell as number,
      direction: point.direction as number,
    })),
  };
}

function parseGame(value: unknown, started: boolean): GameState | null {
  if (!isRecord(value) || !isRecord(value.grid)) return null;
  let grid;
  try {
    grid = gridForColumns(value.grid.columns as number);
  } catch {
    return null;
  }
  const count = value.playerCount;
  if (
    value.grid.rows !== grid.rows ||
    !isInt(count, 2, 8) ||
    !isInts(value.cellTerritory, 0, AREA_LIMIT - 1, CELL_COUNT) ||
    !Array.isArray(value.territories) ||
    value.territories.length !== AREA_LIMIT ||
    !Array.isArray(value.players) ||
    value.players.length !== 8 ||
    !isRecord(value.initial) ||
    !isInts(value.initial.owners, -1, 7, AREA_LIMIT) ||
    !isInts(value.initial.dice, 0, MAX_DICE, AREA_LIMIT) ||
    !Array.isArray(value.events) ||
    !isInt(value.round, 1, Number.MAX_SAFE_INTEGER)
  )
    return null;
  const territories = value.territories.map((t, id) =>
    parseTerritory(t, id, count),
  );
  if (territories.some((t) => !t)) return null;
  if (
    !value.players.every(
      (p, id) => isRecord(p) && p.id === id && isInt(p.stock, 0, MAX_STOCK),
    )
  )
    return null;
  const events = value.events as unknown[];
  if (
    !events.every(
      (e) =>
        isRecord(e) &&
        isInt(e.from, 1, AREA_LIMIT - 1) &&
        isInt(e.to, 0, AREA_LIMIT - 1) &&
        typeof e.won === 'boolean',
    )
  )
    return null;
  if (
    started
      ? !isPermutation(value.turnOrder, count) ||
        !isInt(value.turnIndex, 0, count - 1)
      : !Array.isArray(value.turnOrder) ||
        value.turnOrder.length !== 0 ||
        value.turnIndex !== 0
  )
    return null;
  const initial = {
    label:
      typeof value.initial.label === 'string'
        ? value.initial.label
        : 'Campaign begins',
    owners: value.initial.owners,
    dice: value.initial.dice,
  };
  const checked = territories as Territory[];
  return {
    grid,
    playerCount: count,
    cellTerritory: value.cellTerritory,
    territories: checked,
    // Derived counts are recomputed; only carried reinforcement stock is stored state.
    players: playerStates(checked, value.players as GameState['players']),
    turnOrder: value.turnOrder as number[],
    turnIndex: value.turnIndex as number,
    round: value.round,
    history: [initial],
    initial,
    events: events as HistoryEvent[],
  };
}

function parseBattle(value: unknown, game: GameState): BattleResult | null {
  if (
    !isRecord(value) ||
    !isInt(value.from, 1, AREA_LIMIT - 1) ||
    !isInt(value.to, 1, AREA_LIMIT - 1) ||
    !isInts(value.attackerRolls, 1, 6) ||
    !isInts(value.defenderRolls, 1, 6)
  )
    return null;
  const attackerTotal = value.attackerRolls.reduce((a, b) => a + b, 0);
  const defenderTotal = value.defenderRolls.reduce((a, b) => a + b, 0);
  const battle: BattleResult = {
    id: value.id as number,
    attacker: value.attacker as number,
    defender: value.defender as number,
    from: value.from,
    to: value.to,
    attackerRolls: value.attackerRolls,
    defenderRolls: value.defenderRolls,
    attackerTotal,
    defenderTotal,
    won: attackerTotal > defenderTotal,
    gameWinner: null,
  };
  if (
    value.attackerTotal !== attackerTotal ||
    value.defenderTotal !== defenderTotal ||
    value.won !== battle.won ||
    !validSources(game).includes(battle.from) ||
    !validTargets(game, battle.from).includes(battle.to)
  )
    return null;
  try {
    applyBattle(game, battle); // Same stale-battle guard as live resolution.
  } catch {
    return null;
  }
  return battle;
}

/** Accepts only a coherent, resumable session; anything else starts fresh. */
export function parseSession(value: unknown): SavedSession | null {
  if (
    !isRecord(value) ||
    value.version !== SESSION_VERSION ||
    !isInt(value.count, 2, 8) ||
    typeof value.sound !== 'boolean' ||
    !isPermutation(value.priority, CELL_COUNT) ||
    !MODES.includes(value.mode as string) ||
    !PHASES.includes(value.phase as string) ||
    !isInt(value.frame, 0, 100) ||
    !isTerritoryId(value.selected) ||
    !isTerritoryId(value.target) ||
    !isInt(value.supplyWait, 0, 12) ||
    typeof value.supplyFinished !== 'boolean'
  )
    return null;
  const mode = value.mode as SavedSession['mode'];
  const started = mode === 'playing' || mode === 'lost' || mode === 'won';
  const game =
    value.game === null || value.game === undefined
      ? null
      : parseGame(value.game, started);
  if ((value.game ?? null) !== null && !game) return null;
  if ((started || mode === 'preview') && !game) return null;
  if (game && (mode === 'title' || mode === 'building')) return null;
  if (mode === 'playing' && game!.players[currentPlayer(game!)].connected === 0)
    return null;
  if ((mode === 'lost' || mode === 'won') && gameResult(game!) !== mode)
    return null;
  const battle =
    mode === 'playing' && value.phase === 'battle'
      ? parseBattle(value.battle, game!)
      : null;
  if (mode === 'playing' && value.phase === 'battle' && !battle) return null;
  const aiMove =
    Array.isArray(value.aiMove) &&
    value.aiMove.length === 2 &&
    value.aiMove.every((id) => isInt(id, 1, AREA_LIMIT - 1))
      ? (value.aiMove as [number, number])
      : null;
  return {
    version: SESSION_VERSION,
    count: value.count,
    sound: value.sound,
    priority: value.priority,
    mode,
    phase: value.phase as Phase,
    frame: value.frame,
    game,
    selected: value.selected,
    target: value.target,
    battle,
    aiMove,
    supplyWait: value.supplyWait,
    supplyFinished: value.supplyFinished,
  };
}

export function loadSession(
  storage: SessionStorage | null,
): SavedSession | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = parseSession(JSON.parse(raw));
    if (!session) storage!.removeItem(SESSION_KEY);
    return session;
  } catch {
    try {
      storage?.removeItem(SESSION_KEY);
    } catch {
      /* Storage may be unavailable in private or embedded browsers. */
    }
    return null;
  }
}

export function storeSession(
  storage: SessionStorage | null,
  session: SavedSession,
) {
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* A full or blocked store must never interrupt play. */
  }
}

interface SessionSource {
  getSnapshot: () => ViewState;
  subscribe: (listener: () => void) => () => void;
  session: () => SavedSession | null;
}

/**
 * Coalesces saves to meaningful changes (not every animation frame). Call
 * `flush` when the page is hidden: iOS may end a backgrounded web app silently.
 */
export function autosave(
  source: SessionSource,
  write: (session: SavedSession) => void,
  delay = 1000,
  timers: {
    set: (fn: () => void, ms: number) => unknown;
    clear: (id: unknown) => void;
  } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
) {
  let last = source.getSnapshot();
  let timer: unknown = null;
  const flush = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    const session = source.session();
    if (session) write(session);
  };
  const unsubscribe = source.subscribe(() => {
    const view = source.getSnapshot();
    const changed =
      view.game !== last.game ||
      view.mode !== last.mode ||
      view.phase !== last.phase ||
      view.selected !== last.selected ||
      view.target !== last.target ||
      view.count !== last.count ||
      view.sound !== last.sound;
    last = view;
    if (changed && timer === null) timer = timers.set(flush, delay);
  });
  return {
    flush,
    stop: () => {
      unsubscribe();
      if (timer !== null) timers.clear(timer);
      timer = null;
    },
  };
}

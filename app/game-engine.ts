export const GRID_WIDTH = 32;
export const GRID_HEIGHT = 28;
export const AREA_LIMIT = 32;
export const CELL_WIDTH = 23;
export const CELL_HEIGHT = 14;
export const MAX_DICE = 8;
export const MAX_STOCK = 64;

export const PLAYER_COLORS = [
  '#b37ffe',
  '#b3ff01',
  '#009302',
  '#ff7ffe',
  '#ff7f01',
  '#b3fffe',
  '#ffff01',
  '#ff5858',
] as const;

export const PLAYER_NAMES = [
  'Violet',
  'Lime',
  'Green',
  'Magenta',
  'Orange',
  'Cyan',
  'Yellow',
  'Red',
] as const;

export interface Territory {
  id: number;
  cells: number[];
  size: number;
  owner: number;
  dice: number;
  centerCell: number;
  neighbors: number[];
  outline: { cell: number; direction: number }[];
}

export interface PlayerState {
  id: number;
  territories: number;
  connected: number;
  dice: number;
  stock: number;
}

export interface HistoryFrame {
  label: string;
  owners: number[];
  dice: number[];
}

export interface GameState {
  playerCount: number;
  cellTerritory: number[];
  territories: Territory[];
  players: PlayerState[];
  turnOrder: number[];
  turnIndex: number;
  round: number;
  history: HistoryFrame[];
  initial: HistoryFrame;
  events: HistoryEvent[];
}

export interface BattleResult {
  id: number;
  attacker: number;
  defender: number;
  from: number;
  to: number;
  attackerRolls: number[];
  defenderRolls: number[];
  attackerTotal: number;
  defenderTotal: number;
  won: boolean;
  gameWinner: number | null;
}

export interface HistoryEvent {
  from: number;
  to: number;
  won: boolean;
}
export type Random = () => number;

/** Same recorded LCG as the original-code oracle. No hidden animation/id draws. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Lives for the whole application, including title returns and map rerolls. */
export class MapGenerator {
  readonly priority = Array.from(
    { length: GRID_WIDTH * GRID_HEIGHT },
    (_, i) => i,
  );
  readonly random: Random;
  constructor(random: Random = Math.random) {
    this.random = random;
  }
  preview(playerCount: number): GameState {
    const count = Math.max(2, Math.min(8, Math.floor(playerCount)));
    const map = buildMap(count, this.priority, this.random);
    const initial = makeHistoryFrame(map.territories, 'Campaign begins');
    return {
      playerCount: count,
      ...map,
      players: playerStates(map.territories),
      turnOrder: [],
      turnIndex: 0,
      round: 1,
      history: [initial],
      initial,
      events: [],
    };
  }
}

const allCells = GRID_WIDTH * GRID_HEIGHT;

function shuffle<T>(values: T[], random: Random): T[] {
  for (let i = 0; i < values.length; i += 1) {
    const other = Math.floor(random() * values.length);
    [values[i], values[other]] = [values[other], values[i]];
  }
  return values;
}

function randomItem<T>(values: T[], random: Random): T {
  return values[Math.floor(random() * values.length)];
}

export function neighborOf(cell: number, direction: number): number {
  const x = cell % GRID_WIDTH;
  const y = Math.floor(cell / GRID_WIDTH);
  const odd = y % 2;
  let dx = 0;
  let dy = 0;

  switch (direction) {
    case 0:
      dx = odd ? 1 : 0;
      dy = -1;
      break;
    case 1:
      dx = 1;
      break;
    case 2:
      dx = odd ? 1 : 0;
      dy = 1;
      break;
    case 3:
      dx = odd ? 0 : -1;
      dy = 1;
      break;
    case 4:
      dx = -1;
      break;
    case 5:
      dx = odd ? 0 : -1;
      dy = -1;
      break;
  }

  const nextX = x + dx;
  const nextY = y + dy;
  if (nextX < 0 || nextY < 0 || nextX >= GRID_WIDTH || nextY >= GRID_HEIGHT) {
    return -1;
  }
  return nextY * GRID_WIDTH + nextX;
}

export function cellOrigin(cell: number): [number, number] {
  const x = cell % GRID_WIDTH;
  const y = Math.floor(cell / GRID_WIDTH);
  return [x * CELL_WIDTH + (y % 2 ? CELL_WIDTH / 2 : 0), y * CELL_HEIGHT];
}

export function cellPolygon(cell: number): string {
  const [x, y] = cellOrigin(cell);
  const points = [
    [CELL_WIDTH / 2, -3],
    [CELL_WIDTH, 3],
    [CELL_WIDTH, CELL_HEIGHT - 3],
    [CELL_WIDTH / 2, CELL_HEIGHT + 3],
    [0, CELL_HEIGHT - 3],
    [0, 3],
  ];
  return points.map(([px, py]) => `${x + px},${y + py}`).join(' ');
}

export function cellEdge(
  cell: number,
  direction: number,
): [number, number, number, number] {
  const [x, y] = cellOrigin(cell);
  const points = [
    [CELL_WIDTH / 2, -3],
    [CELL_WIDTH, 3],
    [CELL_WIDTH, CELL_HEIGHT - 3],
    [CELL_WIDTH / 2, CELL_HEIGHT + 3],
    [0, CELL_HEIGHT - 3],
    [0, 3],
    [CELL_WIDTH / 2, -3],
  ];
  const start = points[direction];
  const end = points[direction + 1];
  return [x + start[0], y + start[1], x + end[0], y + end[1]];
}

function growTerritory(
  cells: number[],
  frontier: number[],
  priority: number[],
  start: number,
  maximum: number,
  territory: number,
): number {
  const next = Array(allCells).fill(0) as number[];
  let current = start;
  let count = 0;

  while (true) {
    cells[current] = territory;
    count += 1;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = neighborOf(current, direction);
      if (neighbor >= 0) next[neighbor] = 1;
    }

    let bestPriority = Number.POSITIVE_INFINITY;
    let nextCell = -1;
    for (let cell = 0; cell < allCells; cell += 1) {
      if (next[cell] && cells[cell] <= 0 && priority[cell] <= bestPriority) {
        bestPriority = priority[cell];
        nextCell = cell;
      }
    }
    if (nextCell < 0 || count >= maximum) break;
    current = nextCell;
  }

  for (let cell = 0; cell < allCells; cell += 1) {
    if (!next[cell] || cells[cell] > 0) continue;
    cells[cell] = territory;
    count += 1;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = neighborOf(cell, direction);
      if (neighbor >= 0) frontier[neighbor] = 1;
    }
  }
  return count;
}

function buildMap(
  playerCount: number,
  priority: number[],
  random: Random,
): Pick<GameState, 'cellTerritory' | 'territories'> {
  shuffle(priority, random);
  const cells = Array(allCells).fill(0) as number[];
  const frontier = Array(allCells).fill(0) as number[];
  frontier[Math.floor(random() * allCells)] = 1;

  let territoryId = 1;
  while (territoryId < AREA_LIMIT) {
    let bestPriority = Number.POSITIVE_INFINITY;
    let start = -1;
    for (let cell = 0; cell < allCells; cell += 1) {
      if (
        cells[cell] <= 0 &&
        frontier[cell] &&
        priority[cell] <= bestPriority
      ) {
        bestPriority = priority[cell];
        start = cell;
      }
    }
    if (
      start < 0 ||
      growTerritory(cells, frontier, priority, start, 8, territoryId) === 0
    ) {
      break;
    }
    territoryId += 1;
  }

  for (let cell = 0; cell < allCells; cell += 1) {
    if (cells[cell] !== 0) continue;
    let touchesEmpty = false;
    let replacement = 0;
    for (let direction = 0; direction < 6; direction += 1) {
      const neighbor = neighborOf(cell, direction);
      if (neighbor < 0) continue;
      if (cells[neighbor] === 0) touchesEmpty = true;
      else replacement = cells[neighbor];
    }
    if (!touchesEmpty) cells[cell] = replacement;
  }

  const sizes = Array(AREA_LIMIT).fill(0) as number[];
  for (const territory of cells) {
    if (territory > 0) sizes[territory] += 1;
  }
  for (let cell = 0; cell < allCells; cell += 1) {
    if (cells[cell] > 0 && sizes[cells[cell]] <= 5) cells[cell] = 0;
  }

  const territories: Territory[] = Array.from(
    { length: AREA_LIMIT },
    (_, id) => ({
      id,
      cells: [],
      size: 0,
      owner: -1,
      dice: 0,
      centerCell: 0,
      neighbors: [],
      outline: [],
    }),
  );
  for (let cell = 0; cell < allCells; cell += 1) {
    const id = cells[cell];
    if (id > 0) territories[id].cells.push(cell);
  }

  for (const territory of territories) {
    territory.size = territory.cells.length;
    if (!territory.size) continue;
    let left = GRID_WIDTH;
    let right = -1;
    let top = GRID_HEIGHT;
    let bottom = -1;
    for (const cell of territory.cells) {
      const x = cell % GRID_WIDTH;
      const y = Math.floor(cell / GRID_WIDTH);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (let direction = 0; direction < 6; direction += 1) {
        const neighbor = neighborOf(cell, direction);
        const other = neighbor > 0 ? cells[neighbor] : 0;
        if (
          other > 0 &&
          other !== territory.id &&
          !territory.neighbors.includes(other)
        ) {
          territory.neighbors.push(other);
        }
      }
    }
    const centerX = Math.floor((left + right) / 2);
    const centerY = Math.floor((top + bottom) / 2);
    let bestScore = Number.POSITIVE_INFINITY;
    for (const cell of territory.cells) {
      const x = cell % GRID_WIDTH;
      const y = Math.floor(cell / GRID_WIDTH);
      let boundary = false;
      for (let direction = 0; direction < 6; direction += 1) {
        const neighbor = neighborOf(cell, direction);
        if (neighbor > 0 && cells[neighbor] !== territory.id) boundary = true;
      }
      const score =
        Math.abs(centerX - x) + Math.abs(centerY - y) + (boundary ? 4 : 0);
      if (score < bestScore) {
        bestScore = score;
        territory.centerCell = cell;
      }
    }
  }

  const active = territories.filter((t) => t.size > 0).map((t) => t.id);
  const unassigned = [...active];
  let owner = 0;
  while (unassigned.length) {
    // G.make_map: bytecode is Modulo, deliberately NOT multiplication.
    const index = Math.floor(random() % unassigned.length);
    const [id] = unassigned.splice(index, 1);
    territories[id].owner = owner;
    territories[id].dice = 1;
    owner = (owner + 1) % playerCount;
  }
  for (const territory of territories) {
    territory.neighbors.sort((a, b) => a - b);
    for (const cell of territory.cells) {
      const direction = Array.from({ length: 6 }, (_, d) => d).find((d) => {
        const next = neighborOf(cell, d);
        return next >= 0 && cells[next] !== territory.id;
      });
      if (direction === undefined) continue;
      let c = cell,
        d = direction;
      territory.outline.push({ cell: c, direction: d });
      for (let i = 0; i < 100; i++) {
        d = (d + 1) % 6;
        const next = neighborOf(c, d);
        if (next >= 0 && cells[next] === territory.id) {
          c = next;
          d = (d + 4) % 6;
        }
        territory.outline.push({ cell: c, direction: d });
        if (c === cell && d === direction) break;
      }
      break;
    }
  }
  placeInitialDice(territories, playerCount, random);

  return { cellTerritory: cells, territories };
}

/** G.make_map setup is separate so its historical early break can be tested. */
export function placeInitialDice(
  territories: Territory[],
  playerCount: number,
  random: Random,
) {
  const active = territories.filter((t) => t.size > 0).map((t) => t.id);
  for (const id of active) territories[id].dice = 1;
  for (let i = 0; i < active.length * 2; i++) {
    const eligible = active.filter(
      (id) =>
        territories[id].owner === i % playerCount &&
        territories[id].dice < MAX_DICE,
    );
    // The original breaks the entire setup, even when other owners have space.
    if (!eligible.length) break;
    territories[randomItem(eligible, random)].dice++;
  }
}

function largestConnected(territories: Territory[], owner: number): number {
  const owned = territories.filter((t) => t.size > 0 && t.owner === owner);
  const roots = territories.map((t) => t.id);
  const root = (id: number): number => {
    while (roots[id] !== id) id = roots[id];
    return id;
  };
  // G.set_area_tc merges on either directed join. The >0 cell rule can make
  // a boundary asymmetric, so a directed flood fill is not equivalent.
  for (const territory of owned)
    for (const id of territory.neighbors) {
      if (territories[id].size > 0 && territories[id].owner === owner) {
        roots[root(id)] = root(territory.id);
      }
    }
  const counts = new Map<number, number>();
  for (const t of owned)
    counts.set(root(t.id), (counts.get(root(t.id)) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

export function playerStates(
  territories: Territory[],
  previous?: PlayerState[],
): PlayerState[] {
  return Array.from({ length: 8 }, (_, id) => {
    const owned = territories.filter(
      (territory) => territory.size > 0 && territory.owner === id,
    );
    return {
      id,
      territories: owned.length,
      connected: largestConnected(territories, id),
      dice: owned.reduce((total, territory) => total + territory.dice, 0),
      stock: previous?.[id]?.stock ?? 0,
    };
  });
}

function makeHistoryFrame(
  territories: Territory[],
  label: string,
): HistoryFrame {
  return {
    label,
    owners: territories.map((territory) => territory.owner),
    dice: territories.map((territory) => territory.dice),
  };
}

/** Preview acceptance is the only point that consumes turn-order RNG. */
export function acceptMap(
  preview: GameState,
  random: Random = Math.random,
): GameState {
  const initial = makeHistoryFrame(preview.territories, 'Campaign begins');
  return {
    ...preview,
    players: playerStates(preview.territories),
    turnOrder: shuffle(
      Array.from({ length: preview.playerCount }, (_, i) => i),
      random,
    ),
    turnIndex: 0,
    round: 1,
    initial,
    history: [initial],
    events: [],
  };
}

// Convenience for numeric simulations and the explicit tool-only preview bypass.
export function createGame(
  playerCount: number,
  random: Random = Math.random,
): GameState {
  return acceptMap(new MapGenerator(random).preview(playerCount), random);
}

export function territoryPath(territory: Territory): string {
  if (!territory.outline.length) return '';
  const first = territory.outline[0];
  const [x, y] = cellEdge(first.cell, first.direction);
  let path = `M${x},${y}`;
  for (const point of territory.outline.slice(0, 100)) {
    const [, , ex, ey] = cellEdge(point.cell, point.direction);
    path += `L${ex},${ey}`;
    const next = territory.outline[territory.outline.indexOf(point) + 1];
    if (next?.cell === first.cell && next.direction === first.direction) break;
  }
  // SVG fill implicitly closes open contours; the original stroke stays open
  // at the historical 100-edge limit, so do not append Z.
  return path;
}

export function currentPlayer(game: GameState): number {
  return game.turnOrder[game.turnIndex];
}

export function validSources(
  game: GameState,
  owner = currentPlayer(game),
): number[] {
  return game.territories
    .filter(
      (territory) =>
        territory.size > 0 &&
        territory.owner === owner &&
        territory.dice > 1 &&
        territory.neighbors.some((id) => game.territories[id].owner !== owner),
    )
    .map((territory) => territory.id);
}

export function validTargets(game: GameState, from: number): number[] {
  const territory = game.territories[from];
  if (!territory) return [];
  return territory.neighbors.filter(
    (id) =>
      game.territories[id].size > 0 &&
      game.territories[id].owner !== territory.owner,
  );
}

function roll(count: number, random: Random): number[] {
  return Array.from({ length: count }, () => Math.floor(random() * 6) + 1);
}

export function prepareBattle(
  game: GameState,
  from: number,
  to: number,
  random: Random = Math.random,
): BattleResult {
  if (
    !validSources(game).includes(from) ||
    !validTargets(game, from).includes(to)
  ) {
    throw new Error('That territory cannot attack the selected target.');
  }
  const attackerRolls = roll(game.territories[from].dice, random);
  const defenderRolls = roll(game.territories[to].dice, random);
  const attackerTotal = attackerRolls.reduce((a, b) => a + b, 0);
  const defenderTotal = defenderRolls.reduce((a, b) => a + b, 0);
  return {
    id: game.events.length,
    from,
    to,
    attacker: game.territories[from].owner,
    defender: game.territories[to].owner,
    attackerRolls,
    defenderRolls,
    attackerTotal,
    defenderTotal,
    won: attackerTotal > defenderTotal,
    gameWinner: null,
  };
}

export function applyHistoryEvent(
  game: GameState,
  event: HistoryEvent,
): GameState {
  const territories = game.territories.map((t) => ({ ...t }));
  const source = territories[event.from];
  if (event.to === 0) source.dice++;
  else {
    if (event.won) {
      territories[event.to].owner = source.owner;
      territories[event.to].dice = source.dice - 1;
    }
    source.dice = 1;
  }
  return {
    ...game,
    territories,
    players: playerStates(territories, game.players),
  };
}

export function applyBattle(game: GameState, battle: BattleResult): GameState {
  if (
    battle.id !== game.events.length ||
    game.territories[battle.from].owner !== battle.attacker ||
    game.territories[battle.to].owner !== battle.defender ||
    game.territories[battle.from].dice !== battle.attackerRolls.length ||
    game.territories[battle.to].dice !== battle.defenderRolls.length
  )
    throw new Error('Stale battle.');
  const event = { from: battle.from, to: battle.to, won: battle.won };
  const next = applyHistoryEvent(game, event);
  return { ...next, events: [...game.events, event] };
}

export function gameResult(game: GameState): 'lost' | 'won' | null {
  // T170/f34 checks human elimination before the number of surviving AIs.
  if (game.players[0].connected === 0) return 'lost';
  return game.players.filter((p) => p.connected > 0).length === 1
    ? 'won'
    : null;
}

export function attack(
  game: GameState,
  from: number,
  to: number,
  random: Random = Math.random,
) {
  const battle = prepareBattle(game, from, to, random);
  const next = applyBattle(game, battle);
  const living = next.players.filter((p) => p.territories > 0);
  battle.gameWinner = living.length === 1 ? living[0].id : null;
  return { game: next, battle };
}

export function aiPolicy(game: GameState) {
  const totals = playerStates(game.territories).map((p) => p.dice);
  const rank = Array.from({ length: 8 }, (_, i) => i);
  for (let i = 0; i < 7; i++)
    for (let j = i + 1; j < 8; j++) {
      // Deliberate historical anomaly: totals stay in place as rank values swap.
      if (totals[i] < totals[j]) [rank[i], rank[j]] = [rank[j], rank[i]];
    }
  let dominant = -1;
  const total = totals.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 8; i++) if (totals[i] > (total * 2) / 5) dominant = i;
  return { rank, dominant };
}

export function pickAiAttack(
  game: GameState,
  random: Random = Math.random,
): [number, number] | null {
  const owner = currentPlayer(game);
  const { rank, dominant } = aiPolicy(game);
  const candidates: [number, number][] = [];
  for (const from of validSources(game, owner))
    for (const to of validTargets(game, from)) {
      const source = game.territories[from],
        target = game.territories[to];
      if (
        dominant >= 0 &&
        source.owner !== dominant &&
        target.owner !== dominant
      )
        continue;
      if (target.dice > source.dice) continue;
      if (target.dice === source.dice) {
        const gate = random() * 10 > 1; // Consume even when rank bypasses the gate.
        if (rank[owner] !== 0 && rank[target.owner] !== 0 && !gate) continue;
      }
      candidates.push([from, to]);
    }
  return candidates.length ? randomItem(candidates, random) : null;
}

export function startSupply(game: GameState): GameState {
  const players = playerStates(game.territories, game.players);
  const player = players[currentPlayer(game)];
  player.stock = Math.min(MAX_STOCK, player.stock + player.connected);
  return { ...game, players };
}

export function supplyOne(
  game: GameState,
  random: Random = Math.random,
): { game: GameState; id: number | null } {
  const owner = currentPlayer(game);
  const eligible = game.territories.filter(
    (t) => t.size > 0 && t.owner === owner && t.dice < MAX_DICE,
  );
  if (!eligible.length || game.players[owner].stock <= 0)
    return { game, id: null };
  const id = randomItem(eligible, random).id;
  const event = { from: id, to: 0, won: false };
  const next = applyHistoryEvent(game, event);
  next.players[owner].stock--;
  next.events = [...game.events, event];
  return { game: next, id };
}

export function advanceTurn(game: GameState): GameState {
  if (!game.players.some((p) => p.connected))
    throw new Error('No living player.');
  let turnIndex = game.turnIndex,
    round = game.round;
  do {
    turnIndex++;
    if (turnIndex >= game.turnOrder.length) {
      turnIndex = 0;
      round++;
    }
  } while (game.players[game.turnOrder[turnIndex]].connected === 0);
  return { ...game, turnIndex, round };
}

export function endTurn(game: GameState, random: Random = Math.random) {
  let next = startSupply(game),
    supplied = 0;
  while (true) {
    const step = supplyOne(next, random);
    next = step.game;
    if (step.id === null) break;
    supplied++;
  }
  return { game: advanceTurn(next), supplied };
}

export function startHistory(game: GameState): GameState {
  const territories = game.territories.map((t, i) => ({
    ...t,
    owner: game.initial.owners[i],
    dice: game.initial.dice[i],
  }));
  return { ...game, territories, players: playerStates(territories) };
}

export function territoryLabel(game: GameState, id: number): string {
  const territory = game.territories[id];
  const owner = territory.owner === 0 ? 'You' : PLAYER_NAMES[territory.owner];
  return `Territory ${id}: ${owner}, ${territory.dice} ${territory.dice === 1 ? 'die' : 'dice'}`;
}

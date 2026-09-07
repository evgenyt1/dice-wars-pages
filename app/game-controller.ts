import {
  MapGenerator,
  acceptMap,
  advanceTurn,
  applyBattle,
  applyHistoryEvent,
  currentPlayer,
  gameResult,
  pickAiAttack,
  prepareBattle,
  startHistory,
  startSupply,
  supplyOne,
  validSources,
  validTargets,
} from './game-engine.ts';
import type { BattleResult, GameState, Random } from './game-engine.ts';

export type SoundName =
  | 'button'
  | 'click'
  | 'dice'
  | 'success'
  | 'fail'
  | 'my-turn'
  | 'game-over'
  | 'victory';
export type Mode =
  | 'loading'
  | 'title'
  | 'building'
  | 'preview'
  | 'playing'
  | 'lost'
  | 'won'
  | 'history';
export type Phase =
  | 'idle'
  | 'source'
  | 'target'
  | 'ai'
  | 'battle'
  | 'supply'
  | 'result'
  | 'history';
export type TitleDie = { owner: number; face: number };
export interface ViewState {
  mode: Mode;
  phase: Phase;
  game: GameState | null;
  count: number;
  selected: number | null;
  target: number | null;
  frame: number;
  battle: BattleResult | null;
  rolls: number[][];
  totals: (number | null)[];
  titleDice: TitleDie[];
  notice: string;
  sound: boolean;
  replayIndex: number;
  loaded: number;
}
export const INITIAL_VIEW: ViewState = {
  mode: 'loading',
  phase: 'idle',
  game: null,
  count: 7,
  selected: null,
  target: null,
  frame: 1,
  battle: null,
  rolls: [[], []],
  totals: [null, null],
  titleDice: [],
  notice: 'Loading original artwork and sounds.',
  sound: true,
  replayIndex: 0,
  loaded: 0,
};

/** S147/f1 callback counters, including shared flicker RNG and separate total updates. */
export class BattleAnimation {
  readonly battle: BattleResult;
  readonly human: boolean;
  readonly random: Random;
  side = 0;
  index = 0;
  counter = 0;
  wait = 0;
  ticks = 0;
  rolls: number[][] = [[], []];
  totals: (number | null)[] = [null, null];
  constructor(battle: BattleResult, human: boolean, random: Random) {
    this.battle = battle;
    this.human = human;
    this.random = random;
  }
  tick(): 'reveal' | 'total' | 'waiting' | 'done' {
    this.ticks++;
    if (++this.counter <= this.wait) return 'waiting';
    this.counter = 0;
    if (this.side >= 2) return 'done';
    const final =
      this.side === 0 ? this.battle.attackerRolls : this.battle.defenderRolls;
    if (this.index < final.length) {
      this.rolls = this.rolls.map((r, s) =>
        s === this.side
          ? final.map((value, i) =>
              i <= this.index ? value : Math.floor(this.random() * 6) + 1,
            )
          : r,
      );
      this.index++;
      this.wait = this.human ? 1 : 0;
      return 'reveal';
    }
    this.totals = this.totals.map((t, s) =>
      s === this.side ? final.reduce((a, b) => a + b, 0) : t,
    );
    this.side++;
    this.index = 0;
    this.wait = this.human ? 12 : 2;
    return 'total';
  }
}

/** S170 labels are explicit native phases. No per-action timers or React timing effects. */
export class GameController {
  private view: ViewState = INITIAL_VIEW;
  private listeners = new Set<() => void>();
  readonly generator: MapGenerator;
  private soundSink: (name: SoundName) => void;
  private animation: BattleAnimation | null = null;
  private aiMove: [number, number] | null = null;
  private supplyWait = 0;
  private supplyFinished = false;
  private replayWait = 0;
  constructor(
    random: Random = Math.random,
    sound: (name: SoundName) => void = () => {},
  ) {
    this.generator = new MapGenerator(random);
    this.soundSink = sound;
  }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ViewState>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
  sound(name: SoundName) {
    if (this.view.sound) this.soundSink(name);
  }
  toggleSound = () => {
    this.update({ sound: !this.view.sound });
  };
  progress = (loaded: number) => {
    if (this.view.mode === 'loading') this.update({ loaded });
  };
  ready = () => {
    if (this.view.mode === 'loading') this.update({ loaded: 100, frame: 1 });
  };
  title = () => {
    this.animation = null;
    this.aiMove = null;
    const colors = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < 8; i++) {
      const j = Math.floor(this.generator.random() * 8);
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    const titleDice = colors
      .slice(0, 3)
      .map((owner) => ({
        owner,
        face: Math.floor(this.generator.random() * 6) + 1,
      }));
    this.update({
      mode: 'title',
      phase: 'idle',
      game: null,
      selected: null,
      target: null,
      battle: null,
      frame: 1,
      rolls: [[], []],
      totals: [null, null],
      replayIndex: 0,
      titleDice,
      notice: 'Choose 2 to 8 players, then Play.',
    });
  };
  chooseCount = (count: number) => {
    if (
      this.view.mode === 'title' &&
      Number.isInteger(count) &&
      count >= 2 &&
      count <= 8
    )
      this.update({ count });
  };
  preview = () => {
    if (!['title', 'preview'].includes(this.view.mode)) return;
    this.animation = null;
    this.update({
      mode: 'building',
      phase: 'idle',
      frame: 1,
      selected: null,
      target: null,
      battle: null,
      notice: 'Please wait...',
    });
  };
  accept = () => {
    if (this.view.mode !== 'preview' || !this.view.game) return;
    this.begin(acceptMap(this.view.game, this.generator.random));
  };
  private begin(game: GameState) {
    this.animation = null;
    this.update({
      game,
      mode: 'playing',
      frame: 1,
      selected: null,
      target: null,
      battle: null,
      replayIndex: 0,
    });
    this.startPlayer(false);
  }
  /** Explicit model-tool convenience: uses persistent generator, skips preview only. */
  startNewGame(count: number) {
    if (!Number.isInteger(count) || count < 2 || count > 8)
      throw new Error('playerCount must be an integer from 2 through 8.');
    this.update({ count });
    this.begin(acceptMap(this.generator.preview(count), this.generator.random));
    return {
      status: 'started',
      playerCount: count,
      currentPlayer: currentPlayer(this.view.game!),
    };
  }
  private startPlayer(next: boolean, announcement = '') {
    const game = this.view.game!;
    const human = currentPlayer(game) === 0;
    if (human && next) this.sound('my-turn');
    this.update({
      mode: 'playing',
      phase: human ? 'source' : 'ai',
      frame: human ? 21 : 26,
      selected: null,
      target: null,
      battle: null,
      rolls: [[], []],
      totals: [null, null],
      notice:
        announcement +
        (human
          ? 'Your turn. Select an area with at least two dice and an enemy neighbor.'
          : 'Computer turn.'),
    });
    if (!human) {
      this.aiMove = pickAiAttack(game, this.generator.random);
      if (!this.aiMove) this.beginSupply();
    }
  }
  availableSources() {
    const s = this.view;
    if (s.mode !== 'playing' || !s.game || currentPlayer(s.game) !== 0)
      return [];
    if (s.phase === 'source') return validSources(s.game);
    if (s.phase === 'target' && s.selected !== null) return [s.selected];
    return [];
  }
  availableTargets() {
    const s = this.view;
    return s.mode === 'playing' &&
      s.phase === 'target' &&
      s.game &&
      s.selected !== null
      ? validTargets(s.game, s.selected)
      : [];
  }
  territory = (id: number) => {
    const s = this.view;
    if (!s.game || s.mode !== 'playing' || currentPlayer(s.game) !== 0) return;
    if (s.phase === 'source' && this.availableSources().includes(id)) {
      this.sound('click');
      this.update({
        selected: id,
        phase: 'target',
        notice:
          'Click an enemy neighbor to attack. Click your selected area again to cancel.',
      });
    } else if (s.phase === 'target' && id === s.selected) {
      this.sound('click');
      this.update({
        selected: null,
        phase: 'source',
        notice: 'Selection cancelled.',
      });
    } else if (s.phase === 'target' && this.availableTargets().includes(id)) {
      this.sound('click');
      this.launchBattle(s.selected!, id);
    }
  };
  cancel = () => {
    if (this.view.phase === 'target' && this.view.selected !== null)
      this.territory(this.view.selected);
  };
  attack(from: number, to: number) {
    const s = this.view;
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      !this.availableSources().includes(from) ||
      !s.game ||
      !validTargets(s.game, from).includes(to)
    )
      throw new Error('No legal player attack can be made right now.');
    // Same two presses as UI; the state locks synchronously before returning.
    if (s.phase === 'source') this.territory(from);
    this.territory(to);
    return { status: 'rolling', from, to }; // Never expose the pending result early.
  }
  private launchBattle(from: number, to: number) {
    const game = this.view.game!;
    const battle = prepareBattle(game, from, to, this.generator.random);
    this.animation = new BattleAnimation(
      battle,
      currentPlayer(game) === 0,
      this.generator.random,
    );
    this.update({
      phase: 'battle',
      frame: 34,
      selected: from,
      target: to,
      battle,
      rolls: [[], []],
      totals: [null, null],
      notice: 'Dice are rolling.',
    });
  }
  endTurn = () => {
    if (
      this.view.mode === 'playing' &&
      ['source', 'target'].includes(this.view.phase)
    )
      this.beginSupply();
  };
  private beginSupply() {
    this.supplyWait = 1;
    this.supplyFinished = false;
    this.update({
      game: startSupply(this.view.game!),
      phase: 'supply',
      frame: 1,
      selected: null,
      target: null,
      battle: null,
      notice: 'Reinforcements.',
    });
  }
  history = () => {
    const s = this.view;
    if (
      !s.game ||
      !['lost', 'won'].includes(s.mode) ||
      s.frame < (s.mode === 'lost' ? 50 : 40)
    )
      return;
    this.animation = null;
    this.update({
      game: startHistory(s.game),
      mode: 'history',
      phase: 'history',
      replayIndex: 0,
      selected: null,
      target: null,
      battle: null,
      frame: 1,
      notice: 'History replay.',
    });
    this.startReplayEvent();
  };
  private startReplayEvent() {
    const event = this.view.game!.events[this.view.replayIndex];
    if (event?.to) {
      this.replayWait = 9;
      this.update({ selected: event.from, target: null, frame: 5 });
    } else {
      // AS2's one-past-end event is an empty final step; never invent a territory.
      this.replayWait = 1;
      this.update({
        game: event
          ? applyHistoryEvent(this.view.game!, event)
          : this.view.game,
        selected: null,
        target: null,
        frame: 15,
      });
    }
  }
  tick = () => {
    const s = this.view;
    if (s.mode === 'loading') {
      if (s.loaded === 100) {
        if (s.frame >= 5) this.title();
        else this.update({ frame: s.frame + 1 });
      }
      return;
    }
    if (s.mode === 'building') {
      this.update({
        game: this.generator.preview(s.count),
        mode: 'preview',
        frame: 3,
        notice: 'Do you play this one?',
      });
      return;
    }
    if (s.mode === 'lost' || s.mode === 'won') {
      const end = s.mode === 'lost' ? 50 : 40;
      if (s.frame < end) {
        const frame = s.frame + 1;
        if (frame === (s.mode === 'lost' ? 7 : 10))
          this.sound(s.mode === 'lost' ? 'game-over' : 'victory');
        this.update({ frame });
      }
      return;
    }
    if (s.mode === 'history') {
      if (this.replayWait <= 0) return;
      const event = s.game!.events[s.replayIndex];
      this.replayWait--;
      if (event?.to) {
        if (this.replayWait === 7) this.update({ target: event.to, frame: 7 });
        if (this.replayWait === 2) {
          this.sound(event.won ? 'success' : 'fail');
          this.update({
            game: applyHistoryEvent(this.view.game!, event),
            selected: null,
            target: null,
            frame: 12,
          });
        }
      }
      if (this.replayWait === 0) {
        const index = s.replayIndex + 1;
        this.update({ replayIndex: index });
        if (index > s.game!.events.length)
          this.update({ frame: 20, notice: 'History complete.' });
        else this.startReplayEvent();
      }
      return;
    }
    if (s.mode !== 'playing') return;
    if (s.phase === 'ai' && this.aiMove) {
      const frame = s.frame + 1;
      this.update({ frame });
      if (frame === 27) this.update({ selected: this.aiMove[0] });
      if (frame === 30) this.update({ target: this.aiMove[1] });
      if (frame === 33) this.launchBattle(...this.aiMove);
    } else if (s.phase === 'battle' && this.animation) {
      const event = this.animation.tick();
      if (event === 'reveal') this.sound('dice');
      if (event === 'reveal' || event === 'total')
        this.update({
          rolls: this.animation.rolls,
          totals: this.animation.totals,
        });
      if (event === 'done') {
        const battle = this.animation.battle;
        const game = applyBattle(s.game!, battle);
        this.animation = null;
        this.sound(battle.won ? 'success' : 'fail');
        const result = gameResult(game);
        this.update({
          game,
          battle: null,
          selected: null,
          target: null,
          rolls: [[], []],
          totals: [null, null],
        });
        if (result)
          this.update({
            mode: result,
            phase: 'result',
            frame: 1,
            notice: result === 'lost' ? 'Game over.' : 'You win!',
          });
        else
          this.startPlayer(
            false,
            `${battle.attackerTotal} to ${battle.defenderTotal}. Territory ${battle.to} ${battle.won ? 'captured' : 'defended'}. `,
          );
      }
    } else if (s.phase === 'supply') {
      if (--this.supplyWait > 0) return;
      if (this.supplyFinished) {
        this.update({ game: advanceTurn(s.game!) });
        this.startPlayer(true);
        return;
      }
      const step = supplyOne(s.game!, this.generator.random);
      this.update({ game: step.game });
      // S149 f2 -> f4 -> f2; f11 -> f23 final pause (secondary runtime trace).
      if (step.id === null) {
        this.supplyFinished = true;
        this.supplyWait = 12;
      } else this.supplyWait = 2;
    }
  };
  /** One RAF loop; replacing a campaign clears all phase state, never schedules old outcomes. */
  runClock(
    request: (fn: (time: number) => void) => number,
    cancel: (id: number) => void,
  ) {
    let id = 0,
      stopped = false,
      previous: number | null = null,
      elapsed = 0;
    const loop = (time: number) => {
      if (stopped) return;
      if (previous !== null) elapsed += Math.min(time - previous, 250);
      previous = time;
      while (elapsed + 1e-7 >= 1000 / 24) {
        elapsed -= 1000 / 24;
        this.tick();
      }
      id = request(loop);
    };
    id = request(loop);
    return () => {
      stopped = true;
      cancel(id);
    };
  }
  publicState() {
    const s = this.view,
      game = s.game;
    const sources = this.availableSources();
    return {
      status: s.mode,
      phase: s.phase,
      selected: s.selected,
      target: s.target,
      currentPlayer: game?.turnOrder.length ? currentPlayer(game) : null,
      validSources: sources,
      validAttacks: game
        ? sources.flatMap((from) =>
            validTargets(game, from).map((to) => ({ from, to })),
          )
        : [],
      canEndTurn:
        s.mode === 'playing' && ['source', 'target'].includes(s.phase),
      territories: game?.territories
        .filter((t) => t.size)
        .map((t) => ({
          id: t.id,
          owner: t.owner,
          dice: t.dice,
          neighbors: t.neighbors,
        })),
      players: game?.players.slice(0, game.playerCount),
      historyLength: game?.events.length ?? 0,
    };
  }
}

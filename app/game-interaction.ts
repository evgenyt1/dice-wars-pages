import type { GameController } from './game-controller.ts';
import { THEMES } from './game-presentation.ts';
import type { GameTheme } from './game-presentation.ts';

/** The confirmation blocks input, never the game clock or automatic turns. */
export class GameInteraction {
  confirmationOpen = false;
  private theme: GameTheme = 'original';
  private themeListeners = new Set<() => void>();
  getTheme = () => this.theme;
  subscribeTheme = (listener: () => void) => {
    this.themeListeners.add(listener);
    return () => {
      this.themeListeners.delete(listener);
    };
  };
  setTheme(theme: GameTheme) {
    if (theme === this.theme) return;
    this.theme = theme;
    for (const listener of this.themeListeners) listener();
  }
  readonly controller: GameController;
  constructor(controller: GameController) {
    this.controller = controller;
  }
  setConfirmation(open: boolean) {
    this.confirmationOpen = open;
  }
  get blocked() {
    return (
      this.confirmationOpen && this.controller.getSnapshot().mode === 'playing'
    );
  }
  publicState = () => {
    const current = this.controller.publicState();
    const state = {
      ...current,
      playerPalette: THEMES[this.theme].palette,
      theme: this.theme,
      humanPlayer: 0,
    };
    return this.blocked
      ? {
          ...state,
          confirmation: 'leave-game',
          validSources: [],
          validAttacks: [],
          canEndTurn: false,
        }
      : { ...state, confirmation: null };
  };
  territory = (id: number) => {
    if (!this.blocked) this.controller.territory(id);
  };
  endTurn = () => {
    if (!this.blocked) this.controller.endTurn();
  };
  attack = (from: number, to: number) => {
    if (this.blocked)
      throw new Error('Close the leave-game confirmation before attacking.');
    return this.controller.attack(from, to);
  };
  startNewGame = (count: number) => {
    this.confirmationOpen = false;
    return this.controller.startNewGame(count);
  };
}

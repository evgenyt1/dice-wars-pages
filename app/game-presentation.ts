import { assetUrl } from './asset-url.ts';
import {
  CLASSIC_GRID,
  PLAYER_COLORS,
  PLAYER_NAMES,
  cellEdge,
  neighborOf,
} from './game-engine.ts';
import type { GameState, GridGeometry, Territory } from './game-engine.ts';

export const DICE_ART_URL = assetUrl('game-assets/vector/symbols.svg');

/** Original Flash identities. Human player remains engine owner 0 (Violet). */
export const PLAYER_PALETTE = PLAYER_COLORS.map((color, owner) => ({
  name: PLAYER_NAMES[owner],
  color,
}));

export type GameTheme = 'original' | 'midnight';
export const MIDNIGHT_DICE_ART_URL = assetUrl(
  'game-assets/vector/midnight.svg?v=larger-bold-resin',
);
export const THEMES = {
  original: {
    name: 'Original',
    palette: PLAYER_PALETTE,
    diceUrl: DICE_ART_URL,
    background: '#14121b',
    selectedFill: '#000000',
    selectedStroke: '#ff0000',
    logo: assetUrl('game-assets/dicefront-duel.svg'),
  },
  midnight: {
    name: 'Midnight',
    palette: [
      { name: 'Blue', color: '#487ae8' },
      { name: 'Orange', color: '#ff902c' },
      { name: 'Pink', color: '#f5a5d3' },
      { name: 'Forest', color: '#126c43' },
      { name: 'Violet', color: '#8c50d7' },
      { name: 'Ice', color: '#b7f3ee' },
      { name: 'Yellow', color: '#f7e33d' },
      { name: 'Crimson', color: '#c62f46' },
    ],
    diceUrl: MIDNIGHT_DICE_ART_URL,
    background: '#11191f',
    selectedFill: '#27323b',
    selectedStroke: '#f3ecd7',
    logo: assetUrl('game-assets/dicefront-duel.svg'),
  },
} as const;

export function diceHref(
  theme: GameTheme,
  kind: 'face' | 'stack',
  owner: number,
  count: number,
) {
  const symbol =
    theme === 'original'
      ? `vs${kind === 'face' ? 43 : 124}-f${owner * 10 + count}`
      : `${kind}-${owner}-${count}`;
  return `${THEMES[theme].diceUrl}#${symbol}`;
}

const HUD_DARK_INK = '#14121b';
const HUD_LIGHT_INK = '#ffffff';
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
/** Text color for a number drawn on a player's color chip. */
export function hudInk(color: string) {
  return contrastRatio(color, HUD_DARK_INK) >=
    contrastRatio(color, HUD_LIGHT_INK)
    ? HUD_DARK_INK
    : HUD_LIGHT_INK;
}

export function playerTerritoryLabel(
  game: GameState,
  id: number,
  theme: GameTheme = 'original',
) {
  const territory = game.territories[id];
  const owner = `${territory.owner === 0 ? 'You, ' : ''}${THEMES[theme].palette[territory.owner].name}`;
  return `Territory ${id}: ${owner}, ${territory.dice} ${territory.dice === 1 ? 'die' : 'dice'}`;
}

/** Draw each shared interior edge once. This never replaces the legal outline. */
export function interiorHexPath(
  territory: Territory,
  grid: GridGeometry = CLASSIC_GRID,
): string {
  const cells = new Set(territory.cells);
  const edges: string[] = [];
  for (const cell of cells) {
    for (let direction = 0; direction < 6; direction++) {
      const next = neighborOf(cell, direction, grid);
      if (next <= cell || !cells.has(next)) continue;
      const [x1, y1, x2, y2] = cellEdge(cell, direction, grid);
      edges.push(`M${x1},${y1}L${x2},${y2}`);
    }
  }
  return edges.join('');
}

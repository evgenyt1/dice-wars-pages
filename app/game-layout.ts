import {
  CELL_COUNT,
  CELL_HEIGHT,
  CELL_WIDTH,
  CLASSIC_GRID,
  cellOrigin,
  gridForColumns,
} from './game-engine.ts';
import type { GridGeometry, Territory } from './game-engine.ts';

export const MAP_ORIGIN = { x: 26.25, y: 68.5 };
export const STACK_SCALE = 0.80233765;
export const STACK_DISPLAY_SCALE = 1.18;
export const STACK_BASE = { x: 22.75, y: 28.75 };

/** Choose grid shape before acceptance; fitting itself never consumes game RNG. */
export function gridForViewport(width: number, height: number): GridGeometry {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return CLASSIC_GRID;
  const target = width / height;
  let best = CLASSIC_GRID,
    error = Infinity;
  for (let columns = 12; columns <= 64; columns++) {
    const rows = Math.ceil(CELL_COUNT / columns);
    // Include odd-row offset and space above stacks at the top of the field.
    const ratio =
      ((columns + 0.5) * CELL_WIDTH + 20) / (rows * CELL_HEIGHT + 70);
    const difference = Math.abs(Math.log(ratio / target));
    if (difference < error) {
      best = gridForColumns(columns);
      error = difference;
    }
  }
  return best;
}

/**
 * A campaign's camera depends only on its fixed geometry, never on the viewport,
 * ownership, dice count, selection or phase. Reserve the complete S124 canvas at
 * every stack so reinforcement/animation cannot move or clip the camera.
 * CSS and SVG's xMidYMid meet fit this rectangle without touching the generator.
 */
export function mapBounds(
  territories: readonly Territory[],
  grid: GridGeometry = CLASSIC_GRID,
) {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  const include = (x: number, y: number) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  };
  for (const territory of territories) {
    if (!territory.size) continue;
    for (const cell of territory.cells) {
      const [x, y] = cellOrigin(cell, grid);
      include(x, y - 3);
      include(x + CELL_WIDTH, y + CELL_HEIGHT + 3);
    }
    const [x, y] = cellOrigin(territory.centerCell, grid);
    for (const [sx, sy] of [
      [-11.5, -53.05],
      [59.15, 28.75],
    ]) {
      include(
        x +
          STACK_SCALE *
            (STACK_BASE.x + STACK_DISPLAY_SCALE * (sx - STACK_BASE.x)),
        y +
          STACK_SCALE *
            (STACK_BASE.y + STACK_DISPLAY_SCALE * (sy - STACK_BASE.y)),
      );
    }
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 800, height: 460 };
  // Selection lift, settle animation, borders, shadows and keyboard focus glow.
  const padding = 10;
  return {
    x: MAP_ORIGIN.x + left - padding,
    y: MAP_ORIGIN.y + top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  };
}

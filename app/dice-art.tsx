import { memo } from 'react';
import data from './dice-art.json';
import type { GameTheme } from './game-presentation';

type DrawPath = {
  path: number;
  fill: string;
  transform: string;
  fillOpacity?: string;
};
const frames: Record<string, DrawPath[]> = data.frames;

/** Direct paths stay in the document; frame updates never load external SVGs. */
export const DiceArtwork = memo(function DiceArtwork({
  theme,
  kind,
  owner,
  count,
}: {
  theme: GameTheme;
  kind: 'face' | 'stack';
  owner: number;
  count: number;
}) {
  return (
    <g fillRule="evenodd" stroke="none">
      {frames[`${theme}-${kind}-${owner}-${count}`].map(
        ({ path, ...props }, i) => (
          <path key={i} d={data.paths[path]} {...props} />
        ),
      )}
    </g>
  );
});

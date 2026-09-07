/* SVG groups preserve the original transformed hit regions; SVG has no native button element. */
/* eslint-disable jsx-a11y/prefer-tag-over-role */
import { Fragment, type ReactNode, useState } from 'react';
import data from './flash-art.json';

type Placement = {
  characterId: number;
  depth: number;
  matrix: number[];
  name?: string;
  colorTransform?: { alphaMultTerm?: string };
};
export const art = data as unknown as {
  assets: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
  scenes: Record<string, Placement[][]>;
  placements: Placement[];
  rollPlacements: Placement[];
  fields: Record<
    string,
    {
      fontId: string;
      size: number;
      align: number;
      x: number;
      y: number;
      width: number;
      ascent: number;
    }
  >;
  glyphs: Record<string, { path: string; advance: number }>;
};
export function Vector({ symbol }: { symbol: string | number }) {
  const asset = art.assets[symbol];
  if (!asset) return null;
  return (
    <use
      href={`./game-assets/vector/symbols.svg#v${symbol}`}
      pointerEvents="none"
    />
  );
}
export function Transform({
  matrix,
  children,
}: {
  matrix: number[];
  children: ReactNode;
}) {
  return <g transform={`matrix(${matrix.join(' ')})`}>{children}</g>;
}
export function Digits({
  field,
  value,
  color = '#000000',
}: {
  field: number;
  value: number | string;
  color?: string;
}) {
  const f = art.fields[field];
  const glyphs = String(value)
    .split('')
    .map((c) => art.glyphs[`${f.fontId}:${c}`]);
  const scale = f.size / 1024;
  const total = glyphs.reduce((n, g) => n + g.advance, 0) * scale;
  const x =
    f.x +
    2 +
    (f.align === 2
      ? (f.width - 4 - total) / 2
      : f.align === 1
        ? f.width - 4 - total
        : 0);
  const y = f.y + 2 + Math.round(f.ascent * scale * 20) / 20;
  return (
    <g
      fill={color}
      pointerEvents="none"
      transform={`translate(${x} ${y}) scale(${scale})`}
    >
      {glyphs.map((glyph, i) => {
        const offset = glyphs
          .slice(0, i)
          .reduce((sum, g) => sum + g.advance, 0);
        return (
          <path key={i} d={glyph.path} transform={`translate(${offset} 0)`} />
        );
      })}
    </g>
  );
}
export function FlashButton({
  id,
  label,
  action,
  press,
  selected,
}: {
  id: number;
  label: string;
  action: () => void;
  press?: () => void;
  selected?: boolean;
}) {
  const [keyboardDown, setKeyboardDown] = useState(false);
  const hit = art.assets[`b${id}-4_hittest`];
  return (
    <g
      className={`flash-button ${keyboardDown ? 'key-down' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={(e) => {
        if (e.button === 0) press?.();
      }}
      onClick={action}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          setKeyboardDown(true);
          press?.();
        }
      }}
      onKeyUp={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && keyboardDown) {
          e.preventDefault();
          setKeyboardDown(false);
          action();
        }
      }}
      onBlur={() => setKeyboardDown(false)}
    >
      <g className="button-up">
        <Vector symbol={`b${id}-1_up`} />
      </g>
      <g className="button-over">
        <Vector symbol={`b${id}-2_over`} />
      </g>
      <g className="button-down">
        <Vector symbol={`b${id}-3_down`} />
      </g>
      <image
        className="button-hit"
        href={`./game-assets/vector/b${id}-4_hittest.svg`}
        x={hit.x}
        y={hit.y}
        width={hit.width}
        height={hit.height}
        opacity={0}
      />
    </g>
  );
}
/** Compiled authored compositions only; application behavior lives in the native controller. */
export function Scene({
  id,
  frame = 1,
  render,
}: {
  id: number;
  frame?: number;
  render?: (p: Placement, scene: number) => ReactNode | undefined;
}) {
  const frames = art.scenes[id];
  const placements = frames[Math.min(frame, frames.length) - 1];
  return (
    <>
      {placements.map((p) => {
        const override = render?.(p, id);
        const body =
          override !== undefined ? (
            override
          ) : art.scenes[p.characterId] ? (
            <Scene id={p.characterId} render={render} />
          ) : (
            <Vector symbol={p.characterId} />
          );
        return (
          <g
            key={p.depth}
            transform={`matrix(${p.matrix.join(' ')})`}
            opacity={
              p.colorTransform?.alphaMultTerm === undefined
                ? 1
                : Number(p.colorTransform.alphaMultTerm) / 256
            }
          >
            {body}
          </g>
        );
      })}
    </>
  );
}
export function TitleArt({
  count,
  dice,
  choose,
  play,
  press,
}: {
  count: number;
  dice: { owner: number; face: number }[];
  choose: (n: number) => void;
  play: () => void;
  press?: () => void;
}) {
  return (
    <Transform matrix={[1.0001373, 0, 0, 1.0006561, 0, -20]}>
      <Scene
        id={54}
        render={(p, parent) => {
          if (p.characterId === 16 || p.characterId === 19)
            return (
              <FlashButton
                id={p.characterId}
                label={p.characterId === 16 ? 'Play' : 'Top page'}
                press={press}
                action={
                  p.characterId === 16
                    ? play
                    : () =>
                        window.open(
                          'http://www.gamedesign.jp/',
                          '_blank',
                          'noopener,noreferrer',
                        )
                }
              />
            );
          if (p.characterId === 43) {
            const index = Number(p.name?.slice(2));
            const die = dice[index];
            return die ? (
              <Vector symbol={`s43-f${die.owner * 10 + die.face}`} />
            ) : null;
          }
          if (p.characterId === 50 && parent === 52) {
            const n = Number(p.name?.slice(1)) + 2;
            return (
              <Fragment>
                <FlashButton
                  id={48}
                  label={`${n} players`}
                  selected={count === n}
                  action={() => choose(n)}
                />
                <Transform matrix={[1, 0, 0, 1, 2, 1.5]}>
                  <Digits
                    field={49}
                    value={n}
                    color={count === n ? '#cc0000' : '#999999'}
                  />
                </Transform>
              </Fragment>
            );
          }
        }}
      />
    </Transform>
  );
}

/* SVG artwork has no native image element that retains its vector children. */
/* eslint-disable jsx-a11y/prefer-tag-over-role */
import { useLayoutEffect, useRef } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { TitleDie } from './game-controller';
import { THEMES } from './game-presentation';
import { DiceArtwork } from './dice-art';
import type { GameTheme } from './game-presentation';

export function Die({
  owner,
  face = 1,
  theme,
}: {
  owner: number;
  face?: number;
  theme: GameTheme;
}) {
  return (
    <g pointerEvents="none">
      <DiceArtwork theme={theme} kind="face" owner={owner} count={face} />
    </g>
  );
}

/** A new roll face updates paths without replacing the displayed die. */
export function RollingDie({
  owner,
  face,
  theme,
  reduced,
  duration,
}: {
  owner: number;
  face: number;
  theme: GameTheme;
  reduced: boolean;
  duration: number;
}) {
  const rotation = useRef<SVGAnimateTransformElement>(null);
  const scale = useRef<SVGAnimateTransformElement>(null);
  useLayoutEffect(() => {
    rotation.current?.beginElement();
    scale.current?.beginElement();
  }, [owner, face, reduced, duration]);
  const timing = {
    attributeName: 'transform',
    dur: `${duration}ms`,
    begin: 'indefinite',
    fill: 'remove',
    calcMode: 'spline',
    keyTimes: '0; 1',
    keySplines: '0 0 0.58 1',
  } as const;
  return (
    <g className="roll-die">
      <g>
        <Die theme={theme} owner={owner} face={face} />
        {!reduced && (
          <animateTransform
            ref={scale}
            type="scale"
            values="0.9; 1"
            {...timing}
          />
        )}
      </g>
      {!reduced && (
        <animateTransform
          ref={rotation}
          type="rotate"
          values="-6; 0"
          {...timing}
        />
      )}
    </g>
  );
}

/** Keep resident paths mounted while reinforcement updates their attributes. */
export function DiceStack({
  owner,
  count,
  theme,
  reduced,
}: {
  owner: number;
  count: number;
  theme: GameTheme;
  reduced: boolean;
}) {
  const motion = useRef<SVGAnimateTransformElement>(null);
  useLayoutEffect(() => {
    // Native SVG transforms avoid WebKit's CSS animation/filter compositing path.
    // Only restart the motion; frame paths update synchronously in this commit.
    motion.current?.beginElement();
  }, [owner, count, reduced]);
  return (
    <g className="stack-art">
      <DiceArtwork theme={theme} kind="stack" owner={owner} count={count} />
      {!reduced && (
        <animateTransform
          ref={motion}
          attributeName="transform"
          type="translate"
          values="0 -4; 0 1; 0 0"
          keyTimes="0; 0.75; 1"
          calcMode="spline"
          keySplines="0 0 0.58 1; 0 0 0.58 1"
          dur="160ms"
          begin="indefinite"
          fill="remove"
        />
      )}
    </g>
  );
}

/** Sound remains a press event; the action remains a native release/click. */
export function GameButton({
  press,
  onPointerDown,
  onKeyDown,
  ...props
}: ComponentPropsWithRef<'button'> & { press?: () => void }) {
  return (
    <button
      type="button"
      {...props}
      onPointerDown={(e) => {
        if (e.button === 0) press?.();
        onPointerDown?.(e);
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) press?.();
        onKeyDown?.(e);
      }}
    />
  );
}

export function MidnightTitle({
  theme,
  count,
  dice,
  choose,
  play,
  press,
}: {
  theme: GameTheme;
  count: number;
  dice: TitleDie[];
  choose: (count: number) => void;
  play: () => void;
  press: () => void;
}) {
  const placements = [
    'translate(128 140) rotate(-15) scale(.41)',
    'translate(263 132) rotate(17) scale(.36)',
    'translate(208 233) rotate(-8) scale(.4)',
  ];
  return (
    <>
      <div className="title-scene">
        <div className="title-copy">
          <h1 className="wordmark" aria-label="Dicefront">
            <span>DICE</span>
            <span>FRONT</span>
          </h1>
          <div className="player-picker">
            <div className="picker-title">
              <span>Players</span>
              <span>
                You + {count - 1} {count === 2 ? 'bot' : 'bots'}
              </span>
            </div>
            <div
              className="player-counts"
              role="group"
              aria-label="Number of players"
            >
              {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} players`}
                  aria-pressed={count === n}
                  onClick={() => choose(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <GameButton
            className="primary-button play-button"
            press={press}
            onClick={play}
          >
            Play
            <ArrowRight size={19} aria-hidden="true" />
          </GameButton>
        </div>
        <div className="title-art">
          <svg
            className="hero-dice"
            viewBox="0 0 380 340"
            role="img"
            aria-label="Three colored dice"
          >
            {dice.map((die, i) => (
              <g key={i} transform={placements[i]}>
                <g className={`hero-die hero-die-${i}`}>
                  <Die {...die} theme={theme} />
                </g>
              </g>
            ))}
          </svg>
        </div>
      </div>
      <footer className="title-footer">
        <div className="palette-dots" aria-hidden="true">
          {THEMES[theme].palette.map(({ color }) => (
            <span key={color} style={{ background: color }} />
          ))}
        </div>
      </footer>
    </>
  );
}

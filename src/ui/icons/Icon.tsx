import { ICON_PATHS, type IconName } from './paths';

export type { IconName };

/** Monochrome game-icons glyph, tinted via `color`/currentColor. */
export function Icon({
  name,
  size = 20,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const def = ICON_PATHS[name];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {def.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

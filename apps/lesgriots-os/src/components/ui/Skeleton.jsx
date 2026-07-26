'use client';
/**
 * Skeleton — placeholder animé pour états de chargement.
 *
 * Props :
 *   width  : largeur (number en px ou string CSS) — default '100%'
 *   height : hauteur (number en px ou string CSS) — default 12
 *   radius : arrondi — default 'var(--radius-sm)'
 *   block  : display block (true) ou inline-block — default true
 */
export default function Skeleton({
  width = '100%',
  height = 12,
  radius = 'var(--radius-sm)',
  block = true,
  style = {},
  className = '',
}) {
  return (
    <span
      aria-hidden="true"
      className={`lg-skeleton ${className}`}
      style={{
        display: block ? 'block' : 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'lg-skeleton 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/**
 * SkeletonText — bloc multi-lignes pour paragraphes.
 */
export function SkeletonText({ lines = 3, lastWidth = '70%', gap = 8 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastWidth : '100%'}
          height={11}
        />
      ))}
    </div>
  );
}

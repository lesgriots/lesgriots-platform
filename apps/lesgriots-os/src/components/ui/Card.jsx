'use client';
/**
 * Card — surface de base pour blocs/panels.
 * Variantes :
 *   - default : surface neutre (bordure --border)
 *   - subtle  : pas de bordure visible (utiliser dans une grille déjà délimitée)
 *   - accent  : bordure gauche colorée (--accent-color)
 *   - alert   : bordure gauche orange (warning)
 *   - pillar  : bordure haut colorée (pour les cards des piliers)
 *
 * Props additionnelles :
 *   - interactive : ajoute hover + focus ring
 *   - padding     : 'sm' | 'md' (default) | 'lg' | 'none'
 *   - href        : si fourni, renvoie un <Link>
 */
import Link from 'next/link';

const PADDING = {
  none: 0,
  sm: 'var(--sp-3)',
  md: 'var(--sp-5)',
  lg: 'var(--sp-6) var(--sp-6) var(--sp-6) var(--sp-6)',
};

export default function Card({
  variant = 'default',
  accentColor,
  pillarColor,
  interactive = false,
  padding = 'md',
  href,
  className = '',
  style = {},
  children,
  ...rest
}) {
  const base = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: PADDING[padding] ?? PADDING.md,
    transition: 'border-color var(--duration) var(--ease), background var(--duration) var(--ease), transform var(--duration) var(--ease)',
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    position: 'relative',
  };

  const variantStyle = {
    default: {},
    subtle:  { border: '1px solid transparent', background: 'var(--surface)' },
    accent:  { borderLeft: `3px solid ${accentColor || 'var(--gold)'}` },
    alert:   { borderLeft: '3px solid var(--warning)' },
    pillar:  { borderTop: `3px solid ${pillarColor || 'var(--gold)'}` },
  }[variant] || {};

  const interactiveStyle = interactive ? {
    cursor: 'pointer',
  } : {};

  const onMouseEnter = interactive ? (e) => {
    e.currentTarget.style.borderColor = 'var(--border-2)';
    e.currentTarget.style.background = 'var(--surface-2)';
    e.currentTarget.style.transform = 'translateY(-1px)';
  } : undefined;

  const onMouseLeave = interactive ? (e) => {
    e.currentTarget.style.borderColor = variant === 'pillar' ? 'var(--border)' : (variantStyle.borderLeft ? 'var(--border)' : 'var(--border)');
    e.currentTarget.style.background = 'var(--surface)';
    e.currentTarget.style.transform = 'translateY(0)';
  } : undefined;

  const merged = { ...base, ...variantStyle, ...interactiveStyle, ...style };

  if (href) {
    return (
      <Link href={href} className={className} style={merged}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <div className={className} style={merged}
         onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...rest}>
      {children}
    </div>
  );
}

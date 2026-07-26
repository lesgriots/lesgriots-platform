'use client';
/**
 * StatusDot — petit indicateur coloré pour items de liste.
 *
 * Props :
 *   tone : 'success' | 'danger' | 'warning' | 'info' | 'neutral' (def) | 'gold'
 *         OU une couleur CSS arbitraire passée en `color`
 *   color : override direct
 *   size  : diamètre en px (default 6)
 *   pulse : true pour ajouter une pulsation (alertes vivantes)
 */

const TONE = {
  success: 'var(--success)',
  danger:  'var(--danger)',
  warning: 'var(--warning)',
  info:    'var(--info)',
  neutral: 'var(--text-3)',
  gold:    'var(--gold)',
};

export default function StatusDot({
  tone = 'neutral',
  color,
  size = 6,
  pulse = false,
  style = {},
}) {
  const fill = color || TONE[tone] || TONE.neutral;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: fill,
        flexShrink: 0,
        display: 'inline-block',
        animation: pulse ? 'lg-pulse 1.6s ease-in-out infinite' : 'none',
        boxShadow: pulse ? `0 0 0 2px color-mix(in srgb, ${fill} 20%, transparent)` : 'none',
        ...style,
      }}
    />
  );
}

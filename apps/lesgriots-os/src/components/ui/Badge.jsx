'use client';
/**
 * Badge — chip compact pour stages, piliers, statuts, tags.
 *
 * Props :
 *   tone : 'neutral' (def) | 'success' | 'danger' | 'warning' | 'info' | 'gold' | 'pillar'
 *   pillar : 'STUDIO' | 'PROD' | 'GRIOTHEQUE' (utilisé si tone='pillar')
 *   size : 'sm' (def) | 'md'
 *   variant : 'soft' (def) | 'solid' | 'outline'
 *   mono : utilise font-mono pour codes (true par défaut si children est un code)
 */

const TONE = {
  neutral: { fg: 'var(--text-2)', bg: 'var(--surface-3)', border: 'var(--border)' },
  success: { fg: 'var(--success)', bg: 'var(--success-soft)', border: 'var(--success)' },
  danger:  { fg: 'var(--danger)',  bg: 'var(--danger-soft)',  border: 'var(--danger)' },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)', border: 'var(--warning)' },
  info:    { fg: 'var(--info)',    bg: 'var(--info-soft)',    border: 'var(--info)' },
  gold:    { fg: 'var(--gold)',    bg: 'var(--gold-soft)',    border: 'var(--gold)' },
};

const PILLAR_TONE = {
  STUDIO:     { fg: 'var(--pillar-studio)',     bg: 'color-mix(in srgb, var(--pillar-studio) 12%, transparent)' },
  PROD:       { fg: 'var(--pillar-prod)',       bg: 'color-mix(in srgb, var(--pillar-prod) 12%, transparent)' },
  GRIOTHEQUE: { fg: 'var(--pillar-griotheque)', bg: 'color-mix(in srgb, var(--pillar-griotheque) 12%, transparent)' },
};

export default function Badge({
  tone = 'neutral',
  pillar,
  size = 'sm',
  variant = 'soft',
  mono = false,
  style = {},
  children,
}) {
  const t = (tone === 'pillar' && pillar) ? PILLAR_TONE[pillar] : TONE[tone];
  const palette = t || TONE.neutral;

  const sizeStyle = size === 'md'
    ? { padding: '4px 10px', fontSize: 12 }
    : { padding: '2px 8px',  fontSize: 10 };

  const variantStyle = {
    soft:    { background: palette.bg, color: palette.fg, border: '1px solid transparent' },
    solid:   { background: palette.fg, color: 'var(--bg)', border: '1px solid transparent' },
    outline: { background: 'transparent', color: palette.fg, border: `1px solid ${palette.border || palette.fg}` },
  }[variant] || {};

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      fontWeight: 500,
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      ...sizeStyle,
      ...variantStyle,
      ...style,
    }}>
      {children}
    </span>
  );
}

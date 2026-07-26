'use client';
/**
 * AlertChip — chip d'alerte cliquable pour la barre "À traiter".
 * Utilise Badge sous le capot mais ajoute la dimension actionnable.
 *
 * Props :
 *   tone : 'danger' | 'warning' | 'info' | 'gold'
 *   label : texte principal
 *   detail : sous-texte mono (montant, contexte)
 *   href : lien optionnel
 *   icon : élément optionnel
 */
import Link from 'next/link';

const TONE = {
  danger:  { bg: 'var(--danger-soft)',  fg: 'var(--danger)',  hoverBg: 'var(--danger)',  hoverFg: 'var(--on-solid)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', hoverBg: 'var(--warning)', hoverFg: 'var(--bg)' },
  info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',    hoverBg: 'var(--info)',    hoverFg: 'var(--on-solid)' },
  gold:    { bg: 'var(--gold-soft)',    fg: 'var(--gold)',    hoverBg: 'var(--gold)',    hoverFg: 'var(--bg)' },
};

export default function AlertChip({
  tone = 'warning',
  label,
  detail,
  href,
  icon,
  onClick,
}) {
  const t = TONE[tone] || TONE.warning;

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderRadius: 'var(--radius-md)',
    background: t.bg, color: t.fg,
    fontSize: 12, fontWeight: 500,
    cursor: (href || onClick) ? 'pointer' : 'default',
    border: '1px solid transparent',
    transition: 'background var(--duration) var(--ease), color var(--duration) var(--ease), transform var(--duration-fast) var(--ease)',
    textDecoration: 'none',
  };

  const onMouseEnter = (href || onClick) ? (e) => {
    e.currentTarget.style.background = t.hoverBg;
    e.currentTarget.style.color = t.hoverFg;
    e.currentTarget.style.transform = 'translateY(-1px)';
  } : undefined;
  const onMouseLeave = (href || onClick) ? (e) => {
    e.currentTarget.style.background = t.bg;
    e.currentTarget.style.color = t.fg;
    e.currentTarget.style.transform = 'translateY(0)';
  } : undefined;

  const inner = (
    <>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{label}</span>
      {detail && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          opacity: 0.85,
          paddingLeft: 6,
          borderLeft: `1px solid currentColor`,
          marginLeft: 2,
        }}>{detail}</span>
      )}
      {(href || onClick) && (
        <span style={{ opacity: 0.7, marginLeft: 2, transition: 'transform var(--duration) var(--ease)' }}>→</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} style={base}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} style={{ ...base, fontFamily: 'inherit' }}
              onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {inner}
      </button>
    );
  }
  return <span style={base}>{inner}</span>;
}

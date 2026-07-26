'use client';
/**
 * KpiCard — carte de métrique pour Mission Control et dashboards.
 *
 * Props :
 *   label    : libellé court (uppercase, mono)
 *   value    : valeur principale (nombre/string formaté)
 *   tone     : 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'gold'
 *   hint     : sous-texte optionnel (delta, contexte)
 *   trend    : 'up' | 'down' | 'flat' (optionnel — affiche un caret coloré)
 *   trendLabel : texte du trend (ex. "+12% vs mois dernier")
 *   href     : si fourni, la card devient cliquable
 *   icon     : élément optionnel à afficher en haut à droite
 *   loading  : remplace par un skeleton si true
 */
import Link from 'next/link';
import Skeleton from './Skeleton';

const TONE_COLOR = {
  neutral: 'var(--text)',
  success: 'var(--success)',
  danger:  'var(--danger)',
  warning: 'var(--warning)',
  info:    'var(--info)',
  gold:    'var(--gold)',
};

const TREND = {
  up:   { symbol: '▲', color: 'var(--success)' },
  down: { symbol: '▼', color: 'var(--danger)'  },
  flat: { symbol: '–', color: 'var(--text-3)'  },
};

export default function KpiCard({
  label,
  value,
  tone = 'neutral',
  hint,
  trend,
  trendLabel,
  href,
  icon,
  loading = false,
  style = {},
}) {
  const valueColor = TONE_COLOR[tone] || TONE_COLOR.neutral;

  const base = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 22px 22px',
    minHeight: 136,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textDecoration: 'none',
    transition: 'border-color var(--duration) var(--ease), background var(--duration) var(--ease), transform var(--duration) var(--ease)',
    ...style,
  };

  const onMouseEnter = href ? (e) => {
    e.currentTarget.style.borderColor = 'var(--border-2)';
    e.currentTarget.style.background = 'var(--surface-2)';
    e.currentTarget.style.transform = 'translateY(-1px)';
  } : undefined;
  const onMouseLeave = href ? (e) => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.background = 'var(--surface)';
    e.currentTarget.style.transform = 'translateY(0)';
  } : undefined;

  if (loading) {
    return (
      <div style={base}>
        <Skeleton width="60%" height={11} />
        <Skeleton width="80%" height={28} style={{ marginTop: 12 }} />
        <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
      </div>
    );
  }

  const inner = (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span className="eyebrow">{label}</span>
        {icon && <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>{icon}</span>}
      </div>

      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 300,
        fontSize: 'var(--text-4xl)',
        lineHeight: 0.95,
        letterSpacing: 'var(--tracking-tight)',
        color: valueColor,
        fontFeatureSettings: '"tnum"',
        margin: '16px 0 0',
      }}>
        {value}
      </div>

      {(hint || trend) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 10,
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
        }}>
          {trend && TREND[trend] && (
            <span style={{
              color: TREND[trend].color, fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)', fontWeight: 600,
            }}>
              {TREND[trend].symbol} {trendLabel || ''}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
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
  return <div style={base}>{inner}</div>;
}

'use client';
/**
 * DisciplinesPicker — Sélecteur multi-cases des 3 disciplines créatives LES GRIOTS.
 *
 * Usage : sur la fiche projet, permet de cocher Image, Stories, Movement (ou les 3).
 * Sauvegarde via callback onChange dès qu'une discipline change d'état.
 *
 * Props :
 *   value    : array de keys (ex: ['image', 'movement'])
 *   onChange : (newValue: string[]) => void
 *   size     : 'sm' | 'md' (default 'md')
 *   readonly : si true, affiche en lecture seule sans interaction
 */
import { DISCIPLINES } from '@/lib/constants';

export default function DisciplinesPicker({
  value = [],
  onChange,
  size = 'md',
  readonly = false,
}) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (key) => {
    if (readonly || !onChange) return;
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    onChange(next);
  };

  return (
    <div style={{
      display: 'flex',
      gap: size === 'sm' ? 6 : 8,
      flexWrap: 'wrap',
    }}>
      {DISCIPLINES.map(d => {
        const isActive = selected.includes(d.key);
        const sizeStyles = size === 'sm'
          ? { padding: '4px 10px', fontSize: 11, gap: 4 }
          : { padding: '8px 14px', fontSize: 13, gap: 6 };
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => toggle(d.key)}
            disabled={readonly}
            title={d.description}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              ...sizeStyles,
              fontFamily: 'var(--font-sans)',
              fontWeight: isActive ? 600 : 400,
              background: isActive ? d.color : 'transparent',
              color: isActive ? 'var(--on-solid)' : 'var(--text-2)',
              border: '1px solid ' + (isActive ? d.color : 'var(--border)'),
              borderRadius: 'var(--radius-sm)',
              cursor: readonly ? 'default' : 'pointer',
              transition: 'all var(--duration) var(--ease)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!readonly && !isActive) {
                e.currentTarget.style.borderColor = d.color;
                e.currentTarget.style.color = d.color;
              }
            }}
            onMouseLeave={e => {
              if (!readonly && !isActive) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-2)';
              }
            }}
          >
            <span style={{ fontSize: size === 'sm' ? 12 : 14 }}>{d.icon}</span>
            <span>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * DisciplinesBadges — Affichage compact des disciplines en badges (pour cards).
 */
export function DisciplinesBadges({ disciplines = [], size = 'sm' }) {
  if (!Array.isArray(disciplines) || disciplines.length === 0) return null;
  const sizeStyles = size === 'sm'
    ? { padding: '2px 6px', fontSize: 9, gap: 3 }
    : { padding: '3px 8px', fontSize: 10, gap: 4 };

  return (
    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {disciplines.map(key => {
        const d = DISCIPLINES.find(x => x.key === key);
        if (!d) return null;
        return (
          <span
            key={key}
            title={d.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              ...sizeStyles,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              background: d.color,
              color: 'var(--on-solid)',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{d.icon}</span>
            <span>{d.label}</span>
          </span>
        );
      })}
    </div>
  );
}

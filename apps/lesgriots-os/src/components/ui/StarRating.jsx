'use client';
/**
 * StarRating — notation 5 étoiles cliquables (ou lecture seule).
 *
 * Props :
 *   value : nombre de 0 à 5 (peut être 0.5, 1.5, etc. — affichage demi-étoile)
 *   onChange : optionnel — fonction (newValue) ; si absent, mode lecture seule
 *   size : taille en px (default 18)
 *   color : couleur des étoiles pleines (default --gold)
 */
import { useState } from 'react';

export default function StarRating({ value = 0, onChange, size = 18, color = 'var(--gold)' }) {
  const [hover, setHover] = useState(0);
  const editable = typeof onChange === 'function';
  const display = hover || value;

  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = display >= i;
        const half = !filled && display >= i - 0.5;
        return (
          <span
            key={i}
            onMouseEnter={editable ? () => setHover(i) : undefined}
            onMouseLeave={editable ? () => setHover(0) : undefined}
            onClick={editable ? () => onChange(value === i ? 0 : i) : undefined}
            style={{
              width: size, height: size,
              cursor: editable ? 'pointer' : 'default',
              color: filled || half ? color : 'var(--border-2)',
              fontSize: size, lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color var(--duration) var(--ease), transform var(--duration-fast) var(--ease)',
              transform: editable && hover === i ? 'scale(1.15)' : 'scale(1)',
              userSelect: 'none',
            }}
          >
            {filled ? '★' : half ? '⯨' : '☆'}
          </span>
        );
      })}
      {editable && value > 0 && (
        <button
          onClick={() => onChange(0)}
          style={{
            marginLeft: 6, background: 'transparent', border: 'none',
            color: 'var(--text-3)', fontSize: 10, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
          title="Réinitialiser"
        >
          reset
        </button>
      )}
    </span>
  );
}

'use client';
/**
 * ViewSwitcher — toggle entre plusieurs vues (Liste / Cards / Kanban / Calendrier).
 * Mémorise le choix en localStorage par scope.
 *
 * Usage :
 *   const [view, setView] = useViewMode('projects', 'list');
 *   <ViewSwitcher value={view} onChange={setView} options={['list','cards','kanban']} />
 */
import { useEffect, useState } from 'react';

const ICONS = {
  list:     { glyph: '☰', label: 'Liste' },
  cards:    { glyph: '▦', label: 'Cards' },
  kanban:   { glyph: '⊞', label: 'Kanban' },
  calendar: { glyph: '◰', label: 'Calendrier' },
  timeline: { glyph: '↔', label: 'Timeline' },
  table:    { glyph: '⊟', label: 'Table' },
};

export function useViewMode(scope, fallback = 'list') {
  const key = `lg-view-${scope}`;
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(key);
    if (saved) setValue(saved);
  }, [key]);
  const update = (v) => {
    setValue(v);
    if (typeof window !== 'undefined') localStorage.setItem(key, v);
  };
  return [value, update];
}

export default function ViewSwitcher({ value, onChange, options = ['list', 'cards'], style = {}, labels = {} }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 2,
      gap: 1,
      ...style,
    }} role="tablist" aria-label="Mode d'affichage">
      {options.map(opt => {
        // `labels` permet de renommer une vue sans inventer un nouveau glyphe
        // (ex. « timeline » présenté comme « Tunnel » dans le pipeline).
        const cfg = { ...(ICONS[opt] || { glyph: '?', label: opt }), ...(labels[opt] || {}) };
        const active = value === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            title={cfg.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: active ? 'var(--surface)' : 'transparent',
              border: '1px solid ' + (active ? 'var(--border)' : 'transparent'),
              color: active ? 'var(--text)' : 'var(--text-3)',
              fontSize: 11,
              fontWeight: active ? 500 : 400,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all var(--duration) var(--ease)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>{cfg.glyph}</span>
            <span>{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

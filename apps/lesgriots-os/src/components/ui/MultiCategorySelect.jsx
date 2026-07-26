'use client';
/**
 * MultiCategorySelect — sélection multiple de catégories avec ajout custom.
 *
 * Props :
 *   selected : string[] — catégories actuellement sélectionnées
 *   options  : string[] — catégories proposées
 *   onChange(newSelected[])
 *   onAddCustom(name) : optionnel — pour ajouter une catégorie hors liste
 *   placeholder : texte du bouton "Ajouter"
 */
import { useState, useRef, useEffect } from 'react';

export default function MultiCategorySelect({
  selected = [],
  options = [],
  onChange,
  onAddCustom,
  placeholder = 'Ajouter…',
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef(null);

  // Click outside to close
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = (cat) => {
    if (selected.includes(cat)) {
      onChange(selected.filter(c => c !== cat));
    } else {
      onChange([...selected, cat]);
    }
  };

  const remove = (cat) => onChange(selected.filter(c => c !== cat));

  const addCustom = () => {
    if (!custom.trim()) return;
    const value = custom.trim();
    if (onAddCustom) onAddCustom(value);
    if (!selected.includes(value)) onChange([...selected, value]);
    setCustom('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {selected.map(cat => (
          <span key={cat} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 4px 3px 10px', borderRadius: 999,
            background: 'var(--gold-soft)', color: 'var(--gold-deep)',
            fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)',
            border: '1px solid var(--gold)',
          }}>
            {cat}
            <button onClick={() => remove(cat)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'inherit', padding: '0 4px', fontSize: 13, lineHeight: 1,
              opacity: 0.7,
            }} title="Retirer">×</button>
          </span>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '3px 10px', borderRadius: 999,
            background: 'transparent', color: 'var(--text-2)',
            border: '1px dashed var(--border-2)',
            fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          + {placeholder}
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
          zIndex: 20, minWidth: 220, maxHeight: 320, overflowY: 'auto',
          padding: 4,
        }}>
          {options.map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '6px 10px',
                  background: isSelected ? 'var(--gold-soft)' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 12, color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--duration) var(--ease)',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 3,
                  border: '1.5px solid ' + (isSelected ? 'var(--gold)' : 'var(--border-2)'),
                  background: isSelected ? 'var(--gold)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--gold-ink)', fontSize: 9, flexShrink: 0,
                }}>{isSelected ? '✓' : ''}</span>
                <span>{opt}</span>
              </button>
            );
          })}

          {onAddCustom && (
            <div style={{
              borderTop: '1px solid var(--border)',
              padding: '6px 4px', marginTop: 4,
              display: 'flex', gap: 4,
            }}>
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
                placeholder="Catégorie custom…"
                style={{
                  flex: 1, padding: '4px 8px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                  fontSize: 11, outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                onClick={addCustom}
                disabled={!custom.trim()}
                style={{
                  padding: '4px 8px',
                  background: 'var(--gold)', color: 'var(--surface)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: 11, cursor: custom.trim() ? 'pointer' : 'not-allowed',
                  opacity: custom.trim() ? 1 : 0.5,
                  fontFamily: 'var(--font-sans)', fontWeight: 500,
                }}
              >Ajouter</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

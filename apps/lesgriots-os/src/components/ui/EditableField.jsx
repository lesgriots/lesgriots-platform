'use client';
/**
 * EditableField — input/textarea avec sauvegarde au blur ou Cmd+Enter.
 *
 * Props :
 *   value, onSave(newValue), placeholder
 *   type : 'text' | 'number' | 'date' | 'textarea'
 *   label : optionnel (rendu au-dessus)
 *   hint : sous-texte d'aide
 *   format : pour affichage (ex. currency)
 *   parse : transformation avant save (ex. parseFloat)
 *   readOnlyMode : si true, juste l'affichage (pas d'édition)
 */
import { useEffect, useRef, useState } from 'react';

export default function EditableField({
  value,
  onSave,
  placeholder = '',
  type = 'text',
  label,
  hint,
  format,
  parse,
  rows = 4,
  inputStyle = {},
  containerStyle = {},
  showWhenEmpty = true,
  emptyLabel = 'Cliquer pour éditer…',
}) {
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState(value ?? '');
  const ref = useRef(null);

  useEffect(() => {
    if (!focused) setLocal(value ?? '');
  }, [value, focused]);

  const commit = async () => {
    const parsed = parse ? parse(local) : local;
    if (parsed === value) return;
    try {
      await onSave(parsed);
    } catch (e) {
      setLocal(value ?? ''); // rollback
    }
  };

  const onKeyDown = (e) => {
    if (type === 'textarea') {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
    } else if (e.key === 'Enter') {
      e.preventDefault(); ref.current?.blur();
    }
    if (e.key === 'Escape') {
      setLocal(value ?? '');
      setTimeout(() => ref.current?.blur(), 10);
    }
  };

  const baseInputStyle = {
    width: '100%',
    padding: type === 'textarea' ? '8px 10px' : '4px 8px',
    background: focused ? 'var(--surface)' : 'transparent',
    border: '1px solid ' + (focused ? 'var(--gold)' : 'transparent'),
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: type === 'textarea' ? 13 : 13,
    fontFamily: type === 'number' ? 'var(--font-mono)' : 'var(--font-sans)',
    outline: 'none',
    resize: type === 'textarea' ? 'vertical' : 'none',
    lineHeight: type === 'textarea' ? 1.5 : 1.4,
    transition: 'all var(--duration) var(--ease)',
    boxShadow: focused ? 'var(--focus-ring)' : 'none',
    cursor: focused ? 'text' : 'pointer',
    ...inputStyle,
  };

  const isEmpty = (value === null || value === undefined || value === '');
  const displayValue = (!focused && isEmpty)
    ? (showWhenEmpty ? emptyLabel : '')
    : (focused ? local : (format ? format(value) : (value ?? '')));

  return (
    <div style={containerStyle}>
      {label && (
        <div style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
          color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          marginBottom: 4,
        }}>{label}</div>
      )}
      {type === 'textarea' ? (
        <textarea
          ref={ref}
          value={focused ? local : (value ?? '')}
          onChange={e => setLocal(e.target.value)}
          onFocus={() => { setLocal(value ?? ''); setFocused(true); }}
          onBlur={() => { setFocused(false); commit(); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          style={{
            ...baseInputStyle,
            color: isEmpty && !focused ? 'var(--text-3)' : 'var(--text)',
            fontStyle: isEmpty && !focused ? 'italic' : 'normal',
          }}
        />
      ) : (
        <input
          ref={ref}
          type={type}
          value={focused ? local : (value ?? '')}
          onChange={e => setLocal(e.target.value)}
          onFocus={() => { setLocal(value ?? ''); setFocused(true); }}
          onBlur={() => { setFocused(false); commit(); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            ...baseInputStyle,
            color: isEmpty && !focused ? 'var(--text-3)' : 'var(--text)',
            fontStyle: isEmpty && !focused ? 'italic' : 'normal',
          }}
        />
      )}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

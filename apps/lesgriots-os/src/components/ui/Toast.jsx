'use client';
/**
 * Toast — feedback non-bloquant pour confirmer/notifier.
 *
 * Usage :
 *   import { ToastProvider, useToast } from '@/components/ui';
 *   <ToastProvider> wraps the app
 *   const { toast } = useToast();
 *   toast('Projet AF26-04 mis à jour');
 *   toast.success('Sauvegardé');
 *   toast.error('Échec : ...');
 *   toast.info('...');
 *
 * Stack en bas à droite, auto-dismiss 3s, Esc pour fermer le plus récent.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext(null);

const TONE = {
  success: { fg: 'var(--success)', bg: 'var(--success-soft)', icon: '✓' },
  error:   { fg: 'var(--danger)',  bg: 'var(--danger-soft)',  icon: '×' },
  info:    { fg: 'var(--info)',    bg: 'var(--info-soft)',    icon: 'i' },
  neutral: { fg: 'var(--gold)',    bg: 'var(--gold-soft)',    icon: '·' },
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(curr => curr.filter(t => t.id !== id));
  }, []);

  const push = useCallback((msg, opts = {}) => {
    const id = nextId++;
    const tone = opts.tone || 'neutral';
    const duration = opts.duration ?? 3000;
    setToasts(curr => [...curr, { id, msg, tone, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  // Helper API attaché à toast()
  const toast = useCallback((msg, opts) => push(msg, opts), [push]);
  toast.success = (msg, opts) => push(msg, { ...opts, tone: 'success' });
  toast.error   = (msg, opts) => push(msg, { ...opts, tone: 'error' });
  toast.info    = (msg, opts) => push(msg, { ...opts, tone: 'info' });

  // Esc → ferme le plus récent
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && toasts.length) {
        dismiss(toasts[toasts.length - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, dismiss]);

  return (
    <ToastCtx.Provider value={{ toast, dismiss }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const tone = TONE[t.tone] || TONE.neutral;
          return (
            <div key={t.id} className="lg-anim-rise" style={{
              pointerEvents: 'auto',
              minWidth: 240,
              maxWidth: 380,
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${tone.fg}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13,
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 9,
                background: tone.bg, color: tone.fg,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
                marginTop: 1,
              }}>{tone.icon}</span>
              <span style={{ flex: 1, lineHeight: 1.45 }}>{t.msg}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Fermer" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', padding: 2, lineHeight: 1,
                fontSize: 16, marginTop: -2,
              }}>×</button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Mode dégradé : si pas de Provider, on log dans la console pour ne pas crash
    return {
      toast: (msg) => console.warn('[toast — sans provider]', msg),
      dismiss: () => {},
    };
  }
  return ctx;
}

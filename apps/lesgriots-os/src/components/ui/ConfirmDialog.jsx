'use client';
/**
 * ConfirmDialog — confirmation bloquante stylée tokens (remplace window.confirm).
 *
 * Usage :
 *   import { ConfirmProvider, useConfirm } from '@/components/ui';
 *
 *   1) Monter le provider une fois, au plus haut niveau possible.
 *      Dans src/app/(dashboard)/layout.jsx, envelopper les children :
 *        <ConfirmProvider>{children}</ConfirmProvider>
 *      (idéalement juste à l'intérieur de <ToastProvider>).
 *
 *   2) Dans un composant :
 *        const confirm = useConfirm();
 *        const ok = await confirm({
 *          title: 'Supprimer ce client ?',
 *          message: 'Ses projets ne seront pas supprimés.',
 *          confirmLabel: 'Supprimer',
 *        });
 *        if (!ok) return;
 *
 *   Mode dégradé : si aucun <ConfirmProvider> n'est monté, useConfirm()
 *   retombe proprement sur window.confirm (titre + message concaténés),
 *   donc rien ne casse tant que le provider n'est pas ajouté au layout.
 *
 *   Esc / clic overlay / Annuler → resolve(false). Confirmer → resolve(true).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { title, message, confirmLabel, cancelLabel }
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      // Si un dialog est déjà ouvert, on le résout à false avant d'ouvrir le nouveau.
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = resolve;
      setDialog({
        title: opts.title || 'Confirmer ?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirmer',
        cancelLabel: opts.cancelLabel || 'Annuler',
      });
    });
  }, []);

  const close = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog(null);
  }, []);

  // Esc → annule
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      if (e.key === 'Enter') { close(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
          aria-label={dialog.title}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lg-anim-rise"
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg, 12px)',
              boxShadow: 'var(--shadow-md)',
              padding: '20px 22px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-title)',
              letterSpacing: 0.2,
              marginBottom: dialog.message ? 8 : 16,
            }}>
              {dialog.title}
            </div>
            {dialog.message && (
              <div style={{
                fontSize: 13,
                color: 'var(--text-2)',
                lineHeight: 1.5,
                marginBottom: 18,
                whiteSpace: 'pre-line',
              }}>
                {dialog.message}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => close(false)}
                autoFocus
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  height: 34,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-3)',
                  color: 'var(--text)',
                  border: '1px solid var(--border-2)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  height: 34,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger)',
                  color: 'var(--on-solid)',
                  border: '1px solid var(--danger)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (ctx) return ctx;
  // Mode dégradé sans provider : window.confirm (bloquant, mais fonctionnel).
  return async (opts = {}) => {
    const text = [opts.title, opts.message].filter(Boolean).join('\n\n') || 'Confirmer ?';
    return typeof window !== 'undefined' ? window.confirm(text) : false;
  };
}

export default ConfirmProvider;

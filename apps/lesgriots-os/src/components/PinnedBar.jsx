'use client';
/**
 * PinnedBar — barre horizontale en haut avec les projets épinglés.
 * Persiste les IDs en localStorage par utilisateur. Pinning fait depuis la fiche projet.
 *
 * Expose un context pour que d'autres composants puissent pin/unpin/check :
 *   const { pinned, isPinned, togglePin } = usePinned();
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const PinContext = createContext({
  pinned: [],
  isPinned: () => false,
  togglePin: () => {},
});

const STORAGE_KEY = 'lg-pinned-projects';

export function PinnedProvider({ children }) {
  const [pinned, setPinned] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPinned(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = useCallback((next) => {
    setPinned(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const togglePin = useCallback((projectId) => {
    setPinned(curr => {
      const isPinned = curr.includes(projectId);
      const next = isPinned ? curr.filter(id => id !== projectId) : [...curr, projectId];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isPinned = useCallback((projectId) => pinned.includes(projectId), [pinned]);

  return (
    <PinContext.Provider value={{ pinned, isPinned, togglePin }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePinned() {
  return useContext(PinContext);
}

// ─────────────────────────────────────────────────────────
// PinnedBar — affichage horizontal sous la TopBar
// ─────────────────────────────────────────────────────────
const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

export default function PinnedBar() {
  const { pinned, togglePin } = usePinned();
  const [projects, setProjects] = useState({});

  useEffect(() => {
    if (!pinned.length) return;
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const map = {};
        for (const p of (d.projects || [])) map[p.id] = p;
        setProjects(map);
      })
      .catch((e) => console.warn('[PinnedBar] Chargement échoué :', e));
  }, [pinned]);

  if (!pinned.length) return null;

  const valid = pinned.map(id => projects[id]).filter(Boolean);
  if (!valid.length) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
    }}>
      <span style={{
        fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        flexShrink: 0, marginRight: 4,
      }}>
        ★ Épinglés
      </span>
      {valid.map(p => {
        const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
        return (
          <div key={p.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${pillarColor}`,
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'all var(--duration) var(--ease)',
          }}>
            <Link
              href={`/projects/${p.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px',
                color: 'var(--text)', textDecoration: 'none',
                fontSize: 11, fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                {p.code}
              </span>
              <span style={{
                maxWidth: 160, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
              </span>
            </Link>
            <button
              className="btn-inline"
              onClick={() => togglePin(p.id)}
              title="Désépingler"
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-3)', cursor: 'pointer',
                padding: '4px 6px', fontSize: 12, lineHeight: 1,
                borderLeft: '1px solid var(--border)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * PinButton — bouton à utiliser sur la fiche projet pour épingler/désépingler.
 */
export function PinButton({ projectId, size = 'md' }) {
  const { isPinned, togglePin } = usePinned();
  const pinned = isPinned(projectId);
  const dim = size === 'sm' ? 28 : 34;

  return (
    <button
      className="btn-inline"
      onClick={() => togglePin(projectId)}
      title={pinned ? 'Désépingler ce projet' : 'Épingler ce projet'}
      aria-pressed={pinned}
      style={{
        width: dim, height: dim,
        background: pinned ? 'var(--gold-soft)' : 'transparent',
        border: '1px solid ' + (pinned ? 'var(--gold)' : 'var(--border)'),
        borderRadius: 'var(--radius-md)',
        color: pinned ? 'var(--gold)' : 'var(--text-3)',
        cursor: 'pointer',
        fontSize: 14, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all var(--duration) var(--ease)',
      }}
    >
      {pinned ? '★' : '☆'}
    </button>
  );
}

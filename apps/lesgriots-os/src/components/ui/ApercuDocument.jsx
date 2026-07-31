'use client';

import { useEffect } from 'react';

/**
 * ApercuDocument — le document s'ouvre dans l'app, pas dans un onglet perdu.
 *
 * Un PDF qui part dans un nouvel onglet fait sortir de l'outil : on perd le
 * fil de ce qu'on faisait, et sur certains navigateurs l'onglet est bloqué.
 * Ici le document s'affiche par-dessus l'écran courant, avec de quoi le
 * télécharger ou l'ouvrir en grand si on le souhaite vraiment.
 *
 * `url` : l'adresse du PDF. `titre` : ce qu'on regarde. `onFermer` : retour.
 */
export default function ApercuDocument({ url, titre = 'Document', onFermer }) {
  // Échap ferme, et le fond ne défile pas derrière la fenêtre.
  useEffect(() => {
    if (!url) return undefined;
    const auClavier = (e) => { if (e.key === 'Escape') onFermer?.(); };
    document.addEventListener('keydown', auClavier);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = defilement;
    };
  }, [url, onFermer]);

  if (!url) return null;

  const bouton = {
    border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
    background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 650,
    fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      onClick={onFermer}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,11,10,0.72)',
        display: 'flex', flexDirection: 'column', padding: '3vh 3vw', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)', flexShrink: 0,
        }}
        >
          <strong style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</strong>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a href={url} download style={bouton}>Télécharger</a>
            <a href={url} target="_blank" rel="noreferrer" style={bouton}>Ouvrir en grand</a>
            <button type="button" onClick={onFermer} style={{ ...bouton, background: 'var(--gold)', color: 'var(--gold-ink)', border: 0 }}>Fermer</button>
          </div>
        </div>
        <iframe
          src={url}
          title={titre}
          style={{ flex: 1, width: '100%', border: 0, background: '#525659' }}
        />
      </div>
    </div>
  );
}

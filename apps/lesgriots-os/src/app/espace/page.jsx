'use client';

/**
 * /espace — la porte d'entrée de l'espace apprenant.
 *
 * L'apprenant saisit l'adresse à laquelle il a été inscrit et reçoit un lien
 * de connexion valable deux heures. C'est plus sûr qu'un lien permanent qui,
 * transféré à quelqu'un d'autre, ouvre son dossier indéfiniment.
 *
 * La page ne dit jamais si une adresse est connue : elle répondrait sinon à
 * un curieux qui cherche à savoir qui se forme chez toi.
 */

import { useState } from 'react';

const P = {
  papier: '#f6f5f3', encre: '#141210', texte2: '#4a4640', texte3: '#8a8478',
  or: '#FFCA00', ligne: 'rgba(20,18,16,.12)',
};

export default function PorteEspacePage() {
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState('saisie');
  const [message, setMessage] = useState('');

  const demander = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEtat('envoi');
    try {
      const r = await fetch('/api/public/espace/acces', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      setMessage(d.message || 'Demande enregistrée.');
      setEtat('envoye');
    } catch {
      setMessage('La demande n’a pas pu être envoyée. Réessayez dans un instant.');
      setEtat('saisie');
    }
  };

  return (
    <main style={{
      minHeight: '100vh', background: P.papier, color: P.encre,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
      fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    }}>
      <div style={{ width: 'min(460px, 100%)' }}>
        <div style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '.18em', textTransform: 'uppercase', color: P.texte3, marginBottom: 8,
        }}>La Griothèque · Organisme de formation</div>
        <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 8px' }}>Espace apprenant</h1>
        <p style={{ fontSize: 14, color: P.texte2, lineHeight: 1.6, margin: '0 0 22px' }}>
          Saisissez l’adresse e-mail à laquelle vous avez été inscrit. Vous recevrez un lien de connexion,
          valable deux heures.
        </p>

        {etat === 'envoye' ? (
          <div style={{
            padding: 18, borderRadius: 14, background: '#fff',
            border: `2px solid ${P.or}`, fontSize: 14, lineHeight: 1.6,
          }}>
            <b style={{ display: 'block', marginBottom: 6 }}>Demande enregistrée</b>
            {message}
            <button type="button" onClick={() => { setEtat('saisie'); setEmail(''); }} style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${P.ligne}`, background: 'transparent', color: P.encre,
              font: 'inherit', fontSize: 13, fontWeight: 700,
            }}>Demander pour une autre adresse</button>
          </div>
        ) : (
          <form onSubmit={demander} style={{
            padding: 18, borderRadius: 14, background: '#fff',
            border: `1px solid ${P.ligne}`, display: 'grid', gap: 12,
          }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 10,
                letterSpacing: '.12em', textTransform: 'uppercase', color: P.texte3, fontWeight: 700,
              }}>Votre adresse e-mail</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" placeholder="prenom@exemple.com"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 13px',
                  border: `1.5px solid ${P.ligne}`, borderRadius: 10, background: P.papier,
                  color: P.encre, font: 'inherit', fontSize: 15,
                }}
              />
            </label>
            <button type="submit" disabled={etat === 'envoi'} style={{
              padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${P.or}`,
              background: P.or, color: '#171407', font: 'inherit', fontSize: 14, fontWeight: 800,
              cursor: etat === 'envoi' ? 'not-allowed' : 'pointer', opacity: etat === 'envoi' ? .6 : 1,
            }}>{etat === 'envoi' ? 'Envoi…' : 'Recevoir mon lien'}</button>
          </form>
        )}

        <p style={{ fontSize: 12.5, color: P.texte3, lineHeight: 1.6, marginTop: 18 }}>
          Une question, une difficulté, une situation de handicap à signaler ? Écrivez à{' '}
          <a href="mailto:contact@lesgriots.com" style={{ color: P.encre }}>contact@lesgriots.com</a>.
        </p>
      </div>
    </main>
  );
}

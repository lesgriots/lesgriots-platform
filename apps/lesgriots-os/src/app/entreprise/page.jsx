'use client';

/**
 * /entreprise — la porte de l'espace entreprise.
 *
 * Même principe que la porte de l'espace apprenant : pas de mot de passe à
 * retenir pour quelqu'un qui vient trois fois par an. L'adresse enregistrée
 * sur la fiche, ou celle d'un contact, suffit à recevoir un lien.
 *
 * La page ne dit jamais si une adresse est connue. Elle répondrait sinon à
 * un concurrent qui cherche à savoir qui se forme chez toi.
 */

import { useState } from 'react';

const P = {
  papier: '#f6f5f3', encre: '#141310', texte2: '#4a4640', texte3: '#8a8478',
  or: '#FFCA00', ligne: 'rgba(20,18,16,.12)',
};

export default function PorteEntreprise() {
  const [email, setEmail] = useState('');
  const [etat, setEtat] = useState('saisie');
  const [message, setMessage] = useState('');

  const demander = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEtat('envoi');
    try {
      const r = await fetch('/api/public/entreprise/acces', {
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
      minHeight: '100dvh', background: P.papier, color: P.encre,
      fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 18px',
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, marginBottom: 18,
          background: 'linear-gradient(140deg, #FFD84D 0%, #ffca00 100%)',
          color: '#171407', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, letterSpacing: '-.04em',
        }}>LG</div>

        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.15 }}>
          Espace entreprise
        </h1>
        <p style={{ fontSize: 14, color: P.texte2, margin: '0 0 22px', lineHeight: 1.6 }}>
          Vos salariés inscrits, leur présence, et vos documents.
          Saisissez l’adresse à laquelle nous vous écrivons : vous recevrez un lien d’accès.
        </p>

        {etat === 'envoye' ? (
          <div style={{
            background: '#fff', border: `1px solid ${P.ligne}`, borderRadius: 12, padding: 18,
            fontSize: 14, color: P.texte2, lineHeight: 1.6,
          }}>{message}</div>
        ) : (
          <form onSubmit={demander}>
            <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 7 }}>
              Adresse professionnelle
            </label>
            <input
              id="email" type="email" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rh@votre-entreprise.fr"
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 10, fontSize: 16,
                border: `1px solid ${P.ligne}`, background: '#fff', color: P.encre,
                fontFamily: 'inherit', marginBottom: 12,
              }}
            />
            <button type="submit" disabled={etat === 'envoi'} style={{
              width: '100%', padding: '14px 18px', borderRadius: 11, border: 0,
              background: P.or, color: '#171407', fontFamily: 'inherit',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: etat === 'envoi' ? 0.5 : 1,
            }}>{etat === 'envoi' ? 'Envoi…' : 'Recevoir mon lien'}</button>
          </form>
        )}

        <p style={{ fontSize: 12, color: P.texte3, marginTop: 18, lineHeight: 1.6 }}>
          Le lien est valable quatre heures. Il ne donne accès qu’aux dossiers de votre
          entreprise, et jamais aux réponses individuelles de vos salariés à nos
          questionnaires : celles-là leur appartiennent.
        </p>
      </div>
    </main>
  );
}

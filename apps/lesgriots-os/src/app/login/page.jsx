'use client';
import { useState, useEffect } from 'react';

const GOLD = 'var(--gold-deep)';
const BG = 'var(--bg)';
const SURFACE = 'var(--surface)';
const TEXT = 'var(--text)';
const TEXT2 = 'var(--text-3)';
const BORDER = 'var(--border)';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Entrée par code : la seule voie disponible tant que Google n'est pas
  // configuré, et la seule praticable sur un téléphone.
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const connecterParCode = async (e) => {
    e.preventDefault();
    if (!code.trim() || envoi) return;
    setEnvoi(true);
    setError('');
    try {
      const r = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (r.ok) { window.location.href = '/'; return; }
      const j = await r.json().catch(() => ({}));
      setError(j.error || 'Code invalide ou expiré.');
    } catch {
      setError('Connexion impossible. Vérifie ton réseau.');
    }
    setEnvoi(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'not_authorized') setError("Ton email n'est pas autorisé. Demande une invitation à l'admin.");
    else if (err === 'account_disabled') setError('Ton compte a été désactivé.');
    else if (err === 'google_token_failed') setError('Erreur de connexion Google. Réessaie.');
    else if (err === 'auth_failed') setError('Authentification échouée. Réessaie.');
    else if (err === 'lien_invalide') setError('Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau.');
    else if (err === 'lien_absent') setError('Lien de connexion incomplet.');
  }, []);

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
      padding: 16,
    }}>
      <div style={{
        width: 'min(400px, 100%)',
        padding: 'min(48px, 8vw)',
        background: SURFACE,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        textAlign: 'center',
      }}>
        {/* Logo / Brand */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontSize: 'clamp(20px, 6vw, 26px)',
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '0.05em',
            fontFamily: "'Space Mono', monospace",
          }}>
            LA GRIOTHÈQUE
          </span>
        </div>
        <div style={{
          fontSize: 13,
          color: GOLD,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontWeight: 500,
          marginBottom: 48,
        }}>
          OS
        </div>

        <p style={{
          color: TEXT2,
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          Connecte-toi pour piloter<br />l’organisme de formation
        </p>

        {error && (
          <div style={{
            background: 'var(--danger-soft)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: 'var(--danger)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Connexion par code — voie principale */}
        <form onSubmit={connecterParCode} style={{ textAlign: 'left' }}>
          <label htmlFor="code" style={{
            display: 'block', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: TEXT2, marginBottom: 7,
          }}>Code de connexion</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10,
              border: `1px solid ${BORDER}`, background: BG, color: TEXT,
              fontFamily: "'Geist Mono', monospace", fontSize: 20, letterSpacing: '0.14em',
              textAlign: 'center', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={envoi || !code.trim()}
            style={{
              width: '100%', marginTop: 12, padding: '14px 24px',
              background: 'var(--gold)', color: '#141210', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
              cursor: envoi || !code.trim() ? 'default' : 'pointer',
              opacity: envoi || !code.trim() ? 0.5 : 1,
            }}
          >{envoi ? 'Connexion…' : 'Se connecter'}</button>
        </form>

        <p style={{ color: TEXT2, fontSize: 12, lineHeight: 1.6, marginTop: 16, textAlign: 'left' }}>
          Le code s’obtient depuis un appareil déjà connecté, en bas de la barre
          latérale, « Connecter un appareil ». Il vaut dix minutes et une seule
          connexion.
        </p>

        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `1px solid ${BORDER}`,
          color: TEXT2,
          fontSize: 11,
          lineHeight: 1.5,
        }}>
          Accès réservé à l’équipe LES GRIOTS.<br />
          Besoin d’un accès ? Contacte l’administrateur.
        </div>
      </div>
    </div>
  );
}

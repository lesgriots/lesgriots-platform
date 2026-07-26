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
            fontSize: 28,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '0.05em',
            fontFamily: "'Space Mono', monospace",
          }}>
            LES GRIOTS
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
          Connecte-toi pour accéder au pilotage<br />Agence · Production · Formations
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

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: loading ? 'var(--surface-3)' : 'var(--inverse)',
            color: loading ? 'var(--text-2)' : 'var(--inverse-fg)',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transition: 'all 0.15s ease',
            fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
          }}
          onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--gold)'; e.target.style.color = 'var(--gold-ink)'; } }}
          onMouseLeave={e => { if (!loading) { e.target.style.background = 'var(--inverse)'; e.target.style.color = 'var(--inverse-fg)'; } }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Connexion...' : 'Continuer avec Google'}
        </button>

        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `1px solid ${BORDER}`,
          color: TEXT2,
          fontSize: 11,
          lineHeight: 1.5,
        }}>
          Accès réservé à l'équipe LES GRIOTS.<br />
          Besoin d'un accès ? Contacte l'administrateur.
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';

// The login stays in the La Griothèque dark universe, whatever the in-app theme.
const GOLD = '#f0c64f';
const BG = '#090909';
const SURFACE = '#171716';
const SURFACE_2 = '#211f1c';
const INPUT_BG = '#0e0e0d';
const TEXT = '#f6f5f3';
const TEXT2 = '#a39f98';
const BORDER = '#37342f';

const etiquette = {
  display: 'block', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: TEXT2, marginBottom: 6,
};
const champ = (bordure, fond, texte) => ({
  width: '100%', padding: '13px 15px', borderRadius: 10,
  border: `1px solid ${bordure}`, background: fond, color: texte,
  fontFamily: "'Geist Sans', 'DM Sans', sans-serif", fontSize: 16, outline: 'none',
});

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Entrée par code : la seule voie disponible tant que Google n'est pas
  // configuré, et la seule praticable sur un téléphone.
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // Deux voies : le mot de passe, qui ne dépend de rien, et le code, qui
  // dépend d'un appareil déjà connecté. La première est le défaut.
  const [voie, setVoie] = useState('motdepasse');
  const [email, setEmail] = useState('');
  const [motdepasse, setMotdepasse] = useState('');

  const connecterParMotDePasse = async (e) => {
    e.preventDefault();
    if (!email.trim() || !motdepasse || envoi) return;
    setEnvoi(true);
    setError('');
    try {
      const r = await fetch('/api/auth/motdepasse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, motdepasse }),
      });
      if (r.ok) { window.location.href = '/'; return; }
      const j = await r.json().catch(() => ({}));
      setError(j.error || 'Email ou mot de passe incorrect.');
    } catch {
      setError('Connexion impossible. Vérifie ton réseau.');
    }
    setEnvoi(false);
  };

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
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
      }}>
        {/* Logo / Brand */}
        <div style={{ margin: '0 auto 16px', maxWidth: 280 }}>
          <img
            src="/branding/griotheque-wordmark-paper.svg"
            alt="La Griothèque"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
        <div style={{
          fontSize: 11,
          color: TEXT2,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: 44,
        }}>
          Organisme de formation · OS
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
            background: '#2b1717',
            border: '1px solid #75413f',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#ffaaa3',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Deux onglets : mot de passe par défaut, code en secours */}
        <div style={{
          display: 'flex', gap: 2, padding: 2, marginBottom: 18,
          background: SURFACE_2, border: `1px solid ${BORDER}`, borderRadius: 9,
        }}>
          {[['motdepasse', 'Mot de passe'], ['code', 'Code']].map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => { setVoie(cle); setError(''); }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                background: voie === cle ? SURFACE : 'transparent',
                border: '1px solid ' + (voie === cle ? BORDER : 'transparent'),
                color: voie === cle ? TEXT : TEXT2,
                fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
                fontSize: 13, fontWeight: voie === cle ? 500 : 400,
              }}
            >{libelle}</button>
          ))}
        </div>

        {voie === 'motdepasse' ? (
          <form onSubmit={connecterParMotDePasse} style={{ textAlign: 'left' }}>
            <label htmlFor="email" style={etiquette}>Email</label>
            <input
              id="email" type="email" value={email} autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@lesgriots.com"
              style={{ ...champ(BORDER, INPUT_BG, TEXT), marginBottom: 12 }}
            />
            <label htmlFor="mdp" style={etiquette}>Mot de passe</label>
            <input
              id="mdp" type="password" value={motdepasse} autoComplete="current-password"
              onChange={(e) => setMotdepasse(e.target.value)}
              style={champ(BORDER, INPUT_BG, TEXT)}
            />
            <button
              type="submit"
              disabled={envoi || !email.trim() || !motdepasse}
              style={{
                width: '100%', marginTop: 14, padding: '14px 24px',
                background: GOLD, color: '#141310', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 600, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
                cursor: envoi ? 'default' : 'pointer',
                opacity: envoi || !email.trim() || !motdepasse ? 0.5 : 1,
              }}
            >{envoi ? 'Connexion…' : 'Se connecter'}</button>
            <p style={{ color: TEXT2, fontSize: 12, lineHeight: 1.6, marginTop: 14 }}>
              Pas encore de mot de passe ? Connecte-toi une fois avec un code, puis
              définis-le dans « Connecter un appareil ». Tu n’auras plus jamais besoin
              d’autre chose.
            </p>
          </form>
        ) : (
          <form onSubmit={connecterParCode} style={{ textAlign: 'left' }}>
            <label htmlFor="code" style={etiquette}>Code de connexion</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                ...champ(BORDER, INPUT_BG, TEXT),
                fontFamily: "'Geist Mono', monospace", fontSize: 20,
                letterSpacing: '0.14em', textAlign: 'center',
              }}
            />
            <button
              type="submit"
              disabled={envoi || !code.trim()}
              style={{
                width: '100%', marginTop: 12, padding: '14px 24px',
                background: GOLD, color: '#141310', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 600, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
                cursor: envoi || !code.trim() ? 'default' : 'pointer',
                opacity: envoi || !code.trim() ? 0.5 : 1,
              }}
            >{envoi ? 'Connexion…' : 'Se connecter'}</button>
            <p style={{ color: TEXT2, fontSize: 12, lineHeight: 1.6, marginTop: 14 }}>
              Le code s’obtient depuis un appareil déjà connecté, en bas de la barre
              latérale, « Connecter un appareil ». Il vaut dix minutes et une seule
              connexion.
            </p>
          </form>
        )}

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

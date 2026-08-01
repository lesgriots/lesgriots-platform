'use client';

/**
 * /appareil — connecter un téléphone ou un autre ordinateur.
 *
 * Jusqu'ici, entrer dans l'OS depuis un nouvel appareil supposait un accès SSH
 * au serveur pour générer un lien. Autant dire : impossible depuis un
 * téléphone. Cet écran émet un code court, à taper sur l'autre appareil.
 *
 * Le code vaut mot de passe le temps d'une connexion : dix minutes, un seul
 * usage. On l'affiche donc en grand, et on rappelle qu'il ne se partage pas.
 */

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card } from '@/components/ui';

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};

/**
 * Le mot de passe est la seule voie d'entrée qui ne dépend de rien : ni d'un
 * email qui doit partir, ni d'un second appareil déjà connecté, ni d'un accès
 * au serveur. C'est le filet de sécurité, et il se pose ici, une fois.
 */
function MotDePasse() {
  const [defini, setDefini] = useState(null);
  const [valeur, setValeur] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [etat, setEtat] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/auth/motdepasse').then((r) => r.json())
      .then((j) => setDefini(Boolean(j.defini))).catch(() => setDefini(false));
  }, []);

  const enregistrer = async () => {
    setErreur(''); setEtat('');
    if (valeur !== confirmation) { setErreur('Les deux saisies diffèrent.'); return; }
    const r = await fetch('/api/auth/motdepasse', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motdepasse: valeur }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(j.error || 'Enregistrement impossible.'); return; }
    setValeur(''); setConfirmation(''); setDefini(true);
    setEtat('Mot de passe enregistré.');
    setTimeout(() => setEtat(''), 3000);
  };

  const champ = {
    width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-2)', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
  };

  return (
    <Card style={{ borderColor: defini === false ? 'var(--gold)' : undefined }}>
      <div style={{ ...mono, marginBottom: 8 }}>Mot de passe</div>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.65 }}>
        {defini
          ? 'Un mot de passe est défini. Tu peux entrer depuis n’importe quel navigateur, sans code et sans aide.'
          : 'Aucun mot de passe défini. Tant qu’il n’y en a pas, entrer depuis un nouvel appareil suppose un appareil déjà connecté. Pose-en un maintenant : c’est ton filet de sécurité.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 11 }}>
        <label>
          <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Nouveau mot de passe</span>
          <input type="password" value={valeur} autoComplete="new-password"
                 onChange={(e) => setValeur(e.target.value)} style={champ} />
        </label>
        <label>
          <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Confirmer</span>
          <input type="password" value={confirmation} autoComplete="new-password"
                 onChange={(e) => setConfirmation(e.target.value)} style={champ} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 13, flexWrap: 'wrap' }}>
        <button
          onClick={enregistrer}
          disabled={valeur.length < 12 || !confirmation}
          style={{
            padding: '9px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--gold)', color: '#141310', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: valeur.length < 12 || !confirmation ? 0.45 : 1,
          }}
        >{defini ? 'Changer le mot de passe' : 'Définir le mot de passe'}</button>
        <span style={{ fontSize: 12.5, color: erreur ? 'var(--danger)' : 'var(--text-3)' }}>
          {erreur || etat || 'Douze caractères au minimum. La longueur protège mieux que la ponctuation.'}
        </span>
      </div>
    </Card>
  );
}

export default function AppareilPage() {
  const [code, setCode] = useState(null);
  const [reste, setReste] = useState(0);
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);

  const emettre = async () => {
    setErreur(''); setCopie(false);
    const r = await fetch('/api/auth/appareil', { method: 'POST' });
    const j = await r.json();
    if (!r.ok) { setErreur(j.error || 'Émission impossible.'); return; }
    setCode(j);
    setReste(Math.max(0, Math.floor((new Date(j.expire_le) - Date.now()) / 1000)));
  };

  // Un code qui expire sans le dire est un piège : on montre le décompte.
  useEffect(() => {
    if (!reste) return;
    const t = setInterval(() => setReste((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [reste > 0]);

  const minutes = String(Math.floor(reste / 60)).padStart(2, '0');
  const secondes = String(reste % 60).padStart(2, '0');

  return (
    <>
      <TopBar title="Accès" subtitle="Ton mot de passe, et tes autres appareils" />

      <div style={{ padding: '0 24px 48px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>

        <MotDePasse />

        <Card>
          <div style={{ ...mono, marginBottom: 8 }}>Connecter un autre appareil</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
            <li>Sur l’autre appareil, ouvre <b style={{ color: 'var(--text)' }}>app.lagriotheque.com</b></li>
            <li>Tape le code ci-dessous dans le champ « Code de connexion »</li>
            <li>Tu y restes connecté trente jours</li>
          </ol>
        </Card>

        <Card>
          {!code && (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '0 0 14px' }}>
                Le code est valable dix minutes et ne sert qu’une fois. Ne le transmets à personne :
                il donne le même accès que le tien.
              </p>
              <button onClick={emettre} style={{
                padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
                background: 'var(--gold)', color: '#141310', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Générer un code</button>
              {erreur && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{erreur}</p>}
            </>
          )}

          {code && (
            <div style={{ textAlign: 'center' }}>
              <div style={mono}>Code de connexion</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'clamp(30px, 8vw, 46px)',
                fontWeight: 500, letterSpacing: '0.12em', margin: '10px 0 4px',
                color: reste ? 'var(--text)' : 'var(--text-3)',
              }}>
                {code.code}
              </div>
              <div style={{ fontSize: 12.5, color: reste ? 'var(--text-3)' : 'var(--danger)' }}>
                {reste ? `expire dans ${minutes}:${secondes}` : 'expiré, génère-en un autre'}
              </div>

              <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  onClick={() => { navigator.clipboard?.writeText(code.code); setCopie(true); }}
                  style={{
                    padding: '8px 15px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-2)', background: 'var(--surface)',
                    color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
                  }}
                >{copie ? 'Copié' : 'Copier'}</button>
                <button onClick={emettre} style={{
                  padding: '8px 15px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--gold)', color: '#141310', fontFamily: 'inherit',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>Nouveau code</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

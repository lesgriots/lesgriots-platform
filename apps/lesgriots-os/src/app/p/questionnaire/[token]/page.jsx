'use client';

/**
 * /p/questionnaire/<jeton> — répondre à un questionnaire, sans compte.
 *
 * Positionnement avant la formation, satisfaction à chaud le dernier soir,
 * impact à froid trois mois plus tard : ce sont les pièces des indicateurs 8
 * et 30. L'API savait résoudre le jeton, servir la définition et enregistrer
 * les réponses. Il manquait la page, donc les liens émis ne menaient nulle
 * part et aucun questionnaire n'avait jamais pu être rempli.
 *
 * Un lien peut être nominatif ou global. Nominatif, on sait déjà qui répond.
 * Global, le répondant choisit son nom dans la liste des inscrits : c'est le
 * lien qu'on projette au tableau en fin de session.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const P = {
  papier: '#f6f5f3', surface: '#ffffff', encre: '#141310',
  texte2: '#3a3831', texte3: '#6f6b60', ligne: 'rgba(0,0,0,.14)',
  or: '#ffca00', orEncre: '#171407', vert: '#1E8449', rouge: '#B83328',
};

const pastille = (actif, taille = 44) => ({
  width: taille, height: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
  border: `1px solid ${actif ? P.encre : P.ligne}`,
  background: actif ? P.encre : P.surface,
  color: actif ? '#fff' : P.texte2,
  fontSize: 14.5, fontWeight: 700,
});

export default function PageQuestionnaire() {
  const { token } = useParams();
  const [def, setDef] = useState(null);
  const [erreur, setErreur] = useState('');
  const [rep, setRep] = useState({});
  const [commentaire, setCommentaire] = useState('');
  const [qui, setQui] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    fetch(`/api/public/questionnaire/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Lien invalide ou expiré');
        return r.json();
      })
      .then(setDef)
      .catch((e) => setErreur(e.message));
  }, [token]);

  if (erreur) return <Cadre><Message titre="Lien indisponible" texte={erreur} /></Cadre>;
  if (!def) return <Cadre><Message titre="Chargement…" texte="Un instant." /></Cadre>;
  if (fait) {
    return (
      <Cadre>
        <Message
          titre="Merci, c’est enregistré."
          texte="Votre réponse nous aide à ajuster la suite. Vous pouvez fermer cette page."
        />
      </Cadre>
    );
  }

  const questions = (def.questions || []).filter((q) => q.type !== 'section' || q.label);
  const manquantes = questions.filter((q) => q.type !== 'section' && q.required
    && (rep[q.key] === undefined || rep[q.key] === ''));
  const nomRequis = !def.apprenant && Array.isArray(def.inscrits) && def.inscrits.length > 0;
  const pret = !manquantes.length && (!nomRequis || qui);

  const envoyer = async () => {
    if (!pret || envoi) return;
    setEnvoi(true); setErreur('');
    try {
      const r = await fetch(`/api/public/questionnaire/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: rep,
          comments: commentaire,
          ...(nomRequis ? { apprenantId: qui } : {}),
        }),
      });
      if (r.ok) { setFait(true); return; }
      const j = await r.json().catch(() => ({}));
      setErreur(j.error || 'Envoi impossible. Vos réponses sont encore à l’écran.');
    } catch {
      setErreur('Pas de réseau. Vos réponses sont encore à l’écran.');
    }
    setEnvoi(false);
  };

  return (
    <Cadre>
      <header style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5, fontWeight: 700,
          letterSpacing: '.14em', textTransform: 'uppercase', color: P.texte3,
        }}>{def.session?.formationTitle || 'Formation'}</div>
        <h1 style={{ margin: '7px 0 6px', fontSize: 22, letterSpacing: '-.03em', lineHeight: 1.2 }}>
          {def.label}
        </h1>
        {def.intro && <p style={{ margin: 0, fontSize: 13.5, color: P.texte3, lineHeight: 1.55 }}>{def.intro}</p>}
        {def.apprenant && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: P.texte2 }}>
            Réponse au nom de <strong>{def.apprenant.firstName} {def.apprenant.lastName}</strong>.
          </p>
        )}
      </header>

      {nomRequis && (
        <label style={{ display: 'block', marginBottom: 22 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 7 }}>
            Qui répond ? <span style={{ color: P.texte3, fontWeight: 400 }}>*</span>
          </span>
          <select
            value={qui} onChange={(e) => setQui(e.target.value)}
            style={{
              width: '100%', padding: '12px 13px', borderRadius: 10, font: 'inherit', fontSize: 15,
              border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre,
            }}
          >
            <option value="">Choisissez votre nom</option>
            {def.inscrits.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
            ))}
          </select>
        </label>
      )}

      {(def.questions || []).map((q) => (
        <div key={q.key || q.label} style={{ marginBottom: 20 }}>
          {q.type === 'section' ? (
            <div style={{
              fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase',
              color: P.texte3, fontWeight: 800, marginTop: 10, paddingTop: 16,
              borderTop: `1px solid ${P.ligne}`,
            }}>{q.label}</div>
          ) : (
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
              {q.label}{q.required && <span style={{ color: P.texte3, fontWeight: 400 }}> *</span>}
            </label>
          )}

          {q.type === 'note' && (
            <div style={{ display: 'flex', gap: 7 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRep((r) => ({ ...r, [q.key]: n }))}
                  style={pastille(rep[q.key] === n)}>{n}</button>
              ))}
            </div>
          )}

          {q.type === 'nps' && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} type="button" onClick={() => setRep((r) => ({ ...r, [q.key]: n }))}
                  style={pastille(rep[q.key] === n, 38)}>{n}</button>
              ))}
            </div>
          )}

          {q.type === 'choice' && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {(q.options || []).map((o) => (
                <button key={o} type="button" onClick={() => setRep((r) => ({ ...r, [q.key]: o }))}
                  style={{ ...pastille(rep[q.key] === o), width: 'auto', padding: '0 15px', fontSize: 13.5 }}>{o}</button>
              ))}
            </div>
          )}

          {(q.type === 'texte' || q.type === 'text' || q.type === 'zone') && (
            <textarea
              value={rep[q.key] || ''} onChange={(e) => setRep((r) => ({ ...r, [q.key]: e.target.value }))}
              rows={3}
              style={{
                width: '100%', padding: '12px 13px', borderRadius: 10, font: 'inherit', fontSize: 15,
                border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre, resize: 'vertical',
              }}
            />
          )}
        </div>
      ))}

      <div style={{ marginTop: 6, marginBottom: 22 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Quelque chose à ajouter ?
        </label>
        <textarea
          value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
          placeholder="Facultatif, et lu par une vraie personne."
          style={{
            width: '100%', padding: '12px 13px', borderRadius: 10, font: 'inherit', fontSize: 15,
            border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre, resize: 'vertical',
          }}
        />
      </div>

      <button
        type="button" onClick={envoyer} disabled={!pret || envoi}
        style={{
          width: '100%', padding: '15px 18px', borderRadius: 12, border: 0, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700,
          background: P.or, color: P.orEncre, opacity: !pret || envoi ? 0.45 : 1,
        }}
      >{envoi ? 'Envoi…' : 'Envoyer mes réponses'}</button>

      {!pret && manquantes.length > 0 && (
        <p style={{ fontSize: 12.5, color: P.texte3, marginTop: 10, textAlign: 'center' }}>
          {manquantes.length} question(s) obligatoire(s) sans réponse.
        </p>
      )}
      {erreur && (
        <p role="alert" style={{ color: P.rouge, fontSize: 13, marginTop: 12, fontWeight: 600 }}>{erreur}</p>
      )}
    </Cadre>
  );
}

function Cadre({ children }) {
  return (
    <main style={{
      minHeight: '100dvh', background: P.papier, color: P.encre,
      fontFamily: "'Geist', -apple-system, system-ui, sans-serif",
      padding: '26px 18px 60px',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </main>
  );
}

function Message({ titre, texte }) {
  return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 8px', letterSpacing: '-.02em' }}>{titre}</h1>
      <p style={{ color: P.texte3, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{texte}</p>
    </div>
  );
}

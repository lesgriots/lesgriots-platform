'use client';

/**
 * /p/emargement/<jeton> — la feuille d'émargement qui tourne dans la salle.
 *
 * C'est l'écran que l'intervenant ouvre sur sa tablette et fait passer de main
 * en main. Chacun trouve son nom, signe au doigt, rend l'appareil au suivant.
 *
 * L'API existait depuis des semaines : elle savait résoudre le jeton, lister
 * les journées et les inscrits, enregistrer une signature. Il manquait la
 * page. Le bouton « créer le lien d'émargement » annonçait donc un lien qui
 * menait à une erreur, et la signature sur téléphone figurait comme « à
 * construire » alors que les trois quarts du travail étaient faits.
 *
 * Deux partis pris pour un appareil qui circule.
 *
 * Rien de sensible à l'écran. Ni adresse, ni téléphone, ni prix : la liste ne
 * porte que des prénoms et des noms. Un appareil qui passe de main en main
 * n'est pas un poste de travail.
 *
 * On revient toujours à la liste. Après chaque signature, l'écran retourne de
 * lui-même à la liste des participants, prêt pour le suivant. Personne n'a à
 * chercher comment sortir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const P = {
  papier: '#f6f5f3', surface: '#ffffff', encre: '#141310',
  texte2: '#3a3831', texte3: '#6f6b60', ligne: 'rgba(0,0,0,.14)',
  or: '#ffca00', orEncre: '#171407', vert: '#1E8449', rouge: '#B83328',
};

const jourFr = (v) => (v
  ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long' })
  : '');

const bouton = {
  padding: '13px 18px', borderRadius: 11, border: 0, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700,
  background: P.or, color: P.orEncre,
};
const boutonPale = { ...bouton, background: 'transparent', color: P.texte2, border: `1px solid ${P.ligne}` };

export default function PageEmargement() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');
  const [creneau, setCreneau] = useState(null);   // { date, period, label }
  const [qui, setQui] = useState(null);           // { id, firstName, lastName } | { formateur: true }

  const charger = useCallback(() => {
    fetch(`/api/public/emargement/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Lien invalide ou expiré');
        return r.json();
      })
      .then((x) => {
        setD(x);
        setCreneau((c) => c || premierCreneau(x));
      })
      .catch((e) => setErreur(e.message));
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <Cadre><Message titre="Lien indisponible" texte={erreur} /></Cadre>;
  if (!d) return <Cadre><Message titre="Chargement…" texte="Un instant." /></Cadre>;

  const signe = (apprenantId, role) => (d.signatures || []).some((s) => (
    s.date === creneau?.date && s.period === creneau?.period
    && (role === 'formateur' ? s.signer_role === 'formateur' : s.apprenant_id === apprenantId)
  ));

  const restants = (d.inscrits || []).filter((a) => !signe(a.id)).length;

  return (
    <Cadre>
      <header style={{ marginBottom: 18 }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5, fontWeight: 700,
          letterSpacing: '.14em', textTransform: 'uppercase', color: P.texte3,
        }}>Feuille d’émargement</div>
        <h1 style={{ margin: '7px 0 4px', fontSize: 22, letterSpacing: '-.03em', lineHeight: 1.2 }}>
          {d.session.formationTitle}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: P.texte3 }}>
          {[d.session.lieu, d.session.horaire].filter(Boolean).join(' · ')}
        </p>
      </header>

      {/* Le créneau : une pastille par demi-journée, la journée en cours d'abord. */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
        {(d.jours || []).flatMap((j) => [
          { date: j, period: 'matin', label: 'Matin' },
          { date: j, period: 'apres_midi', label: 'Après-midi' },
        ]).map((c) => {
          const ici = creneau?.date === c.date && creneau?.period === c.period;
          return (
            <button
              key={`${c.date}-${c.period}`} type="button" onClick={() => { setCreneau(c); setQui(null); }}
              style={{
                flex: '0 0 auto', padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${ici ? P.encre : P.ligne}`, fontFamily: 'inherit',
                background: ici ? P.encre : P.surface, color: ici ? '#fff' : P.texte2,
                fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >{jourFr(c.date)} · {c.label}</button>
          );
        })}
      </div>

      {creneau && (
        <>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 10, marginBottom: 10,
          }}>
            <strong style={{ fontSize: 15 }}>Participants</strong>
            <span style={{ fontSize: 12.5, color: restants ? P.texte3 : P.vert, fontWeight: 700 }}>
              {restants ? `${restants} signature(s) attendue(s)` : 'Tout le monde a signé'}
            </span>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {(d.inscrits || []).map((a) => {
              const fait = signe(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button" disabled={fait} onClick={() => setQui(a)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: fait ? 'default' : 'pointer',
                      padding: '15px 16px', borderRadius: 12, fontFamily: 'inherit',
                      border: `1px solid ${fait ? 'rgba(30,132,73,.35)' : P.ligne}`,
                      background: fait ? 'rgba(30,132,73,.07)' : P.surface,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 15.5, fontWeight: 600 }}>
                      {a.firstName} {a.lastName}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: fait ? P.vert : P.texte3 }}>
                      {fait ? 'Signé' : 'Signer'}
                    </span>
                  </button>
                </li>
              );
            })}
            {!(d.inscrits || []).length && (
              <li style={{ color: P.texte3, fontSize: 13.5 }}>Aucun participant inscrit sur cette session.</li>
            )}
          </ul>

          {/* L'intervenant signe aussi : sa présence est une pièce du dossier. */}
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${P.ligne}` }}>
            <button
              type="button" disabled={signe(null, 'formateur')}
              onClick={() => setQui({ formateur: true })}
              style={{
                ...boutonPale, width: '100%',
                borderColor: signe(null, 'formateur') ? 'rgba(30,132,73,.35)' : P.ligne,
                color: signe(null, 'formateur') ? P.vert : P.texte2,
              }}
            >
              {signe(null, 'formateur')
                ? `Intervenant : signé${d.session.formateurName ? ` — ${d.session.formateurName}` : ''}`
                : `Signature de l’intervenant${d.session.formateurName ? ` (${d.session.formateurName})` : ''}`}
            </button>
          </div>
        </>
      )}

      {qui && creneau && (
        <Signature
          token={token} creneau={creneau} qui={qui}
          nomParDefaut={qui.formateur ? (d.session.formateurName || '') : `${qui.firstName} ${qui.lastName}`}
          onFermer={() => setQui(null)}
          onFait={() => { setQui(null); charger(); }}
        />
      )}
    </Cadre>
  );
}

/* Le créneau proposé d'emblée : celui d'aujourd'hui s'il tombe pendant la
   session, sinon le premier de la première journée. Personne ne devrait avoir
   à chercher la bonne demi-journée un matin de formation. */
function premierCreneau(d) {
  const jours = d.jours || [];
  if (!jours.length) return null;
  const auj = new Date().toISOString().slice(0, 10);
  const date = jours.includes(auj) ? auj : jours[0];
  const avantMidi = new Date().getHours() < 13;
  return { date, period: avantMidi ? 'matin' : 'apres_midi', label: avantMidi ? 'Matin' : 'Après-midi' };
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
      <p style={{ color: P.texte3, fontSize: 14, margin: 0 }}>{texte}</p>
    </div>
  );
}

function Signature({ token, creneau, qui, nomParDefaut, onFermer, onFait }) {
  const toile = useRef(null);
  const [vide, setVide] = useState(true);
  const [nom, setNom] = useState(nomParDefaut);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const c = toile.current;
    if (!c) return undefined;
    const l = c.getBoundingClientRect();
    c.width = l.width * 2; c.height = l.height * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = P.encre;
    let trace = false;
    const point = (e) => {
      const b = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - b.left, y: t.clientY - b.top };
    };
    const debut = (e) => { e.preventDefault(); trace = true; setVide(false); const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const bouge = (e) => { if (!trace) return; e.preventDefault(); const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const fin = () => { trace = false; };
    c.addEventListener('mousedown', debut); c.addEventListener('mousemove', bouge);
    window.addEventListener('mouseup', fin);
    c.addEventListener('touchstart', debut, { passive: false });
    c.addEventListener('touchmove', bouge, { passive: false });
    c.addEventListener('touchend', fin);
    return () => {
      c.removeEventListener('mousedown', debut); c.removeEventListener('mousemove', bouge);
      window.removeEventListener('mouseup', fin);
      c.removeEventListener('touchstart', debut); c.removeEventListener('touchmove', bouge);
      c.removeEventListener('touchend', fin);
    };
  }, []);

  const effacer = () => {
    const c = toile.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setVide(true);
  };

  const valider = async () => {
    if (vide || envoi) return;
    setEnvoi(true); setErreur('');
    try {
      const r = await fetch(`/api/public/emargement/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apprenantId: qui.formateur ? null : qui.id,
          formateur: Boolean(qui.formateur),
          date: creneau.date, period: creneau.period,
          signaturePng: toile.current.toDataURL('image/png'),
          signedName: nom,
        }),
      });
      if (r.ok) { onFait(); return; }
      const j = await r.json().catch(() => ({}));
      setErreur(j.error || 'Signature non enregistrée. Réessaie.');
    } catch {
      setErreur('Pas de réseau. La signature n’a pas été enregistrée.');
    }
    setEnvoi(false);
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Signature"
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,19,16,.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onFermer}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', background: P.papier, borderRadius: '20px 20px 0 0',
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
          maxHeight: '92dvh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-.02em' }}>
            {qui.formateur ? 'Signature de l’intervenant' : `${qui.firstName} ${qui.lastName}`}
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" style={{
            border: 0, background: 'transparent', color: P.texte3, fontSize: 26, lineHeight: 1, cursor: 'pointer',
          }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: P.texte3, margin: '6px 0 14px' }}>
          {jourFr(creneau.date)} · {creneau.period === 'matin' ? 'matin' : 'après-midi'}.
          Signez dans le cadre : votre signature atteste de votre présence sur cette demi-journée.
        </p>

        <input
          value={nom} onChange={(e) => setNom(e.target.value)}
          placeholder="Nom et prénom"
          style={{
            width: '100%', padding: '12px 13px', borderRadius: 10, marginBottom: 10,
            border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre,
            font: 'inherit', fontSize: 15,
          }}
        />

        <canvas ref={toile} style={{
          width: '100%', height: 180, background: P.surface, display: 'block',
          border: `1px dashed ${P.texte3}`, borderRadius: 10, touchAction: 'none',
        }} />

        <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
          <button type="button" onClick={effacer} style={boutonPale}>Effacer</button>
          <button
            type="button" onClick={valider} disabled={vide || envoi || !nom.trim()}
            style={{ ...bouton, flex: 1, opacity: vide || envoi || !nom.trim() ? 0.45 : 1 }}
          >{envoi ? 'Enregistrement…' : 'Valider ma présence'}</button>
        </div>

        {erreur && (
          <p role="alert" style={{ color: P.rouge, fontSize: 13, marginTop: 10, fontWeight: 600 }}>{erreur}</p>
        )}
      </div>
    </div>
  );
}

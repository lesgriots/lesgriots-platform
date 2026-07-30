'use client';

/**
 * /p/[token] — l'espace apprenant.
 *
 * Pas de compte, pas de mot de passe : un lien personnel, comme le reste de
 * l'OS. L'apprenant y trouve sa formation, y fait ce qu'on lui demande, et
 * repart avec ses documents.
 *
 * L'ordre des blocs n'est pas décoratif. Ce qui est attendu de lui vient en
 * premier, en or ; le reste se lit ensuite. C'est aussi ce qui remplit les
 * preuves d'audit qui manquaient : émargements et évaluations.
 *
 * Écrit pour un téléphone d'abord : c'est là qu'on signe, en salle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  : '';
const dateCourte = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

const P = {
  papier: '#f6f5f3', surface: '#fff', encre: '#141210',
  texte2: '#4a4744', texte3: '#8a857f', ligne: 'rgba(0,0,0,.11)', or: '#F5CE16',
};
const mono = {
  fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: P.texte3,
};
const carte = {
  background: P.surface, border: `1px solid ${P.ligne}`, borderRadius: 12,
  padding: 18, marginBottom: 12,
};
const boutonOr = {
  padding: '11px 18px', borderRadius: 9, border: 'none', background: P.or,
  color: P.encre, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

export default function EspaceApprenant({ params }) {
  const [token, setToken] = useState(null);
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');
  const [ecran, setEcran] = useState(null);   // { type: 'emargement' | 'questionnaire', … }

  useEffect(() => { Promise.resolve(params).then((p) => setToken(p.token)); }, [params]);

  const charger = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/public/espace/${token}`);
    if (!r.ok) { setErreur('Ce lien n’est plus valable. Contactez votre organisme de formation.'); return; }
    setD(await r.json());
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <Page><div style={carte}>{erreur}</div></Page>;
  if (!d) return <Page><div style={{ color: P.texte3, fontSize: 14 }}>Chargement…</div></Page>;

  const s = d.session;

  return (
    <Page organisme={d.organisme}>
      <div style={{ ...mono, marginBottom: 6 }}>Espace apprenant</div>
      <h1 style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
        Bonjour {d.apprenant.prenom || ''}
      </h1>
      <p style={{ fontSize: 15, color: P.texte2, margin: '8px 0 22px' }}>
        {s.titre}{s.debut ? ` · ${dateCourte(s.debut)}` : ''}
      </p>

      {/* ── Ce qu'on attend de vous ───────────────────────────────── */}
      {(d.a_faire.length > 0 || d.emargement.jours.length > 0) && (
        <section style={{ ...carte, borderColor: P.or, borderWidth: 2 }}>
          <div style={{ ...mono, marginBottom: 10 }}>À faire</div>

          {d.emargement.jours.map((j) => (
            <div key={j} style={{ padding: '9px 0', borderBottom: `1px solid ${P.ligne}` }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 7 }}>{dateFr(j)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['matin', 'Matin'], ['apres_midi', 'Après-midi']].map(([cle, label]) => {
                  const fait = d.emargement.signees.includes(j + '·' + cle);
                  // L'émargement s'ouvre le jour même : on ne signe pas l'avenir.
                  const aVenir = j > new Date().toISOString().slice(0, 10);
                  if (!fait && aVenir) return (
                    <span key={cle} style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13,
                      border: `1px dashed ${P.ligne}`, color: P.texte3,
                    }}>{label} · le jour même</span>
                  );
                  return fait ? (
                    <span key={cle} style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13,
                      border: `1px solid ${P.ligne}`, color: P.texte3,
                    }}>{label} · signé</span>
                  ) : (
                    <button key={cle} onClick={() => setEcran({ type: 'emargement', date: j, period: cle, label })}
                            style={{ ...boutonOr, fontSize: 13, padding: '8px 14px' }}>
                      Émarger · {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {d.a_faire.map((t) => (
            <div key={t.cle} style={{
              display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
              padding: '12px 0', borderBottom: `1px solid ${P.ligne}`,
            }}>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.label}</div>
                <div style={{ fontSize: 12.5, color: P.texte3 }}>{t.quand}</div>
              </div>
              <button onClick={() => setEcran({ type: 'questionnaire', questionnaire: t.cle })}
                      style={{ ...boutonOr, fontSize: 13, padding: '8px 14px' }}>Répondre</button>
            </div>
          ))}

          {d.a_faire.length === 0 && d.emargement.jours.every((j) =>
            d.emargement.signees.includes(j + '·matin') && d.emargement.signees.includes(j + '·apres_midi')) && (
            <div style={{ fontSize: 13.5, color: P.texte2, paddingTop: 4 }}>
              Tout est à jour. Merci.
            </div>
          )}
        </section>
      )}

      {s.presentation && (
        <section style={carte}>
          <p style={{ fontSize: 14, color: P.texte2, margin: 0, lineHeight: 1.65, whiteSpace: 'pre-line' }}>{s.presentation}</p>
        </section>
      )}

      {/* ── Ma session ────────────────────────────────────────────── */}
      <section style={carte}>
        <div style={{ ...mono, marginBottom: 10 }}>Ma session</div>
        <Ligne l="Dates" v={s.debut ? `${dateCourte(s.debut)}${s.fin && s.fin !== s.debut ? ` au ${dateCourte(s.fin)}` : ''}` : '—'} />
        {s.horaire && <Ligne l="Horaires" v={s.horaire} />}
        {s.duree_heures ? <Ligne l="Durée" v={`${s.duree_heures} heures`} /> : null}
        {s.lieu && <Ligne l="Lieu" v={[s.lieu.nom, s.lieu.adresse].filter(Boolean).join(' · ')} />}
        {s.modalite && <Ligne l="Modalité" v={s.modalite} />}
        {s.formateur && s.formateur_visible !== false && <Ligne l="Formateur" v={s.formateur} />}
        {s.accessibilite && <Ligne l="Accessibilité" v={s.accessibilite} />}
      </section>

      {/* ── Le programme ──────────────────────────────────────────── */}
      {(s.description || s.objectifs.length > 0 || d.modules.length > 0) && (
        <section style={carte}>
          <div style={{ ...mono, marginBottom: 10 }}>Le programme</div>
          {s.description && <p style={{ fontSize: 14, color: P.texte2, margin: '0 0 12px', lineHeight: 1.6 }}>{s.description}</p>}

          {s.objectifs.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Objectifs</div>
              <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, color: P.texte2, lineHeight: 1.7 }}>
                {s.objectifs.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </>
          )}

          {d.modules.map((m, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: `1px solid ${P.ligne}` }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                {m.titre}{m.heures ? <span style={{ color: P.texte3, fontWeight: 400 }}> · {m.heures} h</span> : null}
              </div>
              {m.description && <div style={{ fontSize: 13, color: P.texte2, marginTop: 3, lineHeight: 1.6 }}>{m.description}</div>}
            </div>
          ))}

          <Bloc l="Prérequis" items={s.prerequis} />
          <Bloc l="Public visé" items={s.public_vise} />
          <Bloc l="Modalités d’évaluation" items={s.evaluation} />
        </section>
      )}

      {/* ── Mes documents ─────────────────────────────────────────── */}
      <section style={carte}>
        <div style={{ ...mono, marginBottom: 10 }}>Mes documents</div>
        {d.documents.length === 0 ? (
          <p style={{ fontSize: 13.5, color: P.texte3, margin: 0 }}>
            Vos documents (convention, convocation, attestation) apparaîtront ici dès qu’ils seront émis.
          </p>
        ) : d.documents.map((doc) => (
          <div key={doc.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
            padding: '10px 0', borderBottom: `1px solid ${P.ligne}`,
          }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{doc.libelle || doc.categorie}</div>
              <div style={{ ...mono, fontSize: 9.5 }}>{doc.categorie}</div>
            </div>
            <a href={`/api/documents/${doc.id}?token=${token}`}
               style={{ fontSize: 13, color: P.encre, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Télécharger
            </a>
          </div>
        ))}
      </section>

      {/* ── Un problème ───────────────────────────────────────────── */}
      <section style={{ ...carte, background: 'transparent', border: 'none', padding: '4px 0 0' }}>
        <div style={{ fontSize: 12.5, color: P.texte3, lineHeight: 1.7 }}>
          Une question, une difficulté, une situation de handicap à signaler ?
          Écrivez à <a href={`mailto:${d.organisme.email}`} style={{ color: P.encre }}>{d.organisme.email}</a>
          {d.organisme.telephone ? ` ou appelez le ${d.organisme.telephone}` : ''}.
          Toute réclamation reçoit une réponse sous quinze jours.
        </div>
      </section>

      {ecran?.type === 'emargement' && (
        <Emargement
          token={token} ecran={ecran} nom={`${d.apprenant.prenom} ${d.apprenant.nom}`.trim()}
          onFermer={() => setEcran(null)} onFait={() => { setEcran(null); charger(); }}
        />
      )}
      {ecran?.type === 'questionnaire' && (
        <Questionnaire
          token={token} type={ecran.questionnaire}
          onFermer={() => setEcran(null)} onFait={() => { setEcran(null); charger(); }}
        />
      )}
    </Page>
  );
}

function Page({ children, organisme }) {
  return (
    <div style={{
      minHeight: '100vh', background: P.papier, color: P.encre,
      fontFamily: "'Geist', system-ui, -apple-system, sans-serif", lineHeight: 1.5,
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 64px' }}>
        {children}
        <div style={{ ...mono, textAlign: 'center', marginTop: 32 }}>
          LA GRIOTHÈQUE · Organisme de formation
        </div>
      </div>
    </div>
  );
}

/** Une liste quand il y a plusieurs éléments, une phrase quand il n'y en a qu'un. */
function Bloc({ l, items }) {
  const liste = Array.isArray(items) ? items : (items ? [items] : []);
  if (liste.length === 0) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.ligne}` }}>
      <div style={{ ...mono, marginBottom: 6 }}>{l}</div>
      {liste.length === 1 ? (
        <p style={{ fontSize: 13.5, color: P.texte2, margin: 0, lineHeight: 1.6 }}>{liste[0]}</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: P.texte2, lineHeight: 1.7 }}>
          {liste.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      )}
    </div>
  );
}

function Ligne({ l, v }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '7px 0', borderBottom: `1px solid ${P.ligne}` }}>
      <div style={{ ...mono, width: 108, flexShrink: 0, paddingTop: 2 }}>{l}</div>
      <div style={{ fontSize: 13.5, color: P.texte2 }}>{v}</div>
    </div>
  );
}

/** Signature au doigt : c'est en salle, sur un téléphone, que ça se signe. */
function Emargement({ token, ecran, nom, onFermer, onFait }) {
  const toile = useRef(null);
  const [vide, setVide] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const c = toile.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
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
    const r = await fetch(`/api/public/espace/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'emarger', date: ecran.date, period: ecran.period,
        signaturePng: toile.current.toDataURL('image/png'), signedName: nom,
      }),
    });
    if (r.ok) { onFait(); return; }
    const j = await r.json().catch(() => ({}));
    setErreur(j.error || 'Enregistrement impossible.');
    setEnvoi(false);
  };

  return (
    <Volet titre={`Émargement · ${ecran.label}`} sousTitre={dateFr(ecran.date)} onFermer={onFermer}>
      <p style={{ fontSize: 13.5, color: P.texte2, marginTop: 0 }}>
        Signez dans le cadre ci-dessous. Votre signature atteste de votre présence
        sur cette demi-journée.
      </p>
      <canvas ref={toile} style={{
        width: '100%', height: 170, background: P.surface,
        border: `1px dashed ${P.texte3}`, borderRadius: 10, touchAction: 'none', display: 'block',
      }} />
      <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={effacer} style={{
          padding: '11px 16px', borderRadius: 9, border: `1px solid ${P.ligne}`,
          background: 'transparent', color: P.texte2, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
        }}>Effacer</button>
        <button onClick={valider} disabled={vide || envoi} style={{ ...boutonOr, opacity: vide || envoi ? 0.45 : 1, flex: 1 }}>
          {envoi ? 'Enregistrement…' : 'Valider ma présence'}
        </button>
      </div>
      {erreur && <p style={{ color: '#B4402F', fontSize: 13, marginTop: 10 }}>{erreur}</p>}
    </Volet>
  );
}

function Questionnaire({ token, type, onFermer, onFait }) {
  const [def, setDef] = useState(null);
  const [rep, setRep] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch(`/api/public/espace/${token}/questionnaire?type=${type}`)
      .then((r) => r.json()).then(setDef).catch(() => setErreur('Questionnaire indisponible.'));
  }, [token, type]);

  const envoyer = async () => {
    setEnvoi(true); setErreur('');
    const r = await fetch(`/api/public/espace/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'questionnaire', type, answers: rep }),
    });
    if (r.ok) { onFait(); return; }
    const j = await r.json().catch(() => ({}));
    setErreur(j.error || 'Envoi impossible.');
    setEnvoi(false);
  };

  if (!def) return <Volet titre="Questionnaire" onFermer={onFermer}><p style={{ color: P.texte3 }}>Chargement…</p></Volet>;

  return (
    <Volet titre={def.label} sousTitre={def.intro} onFermer={onFermer}>
      {def.questions.map((q) => (
        <div key={q.key} style={{ marginBottom: 18 }}>
          {q.type === 'section' ? (
            <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: P.texte3, fontWeight: 700, marginTop: 8, paddingTop: 14, borderTop: `1px solid ${P.ligne}` }}>{q.label}</div>
          ) : (
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, marginBottom: 7 }}>
              {q.label}{q.required && <span style={{ color: P.texte3, fontWeight: 400 }}> *</span>}
            </label>
          )}

          {q.type === 'note' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRep((r) => ({ ...r, [q.key]: n }))} style={pastille(rep[q.key] === n)}>{n}</button>
              ))}
            </div>
          )}
          {q.type === 'nps' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} onClick={() => setRep((r) => ({ ...r, [q.key]: n }))} style={pastille(rep[q.key] === n, 36)}>{n}</button>
              ))}
            </div>
          )}
          {q.type === 'choice' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {q.options.map((o) => (
                <button key={o} onClick={() => setRep((r) => ({ ...r, [q.key]: o }))} style={{
                  ...pastille(rep[q.key] === o), width: 'auto', padding: '9px 13px', fontSize: 13,
                }}>{o}</button>
              ))}
            </div>
          )}
          {q.type === 'bool' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[['oui', 'Oui'], ['non', 'Non']].map(([v, l]) => (
                <button key={v} onClick={() => setRep((r) => ({ ...r, [q.key]: v }))} style={{
                  ...pastille(rep[q.key] === v), width: 'auto', padding: '9px 18px', fontSize: 13,
                }}>{l}</button>
              ))}
            </div>
          )}
          {q.type === 'echelle' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(q.options || []).map((o) => (
                <button key={o} onClick={() => setRep((r) => ({ ...r, [q.key]: o }))} style={{
                  ...pastille(rep[q.key] === o), width: 'auto', padding: '9px 13px', fontSize: 13,
                }}>{o}</button>
              ))}
            </div>
          )}
          {q.type === 'multi' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(q.options || []).map((o) => {
                const choisies = Array.isArray(rep[q.key]) ? rep[q.key] : [];
                const prise = choisies.includes(o);
                return (
                  <button key={o} onClick={() => setRep((r) => {
                    const c = Array.isArray(r[q.key]) ? r[q.key] : [];
                    return { ...r, [q.key]: prise ? c.filter((x) => x !== o) : [...c, o] };
                  })} style={{
                    ...pastille(prise), width: 'auto', padding: '9px 13px', fontSize: 13,
                  }}>{prise ? '✓ ' : ''}{o}</button>
                );
              })}
            </div>
          )}
          {(q.type === 'nombre' || q.type === 'date') && (
            <input
              type={q.type === 'date' ? 'date' : 'number'}
              value={rep[q.key] || ''}
              onChange={(e) => setRep((r) => ({ ...r, [q.key]: e.target.value }))}
              style={{
                width: '100%', maxWidth: 220, padding: '10px 12px', borderRadius: 9,
                border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre,
                fontFamily: 'inherit', fontSize: 16,
              }}
            />
          )}
          {q.type === 'text' && (
            <textarea
              value={rep[q.key] || ''} rows={3}
              onChange={(e) => setRep((r) => ({ ...r, [q.key]: e.target.value }))}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9, resize: 'vertical',
                border: `1px solid ${P.ligne}`, background: P.surface, color: P.encre,
                fontFamily: 'inherit', fontSize: 16,
              }}
            />
          )}
        </div>
      ))}

      <button onClick={envoyer} disabled={envoi} style={{ ...boutonOr, width: '100%', opacity: envoi ? 0.5 : 1 }}>
        {envoi ? 'Envoi…' : 'Envoyer mes réponses'}
      </button>
      {erreur && <p style={{ color: '#B4402F', fontSize: 13, marginTop: 10 }}>{erreur}</p>}
      <p style={{ fontSize: 12, color: P.texte3, marginTop: 12 }}>
        Vos réponses ne sont lues que par votre organisme de formation, pour améliorer ses formations.
      </p>
    </Volet>
  );
}

const pastille = (actif, taille = 44) => ({
  width: taille, height: 44, borderRadius: 9, cursor: 'pointer',
  border: `1px solid ${actif ? P.encre : P.ligne}`,
  background: actif ? P.encre : P.surface,
  color: actif ? '#fff' : P.texte2,
  fontFamily: 'inherit', fontSize: 14, fontWeight: actif ? 600 : 400,
});

function Volet({ titre, sousTitre, onFermer, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,18,16,.45)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onFermer}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: P.papier, width: 'min(680px, 100%)', maxHeight: '92vh', overflowY: 'auto',
        borderRadius: '16px 16px 0 0', padding: '20px 18px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{titre}</div>
            {sousTitre && <div style={{ fontSize: 13, color: P.texte3, marginTop: 3 }}>{sousTitre}</div>}
          </div>
          <button onClick={onFermer} style={{
            background: 'none', border: 'none', fontSize: 22, lineHeight: 1,
            color: P.texte3, cursor: 'pointer', padding: 0,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

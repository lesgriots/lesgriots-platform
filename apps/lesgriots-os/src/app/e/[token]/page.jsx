'use client';

/**
 * /e/[token] — l'espace entreprise.
 *
 * Le service RH ou le dirigeant qui a envoyé ses salariés en formation vient
 * ici chercher trois choses, et rien d'autre : qui est inscrit, qui est
 * venu, où sont les papiers. Ce sont exactement les trois questions qui
 * arrivent par mail aujourd'hui, une par une, souvent la veille du solde du
 * dossier OPCO.
 *
 * La présence est le cœur de l'écran. Un OPCO ne rembourse pas sur une
 * déclaration, il rembourse sur des demi-journées émargées : les afficher
 * telles quelles, x sur y, évite la conversation où l'on découvre trop tard
 * qu'un salarié a manqué la moitié du stage.
 *
 * Ce qu'on ne montre pas est aussi un choix. Les réponses aux questionnaires
 * appartiennent au salarié, pas à son employeur ; l'entreprise voit
 * seulement si la réponse a été remise, parce que le dossier en dépend.
 */

import { useCallback, useEffect, useState } from 'react';

const dateCourte = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

const P = {
  papier: '#f6f5f3', surface: '#fff', encre: '#141310',
  texte2: '#4a4744', texte3: '#8a857f', ligne: 'rgba(0,0,0,.11)',
  or: '#FFCA00', orTexte: '#8a6d00', orVoile: 'rgba(255,202,0,.14)',
  vert: '#1E8449', vertVoile: 'rgba(30,132,73,.12)',
  ambre: '#B07A0E', ambreVoile: 'rgba(176,122,14,.12)',
};
const mono = {
  fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: P.texte3,
};
const carte = {
  background: P.surface, border: `1px solid ${P.ligne}`, borderRadius: 14,
  padding: 18, marginBottom: 12,
};

const ETATS = {
  a_venir: { l: 'À venir', c: P.orTexte, f: P.orVoile },
  en_cours: { l: 'En cours', c: P.vert, f: P.vertVoile },
  terminee: { l: 'Terminée', c: P.texte3, f: 'rgba(0,0,0,.05)' },
  a_planifier: { l: 'À planifier', c: P.ambre, f: P.ambreVoile },
};

export default function EspaceEntreprise({ params }) {
  const [token, setToken] = useState(null);
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => { Promise.resolve(params).then((p) => setToken(p.token)); }, [params]);

  const charger = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/public/entreprise/${token}`);
    if (!r.ok) { setErreur('Ce lien n’est plus valable. Écrivez à votre organisme de formation pour en recevoir un nouveau.'); return; }
    setD(await r.json());
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  if (erreur) return <Page><div style={carte}>{erreur}</div></Page>;
  if (!d) return <Page><div style={{ color: P.texte3, fontSize: 14 }}>Chargement…</div></Page>;

  const sessions = d.sessions || [];
  const enCours = sessions.filter((s) => s.etat === 'en_cours' || s.etat === 'a_venir');
  const passees = sessions.filter((s) => s.etat === 'terminee' || s.etat === 'a_planifier');
  const totalSalaries = new Set(
    sessions.flatMap((s) => s.salaries.map((x) => `${x.prenom} ${x.nom}`)),
  ).size;

  return (
    <Page organisme={d.organisme} entreprise={d.entreprise.nom}>
      <h1 style={{
        fontSize: 'clamp(23px, 5.8vw, 31px)', fontWeight: 600,
        letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 8px',
      }}>{d.entreprise.nom}</h1>
      <p style={{ fontSize: 14.5, color: P.texte2, margin: '0 0 20px' }}>
        {sessions.length === 0
          ? 'Aucune formation enregistrée pour le moment.'
          : `${sessions.length} formation${sessions.length > 1 ? 's' : ''}, ${totalSalaries} salarié${totalSalaries > 1 ? 's' : ''} concerné${totalSalaries > 1 ? 's' : ''}.`}
      </p>

      {enCours.map((s) => <Session key={s.id} s={s} token={token} />)}

      {passees.length > 0 && (
        <>
          <div style={{ ...mono, margin: '22px 0 10px' }}>Formations passées</div>
          {passees.map((s) => <Session key={s.id} s={s} token={token} />)}
        </>
      )}

      {(d.documents || []).length > 0 && (
        <section style={carte}>
          <div style={{ ...mono, marginBottom: 11 }}>Vos documents</div>
          {d.documents.map((doc) => <LigneDocument key={doc.id} doc={doc} token={token} />)}
        </section>
      )}

      <section style={{ ...carte, background: 'transparent', border: 'none', padding: '4px 2px 0' }}>
        <div style={{ fontSize: 12.5, color: P.texte3, lineHeight: 1.7 }}>
          Une question sur un dossier, une pièce qui manque, un salarié à inscrire ?
          Écrivez à <a href={`mailto:${d.organisme.email}`} style={{ color: P.encre }}>{d.organisme.email}</a>
          {d.organisme.telephone ? ` ou appelez le ${d.organisme.telephone}` : ''}.
          {d.organisme.nda ? ` Déclaration d’activité n° ${d.organisme.nda}.` : ''}
        </div>
      </section>
    </Page>
  );
}

function Session({ s, token }) {
  const etat = ETATS[s.etat] || ETATS.a_venir;
  return (
    <section style={carte}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
        <h2 style={{
          flex: 1, minWidth: 0, margin: 0, fontSize: 16.5, fontWeight: 600,
          letterSpacing: '-0.02em', lineHeight: 1.3,
        }}>{s.titre}</h2>
        <span style={{
          ...mono, fontSize: 9, flex: 'none', color: etat.c, background: etat.f,
          padding: '4px 8px', borderRadius: 5,
        }}>{etat.l}</span>
      </div>
      <p style={{ fontSize: 13, color: P.texte3, margin: '0 0 14px' }}>
        {s.debut ? `${dateCourte(s.debut)}${s.fin && s.fin !== s.debut ? ` au ${dateCourte(s.fin)}` : ''}` : 'Dates à fixer'}
        {s.duree_heures ? ` · ${s.duree_heures} h` : ''}
        {s.modalite ? ` · ${s.modalite}` : ''}
      </p>

      {s.salaries.length === 0 ? (
        <p style={{ fontSize: 13.5, color: P.texte3, margin: 0 }}>Aucun salarié inscrit sur cette session.</p>
      ) : (
        <div>
          <div style={{
            display: 'flex', gap: 10, padding: '0 0 7px',
            borderBottom: `1px solid ${P.ligne}`,
          }}>
            <div style={{ ...mono, flex: 1 }}>Salarié</div>
            <div style={{ ...mono, width: 92, textAlign: 'right' }}>Présence</div>
            <div style={{ ...mono, width: 86, textAlign: 'right' }}>Réponses</div>
          </div>
          {s.salaries.map((p, i) => {
            const complet = p.presence.total > 0 && p.presence.signees >= p.presence.total;
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '10px 0', borderBottom: `1px solid ${P.ligne}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {p.prenom} {p.nom}
                    {p.statut === 'annule' && (
                      <span style={{ ...mono, fontSize: 9, marginLeft: 7, color: P.texte3 }}>annulé</span>
                    )}
                    {p.statut === 'liste_attente' && (
                      <span style={{ ...mono, fontSize: 9, marginLeft: 7, color: P.ambre }}>liste d’attente</span>
                    )}
                  </div>
                  {p.attestation && (
                    <a href={`/api/public/document/${p.attestation.id}?token=${token}`} style={{
                      fontSize: 12, color: P.encre, textUnderlineOffset: 3, textDecoration: 'underline',
                    }}>Attestation</a>
                  )}
                </div>
                <div style={{
                  width: 92, textAlign: 'right', fontSize: 13,
                  color: complet ? P.vert : P.texte2,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {p.presence.total > 0 ? `${p.presence.signees}/${p.presence.total}` : '—'}
                  <div style={{ ...mono, fontSize: 8.5 }}>demi-journées</div>
                </div>
                <div style={{ width: 86, textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <Jeton fait={p.positionnement} titre="Questionnaire de positionnement" lettre="P" />
                  <Jeton fait={p.satisfaction} titre="Questionnaire de satisfaction" lettre="S" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {s.documents.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.ligne}` }}>
          <div style={{ ...mono, marginBottom: 8 }}>Pièces de la session</div>
          {s.documents.map((doc) => <LigneDocument key={doc.id} doc={doc} token={token} />)}
        </div>
      )}

      {s.partagee && (
        <p style={{ fontSize: 12, color: P.texte3, margin: '12px 0 0', lineHeight: 1.6 }}>
          Cette session réunit plusieurs entreprises : ses pièces communes vous sont
          envoyées par mail, elles ne peuvent pas être publiées ici.
        </p>
      )}
    </section>
  );
}

/** Deux lettres valent mieux que deux pastilles vertes : on sait ce qui manque. */
function Jeton({ fait, titre, lettre }) {
  return (
    <span title={`${titre} · ${fait ? 'remis' : 'en attente'}`} style={{
      width: 22, height: 22, borderRadius: 6, fontSize: 10.5, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: fait ? P.vertVoile : 'rgba(0,0,0,.045)',
      color: fait ? P.vert : P.texte3,
      border: `1px solid ${fait ? 'rgba(30,132,73,.3)' : P.ligne}`,
    }}>{lettre}</span>
  );
}

function LigneDocument({ doc, token }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
      padding: '9px 0', borderBottom: `1px solid ${P.ligne}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5 }}>{doc.libelle || doc.categorie}</div>
        <div style={{ ...mono, fontSize: 9.5 }}>
          {doc.categorie}{doc.signe ? ' · signé' : ''}
        </div>
      </div>
      <a href={`/api/public/document/${doc.id}?token=${token}`}
         style={{ fontSize: 13, color: P.encre, textDecoration: 'underline', textUnderlineOffset: 3, flex: 'none' }}>
        Télécharger
      </a>
    </div>
  );
}

function Page({ children, organisme, entreprise }) {
  return (
    <div style={{
      minHeight: '100vh', background: P.papier, color: P.encre,
      fontFamily: "'Geist', system-ui, -apple-system, sans-serif", lineHeight: 1.5,
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />
      <header style={{
        background: 'linear-gradient(140deg, #232019 0%, #141310 60%, #0F0E0C 100%)',
        color: '#f4f1ea',
      }}>
        <div style={{
          maxWidth: 760, margin: '0 auto', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 11,
        }}>
          <span style={{
            width: 30, height: 30, flex: 'none', borderRadius: 9,
            background: 'linear-gradient(140deg, #FFD84D 0%, #ffca00 100%)',
            color: '#171407', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, letterSpacing: '-.04em',
          }}>LG</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 12.5, fontWeight: 600, letterSpacing: '-.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{organisme?.nom || 'LA GRIOTHÈQUE'}</span>
            <span style={{ ...mono, fontSize: 9, color: 'rgba(244,241,234,.55)' }}>Espace entreprise</span>
          </span>
          {entreprise && (
            <span style={{
              ...mono, fontSize: 9.5, color: 'rgba(244,241,234,.75)', maxWidth: 180,
              border: '1px solid rgba(244,241,234,.22)', borderRadius: 999, padding: '5px 11px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{entreprise}</span>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
        {children}
        <div style={{ ...mono, textAlign: 'center', marginTop: 32 }}>
          {organisme?.nom || 'LA GRIOTHÈQUE'} · Organisme de formation
        </div>
      </div>
    </div>
  );
}

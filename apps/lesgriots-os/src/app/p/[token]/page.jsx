'use client';

/**
 * /p/[token] — l'espace apprenant.
 *
 * Pas de compte, pas de mot de passe : un lien personnel, comme le reste de
 * l'OS. L'apprenant y trouve sa formation, y fait ce qu'on lui demande, et
 * repart avec ses documents.
 *
 * La page suit le temps de l'apprenant, pas l'organisation de la base. Avant
 * la session, elle répond à « où, quand, comment j'y vais ». Pendant, elle
 * met l'émargement du jour au premier plan. Après, elle sort l'attestation de
 * la pile des documents, parce que c'est la seule chose qu'on revient
 * chercher six mois plus tard. Un bandeau de parcours dit à voix haute où
 * l'on se trouve : cela évite de lire trois cartes pour comprendre qu'il n'y
 * a rien à faire aujourd'hui.
 *
 * Écrit pour un téléphone d'abord : c'est là qu'on signe, en salle. Les
 * couleurs sont celles de l'OS, mais la page ne dépend d'aucun de ses
 * composants : elle doit s'afficher vite, sur un réseau de salle, et survivre
 * à n'importe quel remaniement de l'application.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  : '';
const dateCourte = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';
const AUJOURDHUI = () => new Date().toISOString().slice(0, 10);
const joursEntre = (a, b) => Math.round(
  (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000,
);

const P = {
  papier: '#f6f5f3', surface: '#fff', encre: '#141310',
  texte2: '#4a4744', texte3: '#8a857f', ligne: 'rgba(0,0,0,.11)',
  or: '#FFCA00', orTexte: '#8a6d00', orVoile: 'rgba(255,202,0,.14)',
  vert: '#1E8449',
};
const mono = {
  fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: P.texte3,
};
const carte = {
  background: P.surface, border: `1px solid ${P.ligne}`, borderRadius: 14,
  padding: 18, marginBottom: 12,
};
const boutonOr = {
  padding: '11px 18px', borderRadius: 9, border: 'none', background: P.or,
  color: P.encre, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

/* Six pictogrammes, tracés ici plutôt qu'importés : cette page doit peser le
   moins possible, elle s'ouvre souvent sur le réseau d'une salle. */
const TRACES = {
  calendrier: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 3.5v4M15.5 3.5v4',
  lieu: 'M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  livre: 'M4 5.5h6a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2H4zM20 5.5h-6A2.5 2.5 0 0 0 11.5 8v11a2 2 0 0 1 2-2H20z',
  dossier: 'M4.5 7.5h5l1.5 2h8.5v10h-15zM4.5 7.5v-3h5v3',
  sceau: 'M12 3.5l2.4 1.7 2.9-.2.9 2.8 2.3 1.8-1.4 2.6.5 2.9-2.8.8-1.8 2.3L12 17l-2.9 1.2-1.8-2.3-2.8-.8.5-2.9L3.6 9.6l2.3-1.8.9-2.8 2.9.2z',
  aide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.8 9.4a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .9-1 1.6v.4M12 16.8h.01',
  fait: 'M4.5 12.5l5 5 10-11',
};
const Ico = ({ n, taille = 15, trait = 1.5, couleur = 'currentColor' }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur}
       strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round" aria-hidden
       style={{ flex: 'none', display: 'block' }}>
    <path d={TRACES[n]} />
  </svg>
);

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
  const auj = AUJOURDHUI();
  const debut = s.debut ? String(s.debut).slice(0, 10) : '';
  const fin = String(s.fin || s.debut || '').slice(0, 10);

  /* Trois moments, et un seul à la fois. Tout le reste de la page en découle. */
  const moment = !debut ? 'avant'
    : (auj < debut ? 'avant' : (fin && auj > fin ? 'apres' : 'pendant'));

  const restant = debut && moment === 'avant' ? joursEntre(auj, debut) : 0;
  const jourCourant = moment === 'pendant' && debut ? joursEntre(debut, auj) + 1 : 0;
  const totalJours = debut && fin ? joursEntre(debut, fin) + 1 : 1;

  const situation = moment === 'avant'
    ? (restant === 0 ? "C’est aujourd’hui." : restant === 1 ? "C’est demain." : `Dans ${restant} jours.`)
    : moment === 'pendant'
      ? (totalJours > 1 ? `Jour ${jourCourant} sur ${totalJours}.` : "C’est aujourd’hui.")
      : `Formation terminée le ${dateCourte(fin)}.`;

  /* Les émargements du jour d'abord : en salle, c'est la seule chose qui
     compte, et la faire chercher dans une liste de dates coûte deux minutes
     à vingt personnes en même temps. */
  const joursEmargement = d.emargement.jours;
  const signee = (j, cle) => d.emargement.signees.includes(j + '·' + cle);
  const toutSigne = joursEmargement.length > 0 && joursEmargement.every(
    (j) => j > auj || (signee(j, 'matin') && signee(j, 'apres_midi')),
  );
  const restantAujourdhui = joursEmargement.includes(auj)
    && (!signee(auj, 'matin') || !signee(auj, 'apres_midi'));

  /* L'attestation ne se range pas avec les autres pièces : c'est celle qu'on
     revient chercher, parfois des années après. */
  const PREUVES = new Set(['attestation', 'certificat']);
  const preuves = (d.documents || []).filter((x) => PREUVES.has(x.categorie));
  const autresDocs = (d.documents || []).filter((x) => !PREUVES.has(x.categorie));
  const convocation = autresDocs.find((x) => x.categorie === 'convocation');

  const adresse = s.lieu ? [s.lieu.nom, s.lieu.adresse].filter(Boolean).join(' · ') : '';
  const itineraire = s.lieu?.adresse
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.lieu.adresse)}`
    : '';

  const rien = d.a_faire.length === 0 && (joursEmargement.length === 0 || toutSigne);

  return (
    <Page organisme={d.organisme} prenom={d.apprenant.prenom}>
      <h1 style={{
        fontSize: 'clamp(23px, 5.8vw, 31px)', fontWeight: 600,
        letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 8px',
      }}>{s.titre}</h1>
      <p style={{ fontSize: 14.5, color: P.texte2, margin: '0 0 18px' }}>
        {situation}
        {debut && moment !== 'apres' ? ` ${dateCourte(debut)}${fin && fin !== debut ? ` au ${dateCourte(fin)}` : ''}.` : ''}
      </p>

      <Parcours moment={moment} />

      {/* ── Ce qu'on attend de vous ───────────────────────────────── */}
      {(d.a_faire.length > 0 || joursEmargement.length > 0) && (
        <section style={{
          ...carte,
          borderColor: rien ? P.ligne : P.or,
          borderWidth: rien ? 1 : 2,
          background: rien ? P.surface : '#fffdf5',
        }}>
          <Entete
            icone={rien ? 'fait' : 'calendrier'}
            titre={rien ? 'Rien à faire pour l’instant' : 'À faire'}
            note={restantAujourdhui ? 'Aujourd’hui' : ''}
          />

          {rien ? (
            <p style={{ fontSize: 13.5, color: P.texte2, margin: 0, lineHeight: 1.6 }}>
              Tout est à jour de votre côté. Les prochaines demandes apparaîtront ici,
              et vous recevrez un message quand ce sera le cas.
            </p>
          ) : null}

          {/* Quand il n'y a rien à faire, on ne liste pas non plus les
              demi-journées à venir : « rien à faire » suivi de trois dates,
              c'est se contredire dans la même carte. */}
          {(rien ? [] : joursEmargement).map((j) => {
            const complet = signee(j, 'matin') && signee(j, 'apres_midi');
            if (complet) return null;
            const cestAujourdhui = j === auj;
            return (
              <div key={j} style={{ padding: '10px 0', borderBottom: `1px solid ${P.ligne}` }}>
                <div style={{
                  fontSize: 14, fontWeight: cestAujourdhui ? 600 : 500, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {dateFr(j)}
                  {cestAujourdhui && (
                    <span style={{
                      ...mono, fontSize: 9, color: P.orTexte, background: P.orVoile,
                      padding: '3px 7px', borderRadius: 5,
                    }}>Aujourd’hui</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['matin', 'Matin'], ['apres_midi', 'Après-midi']].map(([cle, label]) => {
                    const fait = signee(j, cle);
                    // L'émargement s'ouvre le jour même : on ne signe pas l'avenir.
                    const aVenir = j > auj;
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
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}><Ico n="fait" taille={13} couleur={P.vert} />{label} · signé</span>
                    ) : (
                      <button key={cle} onClick={() => setEcran({ type: 'emargement', date: j, period: cle, label })}
                              style={{ ...boutonOr, fontSize: 13, padding: '8px 14px' }}>
                        Émarger · {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

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
        </section>
      )}

      {/* ── Mon attestation ───────────────────────────────────────── */}
      {preuves.length > 0 && (
        <section style={{ ...carte, borderColor: 'rgba(30,132,73,.35)' }}>
          <Entete icone="sceau" titre={preuves.length > 1 ? 'Mes attestations' : 'Mon attestation'} />
          <p style={{ fontSize: 13, color: P.texte2, margin: '0 0 10px', lineHeight: 1.6 }}>
            Gardez-la : c’est la preuve que vous avez suivi cette formation. Elle vous sera
            demandée par un employeur, un financeur ou pour une VAE.
          </p>
          {preuves.map((doc) => (
            <a key={doc.id} href={`/api/public/document/${doc.id}?token=${token}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              padding: '12px 14px', marginTop: 8, borderRadius: 10, textDecoration: 'none',
              background: P.papier, border: `1px solid ${P.ligne}`, color: P.encre,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{doc.libelle || doc.categorie}</span>
              <span style={{ fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}>Télécharger</span>
            </a>
          ))}
        </section>
      )}

      {/* ── Avant de venir ────────────────────────────────────────── */}
      {moment === 'avant' && (
        <section style={carte}>
          <Entete icone="lieu" titre="Avant de venir" />
          <Ligne l="Quand" v={debut
            ? `${dateFr(debut)}${s.horaire ? ` · ${s.horaire}` : ''}`
            : 'Dates à confirmer'} />
          {adresse ? (
            <div style={{ display: 'flex', gap: 14, padding: '7px 0', borderBottom: `1px solid ${P.ligne}` }}>
              <div style={{ ...mono, width: 108, flexShrink: 0, paddingTop: 2 }}>Où</div>
              <div style={{ fontSize: 13.5, color: P.texte2 }}>
                {adresse}
                {itineraire && (
                  <>{' · '}<a href={itineraire} target="_blank" rel="noreferrer"
                     style={{ color: P.encre, textUnderlineOffset: 3 }}>itinéraire</a></>
                )}
              </div>
            </div>
          ) : s.modalite ? <Ligne l="Où" v={s.modalite} /> : null}
          {s.duree_heures ? <Ligne l="Durée" v={`${s.duree_heures} heures`} /> : null}
          {s.formateur && s.formateur_visible !== false && <Ligne l="Avec" v={s.formateur} />}
          {convocation && (
            <div style={{ paddingTop: 12 }}>
              <a href={`/api/public/document/${convocation.id}?token=${token}`} style={{
                ...boutonOr, display: 'inline-block', textDecoration: 'none', fontSize: 13.5,
              }}>Télécharger ma convocation</a>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: P.texte3, margin: '12px 0 0', lineHeight: 1.6 }}>
            Un empêchement, un retard, un besoin d’aménagement ? Prévenez-nous en amont,
            c’est toujours plus simple à régler avant le jour J.
          </p>
        </section>
      )}

      {s.presentation && (
        <section style={carte}>
          <p style={{ fontSize: 14, color: P.texte2, margin: 0, lineHeight: 1.65, whiteSpace: 'pre-line' }}>{s.presentation}</p>
        </section>
      )}

      {/* ── Ma session ────────────────────────────────────────────── */}
      <section style={carte}>
        <Entete icone="calendrier" titre="Ma session" />
        <Ligne l="Dates" v={debut ? `${dateCourte(debut)}${fin && fin !== debut ? ` au ${dateCourte(fin)}` : ''}` : '—'} />
        {s.horaire && <Ligne l="Horaires" v={s.horaire} />}
        {s.duree_heures ? <Ligne l="Durée" v={`${s.duree_heures} heures`} /> : null}
        {adresse && <Ligne l="Lieu" v={adresse} />}
        {s.modalite && <Ligne l="Modalité" v={s.modalite} />}
        {s.formateur && s.formateur_visible !== false && <Ligne l="Formateur" v={s.formateur} />}
        {s.accessibilite && <Ligne l="Accessibilité" v={s.accessibilite} />}
      </section>

      {/* ── Le programme ──────────────────────────────────────────── */}
      {(s.description || s.objectifs.length > 0 || d.modules.length > 0) && (
        <section style={carte}>
          <Entete icone="livre" titre="Le programme" />
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
        <Entete icone="dossier" titre="Mes documents" />
        {d.ressources_etat === 'a_venir' && (
          <p style={{ fontSize: 13.5, color: P.texte3, margin: '0 0 10px' }}>
            Les supports de travail s’ouvriront le premier jour de la formation.
          </p>
        )}
        {d.ressources_etat === 'retirees' && (
          <p style={{ fontSize: 13.5, color: P.texte3, margin: '0 0 10px' }}>
            Les supports de travail ont été retirés, trente jours après la fin de la formation.
            Écrivez-nous si vous en avez encore besoin.
          </p>
        )}
        {d.ressources_etat === 'ouvertes' && d.ressources_jusqu_au && (
          <p style={{ fontSize: 12.5, color: P.texte3, margin: '0 0 10px' }}>
            Supports accessibles jusqu’au {dateCourte(d.ressources_jusqu_au)}.
          </p>
        )}
        {(d.ressources || []).map((r) => (
          <div key={r.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
            padding: '10px 0', borderBottom: `1px solid ${P.ligne}`,
          }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{r.title}</div>
              <div style={{ ...mono, fontSize: 9.5 }}>{r.resource_type || 'ressource'}</div>
            </div>
            {r.url && <a href={r.url} target="_blank" rel="noreferrer"
               style={{ fontSize: 13, color: P.encre, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Ouvrir
            </a>}
          </div>
        ))}
        {autresDocs.length === 0 && !(d.ressources || []).length ? (
          <p style={{ fontSize: 13.5, color: P.texte3, margin: 0 }}>
            Votre convocation, vos supports de travail et votre attestation apparaîtront ici au fil de la formation.
          </p>
        ) : autresDocs.map((doc) => (
          <div key={doc.id} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
            padding: '10px 0', borderBottom: `1px solid ${P.ligne}`,
          }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{doc.libelle || doc.categorie}</div>
              <div style={{ ...mono, fontSize: 9.5 }}>{doc.categorie}</div>
            </div>
            <a href={`/api/public/document/${doc.id}?token=${token}`}
               style={{ fontSize: 13, color: P.encre, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Télécharger
            </a>
          </div>
        ))}
      </section>

      {/* ── Un problème ───────────────────────────────────────────── */}
      <section style={{ ...carte, background: 'transparent', border: 'none', padding: '4px 2px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ paddingTop: 2, color: P.texte3 }}><Ico n="aide" taille={15} /></span>
          <div style={{ fontSize: 12.5, color: P.texte3, lineHeight: 1.7 }}>
            Une question, une difficulté, une situation de handicap à signaler ?
            Écrivez à <a href={`mailto:${d.organisme.email}`} style={{ color: P.encre }}>{d.organisme.email}</a>
            {d.organisme.telephone ? ` ou appelez le ${d.organisme.telephone}` : ''}.
            {d.organisme.referent_handicap
              ? ` Votre référent handicap est ${d.organisme.referent_handicap} : un aménagement se prépare, il n’enlève rien à la formation.`
              : ''}
            {' '}Toute réclamation reçoit une réponse sous quinze jours.
          </div>
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

/**
 * Le parcours en trois temps.
 *
 * Trois segments, celui du moment en or. Ce n'est pas un ornement : quelqu'un
 * qui ouvre son espace trois semaines avant la session doit comprendre en une
 * seconde qu'il n'y a rien à faire d'autre qu'attendre, et quelqu'un qui
 * l'ouvre en salle doit voir qu'on attend sa signature.
 */
function Parcours({ moment }) {
  const etapes = [
    { cle: 'avant', label: 'Avant', note: 'Se préparer' },
    { cle: 'pendant', label: 'Pendant', note: 'Émarger' },
    { cle: 'apres', label: 'Après', note: 'Évaluer, recevoir' },
  ];
  const index = etapes.findIndex((e) => e.cle === moment);
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }} aria-label="Étape du parcours">
      {etapes.map((e, i) => {
        const ici = i === index;
        const passe = i < index;
        return (
          <div key={e.cle} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              height: 3, borderRadius: 2, marginBottom: 6,
              background: ici ? P.or : passe ? P.encre : P.ligne,
            }} />
            <div style={{
              ...mono, fontSize: 9.5,
              color: ici ? P.encre : P.texte3,
              fontWeight: ici ? 700 : 400,
            }}>{e.label}</div>
            <div style={{
              fontSize: 11, color: ici ? P.texte2 : P.texte3,
              marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{e.note}</div>
          </div>
        );
      })}
    </div>
  );
}

function Entete({ icone, titre, note }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11,
    }}>
      <span style={{ color: P.texte3 }}><Ico n={icone} taille={14} /></span>
      <span style={{ ...mono, color: P.texte3 }}>{titre}</span>
      {note && (
        <span style={{
          ...mono, fontSize: 9, marginLeft: 'auto', color: P.orTexte,
          background: P.orVoile, padding: '3px 7px', borderRadius: 5,
        }}>{note}</span>
      )}
    </div>
  );
}

function Page({ children, organisme, prenom }) {
  return (
    <div style={{
      minHeight: '100vh', background: P.papier, color: P.encre,
      fontFamily: "'Geist', system-ui, -apple-system, sans-serif", lineHeight: 1.5,
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" />

      {/* Le bandeau encre de l'OS, réduit à ce dont l'apprenant a besoin :
          savoir chez qui il est, et que c'est bien son espace. */}
      <header style={{
        background: 'linear-gradient(140deg, #232019 0%, #141310 60%, #0F0E0C 100%)',
        color: '#f4f1ea',
      }}>
        <div style={{
          maxWidth: 680, margin: '0 auto', padding: '14px 16px',
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
            }}>{organisme?.marque || 'LA GRIOTHÈQUE'}</span>
            <span style={{ ...mono, fontSize: 9, color: 'rgba(244,241,234,.55)' }}>Espace apprenant</span>
          </span>
          {prenom && (
            <span style={{
              ...mono, fontSize: 9.5, color: 'rgba(244,241,234,.75)',
              border: '1px solid rgba(244,241,234,.22)', borderRadius: 999, padding: '5px 11px',
            }}>{prenom}</span>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 64px' }}>
        {children}
        <div style={{ ...mono, textAlign: 'center', marginTop: 32, lineHeight: 1.8 }}>
          {organisme?.marque || 'LA GRIOTHÈQUE'}
          <span style={{ display: 'block', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
            {organisme?.nom || 'LES GRIOTS'}, organisme de formation
            {organisme?.nda ? ` · déclaration d’activité n° ${organisme.nda}` : ''}
          </span>
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

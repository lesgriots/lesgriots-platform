'use client';

/**
 * /pipeline-formations — le tunnel de vente, dans la direction artistique
 * de LA GRIOTHÈQUE.
 *
 * Trois lectures d'une même réalité, au choix et mémorisées :
 *   · Tunnel — où dort l'argent, une barre par étape ;
 *   · Kanban — le mouvement, glisser-déposer d'une étape à l'autre ;
 *   · Liste  — ce qu'il reste à faire, affaire par affaire.
 *
 * Règle de couleur : encre et papier partout, l'or réservé à ce qui demande
 * une décision. Pas de palette à six teintes, la couleur désigne, elle ne
 * décore pas.
 *
 * Rien n'est perdu par rapport à l'ancienne vue : création, changement
 * d'étape, affaire perdue, suppression, montant pondéré.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, EmptyState, Skeleton, useViewMode, useConfirm,
  Bouton, Champ, Saisie, Zone, Choix, Grille,
} from '@/components/ui';
import { sessionHref } from '@/lib/navigation';
import { BandeauEncre, BarreSegmentee } from '@/components/da/BandeauDa';

const ETAPES = [
  { cle: 'prospect',           label: 'Prospect',           proba: 0.10 },
  { cle: 'besoin',             label: 'Besoin identifié',   proba: 0.25 },
  { cle: 'devis_envoye',       label: 'Devis envoyé',       proba: 0.50 },
  { cle: 'convention_signee',  label: 'Convention signée',  proba: 0.75 },
  { cle: 'financement_valide', label: 'Financement validé', proba: 0.90 },
  { cle: 'session_planifiee',  label: 'Session planifiée',  proba: 1.00 },
];
const PAR_CLE = Object.fromEntries(ETAPES.map((e) => [e.cle, e]));

/* ── La couleur de chaque étape ───────────────────────────────────────
   La maquette colore la carte par pilier d'activité. Une opportunité de
   formation n'en porte pas : elle est griothèque par définition. On colore
   donc par étape, ce qui dit quelque chose de vrai, plutôt que d'inventer
   une donnée pour justifier une couleur.

   Le clair est le haut du dégradé de segment, la base le bas. */
const COULEUR_ETAPE = {
  prospect:           { base: '#6f6b60', clair: '#87826f', texte: '#ffffff', icone: 'apprenants' },
  besoin:             { base: '#1B6FB8', clair: '#2C86D4', texte: '#ffffff', icone: 'tunnel' },
  devis_envoye:       { base: '#C9821C', clair: '#E09B32', texte: '#ffffff', icone: 'fichier' },
  convention_signee:  { base: '#1E8449', clair: '#2B9E5B', texte: '#ffffff', icone: 'valide' },
  financement_valide: { base: '#1B9FC4', clair: '#31B8DC', texte: '#ffffff', icone: 'immeuble' },
  session_planifiee:  { base: '#E0A400', clair: '#FFC22E', texte: '#171407', icone: 'sessions' },
};

// Une affaire reprise depuis une session conserve sa référence source.
// Elle doit rester navigable : le pipeline n'est pas une impasse après
// laquelle on peut déplacer une session sans plus pouvoir la consulter.
const sessionIdDepuisSource = (opportunite) => (
  opportunite.session_id || (String(opportunite.source || '').startsWith('session:')
    ? String(opportunite.source).slice('session:'.length)
    : null)
);

// L'étape qui demande une décision : la plus avancée avant la signature.
const ETAPE_A_RELANCER = 'devis_envoye';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};

export default function PipelineFormationsPage() {
  const router = useRouter();
  const [opps, setOpps] = useState(null);
  const [formations, setFormations] = useState([]);
  const [reprise, setReprise] = useState(null);
  const [vue, setVue] = useViewMode('pipeline-of', 'colonnes');
  const [tri, setTri] = useState('montant');
  const [recherche, setRecherche] = useState('');
  const [seuil, setSeuil] = useState(0);
  const [survol, setSurvol] = useState(null);
  const [formulaire, setFormulaire] = useState(null);
  const confirmer = useConfirm();

  const charger = useCallback(async () => {
    const [o, f, r] = await Promise.all([
      fetch('/api/formation-opportunities').then((x) => x.json()).catch(() => []),
      fetch('/api/formations').then((x) => x.json()).catch(() => []),
      fetch('/api/griotheque/pipeline/import').then((x) => (x.ok ? x.json() : null)).catch(() => null),
    ]);
    setOpps(Array.isArray(o) ? o : []);
    setFormations(Array.isArray(f) ? f : []);
    setReprise(r);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const majEtape = async (id, etape) => {
    setOpps((p) => p.map((o) => (o.id === id ? { ...o, stage: etape } : o)));
    setSurvol(null);
    await fetch(`/api/formation-opportunities/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: etape }),
    }).catch(charger);
  };

  const ouvrirSession = (opportunite) => {
    const sessionId = sessionIdDepuisSource(opportunite);
    if (sessionId) router.push(sessionHref(sessionId));
  };

  const supprimer = async (o) => {
    if (!(await confirmer({ title: `Archiver « ${o.client_name} » ?`, message: 'L’affaire restera consultable et pourra être restaurée.', confirmLabel: 'Archiver' }))) return;
    setOpps((p) => p.filter((x) => x.id !== o.id));
    await fetch(`/api/formation-opportunities/${o.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: 1 }),
    }).catch(charger);
  };

  const creer = async (valeurs) => {
    await fetch('/api/formation-opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...valeurs, revenue: parseFloat(valeurs.revenue) || 0 }),
    });
    setFormulaire(null);
    charger();
  };

  const reprendre = async () => {
    await fetch('/api/griotheque/pipeline/import', { method: 'POST' });
    charger();
  };

  const actives = useMemo(() => (opps || []).filter((o) => o.stage !== 'perdu'), [opps]);
  const perdues = useMemo(() => (opps || []).filter((o) => o.stage === 'perdu'), [opps]);

  const engage = actives.reduce((t, o) => t + (o.revenue || 0), 0);
  const pondere = actives.reduce((t, o) => t + (o.revenue || 0) * (PAR_CLE[o.stage]?.proba || 0), 0);
  const aRelancer = actives.filter((o) => o.stage === ETAPE_A_RELANCER).length;

  const parEtape = Object.fromEntries(
    ETAPES.map((e) => [e.cle, actives.filter((o) => o.stage === e.cle)]));
  const maxMontant = Math.max(...ETAPES.map((e) =>
    parEtape[e.cle].reduce((t, o) => t + (o.revenue || 0), 0)), 1);

  /* Les filtres agissent sur ce qui est affiché, jamais sur les totaux du
     bandeau ni sur la barre segmentée : un chiffre d'affaires qui change
     parce qu'on tape trois lettres dans une recherche n'est plus un chiffre
     d'affaires. */
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = actives.filter((o) => (
      (!q || `${o.client_name || ''} ${o.company || ''} ${o.formation_title || ''}`.toLowerCase().includes(q))
      && (!seuil || (o.revenue || 0) >= seuil)
    ));
    return liste.sort((x, y) => (tri === 'montant'
      ? (y.revenue || 0) - (x.revenue || 0)
      : String(y.created_at || '').localeCompare(String(x.created_at || ''))));
  }, [actives, recherche, seuil, tri]);

  const visiblesParEtape = useMemo(() => Object.fromEntries(
    ETAPES.map((e) => [e.cle, visibles.filter((o) => o.stage === e.cle)]),
  ), [visibles]);

  /* ── La maquette ne choisit pas entre deux mises en page : elle met la
     bascule dans l'écran. On construit donc les deux. Une valeur héritée
     de l'ancien sélecteur (« timeline », « list ») retombe sur les colonnes
     plutôt que d'afficher une page vide. ─────────────────────────────── */
  const disposition = vue === 'couloirs' ? 'couloirs' : 'colonnes';

  return (
    <>
      <TopBar
        title="Tunnel de vente"
        subtitle={opps ? `${actives.length} affaire(s) en cours` : ''}
      />

      <div style={{ padding: '18px 24px 64px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {!opps && <Skeleton />}

        {opps && (
          <>
            <BandeauEncre
              surTitre="Commercial · pipeline"
              titre="Tunnel de vente"
              phrase="Suivez chaque opportunité du premier contact à la facture payée. Faites glisser une carte pour la faire avancer."
              chiffres={[
                { label: 'Pipeline', valeur: euros(engage), couleur: 'var(--gold)' },
                { label: 'Pondéré', valeur: euros(pondere) },
                { label: 'À relancer', valeur: `${aRelancer} devis`, couleur: aRelancer ? 'var(--warning-clair)' : 'var(--on-ink-2)' },
              ]}
            />

            <BarreSegmentee segments={ETAPES.map((e) => {
              const cartes = parEtape[e.cle];
              const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
              return {
                cle: e.cle, label: e.label, poids: somme,
                detail: `${cartes.length} · ${somme ? euros(somme) : '—'}`,
                point: e.cle === ETAPE_A_RELANCER && cartes.length > 0,
                ...COULEUR_ETAPE[e.cle],
              };
            })} />

            {/* ── Filtres ──
               Trois pastilles, et seulement celles qui filtrent vraiment
               quelque chose. La maquette en montre cinq, dont « Pilier » :
               une opportunité de formation n'en porte pas, l'afficher serait
               un bouton mort. */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setTri(tri === 'montant' ? 'recent' : 'montant')}
                style={pastille(true)}>
                Trier · {tri === 'montant' ? 'montant' : 'récent'}
              </button>
              <input value={recherche} onChange={(ev) => setRecherche(ev.target.value)}
                placeholder="Client"
                style={{ ...pastille(Boolean(recherche)), fontWeight: 400, minWidth: 170 }} />
              <button type="button" onClick={() => setSeuil(seuil ? 0 : 5000)} style={pastille(Boolean(seuil))}>
                Montant {seuil ? `≥ ${euros(seuil)}` : '· tous'}
              </button>
              {(recherche || seuil || tri !== 'montant') && (
                <button type="button" onClick={() => { setRecherche(''); setSeuil(0); setTri('montant'); }}
                  style={{ ...pastille(false), border: 0, color: 'var(--text-3)' }}>réinitialiser</button>
              )}
            </div>

            {/* ── Barre d'action ── */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <Bouton onClick={() => setFormulaire({ client_name: '', company: '', client_email: '', client_phone: '', formation_id: '', revenue: '', financement: '', source: '', notes: '', stage: 'prospect' })}>
                Nouvelle opportunité
              </Bouton>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--text-3)',
                }}>Mise en page</span>
                <div style={{
                  display: 'flex', background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-pill)', padding: 4, gap: 2,
                }}>
                  {[['colonnes', 'A · Colonnes'], ['couloirs', 'B · Couloirs']].map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setVue(id)} style={{
                      border: 0, cursor: 'pointer', fontFamily: 'inherit',
                      borderRadius: 'var(--radius-pill)', padding: '7px 15px',
                      fontSize: 12.5, fontWeight: 800,
                      background: disposition === id ? 'var(--ink)' : 'transparent',
                      color: disposition === id ? 'var(--gold)' : 'var(--text-3)',
                      transition: 'background .2s var(--ease-da), color .2s var(--ease-da)',
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {reprise?.a_creer > 0 && (
              <Card>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {reprise.a_creer} affaire(s) déjà dans tes sessions, absentes du pipeline
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                      {euros(reprise.montant)} au total, avec leur tarif et leur date d’origine.
                    </div>
                  </div>
                  <Bouton discret onClick={reprendre}>Reprendre mes données</Bouton>
                </div>
              </Card>
            )}

            {actives.length === 0 ? (
              <EmptyState
                title="Pipeline vide"
                message="Aucune affaire en cours. Ajoute une opportunité, ou reprends celles qui existent déjà en session."
              />
            ) : disposition === 'colonnes' ? (

              /* ── A · Colonnes ── */
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))',
                gap: 16, alignItems: 'start',
              }}>
                {ETAPES.map((e) => {
                  const cartes = visiblesParEtape[e.cle];
                  const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
                  const cible = survol === e.cle;
                  const c = COULEUR_ETAPE[e.cle];
                  return (
                    <div key={e.cle}
                      onDragOver={(ev) => { ev.preventDefault(); setSurvol(e.cle); }}
                      onDragLeave={() => setSurvol((s) => (s === e.cle ? null : s))}
                      onDrop={(ev) => { ev.preventDefault(); majEtape(ev.dataTransfer.getData('text/plain'), e.cle); }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        flexWrap: 'wrap', marginBottom: 12,
                      }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.base, flex: '0 0 9px' }} />
                        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{e.label}</span>
                        <span style={{
                          background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)',
                          padding: '1px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)',
                        }}>{cartes.length}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)',
                        }}>{somme ? euros(somme) : '—'}</span>
                      </div>

                      {cartes.length === 0 ? (
                        <div style={{
                          border: `1px dashed ${cible ? 'var(--gold)' : 'rgba(0,0,0,.18)'}`,
                          background: cible ? 'var(--gold-tint-soft)' : 'transparent',
                          borderRadius: 13, padding: '26px 16px', textAlign: 'center',
                          fontSize: 12, color: 'var(--text-3)',
                          transition: 'background .2s var(--ease-da), border-color .2s var(--ease-da)',
                        }}>Déposez une carte ici</div>
                      ) : (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 10,
                          borderRadius: 13, outline: cible ? '2px solid var(--gold)' : 'none',
                          outlineOffset: 6,
                        }}>
                          {cartes.map((o) => (
                            <CarteOpportunite
                              key={o.id} o={o} couleur={c.base}
                              relance={e.cle === ETAPE_A_RELANCER}
                              signee={PAR_CLE[e.cle]?.proba >= 0.75}
                              onOuvrirSession={ouvrirSession}
                              onSupprimer={supprimer}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            ) : (

              /* ── B · Couloirs ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ETAPES.map((e) => {
                  const cartes = visiblesParEtape[e.cle];
                  if (!cartes.length) return null;
                  const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
                  const c = COULEUR_ETAPE[e.cle];
                  const suivante = ETAPES[ETAPES.findIndex((x) => x.cle === e.cle) + 1];
                  return (
                    <Card key={e.cle} padding="none">
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        background: 'var(--bg)', borderBottom: '1px solid var(--border-soft)',
                        padding: '16px 22px',
                      }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.base }} />
                        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{e.label}</span>
                        <span style={{
                          background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)',
                          padding: '1px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)',
                        }}>{cartes.length}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: 15, fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}>{somme ? euros(somme) : '—'}</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        {cartes.map((o) => (
                          <div key={o.id} style={{
                            display: 'grid', minWidth: 820, gap: 18, alignItems: 'center',
                            gridTemplateColumns: 'minmax(240px, 2.2fr) 1fr minmax(120px, 1fr) minmax(90px, 1fr) auto',
                            padding: '16px 22px', borderBottom: '1px solid var(--border-row)',
                          }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.client_name}</div>
                            <div>
                              <span style={{
                                background: 'var(--surface-2)', color: 'var(--text-3)',
                                borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 800,
                              }}>{o.formation_code || o.formation_title || '—'}</span>
                            </div>
                            <div style={{
                              fontSize: 12.5,
                              color: e.cle === ETAPE_A_RELANCER ? 'var(--warning)'
                                : PAR_CLE[e.cle]?.proba >= 0.75 ? 'var(--success)' : 'var(--text-3)',
                            }}>
                              {e.cle === ETAPE_A_RELANCER ? 'Relance conseillée'
                                : PAR_CLE[e.cle]?.proba >= 0.75 ? 'Engagement signé' : '—'}
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {o.revenue ? euros(o.revenue) : '—'}
                            </div>
                            {/* L'ancienne vue Liste portait un sélecteur d'étape,
                               seul endroit d'où l'on pouvait marquer une affaire
                               perdue. La maquette ne prévoit qu'un bouton
                               « Faire avancer » : on garde les deux, sinon on
                               supprime une capacité en refaisant la peinture. */}
                            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              {suivante && (
                                <Bouton discret petit onClick={() => majEtape(o.id, suivante.cle)}>Faire avancer</Bouton>
                              )}
                              {sessionIdDepuisSource(o) && (
                                <Bouton discret petit onClick={() => ouvrirSession(o)}>Session ↗</Bouton>
                              )}
                              <Choix
                                compact
                                value={o.stage}
                                onChange={(ev) => majEtape(o.id, ev.target.value)}
                                options={[...ETAPES.map((x) => [x.cle, x.label]), ['perdu', 'Perdue']]}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {perdues.length > 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
                {perdues.length} affaire(s) marquée(s) perdue(s), exclue(s) des montants ci-dessus.
              </p>
            )}
          </>
        )}
      </div>

      {formulaire && (
        <Formulaire
          valeurs={formulaire}
          formations={formations}
          onChange={setFormulaire}
          onValider={creer}
          onFermer={() => setFormulaire(null)}
        />
      )}
    </>
  );
}

/* ── La pastille de filtre, une seule définition ─────────────────────── */
function pastille(actif) {
  return {
    minHeight: 34, padding: '6px 14px', borderRadius: 'var(--radius-pill)',
    border: `1px solid ${actif ? 'var(--ink)' : 'var(--border)'}`,
    background: actif ? 'var(--ink)' : 'var(--surface)',
    color: actif ? 'var(--on-ink)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
  };
}

/* ── La carte du kanban ───────────────────────────────────────────────
   Elle se saisit et se dépose : c'est son premier métier. Les boutons
   internes coupent la propagation, sinon un clic sur « ouvrir » démarre
   un glissement au lieu d'ouvrir. */
function CarteOpportunite({ o, couleur, relance, signee, onOuvrirSession, onSupprimer }) {
  return (
    <article
      draggable
      onDragStart={(ev) => ev.dataTransfer.setData('text/plain', o.id)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: `4px solid ${couleur}`, borderRadius: 13, padding: 16,
        cursor: 'grab', transition: 'box-shadow .2s var(--ease-da), transform .2s var(--ease-da)',
      }}
      onMouseEnter={(ev) => { ev.currentTarget.style.boxShadow = 'var(--shadow-carte)'; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <h3 style={{
          margin: 0, flex: 1, fontSize: 14, fontWeight: 700,
          letterSpacing: '-0.01em', lineHeight: 1.3,
        }}>{o.client_name}</h3>
        {sessionIdDepuisSource(o) && (
          <Bouton fantome petit draggable={false}
            onClick={(ev) => { ev.stopPropagation(); onOuvrirSession(o); }}
            onMouseDown={(ev) => ev.stopPropagation()}
            title="Ouvrir la session" aria-label={`Ouvrir la session de ${o.client_name}`}
            style={{ padding: 2, minHeight: 0 }}>↗</Bouton>
        )}
        <Bouton fantome petit draggable={false}
          onClick={(ev) => { ev.stopPropagation(); onSupprimer(o); }}
          onMouseDown={(ev) => ev.stopPropagation()}
          title="Retirer" aria-label={`Retirer ${o.client_name} du pipeline`}
          style={{ padding: 2, minHeight: 0 }}>×</Bouton>
      </div>

      <div style={{
        marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-3)',
      }}>{o.formation_code || String(o.id).slice(0, 8).toUpperCase()}</div>

      {relance && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--warning)' }}>
          Relance conseillée
        </div>
      )}
      {signee && (
        <div style={{
          marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--success)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          Engagement signé
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {o.formation_title && (
          <span style={{
            background: 'var(--gold-tint)', color: 'var(--gold-text-2)',
            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 800,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
          }}>{o.formation_title}</span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: 12.5, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}>{o.revenue ? euros(o.revenue) : '—'}</span>
      </div>

      <Bouton discret petit pleineLargeur draggable={false}
        href={`/opportunites/${o.id}`}
        onClick={(ev) => ev.stopPropagation()}
        onMouseDown={(ev) => ev.stopPropagation()}
        style={{ marginTop: 12 }}>Ouvrir l’affaire →</Bouton>
    </article>
  );
}

/* ── Nouvelle affaire ─────────────────────────────────────────────────── */
function Formulaire({ valeurs, formations, onChange, onValider, onFermer }) {
  const maj = (k) => (e) => onChange({ ...valeurs, [k]: e.target.value });

  return (
    <div
      onClick={onFermer}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle affaire"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', width: 'min(560px, 100%)',
          maxHeight: '86vh', overflowY: 'auto', padding: 'var(--sp-6)',
        }}
      >
        <h2 className="lg-bloc__titre">Nouvelle affaire</h2>
        <p className="lg-bloc__chapeau" style={{ marginBottom: 18 }}>
          Le nom du client suffit pour commencer, le reste peut attendre.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['client_name', 'Client', 'Nom de la personne ou de la structure'],
            ['company', 'Société', 'Raison sociale'],
            ['client_email', 'E-mail', 'contact@exemple.com'],
            ['client_phone', 'Téléphone', ''],
          ].map(([k, l, ph]) => (
            <Champ key={k} label={l} requis={k === 'client_name'}>
              <Saisie value={valeurs[k]} onChange={maj(k)} placeholder={ph} />
            </Champ>
          ))}

          <Champ label="Formation">
            <Choix
              value={valeurs.formation_id}
              onChange={maj('formation_id')}
              vide="Pas encore décidée"
              options={formations.map((f) => [f.id, f.title])}
            />
          </Champ>

          <Grille min={200} gap={14}>
            <Champ label="Montant HT">
              <Saisie value={valeurs.revenue} onChange={maj('revenue')} placeholder="0" inputMode="decimal" />
            </Champ>
            <Champ label="Étape">
              <Choix value={valeurs.stage} onChange={maj('stage')} options={ETAPES.map((e) => [e.cle, e.label])} />
            </Champ>
            <Champ label="Financement">
              <Saisie value={valeurs.financement} onChange={maj('financement')} placeholder="OPCO, CPF, entreprise…" />
            </Champ>
            <Champ label="Source">
              <Saisie value={valeurs.source} onChange={maj('source')} placeholder="Site, recommandation…" />
            </Champ>
          </Grille>

          <Champ label="Notes">
            <Zone value={valeurs.notes} onChange={maj('notes')} rows={3} />
          </Champ>
        </div>

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 20 }}>
          <Bouton discret onClick={onFermer}>Annuler</Bouton>
          <Bouton disabled={!valeurs.client_name?.trim()} onClick={() => onValider(valeurs)}>
            Créer l’affaire
          </Bouton>
        </div>
      </div>
    </div>
  );
}

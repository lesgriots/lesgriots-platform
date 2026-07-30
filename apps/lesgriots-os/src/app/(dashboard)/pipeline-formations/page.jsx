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
  Card, EmptyState, Skeleton, ViewSwitcher, useViewMode, useConfirm,
  Bouton, Champ, Saisie, Zone, Choix, Grille, Tableau, Sous,
} from '@/components/ui';
import { sessionHref } from '@/lib/navigation';

const ETAPES = [
  { cle: 'prospect',           label: 'Prospect',           proba: 0.10 },
  { cle: 'besoin',             label: 'Besoin identifié',   proba: 0.25 },
  { cle: 'devis_envoye',       label: 'Devis envoyé',       proba: 0.50 },
  { cle: 'convention_signee',  label: 'Convention signée',  proba: 0.75 },
  { cle: 'financement_valide', label: 'Financement validé', proba: 0.90 },
  { cle: 'session_planifiee',  label: 'Session planifiée',  proba: 1.00 },
];
const PAR_CLE = Object.fromEntries(ETAPES.map((e) => [e.cle, e]));

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
  const [vue, setVue] = useViewMode('pipeline-of', 'timeline');
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

  const triees = [...actives].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  return (
    <>
      <TopBar
        title="Pipeline"
        subtitle={opps ? `${actives.length} affaire(s) en cours` : ''}
        right={
          <ViewSwitcher
            value={vue} onChange={setVue}
            options={['timeline', 'kanban', 'list']}
            labels={{ timeline: { glyph: '▤', label: 'Tunnel' }, list: { glyph: '☰', label: 'Liste' } }}
          />
        }
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!opps && <Skeleton />}

        {opps && (
          <>
            {/* ── Les chiffres, en tête, sans carte ni couleur ── */}
            <div style={{
              display: 'flex', gap: 34, flexWrap: 'wrap', alignItems: 'flex-end',
              paddingBottom: 16, borderBottom: '1px solid var(--border)',
            }}>
              {[
                ['Engagé', euros(engage)],
                ['Pondéré', euros(pondere)],
                ['À relancer', String(aRelancer)],
                ['Perdues', String(perdues.length)],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={mono}>{l}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums', marginTop: 2,
                    color: l === 'À relancer' && aRelancer ? 'var(--gold-deep)' : 'inherit',
                  }}>{v}</div>
                </div>
              ))}
              <Bouton
                style={{ marginLeft: 'auto' }}
                onClick={() => setFormulaire({ client_name: '', company: '', client_email: '', client_phone: '', formation_id: '', revenue: '', financement: '', source: '', notes: '', stage: 'prospect' })}
              >
                Nouvelle affaire
              </Bouton>
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
                message="Aucune affaire en cours. Ajoute une affaire, ou reprends celles qui existent déjà en session."
              />
            ) : (
              <>
                {vue === 'timeline' && (
                  <Card>
                    {ETAPES.map((e) => {
                      const cartes = parEtape[e.cle];
                      const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
                      const aLOr = e.cle === 'session_planifiee';
                      return (
                        <div key={e.cle} style={{
                          display: 'grid', gridTemplateColumns: '160px 1fr 92px',
                          gap: 14, alignItems: 'center', padding: '6px 0',
                        }}>
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)', textAlign: 'right' }}>{e.label}</div>
                          <div style={{ height: 26, background: 'var(--surface-2)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 4,
                              width: `${Math.round((somme / maxMontant) * 100)}%`,
                              background: aLOr ? 'var(--gold)' : 'var(--text)',
                              transition: 'width 240ms var(--ease)',
                            }} />
                            <div style={{
                              position: 'absolute', top: 0, left: 9, height: 26, display: 'flex', alignItems: 'center',
                              fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.06em',
                              color: somme && !aLOr ? 'var(--surface)' : 'var(--text-2)',
                            }}>{cartes.length}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                            {somme ? euros(somme) : '—'}
                          </div>
                        </div>
                      );
                    })}
                    <Liste opps={triees} onEtape={majEtape} onSupprimer={supprimer} onOuvrirSession={ouvrirSession} compact />
                  </Card>
                )}

                {vue === 'kanban' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(170px, 1fr))', gap: 8, overflowX: 'auto' }}>
                    {ETAPES.map((e) => {
                      const cartes = parEtape[e.cle];
                      const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
                      const cible = survol === e.cle;
                      return (
                        <div
                          key={e.cle}
                          onDragOver={(ev) => { ev.preventDefault(); setSurvol(e.cle); }}
                          onDragLeave={() => setSurvol((s) => (s === e.cle ? null : s))}
                          onDrop={(ev) => { ev.preventDefault(); majEtape(ev.dataTransfer.getData('text/plain'), e.cle); }}
                          style={{
                            background: cible ? 'var(--gold-soft)' : 'var(--surface-2)',
                            border: `1px solid ${cible ? 'var(--gold)' : 'var(--border)'}`,
                            borderRadius: 10, padding: 9, minHeight: 210,
                            transition: 'background 120ms var(--ease), border-color 120ms var(--ease)',
                          }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 600 }}>{e.label}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-3)', marginTop: 1 }}>
                            {cartes.length} · {somme ? euros(somme) : '—'}
                          </div>
                          <div style={{
                            height: 2, margin: '8px 0 9px', borderRadius: 1,
                            background: e.cle === ETAPE_A_RELANCER && cartes.length ? 'var(--gold)' : 'var(--border-2)',
                          }} />
                          {cartes.length === 0 && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontStyle: 'italic' }}>vide</div>
                          )}
                          {cartes.map((o) => (
                            <div
                              key={o.id}
                              draggable
                              onDragStart={(ev) => ev.dataTransfer.setData('text/plain', o.id)}
                              style={{
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 7, padding: '8px 9px', marginBottom: 6, cursor: 'grab',
                              }}
                            >
                              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.3, flex: 1 }}>{o.client_name}</div>
                                {sessionIdDepuisSource(o) && (
                                  <Bouton
                                    fantome
                                    petit
                                    onClick={(ev) => { ev.stopPropagation(); ouvrirSession(o); }}
                                    onMouseDown={(ev) => ev.stopPropagation()}
                                    draggable={false}
                                    title="Ouvrir la session"
                                    aria-label={`Ouvrir la session de ${o.client_name}`}
                                    style={{ padding: 2, minHeight: 0 }}
                                  >↗</Bouton>
                                )}
                                <Bouton
                                  fantome
                                  petit
                                  onClick={() => supprimer(o)}
                                  title="Retirer"
                                  aria-label={`Retirer ${o.client_name} du pipeline`}
                                  style={{ padding: 2, minHeight: 0 }}
                                >×</Bouton>
                              </div>
                              <Bouton
                                discret
                                petit
                                pleineLargeur
                                href={`/opportunites/${o.id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                onMouseDown={(ev) => ev.stopPropagation()}
                                draggable={false}
                                style={{ marginTop: 6 }}
                              >Ouvrir l’affaire →</Bouton>
                              {o.formation_title && (
                                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3 }}>{o.formation_title}</div>
                              )}
                              {o.revenue > 0 && (
                                <div style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{euros(o.revenue)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {vue === 'list' && (
                  <Card padding="none">
                    <Liste opps={triees} onEtape={majEtape} onSupprimer={supprimer} onOuvrirSession={ouvrirSession} />
                  </Card>
                )}
              </>
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

/* ── La liste, partagée par la vue Tunnel et la vue Liste ─────────────── */
function Liste({ opps, onEtape, onSupprimer, onOuvrirSession, compact = false }) {
  return (
    <Tableau
      style={{ marginTop: compact ? 22 : 0 }}
      lignes={opps}
      colonnes={[
        {
          titre: 'Affaire',
          fort: true,
          rendu: (o) => (
            <>
              <a
                href={`/opportunites/${o.id}`}
                title="Ouvrir l’affaire"
                style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                {o.client_name}
              </a>
              {o.stage === ETAPE_A_RELANCER && <Sous>devis envoyé, en attente de réponse</Sous>}
            </>
          ),
        },
        { titre: 'Formation', attenue: true, rendu: (o) => o.formation_title },
        {
          titre: 'Étape',
          rendu: (o) => (
            <Choix
              compact
              value={o.stage}
              onChange={(e) => onEtape(o.id, e.target.value)}
              options={[...ETAPES.map((e) => [e.cle, e.label]), ['perdu', 'Perdue']]}
            />
          ),
        },
        { titre: 'Montant', nombre: true, rendu: (o) => (o.revenue ? euros(o.revenue) : null) },
        {
          titre: 'Ouvrir',
          nombre: true,
          rendu: (o) => (
            <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
              <Bouton discret petit href={`/opportunites/${o.id}`}>L’affaire →</Bouton>
              {sessionIdDepuisSource(o) && (
                <Bouton discret petit onClick={() => onOuvrirSession(o)} title="Ouvrir la session">Session ↗</Bouton>
              )}
            </span>
          ),
        },
        {
          titre: '',
          largeur: 44,
          rendu: (o) => (
            <Bouton
              fantome
              petit
              onClick={() => onSupprimer(o)}
              title="Retirer du pipeline"
              aria-label={`Retirer ${o.client_name} du pipeline`}
            >×</Bouton>
          ),
        },
      ]}
    />
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

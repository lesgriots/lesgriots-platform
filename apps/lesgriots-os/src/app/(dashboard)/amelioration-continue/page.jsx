'use client';

/**
 * /amelioration-continue — indicateurs 31 et 32 du référentiel national.
 *
 * Trois onglets, un seul raisonnement. Un incident arrive (31 : traitement des
 * aléas et des réclamations). On lui donne une cause. Cette cause rejoint un
 * axe d'amélioration. L'axe produit des actions correctives datées (32).
 *
 *   Axe  ←  Incident  ←  Action
 *
 * L'auditeur ne cherche pas trois listes côte à côte : il cherche le lien de
 * cause à effet. C'est pourquoi chaque ligne d'action affiche son incident
 * d'origine, et chaque axe affiche combien d'incidents et d'actions il porte.
 *
 * Écran repris sur les primitives : cette page déclarait son bouton, son
 * champ, son tableau et son étiquette. Elle n'en déclare plus aucun.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import {
  Bloc, Pile, Page, Bouton, Champ, Saisie, Zone, Choix, Grille,
  Tableau, Sous, Etiquette, EmptyState, Skeleton, useConfirm,
} from '@/components/ui';

/* ── Vocabulaire ──────────────────────────────────────────────────────── */

const NATURES = [
  ['reclamation', 'Réclamation'],
  ['incident', 'Incident'],
  ['suggestion', 'Suggestion'],
];

const ORIGINES = [
  ['apprenant', 'Apprenant'],
  ['client', 'Client'],
  ['formateur', 'Formateur'],
  ['financeur', 'Financeur'],
  ['partenaire', 'Partenaire'],
  ['interne', 'Interne'],
  ['autre', 'Autre'],
];

const GRAVITES = [
  ['mineure', 'Mineure'],
  ['majeure', 'Majeure'],
  ['critique', 'Critique'],
];

const STATUTS_INCIDENT = [
  ['ouverte', 'Ouverte'],
  ['en_cours', 'En cours'],
  ['resolue', 'Résolue'],
  ['classee', 'Classée'],
];

const STATUTS_ACTION = [
  ['a_faire', 'À faire'],
  ['en_cours', 'En cours'],
  ['faite', 'Faite'],
  ['abandonnee', 'Abandonnée'],
];

const TYPES_ACTION = [
  ['corrective', 'Corrective'],
  ['preventive', 'Préventive'],
  ['amelioration', 'Amélioration'],
];

const STATUTS_AXE = [
  ['ouvert', 'Ouvert'],
  ['en_cours', 'En cours'],
  ['atteint', 'Atteint'],
  ['abandonne', 'Abandonné'],
];

/** Les causes courantes en organisme de formation. */
const CAUSES = [
  'Organisation et logistique',
  'Contenu pédagogique',
  'Animation et intervenant',
  'Matériel et salle',
  'Administratif et convocation',
  'Accessibilité et handicap',
  'Financement et facturation',
  'Autre',
];

const libelle = (liste, valeur) => (liste.find(([v]) => v === valeur) || [null, valeur || ''])[1];

/** La gravité et les statuts se lisent en couleur, mais sur la même échelle. */
const TON = {
  ouverte: 'danger', en_cours: 'warning', resolue: 'success', classee: 'neutral',
  a_faire: 'danger', faite: 'success', abandonnee: 'neutral',
  ouvert: 'danger', atteint: 'success', abandonne: 'neutral',
  critique: 'danger', majeure: 'warning', mineure: 'neutral',
};

/* ── Utilitaires d'affichage ──────────────────────────────────────────── */

const jour = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('fr-FR');
};

/** Une échéance dépassée se voit. C'est tout l'intérêt d'en poser une. */
function Echeance({ date, clos }) {
  if (!date) return null;
  const enRetard = !clos && new Date(date) < new Date(new Date().toISOString().slice(0, 10));
  return (
    <span style={{ color: enRetard ? 'var(--danger)' : 'inherit', fontWeight: enRetard ? 700 : 400 }}>
      {jour(date)}
      {enRetard && <Sous>en retard</Sous>}
    </span>
  );
}

const tabsWrap = {
  display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxWidth: '100%', flexWrap: 'wrap',
};

/* ── La page ──────────────────────────────────────────────────────────── */

export default function AmeliorationContinuePage() {
  const [onglet, setOnglet] = useState('incidents');
  const [incidents, setIncidents] = useState(null);
  const [actions, setActions] = useState(null);
  const [axes, setAxes] = useState(null);
  const [erreur, setErreur] = useState('');
  const [formulaire, setFormulaire] = useState(null);
  const confirmer = useConfirm();

  const charger = useCallback(async () => {
    try {
      const [ri, ra, rx] = await Promise.all([
        fetch('/api/reclamations'), fetch('/api/qualite/actions'), fetch('/api/qualite/axes'),
      ]);
      const [di, da, dx] = await Promise.all([ri.json(), ra.json(), rx.json()]);
      setIncidents(Array.isArray(di?.items) ? di.items : []);
      setActions(Array.isArray(da) ? da : []);
      setAxes(Array.isArray(dx) ? dx : []);
    } catch {
      setErreur('Chargement impossible.');
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (url, corps, methode = 'POST') => {
    setErreur('');
    const r = await fetch(url, {
      method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErreur(d.error || 'L’enregistrement a échoué.');
      return false;
    }
    setFormulaire(null);
    await charger();
    return true;
  };

  const supprimer = async (url, titre, message) => {
    const ok = await confirmer({ title: titre, message, confirmLabel: 'Supprimer' });
    if (!ok) return;
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) { setErreur('La suppression a échoué.'); return; }
    await charger();
  };

  const chargement = incidents === null || actions === null || axes === null;

  const compteurs = useMemo(() => ({
    incidents: (incidents || []).filter((i) => ['ouverte', 'en_cours'].includes(i.statut)).length,
    actions: (actions || []).filter((a) => ['a_faire', 'en_cours'].includes(a.statut)).length,
    axes: (axes || []).filter((a) => ['ouvert', 'en_cours'].includes(a.statut)).length,
  }), [incidents, actions, axes]);

  const sousTitre = chargement ? '' : `${compteurs.incidents} incident(s) en cours · `
    + `${compteurs.actions} action(s) à mener · ${compteurs.axes} axe(s) ouvert(s)`;

  const commun = { enregistrer, supprimer, ouvert: null, setOuvert: null };

  return (
    <>
      <TopBar title="Amélioration continue" subtitle={sousTitre} />

      <Page>
        <Pile>
          <Bloc chapeau="Un incident se déclare, on lui trouve une cause, la cause rejoint un axe, l’axe produit des actions datées. C’est ce chemin, et pas la longueur des listes, qui prouve les indicateurs 31 et 32 du référentiel." />

          <div style={tabsWrap} role="tablist">
            {[
              ['incidents', 'Incidents qualité', (incidents || []).length],
              ['actions', 'Actions correctives', (actions || []).length],
              ['axes', 'Axes d’amélioration', (axes || []).length],
            ].map(([id, label, n]) => (
              <Bouton
                key={id}
                role="tab"
                aria-selected={onglet === id}
                discret={onglet !== id}
                fantome={onglet !== id}
                onClick={() => { setOnglet(id); setFormulaire(null); }}
              >
                {label}
                {!chargement && <span style={{ opacity: 0.65, marginLeft: 6 }}>{n}</span>}
              </Bouton>
            ))}
          </div>

          {erreur && <Bloc><p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{erreur}</p></Bloc>}
          {chargement && <Skeleton />}

          {!chargement && onglet === 'incidents' && (
            <OngletIncidents
              {...commun}
              incidents={incidents}
              axes={axes}
              ouvert={formulaire === 'incident'}
              setOuvert={(v) => setFormulaire(v ? 'incident' : null)}
            />
          )}

          {!chargement && onglet === 'actions' && (
            <OngletActions
              {...commun}
              actions={actions}
              incidents={incidents}
              axes={axes}
              ouvert={formulaire === 'action'}
              setOuvert={(v) => setFormulaire(v ? 'action' : null)}
            />
          )}

          {!chargement && onglet === 'axes' && (
            <OngletAxes
              {...commun}
              axes={axes}
              ouvert={formulaire === 'axe'}
              setOuvert={(v) => setFormulaire(v ? 'axe' : null)}
            />
          )}
        </Pile>
      </Page>
    </>
  );
}

/* ── Onglet 1 : les incidents ─────────────────────────────────────────── */

const INCIDENT_VIDE = {
  objet: '', nature: 'reclamation', origine: 'apprenant', gravite: 'mineure',
  cause: '', axe_id: '', auteur_nom: '', description: '', responsable: '',
  recue_le: new Date().toISOString().slice(0, 10),
};

function OngletIncidents({ incidents, axes, ouvert, setOuvert, enregistrer, supprimer }) {
  const [f, setF] = useState(INCIDENT_VIDE);
  const [occupe, setOccupe] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const soumettre = async () => {
    if (!f.objet.trim()) return;
    setOccupe(true);
    const ok = await enregistrer('/api/reclamations', f);
    setOccupe(false);
    if (ok) setF(INCIDENT_VIDE);
  };

  const changerStatut = (id, statut) => enregistrer(`/api/reclamations/${id}`, { statut }, 'PATCH');

  return (
    <>
      {!ouvert && <div><Bouton onClick={() => setOuvert(true)}>＋ Ajouter un incident</Bouton></div>}

      {ouvert && (
        <Bloc titre="Nouvel incident">
          <Pile>
            <Grille>
              <Champ label="Objet" requis>
                <Saisie value={f.objet} onChange={maj('objet')} placeholder="Salle non accessible en fauteuil" />
              </Champ>
              <Champ label="Nature"><Choix options={NATURES} value={f.nature} onChange={maj('nature')} /></Champ>
              <Champ label="Origine"><Choix options={ORIGINES} value={f.origine} onChange={maj('origine')} /></Champ>
              <Champ label="Gravité"><Choix options={GRAVITES} value={f.gravite} onChange={maj('gravite')} /></Champ>
              <Champ label="Cause" aide="La famille de problème, pas le récit.">
                <Choix options={CAUSES} vide="À qualifier" value={f.cause} onChange={maj('cause')} />
              </Champ>
              <Champ label="Axe d’amélioration" aide="Rattacher tout de suite, ou plus tard.">
                <Choix
                  options={axes.map((a) => [a.id, a.nom])}
                  vide="Aucun pour l’instant"
                  value={f.axe_id}
                  onChange={maj('axe_id')}
                />
              </Champ>
              <Champ label="Signalé par"><Saisie value={f.auteur_nom} onChange={maj('auteur_nom')} placeholder="Nom" /></Champ>
              <Champ label="Responsable du traitement">
                <Saisie value={f.responsable} onChange={maj('responsable')} placeholder="Qui s’en occupe" />
              </Champ>
              <Champ label="Reçu le"><Saisie type="date" value={f.recue_le} onChange={maj('recue_le')} /></Champ>
            </Grille>
            <Champ label="Description"><Zone value={f.description} onChange={maj('description')} /></Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <Bouton occupe={occupe} disabled={!f.objet.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </Bouton>
              <Bouton discret onClick={() => setOuvert(false)}>Annuler</Bouton>
            </div>
          </Pile>
        </Bloc>
      )}

      <Bloc padding="none">
        <Tableau
          lignes={incidents}
          vide={(
            <div style={{ padding: 20 }}>
              <EmptyState
                title="Aucun incident consigné"
                description="Un registre vide mais tenu est recevable. Un registre inexistant, non."
              />
            </div>
          )}
          colonnes={[
            { titre: 'Référence', mono: true, attenue: true, rendu: (i) => i.reference },
            {
              titre: 'Objet',
              fort: true,
              minLargeur: 200,
              rendu: (i) => (
                <>
                  {i.objet}
                  <Sous>{i.auteur_nom ? `${i.auteur_nom} · ${libelle(ORIGINES, i.origine)}` : libelle(ORIGINES, i.origine)}</Sous>
                </>
              ),
            },
            {
              titre: 'Cause',
              rendu: (i) => (i.cause
                ? i.cause
                : <span style={{ color: 'var(--danger)', fontSize: 12 }}>à qualifier</span>),
            },
            { titre: 'Gravité', rendu: (i) => <Etiquette tone={TON[i.gravite]}>{libelle(GRAVITES, i.gravite)}</Etiquette> },
            { titre: 'Nature', rendu: (i) => libelle(NATURES, i.nature) },
            { titre: 'Axe d’amélioration', rendu: (i) => axes.find((a) => a.id === i.axe_id)?.nom },
            { titre: 'Reçu le', rendu: (i) => jour(i.recue_le) },
            {
              titre: 'Statut',
              rendu: (i) => (
                <Choix
                  compact
                  options={STATUTS_INCIDENT}
                  value={i.statut || 'ouverte'}
                  onChange={(e) => changerStatut(i.id, e.target.value)}
                />
              ),
            },
            {
              titre: '',
              largeur: 44,
              rendu: (i) => (
                <Bouton
                  fantome
                  petit
                  aria-label="Supprimer cet incident"
                  title="Supprimer cet incident"
                  onClick={() => supprimer(
                    `/api/reclamations/${i.id}`,
                    'Supprimer cet incident ?',
                    'Les actions correctives déjà écrites restent, elles perdent seulement ce rattachement.',
                  )}
                >
                  ×
                </Bouton>
              ),
            },
          ]}
        />
      </Bloc>
    </>
  );
}

/* ── Onglet 2 : les actions correctives ───────────────────────────────── */

const ACTION_VIDE = {
  nom: '', type: 'corrective', incident_id: '', axe_id: '', responsable: '',
  statut: 'a_faire', date_echeance: '', date_realisation: '', preuve: '',
};

function OngletActions({ actions, incidents, axes, ouvert, setOuvert, enregistrer, supprimer }) {
  const [f, setF] = useState(ACTION_VIDE);
  const [occupe, setOccupe] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const soumettre = async () => {
    if (!f.nom.trim()) return;
    setOccupe(true);
    const ok = await enregistrer('/api/qualite/actions', f);
    setOccupe(false);
    if (ok) setF(ACTION_VIDE);
  };

  const changerStatut = (id, statut) => enregistrer('/api/qualite/actions', { id, statut }, 'PATCH');

  return (
    <>
      {!ouvert && <div><Bouton onClick={() => setOuvert(true)}>＋ Ajouter une action corrective</Bouton></div>}

      {ouvert && (
        <Bloc titre="Nouvelle action">
          <Pile>
            <Grille>
              <Champ label="Nom de l’action" requis>
                <Saisie value={f.nom} onChange={maj('nom')} placeholder="Vérifier l’accessibilité de la salle avant chaque session" />
              </Champ>
              <Champ label="Type"><Choix options={TYPES_ACTION} value={f.type} onChange={maj('type')} /></Champ>
              <Champ label="Incident d’origine" aide="Ce qui a déclenché l’action.">
                <Choix
                  options={incidents.map((i) => [i.id, `${i.reference} · ${i.objet}`])}
                  vide="Aucun"
                  value={f.incident_id}
                  onChange={maj('incident_id')}
                />
              </Champ>
              <Champ label="Axe d’amélioration">
                <Choix options={axes.map((a) => [a.id, a.nom])} vide="Aucun" value={f.axe_id} onChange={maj('axe_id')} />
              </Champ>
              <Champ label="Responsable"><Saisie value={f.responsable} onChange={maj('responsable')} /></Champ>
              <Champ label="Statut"><Choix options={STATUTS_ACTION} value={f.statut} onChange={maj('statut')} /></Champ>
              <Champ label="Date d’échéance"><Saisie type="date" value={f.date_echeance} onChange={maj('date_echeance')} /></Champ>
              <Champ label="Date de réalisation" aide="Se remplit seule quand l’action passe à « faite ».">
                <Saisie type="date" value={f.date_realisation} onChange={maj('date_realisation')} />
              </Champ>
            </Grille>
            <Champ label="Preuve" aide="Où se trouve la trace : un document, un e-mail, une capture.">
              <Saisie value={f.preuve} onChange={maj('preuve')} />
            </Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <Bouton occupe={occupe} disabled={!f.nom.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </Bouton>
              <Bouton discret onClick={() => setOuvert(false)}>Annuler</Bouton>
            </div>
          </Pile>
        </Bloc>
      )}

      <Bloc padding="none">
        <Tableau
          lignes={actions}
          vide={(
            <div style={{ padding: 20 }}>
              <EmptyState
                title="Aucune action corrective"
                description="Un incident sans action derrière est un incident qu’on n’a pas traité."
              />
            </div>
          )}
          colonnes={[
            { titre: 'Date de réalisation', rendu: (a) => jour(a.date_realisation) },
            {
              titre: 'Date d’échéance',
              rendu: (a) => <Echeance date={a.date_echeance} clos={['faite', 'abandonnee'].includes(a.statut)} />,
            },
            {
              titre: 'Incident',
              rendu: (a) => (a.incident_objet
                ? <>{a.incident_objet}{a.axe_nom && <Sous>Axe : {a.axe_nom}</Sous>}</>
                : (a.axe_nom ? <>Axe : {a.axe_nom}</> : null)),
            },
            {
              titre: 'Nom de l’action corrective',
              fort: true,
              minLargeur: 220,
              rendu: (a) => <>{a.nom}<Sous>{a.responsable}</Sous></>,
            },
            {
              titre: 'Statut',
              rendu: (a) => (
                <Choix compact options={STATUTS_ACTION} value={a.statut || 'a_faire'} onChange={(e) => changerStatut(a.id, e.target.value)} />
              ),
            },
            { titre: 'Type', rendu: (a) => libelle(TYPES_ACTION, a.type) },
            {
              titre: '',
              largeur: 44,
              rendu: (a) => (
                <Bouton
                  fantome
                  petit
                  aria-label="Supprimer cette action"
                  title="Supprimer cette action"
                  onClick={() => supprimer(
                    `/api/qualite/actions?id=${a.id}`,
                    'Supprimer cette action ?',
                    'L’incident d’origine reste au registre.',
                  )}
                >
                  ×
                </Bouton>
              ),
            },
          ]}
        />
      </Bloc>
    </>
  );
}

/* ── Onglet 3 : les axes d'amélioration ───────────────────────────────── */

const AXE_VIDE = { nom: '', description: '', statut: 'ouvert', date_echeance: '' };

function OngletAxes({ axes, ouvert, setOuvert, enregistrer, supprimer }) {
  const [f, setF] = useState(AXE_VIDE);
  const [occupe, setOccupe] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const soumettre = async () => {
    if (!f.nom.trim()) return;
    setOccupe(true);
    const ok = await enregistrer('/api/qualite/axes', f);
    setOccupe(false);
    if (ok) setF(AXE_VIDE);
  };

  const changerStatut = (id, statut) => enregistrer('/api/qualite/axes', { id, statut }, 'PATCH');

  return (
    <>
      {!ouvert && <div><Bouton onClick={() => setOuvert(true)}>＋ Ajouter un axe d’amélioration</Bouton></div>}

      {ouvert && (
        <Bloc titre="Nouvel axe">
          <Pile>
            <Grille>
              <Champ label="Nom de l’axe" requis>
                <Saisie value={f.nom} onChange={maj('nom')} placeholder="Fiabiliser l’accueil des personnes en situation de handicap" />
              </Champ>
              <Champ label="Statut"><Choix options={STATUTS_AXE} value={f.statut} onChange={maj('statut')} /></Champ>
              <Champ label="Date d’échéance" aide="Un axe sans échéance ne se relit jamais.">
                <Saisie type="date" value={f.date_echeance} onChange={maj('date_echeance')} />
              </Champ>
            </Grille>
            <Champ label="Description"><Zone value={f.description} onChange={maj('description')} /></Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <Bouton occupe={occupe} disabled={!f.nom.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </Bouton>
              <Bouton discret onClick={() => setOuvert(false)}>Annuler</Bouton>
            </div>
          </Pile>
        </Bloc>
      )}

      <Bloc padding="none">
        <Tableau
          lignes={axes}
          vide={(
            <div style={{ padding: 20 }}>
              <EmptyState
                title="Aucun axe d’amélioration"
                description="Un axe regroupe les incidents qui se ressemblent, et porte les actions qui les font disparaître."
              />
            </div>
          )}
          colonnes={[
            {
              titre: 'Date d’échéance',
              rendu: (a) => <Echeance date={a.date_echeance} clos={['atteint', 'abandonne'].includes(a.statut)} />,
            },
            {
              titre: 'Nom de l’axe d’amélioration',
              fort: true,
              minLargeur: 240,
              rendu: (a) => <>{a.nom}<Sous>{a.description}</Sous></>,
            },
            {
              titre: 'Rattachements',
              attenue: true,
              rendu: (a) => `${a.incidents || 0} incident(s) · ${a.actions || 0} action(s)`,
            },
            {
              titre: 'Statut',
              rendu: (a) => (
                <Choix compact options={STATUTS_AXE} value={a.statut || 'ouvert'} onChange={(e) => changerStatut(a.id, e.target.value)} />
              ),
            },
            {
              titre: '',
              largeur: 44,
              rendu: (a) => (
                <Bouton
                  fantome
                  petit
                  aria-label="Supprimer cet axe"
                  title="Supprimer cet axe"
                  onClick={() => supprimer(
                    `/api/qualite/axes?id=${a.id}`,
                    'Supprimer cet axe ?',
                    'Ses incidents et ses actions restent, ils perdent seulement le rattachement.',
                  )}
                >
                  ×
                </Bouton>
              ),
            },
          ]}
        />
      </Bloc>
    </>
  );
}

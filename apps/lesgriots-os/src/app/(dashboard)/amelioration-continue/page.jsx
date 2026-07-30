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
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton, useConfirm } from '@/components/ui';

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

/** Les causes courantes en organisme de formation. Champ libre malgré tout. */
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

const libelle = (liste, valeur) => (liste.find(([v]) => v === valeur) || [null, valeur || '—'])[1];

const TON = {
  ouverte: 'danger', en_cours: 'gold', resolue: 'ok', classee: 'neutre',
  a_faire: 'danger', faite: 'ok', abandonnee: 'neutre',
  ouvert: 'danger', atteint: 'ok', abandonne: 'neutre',
  critique: 'danger', majeure: 'gold', mineure: 'neutre',
};

const COULEURS = {
  danger: { fg: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)' },
  gold: { fg: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 14%, transparent)' },
  ok: { fg: 'var(--success, #35C46B)', bg: 'color-mix(in srgb, var(--success, #35C46B) 14%, transparent)' },
  neutre: { fg: 'var(--text-3)', bg: 'var(--surface-2)' },
};

function Etiquette({ valeur, liste }) {
  const c = COULEURS[TON[valeur] || 'neutre'] || COULEURS.neutre;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11,
      fontWeight: 600, color: c.fg, background: c.bg, whiteSpace: 'nowrap',
    }}
    >
      {libelle(liste, valeur)}
    </span>
  );
}

/* ── Styles partagés ──────────────────────────────────────────────────── */

const entete = {
  textAlign: 'left', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-3)', fontWeight: 500, padding: '13px 12px',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
};
const cellule = { padding: '12px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' };

const champ = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9,
  border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit',
};

const etiquetteChamp = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
  marginBottom: 5, letterSpacing: '0.02em',
};

const bouton = (principal = true) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px',
  borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  background: principal ? 'var(--gold)' : 'var(--surface)',
  color: principal ? 'var(--gold-ink)' : 'var(--text)',
  border: `1.5px solid ${principal ? 'var(--gold)' : 'var(--border-2)'}`,
});

const tabsWrap = {
  display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 12, maxWidth: '100%', flexWrap: 'wrap',
};
const tab = (actif) => ({
  border: `1.5px solid ${actif ? 'var(--gold)' : 'transparent'}`,
  background: actif ? 'var(--gold)' : 'transparent',
  color: actif ? 'var(--gold-ink)' : 'var(--text-2)',
  padding: '9px 15px', borderRadius: 9, fontSize: 12.5, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
});

/** Une croix discrète : on efface une saisie fausse, pas une histoire vraie. */
function Croix({ onClick, titre }) {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      onClick={onClick}
      style={{
        border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)',
        width: 26, height: 26, borderRadius: 7, cursor: 'pointer', fontSize: 14,
        lineHeight: 1, fontFamily: 'inherit', padding: 0,
      }}
    >
      ×
    </button>
  );
}

function Champ({ label, aide, children }) {
  return (
    <div>
      <label style={etiquetteChamp}>{label}</label>
      {children}
      {aide && <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-3)' }}>{aide}</p>}
    </div>
  );
}

const Options = ({ liste, vide }) => (
  <>
    {vide && <option value="">{vide}</option>}
    {liste.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </>
);

const grille = (min = 220) => ({
  display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14,
});

/** Une date au format court, ou un tiret. Jamais « Invalid Date ». */
const jour = (d) => {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('fr-FR');
};

/** Une échéance dépassée se voit. C'est tout l'intérêt d'en poser une. */
function Echeance({ date, clos }) {
  if (!date) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const enRetard = !clos && new Date(date) < new Date(new Date().toISOString().slice(0, 10));
  return (
    <span style={{ color: enRetard ? 'var(--danger)' : 'inherit', fontWeight: enRetard ? 700 : 400 }}>
      {jour(date)}
      {enRetard && <span style={{ fontSize: 11, marginLeft: 6 }}>en retard</span>}
    </span>
  );
}

/* ── La page ──────────────────────────────────────────────────────────── */

export default function AmeliorationContinuePage() {
  const [onglet, setOnglet] = useState('incidents');
  const [incidents, setIncidents] = useState(null);
  const [actions, setActions] = useState(null);
  const [axes, setAxes] = useState(null);
  const [erreur, setErreur] = useState('');
  const [formulaire, setFormulaire] = useState(null); // 'incident' | 'action' | 'axe'

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
      setErreur(d.error || "L’enregistrement a échoué.");
      return false;
    }
    setFormulaire(null);
    await charger();
    return true;
  };

  const confirmer = useConfirm();

  /** Suppression d'une ligne, après confirmation. Les liens survivent. */
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

  return (
    <>
      <TopBar title="Amélioration continue" subtitle={sousTitre} />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Ce que l'auditeur vient chercher, dit en une phrase. */}
        <Card>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Un incident se déclare, on lui trouve une cause, la cause rejoint un axe,
            l’axe produit des actions datées. C’est ce chemin, et pas la longueur des
            listes, qui prouve les indicateurs 31 et 32 du référentiel.
          </p>
        </Card>

        <div style={tabsWrap}>
          {[
            ['incidents', 'Incidents qualité', (incidents || []).length],
            ['actions', 'Actions correctives', (actions || []).length],
            ['axes', 'Axes d’amélioration', (axes || []).length],
          ].map(([id, label, n]) => (
            <button key={id} type="button" style={tab(onglet === id)} onClick={() => { setOnglet(id); setFormulaire(null); }}>
              {label}
              {!chargement && <span style={{ opacity: 0.65, marginLeft: 6 }}>{n}</span>}
            </button>
          ))}
        </div>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{erreur}</p></Card>}
        {chargement && <Skeleton />}

        {!chargement && onglet === 'incidents' && (
          <OngletIncidents
            incidents={incidents}
            axes={axes}
            ouvert={formulaire === 'incident'}
            setOuvert={(v) => setFormulaire(v ? 'incident' : null)}
            enregistrer={enregistrer}
            supprimer={supprimer}
          />
        )}

        {!chargement && onglet === 'actions' && (
          <OngletActions
            actions={actions}
            incidents={incidents}
            axes={axes}
            ouvert={formulaire === 'action'}
            setOuvert={(v) => setFormulaire(v ? 'action' : null)}
            enregistrer={enregistrer}
            supprimer={supprimer}
          />
        )}

        {!chargement && onglet === 'axes' && (
          <OngletAxes
            axes={axes}
            ouvert={formulaire === 'axe'}
            setOuvert={(v) => setFormulaire(v ? 'axe' : null)}
            enregistrer={enregistrer}
            supprimer={supprimer}
          />
        )}
      </div>
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
      {!ouvert && (
        <div>
          <button type="button" style={bouton()} onClick={() => setOuvert(true)}>+ Ajouter un incident</button>
        </div>
      )}

      {ouvert && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Nouvel incident</div>
            <div style={grille()}>
              <Champ label="Objet">
                <input style={champ} value={f.objet} onChange={maj('objet')} placeholder="Salle non accessible en fauteuil" />
              </Champ>
              <Champ label="Nature">
                <select style={champ} value={f.nature} onChange={maj('nature')}><Options liste={NATURES} /></select>
              </Champ>
              <Champ label="Origine">
                <select style={champ} value={f.origine} onChange={maj('origine')}><Options liste={ORIGINES} /></select>
              </Champ>
              <Champ label="Gravité">
                <select style={champ} value={f.gravite} onChange={maj('gravite')}><Options liste={GRAVITES} /></select>
              </Champ>
              <Champ label="Cause" aide="La famille de problème, pas le récit.">
                <select style={champ} value={f.cause} onChange={maj('cause')}>
                  <option value="">À qualifier</option>
                  {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Champ>
              <Champ label="Axe d’amélioration" aide="Rattacher tout de suite, ou plus tard.">
                <select style={champ} value={f.axe_id} onChange={maj('axe_id')}>
                  <option value="">Aucun pour l’instant</option>
                  {axes.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Signalé par">
                <input style={champ} value={f.auteur_nom} onChange={maj('auteur_nom')} placeholder="Nom" />
              </Champ>
              <Champ label="Responsable du traitement">
                <input style={champ} value={f.responsable} onChange={maj('responsable')} placeholder="Qui s’en occupe" />
              </Champ>
              <Champ label="Reçu le">
                <input type="date" style={champ} value={f.recue_le} onChange={maj('recue_le')} />
              </Champ>
            </div>
            <Champ label="Description">
              <textarea style={{ ...champ, minHeight: 80, resize: 'vertical' }} value={f.description} onChange={maj('description')} />
            </Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={bouton()} disabled={occupe || !f.objet.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" style={bouton(false)} onClick={() => setOuvert(false)}>Annuler</button>
            </div>
          </div>
        </Card>
      )}

      <Card padding="none">
        {!incidents.length ? (
          <EmptyState
            title="Aucun incident consigné"
            description="Un registre vide mais tenu est recevable. Un registre inexistant, non."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={entete}>Référence</th>
                  <th style={entete}>Objet</th>
                  <th style={entete}>Cause</th>
                  <th style={entete}>Gravité</th>
                  <th style={entete}>Nature</th>
                  <th style={entete}>Axe d’amélioration</th>
                  <th style={entete}>Reçu le</th>
                  <th style={entete}>Statut</th>
                  <th style={entete} />
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td style={{ ...cellule, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-3)' }}>{i.reference}</td>
                    <td style={{ ...cellule, fontWeight: 600, minWidth: 200 }}>
                      {i.objet}
                      {i.auteur_nom && <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{i.auteur_nom} · {libelle(ORIGINES, i.origine)}</div>}
                    </td>
                    <td style={cellule}>{i.cause || <span style={{ color: 'var(--danger)', fontSize: 12 }}>à qualifier</span>}</td>
                    <td style={cellule}><Etiquette valeur={i.gravite} liste={GRAVITES} /></td>
                    <td style={cellule}>{libelle(NATURES, i.nature)}</td>
                    <td style={cellule}>{axes.find((a) => a.id === i.axe_id)?.nom || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                    <td style={cellule}>{jour(i.recue_le)}</td>
                    <td style={cellule}>
                      <select
                        style={{ ...champ, width: 'auto', padding: '6px 9px', fontSize: 12 }}
                        value={i.statut || 'ouverte'}
                        onChange={(e) => changerStatut(i.id, e.target.value)}
                      >
                        <Options liste={STATUTS_INCIDENT} />
                      </select>
                    </td>
                    <td style={cellule}>
                      <Croix
                        titre="Supprimer cet incident"
                        onClick={() => supprimer(`/api/reclamations/${i.id}`, 'Supprimer cet incident ?',
                          'Les actions correctives déjà écrites restent, elles perdent seulement ce rattachement.')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
      {!ouvert && (
        <div>
          <button type="button" style={bouton()} onClick={() => setOuvert(true)}>+ Ajouter une action corrective</button>
        </div>
      )}

      {ouvert && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Nouvelle action</div>
            <div style={grille()}>
              <Champ label="Nom de l’action">
                <input style={champ} value={f.nom} onChange={maj('nom')} placeholder="Vérifier l’accessibilité de la salle avant chaque session" />
              </Champ>
              <Champ label="Type">
                <select style={champ} value={f.type} onChange={maj('type')}><Options liste={TYPES_ACTION} /></select>
              </Champ>
              <Champ label="Incident d’origine" aide="Ce qui a déclenché l’action.">
                <select style={champ} value={f.incident_id} onChange={maj('incident_id')}>
                  <option value="">Aucun</option>
                  {incidents.map((i) => <option key={i.id} value={i.id}>{i.reference} · {i.objet}</option>)}
                </select>
              </Champ>
              <Champ label="Axe d’amélioration">
                <select style={champ} value={f.axe_id} onChange={maj('axe_id')}>
                  <option value="">Aucun</option>
                  {axes.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Responsable">
                <input style={champ} value={f.responsable} onChange={maj('responsable')} />
              </Champ>
              <Champ label="Statut">
                <select style={champ} value={f.statut} onChange={maj('statut')}><Options liste={STATUTS_ACTION} /></select>
              </Champ>
              <Champ label="Date d’échéance">
                <input type="date" style={champ} value={f.date_echeance} onChange={maj('date_echeance')} />
              </Champ>
              <Champ label="Date de réalisation" aide="Se remplit seule quand l’action passe à « faite ».">
                <input type="date" style={champ} value={f.date_realisation} onChange={maj('date_realisation')} />
              </Champ>
            </div>
            <Champ label="Preuve" aide="Où se trouve la trace : un document, un e-mail, une capture.">
              <input style={champ} value={f.preuve} onChange={maj('preuve')} />
            </Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={bouton()} disabled={occupe || !f.nom.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" style={bouton(false)} onClick={() => setOuvert(false)}>Annuler</button>
            </div>
          </div>
        </Card>
      )}

      <Card padding="none">
        {!actions.length ? (
          <EmptyState
            title="Aucune action corrective"
            description="Un incident sans action derrière est un incident qu’on n’a pas traité."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={entete}>Date de réalisation</th>
                  <th style={entete}>Date d’échéance</th>
                  <th style={entete}>Incident</th>
                  <th style={entete}>Nom de l’action corrective</th>
                  <th style={entete}>Statut</th>
                  <th style={entete}>Type</th>
                  <th style={entete} />
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td style={cellule}>{jour(a.date_realisation)}</td>
                    <td style={cellule}>
                      <Echeance date={a.date_echeance} clos={['faite', 'abandonnee'].includes(a.statut)} />
                    </td>
                    <td style={cellule}>
                      {a.incident_objet || <span style={{ color: 'var(--text-3)' }}>—</span>}
                      {a.axe_nom && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Axe : {a.axe_nom}</div>}
                    </td>
                    <td style={{ ...cellule, fontWeight: 600, minWidth: 220 }}>
                      {a.nom}
                      {a.responsable && <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{a.responsable}</div>}
                    </td>
                    <td style={cellule}>
                      <select
                        style={{ ...champ, width: 'auto', padding: '6px 9px', fontSize: 12 }}
                        value={a.statut || 'a_faire'}
                        onChange={(e) => changerStatut(a.id, e.target.value)}
                      >
                        <Options liste={STATUTS_ACTION} />
                      </select>
                    </td>
                    <td style={cellule}>{libelle(TYPES_ACTION, a.type)}</td>
                    <td style={cellule}>
                      <Croix
                        titre="Supprimer cette action"
                        onClick={() => supprimer(`/api/qualite/actions?id=${a.id}`, 'Supprimer cette action ?',
                          'L’incident d’origine reste au registre.')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
      {!ouvert && (
        <div>
          <button type="button" style={bouton()} onClick={() => setOuvert(true)}>+ Ajouter un axe d’amélioration</button>
        </div>
      )}

      {ouvert && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Nouvel axe</div>
            <div style={grille()}>
              <Champ label="Nom de l’axe">
                <input style={champ} value={f.nom} onChange={maj('nom')} placeholder="Fiabiliser l’accueil des personnes en situation de handicap" />
              </Champ>
              <Champ label="Statut">
                <select style={champ} value={f.statut} onChange={maj('statut')}><Options liste={STATUTS_AXE} /></select>
              </Champ>
              <Champ label="Date d’échéance" aide="Un axe sans échéance ne se relit jamais.">
                <input type="date" style={champ} value={f.date_echeance} onChange={maj('date_echeance')} />
              </Champ>
            </div>
            <Champ label="Description">
              <textarea style={{ ...champ, minHeight: 80, resize: 'vertical' }} value={f.description} onChange={maj('description')} />
            </Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={bouton()} disabled={occupe || !f.nom.trim()} onClick={soumettre}>
                {occupe ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" style={bouton(false)} onClick={() => setOuvert(false)}>Annuler</button>
            </div>
          </div>
        </Card>
      )}

      <Card padding="none">
        {!axes.length ? (
          <EmptyState
            title="Aucun axe d’amélioration"
            description="Un axe regroupe les incidents qui se ressemblent, et porte les actions qui les font disparaître."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={entete}>Date d’échéance</th>
                  <th style={entete}>Nom de l’axe d’amélioration</th>
                  <th style={entete}>Rattachements</th>
                  <th style={entete}>Statut</th>
                  <th style={entete} />
                </tr>
              </thead>
              <tbody>
                {axes.map((a) => (
                  <tr key={a.id}>
                    <td style={cellule}>
                      <Echeance date={a.date_echeance} clos={['atteint', 'abandonne'].includes(a.statut)} />
                    </td>
                    <td style={{ ...cellule, fontWeight: 600, minWidth: 240 }}>
                      {a.nom}
                      {a.description && <div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{a.description}</div>}
                    </td>
                    <td style={{ ...cellule, fontSize: 12, color: 'var(--text-2)' }}>
                      {a.incidents || 0} incident(s) · {a.actions || 0} action(s)
                    </td>
                    <td style={cellule}>
                      <select
                        style={{ ...champ, width: 'auto', padding: '6px 9px', fontSize: 12 }}
                        value={a.statut || 'ouvert'}
                        onChange={(e) => changerStatut(a.id, e.target.value)}
                      >
                        <Options liste={STATUTS_AXE} />
                      </select>
                    </td>
                    <td style={cellule}>
                      <Croix
                        titre="Supprimer cet axe"
                        onClick={() => supprimer(`/api/qualite/axes?id=${a.id}`, 'Supprimer cet axe ?',
                          'Ses incidents et ses actions restent, ils perdent seulement le rattachement.')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

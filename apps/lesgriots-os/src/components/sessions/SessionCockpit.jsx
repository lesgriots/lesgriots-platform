'use client';

import Link from 'next/link';
import ClientsSession from './ClientsSession';
import EspaceApprenantConfig from './EspaceApprenantConfig';
import EnvoisAutomatiques from './EnvoisAutomatiques';
import ApercuDocument from '@/components/ui/ApercuDocument';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Interrupteur } from '@/components/ui';
import { BandeauEncre, BarreOnglets, SousOnglets } from '@/components/da/BandeauDa';

const STEPS = [
  { id: 'avancement', label: 'Avancement', mark: '↗' },
  { id: 'configuration', label: 'Configuration', mark: '⌘' },
  { id: 'gestion', label: 'Gestion', mark: '▣' },
  { id: 'apprenant', label: 'Espace apprenant', mark: '◉' },
  { id: 'suivi', label: 'Suivi', mark: '✓' },
];

/* Les cinq étapes du parcours, aux couleurs du dossier de passation.
   L'ordre est fixe : il sert à la fois la barre segmentée, la teinte du
   bandeau de sous-onglets et, plus tard, les cartes d'étape. Une seule
   source, sinon l'ordre des couleurs finit par diverger d'un endroit à
   l'autre de la même page. */
const COULEUR_ETAPE = {
  avancement:    { base: '#4B2FBF', clair: '#6242D8' },
  configuration: { base: '#6B4FD8', clair: '#8368EE' },
  gestion:       { base: '#1E8449', clair: '#2B9E5B' },
  apprenant:     { base: '#1B9FC4', clair: '#31B8DC' },
  suivi:         { base: '#E0A400', clair: '#FFC22E', texte: '#171407' },
};

const SUBNAV = {
  configuration: [
    ['initialisation', 'Initialisation'], ['programme', 'Programme'], ['intervenants', 'Intervenants'], ['dates', 'Dates et prix'], ['clients', 'Clients et prix'], ['apprenants', 'Apprenants'], ['positionnement', 'Positionnement'],
  ],
  gestion: [
    ['conventions', 'Conventions'], ['convocations', 'Convocations'], ['evaluations', 'Évaluations'], ['automatisations', 'Envois automatiques'], ['finances', 'Finances'], ['entreprise', 'Espace entreprise'],
  ],
  apprenant: [
    ['acces', 'Accès'], ['affichage', 'Configuration'], ['documents', 'Documents'], ['elearning', 'E-learning'],
  ],
  suivi: [
    ['emargements', 'Émargements'], ['absences', 'Absences'], ['emails', 'E-mails'], ['attestations', 'Suivi apprenants'], ['elearning', 'Suivi e-learning'], ['qualite', 'Suivi qualité'],
  ],
};

const MODELES_EMAIL = [
  ['convocation', 'Convocation'],
  ['rappel_j7', 'Rappel J-7'],
  ['enquete_chaud', 'Enquête à chaud'],
  ['enquete_froid', 'Enquête à froid'],
  ['envoi_attestation', 'Envoi attestation'],
  ['convention', 'Convention de formation'],
  ['devis', 'Devis'],
  ['document_session', 'Document de session'],
];
const LIBELLE_MODELE = Object.fromEntries(MODELES_EMAIL);
/** Les modèles qui partent avec le programme de formation en pièce jointe. */
const MODELES_AVEC_PROGRAMME = ['convocation', 'rappel_j7'];

const EVALUATION_TYPES = [
  { id: 'positionnement', questionnaireType: 'positionnement', title: 'Évaluation préformation pour les apprenants', description: 'Sondez les attentes et diagnostiquez le besoin avant la session.', model: 'Modèle d’évaluation de préformation' },
  { id: 'satisfaction', questionnaireType: 'chaud', title: 'Évaluation à chaud pour les apprenants', description: 'Envoyez une évaluation dématérialisée à l’apprenant pour qu’il note la formation.', model: 'Modèle d’évaluation de satisfaction à chaud', automated: true },
  { id: 'froid', questionnaireType: 'froid', title: 'Évaluation à froid pour les apprenants', description: 'Mesurez l’impact professionnel de la formation après sa réalisation.', model: 'Modèle d’évaluation à froid', automated: true },
];

/* Ces deux styles ne servent plus au parcours de la session, qui passe
   désormais par la barre segmentée. Ils restent pour la fenêtre d'envoi,
   où le choix du modèle d'e-mail est bien une série d'onglets ordinaires. */
const tabsWrap = {
  display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 12, maxWidth: '100%',
};
const tab = (active) => ({
  border: `1.5px solid ${active ? 'var(--gold)' : 'transparent'}`,
  background: active ? 'var(--gold)' : 'transparent',
  color: active ? 'var(--gold-ink)' : 'var(--text-2)',
  padding: '9px 15px', borderRadius: 9, fontSize: 12.5, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,.22)' : 'none',
});
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18 };
const muted = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const title = { margin: 0, color: 'var(--text)', fontSize: 17, letterSpacing: '-.02em' };
const selectStyle = { minWidth: 190, padding: '9px 30px 9px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' };

function Metric({ label, value, note }) {
  return <div style={{ ...card, padding: '14px 16px' }}><div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700 }}>{label}</div><div style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 800, margin: '7px 0 2px' }}>{value}</div>{note && <div style={muted}>{note}</div>}</div>;
}

function Empty({ children }) {
  return <div style={{ ...card, ...muted, textAlign: 'center', padding: '32px 16px', borderStyle: 'dashed' }}>{children}</div>;
}

/** Le point vert de « déjà envoyé », posé sur le coin du bouton. */
function Pastille() {
  return <span aria-label="déjà envoyé" title="Déjà envoyé" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flex: 'none' }} />;
}
/* ── Le registre de pièces : voir la pièce, pas seulement le bouton ─────
 *
 * Un onglet de gestion doit répondre à trois questions d'un coup d'œil :
 * la pièce existe-t-elle, de quand date-t-elle, et est-elle partie. Une
 * rangée de boutons d'action ne répond à aucune des trois : elle dit ce
 * qu'on peut faire, jamais où on en est. On affiche donc la pièce
 * elle-même, datée, et les gestes se replient en icônes autour.
 */

const ICONES = {
  oeil: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  telecharger: 'M8 2v8 M4.5 7 8 10.5 11.5 7 M2.5 13.5h11',
  enveloppe: 'M1.8 4.2h12.4v7.6H1.8z M1.8 4.6 8 9l6.2-4.4',
  rafraichir: 'M13.2 8a5.2 5.2 0 1 1-1.6-3.8 M13.6 2.4v3.2h-3.2',
  corbeille: 'M2.8 4.4h10.4 M6.4 4.4V2.9h3.2v1.5 M4.2 4.4l.7 9a.7.7 0 0 0 .7.7h4.8a.7.7 0 0 0 .7-.7l.7-9 M6.7 7v4.6 M9.3 7v4.6',
};

/** Un geste réduit à son icône, avec son nom en infobulle. */
function Geste({ nom, icone, onClick, href, disabled = false, actif = false }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, padding: 0, borderRadius: 8,
    border: '1px solid var(--border)',
    background: actif ? 'var(--gold)' : 'var(--surface)',
    color: actif ? 'var(--gold-ink)' : 'var(--text-2)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    flex: 'none',
  };
  const dessin = (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONES[icone]} />
    </svg>
  );
  if (href) {
    return <a href={href} download title={nom} aria-label={nom} style={{ ...style, textDecoration: 'none' }}>{dessin}</a>;
  }
  return <button type="button" title={nom} aria-label={nom} onClick={onClick} disabled={disabled} style={style}>{dessin}</button>;
}

/**
 * La pièce produite, avec sa date. Cliquable : elle ouvre l'aperçu.
 * Quand elle n'existe pas encore, on le dit plutôt que de laisser un vide.
 */
function Piece({ libelle, document: doc, onVoir, verbe = 'Généré', absent = 'Pas encore générée' }) {
  if (!doc) {
    return <span style={{ ...muted, fontStyle: 'italic' }}>{absent}</span>;
  }
  return <button type="button" onClick={onVoir} style={{
    display: 'inline-flex', alignItems: 'center', gap: 9, textAlign: 'left',
    padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', font: 'inherit', cursor: 'pointer',
  }}>
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: 'var(--text-3)' }} aria-hidden="true">
      <path d="M9.2 1.6H4a1.4 1.4 0 0 0-1.4 1.4v10a1.4 1.4 0 0 0 1.4 1.4h8a1.4 1.4 0 0 0 1.4-1.4V5.8Z M9.2 1.6v4.2h4.2" />
    </svg>
    <span>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 800 }}>{libelle}{doc.version > 1 ? ` · v${doc.version}` : ''}</span>
      <span style={{ display: 'block', ...muted, fontSize: 11 }}>{verbe} le {dateTimeFr(doc.created_at)}</span>
    </span>
  </button>;
}

/** Où en est une pièce, dit en toutes lettres plutôt qu'en interrupteur. */
function Etat({ actif, oui, non, date }) {
  const couleur = actif ? 'var(--success)' : 'var(--text-3)';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, color: couleur }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: couleur, flex: 'none' }} />
    <span>
      {actif ? oui : non}
      {actif && date && <span style={{ ...muted, fontWeight: 500, marginLeft: 6 }}>le {dateTimeFr(date)}</span>}
    </span>
  </span>;
}

/** L'en-tête d'une carte client : qui signe, et pour quels apprenants. */
function EnteteClient({ nom, inscriptions }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', flex: 'none' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 14V3.2a.7.7 0 0 1 .7-.7h6.1a.7.7 0 0 1 .7.7V14 M9.9 6.4h3a.7.7 0 0 1 .7.7V14 M1 14h14 M5 5.2h2.3 M5 8h2.3 M5 10.8h2.3" />
      </svg>
    </span>
    <div>
      <b style={{ fontSize: 13 }}>{nom || 'Client à associer'}</b>
      <div style={muted}>{inscriptions.length} apprenant{inscriptions.length > 1 ? 's' : ''} : {inscriptions.map((item) => `${item.first_name} ${item.last_name}`).join(', ')}</div>
    </div>
  </div>;
}

function Action({ children, onClick, href, secondary = false, disabled = false, small = false }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: small ? '8px 12px' : '11px 16px', borderRadius: 10,
    fontSize: small ? 12 : 13, fontWeight: 800, fontFamily: 'inherit',
    whiteSpace: 'nowrap', textDecoration: 'none', lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .42 : 1,
    background: secondary ? 'var(--surface)' : 'var(--gold)',
    color: secondary ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondary ? 'var(--border-2)' : 'var(--gold)'}`,
    boxShadow: secondary ? 'none' : '0 2px 10px rgba(255, 202, 0, .22)',
  };
  if (href) return <a href={href} target={href.startsWith('/') ? '_blank' : undefined} rel="noreferrer" style={style}>{children}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function Info({ label, value }) {
  return <div><div style={{ ...muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{label}</div><div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, marginTop: 3 }}>{value || 'À renseigner'}</div></div>;
}

function dateFr(value) {
  if (!value) return 'À planifier';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function dateTimeFr(value) {
  if (!value) return 'Jamais généré';
  const date = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: disabled ? 'var(--text-3)' : 'var(--text)', fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    <Interrupteur actif={checked} sur={onChange} label={label} disabled={disabled} />
    {label && <span>{label}</span>}
  </label>;
}

/**
 * Fiche opérationnelle d'une session. Elle reprend la logique Digiforma en
 * cinq piliers, mais s'appuie uniquement sur les APIs et documents de l'OS.
 */
export default function SessionCockpit({ sessionId }) {
  const [session, setSession] = useState(null);
  const [modules, setModules] = useState([]);
  const [emargements, setEmargements] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [links, setLinks] = useState([]);
  const [registrationLink, setRegistrationLink] = useState(null);
  const [documents, setDocuments] = useState([]);
  // Le document en cours de consultation, affiché dans l'app.
  const [apercu, setApercu] = useState(null);
  const [emailHistory, setEmailHistory] = useState([]);
  const [emailMode, setEmailMode] = useState('simulation');
  const [ongletEmail, setOngletEmail] = useState('envoyes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('avancement');
  const [sub, setSub] = useState({ configuration: 'initialisation', gestion: 'conventions', apprenant: 'acces', suivi: 'emargements' });
  const [envoi, setEnvoi] = useState(null);
  const [essaiAuto, setEssaiAuto] = useState(null);
  const [notice, setNotice] = useState('');
  const [convocationConfig, setConvocationConfig] = useState({ enabled: false, leadDays: 4, documentTemplate: 'Modèle par défaut', emailTemplate: 'Modèle par défaut' });
  const [datesConfig, setDatesConfig] = useState({ startDate: '', endDate: '', location: '', horaire: '', modality: 'Présentiel', tarif: '', maxParticipants: '' });
  const [generalConfig, setGeneralConfig] = useState({ codeInterne: '', typeSession: '', status: '', manager: '', manager2: '', formateurName: '', timeZone: 'Europe/Paris', notes: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [s, m, e, ev, l, docs, emails, registration] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Session introuvable'))),
        fetch(`/api/session-modules?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/emargements?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/evaluations?session_id=${encodeURIComponent(sessionId)}`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/sessions/${sessionId}/links`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/documents?contexte_type=session&contexte_id=${encodeURIComponent(sessionId)}`).then((r) => r.ok ? r.json() : { items: [] }),
        fetch(`/api/emails?contexte_type=session&contexte_id=${encodeURIComponent(sessionId)}`).then((r) => r.ok ? r.json() : { items: [], mode: 'simulation' }),
        fetch(`/api/sessions/${sessionId}/registration-link`).then((r) => r.ok ? r.json() : null),
      ]);
      setSession(s); setModules(Array.isArray(m) ? m : []); setEmargements(Array.isArray(e) ? e : []); setEvaluations(Array.isArray(ev) ? ev : []); setLinks(Array.isArray(l) ? l : []);
      setDocuments(Array.isArray(docs?.items) ? docs.items : []);
      setEmailHistory(Array.isArray(emails?.items) ? emails.items : []);
      setEmailMode(emails?.mode || 'simulation');
      setRegistrationLink(registration || null);
    } catch (err) { setError(err.message || 'Impossible de charger la session.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sessionId]);
  useEffect(() => {
    if (!session) return;
    setConvocationConfig({
      enabled: Boolean(session.convocation_auto_enabled),
      leadDays: Number(session.convocation_lead_days ?? 4),
      documentTemplate: session.convocation_document_template || 'Modèle par défaut',
      emailTemplate: session.convocation_email_template || 'Modèle par défaut',
    });
  }, [session?.id, session?.convocation_auto_enabled, session?.convocation_lead_days, session?.convocation_document_template, session?.convocation_email_template]);
  useEffect(() => {
    if (!session) return;
    setDatesConfig({
      startDate: String(session.start_date || '').slice(0, 10),
      endDate: String(session.end_date || '').slice(0, 10),
      location: session.location || session.adresse || '',
      horaire: session.horaire || '',
      modality: session.modality || 'Présentiel',
      tarif: session.tarif ?? '',
      maxParticipants: session.max_participants ?? '',
    });
  }, [session?.id, session?.start_date, session?.end_date, session?.location, session?.adresse, session?.horaire, session?.modality, session?.tarif, session?.max_participants]);
  useEffect(() => {
    if (!session) return;
    setGeneralConfig({
      codeInterne: session.code_interne || '', typeSession: session.type_session || '', status: session.status || '',
      manager: session.gestionnaire_1 || '', manager2: session.gestionnaire_2 || '', formateurName: session.formateur_name || '',
      timeZone: session.fuseau_horaire || 'Europe/Paris', notes: session.notes || '',
    });
  }, [session?.id, session?.code_interne, session?.type_session, session?.status, session?.gestionnaire_1, session?.gestionnaire_2, session?.formateur_name, session?.fuseau_horaire, session?.notes]);

  const inscriptions = session?.inscriptions || [];
  const stats = useMemo(() => {
    const totalAttendance = emargements.length * 2;
    const signedAttendance = emargements.reduce((sum, item) => sum + Number(item.matin || 0) + Number(item.apres_midi || 0), 0);
    const evaluated = new Set(evaluations.map((item) => item.apprenant_id)).size;
    return { totalAttendance, signedAttendance, evaluated };
  }, [emargements, evaluations]);

  const openDocument = async (type, apprenantId, { montrer = true } = {}) => {
    const query = apprenantId ? `&apprenant_id=${encodeURIComponent(apprenantId)}` : '';
    const fichier = type === 'facture'
      ? `/api/sessions/${sessionId}/facture${apprenantId ? `?apprenant_id=${encodeURIComponent(apprenantId)}` : ''}`
      : `/api/sessions/${sessionId}/documents?type=${type}${query}`;
    const learner = inscriptions.find((item) => String(item.apprenant_id) === String(apprenantId));
    const labels = { programme: 'Programme', convocation: 'Convocation', emargement: 'Feuille d’émargement', attestation: 'Attestation', certificat: 'Certificat', facture: 'Facture' };
    if (montrer) setApercu({ url: fichier, titre: `${labels[type] || 'Document'}${learner ? ` · ${learner.first_name} ${learner.last_name}` : ''}` });
    try {
      const response = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        categorie: ['programme', 'attestation', 'certificat', 'emargement', 'facture', 'convocation'].includes(type) ? type : 'autre',
        libelle: `${labels[type] || 'Document'}${learner ? ` · ${learner.first_name} ${learner.last_name}` : ''}`,
        fichier,
        // Un document nominatif se rattache à SON apprenant, pas à la session :
        // l'espace apprenant affiche les documents de la session à tous ses
        // inscrits, donc rattacher une convocation nominative à la session la
        // rendrait visible par les autres stagiaires.
        contexte_type: apprenantId ? 'apprenant' : 'session',
        contexte_id: apprenantId || sessionId,
        notes: apprenantId ? `Généré depuis la session ${sessionId}` : 'Généré depuis la fiche de session',
      }) });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Document non archivé');
      setDocuments((current) => [created, ...current]);
      setNotice(`${labels[type] || 'Document'} généré et archivé dans cette session.`);
    } catch (err) { setNotice(`Document ouvert, mais son archivage a échoué : ${err.message}`); }
  };

  /**
   * Les documents de session qui ont leur propre route : on les regarde
   * dans l'app, et on les archive au registre comme les autres.
   */
  const apercuDocument = async (type, learner) => {
    const LIBELLES = { convocation: 'Convocation', livret: "Livret d'accueil", devis: 'Devis', convention: 'Convention' };
    const qs = type === 'convocation' && learner?.apprenant_id ? `?apprenant_id=${encodeURIComponent(learner.apprenant_id)}` : '';
    const fichier = `/api/sessions/${sessionId}/${type}${qs}`;
    const libelle = `${LIBELLES[type] || 'Document'}${learner ? ` · ${learner.first_name} ${learner.last_name}` : ''}`;
    setApercu({ url: fichier, titre: libelle });
    try {
      const response = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        categorie: ['convention', 'convocation', 'devis', 'livret'].includes(type) ? type : 'autre',
        libelle,
        fichier,
        contexte_type: learner?.apprenant_id ? 'apprenant' : 'session',
        contexte_id: learner?.apprenant_id || sessionId,
        notes: 'Généré depuis la fiche de session',
      }) });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Document non archivé');
      setDocuments((current) => [created, ...current]);
      setNotice(`${libelle} généré et archivé dans cette session.`);
    } catch (err) { setNotice(`Document affiché, mais son archivage a échoué : ${err.message}`); }
  };

  const createLink = async (kind, questionnaireType, apprenantId = null) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, questionnaireType, apprenantId }) });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Lien non créé');
      setLinks((all) => [created, ...all]);
      const value = `${window.location.origin}${created.url}`;
      await navigator.clipboard?.writeText(value);
      setNotice(apprenantId ? 'Lien individuel créé et copié dans le presse-papiers.' : 'Lien créé et copié dans le presse-papiers.');
    } catch (err) { setNotice(err.message || 'Impossible de créer le lien.'); }
  };

  const copyLink = async (link) => {
    if (!link?.url) return;
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}${link.url}`);
      setNotice('Lien individuel copié dans le presse-papiers.');
    } catch {
      setNotice('Le lien est prêt, mais la copie a été refusée par le navigateur.');
    }
  };

  const copyRegistrationLink = async (link = registrationLink) => {
    if (!link?.url) return;
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}${link.url}`);
      setNotice('Le formulaire d’inscription de cette session a été copié.');
    } catch {
      setNotice('Le formulaire est prêt, mais la copie a été refusée par le navigateur.');
    }
  };

  const createRegistrationLink = async (renew = false) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/registration-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renew }),
      });
      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Formulaire non créé');
      setRegistrationLink(created);
      await copyRegistrationLink(created);
      setNotice(renew ? 'Nouveau formulaire créé : l’ancien lien ne fonctionne plus.' : 'Formulaire d’inscription créé et copié. Aucun e-mail n’a été envoyé.');
    } catch (err) { setNotice(err.message || 'Impossible de créer le formulaire.'); }
  };

  const prepareMissingQuestionnaires = async () => {
    const missing = inscriptions.flatMap((learner) => EVALUATION_TYPES
      .filter((definition) => !links.some((link) => link.kind === 'questionnaire' && link.questionnaire_type === definition.questionnaireType && String(link.apprenant_id) === String(learner.apprenant_id)))
      .map((definition) => ({ learner, definition })));
    if (!missing.length) { setNotice('Tous les formulaires individuels sont déjà prêts pour cette session.'); return; }
    try {
      const created = await Promise.all(missing.map(async ({ learner, definition }) => {
        const response = await fetch(`/api/sessions/${sessionId}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'questionnaire', questionnaireType: definition.questionnaireType, apprenantId: learner.apprenant_id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lien non créé');
        return data;
      }));
      setLinks((current) => [...created, ...current]);
      setNotice(`${created.length} formulaire${created.length > 1 ? 's' : ''} individuel${created.length > 1 ? 's' : ''} préparé${created.length > 1 ? 's' : ''}. Aucun e-mail n’a été envoyé.`);
    } catch (err) { setNotice(err.message || 'Impossible de préparer les formulaires.'); }
  };

  /**
   * Ouvre la fenêtre d'envoi. Avant, ce clic préparait un aperçu qui ne
   * s'affichait que dans l'onglet Suivi > E-mails : depuis Convocations,
   * il ne se passait rien à l'écran et on ne pouvait pas envoyer.
   */
  /** Un e-mail de ce modèle est-il déjà parti à cette adresse ? */
  const dejaEnvoye = (templateKey, email) => Boolean(email) && emailHistory.some((item) =>
    item.template_key === templateKey && item.destinataire === email && item.statut === 'envoye');

  /**
   * Le dernier envoi réussi vers cette adresse : c'est lui qui porte la date
   * qu'on affiche. Sans date, « envoyée » ne veut rien dire pour un auditeur
   * comme pour l'apprenant qui appelle en disant qu'il n'a rien reçu.
   */
  const dernierEnvoi = (templateKey, email) => {
    if (!email) return null;
    return emailHistory
      .filter((item) => item.template_key === templateKey && item.destinataire === email && item.statut === 'envoye')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
  };

  /**
   * La dernière pièce archivée d'une catégorie, pour un contexte donné : un
   * apprenant pour les documents nominatifs, la session pour les autres. On
   * prend la plus récente, c'est elle qui fait foi.
   */
  const pieceDe = (categorie, contexteId) => documents
    .filter((doc) => doc.categorie === categorie && String(doc.contexte_id) === String(contexteId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

  const convocationDe = (apprenantId) => pieceDe('convocation', apprenantId);

  const convocationsProduites = inscriptions.filter((item) => convocationDe(item.apprenant_id)).length;
  const conventionsSignees = inscriptions.filter((item) => item.convention_signed).length;
  const pieceConvention = pieceDe('convention', sessionId);
  /** Les pièces revenues signées, par catégorie, la plus récente d'abord. */
  const signeesDe = (categorie) => documents
    .filter((doc) => doc.categorie === categorie && doc.signe && String(doc.contexte_id) === String(sessionId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const retirerDuRegistre = (doc) => {
    setDocuments((current) => current.filter((x) => x.id !== doc.id));
    setNotice('Pièce retirée et fichier effacé.');
  };

  const ajouterAuRegistre = (doc) => {
    setDocuments((current) => [doc, ...current]);
    setNotice('Pièce signée archivée dans cette session.');
  };

  /**
   * Produire toutes les convocations d'un coup. En série et sans ouvrir de
   * fenêtre : dix aperçus qui se recouvrent ne servent personne, et chaque
   * apprenant a besoin de SA pièce, pas d'un exemplaire commun.
   */
  const genererToutesConvocations = async () => {
    for (const item of inscriptions) {
      // eslint-disable-next-line no-await-in-loop
      await openDocument('convocation', item.apprenant_id, { montrer: false });
    }
    setNotice(`${inscriptions.length} convocation${inscriptions.length > 1 ? 's' : ''} produite${inscriptions.length > 1 ? 's' : ''} et archivée${inscriptions.length > 1 ? 's' : ''}.`);
  };

  const prepareEmail = (type, inscription = null) => {
    setEnvoi({ templateKey: type, apprenantId: inscription?.apprenant_id || null });
  };

  const updateInscription = async (id, patch) => {
    try {
      const response = await fetch('/api/inscriptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Mise à jour impossible');
      setSession((current) => ({ ...current, inscriptions: current.inscriptions.map((item) => item.id === id ? { ...item, ...updated } : item) }));
      setNotice('Le statut de l’apprenant a été mis à jour.');
    } catch (err) { setNotice(err.message || 'Impossible de mettre à jour cet apprenant.'); }
  };

  const saveConvocationConfig = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        convocation_auto_enabled: convocationConfig.enabled ? 1 : 0,
        convocation_lead_days: Math.max(0, Number(convocationConfig.leadDays) || 0),
        convocation_document_template: convocationConfig.documentTemplate,
        convocation_email_template: convocationConfig.emailTemplate,
      }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Paramétrage impossible à enregistrer');
      setSession((current) => ({ ...current, ...updated, inscriptions: current.inscriptions }));
      setNotice('Paramétrage des convocations enregistré pour cette session.');
    } catch (err) { setNotice(err.message || 'Impossible d’enregistrer le paramétrage.'); }
  };

  const saveDatesConfig = async () => {
    if (!datesConfig.startDate || !datesConfig.endDate) {
      setNotice('Renseigne une date de début et une date de fin.');
      return;
    }
    if (datesConfig.endDate < datesConfig.startDate) {
      setNotice('La date de fin doit être postérieure à la date de début.');
      return;
    }
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: datesConfig.startDate,
          end_date: datesConfig.endDate,
          location: datesConfig.location,
          horaire: datesConfig.horaire,
          modality: datesConfig.modality,
          tarif: Number(datesConfig.tarif) || 0,
          max_participants: Number(datesConfig.maxParticipants) || 0,
        }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Dates impossibles à enregistrer');
      await load();
      setNotice('Dates, lieu, prix et capacité mis à jour. Les émargements ont été recalculés si nécessaire.');
    } catch (err) { setNotice(err.message || 'Impossible d’enregistrer les dates.'); }
  };

  const saveGeneralConfig = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        code_interne: generalConfig.codeInterne, type_session: generalConfig.typeSession, status: generalConfig.status,
        gestionnaire_1: generalConfig.manager, gestionnaire_2: generalConfig.manager2, formateur_name: generalConfig.formateurName,
        fuseau_horaire: generalConfig.timeZone, notes: generalConfig.notes,
      }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Mise à jour impossible');
      setSession((current) => ({ ...current, ...updated, inscriptions: current.inscriptions }));
      setNotice('Informations de la session enregistrées.');
    } catch (err) { setNotice(err.message || 'Impossible d’enregistrer la session.'); }
  };

  const saveModule = async (id, patch) => {
    try {
      const response = await fetch(`/api/session-modules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Module non enregistré');
      setModules((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
      setNotice('Module de session mis à jour.');
    } catch (err) { setNotice(err.message || 'Impossible de mettre à jour ce module.'); }
  };

  const updateAttendance = async (id, patch) => {
    try {
      const response = await fetch('/api/emargements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Émargement non enregistré');
      setEmargements((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
      setNotice('Émargement mis à jour.');
    } catch (err) { setNotice(err.message || 'Impossible de modifier cet émargement.'); }
  };

  if (loading) return <div style={{ ...card, ...muted }}>Chargement de la session…</div>;
  if (error || !session) return <div style={{ ...card, borderColor: 'var(--danger)', color: 'var(--danger)' }}>{error || 'Session introuvable.'}</div>;

  const setCurrentSub = (key) => setSub((current) => ({ ...current, [step]: key }));
  const currentSub = sub[step];
  const actualRevenue = Number(session.ca_confirmed || session.tarif || 0);
  const clientName = session.client_company || session.client_name || session.company_name || inscriptions[0]?.company || '';
  const allLearners = inscriptions.length > 0;
  const everyLearner = (field) => allLearners && inscriptions.every((item) => Boolean(item[field]));
  const navigateTo = (nextStep, nextSub) => {
    setStep(nextStep);
    if (nextSub) setSub((current) => ({ ...current, [nextStep]: nextSub }));
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const followUpColumns = [
    {
      title: 'Préparation', eyebrow: 'Les fondamentaux de la session', icon: '↗', tone: 'var(--gold)',
      items: [
        { label: 'Dates', detail: session.start_date && session.end_date ? `Du ${dateFr(session.start_date)}\nau ${dateFr(session.end_date)}` : 'Dates à planifier', state: session.start_date && session.end_date ? 'done' : 'alert', step: 'configuration', sub: 'dates' },
        { label: 'Lieu de formation', detail: session.location || session.adresse || 'Lieu à renseigner', state: session.location || session.adresse ? 'done' : 'alert', step: 'configuration', sub: 'dates' },
        { label: 'Client', detail: clientName || 'Client à associer', state: clientName ? 'done' : 'alert', step: 'configuration', sub: 'apprenants' },
        { label: 'Devis', detail: actualRevenue ? `Montant de la session\n${actualRevenue.toLocaleString('fr-FR')} €` : 'Montant à renseigner', state: actualRevenue ? 'done' : 'alert', step: 'gestion', sub: 'finances' },
        { label: 'Apprenants', detail: allLearners ? `${inscriptions.length} apprenant${inscriptions.length > 1 ? 's' : ''} nommé${inscriptions.length > 1 ? 's' : ''}` : 'Aucun apprenant nommé', state: allLearners ? 'done' : 'alert', step: 'configuration', sub: 'apprenants' },
        { label: 'Programme', detail: session.formation_title || 'Programme à associer', state: session.formation_title ? 'done' : 'alert', step: 'configuration', sub: 'programme' },
        { label: 'Intervenant', detail: session.formateur_name || 'Intervenant à attribuer', state: session.formateur_name ? 'done' : 'alert', step: 'configuration', sub: 'intervenants' },
      ],
    },
    {
      title: 'Gestion', eyebrow: 'Documents & finance', icon: '▣', tone: 'var(--success)',
      items: [
        { label: 'Conventions', detail: `Signées\n${inscriptions.filter((item) => item.convention_signed).length}/${inscriptions.length}\n\nDocuments générés\n${documents.filter((item) => item.categorie === 'convention').length}`, state: everyLearner('convention_signed') ? 'done' : allLearners ? 'alert' : 'pending', step: 'gestion', sub: 'conventions' },
        { label: 'Convocations', detail: `Envoyées par e-mail\n${inscriptions.filter((item) => item.convocation_sent).length}/${inscriptions.length}\n\nDocuments générés\n${documents.filter((item) => item.categorie === 'autre').length}`, state: everyLearner('convocation_sent') ? 'done' : allLearners ? 'alert' : 'pending', step: 'gestion', sub: 'convocations' },
        { label: 'Évaluations', detail: `Complétées\n${stats.evaluated}/${inscriptions.length}\n\nRéponses à suivre`, state: allLearners && stats.evaluated >= inscriptions.length ? 'done' : stats.evaluated ? 'pending' : 'alert', step: 'gestion', sub: 'evaluations' },
        { label: 'Facturation', detail: Number(session.ca_confirmed || 0) ? `Montant confirmé\n${Number(session.ca_confirmed).toLocaleString('fr-FR')} €\n\nPaiement à suivre` : 'Facture à préparer', state: Number(session.ca_confirmed || 0) ? 'done' : 'pending', step: 'gestion', sub: 'finances' },
      ],
    },
    {
      title: 'Espace apprenant', eyebrow: 'Accès & contenus', icon: '◉', tone: 'var(--info)',
      items: [
        { label: 'Configuration', detail: session.notes ? 'Description renseignée' : 'Description à finaliser\n\nImage à ajouter si nécessaire', state: session.notes ? 'done' : 'alert', step: 'apprenant', sub: 'affichage' },
        { label: 'Accès', detail: links.length ? `Liens actifs\n${links.length}` : 'Aucun lien créé', state: links.length ? 'done' : 'alert', step: 'apprenant', sub: 'acces' },
        { label: 'Documents', detail: allLearners ? 'Documents à partager' : 'En attente d’apprenants', state: allLearners ? 'pending' : 'alert', step: 'apprenant', sub: 'documents' },
        { label: 'Séquences e-learning', detail: 'Aucune séquence associée', state: 'alert', step: 'apprenant', sub: 'elearning' },
      ],
    },
    {
      title: 'Suivi', eyebrow: 'Pendant et après la session', icon: '✓', tone: 'var(--gold)',
      items: [
        { label: 'Émargements', detail: `Signatures enregistrées\n${stats.signedAttendance}/${stats.totalAttendance || 0}`, state: stats.totalAttendance && stats.signedAttendance === stats.totalAttendance ? 'done' : stats.signedAttendance ? 'pending' : 'alert', step: 'suivi', sub: 'emargements' },
        { label: 'Absences', detail: stats.totalAttendance && stats.signedAttendance === stats.totalAttendance ? 'Aucune absence à traiter' : 'Présences à contrôler', state: stats.totalAttendance && stats.signedAttendance === stats.totalAttendance ? 'done' : 'pending', step: 'suivi', sub: 'absences' },
        { label: 'Certificats & attestations', detail: `Envoyés par e-mail\n${inscriptions.filter((item) => item.attestation_sent).length}/${inscriptions.length}`, state: everyLearner('attestation_sent') ? 'done' : allLearners ? 'pending' : 'alert', step: 'suivi', sub: 'attestations' },
        { label: 'E-mails', detail: emailHistory.length ? `${emailHistory.filter((item) => item.statut === 'envoye').length} envoyé(s) sur ${emailHistory.length} trace(s)` : 'Aucun e-mail envoyé', state: emailHistory.some((item) => item.statut === 'envoye') ? 'done' : 'pending', step: 'suivi', sub: 'emails' },
      ],
    },
  ];

  const followUpItems = followUpColumns.flatMap((column) => column.items);
  const followUpCounts = followUpItems.reduce((counts, item) => ({ ...counts, [item.state]: (counts[item.state] || 0) + 1 }), { done: 0, alert: 0, pending: 0 });

  const renderAdvancement = () => <>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
      <div><div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Avancement de la session</div><h2 style={{ ...title, fontSize: 21, marginTop: 4 }}>Suivi opérationnel, étape par étape</h2></div>
      <div style={{ color: 'var(--text-2)', fontWeight: 700, fontSize: 12 }}>{stats.signedAttendance}/{stats.totalAttendance || 0} émargements validés</div>
    </div>
    <section aria-label="Résumé de l’avancement" style={{ ...card, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface-2)' }}>
      <span style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 800, marginRight: 2 }}>Lecture rapide</span>
      <StatusSummary count={followUpCounts.done} label="validées" state="done" />
      <StatusSummary count={followUpCounts.alert} label="à traiter" state="alert" />
      <StatusSummary count={followUpCounts.pending} label="à suivre" state="pending" />
      <span style={{ ...muted, marginLeft: 'auto' }}>Clique sur une carte pour ouvrir directement son espace d’édition.</span>
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 14, alignItems: 'start' }}>
      {followUpColumns.map((column) => <FollowUpColumn key={column.title} {...column} onNavigate={navigateTo} />)}
    </div>
  </>;

  const renderConfiguration = () => {
    if (currentSub === 'positionnement') return <Positionnement
      inscriptions={inscriptions}
      onEnregistrer={updateInscription}
    />;
    if (currentSub === 'clients') return renderClients();
    if (currentSub === 'programme') return <section style={card}><h2 style={title}>Programme de la session</h2><p style={muted}>Le programme catalogue reste indépendant ; ici, tu ajustes les modules réellement délivrés dans cette session.</p>{modules.length ? <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{modules.map((item, index) => <ModuleEditor key={item.id} item={item} index={index} onSave={saveModule} />)}</div> : <Empty>Aucun module n’est encore associé à cette session.</Empty>}</section>;
    if (currentSub === 'intervenants') return <section style={card}><h2 style={title}>Intervenant principal</h2><p style={muted}>Son nom est utilisé dans les documents générés et dans le suivi de la session.</p><label style={{ display: 'grid', gap: 6, marginTop: 16, maxWidth: 540, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Nom de l’intervenant<input value={generalConfig.formateurName} onChange={(event) => setGeneralConfig((current) => ({ ...current, formateurName: event.target.value }))} placeholder="Nom et prénom" style={inputStyle} /></label><div style={{ marginTop: 16 }}><Action onClick={saveGeneralConfig}>Enregistrer l’intervenant</Action></div></section>;
    if (currentSub === 'dates') return <section style={card}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}><div><h2 style={title}>Dates, lieu et prix</h2><p style={{ ...muted, margin: '5px 0 0' }}>Modifie ces informations directement dans la session.</p></div><span style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>Édition active</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 18 }}><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Date de début<input type="date" value={datesConfig.startDate} onChange={(event) => setDatesConfig((current) => ({ ...current, startDate: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Date de fin<input type="date" value={datesConfig.endDate} onChange={(event) => setDatesConfig((current) => ({ ...current, endDate: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Lieu<input value={datesConfig.location} onChange={(event) => setDatesConfig((current) => ({ ...current, location: event.target.value }))} placeholder="Lieu de formation" style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Horaire<input value={datesConfig.horaire} onChange={(event) => setDatesConfig((current) => ({ ...current, horaire: event.target.value }))} placeholder="Ex. 09:00 – 17:00" style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Modalité<select value={datesConfig.modality} onChange={(event) => setDatesConfig((current) => ({ ...current, modality: event.target.value }))} style={{ ...selectStyle, width: '100%' }}><option>Présentiel</option><option>Distanciel</option><option>Hybride</option></select></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Prix par client (HT)<input type="number" min="0" value={datesConfig.tarif} onChange={(event) => setDatesConfig((current) => ({ ...current, tarif: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Capacité maximale<input type="number" min="0" value={datesConfig.maxParticipants} onChange={(event) => setDatesConfig((current) => ({ ...current, maxParticipants: event.target.value }))} style={inputStyle} /></label></div><div style={{ marginTop: 18 }}><Action onClick={saveDatesConfig}>Enregistrer les modifications</Action></div></section>;
    if (currentSub === 'apprenants') return <>
      <section style={{ ...card, marginBottom: 14, borderColor: 'var(--gold)', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
          <div><h2 style={title}>Formulaire d’inscription à cette session</h2><p style={{ ...muted, maxWidth: 650, margin: '6px 0 0' }}>Partage ce lien : l’apprenant complète ses coordonnées, son profil est créé ou mis à jour puis il est inscrit à cette session. Les formulaires préformation, à chaud et à froid sont préparés, sans envoi d’e-mail automatique.</p></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Action onClick={() => registrationLink ? copyRegistrationLink() : createRegistrationLink()}>{registrationLink ? 'Copier le formulaire' : 'Créer le formulaire'}</Action>
            {registrationLink && <Action secondary onClick={() => createRegistrationLink(true)}>Renouveler le lien</Action>}
          </div>
        </div>
        {registrationLink && <div style={{ ...muted, marginTop: 12 }}>Lien actif depuis le {dateTimeFr(registrationLink.created_at)}. Le renouvellement désactive immédiatement l’ancien lien.</div>}
      </section>
      <section style={card}><h2 style={title}>Clients et apprenants <span style={{ color: 'var(--text-3)' }}>{inscriptions.length}</span></h2><p style={muted}>Chaque fiche apprenant est modifiable ici : coordonnées, entreprise et statut alimentent immédiatement les convocations, attestations et e-mails.</p><EditableLearnerList inscriptions={inscriptions} onReload={load} onNotice={setNotice} /></section>
    </>;
    return <section style={card}><h2 style={title}>Informations générales</h2><p style={muted}>Les champs ci-dessous sont propres à cette session. Le programme associé se modifie depuis sa fiche catalogue.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 18 }}><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Programme associé<input value={session.formation_title || ''} readOnly style={{ ...inputStyle, opacity: .7 }} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Code interne<input value={generalConfig.codeInterne} onChange={(event) => setGeneralConfig((current) => ({ ...current, codeInterne: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Type de session<select value={generalConfig.typeSession} onChange={(event) => setGeneralConfig((current) => ({ ...current, typeSession: event.target.value }))} style={{ ...selectStyle, width: '100%' }}><option value="">À définir</option><option value="INTER">Inter entreprise</option><option value="INTRA">Intra entreprise</option></select></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Statut<select value={generalConfig.status} onChange={(event) => setGeneralConfig((current) => ({ ...current, status: event.target.value }))} style={{ ...selectStyle, width: '100%' }}><option value="">À définir</option><option>Projet</option><option>Planifiée</option><option>En cours</option><option>Terminée</option><option>Archivée</option></select></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Gestionnaire n°1<input value={generalConfig.manager} onChange={(event) => setGeneralConfig((current) => ({ ...current, manager: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Gestionnaire n°2<input value={generalConfig.manager2} onChange={(event) => setGeneralConfig((current) => ({ ...current, manager2: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Fuseau horaire<input value={generalConfig.timeZone} onChange={(event) => setGeneralConfig((current) => ({ ...current, timeZone: event.target.value }))} style={inputStyle} /></label></div><label style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Notes de session<textarea value={generalConfig.notes} onChange={(event) => setGeneralConfig((current) => ({ ...current, notes: event.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></label><div style={{ marginTop: 18 }}><Action onClick={saveGeneralConfig}>Enregistrer les informations</Action></div></section>;
  };

  /** Ce que l'envoi automatique ferait ce matin, sans rien envoyer. */
  const essayerEnvoiAuto = async () => {
    setEssaiAuto('chargement');
    try {
      const r = await fetch('/api/griotheque/envois-auto');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Essai impossible');
      setEssaiAuto(d.sessions_traitees?.find((x) => x.session_id === sessionId) || { aucun: true, mode: d.mode_smtp, armees: d.sessions_armees });
    } catch (e) { setNotice(e.message); setEssaiAuto(null); }
  };

  const renderClients = () => <ClientsSession sessionId={sessionId} onNotice={setNotice} />;

  const renderGestion = () => {
    if (currentSub === 'automatisations') return <EnvoisAutomatiques sessionId={sessionId} session={session} onNotice={setNotice} onRecharger={load} />;
    if (currentSub === 'convocations') return <>
      <section style={card}>
        <h2 style={title}>Envoi automatique</h2>
        <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
          <Toggle checked={convocationConfig.enabled} onChange={(enabled) => setConvocationConfig((current) => ({ ...current, enabled }))} label="Activer l’envoi automatique des convocations aux apprenants" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', color: 'var(--text-2)', fontSize: 13 }}>
            <span>Le matin (UTC+1 Paris),</span><input aria-label="Nombre de jours avant la formation" type="number" min="0" value={convocationConfig.leadDays} onChange={(event) => setConvocationConfig((current) => ({ ...current, leadDays: event.target.value }))} style={{ width: 74, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' }} /><span>jour(s) avant le début de la formation de l’apprenant.</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Modèle de document<select value={convocationConfig.documentTemplate} onChange={(event) => setConvocationConfig((current) => ({ ...current, documentTemplate: event.target.value }))} style={selectStyle}><option>Modèle par défaut</option><option>Convocation standard</option></select></label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Modèle d’e-mail<select value={convocationConfig.emailTemplate} onChange={(event) => setConvocationConfig((current) => ({ ...current, emailTemplate: event.target.value }))} style={selectStyle}><option>Modèle par défaut</option><option>E-mail de convocation</option></select></label>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Action onClick={saveConvocationConfig}>Enregistrer</Action>
            <Action secondary onClick={essayerEnvoiAuto}>Voir ce qui partirait</Action>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 10, background: convocationConfig.enabled ? 'var(--success-soft)' : 'var(--surface-2)', border: `1.5px solid ${convocationConfig.enabled ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'var(--border)'}`, fontSize: 12.5, lineHeight: 1.6 }}>
            {convocationConfig.enabled ? <>
              <b>L’envoi automatique est armé.</b> Un travail tourne sur le serveur chaque matin à 7 h 30 et envoie la convocation à tout apprenant qui n’en a pas déjà reçu une, dès qu’il reste {convocationConfig.leadDays} jour(s) ou moins avant le début.
              {session.start_date && <> Pour cette session, la fenêtre s’ouvre le {dateFr(new Date(new Date(`${String(session.start_date).slice(0, 10)}T12:00:00`).getTime() - Number(convocationConfig.leadDays || 0) * 86400000).toISOString().slice(0, 10))}.</>}
            </> : <>
              <b>L’envoi automatique est désarmé.</b> Rien ne partira tout seul pour cette session : les convocations restent à envoyer à la main depuis la fenêtre d’envoi.
            </>}
          </div>

          {essaiAuto && <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6 }}>
            {essaiAuto === 'chargement' ? 'Essai en cours…' : essaiAuto.aucun ? <>
              Rien ne partirait pour cette session aujourd’hui{essaiAuto.armees ? ` (${essaiAuto.armees} session(s) armée(s) au total)` : ''}. Soit l’envoi n’est pas activé, soit la fenêtre n’est pas ouverte, soit tout le monde a déjà reçu sa convocation.
            </> : <>
              <b>Aujourd’hui, {essaiAuto.a_convoquer.length} convocation(s) partiraient</b> pour cette session, à {essaiAuto.jours_avant} jour(s) du début.
              {essaiAuto.a_convoquer.length > 0 && <> Destinataires : {essaiAuto.a_convoquer.join(', ')}.</>}
              {essaiAuto.sans_email > 0 && <> {essaiAuto.sans_email} apprenant(s) sans adresse seraient ignorés.</>}
              {' '}Aucun e-mail n’a été envoyé : c’est un essai à blanc.
            </>}
          </div>}
        </div>
      </section>
      <section style={card}>
        <h2 style={title}>Convocations des apprenants</h2>
        <p style={{ ...muted, margin: '5px 0 14px' }}>Une ligne par apprenant : sa convocation, la date à laquelle elle a été produite, et où en est son envoi.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <Action onClick={genererToutesConvocations} disabled={!inscriptions.length}>Générer toutes les convocations</Action>
          <Action secondary onClick={() => prepareEmail('convocation')} disabled={!inscriptions.length}>✉ Envoyer les convocations</Action>
          <span style={muted}>{convocationsProduites}/{inscriptions.length} produite{convocationsProduites > 1 ? 's' : ''} · {inscriptions.filter((item) => item.convocation_sent).length}/{inscriptions.length} envoyée{inscriptions.filter((item) => item.convocation_sent).length > 1 ? 's' : ''}</span>
        </div>
        {inscriptions.length ? <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.4fr) minmax(190px,1.3fr) minmax(150px,1fr) auto', gap: 12, alignItems: 'center', padding: '9px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700 }}>
            <span>Apprenant</span><span>Convocation</span><span>Envoi</span><span />
          </div>
          {inscriptions.map((item) => {
            const piece = convocationDe(item.apprenant_id);
            const envoi = dernierEnvoi('convocation', item.email);
            return <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.4fr) minmax(190px,1.3fr) minmax(150px,1fr) auto', gap: 12, alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
              <div><b style={{ fontSize: 13 }}>{item.last_name?.toUpperCase()} {item.first_name}</b><div style={muted}>{item.email || 'E-mail à renseigner'}</div></div>
              <Piece libelle="Convocation" document={piece} onVoir={() => setApercu({ url: piece.fichier, titre: `Convocation · ${item.first_name} ${item.last_name}` })} />
              <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                <Etat actif={Boolean(item.convocation_sent || envoi)} oui="Envoyée" non="À envoyer" date={envoi?.created_at} />
                <Toggle checked={Boolean(item.convocation_sent)} onChange={(value) => updateInscription(item.id, { convocation_sent: value ? 1 : 0 })} label="" />
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <Geste nom={piece ? 'Voir la convocation' : 'Générer la convocation'} icone="oeil" onClick={() => openDocument('convocation', item.apprenant_id)} />
                <Geste nom="Télécharger" icone="telecharger" href={piece?.fichier} disabled={!piece} />
                <Geste nom="Envoyer par e-mail" icone="enveloppe" onClick={() => prepareEmail('convocation', item)} actif={Boolean(envoi)} disabled={!item.email} />
                <Geste nom="Régénérer une nouvelle version" icone="rafraichir" onClick={() => openDocument('convocation', item.apprenant_id)} />
              </div>
            </div>;
          })}
        </div> : <Empty>Ajoute au moins un apprenant pour générer et suivre ses convocations.</Empty>}
      </section>
    </>;
    if (currentSub === 'evaluations') return <div style={{ display: 'grid', gap: 14 }}>
      <section style={{ ...card, borderLeft: '3px solid var(--gold)', padding: '13px 16px' }}>
        <b style={{ fontSize: 13 }}>Parcours formulaires de l’apprenant</b>
        <p style={{ ...muted, margin: '4px 0 10px' }}>Dès l’inscription, les liens individuels préformation, à chaud et à froid sont préparés. Ils sont visibles ici, datés et prêts à partager ; aucun e-mail n’est envoyé sans votre action.</p>
        {inscriptions.length > 0 && <Action secondary onClick={prepareMissingQuestionnaires}>Préparer les formulaires manquants</Action>}
      </section>
      {/* Le programme décide des questionnaires servis ; rien de coché = les trois. */}
      {EVALUATION_TYPES.filter((definition) => {
        let retenus = [];
        try { retenus = JSON.parse(session.formation_evaluations || '[]') || []; } catch { retenus = []; }
        return !retenus.length || retenus.includes(definition.questionnaireType);
      }).map((definition) => {
      const answers = evaluations.filter((item) => item.type === definition.id || (definition.id === 'satisfaction' && item.type === 'acquis'));
      const answeredIds = new Set(answers.map((item) => item.apprenant_id));
      const questionnaireLinks = links.filter((item) => item.kind === 'questionnaire' && item.questionnaire_type === definition.questionnaireType);
      return <section key={definition.id} style={card}>
        <h2 style={title}>{definition.title}</h2><p style={{ ...muted, margin: '5px 0 15px' }}>{definition.description}</p>
        {inscriptions.length ? <div style={{ display: 'grid', gap: 9 }}>{inscriptions.map((learner) => {
          const answer = answers.find((item) => item.apprenant_id === learner.apprenant_id);
          const learnerLink = questionnaireLinks.find((item) => item.apprenant_id === learner.apprenant_id);
          const planned = learnerLink?.slot_date ? ` · prévu le ${dateFr(learnerLink.slot_date)}` : '';
          return <div key={learner.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface-2)', flexWrap: 'wrap' }}><div><b>{learner.first_name} {learner.last_name}</b><div style={muted}>{answeredIds.has(learner.apprenant_id) ? `Répondu${answer?.created_at ? ` le ${dateTimeFr(answer.created_at)}` : ''}` : learnerLink ? `Lien individuel prêt à partager${planned}` : 'Lien à générer'}</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ color: answeredIds.has(learner.apprenant_id) ? 'var(--success)' : learnerLink ? 'var(--info)' : 'var(--gold)', fontWeight: 800, fontSize: 12 }}>{answeredIds.has(learner.apprenant_id) ? '✓ Répondu' : learnerLink ? '↗ Prêt' : '○ À préparer'}</span>{!answeredIds.has(learner.apprenant_id) && <Action secondary onClick={() => learnerLink ? copyLink(learnerLink) : createLink('questionnaire', definition.questionnaireType, learner.apprenant_id)}>{learnerLink ? 'Copier le lien' : 'Créer le lien'}</Action>}</div></div>;
        })}</div> : <Empty>Ajoute des apprenants pour suivre les réponses à cette évaluation.</Empty>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}><div style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 700 }}>{answers.length}/{inscriptions.length} réponse(s) · {definition.model}</div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{definition.automated && <span style={{ ...muted, color: questionnaireLinks.length ? 'var(--success)' : 'var(--text-3)' }}>{questionnaireLinks.filter((item) => item.apprenant_id).length}/{inscriptions.length} lien(s) individuel(s) prêt(s)</span>}<Action secondary onClick={() => { const collective = questionnaireLinks.find((item) => !item.apprenant_id); return collective ? copyLink(collective) : createLink('questionnaire', definition.questionnaireType); }}>{questionnaireLinks.some((item) => !item.apprenant_id) ? 'Copier le lien collectif' : 'Créer le lien collectif'}</Action></div></div>
      </section>;
    })}</div>;
    if (currentSub === 'finances') return <section style={card}><h2 style={title}>Finances</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}><Metric label="Coût formation" value={`${Number(session.tarif || 0).toLocaleString('fr-FR')} €`} note="HT" /><Metric label="Total facturé" value={`${Number(session.ca_confirmed || 0).toLocaleString('fr-FR')} €`} note="HT" /><Metric label="Marge" value={`${Number(session.taux_marge || 0)} %`} note="estimation" /></div><div style={{ marginTop: 16 }}><Action onClick={() => openDocument('facture')}>Générer / mettre à jour la facture</Action></div></section>;
    if (currentSub === 'entreprise') return <section style={card}><h2 style={title}>Espace entreprise</h2><p style={muted}>Le client entreprise pourra suivre les informations et documents de sa session depuis un espace dédié.</p><Empty>L’espace entreprise sera activé lorsque le client et ses contacts auront été renseignés pour cette session.</Empty></section>;
    return <>
      <section style={card}>
        <h2 style={title}>Conventions et contrats par client</h2>
        <p style={{ ...muted, margin: '5px 0 15px' }}>La convention vaut pour le client et sa session. Chaque génération est archivée, datée et versionnée ; les signatures se suivent apprenant par apprenant.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <Action onClick={() => apercuDocument('convention')}>Générer / mettre à jour la convention</Action>
          <Action secondary onClick={() => prepareEmail('convention')} disabled={!inscriptions.length}>✉ Envoyer la convention</Action>
          <span style={muted}>{conventionsSignees}/{inscriptions.length} signature{conventionsSignees > 1 ? 's' : ''} recueillie{conventionsSignees > 1 ? 's' : ''}</span>
        </div>
        {inscriptions.length ? <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <EnteteClient nom={clientName} inscriptions={inscriptions} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <Piece libelle="Convention de formation" document={pieceConvention} onVoir={() => setApercu({ url: pieceConvention.fichier, titre: 'Convention de formation' })} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Geste nom={pieceConvention ? 'Voir la convention' : 'Générer la convention'} icone="oeil" onClick={() => apercuDocument('convention')} />
              <Geste nom="Télécharger" icone="telecharger" href={pieceConvention?.fichier} disabled={!pieceConvention} />
              <Geste nom="Envoyer par e-mail" icone="enveloppe" onClick={() => prepareEmail('convention')} />
              <Geste nom="Régénérer une nouvelle version" icone="rafraichir" onClick={() => apercuDocument('convention')} />
            </div>
          </div>
          <div style={{ padding: '4px 14px 10px' }}>
            <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700, padding: '10px 0 6px' }}>Signatures</div>
            {inscriptions.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div><b style={{ fontSize: 13 }}>{item.last_name?.toUpperCase()} {item.first_name}</b><div style={muted}>{item.email || 'E-mail à renseigner'}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <Etat actif={Boolean(item.convention_signed)} oui="Signée" non="Signature en attente" />
                <Toggle checked={Boolean(item.convention_signed)} onChange={(value) => updateInscription(item.id, { convention_signed: value ? 1 : 0 })} label="" />
              </div>
            </div>)}
          </div>
        </div> : <Empty>Ajoute un client et au moins un apprenant pour générer la convention.</Empty>}
        <PiecesSignees
          compact
          sessionId={sessionId}
          categorie="convention"
          titre="Convention revenue signée"
          explication="Tant que la signature électronique n’est pas en place, dépose ici le scan de la convention signée par le client. Elle rejoint le registre de la session."
          libelleBouton="Ajouter la convention signée"
          feuilles={signeesDe('convention')}
          onDepot={ajouterAuRegistre}
          onRetrait={retirerDuRegistre}
          onErreur={setNotice}
          onVoir={(doc) => setApercu({ url: doc.fichier, titre: doc.libelle || 'Convention signée' })}
        />
      </section>
      <section style={card}>
        <h2 style={title}>Autres documents contractuels</h2>
        <p style={{ ...muted, margin: '5px 0 15px' }}>Les pièces qui accompagnent la convention. Elles portent la date de leur dernière production.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {[
            { cle: 'programme', libelle: 'Programme de formation', ouvrir: () => openDocument('programme') },
            { cle: 'devis', libelle: 'Devis', ouvrir: () => apercuDocument('devis') },
            { cle: 'livret', libelle: 'Livret d’accueil', ouvrir: () => apercuDocument('livret') },
          ].map(({ cle, libelle, ouvrir }) => {
            const piece = pieceDe(cle, sessionId);
            return <div key={cle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
              <Piece libelle={libelle} document={piece} onVoir={() => setApercu({ url: piece.fichier, titre: libelle })} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Geste nom={piece ? `Voir : ${libelle}` : `Générer : ${libelle}`} icone="oeil" onClick={ouvrir} />
                <Geste nom="Télécharger" icone="telecharger" href={piece?.fichier} disabled={!piece} />
                <Geste nom="Régénérer une nouvelle version" icone="rafraichir" onClick={ouvrir} />
              </div>
            </div>;
          })}
        </div>
        <p style={{ ...muted, marginTop: 14 }}>CGV et politique de confidentialité : à gérer depuis les modèles de documents.</p>
        <PiecesSignees
          compact
          sessionId={sessionId}
          categorie="devis"
          titre="Devis retourné signé"
          explication="Le « bon pour accord » du client, scanné. C’est lui qui vaut commande, et ce que réclame un financeur avant la prise en charge."
          libelleBouton="Ajouter le devis signé"
          feuilles={signeesDe('devis')}
          onDepot={ajouterAuRegistre}
          onRetrait={retirerDuRegistre}
          onErreur={setNotice}
          onVoir={(doc) => setApercu({ url: doc.fichier, titre: doc.libelle || 'Devis signé' })}
        />
      </section>
    </>;
  };

  const renderApprenant = () => {
    if (currentSub === 'documents') return <section style={card}><h2 style={title}>Documents partagés</h2><p style={muted}>Chaque document généré est ajouté au registre de cette session avec sa date et sa version. « Mettre à jour » crée une nouvelle version, sans effacer l’ancienne.</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}><Action onClick={() => openDocument('programme')}>Générer le programme</Action><Action secondary onClick={() => openDocument('emargement')}>Générer la feuille d’émargement</Action><Action secondary onClick={() => apercuDocument('livret')}>Livret d’accueil</Action>{inscriptions.map((item) => <Action key={`cv-${item.id}`} secondary onClick={() => apercuDocument('convocation', item)}>Convocation · {item.first_name}</Action>)}{inscriptions.map((item) => <Action key={item.id} secondary onClick={() => openDocument('attestation', item.apprenant_id)}>Attestation · {item.first_name}</Action>)}</div><DocumentRegister documents={documents} onRegenerate={(doc) => { try { const url = new URL(doc.fichier, window.location.origin); openDocument(url.searchParams.get('type') || 'programme', url.searchParams.get('apprenant_id')); } catch { setApercu({ url: doc.fichier, titre: doc.libelle || 'Document' }); } }} /></section>;
    if (currentSub === 'elearning') return <section style={card}><h2 style={title}>Séquences e-learning</h2><p style={muted}>Crée ou associe un parcours e-learning à cette session, puis suis la progression par apprenant.</p><Empty>Aucune séquence n’est encore associée à ce parcours.</Empty></section>;
    if (currentSub === 'affichage') return <EspaceApprenantConfig sessionId={sessionId} session={session} onNotice={setNotice} onRecharger={load} />;
    const accessLink = links.find((item) => item.kind === 'questionnaire') || links.find((item) => item.kind === 'emargement');
    return <div style={{ display: 'grid', gap: 14 }}>
      <section style={card}>
        <h2 style={title}>Comment l’apprenant entre</h2>
        <p style={{ ...muted, margin: '6px 0 14px' }}>
          Deux portes, et elles ne se valent pas.
        </p>
        <div style={{ padding: 14, borderRadius: 11, border: '1.5px solid color-mix(in srgb, var(--success) 40%, transparent)', background: 'var(--success-soft)' }}>
          <b style={{ fontSize: 13.5 }}>Par son adresse e-mail · recommandé</b>
          <p style={{ ...muted, margin: '5px 0 10px', color: 'var(--text)' }}>
            L’apprenant saisit l’adresse à laquelle tu l’as inscrit et reçoit un lien qui expire au bout de deux heures. Transféré à quelqu’un d’autre, il ne vaudra bientôt plus rien.
          </p>
          <code style={{ display: 'block', padding: '9px 11px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--gold)', fontSize: 12.5, wordBreak: 'break-all' }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/espace
          </code>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 11 }}>
            <Action small secondary onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/espace`); setNotice('Adresse copiée. Elle est la même pour toutes tes sessions.'); }}>Copier l’adresse</Action>
            <Action small href="/espace">Ouvrir la page</Action>
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface-2)', marginTop: 12 }}>
          <b style={{ fontSize: 13.5 }}>Par son lien personnel</b>
          <p style={{ ...muted, margin: '5px 0 0' }}>
            C’est le lien glissé au bas de chaque convocation : un clic, aucune saisie. Mais il est permanent, donc quiconque le reçoit ouvre le dossier de l’apprenant. À réserver aux envois que tu maîtrises.
          </p>
        </div>
      </section>

      <section style={card}>
        <h2 style={title}>Liens d’action</h2>
        <p style={muted}>Des liens ponctuels pour l’émargement et les questionnaires de cette session.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
          <Action onClick={() => createLink('emargement')}>Créer le lien d’émargement</Action>
          <Action secondary onClick={() => createLink('questionnaire', 'positionnement')}>Créer le lien de positionnement</Action>
        </div>
        {accessLink ? <div style={{ ...card, background: 'var(--surface-2)', padding: 12 }}>
          <div style={muted}>Dernier lien actif</div>
          <code style={{ color: 'var(--gold)', fontSize: 12, wordBreak: 'break-all' }}>{typeof window !== 'undefined' ? window.location.origin : ''}{accessLink.url}</code>
        </div> : <Empty>Aucun lien d’accès n’a encore été créé.</Empty>}
      </section>
    </div>;
  };

  const renderSuivi = () => {
    if (currentSub === 'absences') return <section style={card}><h2 style={title}>Absences et abandons</h2><p style={muted}>Corrige directement les présences par demi-journée : la synthèse des absences se met à jour immédiatement.</p><AttendanceTable rows={emargements} mode="absence" onUpdate={updateAttendance} /></section>;
    if (currentSub === 'emails') return <>
      <section style={card}>
        <h2 style={title}>Envoyer un e-mail</h2>
        <p style={{ ...muted, margin: '5px 0 14px' }}>Choisis un modèle : la fenêtre d’envoi s’ouvre avec la liste des destinataires, l’aperçu réel et les pièces jointes.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {MODELES_EMAIL.map(([cle, libelle], index) => <Action key={cle} secondary={index > 0} onClick={() => prepareEmail(cle)}>✉ {libelle}</Action>)}
        </div>
      </section>
      <section style={{ ...card, marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[['envoyes', 'E-mails envoyés'], ['planifies', 'E-mails planifiés'], ['auto', 'E-mails automatiques']].map(([cle, libelle]) => <button
            key={cle}
            type="button"
            onClick={() => setOngletEmail(cle)}
            style={{
              border: 'none', background: 'none', font: 'inherit', cursor: 'pointer',
              padding: '9px 14px', fontSize: 13, fontWeight: 800,
              color: ongletEmail === cle ? 'var(--text)' : 'var(--text-3)',
              borderBottom: `2px solid ${ongletEmail === cle ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1,
            }}
          >{libelle}</button>)}
        </div>

        {ongletEmail === 'envoyes' && <EmailHistory
          emails={emailHistory}
          mode={emailMode}
          onRenvoyer={(email) => setEnvoi({
            templateKey: email.template_key,
            apprenantId: inscriptions.find((i) => i.email === email.destinataire)?.apprenant_id || null,
          })}
        />}

        {ongletEmail === 'planifies' && <EmailsPlanifies
          essai={essaiAuto}
          onEssayer={essayerEnvoiAuto}
          session={session}
        />}

        {ongletEmail === 'auto' && <EnvoisAutomatiques sessionId={sessionId} session={session} onNotice={setNotice} onRecharger={load} />}
      </section>
    </>;
    if (currentSub === 'attestations') return <section style={card}><h2 style={title}>Attestations et certificats</h2><p style={muted}>Les documents sont générés par apprenant une fois la session réalisée.</p><div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{inscriptions.map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--surface-2)', borderRadius: 9 }}><b>{item.first_name} {item.last_name}</b><div style={{ display: 'flex', gap: 8 }}><Action secondary onClick={() => openDocument('certificat', item.apprenant_id)}>Certificat</Action><Action secondary onClick={() => openDocument('attestation', item.apprenant_id)}>Attestation</Action></div></div>)}</div>{!inscriptions.length && <Empty>Aucun apprenant inscrit.</Empty>}</section>;
    if (currentSub === 'elearning') return <section style={card}><h2 style={title}>Suivi e-learning</h2><p style={muted}>Progression, scores et participation des apprenants aux séquences.</p><Empty>Aucune séquence e-learning n’est associée à cette session.</Empty></section>;
    if (currentSub === 'qualite') return <section style={card}><h2 style={title}>Suivi qualité</h2><p style={muted}>Centralise les évaluations à chaud et à froid pour produire le bilan qualité de la session.</p><Metric label="Satisfaction moyenne" value={evaluations.length ? `${(evaluations.reduce((sum, item) => sum + Number(item.score || 0), 0) / evaluations.length).toFixed(1)}/10` : '—'} note={`${evaluations.length} réponse(s)`} /></section>;
    return <>
      <section style={card}><h2 style={title}>Suivi des émargements</h2><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '10px 0 16px' }}><p style={muted}>Signe ou contrôle les présences par demi-journée. Chaque modification est sauvegardée immédiatement.</p><Action secondary onClick={() => openDocument('emargement')}>Générer / mettre à jour la feuille</Action></div><AttendanceTable rows={emargements} onUpdate={updateAttendance} /></section>
      <PiecesSignees
        sessionId={sessionId}
        categorie="emargement"
        titre="Archivage des feuilles signées"
        explication="Une fois la feuille signée, dépose son scan ici pour en garder une archive numérique. PDF ou photo, 25 Mo maximum. Les feuilles archivées ne sont visibles que depuis l’OS."
        libelleBouton="Ajouter une feuille signée"
        feuilles={signeesDe('emargement')}
        onDepot={ajouterAuRegistre}
        onRetrait={retirerDuRegistre}
        onErreur={setNotice}
        onVoir={(doc) => setApercu({ url: doc.fichier, titre: doc.libelle || 'Feuille signée' })}
      />
    </>;
  };

  const content = step === 'avancement' ? renderAdvancement() : step === 'configuration' ? renderConfiguration() : step === 'gestion' ? renderGestion() : step === 'apprenant' ? renderApprenant() : renderSuivi();

  return <div style={{ maxWidth: 1500, margin: '0 auto', padding: '0 0 48px' }}>
    <ApercuDocument url={apercu?.url} titre={apercu?.titre} onFermer={() => setApercu(null)} />
    <Link href="/sessions-list" style={{ color: 'var(--gold-text)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>← Toutes les sessions</Link>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <BandeauEncre
        surTitre={`Session · ${session.code_interne || 'sans code'}`}
        titre={session.formation_title || 'Session de formation'}
        phrase={[
          `${dateFr(session.start_date)} → ${dateFr(session.end_date)}`,
          session.adresse || session.location,
          `${inscriptions.length} apprenant(s)`,
        ].filter(Boolean).join(' · ')}
        chiffres={[
          { label: 'Chiffre d’affaires', valeur: session.ca_confirmed ? `${Number(session.ca_confirmed).toLocaleString('fr-FR')} €` : '—', couleur: 'var(--gold)' },
          { label: 'Intervenant', valeur: session.formateur_name || 'Non attribué' },
          { label: 'Modalité', valeur: session.modality || 'Présentiel' },
        ]}
      />

      <BarreOnglets
        onglets={STEPS.map((e) => ({
          cle: e.id, label: e.label, ...COULEUR_ETAPE[e.id],
        }))}
        actif={step}
        onChoisir={setStep}
      />

      {SUBNAV[step] && (
        <SousOnglets
          sous={SUBNAV[step]}
          actif={currentSub}
          onChoisir={setCurrentSub}
          couleur={COULEUR_ETAPE[step]?.base}
        />
      )}
    </div>

    {notice && <div role="status" style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--gold-soft)', color: 'var(--text)', borderRadius: 9, fontSize: 12 }}>{notice}</div>}
    <div style={{ display: 'grid', gap: 14 }}>{content}</div>
    {envoi && <FenetreEnvoi
      sessionId={sessionId}
      templateKey={envoi.templateKey}
      apprenantId={envoi.apprenantId}
      onFermer={() => setEnvoi(null)}
      onEnvoye={(bilan, modele) => {
        setNotice(bilan.envoyes
          ? `${LIBELLE_MODELE[modele] || 'E-mail'} : ${bilan.envoyes} envoi(s) réussi(s).`
          : `${LIBELLE_MODELE[modele] || 'E-mail'} : ${bilan.simules || 0} simulation(s) archivée(s).`);
        load();
      }}
    />}
  </div>;
}

/**
 * La fenêtre d'envoi. Un seul endroit dans toute l'application où un e-mail
 * part vraiment, ouvrable depuis n'importe quel bouton ✉ de la session.
 *
 * Elle appelle /api/griotheque/emails, le moteur habillé : logo en en-tête,
 * programme joint en PDF pour la convocation et le rappel, prénom de chaque
 * apprenant, lien personnel vers son espace. L'ancien chemin passait par
 * /api/emails et expédiait du texte nu.
 *
 * Trois règles tenues ici :
 *   1. On voit qui va recevoir avant d'envoyer, nom et adresse.
 *   2. Une adresse manquante est dite, pas ignorée en silence.
 *   3. Le mode est annoncé : « envoi réel » ou « simulation », jamais un
 *      bouton qui laisse croire qu'un message est parti.
 */
function FenetreEnvoi({ sessionId, templateKey, apprenantId, onFermer, onEnvoye }) {
  const [modele, setModele] = useState(templateKey);
  const [donnees, setDonnees] = useState(null);
  const [choisis, setChoisis] = useState(new Set());
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState('');
  const [bilan, setBilan] = useState(null);
  const [adresseTest, setAdresseTest] = useState('');
  const [testEnvoye, setTestEnvoye] = useState('');

  useEffect(() => {
    const surTouche = (event) => { if (event.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  useEffect(() => {
    let vivant = true;
    setDonnees(null); setErreur(''); setBilan(null); setTestEnvoye('');
    fetch(`/api/griotheque/emails?session_id=${encodeURIComponent(sessionId)}&template_key=${encodeURIComponent(modele)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivant) return;
        if (d.error) { setErreur(d.error); return; }
        setDonnees(d);
        const joignables = (d.destinataires || []).filter((item) => item.joignable);
        const cible = apprenantId ? joignables.filter((item) => item.id === apprenantId) : joignables;
        setChoisis(new Set((cible.length ? cible : joignables).map((item) => item.id)));
      })
      .catch(() => { if (vivant) setErreur('Impossible de préparer cet e-mail.'); });
    return () => { vivant = false; };
  }, [sessionId, modele, apprenantId]);

  const basculer = (id) => setChoisis((current) => {
    const suivant = new Set(current);
    if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
    return suivant;
  });

  const destinataires = donnees?.destinataires || [];
  const joignables = destinataires.filter((item) => item.joignable);
  const sansAdresse = destinataires.filter((item) => !item.joignable);
  const reel = donnees?.mode === 'reel';

  const envoyer = async () => {
    if (!choisis.size) return;
    setOccupe('envoi'); setErreur('');
    try {
      const r = await fetch('/api/griotheque/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, template_key: modele, apprenant_ids: [...choisis] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Envoi impossible');
      setBilan(d);
      onEnvoye?.(d, modele);
    } catch (e) { setErreur(e.message || 'Envoi impossible.'); }
    finally { setOccupe(''); }
  };

  const envoyerTest = async () => {
    const adresse = adresseTest.trim();
    if (!adresse) return;
    setOccupe('test'); setErreur('');
    try {
      const r = await fetch('/api/griotheque/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, template_key: modele, test_emails: [adresse] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Test impossible');
      setTestEnvoye(d.envoyes ? `Test parti à ${adresse}.` : `Le test n’a pas pu partir à ${adresse}.`);
    } catch (e) { setErreur(e.message || 'Test impossible.'); }
    finally { setOccupe(''); }
  };

  const etiquette = LIBELLE_MODELE[modele] || modele;

  return <div role="dialog" aria-modal="true" aria-label={`Envoyer : ${etiquette}`}
    onClick={(event) => { if (event.target === event.currentTarget) onFermer(); }}
    style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto' }}>
    <div style={{ width: 'min(760px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.45)', overflow: 'hidden' }}>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ ...muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 900 }}>Envoyer un e-mail</div>
          <h2 style={{ ...title, fontSize: 19, marginTop: 3 }}>{etiquette}</h2>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
      </div>

      <div style={{ padding: 20, display: 'grid', gap: 18 }}>

        <div style={{ overflowX: 'auto' }}><div role="tablist" style={tabsWrap}>
          {MODELES_EMAIL.map(([cle, libelle]) => <button key={cle} type="button" role="tab" aria-selected={modele === cle} onClick={() => setModele(cle)} style={tab(modele === cle)}>{libelle}</button>)}
        </div></div>

        <div style={{ padding: '10px 13px', borderRadius: 10, border: `1.5px solid ${reel ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--gold) 45%, transparent)'}`, background: reel ? 'var(--success-soft)' : 'var(--gold-soft)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700 }}>
          {reel ? `Envoi réel, depuis ${donnees?.expediteur || 'la boîte de l’organisme'}.` : 'SMTP non configuré : l’envoi sera archivé comme simulation, personne ne recevra rien.'}
        </div>

        {erreur && <div style={{ padding: '10px 13px', borderRadius: 10, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700 }}>{erreur}</div>}

        {!donnees && !erreur && <div style={{ ...muted, padding: '18px 0' }}>Préparation de l’e-mail…</div>}

        {bilan ? <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: 16, borderRadius: 12, background: 'var(--success-soft)', border: '1.5px solid color-mix(in srgb, var(--success) 40%, transparent)' }}>
            <b style={{ fontSize: 15 }}>{bilan.envoyes ? `${bilan.envoyes} e-mail(s) envoyé(s).` : bilan.simules ? `${bilan.simules} e-mail(s) simulé(s) et archivé(s).` : 'Aucun e-mail n’est parti.'}</b>
            <div style={{ ...muted, marginTop: 6 }}>
              {bilan.echecs ? `${bilan.echecs} échec(s). ` : ''}
              {bilan.ignores ? `${bilan.ignores} apprenant(s) sans adresse, ignoré(s). ` : ''}
              Chaque envoi est tracé dans le journal de la session.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Action onClick={onFermer}>Fermer</Action>
            <Action secondary onClick={() => setBilan(null)}>Envoyer un autre e-mail</Action>
          </div>
        </div> : donnees && <>

          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 9 }}>
              <b style={{ fontSize: 13.5 }}>Destinataires · {choisis.size} sur {joignables.length}</b>
              {joignables.length > 1 && <button type="button" onClick={() => setChoisis(choisis.size === joignables.length ? new Set() : new Set(joignables.map((item) => item.id)))} style={{ border: 0, background: 'transparent', color: 'var(--gold)', font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                {choisis.size === joignables.length ? 'Tout décocher' : 'Tout cocher'}
              </button>}
            </div>
            {destinataires.length ? <div style={{ display: 'grid', gap: 7 }}>
              {joignables.map((item) => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', border: `1.5px solid ${choisis.has(item.id) ? 'color-mix(in srgb, var(--gold) 50%, transparent)' : 'var(--border)'}`, background: choisis.has(item.id) ? 'var(--gold-soft)' : 'var(--surface-2)', borderRadius: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={choisis.has(item.id)} onChange={() => basculer(item.id)} style={{ width: 17, height: 17, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                <span style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{item.nom}</b><div style={{ ...muted, fontSize: 12 }}>{item.email}</div></span>
              </label>)}
              {sansAdresse.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', border: '1.5px dashed color-mix(in srgb, var(--danger) 38%, transparent)', borderRadius: 10, background: 'var(--danger-soft)' }}>
                <span aria-hidden="true" style={{ width: 17, textAlign: 'center', color: 'var(--danger)', fontWeight: 900 }}>!</span>
                <span><b style={{ fontSize: 13 }}>{item.nom}</b><div style={{ ...muted, fontSize: 12 }}>Aucune adresse e-mail : renseigne-la dans Configuration puis Apprenants.</div></span>
              </div>)}
            </div> : <Empty>Aucun apprenant inscrit : il n’y a personne à qui envoyer.</Empty>}
          </section>

          <section>
            <b style={{ fontSize: 13.5 }}>Aperçu {donnees.apercu ? `pour ${(joignables[0] || destinataires[0])?.nom || 'le premier apprenant'}` : ''}</b>
            {donnees.apercu ? <div style={{ marginTop: 9, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '11px 13px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 900 }}>Objet</div>
                <b style={{ fontSize: 13.5 }}>{donnees.apercu.objet}</b>
              </div>
              <pre style={{ margin: 0, padding: 14, maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{donnees.apercu.corps}</pre>
              <div style={{ padding: '10px 13px', borderTop: '1px solid var(--border)', ...muted, fontSize: 12 }}>
                Pièces jointes : le logo de La Griothèque en en-tête{MODELES_AVEC_PROGRAMME.includes(modele) ? ', et le programme de formation en PDF' : ''}. Chaque apprenant reçoit son prénom et son lien personnel.
              </div>
            </div> : <p style={{ ...muted, marginTop: 6 }}>L’aperçu se construit à partir d’un apprenant inscrit. Inscris quelqu’un pour le voir.</p>}
          </section>

          <section style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <b style={{ fontSize: 13 }}>M’envoyer un test d’abord</b>
            <p style={{ ...muted, margin: '4px 0 10px' }}>Le message exact, avec « (test) » en fin d’objet, sans toucher aux apprenants. Envoie-le à ton adresse, pas à celle d’un client : un message de test reçu par un vrai destinataire abîme ta réputation d’expéditeur.</p>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="email" value={adresseTest} onChange={(event) => setAdresseTest(event.target.value)} placeholder="ton@adresse.com" style={{ ...inputStyle, width: 'min(300px, 100%)' }} />
              <Action secondary small disabled={!adresseTest.trim() || occupe === 'test'} onClick={envoyerTest}>{occupe === 'test' ? 'Envoi du test…' : 'Envoyer le test'}</Action>
              {testEnvoye && <span style={{ ...muted, color: 'var(--success)', fontWeight: 700 }}>{testEnvoye}</span>}
            </div>
          </section>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Action disabled={!choisis.size || occupe === 'envoi'} onClick={envoyer}>
              {occupe === 'envoi' ? 'Envoi en cours…' : reel
                ? `Envoyer à ${choisis.size} apprenant${choisis.size > 1 ? 's' : ''}`
                : `Simuler pour ${choisis.size} apprenant${choisis.size > 1 ? 's' : ''}`}
            </Action>
            <Action secondary onClick={onFermer}>Annuler</Action>
          </div>
        </>}
      </div>
    </div>
  </div>;
}

function FollowUpColumn({ title: label, eyebrow, icon, tone, items, onNavigate }) {
  const completed = items.filter((item) => item.state === 'done').length;
  return <section aria-label={`${label} : ${completed} étapes finalisées sur ${items.length}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,.04)', minHeight: 570 }}>
    <div style={{ minHeight: 62, padding: '12px 14px', background: 'var(--surface-2)', color: 'var(--text)', borderBottom: `2px solid ${tone}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${tone} 18%, transparent)`, border: `1.5px solid ${tone}`, color: tone, fontSize: 17, fontWeight: 900 }}>{icon}</span>
        <div><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 900, color: 'var(--text-3)' }}>{eyebrow}</div><h2 style={{ margin: '2px 0 0', fontSize: 16, letterSpacing: '-.02em', color: 'var(--text)' }}>{label}</h2></div>
      </div>
      <span style={{ borderRadius: 999, padding: '5px 9px', background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone, border: `1px solid color-mix(in srgb, ${tone} 34%, transparent)`, fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{completed}/{items.length}</span>
    </div>
    <div style={{ padding: '20px 14px 24px' }}>
      {items.map((item, index) => <FollowUpItem key={item.label} {...item} isLast={index === items.length - 1} onClick={() => onNavigate(item.step, item.sub)} />)}
    </div>
  </section>;
}

function FollowUpItem({ label, detail, state, isLast, onClick }) {
  const stateStyle = {
    done: { mark: '✓', color: 'var(--success)', soft: 'var(--success-soft)', text: 'Validé', action: 'Modifier' },
    alert: { mark: '!', color: 'var(--danger)', soft: 'var(--danger-soft)', text: 'À traiter', action: 'Compléter', solid: true },
    pending: { mark: '○', color: 'var(--gold)', soft: 'var(--gold-soft)', text: 'À suivre', action: 'Ouvrir' },
  }[state];
  return <button type="button" onClick={onClick} aria-label={`${stateStyle.action} : ${label}`} title={`${stateStyle.action} : ${label}`} style={{ width: '100%', padding: 0, border: 0, background: 'transparent', color: 'var(--text)', display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', gap: 11, alignItems: 'stretch', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
    <span aria-label={stateStyle.text} style={{ display: 'grid', gridTemplateRows: '40px minmax(26px, 1fr)', justifyItems: 'center' }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: stateStyle.color, color: 'var(--gold-ink)', fontSize: 22, fontWeight: 900 }}>{stateStyle.mark}</span>
      {!isLast && <span aria-hidden="true" style={{ width: 7, minHeight: 28, margin: '7px 0', background: stateStyle.color, borderRadius: 99 }} />}
    </span>
    <span style={{ minWidth: 0, paddingBottom: isLast ? 0 : 12 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: stateStyle.color, fontSize: 15, fontWeight: 900, lineHeight: 1.2 }}><span>{label}</span><span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text-3)' }}>›</span></span>
      <span style={{ display: 'block', marginTop: 8, padding: '12px 13px', borderRadius: 11, background: stateStyle.soft, border: `1px solid color-mix(in srgb, ${stateStyle.color} 28%, transparent)`, color: 'var(--text)', whiteSpace: 'pre-line', fontSize: 12.5, fontWeight: 700, lineHeight: 1.48 }}>{detail}<span style={{ display: 'flex', marginTop: 12 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, background: stateStyle.solid ? 'var(--gold)' : 'var(--surface)', color: stateStyle.solid ? 'var(--gold-ink)' : 'var(--text)', border: `1.5px solid ${stateStyle.solid ? 'var(--gold)' : 'var(--border-2)'}`, boxShadow: stateStyle.solid ? '0 2px 10px rgba(255, 202, 0, .22)' : 'none', fontSize: 12.5, fontWeight: 800 }}>{stateStyle.action} <span aria-hidden="true">→</span></span></span></span>
    </span>
  </button>;
}

function StatusSummary({ count, label, state }) {
  const status = {
    done: { mark: '✓', color: 'var(--success)', soft: 'var(--success-soft)' },
    alert: { mark: '!', color: 'var(--danger)', soft: 'var(--danger-soft)' },
    pending: { mark: '○', color: 'var(--gold)', soft: 'var(--gold-soft)' },
  }[state];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 999, background: status.soft, color: status.color, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', borderRadius: '50%', background: status.color, color: 'var(--gold-ink)', fontSize: 12 }}>{status.mark}</span>{count} {label}</span>;
}

function Checklist({ title: label, tone, lines, onClick }) {
  return <button type="button" onClick={onClick} style={{ ...card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}><div style={{ color: tone, fontWeight: 800, marginBottom: 12 }}>{label}</div>{lines.map(([line, done]) => <div key={line} style={{ display: 'flex', gap: 8, color: 'var(--text-2)', fontSize: 12, margin: '8px 0' }}><span style={{ color: done ? tone : 'var(--text-3)' }}>{done ? '●' : '○'}</span>{line}</div>)}</button>;
}

function LearnerTable({ inscriptions, columns = ['name', 'company', 'status'] }) {
  if (!inscriptions.length) return <Empty>Aucun apprenant enregistré pour le moment.</Empty>;
  const labels = { name: 'Apprenant', company: 'Entreprise', status: 'Statut', email: 'E-mail', convention: 'Convention', convocation: 'Convocation' };
  return <div style={{ overflowX: 'auto', marginTop: 16 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{columns.map((key) => <th key={key} style={{ textAlign: 'left', color: 'var(--text-3)', padding: '9px 10px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 10 }}>{labels[key]}</th>)}</tr></thead><tbody>{inscriptions.map((item) => <tr key={item.id}>{columns.map((key) => <td key={key} style={{ padding: '10px', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{key === 'name' ? <b>{item.first_name} {item.last_name}</b> : key === 'status' ? item.status : key === 'convention' ? (item.convention_signed ? 'Signée' : 'À générer') : key === 'convocation' ? (item.convocation_sent ? 'Envoyée' : 'À envoyer') : item[key] || '—'}</td>)}</tr>)}</tbody></table></div>;
}

function ModuleEditor({ item, index, onSave }) {
  const vide = () => ({
    title: item.title || '', description: item.description || '',
    duration_hours: item.duration_hours ?? 0, prix_ht: item.prix_ht ?? 0,
  });
  const [draft, setDraft] = useState(vide);
  useEffect(() => setDraft(vide()), [item.id, item.title, item.description, item.duration_hours, item.prix_ht]);
  return <div style={{ padding: 14, borderLeft: '4px solid var(--gold)', background: 'var(--surface-2)', borderRadius: 8 }}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 140px', gap: 10 }}><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>MODULE {index + 1}<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>DURÉE (H)<input type="number" min="0" step="0.25" value={draft.duration_hours} onChange={(event) => setDraft((current) => ({ ...current, duration_hours: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>PRIX HT (€)<input type="number" min="0" step="10" value={draft.prix_ht} onChange={(event) => setDraft((current) => ({ ...current, prix_ht: event.target.value }))} style={inputStyle} /></label></div><label style={{ display: 'grid', gap: 5, marginTop: 10, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>DESCRIPTION<textarea value={draft.description} rows={2} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></label><div style={{ marginTop: 10 }}><Action secondary onClick={() => onSave(item.id, draft)}>Enregistrer le module</Action></div></div>;
}

function EditableLearnerList({ inscriptions, onReload, onNotice }) {
  if (!inscriptions.length) return <Empty>Aucun apprenant enregistré pour le moment.</Empty>;
  return <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>{inscriptions.map((item) => <EditableLearner key={item.id} item={item} onReload={onReload} onNotice={onNotice} />)}</div>;
}

function EditableLearner({ item, onReload, onNotice }) {
  const [draft, setDraft] = useState({ first_name: item.first_name || '', last_name: item.last_name || '', email: item.email || '', phone: item.phone || '', company: item.company || '', status: item.status || '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft({ first_name: item.first_name || '', last_name: item.last_name || '', email: item.email || '', phone: item.phone || '', company: item.company || '', status: item.status || '' }), [item.id, item.first_name, item.last_name, item.email, item.phone, item.company, item.status]);
  const save = async () => {
    setSaving(true);
    try {
      const [personResponse, inscriptionResponse] = await Promise.all([
        fetch(`/api/apprenants/${item.apprenant_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: draft.first_name, last_name: draft.last_name, email: draft.email, phone: draft.phone, company: draft.company }) }),
        fetch('/api/inscriptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: draft.status }) }),
      ]);
      const person = await personResponse.json();
      const inscription = await inscriptionResponse.json();
      if (!personResponse.ok) throw new Error(person.error || 'Coordonnées non enregistrées');
      if (!inscriptionResponse.ok) throw new Error(inscription.error || 'Statut non enregistré');
      onNotice('Apprenant mis à jour : les documents et e-mails utiliseront ces nouvelles coordonnées.');
      await onReload();
    } catch (error) { onNotice(error.message || 'Impossible de mettre à jour cet apprenant.'); }
    finally { setSaving(false); }
  };
  return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>PRÉNOM<input value={draft.first_name} onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>NOM<input value={draft.last_name} onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>E-MAIL<input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>TÉLÉPHONE<input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>ENTREPRISE<input value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} style={inputStyle} /></label><label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>STATUT<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} style={{ ...selectStyle, width: '100%' }}><option value="">À définir</option><option>Prospect</option><option>Confirmé</option><option>Annulé</option><option>Terminé</option></select></label></div><div style={{ marginTop: 12 }}><Action secondary onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer cet apprenant'}</Action></div></div>;
}

/**
 * Le positionnement à l'entrée.
 *
 * Deux colonnes, et la séparation entre elles est tout l'intérêt de l'écran.
 * À gauche, ce que la personne a DÉCLARÉ en s'inscrivant : ses réponses, mot
 * pour mot, datées, qu'on ne réécrit pas. À droite, ce que l'organisme a
 * DÉCIDÉ : entrée en formation, aménagement, réorientation, et pourquoi.
 *
 * Un auditeur ne cherche pas un questionnaire rempli, il cherche la preuve
 * que le positionnement a eu un effet. Un formulaire classé qui n'a rien
 * changé au déroulé ne vaut rien ; c'est la colonne de droite qui fait la
 * conformité, et c'est la seule qui se saisisse à la main.
 */
function Positionnement({ inscriptions, onEnregistrer }) {
  const [brouillons, setBrouillons] = useState({});
  const [enCours, setEnCours] = useState(null);

  const lire = (item, champ) => brouillons[item.id]?.[champ] ?? item[champ] ?? '';
  const poser = (item, champ, valeur) => setBrouillons((c) => ({
    ...c, [item.id]: { ...(c[item.id] || {}), [champ]: valeur },
  }));

  const enregistrer = async (item) => {
    const patch = brouillons[item.id];
    if (!patch) return;
    setEnCours(item.id);
    await onEnregistrer(item.id, patch);
    setBrouillons((c) => { const s = { ...c }; delete s[item.id]; return s; });
    setEnCours(null);
  };

  const reponses = (item) => {
    try {
      const r = JSON.parse(item.reponses_inscription || '[]');
      return Array.isArray(r) ? r : [];
    } catch { return []; }
  };

  const DECISIONS = [
    ['', 'À statuer'],
    ['admis', 'Entrée en formation validée'],
    ['admis_amenagement', 'Validée, avec aménagement'],
    ['reoriente', 'Réorienté vers une autre session ou un autre organisme'],
    ['refuse', 'Prérequis non atteints'],
  ];

  const statues = inscriptions.filter((i) => i.positionnement_decision).length;

  return <section style={card}>
    <h2 style={title}>Positionnement à l’entrée</h2>
    <p style={{ ...muted, margin: '5px 0 4px', maxWidth: 760 }}>
      À gauche, ce que la personne a déclaré en s’inscrivant : on ne le réécrit pas. À droite, ce que
      vous en avez décidé. C’est la décision qui compte en audit, pas le questionnaire : un
      positionnement qui n’a rien changé au déroulé ne prouve rien.
    </p>
    <p style={{ ...muted, margin: '0 0 16px' }}>{statues}/{inscriptions.length} apprenant(s) statué(s).</p>

    {inscriptions.length ? <div style={{ display: 'grid', gap: 12 }}>
      {inscriptions.map((item) => {
        const dits = reponses(item);
        const modifie = Boolean(brouillons[item.id]);
        return <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '11px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <b style={{ fontSize: 13 }}>{item.last_name?.toUpperCase()} {item.first_name}</b>
              <div style={muted}>{item.email || 'E-mail à renseigner'}{item.financement ? ` · ${item.financement}` : ''}</div>
            </div>
            <Etat
              actif={Boolean(item.positionnement_decision)}
              oui={DECISIONS.find(([v]) => v === item.positionnement_decision)?.[1] || 'Statué'}
              non="À statuer"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, padding: 14 }}>
            <div>
              <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>Déclaré à l’inscription</div>
              {dits.length ? <div style={{ display: 'grid', gap: 7 }}>
                {dits.map((r) => <div key={r.cle}>
                  <div style={{ ...muted, fontSize: 11 }}>{r.libelle}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{r.valeur === true ? 'Oui' : String(r.valeur)}</div>
                </div>)}
              </div> : <div style={{ ...muted, fontStyle: 'italic' }}>
                Rien de déclaré : cet apprenant a été inscrit à la main, sans passer par le formulaire.
              </div>}
            </div>

            <div style={{ display: 'grid', gap: 9, alignContent: 'start' }}>
              <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700 }}>Décidé par l’organisme</div>
              <select
                value={lire(item, 'positionnement_decision')}
                onChange={(e) => poser(item, 'positionnement_decision', e.target.value)}
                style={{ ...selectStyle, width: '100%', minWidth: 0 }}
              >
                {DECISIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <textarea
                rows={2}
                placeholder="Aménagement retenu, s’il y en a un"
                value={lire(item, 'positionnement_amenagement')}
                onChange={(e) => poser(item, 'positionnement_amenagement', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <textarea
                rows={3}
                placeholder="Ce que vous en retenez, et ce que ça change au déroulé"
                value={lire(item, 'positionnement_notes')}
                onChange={(e) => poser(item, 'positionnement_notes', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {modifie && <div>
                <Action small onClick={() => enregistrer(item)} disabled={enCours === item.id}>
                  {enCours === item.id ? 'Enregistrement…' : 'Enregistrer'}
                </Action>
              </div>}
            </div>
          </div>
        </div>;
      })}
    </div> : <Empty>Ajoute au moins un apprenant pour renseigner son positionnement.</Empty>}
  </section>;
}

/**
 * Les pièces revenues signées.
 *
 * Tant qu'on ne fait pas signer électroniquement, la convention, le devis et
 * la feuille d'émargement reviennent en papier. Le même geste vaut pour les
 * trois : on dépose le scan, il rejoint le registre de la session, daté.
 *
 * La suppression est offerte sans détour, mais en deux temps. Un scan flou,
 * incomplet ou déposé au mauvais endroit ne prouve rien : le garder ne
 * protège personne et brouille le dossier. Un clic de confirmation suffit à
 * éviter le geste involontaire.
 */
function PiecesSignees({
  sessionId, categorie, titre, explication, feuilles, libelleBouton,
  onDepot, onRetrait, onErreur, onVoir, compact = false,
}) {
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState(null);

  const deposer = async (fichier) => {
    if (!fichier) return;
    setEnvoi(true);
    try {
      const corps = new FormData();
      corps.append('fichier', fichier);
      corps.append('categorie', categorie);
      const reponse = await fetch(`/api/sessions/${sessionId}/pieces-signees`, { method: 'POST', body: corps });
      const cree = await reponse.json();
      if (!reponse.ok) throw new Error(cree.error || 'Dépôt refusé');
      onDepot?.(cree);
    } catch (err) {
      onErreur?.(`La pièce n’a pas pu être archivée : ${err.message}`);
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (doc) => {
    try {
      const reponse = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      if (!reponse.ok) {
        const erreur = await reponse.json().catch(() => ({}));
        throw new Error(erreur.error || 'Suppression refusée');
      }
      setARetirer(null);
      onRetrait?.(doc);
    } catch (err) {
      onErreur?.(`La pièce n’a pas pu être retirée : ${err.message}`);
    }
  };

  const depot = <label style={{
    display: 'inline-flex', alignItems: 'center', gap: 9, padding: compact ? '9px 13px' : '11px 16px',
    borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
    fontSize: compact ? 12 : 13, fontWeight: 800, cursor: envoi ? 'progress' : 'pointer', opacity: envoi ? 0.6 : 1,
  }}>
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 11V3 M4.5 6.5 8 3l3.5 3.5 M2.5 13.5h11" />
    </svg>
    {envoi ? 'Dépôt en cours…' : libelleBouton}
    <input
      type="file"
      accept="application/pdf,image/png,image/jpeg,image/heic,image/webp"
      disabled={envoi}
      style={{ display: 'none' }}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; deposer(f); }}
    />
  </label>;

  const liste = <div style={{ marginTop: 12 }}>
    {feuilles.length ? <div style={{ display: 'grid', gap: 8 }}>
      {feuilles.map((doc) => <div key={doc.id} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10,
        background: aRetirer === doc.id ? 'rgba(220,60,50,0.06)' : 'var(--surface-2)',
      }}>
        <Piece libelle={doc.libelle || 'Pièce signée'} document={doc} verbe="Déposée" onVoir={() => onVoir?.(doc)} />
        {aRetirer === doc.id ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...muted, color: 'var(--text-2)' }}>Retirer cette pièce et effacer le fichier ?</span>
          <Action small onClick={() => retirer(doc)}>Oui, retirer</Action>
          <Action small secondary onClick={() => setARetirer(null)}>Annuler</Action>
        </div> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Etat actif oui="Signée" non="" />
          <Geste nom="Voir la pièce" icone="oeil" onClick={() => onVoir?.(doc)} />
          <Geste nom="Télécharger" icone="telecharger" href={doc.fichier} />
          <Geste nom="Retirer cette pièce" icone="corbeille" onClick={() => setARetirer(doc.id)} />
        </div>}
      </div>)}
    </div> : <Empty>{`Aucune pièce signée n’a encore été déposée${compact ? '' : ' pour cette session'}.`}</Empty>}
  </div>;

  if (compact) {
    return <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>{titre}</div>
      <p style={{ ...muted, margin: '0 0 10px' }}>{explication}</p>
      {depot}
      {liste}
    </div>;
  }

  return <section style={{ ...card, marginTop: 14 }}>
    <h2 style={title}>{titre}</h2>
    <p style={{ ...muted, margin: '5px 0 14px' }}>{explication}</p>
    {depot}
    {liste}
  </section>;
}

function DocumentRegister({ documents, onRegenerate }) {
  if (!documents.length) return <Empty>Aucun document n’a encore été généré et archivé dans cette session.</Empty>;
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{['Document', 'Version', 'Généré le', 'Mise à jour'].map((label) => <th key={label} style={{ textAlign: 'left', color: 'var(--text-3)', padding: '10px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 10 }}>{label}</th>)}</tr></thead><tbody>{documents.map((doc) => <tr key={doc.id}><td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 700 }}>{doc.libelle}<div style={muted}>{doc.notes || 'Document de session'}</div></td><td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>v{doc.version || 1}</td><td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>{dateTimeFr(doc.created_at)}</td><td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><Action small href={doc.fichier}>Ouvrir</Action><Action small secondary onClick={() => onRegenerate(doc)}>Mettre à jour</Action></div></td></tr>)}</tbody></table></div>;
}

/**
 * Ce qui partira tout seul.
 *
 * Chez Digiforma, cet onglet liste une file d'envois programmés qu'on peut
 * annuler un par un. Ici il n'y a pas de file : l'envoi automatique est une
 * règle, relue chaque matin par un travail sur le serveur. Afficher une
 * fausse file serait pire que rien, parce qu'on croirait pouvoir y toucher.
 *
 * On montre donc la règle telle qu'elle est, et surtout ce qu'elle ferait
 * aujourd'hui, en le demandant au serveur sans rien envoyer. C'est la seule
 * réponse honnête à la question « qu'est-ce qui va partir ».
 */
function EmailsPlanifies({ essai, onEssayer, session }) {
  const arme = Boolean(session?.convocation_auto_enabled);
  const jours = Number(session?.convocation_auto_lead_days) || 0;

  return <div>
    <p style={{ ...muted, margin: '0 0 14px', maxWidth: 720 }}>
      Rien n’est mis en file d’attente : un travail tourne sur le serveur chaque matin à 7 h 30 et
      relit les règles d’envoi automatique de la session. Ce tableau montre ce qu’il ferait
      maintenant, sans rien envoyer.
    </p>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <Action secondary onClick={onEssayer}>Voir ce qui partirait</Action>
      <Etat
        actif={arme}
        oui={`Envoi automatique armé · ${jours} jour(s) avant le début`}
        non="Aucun envoi automatique armé pour cette session"
      />
    </div>

    {essai === 'chargement' && <div style={muted}>Lecture des règles…</div>}

    {essai && essai !== 'chargement' && (essai.aucun
      ? <Empty>Rien ne partirait pour cette session aujourd’hui. Soit l’envoi n’est pas activé, soit la fenêtre n’est pas ouverte, soit tout le monde a déjà reçu son message.</Empty>
      : <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', ...muted, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 10, fontWeight: 700 }}>
          Partirait maintenant
        </div>
        <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-2)' }}>
          {(essai.destinataires || essai.envoyes || essai.apprenants)
            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit' }}>{JSON.stringify(essai, null, 2)}</pre>
            : 'Aucun destinataire à servir dans la fenêtre actuelle.'}
        </div>
      </div>)}

    {!essai && <Empty>Clique sur « Voir ce qui partirait » pour interroger le serveur.</Empty>}
  </div>;
}

/**
 * Le journal des envois.
 *
 * Un tableau d'e-mails ne sert qu'à répondre à une question précise : est-ce
 * que CE message est parti à CETTE personne, et quand. D'où un filtre par
 * colonne plutôt qu'une recherche globale, et le corps réellement envoyé
 * dépliable sous la ligne. Ce qui a été écrit compte autant que la date : un
 * modèle a pu changer depuis, le journal doit garder la version d'alors.
 */
function EmailHistory({ emails, mode, onRenvoyer }) {
  const [filtres, setFiltres] = useState({ date: '', destinataire: '', type: '', sujet: '', statut: '' });
  const [ouverte, setOuverte] = useState(null);

  if (!emails.length) return <Empty>Aucun e-mail n’a encore été envoyé ou simulé pour cette session.</Empty>;

  const contient = (valeur, recherche) => !recherche
    || String(valeur || '').toLowerCase().includes(recherche.toLowerCase());

  const visibles = emails.filter((email) => contient(dateTimeFr(email.created_at), filtres.date)
    && contient(`${email.destinataire} ${email.destinataire_nom || ''}`, filtres.destinataire)
    && contient(LIBELLE_MODELE[email.template_key] || email.template_key, filtres.type)
    && contient(email.objet, filtres.sujet)
    && (!filtres.statut || email.statut === filtres.statut));

  const cellule = { padding: '10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
  const entete = {
    textAlign: 'left', color: 'var(--text-3)', padding: '10px', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', fontSize: 10, letterSpacing: '.07em', fontWeight: 700, whiteSpace: 'nowrap',
  };
  const champFiltre = {
    width: '100%', boxSizing: 'border-box', padding: '5px 8px', fontSize: 11, font: 'inherit', fontSize: 11,
    border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text)',
  };

  const COULEUR = { echec: 'var(--danger)', envoye: 'var(--success)', simule: 'var(--gold)' };
  const LIBELLE = { echec: 'Échec', envoye: 'Envoyé', simule: 'Simulé' };

  return <div>
    <div style={{ ...muted, marginBottom: 9 }}>
      {mode === 'reel' ? 'Journal des envois réels' : 'Journal des e-mails simulés ou envoyés'}
      {visibles.length !== emails.length && ` · ${visibles.length} sur ${emails.length} affichés`}
    </div>
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...entete, width: 26 }} />
            <th style={entete}>Envoyé le</th>
            <th style={entete}>Destinataire</th>
            <th style={entete}>Type</th>
            <th style={entete}>Sujet</th>
            <th style={entete}>Statut</th>
            <th style={entete}>Actions</th>
          </tr>
          <tr>
            <th style={{ ...cellule, padding: '6px 10px' }} />
            {['date', 'destinataire', 'type', 'sujet'].map((cle) => <th key={cle} style={{ ...cellule, padding: '6px 10px' }}>
              <input
                value={filtres[cle]}
                onChange={(e) => setFiltres((c) => ({ ...c, [cle]: e.target.value }))}
                placeholder="Filtrer"
                style={champFiltre}
              />
            </th>)}
            <th style={{ ...cellule, padding: '6px 10px' }}>
              <select value={filtres.statut} onChange={(e) => setFiltres((c) => ({ ...c, statut: e.target.value }))} style={champFiltre}>
                <option value="">(tous)</option>
                <option value="envoye">Envoyé</option>
                <option value="simule">Simulé</option>
                <option value="echec">Échec</option>
              </select>
            </th>
            <th style={{ ...cellule, padding: '6px 10px' }} />
          </tr>
        </thead>
        <tbody>
          {visibles.map((email) => <Fragment key={email.id}>
            <tr>
              <td style={{ ...cellule, padding: '10px 4px 10px 10px' }}>
                <button
                  type="button"
                  onClick={() => setOuverte(ouverte === email.id ? null : email.id)}
                  title={ouverte === email.id ? 'Replier' : 'Voir le message envoyé'}
                  style={{ border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: ouverte === email.id ? 'rotate(180deg)' : 'none' }} aria-hidden="true">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </button>
              </td>
              <td style={{ ...cellule, whiteSpace: 'nowrap' }}>{dateTimeFr(email.created_at)}</td>
              <td style={cellule}><b>{email.destinataire_nom || '—'}</b><div style={muted}>{email.destinataire}</div></td>
              <td style={cellule}>{LIBELLE_MODELE[email.template_key] || email.template_key || '—'}</td>
              <td style={cellule}>{email.objet}</td>
              <td style={{ ...cellule, color: COULEUR[email.statut] || 'var(--text-2)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                {LIBELLE[email.statut] || email.statut}
              </td>
              <td style={cellule}>
                {email.template_key && onRenvoyer
                  ? <Action small secondary onClick={() => onRenvoyer(email)}>Renvoyer</Action>
                  : <span style={muted}>—</span>}
              </td>
            </tr>
            {ouverte === email.id && <tr>
              <td colSpan={7} style={{ padding: '12px 14px 16px 40px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>{email.objet}</div>
                {email.corps
                  ? <div style={{ ...muted, whiteSpace: 'pre-wrap', color: 'var(--text-2)', maxWidth: 760 }}>{email.corps}</div>
                  : <div style={{ ...muted, fontStyle: 'italic' }}>Le corps du message n’a pas été conservé pour cet envoi.</div>}
                {email.erreur && <div style={{ ...muted, color: 'var(--danger)', marginTop: 8 }}>Erreur : {email.erreur}</div>}
              </td>
            </tr>}
          </Fragment>)}
        </tbody>
      </table>
    </div>
    {!visibles.length && <div style={{ ...muted, padding: '14px 4px' }}>Aucun envoi ne correspond à ces filtres.</div>}
  </div>;
}

function AttendanceTable({ rows, mode, onUpdate }) {
  if (!rows.length) return <Empty>Aucune ligne d’émargement pour cette session.</Empty>;
  const grouped = rows.reduce((all, row) => { const key = `${row.first_name} ${row.last_name}`; (all[key] ||= []).push(row); return all; }, {});
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{['Apprenant', 'Date', 'Matin', 'Après-midi', ...(mode === 'absence' ? ['Synthèse'] : [])].map((label) => <th key={label} style={{ textAlign: 'left', color: 'var(--text-3)', padding: '10px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 10 }}>{label}</th>)}</tr></thead><tbody>{Object.entries(grouped).map(([name, values]) => values.map((row, index) => <tr key={row.id}><td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: index === 0 ? 700 : 400 }}>{index === 0 ? name : ''}</td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>{dateFr(row.date)}</td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}><Toggle checked={Boolean(row.matin)} onChange={(value) => onUpdate?.(row.id, { matin: value ? 1 : 0 })} label={row.matin ? 'Présent' : 'Absent'} /></td><td style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}><Toggle checked={Boolean(row.apres_midi)} onChange={(value) => onUpdate?.(row.id, { apres_midi: value ? 1 : 0 })} label={row.apres_midi ? 'Présent' : 'Absent'} /></td>{mode === 'absence' ? <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: row.matin && row.apres_midi ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{row.matin && row.apres_midi ? 'Aucune absence' : 'Demi-journée absente'}</td> : null}</tr>))}</tbody></table></div>;
}

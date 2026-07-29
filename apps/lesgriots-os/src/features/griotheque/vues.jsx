'use client';

/**
 * LES GRIOTHÈQUE — les vues métier de l'organisme de formation.
 *
 * Ce fichier était `app/formations/page.jsx` : une application entière dans
 * une seule page, avec sa propre barre latérale. C'est ce qui donnait
 * l'impression de changer d'application en cliquant sur « Formations ».
 *
 * Rien n'a été réécrit ni retiré. Le fichier est devenu une bibliothèque de
 * vues : chacune est maintenant exportée et montée sur sa propre route, dans
 * la coquille de l'OS. Toutes les fonctionnalités sont conservées, seule la
 * coquille change.
 */
import React, { useState, useEffect, useCallback } from 'react';
// Une partie de ce fichier est du JSX déjà compilé, qui appelle `jsxDEV`.
// Or `jsxDEV` n'existe que dans le runtime de développement : en production
// l'appel était nul et la vue plantait. On rebranche sur le runtime standard,
// dont la signature (type, props, key) est identique sur les trois premiers
// arguments, en aiguillant vers `jsxs` quand les enfants sont un tableau.
import { jsx as _jsxUn, jsxs as _jsxPlusieurs, Fragment as _Fragment } from 'react/jsx-runtime';
const _jsx = (type, props, key) =>
  (Array.isArray(props && props.children) ? _jsxPlusieurs : _jsxUn)(type, props, key);
import { ToastProvider, ConfirmProvider, useToast, useConfirm } from '@/components/ui';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '—';
  // Handle both ISO (2026-01-15T...) and SQLite (2026-01-15 12:00:00) formats
  const dateStr = String(d).includes('T') ? d.split('T')[0] : d.split(' ')[0];
  if (!dateStr || dateStr.length < 8) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateShort = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
const fmtDateRange = (s, e) => {
  if (!s) return '—';
  if (s === e) return fmtDate(s);
  return `${fmtDateShort(s)} → ${fmtDate(e)}`;
};

const MODALITY_LABEL = { presentiel: 'Présentiel', distanciel: 'Distanciel', hybride: 'Hybride' };
const MODALITY_COLOR = { presentiel: 'var(--success)', distanciel: 'var(--info)', hybride: 'var(--pillar-prod)' };
const STATUS_COLOR = {
  planned: 'var(--gold-deep)', ongoing: 'var(--info)', completed: 'var(--success)', cancelled: 'var(--danger)',
  active: 'var(--success)', draft: 'var(--text-3)', archived: 'var(--text-3)',
  inscrit: 'var(--text-3)', confirme: 'var(--success)', annule: 'var(--danger)', liste_attente: 'var(--gold-deep)',
};
const STATUS_LABEL = {
  planned: 'Planifiée', ongoing: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
  active: 'Active', draft: 'Brouillon', archived: 'Archivée',
  inscrit: 'Inscrit', confirme: 'Confirmé', annule: 'Annulé', liste_attente: 'Liste d\'attente',
};
const FINANCEMENT_COLOR = { CPF: 'var(--info)', OPCO: 'var(--pillar-prod)', auto: 'var(--gold-deep)', autre: 'var(--text-3)' };

const FORMATION_CATEGORIES = [
  { value: '', label: 'Non catégorisée' },
  { value: 'realisation', label: 'Réalisation' },
  { value: 'narration', label: 'Narration & Écriture' },
  { value: 'production', label: 'Production' },
  { value: 'postprod', label: 'Post-production' },
  { value: 'son', label: 'Son & Musique' },
  { value: 'culture', label: 'Culture & Patrimoine' },
  { value: 'entrepreneuriat', label: 'Entrepreneuriat créatif' },
  { value: 'numerique', label: 'Numérique & IA' },
];
const CATEGORIE_COLOR = {
  realisation: 'var(--warning)', narration: 'var(--pillar-prod)', production: 'var(--info)',
  postprod: 'var(--success)', son: 'var(--danger)', culture: 'var(--gold-deep)',
  entrepreneuriat: '#1ABC9C', numerique: 'var(--pillar-studio)',
};

const TYPE_FORMATION = [
  { value: 'standard', label: 'Standard', color: 'var(--info)', icon: '📐', sub: 'Programme InDesign' },
  { value: 'personnalise', label: 'Personnalisé', color: 'var(--warning)', icon: '✏️', sub: 'Programme généré' },
];
const TYPE_FORMATION_COLOR = { standard: 'var(--info)', personnalise: 'var(--warning)' };

const FINANCEMENT_OPTIONS = [
  { value: 'CPF', label: 'CPF', color: 'var(--info)' },
  { value: 'OPCO', label: 'OPCO', color: 'var(--pillar-prod)' },
  { value: 'FAF', label: 'FAF', color: 'var(--warning)' },
  { value: 'Pôle Emploi', label: 'Pôle Emploi', color: 'var(--success)' },
  { value: 'auto', label: 'Auto-financement', color: 'var(--gold-deep)' },
  { value: 'entreprise', label: 'Plan entreprise', color: '#1ABC9C' },
];

// Pont vers le toast du kit UI (branché par <ApiToastBridge /> dans FormationsPage)
let apiToast = null;

const safeParse = async (r) => {
  if (!r.ok) {
    console.error(`API ${r.status}: ${r.url}`);
    let msg = `Erreur ${r.status}`;
    try { const j = JSON.parse(await r.text()); if (j && j.error) msg = j.error; } catch {}
    if (apiToast) apiToast.error(msg);
    const failed = [];
    failed.__failed = true;
    return failed;
  }
  const text = await r.text();
  try { return JSON.parse(text); } catch { console.error('Bad JSON from', r.url, text.slice(0, 200)); return []; }
};
const netFail = (url) => (e) => {
  console.warn('API réseau KO :', url, e);
  if (apiToast) apiToast.error('Erreur réseau — action non enregistrée');
  const failed = [];
  failed.__failed = true;
  return failed;
};
const api = {
  get: (url) => fetch(url).then(safeParse).catch(netFail(url)),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(safeParse).catch(netFail(url)),
  patch: (url, body) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(safeParse).catch(netFail(url)),
  del: (url) => fetch(url, { method: 'DELETE' }).then(safeParse).catch(netFail(url)),
};

// ─── Design tokens — branchés sur src/styles/tokens.css (thèmes ENCRE/PAPIER)

const T = {
  bg: 'var(--bg)',            // fond de page
  header: 'var(--inverse)',   // bloc contrasté (ex-header sombre)
  card: 'var(--surface)',     // cards / panels
  cardHover: 'var(--surface-2)',
  border: 'var(--border)',
  border2: 'var(--border-2)',
  border3: 'var(--border-2)',
  gold: 'var(--gold-deep)',   // accent principal (or lisible sur les 2 thèmes)
  goldDim: 'var(--gold-soft)',
  text: 'var(--text)',
  textSub: 'var(--text-2)',
  textMuted: 'var(--text-3)',
  textDim: 'var(--text-3)',
  input: 'var(--surface)',
  danger: 'var(--danger)',
  green: 'var(--success)',
  blue: 'var(--info)',
  purple: 'var(--pillar-prod)',
  font: "'Geist Sans', 'DM Sans', sans-serif",
  fontDisplay: "'Anton', 'Bebas Neue', system-ui, sans-serif",
  mono: "'Geist Mono', 'Space Mono', monospace",
};

// Dérive une couleur translucide depuis un token/var CSS ou un hex
// (remplace l'ancienne concaténation hex + alpha, ex. alpha(color, 13))
const alpha = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// ─── Components ─────────────────────────────────────────────────────────────

function Badge({ status, label }) {
  const color = STATUS_COLOR[status] || T.textMuted;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 4,
      background: alpha(color, 13), color: color, border: `1px solid ${alpha(color, 27)}`,
      fontFamily: T.font,
    }}>
      {label || STATUS_LABEL[status] || status}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || T.gold, letterSpacing: '-0.02em', fontFamily: T.mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}>
      <div className="resp-modal" style={{ background: 'var(--surface)', border: `1px solid ${T.border}`, borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', background: 'var(--surface)', border: `1px solid ${T.border}`,
  borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font, outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle = {
  width: '100%', padding: '9px 12px', background: 'var(--surface)', border: `1px solid ${T.border}`,
  borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font, outline: 'none',
  boxSizing: 'border-box', cursor: 'pointer',
};

const textareaStyle = {
  ...inputStyle, resize: 'none', minHeight: 72,
};

const btnPrimary = {
  padding: '9px 18px', background: T.gold, color: 'var(--gold-ink)', border: 'none',
  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
};

const btnSecondary = {
  padding: '9px 18px', background: 'transparent', color: T.textSub, border: `1px solid ${T.border3}`,
  borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: T.font,
};

// ─── Formation Form ──────────────────────────────────────────────────────────

function FormSectionTitle({ title, sub, indicator }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border3}`, paddingTop: 14, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{title}</div>
        {indicator && <span style={{ fontSize: 9, color: T.gold, background: T.goldDim, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{indicator}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FormationForm({ initial = {}, onSave, onClose, catOptions }) {
  const catOptionsList = catOptions || FORMATION_CATEGORIES;
  const parseJSON = (val, fallback = []) => { try { return Array.isArray(val) ? val : JSON.parse(val || JSON.stringify(fallback)); } catch { return fallback; } };

  const [form, setForm] = useState({
    // ── Identité ──
    title: initial.title || '',
    description: initial.description || '',
    categorie: initial.categorie || '',
    thematique: initial.thematique || '',
    format_label: initial.format_label || '',
    status: initial.status || 'active',
    type_formation: initial.type_formation || 'standard',
    // ── Durée & tarification ──
    duration_hours: initial.duration_hours || '',
    duration_days: initial.duration_days || '',
    modality: initial.modality || 'presentiel',
    level: initial.level || '',
    price_ht: initial.price_ht || '',
    max_participants: initial.max_participants || 12,
    // ── Financement ──
    financement_eligible: parseJSON(initial.financement_eligible, []),
    certification: initial.certification || 'Aucune',
    // ── Public & prérequis (Ind. 1, 3) ──
    target_audience: initial.target_audience || '',
    prerequisites: initial.prerequisites || '',
    delais_acces: initial.delais_acces || '',
    accessibility: initial.accessibility || '',
    // ── Contenu pédagogique (Ind. 1, 3, 4) ──
    objectives: parseJSON(initial.objectives, []).join('\n'),
    probleme_resolu: initial.probleme_resolu || '',
    livrables_cles: initial.livrables_cles || '',
    // ── Méthodes & moyens (Ind. 4) ──
    modalites_pedagogiques: initial.modalites_pedagogiques || '',
    moyens_materiels: initial.moyens_materiels || '',
    evaluation_methods: parseJSON(initial.evaluation_methods, []).join('\n'),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFinancement = (val) => setForm(f => ({
    ...f,
    financement_eligible: f.financement_eligible.includes(val)
      ? f.financement_eligible.filter(x => x !== val)
      : [...f.financement_eligible, val],
  }));

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      objectives: form.objectives.split('\n').map(s => s.trim()).filter(Boolean),
      evaluation_methods: form.evaluation_methods.split('\n').map(s => s.trim()).filter(Boolean),
    };
    await onSave(data);
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ═══ IDENTITÉ ═══ */}
      <FormSectionTitle title="Identité" sub="Informations de base du programme" />
      <Field label="Titre *">
        <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre de la formation" />
      </Field>
      <Field label="Description">
        <textarea style={textareaStyle} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Présentation générale de la formation…" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Catégorie">
          <select style={selectStyle} value={form.categorie} onChange={e => set('categorie', e.target.value)}>
            {catOptionsList.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Thématique">
          <input style={inputStyle} value={form.thematique} onChange={e => set('thematique', e.target.value)} placeholder="ex : Cinéma documentaire" />
        </Field>
        <Field label="Format">
          <input style={inputStyle} value={form.format_label} onChange={e => set('format_label', e.target.value)} placeholder="ex : Masterclass 2j, Bootcamp 5j…" />
        </Field>
        <Field label="Statut">
          <select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="draft">Brouillon</option>
            <option value="archived">Archivée</option>
          </select>
        </Field>
      </div>

      {/* ═══ TYPE DE FORMATION ═══ */}
      <Field label="Type de formation">
        <div style={{ display: 'flex', gap: 8 }}>
          {TYPE_FORMATION.map(t => {
            const active = form.type_formation === t.value;
            return (
              <div key={t.value} onClick={() => set('type_formation', t.value)} style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${active ? t.color : T.border2}`,
                background: active ? alpha(t.color, 8) : 'transparent',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: active ? t.color : T.textSub }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: 10, color: active ? alpha(t.color, 80) : T.textDim, marginTop: 2 }}>{t.sub}</div>
              </div>
            );
          })}
        </div>
      </Field>

      {/* ═══ DURÉE & TARIFICATION ═══ */}
      <FormSectionTitle title="Durée & Tarification" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Durée (heures)">
          <input style={inputStyle} type="number" value={form.duration_hours} onChange={e => set('duration_hours', e.target.value)} placeholder="ex : 14" />
        </Field>
        <Field label="Durée (jours)">
          <input style={inputStyle} type="number" step="0.5" value={form.duration_days} onChange={e => set('duration_days', e.target.value)} placeholder="ex : 2" />
        </Field>
        <Field label="Modalité">
          <select style={selectStyle} value={form.modality} onChange={e => set('modality', e.target.value)}>
            <option value="presentiel">Présentiel</option>
            <option value="distanciel">Distanciel</option>
            <option value="hybride">Hybride</option>
          </select>
        </Field>
        <Field label="Niveau">
          <select style={selectStyle} value={form.level} onChange={e => set('level', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </Field>
        <Field label="Tarif HT (€)">
          <input style={inputStyle} type="number" value={form.price_ht} onChange={e => set('price_ht', e.target.value)} placeholder="ex : 800" />
        </Field>
        <Field label="Participants max">
          <input style={inputStyle} type="number" value={form.max_participants} onChange={e => set('max_participants', e.target.value)} />
        </Field>
      </div>

      {/* ═══ FINANCEMENT & CERTIFICATION ═══ */}
      <FormSectionTitle title="Financement & Certification" indicator="Ind. 1" />
      <Field label="Financements éligibles">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FINANCEMENT_OPTIONS.map(opt => {
            const active = form.financement_eligible.includes(opt.value);
            return (
              <span key={opt.value} onClick={() => toggleFinancement(opt.value)} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? opt.color : T.border2}`,
                background: active ? alpha(opt.color, 13) : 'transparent',
                color: active ? opt.color : T.textSub, transition: 'all 0.15s',
              }}>{opt.label}</span>
            );
          })}
        </div>
      </Field>
      <Field label="Certification">
        <select style={selectStyle} value={form.certification} onChange={e => set('certification', e.target.value)}>
          <option value="Aucune">Aucune</option>
          <option value="RS">Répertoire Spécifique (RS)</option>
          <option value="RNCP">RNCP</option>
          <option value="Attestation">Attestation de compétences</option>
          <option value="Certificat">Certificat de réalisation</option>
        </select>
      </Field>

      {/* ═══ PUBLIC & PRÉREQUIS (Ind. 1, 3) ═══ */}
      <FormSectionTitle title="Public & Prérequis" sub="Qui peut s'inscrire et comment" indicator="Ind. 1, 3" />
      <Field label="Public cible">
        <textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.target_audience} onChange={e => set('target_audience', e.target.value)} placeholder="Créateurs de contenus, réalisateurs, artistes, entrepreneurs culturels…" />
      </Field>
      <Field label="Prérequis">
        <textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.prerequisites} onChange={e => set('prerequisites', e.target.value)} placeholder="Aucun prérequis / Expérience en montage vidéo recommandée…" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Délais d'accès">
          <input style={inputStyle} value={form.delais_acces} onChange={e => set('delais_acces', e.target.value)} placeholder="ex : 15 jours avant le début de la session" />
        </Field>
        <Field label="Accessibilité handicap">
          <input style={inputStyle} value={form.accessibility} onChange={e => set('accessibility', e.target.value)} placeholder="Contactez-nous pour adapter la formation" />
        </Field>
      </div>

      {/* ═══ CONTENU PÉDAGOGIQUE (Ind. 1, 3, 4) ═══ */}
      <FormSectionTitle title="Contenu pédagogique" sub="Objectifs, compétences visées, livrables" indicator="Ind. 1, 3, 4" />
      <Field label="Objectifs pédagogiques (un par ligne)">
        <textarea style={{ ...textareaStyle, minHeight: 80 }} value={form.objectives} onChange={e => set('objectives', e.target.value)} placeholder={"Maîtriser les fondamentaux du storytelling visuel\nSavoir structurer un récit documentaire\nRéaliser un court-métrage de A à Z"} />
      </Field>
      <Field label="Problème résolu">
        <textarea style={{ ...textareaStyle, minHeight: 48 }} value={form.probleme_resolu} onChange={e => set('probleme_resolu', e.target.value)} placeholder="Quel problème concret cette formation résout pour le stagiaire ?" />
      </Field>
      <Field label="Livrables clés">
        <textarea style={{ ...textareaStyle, minHeight: 48 }} value={form.livrables_cles} onChange={e => set('livrables_cles', e.target.value)} placeholder="ex : Un court-métrage monté, un portfolio de rushes étalonnés…" />
      </Field>

      {/* ═══ MÉTHODES & MOYENS (Ind. 4) ═══ */}
      <FormSectionTitle title="Méthodes & Moyens" sub="Comment la formation est dispensée" indicator="Ind. 4" />
      <Field label="Modalités pédagogiques">
        <textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.modalites_pedagogiques} onChange={e => set('modalites_pedagogiques', e.target.value)} placeholder="Alternance théorie/pratique, études de cas, ateliers créatifs, travail en binôme…" />
      </Field>
      <Field label="Moyens matériels & techniques">
        <textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.moyens_materiels} onChange={e => set('moyens_materiels', e.target.value)} placeholder="Salle équipée vidéoprojecteur, postes DaVinci Resolve, caméras fournies…" />
      </Field>
      <Field label="Méthodes d'évaluation (une par ligne)">
        <textarea style={{ ...textareaStyle, minHeight: 64 }} value={form.evaluation_methods} onChange={e => set('evaluation_methods', e.target.value)} placeholder={"Questionnaire de positionnement en amont\nÉvaluation pratique en cours de formation\nQuestionnaire de satisfaction à chaud"} />
      </Field>
      <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${T.border3}`, marginTop: 4 }}>
        <button style={btnPrimary} disabled={saving || !form.title} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button style={btnSecondary} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

// ─── Session Form ─────────────────────────────────────────────────────────

function SessionForm({ formations, clients = [], initial = {}, onSave, onClose }) {
  const parsePlanning = (raw) => {
    try { const p = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []); return Array.isArray(p) ? p : []; }
    catch { return []; }
  };
  const [form, setForm] = useState({
    formation_id: initial.formation_id || (formations[0]?.id || ''),
    start_date: initial.start_date || '',
    end_date: initial.end_date || '',
    location: initial.location || '',
    adresse: initial.adresse || '',
    modality: initial.modality || 'presentiel',
    max_participants: initial.max_participants || 12,
    formateur_name: initial.formateur_name || '',
    status: initial.status || 'planned',
    type_session: initial.type_session || 'INTER',
    tarif: initial.tarif || 0,
    horaire: initial.horaire || '',
    notes: initial.notes || '',
    planning: parsePlanning(initial.planning),
    client_id: initial.client_id || '',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Planning helpers ──
  const addPlanningDay = () => {
    const pl = [...form.planning];
    // Default: day after last entry, or start_date
    let nextDate = form.start_date || '';
    if (pl.length > 0 && pl[pl.length - 1].date) {
      const d = new Date(pl[pl.length - 1].date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }
    pl.push({ date: nextDate, matin: '9h00-12h30', aprem: '13h30-17h00' });
    set('planning', pl);
  };

  const updatePlanningDay = (idx, field, val) => {
    const pl = [...form.planning];
    pl[idx] = { ...pl[idx], [field]: val };
    set('planning', pl);
  };

  const removePlanningDay = (idx) => {
    set('planning', form.planning.filter((_, i) => i !== idx));
  };

  // Auto-generate planning from date range
  const autoGenPlanning = () => {
    if (!form.start_date || !form.end_date) return;
    const days = [];
    const start = new Date(form.start_date + 'T00:00:00');
    const end = new Date(form.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      days.push({ date: d.toISOString().split('T')[0], matin: '9h00-12h30', aprem: '13h30-17h00' });
    }
    set('planning', days);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, planning: form.planning };
    // Auto-set start/end from planning if planning has entries
    if (form.planning.length > 0) {
      const dates = form.planning.map(p => p.date).filter(Boolean).sort();
      if (dates.length > 0) {
        data.start_date = data.start_date || dates[0];
        data.end_date = data.end_date || dates[dates.length - 1];
      }
    }
    await onSave(data);
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Formation *">
        <select style={selectStyle} value={form.formation_id} onChange={e => set('formation_id', e.target.value)}>
          {formations.map(f => <option key={f.id} value={f.id}>{f.code} — {f.title}</option>)}
        </select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Type">
          <select style={selectStyle} value={form.type_session} onChange={e => set('type_session', e.target.value)}>
            <option value="INTER">INTER — Inscription individuelle</option>
            <option value="INTRA">INTRA — Entreprise / groupe</option>
          </select>
        </Field>
        <Field label="Tarif HT (€)">
          <input style={inputStyle} type="number" step="0.01" value={form.tarif} onChange={e => set('tarif', parseFloat(e.target.value) || 0)}
            placeholder={form.type_session === 'INTRA' ? 'Prix groupe' : 'Prix par personne'} />
        </Field>
      </div>

      {/* Client selector for INTRA */}
      {form.type_session === 'INTRA' && (
        <Field label="Client / Entreprise">
          <div style={{ position: 'relative' }}>
            <input style={inputStyle} placeholder="Rechercher un client…" value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              onFocus={() => setClientSearch(clientSearch || '')} />
            {clientSearch !== '' && (() => {
              const q = clientSearch.toLowerCase();
              const filtered = clients.filter(c =>
                (c.company || '').toLowerCase().includes(q) ||
                (c.first_name || '').toLowerCase().includes(q) ||
                (c.last_name || '').toLowerCase().includes(q) ||
                (c.siret || '').includes(q)
              ).slice(0, 6);
              if (filtered.length === 0) return null;
              return (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface-2)', border: `1px solid ${T.border3}`, borderRadius: 6, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                  {filtered.map(c => (
                    <div key={c.id} onClick={() => {
                      set('client_id', c.id);
                      setClientSearch(c.company || `${c.first_name} ${c.last_name}`);
                      // Auto-fill address from client
                      if (c.address) set('adresse', `${c.address}${c.postal_code ? `, ${c.postal_code}` : ''}${c.city ? ` ${c.city}` : ''}`);
                    }} style={{
                      padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`,
                      fontSize: 12, color: T.text,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.goldDim}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 600 }}>{c.company || `${c.first_name} ${c.last_name}`}</div>
                      {c.siret && <div style={{ fontSize: 10, color: T.textDim }}>SIRET: {c.siret}</div>}
                      {c.city && <div style={{ fontSize: 10, color: T.textDim }}>{c.city}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          {form.client_id && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>Client lié</span>
              <button type="button" onClick={() => { set('client_id', ''); setClientSearch(''); }} style={{
                fontSize: 10, color: T.danger, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline',
              }}>Retirer</button>
            </div>
          )}
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date de début *">
          <input style={inputStyle} type="date" value={form.start_date} onChange={e => {
            set('start_date', e.target.value);
            if (!form.end_date) set('end_date', e.target.value);
          }} />
        </Field>
        <Field label="Date de fin *">
          <input style={inputStyle} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </Field>
        <Field label="Modalité">
          <select style={selectStyle} value={form.modality} onChange={e => set('modality', e.target.value)}>
            <option value="presentiel">Présentiel</option>
            <option value="distanciel">Distanciel</option>
            <option value="hybride">Hybride</option>
          </select>
        </Field>
        <Field label="Participants max">
          <input style={inputStyle} type="number" value={form.max_participants} onChange={e => set('max_participants', e.target.value)} />
        </Field>
      </div>

      <Field label="Lieu / Adresse">
        <input style={inputStyle} value={form.adresse || form.location} onChange={e => { set('adresse', e.target.value); set('location', e.target.value); }} placeholder="29 rue des Récollets - 75010 Paris" />
      </Field>
      <Field label="Formateur·trice">
        <input style={inputStyle} value={form.formateur_name} onChange={e => set('formateur_name', e.target.value)} placeholder="Nom du formateur" />
      </Field>

      {/* ── Planning jour par jour ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Planning — Jours & Horaires</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {form.start_date && form.end_date && (
              <button type="button" onClick={autoGenPlanning} style={{
                padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: T.goldDim, border: `1px solid ${alpha(T.gold, 27)}`, color: T.gold,
              }}>Auto-générer (jours ouvrés)</button>
            )}
            <button type="button" onClick={addPlanningDay} style={{
              padding: '3px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${T.border3}`, color: T.textSub,
            }}>+ Ajouter un jour</button>
          </div>
        </div>

        {form.planning.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: T.textDim, fontSize: 11, border: `1px dashed ${T.border2}`, borderRadius: 8 }}>
            Aucun jour planifié — utilisez les boutons ci-dessus
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.planning.map((day, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                <input type="date" value={day.date} onChange={e => updatePlanningDay(idx, 'date', e.target.value)}
                  style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }} />
                <input value={day.matin} onChange={e => updatePlanningDay(idx, 'matin', e.target.value)}
                  placeholder="9h00-12h30" style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }} />
                <input value={day.aprem} onChange={e => updatePlanningDay(idx, 'aprem', e.target.value)}
                  placeholder="13h30-17h00" style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }} />
                <button type="button" onClick={() => removePlanningDay(idx)} style={{
                  width: 28, height: 28, borderRadius: 5, border: `1px solid ${T.border2}`, background: 'transparent',
                  color: T.danger, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>×</button>
              </div>
            ))}
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
              {form.planning.length} jour{form.planning.length > 1 ? 's' : ''} planifié{form.planning.length > 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      <Field label="Statut">
        <select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="planned">Planifiée</option>
          <option value="ongoing">En cours</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
      </Field>
      <Field label="Notes">
        <textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button style={btnPrimary} disabled={saving || !form.formation_id || !form.start_date} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button style={btnSecondary} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

// ─── Apprenant Form ───────────────────────────────────────────────────────

function ApprenantForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || '', last_name: initial.last_name || '',
    email: initial.email || '', phone: initial.phone || '',
    company: initial.company || '', city: initial.city || '',
    address: initial.address || '', postal_code: initial.postal_code || '',
    financement: initial.financement || '', notes: initial.notes || '',
    date_naissance: initial.date_naissance || '', situation_pro: initial.situation_pro || '',
    statut_juridique: initial.statut_juridique || '',
    handicap: initial.handicap || 0, precision_handicap: initial.precision_handicap || '',
    experience: initial.experience || 0, niveau_exp: initial.niveau_exp || '',
    motivation: initial.motivation || '', modalite_paiement: initial.modalite_paiement || '',
    etat: initial.etat || 'new', orga_opco: initial.orga_opco || '', faf: initial.faf || '',
    statut_financement: initial.statut_financement || 'not_started',
    financement_entreprise: initial.financement_entreprise || 0,
    // Champs Digiforma
    civilite: initial.civilite || '', nationalite: initial.nationalite || 'Française',
    lieu_naissance_ville: initial.lieu_naissance_ville || '', lieu_naissance_dept: initial.lieu_naissance_dept || '',
    lieu_naissance_cp: initial.lieu_naissance_cp || '', num_secu: initial.num_secu || '',
    langue: initial.langue || 'Français', code_interne: initial.code_interne || '',
    siret: initial.siret || '', entreprise_adresse: initial.entreprise_adresse || '',
    entreprise_cp: initial.entreprise_cp || '', entreprise_ville: initial.entreprise_ville || '',
    entreprise_tel: initial.entreprise_tel || '', email_referent: initial.email_referent || '',
    nom_referent: initial.nom_referent || '', dossier_url: initial.dossier_url || '',
    lien_calendly: initial.lien_calendly || '',
    date_positionnement: initial.date_positionnement || '', date_envoi_doc: initial.date_envoi_doc || '',
    date_inscription: initial.date_inscription || '',
    connu_comment: (() => { try { return JSON.parse(initial.connu_comment || '[]'); } catch { return []; } })(),
    reseaux: (() => { try { return JSON.parse(initial.reseaux || '[]'); } catch { return []; } })(),
  });
  const [saving, setSaving] = useState(false);
  const [formTab, setFormTab] = useState('identite');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (k, val) => setForm(f => {
    const arr = f[k] || [];
    return { ...f, [k]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
  });

  const TABS = [
    { k: 'identite', l: 'Identité' }, { k: 'pro', l: 'Situation pro' },
    { k: 'financement', l: 'Financement' }, { k: 'pipeline', l: 'Pipeline' },
  ];
  const chipStyle = (active) => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? T.gold : T.border2}`,
    background: active ? T.goldDim : 'transparent', color: active ? T.gold : T.textSub,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setFormTab(t.k)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: formTab === t.k ? T.goldDim : 'transparent', color: formTab === t.k ? T.gold : T.textSub,
          }}>{t.l}</button>
        ))}
      </div>

      {/* Tab: Identité */}
      {formTab === 'identite' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12 }}>
          <Field label="Civilité">
            <select style={selectStyle} value={form.civilite} onChange={e => set('civilite', e.target.value)}>
              <option value="">—</option><option value="M.">M.</option><option value="Mme">Mme</option>
            </select>
          </Field>
          <Field label="Prénom *"><input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
          <Field label="Nom *"><input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Téléphone"><input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Code interne"><input style={inputStyle} value={form.code_interne} onChange={e => set('code_interne', e.target.value)} placeholder="ex : AF26001" /></Field>
          <Field label="Date de naissance"><input style={inputStyle} type="date" value={form.date_naissance} onChange={e => set('date_naissance', e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nationalité"><input style={inputStyle} value={form.nationalite} onChange={e => set('nationalite', e.target.value)} /></Field>
          <Field label="Langue"><input style={inputStyle} value={form.langue} onChange={e => set('langue', e.target.value)} /></Field>
        </div>
        <FormSectionTitle title="Lieu de naissance" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 12 }}>
          <Field label="Ville"><input style={inputStyle} value={form.lieu_naissance_ville} onChange={e => set('lieu_naissance_ville', e.target.value)} /></Field>
          <Field label="Dépt"><input style={inputStyle} value={form.lieu_naissance_dept} onChange={e => set('lieu_naissance_dept', e.target.value)} /></Field>
          <Field label="CP"><input style={inputStyle} value={form.lieu_naissance_cp} onChange={e => set('lieu_naissance_cp', e.target.value)} /></Field>
        </div>
        <Field label="N° sécurité sociale"><input style={inputStyle} value={form.num_secu} onChange={e => set('num_secu', e.target.value)} placeholder="1 XX XX XX XXX XXX XX" /></Field>
        <FormSectionTitle title="Coordonnées" />
        <Field label="Adresse"><input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
          <Field label="CP"><input style={inputStyle} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} /></Field>
          <Field label="Ville"><input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} /></Field>
        </div>
        <Field label="Handicap / situation spécifique">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.handicap} onChange={e => set('handicap', e.target.checked ? 1 : 0)} /> Oui
            </label>
            {!!form.handicap && <input style={{ ...inputStyle, flex: 1 }} placeholder="Préciser…" value={form.precision_handicap} onChange={e => set('precision_handicap', e.target.value)} />}
          </div>
        </Field>
        <Field label="Connu comment ?">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Réseaux sociaux', 'Bouche-à-oreille', 'Site internet', 'Je connais Moos', 'Autre'].map(v => (
              <span key={v} onClick={() => toggleArr('connu_comment', v)} style={chipStyle(form.connu_comment?.includes(v))}>{v}</span>
            ))}
          </div>
        </Field>
        <Field label="Réseaux sociaux">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Instagram', 'Linkedin', 'Youtube', 'Tiktok', 'Facebook', 'Twitter/X'].map(v => (
              <span key={v} onClick={() => toggleArr('reseaux', v)} style={chipStyle(form.reseaux?.includes(v))}>{v}</span>
            ))}
          </div>
        </Field>
        <Field label="Motivation"><textarea style={{ ...textareaStyle, minHeight: 48 }} value={form.motivation} onChange={e => set('motivation', e.target.value)} /></Field>
      </>)}

      {/* Tab: Situation pro */}
      {formTab === 'pro' && (<>
        <Field label="Situation professionnelle">
          <select style={selectStyle} value={form.situation_pro} onChange={e => set('situation_pro', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="salarie">Salarié(e)</option>
            <option value="freelance">Entrepreneur(e) / Freelance</option>
            <option value="recherche_emploi">En recherche d'emploi</option>
            <option value="etudiant">Étudiant(e)</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Statut juridique">
          <select style={selectStyle} value={form.statut_juridique} onChange={e => set('statut_juridique', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="auto-entrepreneur">Auto-entrepreneur</option>
            <option value="SAS">SAS</option>
            <option value="SARL">SARL</option>
            <option value="SASU">SASU</option>
            <option value="EURL">EURL</option>
            <option value="association">Association</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Entreprise"><input style={inputStyle} value={form.company} onChange={e => set('company', e.target.value)} /></Field>
        <Field label="SIRET"><input style={inputStyle} value={form.siret} onChange={e => set('siret', e.target.value)} /></Field>
        <Field label="Adresse entreprise"><input style={inputStyle} value={form.entreprise_adresse} onChange={e => set('entreprise_adresse', e.target.value)} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12 }}>
          <Field label="CP pro"><input style={inputStyle} value={form.entreprise_cp} onChange={e => set('entreprise_cp', e.target.value)} /></Field>
          <Field label="Ville pro"><input style={inputStyle} value={form.entreprise_ville} onChange={e => set('entreprise_ville', e.target.value)} /></Field>
        </div>
        <Field label="Tél. entreprise"><input style={inputStyle} type="tel" value={form.entreprise_tel} onChange={e => set('entreprise_tel', e.target.value)} /></Field>
        <Field label="Niveau d'expérience">
          <select style={selectStyle} value={form.niveau_exp} onChange={e => set('niveau_exp', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="expert">Expert</option>
          </select>
        </Field>
        <Field label="Expérience préalable">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.experience} onChange={e => set('experience', e.target.checked ? 1 : 0)} /> A déjà de l'expérience dans le domaine
          </label>
        </Field>
      </>)}

      {/* Tab: Financement */}
      {formTab === 'financement' && (<>
        <Field label="Mode de financement">
          <select style={selectStyle} value={form.financement} onChange={e => set('financement', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="personnel">Financement personnel</option>
            <option value="CPF">CPF</option>
            <option value="OPCO">OPCO</option>
            <option value="FAF">FAF</option>
            <option value="france_travail">France Travail</option>
            <option value="FIFPL">FIFPL</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Financement par l'entreprise">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSub, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.financement_entreprise} onChange={e => set('financement_entreprise', e.target.checked ? 1 : 0)} /> L'entreprise finance la formation
          </label>
        </Field>
        <Field label="Organisme OPCO">
          <select style={selectStyle} value={form.orga_opco} onChange={e => set('orga_opco', e.target.value)}>
            <option value="">Aucun</option>
            <option value="OPCO EP">OPCO EP</option>
            <option value="AFDAS">AFDAS</option>
            <option value="L'OPCOMMERCE">L'OPCOMMERCE</option>
            <option value="OCAPIAT">OCAPIAT</option>
            <option value="CONSTRUCTYS">CONSTRUCTYS</option>
            <option value="ATLAS">ATLAS</option>
            <option value="AGEFICE">AGEFICE</option>
          </select>
        </Field>
        <Field label="FAF">
          <select style={selectStyle} value={form.faf} onChange={e => set('faf', e.target.value)}>
            <option value="">Aucun</option>
            <option value="FAF-PM">FAF-PM</option>
            <option value="AGEFICE">AGEFICE</option>
            <option value="FIFPL">FIFPL</option>
          </select>
        </Field>
        <Field label="Statut financement">
          <select style={selectStyle} value={form.statut_financement} onChange={e => set('statut_financement', e.target.value)}>
            <option value="not_started">Non démarré</option>
            <option value="in_progress">En cours</option>
            <option value="done">Validé</option>
            <option value="refuse">Refusé</option>
          </select>
        </Field>
        <Field label="Modalité de paiement">
          <select style={selectStyle} value={form.modalite_paiement} onChange={e => set('modalite_paiement', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="comptant">Comptant</option>
            <option value="acompte_30">Acompte de 30%</option>
            <option value="acompte_50">Acompte de 50%</option>
            <option value="x3">Paiement X3 sans frais</option>
            <option value="x4">Paiement X4 sans frais</option>
          </select>
        </Field>
        <Field label="Nom référent (entreprise)"><input style={inputStyle} value={form.nom_referent} onChange={e => set('nom_referent', e.target.value)} /></Field>
        <Field label="Email référent"><input style={inputStyle} type="email" value={form.email_referent} onChange={e => set('email_referent', e.target.value)} /></Field>
      </>)}

      {/* Tab: Pipeline */}
      {formTab === 'pipeline' && (<>
        <Field label="État du dossier">
          <select style={selectStyle} value={form.etat} onChange={e => set('etat', e.target.value)}>
            <option value="new">Nouveau</option>
            <option value="mail_sent">Mail préinscription envoyé</option>
            <option value="positionnement_ok">Positionnement OK</option>
            <option value="doc_genere">Documents générés</option>
            <option value="doc_envoye">Documents envoyés</option>
            <option value="doc_signe">Documents signés</option>
            <option value="termine">Terminé</option>
            <option value="refuse">Refusé</option>
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Date inscription"><input style={inputStyle} type="date" value={form.date_inscription} onChange={e => set('date_inscription', e.target.value)} /></Field>
          <Field label="Date positionnement"><input style={inputStyle} type="date" value={form.date_positionnement} onChange={e => set('date_positionnement', e.target.value)} /></Field>
          <Field label="Date envoi docs"><input style={inputStyle} type="date" value={form.date_envoi_doc} onChange={e => set('date_envoi_doc', e.target.value)} /></Field>
        </div>
        <Field label="Lien Calendly"><input style={inputStyle} type="url" value={form.lien_calendly} onChange={e => set('lien_calendly', e.target.value)} placeholder="https://calendly.com/..." /></Field>
        <Field label="Dossier stagiaire (URL)"><input style={inputStyle} type="url" value={form.dossier_url} onChange={e => set('dossier_url', e.target.value)} placeholder="Lien Dropbox / Drive" /></Field>
        <Field label="Notes"><textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </>)}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button style={btnPrimary} disabled={saving || !form.last_name} onClick={handleSave}>
          {saving ? 'Enregistrement…' : (initial.id ? 'Modifier' : 'Ajouter')}
        </button>
        {onClose && <button style={btnSecondary} onClick={onClose}>Annuler</button>}
      </div>
    </div>
  );
}

/* ─── RESTORED INLINE: Minimal ApprenantsView detail tabs (from original) ─── */
/* The below code was orphaned from ApprenantsView detail; it's now unused since
   the restored webpack-extracted ApprenantsView handles all this. Keeping as reference. */

// REMOVED: orphaned detail tabs code - handled by restored ApprenantsView below

// ────────────────────────────────────────────────────────────────────────────
// NOTE: The following code block (originally lines 914-1121) was part of
// ApprenantsView and was incorrectly merged here. It has been removed.
// The restored ApprenantsView from webpack cache handles this functionality.
// ────────────────────────────────────────────────────────────────────────────



function DetailInfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 11, color: T.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── View: Formateurs ────────────────────────────────────────────────────

function FormateurForm({ initial = {}, onSave, onClose }) {
  const DOMAINES = ['Vidéo', 'Récit & storytelling', 'Stratégie de marque', 'Réseaux sociaux', 'Photo', 'Production audiovisuelle', 'Culture afro-diasporique', 'Personal branding'];
  const [form, setForm] = useState({
    first_name: initial.first_name || '', last_name: initial.last_name || '',
    email: initial.email || '', phone: initial.phone || '',
    biographie: initial.biographie || '', qualifications: initial.qualifications || '',
    domaines: (() => { try { return JSON.parse(initial.domaines || '[]'); } catch { return []; } })(),
    statut_juridique: initial.statut_juridique || '',
    statut_collab: initial.statut_collab || 'actif',
    tarif_jour: initial.tarif_jour || 0,
    date_dernier_dev_pro: initial.date_dernier_dev_pro || '',
    notes: initial.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDomaine = (d) => setForm(f => ({ ...f, domaines: f.domaines.includes(d) ? f.domaines.filter(x => x !== d) : [...f.domaines, d] }));
  const chipStyle = (active) => ({
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? T.gold : T.border2}`,
    background: active ? T.goldDim : 'transparent', color: active ? T.gold : T.textSub,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Prénom"><input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
        <Field label="Nom *"><input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Téléphone"><input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
      </div>
      <Field label="Domaines d'intervention">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DOMAINES.map(d => <span key={d} onClick={() => toggleDomaine(d)} style={chipStyle(form.domaines.includes(d))}>{d}</span>)}
        </div>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Statut juridique">
          <select style={selectStyle} value={form.statut_juridique} onChange={e => set('statut_juridique', e.target.value)}>
            <option value="">Non précisé</option>
            <option value="SASU">SASU</option><option value="SAS">SAS</option>
            <option value="SARL">SARL</option><option value="auto-entrepreneur">Auto-entrepreneur</option>
            <option value="salarie">Salarié</option>
          </select>
        </Field>
        <Field label="Statut collaboration">
          <select style={selectStyle} value={form.statut_collab} onChange={e => set('statut_collab', e.target.value)}>
            <option value="actif">Actif</option><option value="inactif">Inactif</option>
            <option value="discussion">En discussion</option><option value="ponctuel">Ponctuel</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Tarif jour (€)"><input style={inputStyle} type="number" value={form.tarif_jour} onChange={e => set('tarif_jour', Number(e.target.value))} /></Field>
        <Field label="Dernier dev. pro"><input style={inputStyle} type="date" value={form.date_dernier_dev_pro} onChange={e => set('date_dernier_dev_pro', e.target.value)} /></Field>
      </div>
      <Field label="Qualifications / Diplômes"><textarea style={{ ...textareaStyle, minHeight: 48 }} value={form.qualifications} onChange={e => set('qualifications', e.target.value)} /></Field>
      <Field label="Biographie"><textarea style={{ ...textareaStyle, minHeight: 56 }} value={form.biographie} onChange={e => set('biographie', e.target.value)} /></Field>
      <Field label="Notes"><textarea style={{ ...textareaStyle, minHeight: 40 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button style={btnPrimary} disabled={saving || !form.last_name} onClick={async () => {
          setSaving(true); await onSave(form); setSaving(false);
        }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button style={btnSecondary} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

export function FormateursView() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [formateurs, setFormateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get('/api/formateurs');
    setFormateurs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = formateurs.filter(f =>
    `${f.first_name} ${f.last_name} ${f.email} ${f.domaines}`.toLowerCase().includes(search.toLowerCase())
  );

  const COLLAB_MAP = { actif: { l: 'Actif', c: 'var(--success)' }, inactif: { l: 'Inactif', c: 'var(--text-3)' }, discussion: { l: 'En discussion', c: 'var(--gold-deep)' }, ponctuel: { l: 'Ponctuel', c: 'var(--info)' } };

  // Detail view for selected formateur
  if (selected) {
    const collab = COLLAB_MAP[selected.statut_collab] || COLLAB_MAP['actif'];
    let domaines = [];
    try { domaines = JSON.parse(selected.domaines || '[]'); } catch {}
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ marginBottom: 20, background: 'none', border: 'none', color: T.gold, fontSize: 14, cursor: 'pointer', padding: 0 }}>← Retour à la liste</button>
        
        {/* Header */}
        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{selected.first_name} {selected.last_name}</h1>
                <span style={{ fontSize: 10, fontWeight: 700, color: collab.c, background: alpha(collab.c, 9), padding: '4px 10px', borderRadius: 5, border: `1px solid ${alpha(collab.c, 20)}` }}>{collab.l}</span>
              </div>
              
              {/* Contact info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {selected.email && <div style={{ fontSize: 12, color: T.textSub }}>✉ {selected.email}</div>}
                {selected.phone && <div style={{ fontSize: 12, color: T.textSub }}>📞 {selected.phone}</div>}
              </div>

              {/* Domaines */}
              {domaines.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {domaines.map(d => <span key={d} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, background: T.goldDim, color: T.gold, border: `1px solid ${alpha(T.gold, 20)}` }}>{d}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(selected)} style={btnPrimary}>Modifier</button>
              <button onClick={async () => { if (await confirm({ title: 'Supprimer cet intervenant ?', confirmLabel: 'Supprimer' })) { const r = await api.del(`/api/formateurs/${selected.id}`); if (!r?.__failed) toast.success('Intervenant supprimé'); setSelected(null); load(); } }} style={{ ...btnSecondary, color: T.danger }}>Supprimer</button>
            </div>
          </div>
        </div>

        {/* Info sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Qualifications */}
          {selected.qualifications && (
            <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 10, marginTop: 0 }}>Qualifications</h3>
              <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>{selected.qualifications}</div>
            </div>
          )}

          {/* Biographie */}
          {selected.biographie && (
            <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 10, marginTop: 0 }}>Biographie</h3>
              <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>{selected.biographie}</div>
            </div>
          )}

          {/* Tarif & Info */}
          <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 10, marginTop: 0 }}>Informations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.tarif_jour > 0 && <DetailInfoRow label="Tarif jour" value={`${selected.tarif_jour}€`} />}
              <DetailInfoRow label="Statut juridique" value={selected.statut_juridique || '—'} />
              <DetailInfoRow label="Sessions assignées" value={selected.sessions_count || 0} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Table view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Intervenants</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Équipe pédagogique — indicateur 21 Qualiopi</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, width: 220 }} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={btnPrimary} onClick={() => setShowForm(true)}>+ Ajouter</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: T.textMuted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍🏫</div>
          <div style={{ fontSize: 15, color: T.textSub }}>{search ? 'Aucun résultat' : 'Aucun intervenant'}</div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border2}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: `1px solid ${T.border2}` }}>
                {['Prénom', 'Nom', 'Statut', 'Domaines', 'Sessions', 'Tarif', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const collab = COLLAB_MAP[f.statut_collab] || COLLAB_MAP['actif'];
                let domaines = [];
                try { domaines = JSON.parse(f.domaines || '[]'); } catch {}
                return (
                  <tr key={f.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? T.card : 'transparent', cursor: 'pointer' }} onClick={() => setSelected(f)}>
                    <td style={{ padding: '11px 16px', color: T.text }}>{f.first_name}</td>
                    <td style={{ padding: '11px 16px', color: T.text, fontWeight: 600 }}>{f.last_name}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: collab.c, background: alpha(collab.c, 9), padding: '3px 8px', borderRadius: 5, border: `1px solid ${alpha(collab.c, 20)}` }}>{collab.l}</span>
                    </td>
                    <td style={{ padding: '11px 16px', color: T.textSub, fontSize: 12 }}>
                      {domaines.slice(0, 2).map(d => d).join(', ')}{domaines.length > 2 ? '…' : ''}
                    </td>
                    <td style={{ padding: '11px 16px', color: T.textMuted }}>{f.sessions_count || 0}</td>
                    <td style={{ padding: '11px 16px', color: T.textSub }}>{f.tarif_jour > 0 ? `${f.tarif_jour}€/j` : '—'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditing(f)} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${T.border3}`, borderRadius: 6, color: T.textMuted, fontSize: 12, cursor: 'pointer' }}>✏</button>
                        <button onClick={async () => { if (await confirm({ title: 'Supprimer cet intervenant ?', confirmLabel: 'Supprimer' })) { const r = await api.del(`/api/formateurs/${f.id}`); if (!r?.__failed) toast.success('Intervenant supprimé'); load(); } }} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${T.border3}`, borderRadius: 6, color: T.danger, fontSize: 12, cursor: 'pointer' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <Modal title="Nouvel intervenant" onClose={() => setShowForm(false)} width={560}><FormateurForm onSave={async data => { const r = await api.post('/api/formateurs', data); if (!r?.__failed) toast.success('Intervenant créé'); setShowForm(false); load(); }} onClose={() => setShowForm(false)} /></Modal>}
      {editing && <Modal title="Modifier l'intervenant" onClose={() => setEditing(null)} width={560}><FormateurForm initial={editing} onSave={async data => { const r = await api.patch(`/api/formateurs/${editing.id}`, data); if (!r?.__failed) toast.success('Intervenant mis à jour'); setEditing(null); load(); }} onClose={() => setEditing(null)} /></Modal>}
    </div>
  );
}


// ─── View: Lieux de Formation ────────────────────────────────────────────────

export function LieuxFormationView() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [lieux, setLieux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get('/api/lieux-formation');
    setLieux(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = lieux.filter(l =>
    `${l.nom} ${l.ville} ${l.adresse}`.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ marginBottom: 20, background: 'none', border: 'none', color: T.gold, fontSize: 14, cursor: 'pointer', padding: 0 }}>← Retour à la liste</button>
        
        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{selected.nom}</h1>
              <div style={{ fontSize: 12, color: T.textSub }}>{selected.ville} ({selected.postal_code || ''})</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(selected)} style={btnPrimary}>Modifier</button>
              <button onClick={async () => { if (await confirm({ title: 'Supprimer ce lieu ?', confirmLabel: 'Supprimer' })) { const r = await api.del(`/api/lieux-formation/${selected.id}`); if (!r?.__failed) toast.success('Lieu supprimé'); setSelected(null); load(); } }} style={{ ...btnSecondary, color: T.danger }}>Supprimer</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Adresse</h3>
              <div style={{ fontSize: 12, color: T.textSub, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>{selected.adresse}</div>
                <div>{selected.postal_code} {selected.ville}</div>
                <div>{selected.pays || 'France'}</div>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Capacité & Accès</h3>
              <div style={{ fontSize: 12, color: T.textSub, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <DetailInfoRow label="Capacité" value={selected.capacite + ' places'} />
                <DetailInfoRow label="PMR Accessible" value={selected.accessibilite_pmr ? 'Oui' : 'Non'} />
              </div>
            </div>
            {selected.contact_nom && (
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Contact</h3>
                <div style={{ fontSize: 12, color: T.textSub, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>{selected.contact_nom}</div>
                  {selected.contact_email && <div>{selected.contact_email}</div>}
                  {selected.contact_tel && <div>{selected.contact_tel}</div>}
                </div>
              </div>
            )}
            {selected.equipements && (
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Équipements</h3>
                <div style={{ fontSize: 12, color: T.textSub }}>{selected.equipements}</div>
              </div>
            )}
          </div>
          {selected.notes && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 8 }}>Notes</h3>
              <div style={{ fontSize: 12, color: T.textSub }}>{selected.notes}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Table view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lieux de Formation</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Salles et sites de formation</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, width: 220 }} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={btnPrimary} onClick={() => setShowForm(true)}>+ Ajouter</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: T.textMuted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, color: T.textSub }}>{search ? 'Aucun résultat' : 'Aucun lieu'}</div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border2}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: `1px solid ${T.border2}` }}>
                {['Nom', 'Ville', 'Capacité', 'PMR', 'Sessions', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? T.card : 'transparent', cursor: 'pointer' }} onClick={() => setSelected(l)}>
                  <td style={{ padding: '11px 16px', color: T.text, fontWeight: 600 }}>{l.nom}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub }}>{l.ville}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub }}>{l.capacite}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub }}>{l.accessibilite_pmr ? '✓' : '—'}</td>
                  <td style={{ padding: '11px 16px', color: T.textMuted }}>{l.sessions_count || 0}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditing(l)} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${T.border3}`, borderRadius: 6, color: T.textMuted, fontSize: 12, cursor: 'pointer' }}>✏</button>
                      <button onClick={async () => { if (await confirm({ title: 'Supprimer ce lieu ?', confirmLabel: 'Supprimer' })) { const r = await api.del(`/api/lieux-formation/${l.id}`); if (!r?.__failed) toast.success('Lieu supprimé'); load(); } }} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${T.border3}`, borderRadius: 6, color: T.danger, fontSize: 12, cursor: 'pointer' }}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lieu Form Modal */}
      {(showForm || editing) && (
        <Modal title={editing ? 'Modifier le lieu' : 'Nouveau lieu de formation'} onClose={() => { setShowForm(false); setEditing(null); }} width={520}>
          <LieuForm initial={editing || {}} onSave={async (data) => {
            const r = editing ? await api.patch(`/api/lieux-formation/${editing.id}`, data) : await api.post('/api/lieux-formation', data);
            if (!r?.__failed) toast.success(editing ? 'Lieu mis à jour' : 'Lieu créé');
            setShowForm(false); setEditing(null); load();
          }} onClose={() => { setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

function LieuForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    nom: initial.nom || '', adresse: initial.adresse || '',
    postal_code: initial.postal_code || '', ville: initial.ville || '',
    pays: initial.pays || 'France', capacite: initial.capacite || 0,
    accessibilite_pmr: initial.accessibilite_pmr || 0,
    equipements: initial.equipements || '',
    contact_nom: initial.contact_nom || '', contact_email: initial.contact_email || '',
    contact_tel: initial.contact_tel || '', notes: initial.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Nom du lieu *"><input style={inputStyle} value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="ex : Salle Griothèque Montreuil" /></Field>
      <Field label="Adresse"><input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', gap: 12 }}>
        <Field label="CP"><input style={inputStyle} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} /></Field>
        <Field label="Ville"><input style={inputStyle} value={form.ville} onChange={e => set('ville', e.target.value)} /></Field>
        <Field label="Pays"><input style={inputStyle} value={form.pays} onChange={e => set('pays', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Capacité (places)"><input style={inputStyle} type="number" value={form.capacite} onChange={e => set('capacite', Number(e.target.value))} /></Field>
        <Field label="Accessible PMR">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textSub, cursor: 'pointer', padding: '9px 0' }}>
            <input type="checkbox" checked={!!form.accessibilite_pmr} onChange={e => set('accessibilite_pmr', e.target.checked ? 1 : 0)} /> Oui
          </label>
        </Field>
      </div>
      <Field label="Équipements"><textarea style={{ ...textareaStyle, minHeight: 48 }} value={form.equipements} onChange={e => set('equipements', e.target.value)} placeholder="Vidéoprojecteur, écran, wifi…" /></Field>
      <FormSectionTitle title="Contact sur place" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Nom"><input style={inputStyle} value={form.contact_nom} onChange={e => set('contact_nom', e.target.value)} /></Field>
        <Field label="Email"><input style={inputStyle} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
      </div>
      <Field label="Téléphone"><input style={inputStyle} type="tel" value={form.contact_tel} onChange={e => set('contact_tel', e.target.value)} /></Field>
      <Field label="Notes"><textarea style={{ ...textareaStyle, minHeight: 40 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button style={btnPrimary} disabled={saving || !form.nom} onClick={async () => {
          setSaving(true); await onSave(form); setSaving(false);
        }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button style={btnSecondary} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

// ─── View: Entreprises ────────────────────────────────────────────────────────

export function EntreprisesView({ clients = [], sessions = [], onRefresh }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailApprenants, setDetailApprenants] = useState([]);
  const [detailSessions, setDetailSessions] = useState([]);

  // ── SIRET search modal state ──
  const [showSireneModal, setShowSireneModal] = useState(false);
  const [sireneQuery, setSireneQuery] = useState('');
  const [sireneResults, setSireneResults] = useState([]);
  const [sireneLoading, setSireneLoading] = useState(false);
  const [sireneError, setSireneError] = useState('');

  // ── Client creation form state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ company: '', firstName: '', lastName: '', email: '', phone: '', address: '', postalCode: '', city: '', siret: '', tvaNumber: '', notes: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const filtered = clients.filter(c =>
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.siret || '').includes(search)
  );

  // ── SIRET search handler ──
  const searchSirene = useCallback(async () => {
    if (!sireneQuery.trim()) return;
    setSireneLoading(true);
    setSireneError('');
    setSireneResults([]);
    try {
      const params = new URLSearchParams({ q: sireneQuery.trim(), limit: '8' });
      const res = await fetch(`/api/sirene?${params}`);
      const data = await res.json();
      if (data.error) { setSireneError(data.error); return; }
      setSireneResults(data.results || []);
      if ((data.results || []).length === 0) setSireneError('Aucun résultat trouvé');
    } catch (err) {
      setSireneError('Erreur réseau : ' + err.message);
    } finally {
      setSireneLoading(false);
    }
  }, [sireneQuery]);

  // ── Prefill form from SIRET result ──
  const prefillFromSirene = useCallback((result) => {
    const dirigeant = (result.dirigeants || [])[0] || {};
    setCreateForm({
      company: result.nom_complet || '',
      firstName: dirigeant.prenom || '',
      lastName: dirigeant.nom || '',
      email: '',
      phone: '',
      address: result.adresse || '',
      postalCode: result.code_postal || '',
      city: result.commune || '',
      siret: result.siret || result.siren || '',
      tvaNumber: '',
      notes: [
        result.activite ? `Activité : ${result.activite}` : '',
        result.date_creation ? `Créée le ${result.date_creation}` : '',
        result.est_organisme_formation ? 'Organisme de formation' : '',
        result.est_qualiopi ? 'Certifié Qualiopi' : '',
      ].filter(Boolean).join(' — '),
    });
    setShowSireneModal(false);
    setShowCreateForm(true);
  }, []);

  // ── Create client handler ──
  const handleCreateClient = useCallback(async () => {
    if (!createForm.company && !createForm.lastName) return;
    setCreateLoading(true);
    try {
      await api.post('/api/clients', createForm);
      setShowCreateForm(false);
      setCreateForm({ company: '', firstName: '', lastName: '', email: '', phone: '', address: '', postalCode: '', city: '', siret: '', tvaNumber: '', notes: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Erreur création client:', err);
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, onRefresh]);

  const loadClientDetail = useCallback(async (clientId) => {
    const apprenants = await api.get('/api/apprenants');
    const linked = (Array.isArray(apprenants) ? apprenants : []).filter(a => a.client_id === clientId);
    setDetailApprenants(linked);
    const linkedSess = sessions.filter(s => s.client_id === clientId);
    setDetailSessions(linkedSess);
  }, [sessions]);

  // ── SIRET Search Modal ──
  const sireneModal = showSireneModal && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowSireneModal(false)}>
      <div className="resp-modal" style={{ background: T.card, borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recherche SIRET / SIREN</h3>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Base Sirene — données officielles</div>
          </div>
          <button onClick={() => setShowSireneModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.textMuted, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Nom d'entreprise, SIRET ou SIREN…"
              value={sireneQuery}
              onChange={e => setSireneQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchSirene()}
              autoFocus
            />
            <button onClick={searchSirene} disabled={sireneLoading} style={{ ...btnPrimary, opacity: sireneLoading ? 0.6 : 1 }}>
              {sireneLoading ? '…' : 'Rechercher'}
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 24px 20px', overflowY: 'auto', flex: 1 }}>
          {sireneError && <div style={{ color: T.danger || 'var(--danger)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>{sireneError}</div>}
          {sireneResults.map((r, idx) => (
            <div key={idx} onClick={() => prefillFromSirene(r)} style={{
              padding: '14px 16px', marginBottom: 8, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 10,
              cursor: 'pointer', transition: 'border-color 0.15s',
            }} onMouseOver={e => e.currentTarget.style.borderColor = T.gold} onMouseOut={e => e.currentTarget.style.borderColor = T.border2}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.nom_complet}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  color: r.etat === 'Active' ? (T.green || 'var(--success)') : (T.danger || 'var(--danger)'),
                  background: alpha(r.etat === 'Active' ? T.green : T.danger, 9),
                }}>{r.etat}</span>
              </div>
              <div style={{ fontSize: 11, color: T.textSub, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>SIRET : {r.siret || r.siren}</span>
                {r.code_postal && <span>{r.code_postal} {r.commune}</span>}
                {r.activite && <span>{r.activite}</span>}
              </div>
              {(r.est_organisme_formation || r.est_qualiopi) && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  {r.est_organisme_formation && <span style={{ fontSize: 9, fontWeight: 700, background: 'color-mix(in srgb, var(--info) 13%, transparent)', color: 'var(--info)', padding: '2px 6px', borderRadius: 4 }}>OF</span>}
                  {r.est_qualiopi && <span style={{ fontSize: 9, fontWeight: 700, background: 'color-mix(in srgb, var(--success) 13%, transparent)', color: 'var(--success)', padding: '2px 6px', borderRadius: 4 }}>Qualiopi</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Client Creation Form Modal ──
  const createFormModal = showCreateForm && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCreateForm(false)}>
      <div className="resp-modal" style={{ background: T.card, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nouveau client</h3>
          <button onClick={() => setShowCreateForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.textMuted, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Raison sociale *</label>
            <input style={{ ...inputStyle, width: '100%' }} value={createForm.company} onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))} placeholder="Nom de l'entreprise" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prénom</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nom</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email</label>
              <input style={{ ...inputStyle, width: '100%' }} type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Téléphone</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Adresse</label>
            <input style={{ ...inputStyle, width: '100%' }} value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Code postal</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.postalCode} onChange={e => setCreateForm(f => ({ ...f, postalCode: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Ville</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.city} onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>SIRET</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.siret} onChange={e => setCreateForm(f => ({ ...f, siret: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>N° TVA</label>
              <input style={{ ...inputStyle, width: '100%' }} value={createForm.tvaNumber} onChange={e => setCreateForm(f => ({ ...f, tvaNumber: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical' }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button onClick={() => setShowCreateForm(false)} style={btnSecondary}>Annuler</button>
            <button onClick={handleCreateClient} disabled={createLoading || (!createForm.company && !createForm.lastName)} style={{ ...btnPrimary, opacity: createLoading ? 0.6 : 1 }}>
              {createLoading ? 'Création…' : 'Créer le client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Detail view
  if (selected) {
    const companyName = selected.company || selected.first_name + ' ' + selected.last_name;
    const linkedApprenants = detailApprenants.length;
    const linkedSessions = detailSessions.length;
    
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ marginBottom: 20, background: 'none', border: 'none', color: T.gold, fontSize: 14, cursor: 'pointer', padding: 0 }}>← Retour à la liste</button>
        
        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{companyName}</h1>
              {selected.siret && <div style={{ fontSize: 12, color: T.textSub }}>SIRET: {selected.siret}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnPrimary}>Modifier</button>
              <button style={{ ...btnSecondary, color: T.danger }}>Supprimer</button>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: T.gold, marginBottom: 4 }}>{linkedApprenants}</div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Apprenants</div>
            </div>
            <div style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: T.blue, marginBottom: 4 }}>{linkedSessions}</div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Sessions</div>
            </div>
            <div style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: T.green, marginBottom: 4 }}>—</div>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>CA Prév.</div>
            </div>
          </div>

          {/* Contact & Address */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Contact</h3>
              <div style={{ fontSize: 12, color: T.textSub, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.email && <div>{selected.email}</div>}
                {selected.phone && <div>{selected.phone}</div>}
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: 'uppercase', marginBottom: 12 }}>Adresse</h3>
              <div style={{ fontSize: 12, color: T.textSub, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>{selected.first_name || '—'} {selected.last_name || '—'}</div>
                <div>{selected.address || '—'}</div>
                <div>{selected.city || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Table view
  return (
    <div>
      {sireneModal}
      {createFormModal}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Entreprises</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Gestion des clients et structures</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 200 }} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={() => { setSireneQuery(''); setSireneResults([]); setSireneError(''); setShowSireneModal(true); }} style={{ ...btnSecondary, fontSize: 11, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
            🔍 SIRET
          </button>
          <button onClick={() => { setCreateForm({ company: '', firstName: '', lastName: '', email: '', phone: '', address: '', postalCode: '', city: '', siret: '', tvaNumber: '', notes: '' }); setShowCreateForm(true); }} style={{ ...btnPrimary, fontSize: 11, whiteSpace: 'nowrap' }}>
            + Ajouter
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 15, color: T.textSub }}>{search ? 'Aucun résultat' : 'Aucune entreprise'}</div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border2}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: `1px solid ${T.border2}` }}>
                {['Raison sociale', 'Contact', 'SIRET', 'Ville', 'Apprenants', 'Sessions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? T.card : 'transparent', cursor: 'pointer' }} onClick={() => { setSelected(c); loadClientDetail(c.id); }}>
                  <td style={{ padding: '11px 16px', color: T.text, fontWeight: 600 }}>{c.company || c.first_name + ' ' + c.last_name}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub }}>{c.email || '—'}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub, fontSize: 11 }}>{c.siret || '—'}</td>
                  <td style={{ padding: '11px 16px', color: T.textSub }}>{c.city || '—'}</td>
                  <td style={{ padding: '11px 16px', color: T.textMuted }}>{sessions.filter(s => s.client_id === c.id).length || '—'}</td>
                  <td style={{ padding: '11px 16px', color: T.textMuted }}>{sessions.filter(s => s.client_id === c.id).length || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── View: Qualité ────────────────────────────────────────────────────────

export function QualiteView({ formations, sessions }) {
  const completed = sessions.filter(s => s.status === 'completed');
  const totalApprenants = sessions.reduce((s, sess) => s + (sess.inscriptions_count || 0), 0);

  const indicateurs = [
    { code: 'Ind. 1–7',   label: 'Information du public',               status: 'partial', note: 'Programme + tarifs disponibles. Délais d\'accès à documenter.' },
    { code: 'Ind. 8–13',  label: 'Objectifs & adaptation aux publics',   status: 'todo',    note: 'Questionnaire de positionnement à créer.' },
    { code: 'Ind. 14–19', label: 'Accueil, accompagnement, suivi',       status: 'partial', note: 'Émargements tracés. Convocations + attestations à automatiser.' },
    { code: 'Ind. 20–23', label: 'Moyens pédagogiques & techniques',     status: 'todo',    note: 'Fiche moyens techniques à produire.' },
    { code: 'Ind. 24–27', label: 'Qualification des formateurs',         status: 'todo',    note: 'CV + fiches formateurs à constituer.' },
    { code: 'Ind. 28–30', label: 'Environnement professionnel',          status: 'partial', note: 'Ancrage QPV — point fort à valoriser en audit.' },
    { code: 'Ind. 31–32', label: 'Réclamations & satisfaction',          status: 'todo',    note: 'Procédure réclamation + questionnaires satisfaction à créer.' },
  ];

  const statusIcon = { ok: '✅', partial: '⚠️', todo: '❌' };
  const statusLabel = { ok: 'Conforme', partial: 'Partiel', todo: 'À créer' };
  const statusColor = { ok: T.green, partial: 'var(--gold-deep)', todo: T.danger };
  const score = Math.round((indicateurs.filter(i => i.status === 'ok').length / indicateurs.length) * 100);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="Sessions terminées" value={completed.length} sub={`${sessions.length} total`} />
        <StatCard label="Apprenants formés" value={totalApprenants} color={T.blue} />
        <StatCard label="Formations actives" value={formations.filter(f => f.status === 'active').length} color={T.purple} />
        <StatCard label="Conformité" value={`${score}%`} color={score >= 80 ? T.green : score >= 50 ? T.gold : T.danger} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suivi Qualiopi — 7 critères</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Référentiel National Qualité (RNQ)</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {indicateurs.map(ind => (
          <div key={ind.code} style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{statusIcon[ind.status]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: T.gold, fontFamily: T.mono, fontWeight: 700 }}>{ind.code}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{ind.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor[ind.status], background: alpha(statusColor[ind.status], 13), padding: '2px 8px', borderRadius: 4 }}>{statusLabel[ind.status]}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSub }}>{ind.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: '14px 18px', background: T.goldDim, border: `1px solid ${alpha(T.gold, 20)}`, borderRadius: 10, fontSize: 12, color: T.gold }}>
        💡 Les indicateurs "À créer" sont prioritaires avant un audit. Les documents (conventions, attestations, émargements) seront générés automatiquement depuis LES GRIOTS OS — Phase 2.
      </div>
    </div>
  );
}

// ─── View: Catégories (CRUD dynamique) ────────────────────────────────────

const CAT_PALETTE = ['#E67E22','#9B59B6','#3498DB','#27AE60','#E74C3C','#D4A843','#1ABC9C','#2980B9','#E91E63','#FF9800','#607D8B','#795548'];

export function CategoriesView({ categories, onRefresh }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // id of cat being edited
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(CAT_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    await api.post('/api/formation-categories', { label: newLabel.trim(), color: newColor });
    setNewLabel(''); setNewColor(CAT_PALETTE[Math.floor(Math.random() * CAT_PALETTE.length)]);
    onRefresh(); setSaving(false);
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    await api.patch(`/api/formation-categories/${id}`, { label: editLabel, color: editColor });
    setEditing(null); onRefresh(); setSaving(false);
  };

  const handleDelete = async (id, label) => {
    if (!(await confirm({ title: `Supprimer la catégorie "${label}" ?`, message: 'Les formations associées seront décatégorisées.', confirmLabel: 'Supprimer' }))) return;
    await api.del(`/api/formation-categories/${id}`);
    onRefresh();
  };

  const handleToggle = async (id, currentActive) => {
    await api.patch(`/api/formation-categories/${id}`, { active: currentActive ? 0 : 1 });
    onRefresh();
  };

  const startEdit = (cat) => { setEditing(cat.id); setEditLabel(cat.label); setEditColor(cat.color); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Catégories de programmes</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Organisez vos formations par thématique</div>
        </div>
      </div>

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 600 }}>
        {categories.map((cat, idx) => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '12px 16px',
            opacity: cat.active ? 1 : 0.5,
          }}>
            {/* Active toggle */}
            <div onClick={() => handleToggle(cat.id, cat.active)} style={{
              width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
              background: cat.active ? alpha(cat.color, 20) : T.border2,
              border: `2px solid ${cat.active ? cat.color : T.textDim}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: cat.active ? cat.color : 'transparent', fontWeight: 800,
            }}>{cat.active ? '✓' : ''}</div>

            {/* Color swatch */}
            <div style={{
              width: 28, height: 28, borderRadius: 6, background: alpha(cat.color, 20),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, cursor: 'pointer',
            }}>
              <span style={{ color: cat.color }}>✎</span>
            </div>

            {/* Label */}
            {editing === cat.id ? (
              <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdate(cat.id); if (e.key === 'Escape') setEditing(null); }}
                  autoFocus />
                {/* Color picker */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {CAT_PALETTE.map(c => (
                    <div key={c} onClick={() => setEditColor(c)} style={{
                      width: 16, height: 16, borderRadius: 4, background: c, cursor: 'pointer',
                      border: editColor === c ? '2px solid var(--text)' : '2px solid transparent',
                      boxSizing: 'border-box',
                    }} />
                  ))}
                </div>
                <button style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }} onClick={() => handleUpdate(cat.id)} disabled={saving}>OK</button>
                <button style={{ ...btnSecondary, padding: '5px 10px', fontSize: 11 }} onClick={() => setEditing(null)}>✕</button>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: 'pointer' }} onClick={() => startEdit(cat)}>{cat.label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => startEdit(cat)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✎</button>
                  <button onClick={() => handleDelete(cat.id, cat.label)} style={{ background: 'none', border: 'none', color: alpha(T.danger, 53), cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: T.card, border: `1px dashed ${T.border3}`, borderRadius: 10, padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {CAT_PALETTE.slice(0, 6).map(c => (
              <div key={c} onClick={() => setNewColor(c)} style={{
                width: 16, height: 16, borderRadius: 4, background: c, cursor: 'pointer',
                border: newColor === c ? '2px solid var(--text)' : '2px solid transparent',
                boxSizing: 'border-box',
              }} />
            ))}
          </div>
          <input style={{ ...inputStyle, flex: 1 }} value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Nouvelle catégorie…"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
          <button style={{ ...btnPrimary, padding: '7px 16px', fontSize: 12, opacity: newLabel.trim() ? 1 : 0.5 }} onClick={handleCreate} disabled={saving || !newLabel.trim()}>
            + Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View: Tableau (table view like Digiforma) ──────────────────────────────

export function TableauView({ formations, categories, onRefresh }) {
  const [sortKey, setSortKey] = useState('code');
  const [sortDir, setSortDir] = useState('asc');

  const getCatLabel = (id) => { const c = categories.find(c => c.id === id); return c?.label || id || '—'; };
  const getCatColor = (id) => { const c = categories.find(c => c.id === id); return c?.color || T.textMuted; };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...formations].sort((a, b) => {
    let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const cols = [
    { key: 'code', label: 'Code', w: 100 },
    { key: 'title', label: 'Nom du programme', w: 'auto' },
    { key: 'categorie', label: 'Catégorie', w: 140 },
    { key: 'type_formation', label: 'Type', w: 110 },
    { key: 'status', label: 'Statut', w: 90 },
    { key: 'duration_hours', label: 'Durée', w: 70 },
    { key: 'price_ht', label: 'Tarif HT', w: 90 },
    { key: 'modality', label: 'Modalité', w: 100 },
    { key: 'sessions_count', label: 'Sessions', w: 75 },
  ];

  const ThCell = ({ col }) => (
    <th onClick={() => toggleSort(col.key)} style={{
      padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
      color: sortKey === col.key ? T.gold : T.textDim, textTransform: 'uppercase',
      letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
      borderBottom: `1px solid ${T.border2}`, width: col.w === 'auto' ? undefined : col.w,
    }}>
      {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tableau de programmes</h2>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{formations.length} programme{formations.length !== 1 ? 's' : ''} au catalogue</div>
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {cols.map(col => <ThCell key={col.key} col={col} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(f => {
              const cc = getCatColor(f.categorie);
              const tf = TYPE_FORMATION.find(t => t.value === f.type_formation);
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', color: T.gold, fontFamily: T.mono, fontWeight: 700, fontSize: 11 }}>{f.code}</td>
                  <td style={{ padding: '10px 12px', color: T.text, fontWeight: 600 }}>{f.title}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {f.categorie ? <span style={{ fontSize: 10, color: cc, background: alpha(cc, 13), padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{getCatLabel(f.categorie)}</span> : <span style={{ color: T.textDim }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {tf ? <span style={{ fontSize: 10, color: tf.color, fontWeight: 600 }}>{tf.icon} {tf.label}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}><Badge status={f.status} /></td>
                  <td style={{ padding: '10px 12px', color: T.textSub, fontFamily: T.mono }}>{f.duration_hours ? `${f.duration_hours}h` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: T.textSub, fontFamily: T.mono }}>{f.price_ht > 0 ? `${Number(f.price_ht).toLocaleString('fr-FR')} €` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {f.modality ? <span style={{ fontSize: 10, color: MODALITY_COLOR[f.modality] || T.textMuted, fontWeight: 600 }}>{MODALITY_LABEL[f.modality] || f.modality}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.textSub, fontFamily: T.mono, textAlign: 'center' }}>{f.sessions_count || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.textDim, fontSize: 13 }}>Aucune formation dans le catalogue</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export function FormationsView(param) {
    let { formations, sessions, categories = [], onRefresh } = param;
    const confirm = useConfirm();
    const { toast } = useToast();
    // Build dynamic category helpers from DB categories
    const catMap = Object.fromEntries(categories.filter((c)=>c.active).map((c)=>[
            c.id,
            c
        ]));
    const getCatLabel = (id)=>{
        var _catMap_id, _FORMATION_CATEGORIES_find;
        return ((_catMap_id = catMap[id]) === null || _catMap_id === void 0 ? void 0 : _catMap_id.label) || ((_FORMATION_CATEGORIES_find = FORMATION_CATEGORIES.find((c)=>c.value === id)) === null || _FORMATION_CATEGORIES_find === void 0 ? void 0 : _FORMATION_CATEGORIES_find.label) || id;
    };
    const getCatColor = (id)=>{
        var _catMap_id;
        return ((_catMap_id = catMap[id]) === null || _catMap_id === void 0 ? void 0 : _catMap_id.color) || CATEGORIE_COLOR[id] || T.textMuted;
    };
    const allCatOptions = [
        {
            value: '',
            label: 'Non catégorisée'
        },
        ...categories.filter((c)=>c.active).map((c)=>({
                value: c.id,
                label: c.label
            }))
    ];
    const [subTab, setSubTab] = useState('programmes'); // programmes | tableau | categories
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [editSection, setEditSection] = useState(null); // which section is being inline-edited
    const [editData, setEditData] = useState({}); // temp form data for inline edit
    const [saving, setSaving] = useState(false);
    const [filterCat, setFilterCat] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    // Module management hooks (must be at top level, not in IIFE)
    const [mods, setMods] = useState([]);
    const [modsLoading, setModsLoading] = useState(false);
    const [addingModule, setAddingModule] = useState(false);
    const [newModTitle, setNewModTitle] = useState('');
    const [newModDesc, setNewModDesc] = useState('');
    const [newModHours, setNewModHours] = useState('');
    const [newModObjectives, setNewModObjectives] = useState('');
    const [editingModId, setEditingModId] = useState(null);
    const [editModData, setEditModData] = useState({});
    const parseJSON = function(val) {
        let fallback = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
        try {
            return Array.isArray(val) ? val : JSON.parse(val || JSON.stringify(fallback));
        } catch (e) {
            return fallback;
        }
    };
    const handleCreate = async (data)=>{
        const r = await api.post('/api/formations', data);
        if (!r?.__failed) toast.success('Formation créée');
        setShowForm(false);
        onRefresh();
    };
    // Inline section save — only sends changed fields
    const handleInlineSave = async ()=>{
        if (!selected) return;
        setSaving(true);
        const data = {
            ...editData
        };
        // Convert newline-separated fields to arrays
        if ('objectives' in data) data.objectives = data.objectives.split('\n').map((s)=>s.trim()).filter(Boolean);
        if ('evaluation_methods' in data) data.evaluation_methods = data.evaluation_methods.split('\n').map((s)=>s.trim()).filter(Boolean);
        const r = await api.patch("/api/formations/".concat(selected.id), data);
        if (!r?.__failed) toast.success('Formation enregistrée');
        onRefresh();
        const updated = await api.get("/api/formations/".concat(selected.id));
        setSelected(updated);
        setEditSection(null);
        setEditData({});
        setSaving(false);
    };
    const cancelInlineEdit = ()=>{
        setEditSection(null);
        setEditData({});
    };
    // Start editing a section — pre-fill editData with current values for that section's fields
    const startEdit = (sectionKey, fields)=>{
        const d = {};
        for (const f of fields){
            if (f === 'objectives' || f === 'evaluation_methods' || f === 'financement_eligible') {
                const arr = parseJSON(selected[f], []);
                d[f] = f === 'financement_eligible' ? arr : arr.join('\n');
            } else {
                d[f] = selected[f] || '';
            }
        }
        setEditData(d);
        setEditSection(sectionKey);
    };
    const ed = (k, v)=>setEditData((prev)=>({
                ...prev,
                [k]: v
            }));
    const toggleFin = (val)=>setEditData((prev)=>{
            const arr = prev.financement_eligible || [];
            return {
                ...prev,
                financement_eligible: arr.includes(val) ? arr.filter((x)=>x !== val) : [
                    ...arr,
                    val
                ]
            };
        });
    const handleDelete = async (id)=>{
        if (!(await confirm({ title: 'Supprimer cette formation ?', message: 'Les sessions associées seront supprimées.', confirmLabel: 'Supprimer' }))) return;
        const r = await api.del("/api/formations/".concat(id));
        if (!r?.__failed) toast.success('Formation supprimée');
        setSelected(null);
        setEditSection(null);
        onRefresh();
    };
    const active = formations.filter((f)=>f.status === 'active');
    const filtered = formations.filter((f)=>{
        if (filterCat && f.categorie !== filterCat) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (f.title || '').toLowerCase().includes(q) || (f.code || '').toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q);
        }
        return true;
    });
    const usedCategories = [
        ...new Set(formations.map((f)=>f.categorie).filter(Boolean))
    ];
    // Get selected formation enriched (updated from formations list)
    const sel = selected ? formations.find((f)=>f.id === selected.id) || selected : null;
    // Load modules when a formation is selected
    useEffect(() => {
        if (!sel?.id) { setMods([]); return; }
        setModsLoading(true);
        api.get(`/api/modules?formation_id=${sel.id}`).then(data => {
            setMods(Array.isArray(data) ? data : []);
            setModsLoading(false);
        }).catch((e) => { console.warn('[Formations] Modules non chargés :', e); setModsLoading(false); });
    }, [sel?.id]);
    const selSessions = sel ? (sessions || []).filter((s)=>s.formation_id === sel.id) : [];
    const catColor = sel && sel.categorie ? getCatColor(sel.categorie) : null;
    const catLabel = sel && sel.categorie ? getCatLabel(sel.categorie) : null;
    const subTabs = [
        {
            id: 'programmes',
            label: 'Programmes'
        },
        {
            id: 'tableau',
            label: 'Tableau de programmes'
        },
        {
            id: 'categories',
            label: 'Catégories'
        }
    ];
    return /*#__PURE__*/ _jsx("div", {
        children: [
            !sel && /*#__PURE__*/ _jsx("div", {
                style: {
                    display: 'flex',
                    gap: 0,
                    marginBottom: 24,
                    borderBottom: "1px solid ".concat(T.border2)
                },
                children: subTabs.map((st)=>/*#__PURE__*/ _jsx("button", {
                        onClick: ()=>setSubTab(st.id),
                        style: {
                            padding: '10px 22px',
                            border: 'none',
                            borderBottom: "2px solid ".concat(subTab === st.id ? T.gold : 'transparent'),
                            background: 'transparent',
                            color: subTab === st.id ? T.text : T.textMuted,
                            fontSize: 13,
                            fontWeight: subTab === st.id ? 700 : 500,
                            cursor: 'pointer',
                            fontFamily: T.font,
                            transition: 'all 0.15s'
                        },
                        children: st.label
                    }, st.id, false))
            }, void 0, false),
            subTab === 'tableau' && !sel && /*#__PURE__*/ _jsx(TableauView, {
                formations: formations,
                categories: categories,
                onRefresh: onRefresh
            }, void 0, false),
            subTab === 'categories' && !sel && /*#__PURE__*/ _jsx(CategoriesView, {
                categories: categories,
                onRefresh: onRefresh
            }, void 0, false),
            subTab === 'programmes' || sel ? !sel ? /* ═══════ LIST VIEW ═══════ */ /*#__PURE__*/ _jsx(_Fragment, {
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 14,
                            marginBottom: 28
                        },
                        children: [
                            /*#__PURE__*/ _jsx(StatCard, {
                                label: "Formations actives",
                                value: active.length,
                                sub: "".concat(formations.length, " au total")
                            }, void 0, false),
                            /*#__PURE__*/ _jsx(StatCard, {
                                label: "Sessions planifiées",
                                value: formations.reduce((s, f)=>s + (f.sessions_count || 0), 0),
                                color: T.blue
                            }, void 0, false),
                            /*#__PURE__*/ _jsx(StatCard, {
                                label: "Heures catalogue",
                                value: "".concat(formations.reduce((s, f)=>s + (f.duration_hours || 0), 0), "h"),
                                color: T.purple
                            }, void 0, false)
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 14
                        },
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                children: [
                                    /*#__PURE__*/ _jsx("h2", {
                                        style: {
                                            fontSize: 18,
                                            fontWeight: 700,
                                            color: T.text,
                                            margin: 0
                                        },
                                        children: "Bibliothèque de programmes"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            fontSize: 11,
                                            color: T.textMuted,
                                            marginTop: 3
                                        },
                                        children: [
                                            filtered.length,
                                            " programme",
                                            filtered.length !== 1 ? 's' : '',
                                            " · code PR26XXX"
                                        ]
                                    }, void 0, true)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ _jsx("button", {
                                style: btnPrimary,
                                onClick: ()=>setShowForm(true),
                                children: "+ Créer un programme"
                            }, void 0, false)
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 14
                        },
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    position: 'relative',
                                    flex: 1,
                                    maxWidth: 320
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("span", {
                                        style: {
                                            position: 'absolute',
                                            left: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            fontSize: 14,
                                            color: T.textDim,
                                            pointerEvents: 'none'
                                        },
                                        children: "🔍"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("input", {
                                        style: {
                                            ...inputStyle,
                                            paddingLeft: 32,
                                            fontSize: 12
                                        },
                                        value: searchQuery,
                                        onChange: (e)=>setSearchQuery(e.target.value),
                                        placeholder: "Rechercher un programme…"
                                    }, void 0, false)
                                ]
                            }, void 0, true),
                            (searchQuery || filterCat) && /*#__PURE__*/ _jsx("button", {
                                onClick: ()=>{
                                    setSearchQuery('');
                                    setFilterCat('');
                                },
                                style: {
                                    ...btnSecondary,
                                    padding: '7px 14px',
                                    fontSize: 11
                                },
                                children: "✕ Effacer tout"
                            }, void 0, false)
                        ]
                    }, void 0, true),
                    usedCategories.length > 0 && /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            marginBottom: 18
                        },
                        children: [
                            /*#__PURE__*/ _jsx("span", {
                                onClick: ()=>setFilterCat(''),
                                style: {
                                    padding: '4px 12px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: "1px solid ".concat(!filterCat ? T.gold : T.border2),
                                    background: !filterCat ? T.goldDim : 'transparent',
                                    color: !filterCat ? T.gold : T.textSub
                                },
                                children: "Toutes"
                            }, void 0, false),
                            usedCategories.map((cat)=>{
                                const color = getCatColor(cat);
                                const isActive = filterCat === cat;
                                return /*#__PURE__*/ _jsx("span", {
                                    onClick: ()=>setFilterCat(isActive ? '' : cat),
                                    style: {
                                        padding: '4px 12px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: "1px solid ".concat(isActive ? color : T.border2),
                                        background: isActive ? alpha(color, 13) : 'transparent',
                                        color: isActive ? color : T.textSub
                                    },
                                    children: getCatLabel(cat)
                                }, cat, false);
                            })
                        ]
                    }, void 0, true),
                    filtered.length === 0 ? /*#__PURE__*/ _jsx("div", {
                        style: {
                            textAlign: 'center',
                            padding: '60px 0',
                            color: T.textMuted
                        },
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    fontSize: 48,
                                    marginBottom: 12
                                },
                                children: "📚"
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    fontSize: 15,
                                    color: T.textSub,
                                    marginBottom: 6
                                },
                                children: filterCat ? 'Aucune formation dans cette catégorie' : 'Aucune formation'
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    fontSize: 13
                                },
                                children: "Créez votre premier programme de formation"
                            }, void 0, false)
                        ]
                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                        },
                        children: filtered.map((f)=>{
                            const fCatColor = f.categorie ? getCatColor(f.categorie) : null;
                            const fCatLabel = f.categorie ? getCatLabel(f.categorie) : null;
                            let fFinancements = [];
                            try {
                                fFinancements = Array.isArray(f.financement_eligible) ? f.financement_eligible : JSON.parse(f.financement_eligible || '[]');
                            } catch (e) {}
                            return /*#__PURE__*/ _jsx("div", {
                                onClick: ()=>{
                                    setSelected(f);
                                    setEditSection(null);
                                },
                                style: {
                                    background: T.card,
                                    border: "1px solid ".concat(T.border2),
                                    borderRadius: 10,
                                    padding: '18px 20px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.background = T.cardHover;
                                    e.currentTarget.style.borderColor = T.border3;
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.background = T.card;
                                    e.currentTarget.style.borderColor = T.border2;
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            marginBottom: 6,
                                            flexWrap: 'wrap'
                                        },
                                        children: [
                                            /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    fontSize: 11,
                                                    color: T.gold,
                                                    fontFamily: T.mono,
                                                    fontWeight: 700
                                                },
                                                children: f.code
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx(Badge, {
                                                status: f.status
                                            }, void 0, false),
                                            (()=>{
                                                const tf = TYPE_FORMATION.find((t)=>t.value === f.type_formation);
                                                return tf ? /*#__PURE__*/ _jsx("span", {
                                                    style: {
                                                        fontSize: 10,
                                                        color: tf.color,
                                                        background: alpha(tf.color, 9),
                                                        padding: '2px 7px',
                                                        borderRadius: 4,
                                                        fontWeight: 700
                                                    },
                                                    children: [
                                                        tf.icon,
                                                        " ",
                                                        tf.label
                                                    ]
                                                }, void 0, true) : null;
                                            })(),
                                            f.modality && /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    fontSize: 10,
                                                    color: MODALITY_COLOR[f.modality] || T.textMuted,
                                                    background: alpha(MODALITY_COLOR[f.modality] || T.textMuted, 13),
                                                    padding: '2px 7px',
                                                    borderRadius: 4,
                                                    fontWeight: 600
                                                },
                                                children: MODALITY_LABEL[f.modality] || f.modality
                                            }, void 0, false),
                                            fCatColor && fCatLabel && /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    fontSize: 10,
                                                    color: fCatColor,
                                                    background: alpha(fCatColor, 13),
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    fontWeight: 600,
                                                    border: "1px solid ".concat(alpha(fCatColor, 20))
                                                },
                                                children: fCatLabel
                                            }, void 0, false),
                                            fFinancements.map((fin)=>{
                                                const opt = FINANCEMENT_OPTIONS.find((o)=>o.value === fin);
                                                if (!opt) return null;
                                                return /*#__PURE__*/ _jsx("span", {
                                                    style: {
                                                        fontSize: 9,
                                                        color: opt.color,
                                                        background: alpha(opt.color, 9),
                                                        padding: '2px 7px',
                                                        borderRadius: 4,
                                                        fontWeight: 700,
                                                        letterSpacing: '0.04em'
                                                    },
                                                    children: opt.label
                                                }, fin, false);
                                            })
                                        ]
                                    }, void 0, true),
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: T.text,
                                            marginBottom: 4
                                        },
                                        children: f.title
                                    }, void 0, false),
                                    f.description && /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            fontSize: 12,
                                            color: T.textSub,
                                            marginBottom: 8,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        },
                                        children: f.description
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            display: 'flex',
                                            gap: 18,
                                            fontSize: 12,
                                            color: T.textMuted,
                                            flexWrap: 'wrap'
                                        },
                                        children: [
                                            f.duration_hours > 0 && /*#__PURE__*/ _jsx("span", {
                                                children: [
                                                    "⏱ ",
                                                    f.duration_hours,
                                                    "h"
                                                ]
                                            }, void 0, true),
                                            f.price_ht > 0 && /*#__PURE__*/ _jsx("span", {
                                                children: [
                                                    "💶 ",
                                                    Number(f.price_ht).toLocaleString('fr-FR'),
                                                    " € HT"
                                                ]
                                            }, void 0, true),
                                            /*#__PURE__*/ _jsx("span", {
                                                children: [
                                                    "👥 max ",
                                                    f.max_participants
                                                ]
                                            }, void 0, true),
                                            /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    color: T.textDim
                                                },
                                                children: [
                                                    f.sessions_count || 0,
                                                    " session",
                                                    f.sessions_count !== 1 ? 's' : ''
                                                ]
                                            }, void 0, true),
                                            /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    color: T.textDim
                                                },
                                                children: [
                                                    f.total_inscriptions || 0,
                                                    " apprenant",
                                                    f.total_inscriptions !== 1 ? 's' : ''
                                                ]
                                            }, void 0, true),
                                            f.created_at && /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    color: T.textDim
                                                },
                                                children: [
                                                    "Créée le ",
                                                    fmtDate(f.created_at)
                                                ]
                                            }, void 0, true)
                                        ]
                                    }, void 0, true)
                                ]
                            }, f.id, true);
                        })
                    }, void 0, false),
                    showForm && /*#__PURE__*/ _jsx(Modal, {
                        title: "Nouvelle formation",
                        onClose: ()=>setShowForm(false),
                        width: 620,
                        children: /*#__PURE__*/ _jsx(FormationForm, {
                            onSave: handleCreate,
                            onClose: ()=>setShowForm(false),
                            catOptions: allCatOptions
                        }, void 0, false)
                    }, void 0, false)
                ]
            }, void 0, true) : /* ═══════ DETAIL VIEW ═══════ */ /*#__PURE__*/ _jsx("div", {
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 20
                        },
                        children: [
                            /*#__PURE__*/ _jsx("button", {
                                onClick: ()=>{
                                    setSelected(null);
                                    setEditSection(null);
                                },
                                style: {
                                    background: 'none',
                                    border: 'none',
                                    color: T.textMuted,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    fontFamily: T.font,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                },
                                children: "← Programmes"
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'center'
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("span", {
                                        style: {
                                            fontSize: 10,
                                            color: T.textDim,
                                            fontStyle: 'italic'
                                        },
                                        children: "Cliquez sur une section pour modifier"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: ()=>handleDelete(sel.id),
                                        style: {
                                            padding: '7px 14px',
                                            background: alpha(T.danger, 7),
                                            border: "1px solid ".concat(alpha(T.danger, 20)),
                                            borderRadius: 8,
                                            color: T.danger,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                            fontFamily: T.font
                                        },
                                        children: "Supprimer"
                                    }, void 0, false)
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true),
                    (()=>{
                        // Parse JSON fields safely
                        let selObjectives = [];
                        try {
                            selObjectives = Array.isArray(sel.objectives) ? sel.objectives : JSON.parse(sel.objectives || '[]');
                        } catch (e) {}
                        let selEvalMethods = [];
                        try {
                            selEvalMethods = Array.isArray(sel.evaluation_methods) ? sel.evaluation_methods : JSON.parse(sel.evaluation_methods || '[]');
                        } catch (e) {}
                        let selFinancements = [];
                        try {
                            selFinancements = Array.isArray(sel.financement_eligible) ? sel.financement_eligible : JSON.parse(sel.financement_eligible || '[]');
                        } catch (e) {}
                        // ── Inline edit helpers ──
                        const isEditing = (key)=>editSection === key;
                        const sectionHoverStyle = {
                            cursor: 'pointer',
                            borderRadius: 6,
                            margin: '-6px',
                            padding: 6,
                            transition: 'background 0.15s'
                        };
                        const SaveCancelBar = ()=>/*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 10
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("button", {
                                        style: {
                                            ...btnPrimary,
                                            padding: '6px 14px',
                                            fontSize: 12
                                        },
                                        disabled: saving,
                                        onClick: handleInlineSave,
                                        children: saving ? 'Enregistrement…' : 'Enregistrer'
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", {
                                        style: {
                                            ...btnSecondary,
                                            padding: '6px 14px',
                                            fontSize: 12
                                        },
                                        onClick: cancelInlineEdit,
                                        children: "Annuler"
                                    }, void 0, false)
                                ]
                            }, void 0, true);
                        const InfoRow = (param)=>{
                            let { icon, label, val } = param;
                            return val ? /*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'flex-start',
                                    marginBottom: 10,
                                    fontSize: 12
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("span", {
                                        style: {
                                            fontSize: 14,
                                            flexShrink: 0,
                                            marginTop: -1
                                        },
                                        children: icon
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    fontSize: 9,
                                                    color: T.textDim,
                                                    textTransform: 'uppercase',
                                                    marginBottom: 1
                                                },
                                                children: label
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    color: T.textSub,
                                                    lineHeight: 1.5
                                                },
                                                children: val
                                            }, void 0, false)
                                        ]
                                    }, void 0, true)
                                ]
                            }, void 0, true) : null;
                        };
                        return /*#__PURE__*/ _jsx("div", {
                            className: "resp-grid-1col",
                            style: {
                                display: 'grid',
                                gridTemplateColumns: '380px 1fr',
                                gap: 20,
                                alignItems: 'start'
                            },
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16
                                    },
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            style: {
                                                background: T.card,
                                                border: "1px solid ".concat(T.border2),
                                                borderRadius: 12,
                                                padding: 24
                                            },
                                            children: [
                                                isEditing('identity') ? /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        marginBottom: 16,
                                                        padding: 10,
                                                        background: alpha(T.gold, 3),
                                                        border: "1px solid ".concat(alpha(T.gold, 20)),
                                                        borderRadius: 8
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                fontSize: 9,
                                                                fontWeight: 700,
                                                                color: T.gold,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.1em',
                                                                marginBottom: 10
                                                            },
                                                            children: "Identité"
                                                        }, void 0, false),
                                                        /*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 10
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ _jsx(Field, {
                                                                    label: "Titre",
                                                                    children: /*#__PURE__*/ _jsx("input", {
                                                                        style: inputStyle,
                                                                        value: editData.title || '',
                                                                        onChange: (e)=>ed('title', e.target.value)
                                                                    }, void 0, false)
                                                                }, void 0, false),
                                                                /*#__PURE__*/ _jsx(Field, {
                                                                    label: "Type de formation",
                                                                    children: /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            display: 'flex',
                                                                            gap: 8
                                                                        },
                                                                        children: TYPE_FORMATION.map((t)=>{
                                                                            const act = editData.type_formation === t.value;
                                                                            return /*#__PURE__*/ _jsx("div", {
                                                                                onClick: ()=>ed('type_formation', t.value),
                                                                                style: {
                                                                                    flex: 1,
                                                                                    padding: '8px 12px',
                                                                                    borderRadius: 8,
                                                                                    cursor: 'pointer',
                                                                                    border: "1px solid ".concat(act ? t.color : T.border2),
                                                                                    background: act ? alpha(t.color, 8) : 'transparent',
                                                                                    transition: 'all 0.15s'
                                                                                },
                                                                                children: [
                                                                                    /*#__PURE__*/ _jsx("div", {
                                                                                        style: {
                                                                                            fontSize: 12,
                                                                                            fontWeight: 700,
                                                                                            color: act ? t.color : T.textSub
                                                                                        },
                                                                                        children: [
                                                                                            t.icon,
                                                                                            " ",
                                                                                            t.label
                                                                                        ]
                                                                                    }, void 0, true),
                                                                                    /*#__PURE__*/ _jsx("div", {
                                                                                        style: {
                                                                                            fontSize: 9,
                                                                                            color: act ? alpha(t.color, 80) : T.textDim,
                                                                                            marginTop: 1
                                                                                        },
                                                                                        children: t.sub
                                                                                    }, void 0, false)
                                                                                ]
                                                                            }, t.value, true);
                                                                        })
                                                                    }, void 0, false)
                                                                }, void 0, false),
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    style: {
                                                                        display: 'grid',
                                                                        gridTemplateColumns: '1fr 1fr',
                                                                        gap: 10
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Statut",
                                                                            children: /*#__PURE__*/ _jsx("select", {
                                                                                style: selectStyle,
                                                                                value: editData.status || 'active',
                                                                                onChange: (e)=>ed('status', e.target.value),
                                                                                children: [
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "active",
                                                                                        children: "Active"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "draft",
                                                                                        children: "Brouillon"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "archived",
                                                                                        children: "Archivée"
                                                                                    }, void 0, false)
                                                                                ]
                                                                            }, void 0, true)
                                                                        }, void 0, false),
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Modalité",
                                                                            children: /*#__PURE__*/ _jsx("select", {
                                                                                style: selectStyle,
                                                                                value: editData.modality || 'presentiel',
                                                                                onChange: (e)=>ed('modality', e.target.value),
                                                                                children: [
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "presentiel",
                                                                                        children: "Présentiel"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "distanciel",
                                                                                        children: "Distanciel"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "hybride",
                                                                                        children: "Hybride"
                                                                                    }, void 0, false)
                                                                                ]
                                                                            }, void 0, true)
                                                                        }, void 0, false)
                                                                    ]
                                                                }, void 0, true),
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    style: {
                                                                        display: 'grid',
                                                                        gridTemplateColumns: '1fr 1fr',
                                                                        gap: 10
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Catégorie",
                                                                            children: /*#__PURE__*/ _jsx("select", {
                                                                                style: selectStyle,
                                                                                value: editData.categorie || '',
                                                                                onChange: (e)=>ed('categorie', e.target.value),
                                                                                children: allCatOptions.map((c)=>/*#__PURE__*/ _jsx("option", {
                                                                                        value: c.value,
                                                                                        children: c.label
                                                                                    }, c.value, false))
                                                                            }, void 0, false)
                                                                        }, void 0, false),
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Thématique",
                                                                            children: /*#__PURE__*/ _jsx("input", {
                                                                                style: inputStyle,
                                                                                value: editData.thematique || '',
                                                                                onChange: (e)=>ed('thematique', e.target.value),
                                                                                placeholder: "ex : Cinéma documentaire"
                                                                            }, void 0, false)
                                                                        }, void 0, false)
                                                                    ]
                                                                }, void 0, true),
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    style: {
                                                                        display: 'grid',
                                                                        gridTemplateColumns: '1fr 1fr',
                                                                        gap: 10
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Format",
                                                                            children: /*#__PURE__*/ _jsx("input", {
                                                                                style: inputStyle,
                                                                                value: editData.format_label || '',
                                                                                onChange: (e)=>ed('format_label', e.target.value),
                                                                                placeholder: "ex : Masterclass 2j"
                                                                            }, void 0, false)
                                                                        }, void 0, false),
                                                                        /*#__PURE__*/ _jsx(Field, {
                                                                            label: "Certification",
                                                                            children: /*#__PURE__*/ _jsx("select", {
                                                                                style: selectStyle,
                                                                                value: editData.certification || 'Aucune',
                                                                                onChange: (e)=>ed('certification', e.target.value),
                                                                                children: [
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "Aucune",
                                                                                        children: "Aucune"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "RS",
                                                                                        children: "Répertoire Spécifique (RS)"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "RNCP",
                                                                                        children: "RNCP"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "Attestation",
                                                                                        children: "Attestation de compétences"
                                                                                    }, void 0, false),
                                                                                    /*#__PURE__*/ _jsx("option", {
                                                                                        value: "Certificat",
                                                                                        children: "Certificat de réalisation"
                                                                                    }, void 0, false)
                                                                                ]
                                                                            }, void 0, true)
                                                                        }, void 0, false)
                                                                    ]
                                                                }, void 0, true),
                                                                /*#__PURE__*/ _jsx(Field, {
                                                                    label: "Financements éligibles",
                                                                    children: /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            display: 'flex',
                                                                            gap: 6,
                                                                            flexWrap: 'wrap'
                                                                        },
                                                                        children: FINANCEMENT_OPTIONS.map((opt)=>{
                                                                            const active = (editData.financement_eligible || []).includes(opt.value);
                                                                            return /*#__PURE__*/ _jsx("span", {
                                                                                onClick: ()=>toggleFin(opt.value),
                                                                                style: {
                                                                                    padding: '5px 12px',
                                                                                    borderRadius: 6,
                                                                                    fontSize: 11,
                                                                                    fontWeight: 600,
                                                                                    cursor: 'pointer',
                                                                                    border: "1px solid ".concat(active ? opt.color : T.border2),
                                                                                    background: active ? alpha(opt.color, 13) : 'transparent',
                                                                                    color: active ? opt.color : T.textSub
                                                                                },
                                                                                children: opt.label
                                                                            }, opt.value, false);
                                                                        })
                                                                    }, void 0, false)
                                                                }, void 0, false),
                                                                /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                            ]
                                                        }, void 0, true)
                                                    ]
                                                }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        marginBottom: 16,
                                                        ...sectionHoverStyle
                                                    },
                                                    onClick: ()=>startEdit('identity', [
                                                            'title',
                                                            'status',
                                                            'type_formation',
                                                            'modality',
                                                            'categorie',
                                                            'thematique',
                                                            'format_label',
                                                            'certification',
                                                            'financement_eligible'
                                                        ]),
                                                    onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                    onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                    children: [
                                                        /*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 10,
                                                                marginBottom: 8,
                                                                flexWrap: 'wrap'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 13,
                                                                        color: T.gold,
                                                                        fontFamily: T.mono,
                                                                        fontWeight: 700
                                                                    },
                                                                    children: sel.code
                                                                }, void 0, false),
                                                                /*#__PURE__*/ _jsx(Badge, {
                                                                    status: sel.status
                                                                }, void 0, false),
                                                                (()=>{
                                                                    const tf = TYPE_FORMATION.find((t)=>t.value === sel.type_formation);
                                                                    return tf ? /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 10,
                                                                            color: tf.color,
                                                                            background: alpha(tf.color, 9),
                                                                            padding: '3px 8px',
                                                                            borderRadius: 4,
                                                                            fontWeight: 700
                                                                        },
                                                                        children: [
                                                                            tf.icon,
                                                                            " ",
                                                                            tf.label
                                                                        ]
                                                                    }, void 0, true) : null;
                                                                })(),
                                                                /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 9,
                                                                        color: T.textDim,
                                                                        marginLeft: 'auto'
                                                                    },
                                                                    children: "✎"
                                                                }, void 0, false)
                                                            ]
                                                        }, void 0, true),
                                                        /*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                fontSize: 20,
                                                                fontWeight: 800,
                                                                color: T.text,
                                                                lineHeight: 1.3,
                                                                marginBottom: 8
                                                            },
                                                            children: sel.title
                                                        }, void 0, false),
                                                        /*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                display: 'flex',
                                                                gap: 6,
                                                                flexWrap: 'wrap'
                                                            },
                                                            children: [
                                                                sel.modality && /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 10,
                                                                        color: MODALITY_COLOR[sel.modality] || T.textMuted,
                                                                        background: alpha(MODALITY_COLOR[sel.modality] || T.textMuted, 13),
                                                                        padding: '3px 8px',
                                                                        borderRadius: 4,
                                                                        fontWeight: 600
                                                                    },
                                                                    children: MODALITY_LABEL[sel.modality] || sel.modality
                                                                }, void 0, false),
                                                                catColor && catLabel && /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 10,
                                                                        color: catColor,
                                                                        background: alpha(catColor, 13),
                                                                        padding: '3px 8px',
                                                                        borderRadius: 4,
                                                                        fontWeight: 600,
                                                                        border: "1px solid ".concat(alpha(catColor, 20))
                                                                    },
                                                                    children: catLabel
                                                                }, void 0, false),
                                                                sel.thematique && /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 10,
                                                                        color: T.gold,
                                                                        background: T.goldDim,
                                                                        padding: '3px 8px',
                                                                        borderRadius: 4,
                                                                        fontWeight: 600
                                                                    },
                                                                    children: sel.thematique
                                                                }, void 0, false),
                                                                sel.certification && sel.certification !== 'Aucune' && /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 10,
                                                                        color: T.green,
                                                                        background: alpha(T.green, 9),
                                                                        padding: '3px 8px',
                                                                        borderRadius: 4,
                                                                        fontWeight: 700
                                                                    },
                                                                    children: sel.certification
                                                                }, void 0, false),
                                                                selFinancements.map((fin)=>{
                                                                    const opt = FINANCEMENT_OPTIONS.find((o)=>o.value === fin);
                                                                    if (!opt) return null;
                                                                    return /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: opt.color,
                                                                            background: alpha(opt.color, 9),
                                                                            padding: '3px 8px',
                                                                            borderRadius: 4,
                                                                            fontWeight: 700
                                                                        },
                                                                        children: opt.label
                                                                    }, fin, false);
                                                                }),
                                                                sel.format_label && /*#__PURE__*/ _jsx("span", {
                                                                    style: {
                                                                        fontSize: 10,
                                                                        color: T.textSub,
                                                                        background: T.border2,
                                                                        padding: '3px 8px',
                                                                        borderRadius: 4,
                                                                        fontWeight: 600
                                                                    },
                                                                    children: sel.format_label
                                                                }, void 0, false)
                                                            ]
                                                        }, void 0, true)
                                                    ]
                                                }, void 0, true),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: isEditing('description') ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            padding: 10,
                                                            background: alpha(T.gold, 3),
                                                            border: "1px solid ".concat(alpha(T.gold, 20)),
                                                            borderRadius: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.gold,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8
                                                                },
                                                                children: "Description"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("textarea", {
                                                                style: {
                                                                    ...textareaStyle,
                                                                    minHeight: 80
                                                                },
                                                                value: editData.description || '',
                                                                onChange: (e)=>ed('description', e.target.value),
                                                                placeholder: "Description de la formation…"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                        style: sectionHoverStyle,
                                                        onClick: ()=>startEdit('description', [
                                                                'description'
                                                            ]),
                                                        onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 12
                                                                        },
                                                                        children: "📝"
                                                                    }, void 0, false),
                                                                    "Description",
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: T.textDim,
                                                                            marginLeft: 'auto'
                                                                        },
                                                                        children: "✎"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: sel.description ? T.textSub : T.textDim,
                                                                    lineHeight: 1.7,
                                                                    fontStyle: sel.description ? 'normal' : 'italic'
                                                                },
                                                                children: sel.description || 'Cliquez pour ajouter une description…'
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: isEditing('probleme') ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            padding: 10,
                                                            background: alpha(T.gold, 3),
                                                            border: "1px solid ".concat(alpha(T.gold, 20)),
                                                            borderRadius: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.gold,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8
                                                                },
                                                                children: "Problème résolu"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("textarea", {
                                                                style: {
                                                                    ...textareaStyle,
                                                                    minHeight: 56
                                                                },
                                                                value: editData.probleme_resolu || '',
                                                                onChange: (e)=>ed('probleme_resolu', e.target.value),
                                                                placeholder: "Quel problème cette formation résout ?"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                        style: sectionHoverStyle,
                                                        onClick: ()=>startEdit('probleme', [
                                                                'probleme_resolu'
                                                            ]),
                                                        onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 12
                                                                        },
                                                                        children: "💡"
                                                                    }, void 0, false),
                                                                    "Problème résolu",
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: T.textDim,
                                                                            marginLeft: 'auto'
                                                                        },
                                                                        children: "✎"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: sel.probleme_resolu ? T.textSub : T.textDim,
                                                                    lineHeight: 1.6,
                                                                    fontStyle: sel.probleme_resolu ? 'normal' : 'italic'
                                                                },
                                                                children: sel.probleme_resolu || 'Cliquez pour ajouter…'
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: isEditing('objectives') ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            padding: 10,
                                                            background: alpha(T.gold, 3),
                                                            border: "1px solid ".concat(alpha(T.gold, 20)),
                                                            borderRadius: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.gold,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8
                                                                },
                                                                children: "Objectifs pédagogiques (un par ligne)"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("textarea", {
                                                                style: {
                                                                    ...textareaStyle,
                                                                    minHeight: 80
                                                                },
                                                                value: editData.objectives || '',
                                                                onChange: (e)=>ed('objectives', e.target.value),
                                                                placeholder: "Maîtriser les fondamentaux…\
Savoir structurer un récit…"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                        style: sectionHoverStyle,
                                                        onClick: ()=>startEdit('objectives', [
                                                                'objectives'
                                                            ]),
                                                        onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 12
                                                                        },
                                                                        children: "🎯"
                                                                    }, void 0, false),
                                                                    "Objectifs pédagogiques",
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: T.textDim,
                                                                            marginLeft: 'auto'
                                                                        },
                                                                        children: "✎"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            selObjectives.length > 0 ? /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: 4
                                                                },
                                                                children: selObjectives.map((obj, i)=>/*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 12,
                                                                            color: T.textSub,
                                                                            display: 'flex',
                                                                            gap: 8,
                                                                            lineHeight: 1.5
                                                                        },
                                                                        children: [
                                                                            /*#__PURE__*/ _jsx("span", {
                                                                                style: {
                                                                                    color: T.gold,
                                                                                    fontWeight: 700,
                                                                                    flexShrink: 0
                                                                                },
                                                                                children: "•"
                                                                            }, void 0, false),
                                                                            /*#__PURE__*/ _jsx("span", {
                                                                                children: typeof obj === 'string' ? obj : obj.label || obj.title || JSON.stringify(obj)
                                                                            }, void 0, false)
                                                                        ]
                                                                    }, i, true))
                                                            }, void 0, false) : /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: T.textDim,
                                                                    fontStyle: 'italic'
                                                                },
                                                                children: "Cliquez pour ajouter des objectifs…"
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: isEditing('livrables') ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            padding: 10,
                                                            background: alpha(T.gold, 3),
                                                            border: "1px solid ".concat(alpha(T.gold, 20)),
                                                            borderRadius: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.gold,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8
                                                                },
                                                                children: "Livrables clés"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("textarea", {
                                                                style: {
                                                                    ...textareaStyle,
                                                                    minHeight: 48
                                                                },
                                                                value: editData.livrables_cles || '',
                                                                onChange: (e)=>ed('livrables_cles', e.target.value),
                                                                placeholder: "Un court-métrage monté, un portfolio…"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                        style: sectionHoverStyle,
                                                        onClick: ()=>startEdit('livrables', [
                                                                'livrables_cles'
                                                            ]),
                                                        onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 12
                                                                        },
                                                                        children: "📦"
                                                                    }, void 0, false),
                                                                    "Livrables clés",
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: T.textDim,
                                                                            marginLeft: 'auto'
                                                                        },
                                                                        children: "✎"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: sel.livrables_cles ? T.textSub : T.textDim,
                                                                    lineHeight: 1.6,
                                                                    fontStyle: sel.livrables_cles ? 'normal' : 'italic'
                                                                },
                                                                children: sel.livrables_cles || 'Cliquez pour ajouter…'
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: isEditing('infos') ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            padding: 10,
                                                            background: alpha(T.gold, 3),
                                                            border: "1px solid ".concat(alpha(T.gold, 20)),
                                                            borderRadius: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.gold,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 10
                                                                },
                                                                children: "Informations"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '1fr 1fr',
                                                                    gap: 10
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Durée (heures)",
                                                                        children: /*#__PURE__*/ _jsx("input", {
                                                                            style: inputStyle,
                                                                            type: "number",
                                                                            value: editData.duration_hours || '',
                                                                            onChange: (e)=>ed('duration_hours', e.target.value)
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Durée (jours)",
                                                                        children: /*#__PURE__*/ _jsx("input", {
                                                                            style: inputStyle,
                                                                            type: "number",
                                                                            step: "0.5",
                                                                            value: editData.duration_days || '',
                                                                            onChange: (e)=>ed('duration_days', e.target.value)
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Tarif HT (€)",
                                                                        children: /*#__PURE__*/ _jsx("input", {
                                                                            style: inputStyle,
                                                                            type: "number",
                                                                            value: editData.price_ht || '',
                                                                            onChange: (e)=>ed('price_ht', e.target.value)
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Participants max",
                                                                        children: /*#__PURE__*/ _jsx("input", {
                                                                            style: inputStyle,
                                                                            type: "number",
                                                                            value: editData.max_participants || '',
                                                                            onChange: (e)=>ed('max_participants', e.target.value)
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Niveau",
                                                                        children: /*#__PURE__*/ _jsx("select", {
                                                                            style: selectStyle,
                                                                            value: editData.level || '',
                                                                            onChange: (e)=>ed('level', e.target.value),
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx("option", {
                                                                                    value: "",
                                                                                    children: "Non précisé"
                                                                                }, void 0, false),
                                                                                /*#__PURE__*/ _jsx("option", {
                                                                                    value: "debutant",
                                                                                    children: "Débutant"
                                                                                }, void 0, false),
                                                                                /*#__PURE__*/ _jsx("option", {
                                                                                    value: "intermediaire",
                                                                                    children: "Intermédiaire"
                                                                                }, void 0, false),
                                                                                /*#__PURE__*/ _jsx("option", {
                                                                                    value: "avance",
                                                                                    children: "Avancé"
                                                                                }, void 0, false)
                                                                            ]
                                                                        }, void 0, true)
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: 10,
                                                                    marginTop: 10
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Public cible",
                                                                        children: /*#__PURE__*/ _jsx("textarea", {
                                                                            style: {
                                                                                ...textareaStyle,
                                                                                minHeight: 48
                                                                            },
                                                                            value: editData.target_audience || '',
                                                                            onChange: (e)=>ed('target_audience', e.target.value),
                                                                            placeholder: "Créateurs de contenus, réalisateurs…"
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx(Field, {
                                                                        label: "Prérequis",
                                                                        children: /*#__PURE__*/ _jsx("textarea", {
                                                                            style: {
                                                                                ...textareaStyle,
                                                                                minHeight: 48
                                                                            },
                                                                            value: editData.prerequisites || '',
                                                                            onChange: (e)=>ed('prerequisites', e.target.value),
                                                                            placeholder: "Aucun prérequis…"
                                                                        }, void 0, false)
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            display: 'grid',
                                                                            gridTemplateColumns: '1fr 1fr',
                                                                            gap: 10
                                                                        },
                                                                        children: [
                                                                            /*#__PURE__*/ _jsx(Field, {
                                                                                label: "Délais d'accès",
                                                                                children: /*#__PURE__*/ _jsx("input", {
                                                                                    style: inputStyle,
                                                                                    value: editData.delais_acces || '',
                                                                                    onChange: (e)=>ed('delais_acces', e.target.value)
                                                                                }, void 0, false)
                                                                            }, void 0, false),
                                                                            /*#__PURE__*/ _jsx(Field, {
                                                                                label: "Accessibilité",
                                                                                children: /*#__PURE__*/ _jsx("input", {
                                                                                    style: inputStyle,
                                                                                    value: editData.accessibility || '',
                                                                                    onChange: (e)=>ed('accessibility', e.target.value)
                                                                                }, void 0, false)
                                                                            }, void 0, false)
                                                                        ]
                                                                    }, void 0, true)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                        style: sectionHoverStyle,
                                                        onClick: ()=>startEdit('infos', [
                                                                'duration_hours',
                                                                'duration_days',
                                                                'price_ht',
                                                                'max_participants',
                                                                'level',
                                                                'target_audience',
                                                                'prerequisites',
                                                                'delais_acces',
                                                                'accessibility'
                                                            ]),
                                                        onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                        onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 8,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 12
                                                                        },
                                                                        children: "ℹ️"
                                                                    }, void 0, false),
                                                                    "Informations",
                                                                    /*#__PURE__*/ _jsx("span", {
                                                                        style: {
                                                                            fontSize: 9,
                                                                            color: T.textDim,
                                                                            marginLeft: 'auto'
                                                                        },
                                                                        children: "✎"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "⏱",
                                                                label: "Durée",
                                                                val: sel.duration_hours > 0 ? "".concat(sel.duration_hours, "h").concat(sel.duration_days > 0 ? " (".concat(sel.duration_days, "j)") : '') : null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "💶",
                                                                label: "Tarif HT",
                                                                val: sel.price_ht > 0 ? "".concat(Number(sel.price_ht).toLocaleString('fr-FR'), " €") : null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "👥",
                                                                label: "Participants max",
                                                                val: "".concat(sel.max_participants)
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "🎓",
                                                                label: "Niveau",
                                                                val: sel.level ? ({
                                                                    debutant: 'Débutant',
                                                                    intermediaire: 'Intermédiaire',
                                                                    avance: 'Avancé'
                                                                })[sel.level] || sel.level : null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "🎯",
                                                                label: "Public cible",
                                                                val: sel.target_audience || null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "📋",
                                                                label: "Prérequis",
                                                                val: sel.prerequisites || null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "🕐",
                                                                label: "Délais d'accès",
                                                                val: sel.delais_acces || null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "♿",
                                                                label: "Accessibilité",
                                                                val: sel.accessibility || null
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(InfoRow, {
                                                                icon: "📅",
                                                                label: "Créée le",
                                                                val: sel.created_at ? fmtDate(sel.created_at) : null
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        borderTop: "1px solid ".concat(T.border),
                                                        paddingTop: 14,
                                                        marginTop: 10
                                                    },
                                                    children: /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: 10
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    background: T.bg,
                                                                    borderRadius: 8,
                                                                    padding: '10px 14px',
                                                                    textAlign: 'center'
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 20,
                                                                            fontWeight: 800,
                                                                            color: T.blue,
                                                                            fontFamily: T.mono
                                                                        },
                                                                        children: sel.sessions_count || 0
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 10,
                                                                            color: T.textDim,
                                                                            marginTop: 2
                                                                        },
                                                                        children: "Sessions"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    background: T.bg,
                                                                    borderRadius: 8,
                                                                    padding: '10px 14px',
                                                                    textAlign: 'center'
                                                                },
                                                                children: [
                                                                    /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 20,
                                                                            fontWeight: 800,
                                                                            color: T.purple,
                                                                            fontFamily: T.mono
                                                                        },
                                                                        children: sel.total_inscriptions || 0
                                                                    }, void 0, false),
                                                                    /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 10,
                                                                            color: T.textDim,
                                                                            marginTop: 2
                                                                        },
                                                                        children: "Apprenants"
                                                                    }, void 0, false)
                                                                ]
                                                            }, void 0, true)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false)
                                            ]
                                        }, void 0, true),
                                        /*#__PURE__*/ _jsx("div", {
                                            style: {
                                                background: T.card,
                                                border: "1px solid ".concat(T.border2),
                                                borderRadius: 12,
                                                padding: 24
                                            },
                                            children: isEditing('pedagogie') ? /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    padding: 10,
                                                    background: alpha(T.gold, 3),
                                                    border: "1px solid ".concat(alpha(T.gold, 20)),
                                                    borderRadius: 8
                                                },
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            color: T.gold,
                                                            marginBottom: 12
                                                        },
                                                        children: "Pédagogie & Moyens"
                                                    }, void 0, false),
                                                    /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 10
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx(Field, {
                                                                label: "Modalités pédagogiques",
                                                                children: /*#__PURE__*/ _jsx("textarea", {
                                                                    style: {
                                                                        ...textareaStyle,
                                                                        minHeight: 56
                                                                    },
                                                                    value: editData.modalites_pedagogiques || '',
                                                                    onChange: (e)=>ed('modalites_pedagogiques', e.target.value),
                                                                    placeholder: "Alternance théorie/pratique, études de cas…"
                                                                }, void 0, false)
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(Field, {
                                                                label: "Moyens matériels & techniques",
                                                                children: /*#__PURE__*/ _jsx("textarea", {
                                                                    style: {
                                                                        ...textareaStyle,
                                                                        minHeight: 56
                                                                    },
                                                                    value: editData.moyens_materiels || '',
                                                                    onChange: (e)=>ed('moyens_materiels', e.target.value),
                                                                    placeholder: "Salle équipée, postes DaVinci Resolve…"
                                                                }, void 0, false)
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(Field, {
                                                                label: "Méthodes d'évaluation (une par ligne)",
                                                                children: /*#__PURE__*/ _jsx("textarea", {
                                                                    style: {
                                                                        ...textareaStyle,
                                                                        minHeight: 64
                                                                    },
                                                                    value: editData.evaluation_methods || '',
                                                                    onChange: (e)=>ed('evaluation_methods', e.target.value),
                                                                    placeholder: "Questionnaire de positionnement\
Évaluation pratique\
Questionnaire satisfaction"
                                                                }, void 0, false)
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx(SaveCancelBar, {}, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                ]
                                            }, void 0, true) : /*#__PURE__*/ _jsx("div", {
                                                style: sectionHoverStyle,
                                                onClick: ()=>startEdit('pedagogie', [
                                                        'modalites_pedagogiques',
                                                        'moyens_materiels',
                                                        'evaluation_methods'
                                                    ]),
                                                onMouseEnter: (e)=>e.currentTarget.style.background = alpha(T.gold, 3),
                                                onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            color: T.text,
                                                            marginBottom: 12,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6
                                                        },
                                                        children: [
                                                            "Pédagogie & Moyens",
                                                            /*#__PURE__*/ _jsx("span", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    color: T.textDim,
                                                                    marginLeft: 'auto'
                                                                },
                                                                children: "✎"
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true),
                                                    sel.modalites_pedagogiques ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            marginBottom: 14
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 6
                                                                },
                                                                children: "Modalités pédagogiques"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: T.textSub,
                                                                    lineHeight: 1.6
                                                                },
                                                                children: sel.modalites_pedagogiques
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true) : null,
                                                    sel.moyens_materiels ? /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            marginBottom: 14
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 6
                                                                },
                                                                children: "Moyens matériels & techniques"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: T.textSub,
                                                                    lineHeight: 1.6
                                                                },
                                                                children: sel.moyens_materiels
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true) : null,
                                                    selEvalMethods.length > 0 ? /*#__PURE__*/ _jsx("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 9,
                                                                    fontWeight: 700,
                                                                    color: T.textDim,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.1em',
                                                                    marginBottom: 6
                                                                },
                                                                children: "Méthodes d'évaluation"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: 4
                                                                },
                                                                children: selEvalMethods.map((m, i)=>/*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 12,
                                                                            color: T.textSub,
                                                                            display: 'flex',
                                                                            gap: 8
                                                                        },
                                                                        children: [
                                                                            /*#__PURE__*/ _jsx("span", {
                                                                                style: {
                                                                                    color: T.purple,
                                                                                    fontWeight: 700,
                                                                                    flexShrink: 0
                                                                                },
                                                                                children: "•"
                                                                            }, void 0, false),
                                                                            /*#__PURE__*/ _jsx("span", {
                                                                                children: typeof m === 'string' ? m : m.label || JSON.stringify(m)
                                                                            }, void 0, false)
                                                                        ]
                                                                    }, i, true))
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true) : null,
                                                    !sel.modalites_pedagogiques && !sel.moyens_materiels && selEvalMethods.length === 0 && /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            fontSize: 12,
                                                            color: T.textDim,
                                                            fontStyle: 'italic'
                                                        },
                                                        children: "Cliquez pour ajouter les informations pédagogiques…"
                                                    }, void 0, false)
                                                ]
                                            }, void 0, true)
                                        }, void 0, false)
                                    ]
                                }, void 0, true),
                                /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16
                                    },
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            style: {
                                                background: T.card,
                                                border: "1px solid ".concat(sel.type_formation === 'personnalise' ? 'color-mix(in srgb, var(--warning) 20%, transparent)' : 'color-mix(in srgb, var(--info) 20%, transparent)'),
                                                borderRadius: 12,
                                                padding: '16px 20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            },
                                            children: sel.type_formation === 'personnalise' ? /*#__PURE__*/ _jsx(_Fragment, {
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 13,
                                                                    fontWeight: 700,
                                                                    color: 'var(--warning)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: "✏️ Formation personnalisée"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    color: T.textDim,
                                                                    marginTop: 2
                                                                },
                                                                children: "Programme générable depuis les données saisies"
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true),
                                                    /*#__PURE__*/ _jsx("button", {
                                                        style: {
                                                            ...btnPrimary,
                                                            padding: '7px 16px',
                                                            fontSize: 12,
                                                            background: 'var(--warning)'
                                                        },
                                                        children: "📄 Générer programme"
                                                    }, void 0, false)
                                                ]
                                            }, void 0, true) : /*#__PURE__*/ _jsx(_Fragment, {
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 13,
                                                                    fontWeight: 700,
                                                                    color: 'var(--info)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6
                                                                },
                                                                children: "📐 Formation standard"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    color: T.textDim,
                                                                    marginTop: 2
                                                                },
                                                                children: "Programme maquetté sous InDesign"
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true),
                                                    /*#__PURE__*/ _jsx("span", {
                                                        style: {
                                                            fontSize: 11,
                                                            color: T.textDim,
                                                            fontStyle: 'italic'
                                                        },
                                                        children: "Fichier InDesign / PDF"
                                                    }, void 0, false)
                                                ]
                                            }, void 0, true)
                                        }, void 0, false),
                                        /* ══════ MODULES MANAGEMENT ══════ */
                                        (() => {
                                            const handleAddModule = async () => {
                                                if (!newModTitle.trim()) return;
                                                const created = await api.post('/api/modules', {
                                                    formation_id: sel.id,
                                                    title: newModTitle.trim(),
                                                    description: newModDesc.trim(),
                                                    duration_hours: parseFloat(newModHours) || 0,
                                                    objectives: newModObjectives.split('\n').map(s => s.trim()).filter(Boolean),
                                                });
                                                setMods(prev => [...prev, created]);
                                                setNewModTitle(''); setNewModDesc(''); setNewModHours(''); setNewModObjectives('');
                                                setAddingModule(false);
                                                onRefresh();
                                            };

                                            const handleDeleteModule = async (modId) => {
                                                if (!(await confirm({ title: 'Supprimer ce module ?', confirmLabel: 'Supprimer' }))) return;
                                                await api.del(`/api/modules/${modId}`);
                                                setMods(prev => prev.filter(m => m.id !== modId));
                                                onRefresh();
                                            };

                                            const handleSaveEdit = async (modId) => {
                                                const d = editModData;
                                                const payload = {};
                                                if ('title' in d) payload.title = d.title;
                                                if ('description' in d) payload.description = d.description;
                                                if ('duration_hours' in d) payload.duration_hours = parseFloat(d.duration_hours) || 0;
                                                if ('objectives' in d) payload.objectives = d.objectives.split('\n').map(s => s.trim()).filter(Boolean);
                                                const updated = await api.patch(`/api/modules/${modId}`, payload);
                                                setMods(prev => prev.map(m => m.id === modId ? { ...m, ...updated } : m));
                                                setEditingModId(null);
                                                setEditModData({});
                                                onRefresh();
                                            };

                                            const totalHours = mods.reduce((s, m) => s + (parseFloat(m.duration_hours) || 0), 0);
                                            const inputSt = { width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' };
                                            const textareaSt = { ...inputSt, minHeight: 48, resize: 'vertical' };

                                            return _jsx("div", {
                                                style: { background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: 24 },
                                                children: [
                                                    _jsx("div", {
                                                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
                                                        children: [
                                                            _jsx("div", { children: [
                                                                _jsx("div", { style: { fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }, children: "Modules du programme" }, void 0, false),
                                                                _jsx("div", { style: { fontSize: 11, color: T.textDim }, children: [`Structure pédagogique — ${mods.length} module${mods.length !== 1 ? 's' : ''} • ${totalHours}h total`] }, void 0, true),
                                                            ] }, void 0, true),
                                                            !addingModule && _jsx("button", {
                                                                onClick: () => setAddingModule(true),
                                                                style: { padding: '6px 16px', borderRadius: 8, border: `1px solid ${T.border2}`, background: T.bg, color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font },
                                                                children: '+ Module'
                                                            }, void 0, false),
                                                        ]
                                                    }, void 0, true),

                                                    /* Add module form */
                                                    addingModule && _jsx("div", {
                                                        style: { background: T.bg, border: `1px solid ${alpha(T.gold, 27)}`, borderRadius: 10, padding: 16, marginBottom: 16 },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }, children: 'Nouveau module' }, void 0, false),
                                                            _jsx("div", { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }, children: [
                                                                _jsx("input", { style: inputSt, placeholder: 'Titre du module *', value: newModTitle, onChange: e => setNewModTitle(e.target.value) }, void 0, false),
                                                                _jsx("input", { style: inputSt, placeholder: 'Durée (heures)', type: 'number', step: '0.5', value: newModHours, onChange: e => setNewModHours(e.target.value) }, void 0, false),
                                                            ] }, void 0, true),
                                                            _jsx("textarea", { style: textareaSt, placeholder: 'Description du module', value: newModDesc, onChange: e => setNewModDesc(e.target.value), rows: 2 }, void 0, false),
                                                            _jsx("textarea", { style: { ...textareaSt, marginTop: 8 }, placeholder: 'Objectifs (un par ligne)', value: newModObjectives, onChange: e => setNewModObjectives(e.target.value), rows: 2 }, void 0, false),
                                                            _jsx("div", { style: { display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }, children: [
                                                                _jsx("button", { onClick: () => { setAddingModule(false); setNewModTitle(''); setNewModDesc(''); setNewModHours(''); setNewModObjectives(''); }, style: { padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: T.font }, children: 'Annuler' }, void 0, false),
                                                                _jsx("button", { onClick: handleAddModule, disabled: !newModTitle.trim(), style: { padding: '6px 14px', borderRadius: 6, border: 'none', background: T.text, color: T.card, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, opacity: newModTitle.trim() ? 1 : 0.4 }, children: 'Ajouter' }, void 0, false),
                                                            ] }, void 0, true),
                                                        ]
                                                    }, void 0, true),

                                                    /* Module list */
                                                    modsLoading ? _jsx("div", { style: { padding: 20, textAlign: 'center', color: T.textDim, fontSize: 12 }, children: 'Chargement…' }, void 0, false)
                                                    : mods.length === 0 && !addingModule ? _jsx("div", { style: { padding: 24, textAlign: 'center', color: T.textDim, fontSize: 12, fontStyle: 'italic', border: `1px dashed ${T.border3}`, borderRadius: 8 }, children: 'Aucun module — cliquez "+ Module" pour structurer votre programme.' }, void 0, false)
                                                    : _jsx("div", {
                                                        style: { display: 'flex', flexDirection: 'column', gap: 6 },
                                                        children: mods.map((m, idx) => {
                                                            const isEditing = editingModId === m.id;
                                                            const ed = editModData;
                                                            let objArr = [];
                                                            try { objArr = Array.isArray(m.objectives) ? m.objectives : JSON.parse(m.objectives || '[]'); } catch(e) {}
                                                            return _jsx("div", {
                                                                style: { display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${isEditing ? alpha(T.gold, 40) : T.border}`, borderRadius: 8, background: isEditing ? T.bg : T.card, overflow: 'hidden' },
                                                                children: [
                                                                    /* Header row */
                                                                    _jsx("div", {
                                                                        style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' },
                                                                        children: [
                                                                            _jsx("span", { style: { fontWeight: 700, color: T.gold, fontSize: 11, minWidth: 30, textAlign: 'center', background: alpha(T.gold, 7), padding: '2px 6px', borderRadius: 4 }, children: `M${idx + 1}` }, void 0, false),
                                                                            isEditing
                                                                                ? _jsx("input", { style: { ...inputSt, flex: 1 }, value: 'title' in ed ? ed.title : m.title, onChange: e => setEditModData(p => ({ ...p, title: e.target.value })) }, void 0, false)
                                                                                : _jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 600, color: T.text }, children: m.title }, void 0, false),
                                                                            isEditing
                                                                                ? _jsx("input", { style: { ...inputSt, width: 70 }, type: 'number', step: '0.5', value: 'duration_hours' in ed ? ed.duration_hours : m.duration_hours || '', onChange: e => setEditModData(p => ({ ...p, duration_hours: e.target.value })) }, void 0, false)
                                                                                : m.duration_hours ? _jsx("span", { style: { fontSize: 11, color: T.textDim, fontFamily: T.mono }, children: `${m.duration_hours}h` }, void 0, false) : null,
                                                                            !isEditing && _jsx("button", {
                                                                                onClick: () => { setEditingModId(m.id); setEditModData({}); },
                                                                                style: { padding: '3px 10px', borderRadius: 4, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 10, cursor: 'pointer', fontFamily: T.font },
                                                                                children: '✏️'
                                                                            }, void 0, false),
                                                                            !isEditing && _jsx("button", {
                                                                                onClick: () => handleDeleteModule(m.id),
                                                                                style: { padding: '3px 10px', borderRadius: 4, border: `1px solid color-mix(in srgb, var(--danger) 27%, transparent)`, background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer', fontFamily: T.font },
                                                                                children: '🗑'
                                                                            }, void 0, false),
                                                                        ].filter(Boolean)
                                                                    }, void 0, true),
                                                                    /* Edit body (description, objectives) */
                                                                    isEditing && _jsx("div", {
                                                                        style: { padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
                                                                        children: [
                                                                            _jsx("textarea", { style: textareaSt, placeholder: 'Description', rows: 2, value: 'description' in ed ? ed.description : (m.description || ''), onChange: e => setEditModData(p => ({ ...p, description: e.target.value })) }, void 0, false),
                                                                            _jsx("textarea", { style: textareaSt, placeholder: 'Objectifs (un par ligne)', rows: 2, value: 'objectives' in ed ? ed.objectives : objArr.join('\n'), onChange: e => setEditModData(p => ({ ...p, objectives: e.target.value })) }, void 0, false),
                                                                            _jsx("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [
                                                                                _jsx("button", { onClick: () => { setEditingModId(null); setEditModData({}); }, style: { padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: T.font }, children: 'Annuler' }, void 0, false),
                                                                                _jsx("button", { onClick: () => handleSaveEdit(m.id), style: { padding: '5px 12px', borderRadius: 6, border: 'none', background: T.text, color: T.card, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }, children: 'Enregistrer' }, void 0, false),
                                                                            ] }, void 0, true),
                                                                        ]
                                                                    }, void 0, true),
                                                                    /* Read-only detail */
                                                                    !isEditing && (m.description || objArr.length > 0) && _jsx("div", {
                                                                        style: { padding: '0 14px 10px 54px', fontSize: 11, color: T.textMuted, lineHeight: 1.5 },
                                                                        children: [
                                                                            m.description && _jsx("div", { style: { marginBottom: objArr.length > 0 ? 4 : 0 }, children: m.description }, void 0, false),
                                                                            objArr.length > 0 && _jsx("div", {
                                                                                children: objArr.map((o, oi) => _jsx("div", { style: { paddingLeft: 10, position: 'relative' }, children: [`• ${o}`] }, oi, true))
                                                                            }, void 0, false),
                                                                        ].filter(Boolean)
                                                                    }, void 0, true),
                                                                ].filter(Boolean)
                                                            }, m.id, true);
                                                        })
                                                    }, void 0, false),
                                                ].filter(Boolean)
                                            }, void 0, true);
                                        })(),
                                        /*#__PURE__*/ _jsx("div", {
                                            style: {
                                                background: T.card,
                                                border: "1px solid ".concat(T.border2),
                                                borderRadius: 12,
                                                padding: 24
                                            },
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: 14
                                                    },
                                                    children: /*#__PURE__*/ _jsx("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 15,
                                                                    fontWeight: 700,
                                                                    color: T.text
                                                                },
                                                                children: "Sessions"
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("div", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    color: T.textDim,
                                                                    marginTop: 2
                                                                },
                                                                children: [
                                                                    selSessions.length,
                                                                    " session",
                                                                    selSessions.length !== 1 ? 's' : '',
                                                                    " rattachée",
                                                                    selSessions.length !== 1 ? 's' : ''
                                                                ]
                                                            }, void 0, true)
                                                        ]
                                                    }, void 0, true)
                                                }, void 0, false),
                                                selSessions.length === 0 ? /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        padding: '20px 0',
                                                        textAlign: 'center',
                                                        fontSize: 12,
                                                        color: T.textDim
                                                    },
                                                    children: "Aucune session pour cette formation."
                                                }, void 0, false) : /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 8
                                                    },
                                                    children: selSessions.map((s)=>/*#__PURE__*/ _jsx("div", {
                                                            style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: 12,
                                                                padding: '10px 14px',
                                                                background: T.card,
                                                                border: "1px solid ".concat(T.border2),
                                                                borderRadius: 8
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    style: {
                                                                        flex: 1,
                                                                        minWidth: 0
                                                                    },
                                                                    children: [
                                                                        /*#__PURE__*/ _jsx("div", {
                                                                            style: {
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 8,
                                                                                marginBottom: 4
                                                                            },
                                                                            children: [
                                                                                /*#__PURE__*/ _jsx(Badge, {
                                                                                    status: s.status
                                                                                }, void 0, false),
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    style: {
                                                                                        fontSize: 10,
                                                                                        color: s.type_session === 'INTRA' ? T.purple : T.blue,
                                                                                        fontWeight: 700
                                                                                    },
                                                                                    children: s.type_session || 'INTER'
                                                                                }, void 0, false)
                                                                            ]
                                                                        }, void 0, true),
                                                                        /*#__PURE__*/ _jsx("div", {
                                                                            style: {
                                                                                fontSize: 12,
                                                                                color: T.textSub
                                                                            },
                                                                            children: fmtDateRange(s.start_date, s.end_date)
                                                                        }, void 0, false),
                                                                        /*#__PURE__*/ _jsx("div", {
                                                                            style: {
                                                                                fontSize: 11,
                                                                                color: T.textMuted,
                                                                                marginTop: 2
                                                                            },
                                                                            children: [
                                                                                s.location && /*#__PURE__*/ _jsx("span", {
                                                                                    children: [
                                                                                        s.location,
                                                                                        " · "
                                                                                    ]
                                                                                }, void 0, true),
                                                                                s.formateur_name && /*#__PURE__*/ _jsx("span", {
                                                                                    children: [
                                                                                        s.formateur_name,
                                                                                        " · "
                                                                                    ]
                                                                                }, void 0, true),
                                                                                /*#__PURE__*/ _jsx("span", {
                                                                                    children: [
                                                                                        s.inscriptions_count || 0,
                                                                                        " apprenant",
                                                                                        (s.inscriptions_count || 0) !== 1 ? 's' : ''
                                                                                    ]
                                                                                }, void 0, true)
                                                                            ]
                                                                        }, void 0, true)
                                                                    ]
                                                                }, void 0, true),
                                                                /*#__PURE__*/ _jsx("div", {
                                                                    style: {
                                                                        textAlign: 'right',
                                                                        flexShrink: 0
                                                                    },
                                                                    children: s.tarif > 0 && /*#__PURE__*/ _jsx("div", {
                                                                        style: {
                                                                            fontSize: 14,
                                                                            fontWeight: 700,
                                                                            color: T.gold,
                                                                            fontFamily: T.mono
                                                                        },
                                                                        children: [
                                                                            Number(s.tarif).toLocaleString('fr-FR'),
                                                                            " €"
                                                                        ]
                                                                    }, void 0, true)
                                                                }, void 0, false)
                                                            ]
                                                        }, s.id, true))
                                                }, void 0, false)
                                            ]
                                        }, void 0, true)
                                    ]
                                }, void 0, true)
                            ]
                        }, void 0, true);
                    })()
                ]
            }, void 0, true) : null
        ]
    }, void 0, true);
}


// ── Session constants (restored from original) ──
const ADVANCEMENT_COLORS = {
    configuration: 'var(--pillar-prod)',
    gestion: 'var(--success)',
    pedagogie: 'var(--warning)',
    cloture: 'var(--danger)',
    suivi: 'var(--info)',
};

const DEFAULT_ADVANCEMENT = {
    configuration: {
        label: 'Configuration',
        items: [
            {
                key: 'formation_assigned',
                label: 'Formation assignée',
                done: false
            },
            {
                key: 'dates_defined',
                label: 'Dates définies',
                done: false
            },
            {
                key: 'formateur_assigned',
                label: 'Formateur assigné',
                done: false
            },
            {
                key: 'lieu_defined',
                label: 'Lieu / lien défini',
                done: false
            },
            {
                key: 'tarif_set',
                label: 'Tarif session défini',
                done: false
            }
        ]
    },
    gestion: {
        label: 'Gestion administrative',
        items: [
            {
                key: 'conventions_generated',
                label: 'Conventions générées',
                done: false
            },
            {
                key: 'conventions_sent',
                label: 'Conventions envoyées',
                done: false
            },
            {
                key: 'conventions_signed',
                label: 'Conventions signées',
                done: false
            },
            {
                key: 'convocations_sent',
                label: 'Convocations envoyées',
                done: false
            },
            {
                key: 'apprenants_confirmed',
                label: 'Apprenants confirmés',
                done: false
            }
        ]
    },
    pedagogie: {
        label: 'Espace pédagogique',
        items: [
            {
                key: 'supports_ready',
                label: 'Supports pédagogiques prêts',
                done: false
            },
            {
                key: 'eval_positionnement',
                label: 'Éval. positionnement créée',
                done: false
            },
            {
                key: 'eval_acquis',
                label: 'Éval. des acquis créée',
                done: false
            },
            {
                key: 'livret_accueil',
                label: "Livret d'accueil envoyé",
                done: false
            }
        ]
    },
    suivi: {
        label: 'Suivi en cours',
        items: [
            {
                key: 'emargements_ok',
                label: 'Émargements à jour',
                done: false
            },
            {
                key: 'eval_mid',
                label: 'Éval. mi-parcours réalisée',
                done: false
            },
            {
                key: 'attendance_checked',
                label: 'Présences vérifiées',
                done: false
            }
        ]
    },
    cloture: {
        label: 'Clôture',
        items: [
            {
                key: 'eval_satisfaction',
                label: 'Questionnaire satisfaction',
                done: false
            },
            {
                key: 'attestations_generated',
                label: 'Attestations générées',
                done: false
            },
            {
                key: 'certificats_sent',
                label: 'Certificats envoyés',
                done: false
            },
            {
                key: 'bilan_done',
                label: 'Bilan pédagogique rédigé',
                done: false
            }
        ]
    }
};

const DOC_TYPES = [
    {
        key: 'convention',
        label: 'Convention',
        icon: '📋'
    },
    {
        key: 'convocation',
        label: 'Convocation',
        icon: '📩'
    },
    {
        key: 'emargement',
        label: 'Émargement',
        icon: '✍️'
    },
    {
        key: 'evaluation',
        label: 'Évaluation',
        icon: '📝'
    },
    {
        key: 'attestation',
        label: 'Attestation',
        icon: '🎓'
    },
    {
        key: 'certificat',
        label: 'Certificat',
        icon: '🏅'
    }
];

const DOC_STATUS_MAP = {
    none: {
        l: '—',
        c: 'var(--text-3)'
    },
    generated: {
        l: 'Généré',
        c: 'var(--gold-deep)'
    },
    sent: {
        l: 'Envoyé',
        c: 'var(--info)'
    },
    signed: {
        l: 'Signé',
        c: 'var(--success)'
    }
};

// ── Smart Advancement Calculator ──
function computeSmartAdvancement(sess, evaluations = []) {
    if (!sess) return null;

    const inscriptions = sess.inscriptions || [];
    const docs = (() => {
        try {
            return JSON.parse(sess.documents || '{}');
        } catch(e) {
            return {};
        }
    })();
    const nbApprenants = inscriptions.length;
    const evaluationTypes = ['positionnement', 'acquis', 'satisfaction'];
    const evaluationKeys = new Set((evaluations || []).filter((evaluation) => evaluationTypes.includes(evaluation.type)).map((evaluation) => `${evaluation.apprenant_id}:${evaluation.type}`));
    const evaluationsCompleted = evaluationKeys.size;
    const evaluationsExpected = nbApprenants * evaluationTypes.length;

    // ── CONFIGURATION ──
    const configuration = {
        label: 'Configuration',
        icon: '⚙️',
        color: 'var(--pillar-prod)',
        items: [
            { key: 'dates', label: 'Dates définies', done: !!(sess.start_date && sess.end_date), detail: sess.start_date ? `Du ${sess.start_date} au ${sess.end_date}` : null, goto: 'info', configSubTab: 'dates_prix', scrollTarget: 'section-dates', action: 'Modifier' },
            { key: 'lieu', label: 'Lieu de formation', done: !!(sess.location), detail: sess.location || null, goto: 'info', configSubTab: 'initialisation', scrollTarget: 'section-dates', action: 'Modifier' },
            { key: 'client', label: 'Client rattaché', done: !!(sess.client_id), detail: null, goto: 'info', configSubTab: 'dates_prix', scrollTarget: 'section-dates', action: 'Modifier' },
            { key: 'devis', label: 'Devis', done: !!(docs.devis && docs.devis !== 'none'), detail: docs.devis ? `Statut : ${docs.devis}` : null, goto: 'documents', gestionSubTab: 'conventions', scrollTarget: 'section-conventions', action: 'Gérer', sub: docs.devis ? [
                { label: 'Envoyés par e-mail', value: docs.devis === 'sent' || docs.devis === 'signed' ? '1/1' : '0/1', ok: docs.devis === 'sent' || docs.devis === 'signed' },
                { label: 'Signés', value: docs.devis === 'signed' ? '1/1' : '0/1', ok: docs.devis === 'signed' },
            ] : null },
            { key: 'apprenants', label: 'Apprenants inscrits', done: nbApprenants > 0, detail: nbApprenants > 0 ? `${nbApprenants} apprenant${nbApprenants > 1 ? 's' : ''} inscrit${nbApprenants > 1 ? 's' : ''}` : null, goto: 'apprenants', scrollTarget: 'section-apprenants', action: 'Gérer' },
            { key: 'programme', label: 'Programme', done: !!(sess.formation_title), detail: sess.formation_title || null, goto: 'programme', configSubTab: 'programme', action: 'Modifier' },
            { key: 'formateur', label: 'Intervenants', done: !!(sess.formateur_name), detail: sess.formateur_name || null, goto: 'info', configSubTab: 'intervenants', scrollTarget: 'sub-intervenants', action: 'Modifier' },
        ]
    };

    // ── GESTION ──
    const conventionsDone = inscriptions.filter(i => i.convention_signed).length;
    const convocationsDone = inscriptions.filter(i => i.convocation_sent).length;
    const gestion = {
        label: 'Gestion',
        icon: '📋',
        color: 'var(--success)',
        items: [
            { key: 'conventions', label: 'Conventions', done: nbApprenants > 0 && conventionsDone === nbApprenants, goto: 'documents', gestionSubTab: 'conventions', scrollTarget: 'section-conventions', action: 'Gérer', sub: [
                { label: 'Documents générés', value: `${docs.convention === 'generated' || docs.convention === 'sent' || docs.convention === 'signed' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.convention && docs.convention !== 'none' },
                { label: 'Envoyés par e-mail', value: `${conventionsDone}/${nbApprenants}`, ok: conventionsDone === nbApprenants },
                { label: 'Signés', value: `${conventionsDone}/${nbApprenants}`, ok: conventionsDone === nbApprenants },
            ]},
            { key: 'convocations', label: 'Convocations', done: nbApprenants > 0 && convocationsDone === nbApprenants, goto: 'documents', gestionSubTab: 'convocations', scrollTarget: 'section-convocations', action: 'Gérer', sub: [
                { label: 'Documents générés', value: `${docs.convocation && docs.convocation !== 'none' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.convocation && docs.convocation !== 'none' },
                { label: 'Envoyés par e-mail', value: `${convocationsDone}/${nbApprenants}`, ok: convocationsDone === nbApprenants },
            ]},
            { key: 'evaluations', label: 'Évaluations', done: evaluationsExpected > 0 && evaluationsCompleted >= evaluationsExpected, goto: 'documents', gestionSubTab: 'evaluations', evalSubTab: 'positionnement', scrollTarget: 'section-evaluations', action: 'Gérer', sub: [
                { label: 'Complétées', value: `${evaluationsCompleted}/${evaluationsExpected || 0}`, ok: evaluationsExpected > 0 && evaluationsCompleted >= evaluationsExpected },
                { label: 'Modèles actifs', value: `${evaluationKeys.size}/${evaluationsExpected || 0}`, ok: evaluationKeys.size > 0 },
            ]},
            { key: 'factures', label: 'Factures', done: false, goto: 'documents', gestionSubTab: 'finances', action: 'Gérer', detail: 'Aucune facture pour le moment' },
        ]
    };

    // ── ESPACE APPRENANT ──
    const completeFiches = inscriptions.filter(i => i.email && i.first_name && i.last_name).length;
    const espaceApprenant = {
        label: 'Espace Apprenant',
        icon: '🎓',
        color: 'var(--pillar-studio)',
        items: [
            { key: 'fiches', label: 'Fiches apprenants', done: nbApprenants > 0 && completeFiches === nbApprenants, detail: `${completeFiches}/${nbApprenants} fiches complètes`, goto: 'apprenants', scrollTarget: 'section-apprenants', action: 'Gérer' },
            { key: 'financement', label: 'Financements identifiés', done: inscriptions.filter(i => i.financement).length === nbApprenants && nbApprenants > 0, detail: `${inscriptions.filter(i => i.financement).length}/${nbApprenants} renseignés`, goto: 'apprenants', scrollTarget: 'section-apprenants', action: 'Gérer' },
        ]
    };

    // ── SUIVI ──
    const attestationsDone = inscriptions.filter(i => i.attestation_sent).length;
    const suivi = {
        label: 'Suivi',
        icon: '✅',
        color: 'var(--warning)',
        items: [
            { key: 'emargements', label: 'Émargements', done: !!(docs.emargement === 'signed'), goto: 'emargements', suiviSubTab: 'emargements', scrollTarget: 'section-emargements', action: 'Gérer', sub: [
                { label: 'Apprenants', value: `${docs.emargement === 'signed' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.emargement === 'signed' },
                { label: 'Intervenants', value: `${docs.emargement === 'signed' ? 1 : 0}/1`, ok: docs.emargement === 'signed' },
            ]},
            { key: 'certificats', label: 'Certificats', done: !!(docs.certificat === 'sent' || docs.certificat === 'signed'), goto: 'documents', gestionSubTab: 'conventions', scrollTarget: 'section-conventions', action: 'Gérer', sub: [
                { label: 'Documents générés', value: `${docs.certificat && docs.certificat !== 'none' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.certificat && docs.certificat !== 'none' },
                { label: 'Envoyés par e-mail', value: `${docs.certificat === 'sent' || docs.certificat === 'signed' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.certificat === 'sent' || docs.certificat === 'signed' },
            ]},
            { key: 'attestations', label: 'Attestations', done: nbApprenants > 0 && attestationsDone === nbApprenants, goto: 'documents', gestionSubTab: 'conventions', scrollTarget: 'section-conventions', action: 'Gérer', sub: [
                { label: 'Documents générés', value: `${docs.attestation && docs.attestation !== 'none' ? nbApprenants : 0}/${nbApprenants}`, ok: docs.attestation && docs.attestation !== 'none' },
                { label: 'Envoyés par e-mail', value: `${attestationsDone}/${nbApprenants}`, ok: attestationsDone === nbApprenants },
            ]},
        ]
    };

    return { configuration, gestion, espaceApprenant, suivi };
}

export function SessionsView(param) {
    let { sessions, formations, clients = [], onRefresh, initialSessionId, onSessionOpened, onSessionNavigate } = param;
    const confirm = useConfirm();
    const { toast } = useToast();
    var _sessionDetail_inscriptions, _sessionDetail_inscriptions1, _sessionDetail_inscriptions2;
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selected, setSelected] = useState(null);
    const [sessionDetail, setSessionDetail] = useState(null);
    const [emargements, setEmargements] = useState([]);
    const [suiviSubTab, setSuiviSubTab] = useState('emargements');
    const [configSubTab, setConfigSubTab] = useState('initialisation');
    const [lieuxList, setLieuxList] = useState([]);
    const [formateursList, setFormateursList] = useState([]);
    const [clientsList, setClientsList] = useState([]);
    const [showAddApprenant, setShowAddApprenant] = useState(false);
    const [apprenants, setApprenants] = useState([]);
    const [selectedApprenantId, setSelectedApprenantId] = useState('');
    const [viewMode, setViewMode] = useState('kanban');
    const [detailTab, setDetailTab] = useState('info');
    const [gestionSubTab, setGestionSubTab] = useState('conventions');
    const [pdfPreview, setPdfPreview] = useState(null); // { url, title } or null
    const [scrollTarget, setScrollTarget] = useState(null); // id to scroll to after tab change
    // ── Session modules (programme personnalisable) ──
    const [sessMods, setSessMods] = useState([]);
    const [sessModsLoading, setSessModsLoading] = useState(false);
    const [editingSm, setEditingSm] = useState(null);
    const [editSmData, setEditSmData] = useState({});
    // ── Evaluations (hoisted from gestionSubTab === 'evaluations' IIFE) ──
    const [evals, setEvals] = useState([]);
    const [evalsLoaded, setEvalsLoaded] = useState(false);
    const [evalSubTab, setEvalSubTab] = useState('positionnement');
    const [showEvalForm, setShowEvalForm] = useState(null); // apprenant_id
    const [evalScore, setEvalScore] = useState('');
    const [evalComments, setEvalComments] = useState('');
    // ── Filters ──
    const [searchQ, setSearchQ] = useState('');
    const [openFilter, setOpenFilter] = useState(null); // which dropdown is open
    const [filterType, setFilterType] = useState(null); // INTER | INTRA
    const [filterCat, setFilterCat] = useState(null); // formation categorie
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterAdvancement, setFilterAdvancement] = useState([]); // array of advancement filter keys
    // ── Sort ──
    const [sortField, setSortField] = useState('start_date'); // 'start_date' | 'remaining_steps'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
    // ── Calendar ──
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calPopover, setCalPopover] = useState(null); // { sessionId, x, y } or { newDate, x, y }
    // ── Advancement filter definitions ──
    const ADVANCEMENT_FILTERS = [
        { key: 'non_finalisees', label: 'Sessions non finalisées', test: (s, adv, _docs) => {
            let total = 0, done = 0;
            for (const pk of Object.keys(adv)) { if (adv[pk]?.items) { for (const it of adv[pk].items) { total++; if (it.done) done++; } } }
            return total > 0 && done < total;
        }},
        { key: 'devis_a_signer', label: 'Devis à signer', test: (_s, _adv, docs) => {
            return !docs.convention || docs.convention === 'none' || docs.convention === 'generated';
        }},
        { key: 'conventions_a_envoyer', label: 'Conventions à envoyer', test: (_s, adv, _docs) => {
            const item = adv.gestion?.items?.find(i => i.key === 'conventions_sent');
            return item && !item.done;
        }},
        { key: 'convocations_a_envoyer', label: 'Convocations à envoyer', test: (_s, adv, _docs) => {
            const item = adv.gestion?.items?.find(i => i.key === 'convocations_sent');
            return item && !item.done;
        }},
        { key: 'evaluations_a_remplir', label: 'Evaluations à remplir', test: (_s, adv, _docs) => {
            const items = [
                adv.pedagogie?.items?.find(i => i.key === 'eval_positionnement'),
                adv.pedagogie?.items?.find(i => i.key === 'eval_acquis'),
                adv.cloture?.items?.find(i => i.key === 'eval_satisfaction')
            ].filter(Boolean);
            return items.some(i => !i.done);
        }},
        { key: 'factures_a_payer', label: 'Factures à payer', test: (s, _adv, _docs) => {
            return !s.ca_confirmed || parseFloat(s.ca_confirmed) === 0;
        }},
        { key: 'espace_apprenant', label: 'Espace Apprenant à visiter', test: (_s, adv, _docs) => {
            const item = adv.pedagogie?.items?.find(i => i.key === 'livret_accueil');
            return item && !item.done;
        }},
        { key: 'emargements_a_remplir', label: 'Emargements à remplir', test: (_s, adv, _docs) => {
            const item = adv.suivi?.items?.find(i => i.key === 'emargements_ok');
            return item && !item.done;
        }}
    ];
    // ── Helper: get advancement + docs for a session ──
    const _getAdvForSession = (s) => {
        try {
            const raw = JSON.parse(s.advancement || '{}');
            return (raw && raw.configuration) ? raw : DEFAULT_ADVANCEMENT;
        } catch(e) { return DEFAULT_ADVANCEMENT; }
    };
    const _getDocsForSession = (s) => {
        try { return JSON.parse(s.documents || '{}'); } catch(e) { return {}; }
    };
    const _getRemainingSteps = (s) => {
        const adv = _getAdvForSession(s);
        let total = 0, done = 0;
        for (const pk of Object.keys(adv)) { if (adv[pk]?.items) { for (const it of adv[pk].items) { total++; if (it.done) done++; } } }
        return total - done;
    };
    // Filtered sessions
    const filteredSessions = sessions.filter((s)=>{
        if (searchQ) {
            const q = searchQ.toLowerCase();
            if (!(s.formation_title || '').toLowerCase().includes(q) && !(s.formation_code || '').toLowerCase().includes(q) && !(s.formateur_name || '').toLowerCase().includes(q) && !(s.location || '').toLowerCase().includes(q)) return false;
        }
        if (filterType && s.type_session !== filterType) return false;
        if (filterCat) {
            const f = formations.find((fm)=>fm.id === s.formation_id);
            if (!f || f.categorie !== filterCat) return false;
        }
        if (filterDateStart && s.start_date < filterDateStart) return false;
        if (filterDateEnd && s.end_date > filterDateEnd) return false;
        // Advancement filters
        if (filterAdvancement.length > 0) {
            const adv = _getAdvForSession(s);
            const docs = _getDocsForSession(s);
            const matchesAny = filterAdvancement.some(fk => {
                const def = ADVANCEMENT_FILTERS.find(af => af.key === fk);
                return def && def.test(s, adv, docs);
            });
            if (!matchesAny) return false;
        }
        return true;
    }).sort((a, b) => {
        let cmp = 0;
        if (sortField === 'start_date') {
            cmp = (a.start_date || '').localeCompare(b.start_date || '');
        } else if (sortField === 'remaining_steps') {
            cmp = _getRemainingSteps(a) - _getRemainingSteps(b);
        }
        return sortOrder === 'desc' ? -cmp : cmp;
    });
    const activeFilterCount = [
        filterType,
        filterCat,
        filterDateStart || filterDateEnd,
        filterAdvancement.length > 0 ? true : null
    ].filter(Boolean).length;
    const activeSortCount = (sortField !== 'start_date' || sortOrder !== 'asc') ? 1 : 0;
    const loadDetail = useCallback({
        "SessionsView.useCallback[loadDetail]": async (id)=>{
            const [d, em] = await Promise.all([
                api.get("/api/sessions/".concat(id)),
                api.get("/api/emargements?session_id=".concat(id))
            ]);
            setSessionDetail(d);
            setEmargements(em);
            try {
                const [lx, fm, cl] = await Promise.all([
                    api.get('/api/lieux-formation'),
                    api.get('/api/formateurs'),
                    api.get('/api/clients'),
                ]);
                setLieuxList(lx);
                setFormateursList(fm);
                setClientsList(cl);
            } catch(e) { console.warn('ref data fetch failed', e); }
        }
    }["SessionsView.useCallback[loadDetail]"], []);
    const handleSelect = async (s)=>{
        if (onSessionNavigate) {
            onSessionNavigate(s.id);
            return;
        }
        setSelected(s);
        setDetailTab('advancement');
        await loadDetail(s.id);
    };

    // Auto-open session when navigated from overview
    useEffect(() => {
        if (initialSessionId && sessions.length > 0) {
            const target = sessions.find(s => s.id === initialSessionId);
            if (target) {
                handleSelect(target);
                if (onSessionOpened) onSessionOpened();
            }
        }
    }, [initialSessionId, sessions]);

    // Scroll to target section after tab change (Avancement → section navigation)
    useEffect(() => {
        if (!scrollTarget) return;
        const timer = setTimeout(() => {
            const el = document.getElementById(scrollTarget);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash highlight effect
                el.style.transition = 'box-shadow 0.3s';
                el.style.boxShadow = '0 0 0 3px var(--gold-deep)';
                setTimeout(() => { el.style.boxShadow = 'none'; }, 2000);
            }
            setScrollTarget(null);
        }, 150); // small delay to let tab render
        return () => clearTimeout(timer);
    }, [scrollTarget, detailTab]);

    // Load session modules when session detail changes
    useEffect(() => {
        if (!sessionDetail?.id) { setSessMods([]); return; }
        setSessModsLoading(true);
        api.get(`/api/session-modules?session_id=${sessionDetail.id}`).then(data => {
            setSessMods(Array.isArray(data) ? data : []);
            setSessModsLoading(false);
        }).catch((e) => { console.warn('[Sessions] Modules non chargés :', e); setSessModsLoading(false); });
    }, [sessionDetail?.id]);

    // Load evaluations when session detail changes
    useEffect(() => {
        if (!sessionDetail?.id) { setEvals([]); setEvalsLoaded(false); return; }
        api.get(`/api/evaluations?session_id=${sessionDetail.id}`).then(data => {
            setEvals(Array.isArray(data) ? data : []);
            setEvalsLoaded(true);
        }).catch((e) => { console.warn('[Sessions] Évaluations non chargées :', e); setEvalsLoaded(true); });
    }, [sessionDetail?.id]);

    const handleCreate = async (data)=>{
        const r = await api.post('/api/sessions', data);
        if (!r?.__failed) toast.success('Session créée');
        setShowForm(false);
        onRefresh();
    };
    const handleEdit = async (data)=>{
        const r = await api.patch("/api/sessions/".concat(editing.id), data);
        if (!r?.__failed) toast.success('Session enregistrée');
        setEditing(null);
        onRefresh();
        if ((selected === null || selected === void 0 ? void 0 : selected.id) === editing.id) loadDetail(editing.id);
    };
    const handleDelete = async (id)=>{
        if (!(await confirm({ title: 'Supprimer cette session ?', confirmLabel: 'Supprimer' }))) return;
        const r = await api.del("/api/sessions/".concat(id));
        if (!r?.__failed) toast.success('Session supprimée');
        if ((selected === null || selected === void 0 ? void 0 : selected.id) === id) {
            setSelected(null);
            setSessionDetail(null);
        }
        onRefresh();
    };
    const handleStatusChange = async (id, newStatus)=>{
        await api.patch("/api/sessions/".concat(id), {
            status: newStatus
        });
        onRefresh();
        if ((selected === null || selected === void 0 ? void 0 : selected.id) === id) loadDetail(id);
    };
    const handleAddApprenant = async ()=>{
        if (!selectedApprenantId || !selected) return;
        await api.post('/api/inscriptions', {
            session_id: selected.id,
            apprenant_id: selectedApprenantId
        });
        setShowAddApprenant(false);
        setSelectedApprenantId('');
        loadDetail(selected.id);
    };
    const handleToggleEmargement = async (emId, field, current)=>{
        await api.patch('/api/emargements', {
            id: emId,
            [field]: current ? 0 : 1
        });
        const em = await api.get("/api/emargements?session_id=".concat(selected.id));
        setEmargements(em);
    };
    const handleInscriptionStatus = async (inscId, status)=>{
        await api.patch('/api/inscriptions', {
            id: inscId,
            status
        });
        loadDetail(selected.id);
    };
    const handleInscriptionFlag = async (inscId, field, current)=>{
        const updated = await api.patch('/api/inscriptions', {
            id: inscId,
            [field]: current ? 0 : 1
        });
        if (updated && !updated.__failed) {
            toast.success(current ? 'Statut annulé' : 'Statut mis à jour');
            loadDetail(selected.id);
        }
    };
    const openAdvancementItem = (item)=>{
        if (!item.goto) return;
        setDetailTab(item.goto);
        if (item.configSubTab) setConfigSubTab(item.configSubTab);
        if (item.gestionSubTab) setGestionSubTab(item.gestionSubTab);
        if (item.suiviSubTab) setSuiviSubTab(item.suiviSubTab);
        if (item.evalSubTab) setEvalSubTab(item.evalSubTab);
        if (item.scrollTarget) setScrollTarget(item.scrollTarget);
    };
    // ── Advancement helpers ──
    const getAdvancement = (sess)=>{
        if (!sess) return DEFAULT_ADVANCEMENT;
        try {
            const raw = JSON.parse(sess.advancement || '{}');
            if (!raw || !raw.configuration) return DEFAULT_ADVANCEMENT;
            return raw;
        } catch (e) {
            return DEFAULT_ADVANCEMENT;
        }
    };
    const toggleAdvItem = async (phaseKey, itemKey)=>{
        if (!sessionDetail) return;
        const adv = getAdvancement(sessionDetail);
        const phase = adv[phaseKey];
        if (!phase) return;
        phase.items = phase.items.map((it)=>it.key === itemKey ? {
                ...it,
                done: !it.done
            } : it);
        const updated = {
            ...adv,
            [phaseKey]: phase
        };
        await api.patch("/api/sessions/".concat(sessionDetail.id), {
            advancement: updated
        });
        setSessionDetail((d)=>({
                ...d,
                advancement: JSON.stringify(updated)
            }));
    };
    const getAdvancementScore = (adv)=>{
        let total = 0, done = 0;
        for (const pk of Object.keys(adv)){
            var _adv_pk;
            if ((_adv_pk = adv[pk]) === null || _adv_pk === void 0 ? void 0 : _adv_pk.items) {
                for (const it of adv[pk].items){
                    total++;
                    if (it.done) done++;
                }
            }
        }
        return total > 0 ? Math.round(done / total * 100) : 0;
    };
    // ── Documents helpers ──
    const getDocuments = (sess)=>{
        try {
            const d = JSON.parse((sess === null || sess === void 0 ? void 0 : sess.documents) || '{}');
            return d;
        } catch (e) {
            return {};
        }
    };
    const setDocStatus = async (docKey, next)=>{
        if (!sessionDetail) return;
        const docs = getDocuments(sessionDetail);
        const timestamp = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const updated = {
            ...docs,
            [docKey]: next,
            [docKey + '_updated_at']: timestamp,
            ...(next !== 'none' ? { [docKey + '_' + next + '_at']: timestamp } : {}),
            ...(next === 'generated' ? { [docKey + '_date']: timestamp } : {}),
        };
        const saved = await api.patch("/api/sessions/".concat(sessionDetail.id), {
            documents: updated
        });
        if (saved?.__failed) {
            toast.error('La mise à jour du document a échoué.');
            return;
        }
        setSessionDetail((d)=>({
                ...d,
                documents: JSON.stringify(updated)
            }));
        toast.success(next === 'generated' ? 'Document généré et daté' : next === 'sent' ? 'Envoi enregistré et daté' : next === 'signed' ? 'Signature enregistrée et datée' : 'Statut du document mis à jour');
    };
    const cycleDocStatus = async (docKey)=>{
        if (!sessionDetail) return;
        const docs = getDocuments(sessionDetail);
        const order = ['none', 'generated', 'sent', 'signed'];
        const current = docs[docKey] || 'none';
        const next = order[(order.indexOf(current) + 1) % order.length];
        return setDocStatus(docKey, next);
    };
    // ── Financial ──
    const getCA = (detail)=>{
        if (!(detail === null || detail === void 0 ? void 0 : detail.inscriptions)) return 0;
        return detail.inscriptions.filter((i)=>i.status !== 'annule').reduce((s, i)=>s + (i.price_ht || 0), 0);
    };
    const emByDate = emargements.reduce((acc, e)=>{
        if (!acc[e.date]) acc[e.date] = [];
        acc[e.date].push(e);
        return acc;
    }, {});
    // ── Kanban columns ──
    const KANBAN_COLS = [
        {
            key: 'planned',
            label: 'Planifiées',
            color: 'var(--gold-deep)',
            icon: '📋'
        },
        {
            key: 'ongoing',
            label: 'En cours',
            color: 'var(--info)',
            icon: '▶'
        },
        {
            key: 'completed',
            label: 'Terminées',
            color: 'var(--success)',
            icon: '✓'
        },
        {
            key: 'cancelled',
            label: 'Annulées',
            color: 'var(--danger)',
            icon: '✗'
        }
    ];
    const byStatus = {};
    KANBAN_COLS.forEach((c)=>{
        byStatus[c.key] = filteredSessions.filter((s)=>s.status === c.key);
    });
    // ── KPI bar ──
    const caTotal = sessions.reduce((sum, s)=>{
        const t = parseFloat(s.tarif) || 0;
        const n = s.inscriptions_count || 0;
        return sum + (t > 0 ? t * n : 0);
    }, 0);
    // ── Drag & drop state ──
    const [draggedSessionId, setDraggedSessionId] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);

    const handleDrop = async (targetStatus) => {
        setDragOverCol(null);
        if (!draggedSessionId) return;
        const session = sessions.find(s => s.id === draggedSessionId);
        if (!session || session.status === targetStatus) { setDraggedSessionId(null); return; }
        try {
            await api.patch(`/api/sessions/${draggedSessionId}`, { status: targetStatus });
            onRefresh();
        } catch (e) {
            console.error('Erreur changement statut session:', e);
        }
        setDraggedSessionId(null);
    };

    // ── Session card (kanban — Digiforma style) ──
    const KanbanCard = (param)=>{
        let { s } = param;
        const isSelected = (selected === null || selected === void 0 ? void 0 : selected.id) === s.id;
        const smart = computeSmartAdvancement(s);
        const phases = smart ? [smart.configuration, smart.gestion, smart.espaceApprenant, smart.suivi] : [];
        let advTotal = 0, advDone = 0;
        phases.forEach(ph => { ph.items.forEach(it => { advTotal++; if (it.done) advDone++; }); });
        const advScore = advTotal > 0 ? Math.round(advDone / advTotal * 100) : 0;
        return /*#__PURE__*/ _jsx("div", {
            draggable: true,
            onDragStart: (e) => {
                setDraggedSessionId(s.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', s.id);
                e.currentTarget.style.opacity = '0.5';
            },
            onDragEnd: (e) => {
                e.currentTarget.style.opacity = '1';
                setDraggedSessionId(null);
                setDragOverCol(null);
            },
            onClick: ()=>handleSelect(s),
            style: {
                background: isSelected ? T.goldDim : T.card,
                border: "1px solid ".concat(isSelected ? alpha(T.gold, 33) : T.border2),
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'grab',
                transition: 'all 0.15s',
                position: 'relative'
            },
            onMouseEnter: (e)=>{
                if (!isSelected) e.currentTarget.style.borderColor = T.border3;
            },
            onMouseLeave: (e)=>{
                if (!isSelected) e.currentTarget.style.borderColor = T.border2;
            },
            children: [
                /*#__PURE__*/ _jsx("div", {
                    style: {
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.gold,
                        marginBottom: 4,
                        lineHeight: 1.3
                    },
                    children: [s.client_company ? `${s.client_company} - ` : '', s.formation_title].join('')
                }, void 0, false),
                /*#__PURE__*/ _jsx("div", {
                    style: {
                        fontSize: 10,
                        color: T.textDim,
                        fontFamily: T.mono,
                        fontWeight: 700,
                        marginBottom: 8
                    },
                    children: s.code_interne || s.formation_code
                }, void 0, false),
                (s.start_date || s.end_date) && /*#__PURE__*/ _jsx("div", {
                    style: {
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.text,
                        marginBottom: 3
                    },
                    children: [
                        fmtDateRange(s.start_date, s.end_date),
                        s.location && /*#__PURE__*/ _jsx("span", {
                            style: {
                                color: T.textMuted,
                                fontWeight: 400
                            },
                            children: [
                                " à ",
                                s.location
                            ]
                        }, void 0, true)
                    ]
                }, void 0, true),
                s.formateur_name && /*#__PURE__*/ _jsx("div", {
                    style: {
                        fontSize: 11,
                        color: T.textSub,
                        marginBottom: 6
                    },
                    children: [
                        "👤 ",
                        s.formateur_name
                    ]
                }, void 0, true),
                /*#__PURE__*/ _jsx("div", {
                    style: {
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                        fontSize: 11,
                        color: T.textMuted,
                        marginBottom: 8
                    },
                    children: [
                        /*#__PURE__*/ _jsx("span", {
                            title: "Émargements",
                            children: [
                                "📋 ",
                                s.inscriptions_count || 0
                            ]
                        }, void 0, true),
                        s.client_company && /*#__PURE__*/ _jsx("span", {
                            style: {
                                color: T.purple,
                                fontWeight: 600
                            },
                            children: s.client_company
                        }, void 0, false),
                        s.type_session === 'INTRA' && /*#__PURE__*/ _jsx("span", {
                            style: {
                                fontSize: 9,
                                color: T.purple,
                                background: alpha(T.purple, 9),
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontWeight: 700
                            },
                            children: "INTRA"
                        }, void 0, false)
                    ]
                }, void 0, true),
                /*#__PURE__*/ _jsx("div", {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    },
                    children: [
                        ...phases.map((ph, pi) => {
                            const phDone = ph.items.filter(it => it.done).length;
                            const phTotal = ph.items.length;
                            const allDone = phDone === phTotal;
                            return /*#__PURE__*/ _jsx("div", {
                                title: `${ph.label}: ${phDone}/${phTotal}`,
                                style: {
                                    display: 'flex', alignItems: 'center', gap: 3,
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: allDone ? ph.color : 'transparent',
                                            border: `2px solid ${ph.color}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 6, color: 'var(--on-solid)', fontWeight: 700,
                                        },
                                        children: allDone ? '✓' : ''
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("span", {
                                        style: { fontSize: 9, color: ph.color, fontFamily: T.mono, fontWeight: 700 },
                                        children: `${phDone}/${phTotal}`
                                    }, void 0, false)
                                ]
                            }, pi, true);
                        }),
                        /*#__PURE__*/ _jsx("span", {
                            style: {
                                fontSize: 10,
                                fontWeight: 700,
                                color: advScore === 100 ? T.green : T.textMuted,
                                fontFamily: T.mono,
                                marginLeft: 'auto',
                            },
                            children: `${advDone}/${advTotal}`
                        }, void 0, false)
                    ]
                }, void 0, true)
            ]
        }, void 0, true);
    };
    // ── Detail tabs ──
    const DETAIL_TABS = [
        {
            id: 'advancement',
            label: 'Avancement',
            icon: '◈',
            color: 'var(--text)'
        },
        {
            id: 'info',
            label: 'Configuration',
            icon: '⚙️',
            color: 'var(--pillar-prod)'
        },
        {
            id: 'programme',
            label: 'Programme',
            icon: '📐',
            color: 'var(--warning)'
        },
        {
            id: 'documents',
            label: 'Gestion',
            icon: '📋',
            color: 'var(--success)'
        },
        {
            id: 'apprenants',
            label: 'Apprenants',
            icon: '🎓',
            color: 'var(--pillar-studio)'
        },
        {
            id: 'emargements',
            label: 'Suivi',
            icon: '✅',
            color: 'var(--warning)'
        }
    ];
    // ── Filter dropdown component ──
    const FilterChip = (param)=>{
        let { id, label, children } = param;
        const isOpen = openFilter === id;
        return /*#__PURE__*/ _jsx("div", {
            style: {
                position: 'relative'
            },
            children: [
                /*#__PURE__*/ _jsx("button", {
                    onClick: ()=>setOpenFilter(isOpen ? null : id),
                    style: {
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: "1px solid ".concat(isOpen ? T.gold : T.border3),
                        background: isOpen ? T.goldDim : 'transparent',
                        color: isOpen ? T.gold : T.textSub,
                        fontFamily: T.font,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap'
                    },
                    children: label
                }, void 0, false),
                isOpen && /*#__PURE__*/ _jsx(_Fragment, {
                    children: [
                        /*#__PURE__*/ _jsx("div", {
                            style: {
                                position: 'fixed',
                                inset: 0,
                                zIndex: 90
                            },
                            onClick: ()=>setOpenFilter(null)
                        }, void 0, false),
                        /*#__PURE__*/ _jsx("div", {
                            style: {
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 4,
                                zIndex: 100,
                                background: 'var(--surface-2)',
                                border: "1px solid ".concat(T.border3),
                                borderRadius: 10,
                                padding: '8px 0',
                                minWidth: 200,
                                boxShadow: 'var(--shadow-lg)'
                            },
                            children: children
                        }, void 0, false)
                    ]
                }, void 0, true)
            ]
        }, void 0, true);
    };
    const FilterOption = (param)=>{
        let { label, active, onClick } = param;
        return /*#__PURE__*/ _jsx("div", {
            onClick: onClick,
            style: {
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                color: active ? T.gold : T.text,
                fontWeight: active ? 700 : 400
            },
            onMouseEnter: (e)=>e.currentTarget.style.background = T.goldDim,
            onMouseLeave: (e)=>e.currentTarget.style.background = 'transparent',
            children: [
                /*#__PURE__*/ _jsx("span", {
                    children: label
                }, void 0, false),
                /*#__PURE__*/ _jsx("span", {
                    style: {
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: "2px solid ".concat(active ? T.gold : T.textDim),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: active ? T.gold : 'transparent',
                        fontWeight: 800
                    },
                    children: active ? '✓' : ''
                }, void 0, false)
            ]
        }, void 0, true);
    };
    // ── Unique categories in sessions ──
    const sessionCats = [
        ...new Set(sessions.map((s)=>{
            const f = formations.find((fm)=>fm.id === s.formation_id);
            return f === null || f === void 0 ? void 0 : f.categorie;
        }).filter(Boolean))
    ];
    return /*#__PURE__*/ _jsx("div", {
        children: [
            !(selected && sessionDetail) && /*#__PURE__*/ _jsx("div", {
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16
                },
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        children: [
                            /*#__PURE__*/ _jsx("h2", {
                                style: {
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: T.text,
                                    margin: 0
                                },
                                children: "Toutes mes sessions"
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    fontSize: 11,
                                    color: T.textMuted,
                                    marginTop: 2
                                },
                                children: [
                                    filteredSessions.length,
                                    " session",
                                    filteredSessions.length !== 1 ? 's' : '',
                                    " — CA estimé : ",
                                    caTotal.toLocaleString('fr-FR'),
                                    "€"
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx("button", {
                        style: btnPrimary,
                        onClick: ()=>setShowForm(true),
                        children: "+ Créer une session"
                    }, void 0, false)
                ]
            }, void 0, true),
            !(selected && sessionDetail) && /*#__PURE__*/ _jsx("div", {
                style: {
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 18,
                    flexWrap: 'wrap'
                },
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            position: 'relative',
                            minWidth: 180
                        },
                        children: [
                            /*#__PURE__*/ _jsx("span", {
                                style: {
                                    position: 'absolute',
                                    left: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: 13,
                                    color: T.textDim,
                                    pointerEvents: 'none'
                                },
                                children: "🔍"
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("input", {
                                style: {
                                    ...inputStyle,
                                    paddingLeft: 30,
                                    fontSize: 12,
                                    padding: '7px 12px 7px 30px'
                                },
                                value: searchQ,
                                onChange: (e)=>setSearchQ(e.target.value),
                                placeholder: "Rechercher…"
                            }, void 0, false)
                        ]
                    }, void 0, true),
                    (activeFilterCount + activeSortCount) > 0 && /*#__PURE__*/ _jsx("span", {
                        style: {
                            padding: '5px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.gold,
                            background: T.goldDim,
                            border: "1px solid ".concat(alpha(T.gold, 27))
                        },
                        children: [
                            "Filtres ",
                            activeFilterCount + activeSortCount
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx(FilterChip, {
                        id: "date",
                        label: "Date de session",
                        children: /*#__PURE__*/ _jsx("div", {
                            style: {
                                padding: '12px 16px'
                            },
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        fontSize: 11,
                                        color: T.textDim,
                                        marginBottom: 6,
                                        textTransform: 'uppercase'
                                    },
                                    children: "Date de début"
                                }, void 0, false),
                                /*#__PURE__*/ _jsx("input", {
                                    type: "date",
                                    style: {
                                        ...inputStyle,
                                        fontSize: 12
                                    },
                                    value: filterDateStart,
                                    onChange: (e)=>setFilterDateStart(e.target.value)
                                }, void 0, false),
                                /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        fontSize: 11,
                                        color: T.textDim,
                                        marginBottom: 6,
                                        marginTop: 10,
                                        textTransform: 'uppercase'
                                    },
                                    children: "Date de fin"
                                }, void 0, false),
                                /*#__PURE__*/ _jsx("input", {
                                    type: "date",
                                    style: {
                                        ...inputStyle,
                                        fontSize: 12
                                    },
                                    value: filterDateEnd,
                                    onChange: (e)=>setFilterDateEnd(e.target.value)
                                }, void 0, false)
                            ]
                        }, void 0, true)
                    }, void 0, false),
                    /*#__PURE__*/ _jsx(FilterChip, {
                        id: "type",
                        label: "Inter / Intra",
                        children: [
                            /*#__PURE__*/ _jsx(FilterOption, {
                                label: "Inter",
                                active: filterType === 'INTER',
                                onClick: ()=>{
                                    setFilterType(filterType === 'INTER' ? null : 'INTER');
                                    setOpenFilter(null);
                                }
                            }, void 0, false),
                            /*#__PURE__*/ _jsx(FilterOption, {
                                label: "Intra",
                                active: filterType === 'INTRA',
                                onClick: ()=>{
                                    setFilterType(filterType === 'INTRA' ? null : 'INTRA');
                                    setOpenFilter(null);
                                }
                            }, void 0, false)
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx(FilterChip, {
                        id: "advancement",
                        label: filterAdvancement.length > 0 ? "Avancement ".concat(filterAdvancement.length) : "Avancement",
                        children: ADVANCEMENT_FILTERS.map((af)=>{
                            const isActive = filterAdvancement.includes(af.key);
                            return /*#__PURE__*/ _jsx(FilterOption, {
                                label: af.label,
                                active: isActive,
                                onClick: ()=>{
                                    setFilterAdvancement(prev => isActive ? prev.filter(k => k !== af.key) : [...prev, af.key]);
                                }
                            }, af.key, false);
                        })
                    }, void 0, false),
                    /*#__PURE__*/ _jsx(FilterChip, {
                        id: "sort",
                        label: activeSortCount > 0 ? "Trier ".concat(activeSortCount + 1) : "Trier",
                        children: /*#__PURE__*/ _jsx("div", {
                            style: { padding: '8px 0' },
                            children: [
                                /*#__PURE__*/ _jsx("div", {
                                    style: { padding: '4px 16px', fontSize: 10, color: T.textDim, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 },
                                    children: "Champ"
                                }, void 0, false),
                                /*#__PURE__*/ _jsx(FilterOption, {
                                    label: "Date de début de la session",
                                    active: sortField === 'start_date',
                                    onClick: ()=> setSortField('start_date')
                                }, void 0, false),
                                /*#__PURE__*/ _jsx(FilterOption, {
                                    label: "Nombre d'étapes restantes",
                                    active: sortField === 'remaining_steps',
                                    onClick: ()=> setSortField('remaining_steps')
                                }, void 0, false),
                                /*#__PURE__*/ _jsx("div", {
                                    style: { height: 1, background: T.border2, margin: '8px 0' }
                                }, void 0, false),
                                /*#__PURE__*/ _jsx("div", {
                                    style: { padding: '4px 16px', fontSize: 10, color: T.textDim, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1 },
                                    children: "Ordre"
                                }, void 0, false),
                                /*#__PURE__*/ _jsx(FilterOption, {
                                    label: "Croissant",
                                    active: sortOrder === 'asc',
                                    onClick: ()=> setSortOrder('asc')
                                }, void 0, false),
                                /*#__PURE__*/ _jsx(FilterOption, {
                                    label: "Décroissant",
                                    active: sortOrder === 'desc',
                                    onClick: ()=> setSortOrder('desc')
                                }, void 0, false)
                            ]
                        }, void 0, true)
                    }, void 0, false),
                    sessionCats.length > 0 && /*#__PURE__*/ _jsx(FilterChip, {
                        id: "cat",
                        label: "Catégorie",
                        children: sessionCats.map((cat)=>{
                            var _FORMATION_CATEGORIES_find;
                            const f = formations.find((fm)=>fm.categorie === cat);
                            const label = ((_FORMATION_CATEGORIES_find = FORMATION_CATEGORIES.find((c)=>c.value === cat)) === null || _FORMATION_CATEGORIES_find === void 0 ? void 0 : _FORMATION_CATEGORIES_find.label) || cat;
                            return /*#__PURE__*/ _jsx(FilterOption, {
                                label: label,
                                active: filterCat === cat,
                                onClick: ()=>{
                                    setFilterCat(filterCat === cat ? null : cat);
                                    setOpenFilter(null);
                                }
                            }, cat, false);
                        })
                    }, void 0, false),
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            marginLeft: 'auto',
                            display: 'flex',
                            border: "1px solid ".concat(T.border3),
                            borderRadius: 6,
                            overflow: 'hidden'
                        },
                        children: [
                            {
                                k: 'kanban',
                                l: '▦'
                            },
                            {
                                k: 'list',
                                l: '☰'
                            },
                            {
                                k: 'calendar',
                                l: '📅'
                            }
                        ].map((v)=>/*#__PURE__*/ _jsx("button", {
                                onClick: ()=>setViewMode(v.k),
                                style: {
                                    padding: '6px 10px',
                                    border: 'none',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    background: viewMode === v.k ? T.goldDim : 'transparent',
                                    color: viewMode === v.k ? T.gold : T.textMuted
                                },
                                children: v.l
                            }, v.k, false))
                    }, void 0, false),
                    (activeFilterCount > 0 || activeSortCount > 0) && /*#__PURE__*/ _jsx("button", {
                        onClick: ()=>{
                            setFilterType(null);
                            setFilterCat(null);
                            setFilterDateStart('');
                            setFilterDateEnd('');
                            setSearchQ('');
                            setFilterAdvancement([]);
                            setSortField('start_date');
                            setSortOrder('asc');
                        },
                        style: {
                            ...btnSecondary,
                            padding: '7px 12px',
                            fontSize: 11
                        },
                        children: "✕ Effacer tout"
                    }, void 0, false)
                ]
            }, void 0, true),
            !(selected && sessionDetail) && viewMode === 'kanban' && /*#__PURE__*/ _jsx("div", {
                className: "resp-kanban",
                style: {
                    display: 'grid',
                    gridTemplateColumns: "repeat(".concat(KANBAN_COLS.length, ", 1fr)"),
                    gap: 12,
                    marginBottom: selected ? 24 : 0
                },
                children: KANBAN_COLS.map((col)=>{
                    var _byStatus_col_key;
                    const isDropTarget = dragOverCol === col.key && draggedSessionId;
                    return /*#__PURE__*/ _jsx("div", {
                        onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.key); },
                        onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); },
                        onDrop: (e) => { e.preventDefault(); handleDrop(col.key); },
                        style: {
                            background: isDropTarget ? alpha(col.color, 3) : T.card,
                            border: "1px solid ".concat(isDropTarget ? alpha(col.color, 40) : T.border2),
                            borderRadius: 10,
                            minHeight: 200,
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'background 0.15s, border-color 0.15s'
                        },
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    padding: '12px 14px',
                                    borderBottom: "1px solid ".concat(T.border),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        },
                                        children: [
                                            /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    fontSize: 12,
                                                    opacity: 0.7
                                                },
                                                children: col.icon
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx("span", {
                                                style: {
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: col.color
                                                },
                                                children: col.label
                                            }, void 0, false)
                                        ]
                                    }, void 0, true),
                                    /*#__PURE__*/ _jsx("span", {
                                        style: {
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: T.textDim,
                                            background: T.border2,
                                            padding: '2px 7px',
                                            borderRadius: 10
                                        },
                                        children: ((_byStatus_col_key = byStatus[col.key]) === null || _byStatus_col_key === void 0 ? void 0 : _byStatus_col_key.length) || 0
                                    }, void 0, false)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    padding: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    flex: 1,
                                    overflowY: 'auto',
                                    maxHeight: 400
                                },
                                children: (byStatus[col.key] || []).length === 0 ? /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        textAlign: 'center',
                                        padding: '24px 0',
                                        color: T.textDim,
                                        fontSize: 11
                                    },
                                    children: "Aucune session"
                                }, void 0, false) : (byStatus[col.key] || []).map((s)=>/*#__PURE__*/ _jsx(KanbanCard, {
                                        s: s
                                    }, s.id, false))
                            }, void 0, false)
                        ]
                    }, col.key, true);
                })
            }, void 0, false),
            !(selected && sessionDetail) && viewMode === 'list' && /*#__PURE__*/ _jsx("div", {
                className: "resp-grid-1col",
                style: {
                    display: 'grid',
                    gridTemplateColumns: '340px 1fr',
                    gap: 20,
                    alignItems: 'start',
                    marginBottom: 0
                },
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        },
                        children: filteredSessions.length === 0 ? /*#__PURE__*/ _jsx("div", {
                            style: {
                                textAlign: 'center',
                                padding: '40px 0',
                                color: T.textMuted,
                                fontSize: 13
                            },
                            children: "📅 Aucune session"
                        }, void 0, false) : filteredSessions.map((s)=>/*#__PURE__*/ _jsx("div", {
                                onClick: ()=>handleSelect(s),
                                style: {
                                    background: (selected === null || selected === void 0 ? void 0 : selected.id) === s.id ? T.goldDim : T.card,
                                    border: "1px solid ".concat((selected === null || selected === void 0 ? void 0 : selected.id) === s.id ? alpha(T.gold, 33) : T.border2),
                                    borderRadius: 8,
                                    padding: '12px 14px',
                                    cursor: 'pointer'
                                },
                                children: /*#__PURE__*/ _jsx("div", {
                                    style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: 8
                                    },
                                    children: [
                                        /*#__PURE__*/ _jsx("div", {
                                            style: {
                                                flex: 1,
                                                minWidth: 0
                                            },
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        fontSize: 10,
                                                        color: T.textDim,
                                                        fontFamily: T.mono
                                                    },
                                                    children: s.code_interne || s.formation_code
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: T.text,
                                                        marginBottom: 3
                                                    },
                                                    children: [s.client_company ? `${s.client_company} - ` : '', s.formation_title].join('')
                                                }, void 0, false),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        fontSize: 11,
                                                        color: T.textSub
                                                    },
                                                    children: fmtDateRange(s.start_date, s.end_date)
                                                }, void 0, false)
                                            ]
                                        }, void 0, true),
                                        /*#__PURE__*/ _jsx(Badge, {
                                            status: s.status
                                        }, void 0, false)
                                    ]
                                }, void 0, true)
                            }, s.id, false))
                    }, void 0, false),
                    !selected && /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 200,
                            border: "1px solid ".concat(T.border),
                            borderRadius: 10,
                            color: T.textMuted,
                            fontSize: 13
                        },
                        children: "Sélectionne une session"
                    }, void 0, false)
                ]
            }, void 0, true),
            !(selected && sessionDetail) && viewMode === 'calendar' && (()=>{
                const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
                const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
                const cells = [];
                for (let i = 0; i < firstDow; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);
                const pad = (n) => String(n).padStart(2, '0');
                const STATUS_COLORS = { planned: 'var(--gold-deep)', ongoing: 'var(--info)', completed: 'var(--success)', cancelled: 'var(--danger)' };
                const STATUS_LABELS = { planned: 'Planifiée', ongoing: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
                const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); setCalPopover(null); };
                const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); setCalPopover(null); };
                const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                const popoverSession = calPopover?.sessionId ? filteredSessions.find(s => s.id === calPopover.sessionId) : null;
                return /*#__PURE__*/ _jsx("div", {
                    style: { background: T.card, border: "1px solid ".concat(T.border2), borderRadius: 12, overflow: 'hidden', position: 'relative' },
                    children: [
                        /*#__PURE__*/ _jsx("div", {
                            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: "1px solid ".concat(T.border) },
                            children: [
                                /*#__PURE__*/ _jsx("button", { onClick: prevMonth, style: { background: 'none', border: "1px solid ".concat(T.border3), borderRadius: 6, color: T.text, cursor: 'pointer', padding: '6px 12px', fontSize: 14, fontFamily: T.font }, children: '‹' }, void 0, false),
                                /*#__PURE__*/ _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }, children: "".concat(MONTHS_FR[calMonth], " ").concat(calYear) }, void 0, false),
                                /*#__PURE__*/ _jsx("button", { onClick: nextMonth, style: { background: 'none', border: "1px solid ".concat(T.border3), borderRadius: 6, color: T.text, cursor: 'pointer', padding: '6px 12px', fontSize: 14, fontFamily: T.font }, children: '›' }, void 0, false)
                            ]
                        }, void 0, true),
                        /* Legend */
                        /*#__PURE__*/ _jsx("div", {
                            style: { display: 'flex', gap: 14, padding: '8px 20px', borderBottom: "1px solid ".concat(T.border) },
                            children: Object.entries(STATUS_COLORS).map(([k, c]) => /*#__PURE__*/ _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.textDim }, children: [
                                /*#__PURE__*/ _jsx("div", { style: { width: 8, height: 8, borderRadius: 2, background: c } }, void 0, false),
                                STATUS_LABELS[k]
                            ] }, k, true))
                        }, void 0, false),
                        /*#__PURE__*/ _jsx("div", {
                            style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
                            children: [
                                ...DAYS_FR.map((d) => /*#__PURE__*/ _jsx("div", { style: { padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', borderBottom: "1px solid ".concat(T.border) }, children: d }, d, false)),
                                ...cells.map((day, idx) => {
                                    if (!day) return /*#__PURE__*/ _jsx("div", { style: { minHeight: 100, background: 'var(--bg)', borderBottom: "1px solid ".concat(T.border), borderRight: idx % 7 !== 6 ? "1px solid ".concat(T.border) : 'none' } }, "e".concat(idx), false);
                                    const dateStr = "".concat(calYear, "-").concat(pad(calMonth + 1), "-").concat(pad(day));
                                    const isToday = dateStr === new Date().toISOString().slice(0, 10);
                                    const daySessions = filteredSessions.filter(s => s.start_date <= dateStr && (s.end_date || s.start_date) >= dateStr);
                                    return /*#__PURE__*/ _jsx("div", {
                                        onClick: (e) => {
                                            if (daySessions.length === 0) {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setCalPopover({ newDate: dateStr, x: rect.left + rect.width / 2, y: rect.bottom });
                                            }
                                        },
                                        style: { minHeight: 100, padding: '4px 6px', background: isToday ? T.goldDim : 'transparent', borderBottom: "1px solid ".concat(T.border), borderRight: idx % 7 !== 6 ? "1px solid ".concat(T.border) : 'none', cursor: 'pointer', transition: 'background 0.1s' },
                                        onMouseEnter: (e) => { if (!isToday) e.currentTarget.style.background = 'var(--hover)'; },
                                        onMouseLeave: (e) => { if (!isToday) e.currentTarget.style.background = 'transparent'; },
                                        children: [
                                            /*#__PURE__*/ _jsx("div", { style: { fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? T.gold : T.textSub, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }, children: [
                                                isToday && /*#__PURE__*/ _jsx("span", { style: { background: T.gold, color: 'var(--gold-ink)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }, children: day }, void 0, false),
                                                !isToday && day
                                            ] }, void 0, true),
                                            ...daySessions.slice(0, 3).map((s) => /*#__PURE__*/ _jsx("div", {
                                                onClick: (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setCalPopover({ sessionId: s.id, x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                                                },
                                                style: { fontSize: 9, fontWeight: 600, padding: '3px 6px', marginBottom: 2, borderRadius: 4, background: alpha(STATUS_COLORS[s.status] || T.gold, 13), color: STATUS_COLORS[s.status] || T.gold, borderLeft: "3px solid ".concat(STATUS_COLORS[s.status] || T.gold), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', lineHeight: '16px', transition: 'all 0.1s' },
                                                onMouseEnter: (e) => { e.currentTarget.style.filter = 'brightness(1.3)'; },
                                                onMouseLeave: (e) => { e.currentTarget.style.filter = 'none'; },
                                                title: (s.client_company ? s.client_company + ' - ' : '') + s.formation_title,
                                                children: (s.client_company ? s.client_company + ' - ' : '') + s.formation_title
                                            }, s.id, false)),
                                            daySessions.length > 3 && /*#__PURE__*/ _jsx("div", { style: { fontSize: 9, color: T.textDim, textAlign: 'center', cursor: 'pointer' }, children: "+".concat(daySessions.length - 3, " autres") }, void 0, false)
                                        ]
                                    }, "d".concat(day), true);
                                })
                            ]
                        }, void 0, true),
                        /* ── Inline Popover ── */
                        calPopover && /*#__PURE__*/ _jsx(_Fragment, { children: [
                            /*#__PURE__*/ _jsx("div", { onClick: () => setCalPopover(null), style: { position: 'fixed', inset: 0, zIndex: 200 } }, void 0, false),
                            popoverSession ? /*#__PURE__*/ _jsx("div", {
                                style: { position: 'fixed', left: Math.min(calPopover.x - 140, window.innerWidth - 300), top: calPopover.y + 4, zIndex: 210, width: 280, background: 'var(--surface-2)', border: "1px solid ".concat(T.border3), borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-lg)' },
                                children: [
                                    /*#__PURE__*/ _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }, children: [
                                        /*#__PURE__*/ _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.gold, lineHeight: 1.3, flex: 1 }, children: (popoverSession.client_company ? popoverSession.client_company + ' - ' : '') + popoverSession.formation_title }, void 0, false),
                                        /*#__PURE__*/ _jsx("div", { onClick: () => setCalPopover(null), style: { cursor: 'pointer', color: T.textDim, fontSize: 14, marginLeft: 8, lineHeight: 1 }, children: '✕' }, void 0, false)
                                    ] }, void 0, true),
                                    /*#__PURE__*/ _jsx("div", { style: { fontSize: 10, fontFamily: T.mono, color: T.textDim, marginBottom: 10 }, children: popoverSession.formation_code }, void 0, false),
                                    /*#__PURE__*/ _jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 11, marginBottom: 12 }, children: [
                                        /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Dates' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: T.text, fontWeight: 600 }, children: fmtD(popoverSession.start_date).concat(' → ', fmtD(popoverSession.end_date)) }, void 0, false)] }, void 0, true),
                                        /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Statut' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: STATUS_COLORS[popoverSession.status] || T.text, fontWeight: 700 }, children: STATUS_LABELS[popoverSession.status] || popoverSession.status }, void 0, false)] }, void 0, true),
                                        popoverSession.formateur_name && /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Formateur' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: T.text }, children: popoverSession.formateur_name }, void 0, false)] }, void 0, true),
                                        popoverSession.location && /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Lieu' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: popoverSession.location }, void 0, false)] }, void 0, true),
                                        /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Inscrits' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: T.text, fontWeight: 600 }, children: popoverSession.inscriptions_count || 0 }, void 0, false)] }, void 0, true),
                                        /*#__PURE__*/ _jsx("div", { children: [/*#__PURE__*/ _jsx("div", { style: { color: T.textDim, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }, children: 'Tarif' }, void 0, false), /*#__PURE__*/ _jsx("div", { style: { color: T.text, fontWeight: 600 }, children: (popoverSession.tarif || 0).toLocaleString('fr-FR').concat(' €') }, void 0, false)] }, void 0, true)
                                    ] }, void 0, true),
                                    (()=>{
                                        const adv = _getAdvForSession(popoverSession);
                                        let total = 0, done = 0;
                                        for (const pk of Object.keys(adv)) { if (adv[pk]?.items) { for (const it of adv[pk].items) { total++; if (it.done) done++; } } }
                                        const pct = total > 0 ? Math.round(done / total * 100) : 0;
                                        return /*#__PURE__*/ _jsx("div", { style: { marginBottom: 12 }, children: [
                                            /*#__PURE__*/ _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textDim, marginBottom: 4 }, children: [
                                                /*#__PURE__*/ _jsx("span", { children: 'Avancement' }, void 0, false),
                                                /*#__PURE__*/ _jsx("span", { style: { fontWeight: 700, color: pct === 100 ? T.green : T.gold }, children: "".concat(done, "/").concat(total, " (").concat(pct, "%)") }, void 0, false)
                                            ] }, void 0, true),
                                            /*#__PURE__*/ _jsx("div", { style: { height: 5, borderRadius: 3, background: T.border2, overflow: 'hidden' }, children: /*#__PURE__*/ _jsx("div", { style: { width: "".concat(pct, "%"), height: '100%', borderRadius: 3, background: pct === 100 ? T.green : pct > 50 ? T.gold : T.blue, transition: 'width 0.3s' } }, void 0, false) }, void 0, false)
                                        ] }, void 0, true);
                                    })(),
                                    /*#__PURE__*/ _jsx("div", { style: { display: 'flex', gap: 8 }, children: [
                                        /*#__PURE__*/ _jsx("button", { onClick: () => { handleSelect(popoverSession); setCalPopover(null); }, style: { flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, background: T.gold, color: 'var(--gold-ink)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }, children: 'Voir détails' }, void 0, false),
                                        /*#__PURE__*/ _jsx("button", { onClick: () => { setEditing(popoverSession); setCalPopover(null); }, style: { flex: 1, padding: '7px 0', border: "1px solid ".concat(T.border3), borderRadius: 6, background: 'transparent', color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }, children: 'Modifier' }, void 0, false)
                                    ] }, void 0, true)
                                ]
                            }, void 0, true) :
                            calPopover?.newDate ? /*#__PURE__*/ _jsx("div", {
                                style: { position: 'fixed', left: Math.min(calPopover.x - 100, window.innerWidth - 220), top: calPopover.y + 4, zIndex: 210, width: 200, background: 'var(--surface-2)', border: "1px solid ".concat(T.border3), borderRadius: 10, padding: '12px 14px', boxShadow: 'var(--shadow-lg)' },
                                children: [
                                    /*#__PURE__*/ _jsx("div", { style: { fontSize: 11, color: T.textDim, marginBottom: 8 }, children: fmtD(calPopover.newDate) }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", { onClick: () => { setShowForm(true); setCalPopover(null); }, style: { width: '100%', padding: '8px 0', border: 'none', borderRadius: 6, background: T.gold, color: 'var(--gold-ink)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }, children: '+ Créer une session' }, void 0, false)
                                ]
                            }, void 0, true) : null
                        ] }, void 0, true)
                    ]
                }, void 0, true);
            })(),
            selected && sessionDetail && /*#__PURE__*/ _jsx("div", {
                style: {
                    background: T.card,
                    border: "1px solid ".concat(T.border2),
                    borderRadius: 12,
                    overflow: 'hidden',
                },
                children: [
                    /* Breadcrumb navigation */
                    _jsx("div", {
                        style: { padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textMuted },
                        children: [
                            _jsx("button", {
                                onClick: () => { setSelected(null); setSessionDetail(null); },
                                style: { background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 12, padding: 0 },
                                children: "⊙ Toutes mes sessions"
                            }, void 0, false),
                            _jsx("span", { children: " › " }, void 0, false),
                            _jsx("span", { style: { color: T.text, fontWeight: 600 }, children: (sessionDetail.client_company ? sessionDetail.client_company + ' - ' : '') + sessionDetail.formation_title }, void 0, false),
                            detailTab !== 'advancement' && _jsx("span", { children: [" › ", _jsx("span", { style: { color: T.gold }, children: DETAIL_TABS.find(t => t.id === detailTab)?.label || '' }, void 0, false)] }, void 0, true),
                        ]
                    }, void 0, true),
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            padding: '16px 20px',
                            borderBottom: "1px solid ".concat(T.border),
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        },
                        children: [
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    fontSize: 10,
                                                    color: T.gold,
                                                    fontFamily: T.mono,
                                                    fontWeight: 700
                                                },
                                                children: [
                                                    sessionDetail.formation_code,
                                                    " ",
                                                    sessionDetail.code_interne ? "— ".concat(sessionDetail.code_interne) : ''
                                                ]
                                            }, void 0, true),
                                            /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    color: T.text
                                                },
                                                children: sessionDetail.formation_title
                                            }, void 0, false)
                                        ]
                                    }, void 0, true),
                                    /*#__PURE__*/ _jsx(Badge, {
                                        status: sessionDetail.status
                                    }, void 0, false)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    gap: 6,
                                    alignItems: 'center'
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("select", {
                                        value: sessionDetail.status,
                                        onChange: (e)=>handleStatusChange(sessionDetail.id, e.target.value),
                                        style: {
                                            ...selectStyle,
                                            width: 'auto',
                                            padding: '5px 10px',
                                            fontSize: 11
                                        },
                                        children: [
                                            /*#__PURE__*/ _jsx("option", {
                                                value: "planned",
                                                children: "Planifiée"
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx("option", {
                                                value: "ongoing",
                                                children: "En cours"
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx("option", {
                                                value: "completed",
                                                children: "Terminée"
                                            }, void 0, false),
                                            /*#__PURE__*/ _jsx("option", {
                                                value: "cancelled",
                                                children: "Annulée"
                                            }, void 0, false)
                                        ]
                                    }, void 0, true),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: ()=>setEditing(sessionDetail),
                                        style: {
                                            padding: '5px 10px',
                                            background: 'transparent',
                                            border: "1px solid ".concat(T.border3),
                                            borderRadius: 5,
                                            color: T.textMuted,
                                            fontSize: 11,
                                            cursor: 'pointer'
                                        },
                                        children: "✏ Modifier"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: ()=>handleDelete(sessionDetail.id),
                                        style: {
                                            padding: '5px 10px',
                                            background: 'transparent',
                                            border: "1px solid ".concat(T.border3),
                                            borderRadius: 5,
                                            color: T.danger,
                                            fontSize: 11,
                                            cursor: 'pointer'
                                        },
                                        children: "Supprimer"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", {
                                        onClick: ()=>{
                                            setSelected(null);
                                            setSessionDetail(null);
                                        },
                                        style: {
                                            padding: '5px 10px',
                                            background: 'transparent',
                                            border: "1px solid ".concat(T.border3),
                                            borderRadius: 5,
                                            color: T.textMuted,
                                            fontSize: 11,
                                            cursor: 'pointer',
                                            lineHeight: 1
                                        },
                                        children: "← Retour"
                                    }, void 0, false)
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true),
                    <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${T.border}`, background: T.card }}>
                        {/* Stepper circles with connecting line */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8, overflowX: 'auto' }}>
                            {DETAIL_TABS.map((tab, idx) => {
                                const isActive = detailTab === tab.id;
                                const tabColor = tab.color || T.gold;
                                return <React.Fragment key={tab.id}>
                                    {idx > 0 && <div style={{ flex: 1, maxWidth: 120, height: 3, background: T.border2, borderRadius: 2 }} />}
                                    <button onClick={() => setDetailTab(tab.id)} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', position: 'relative',
                                    }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: '50%',
                                            background: isActive ? tabColor : T.bg,
                                            border: `3px solid ${isActive ? tabColor : T.border2}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 22, transition: 'all 0.2s',
                                            boxShadow: isActive ? `0 0 0 4px ${alpha(tabColor, 13)}` : 'none',
                                        }}>
                                            <span style={{ filter: isActive ? 'brightness(10)' : 'none' }}>{tab.icon}</span>
                                        </div>
                                        <span style={{
                                            fontSize: 11, fontWeight: isActive ? 700 : 500,
                                            color: isActive ? tabColor : T.textMuted,
                                            textDecoration: isActive ? 'none' : 'none',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {tab.label}
                                        </span>
                                        {isActive && <div style={{ position: 'absolute', bottom: -17, left: '50%', transform: 'translateX(-50%)', width: 30, height: 3, borderRadius: 2, background: tabColor }} />}
                                    </button>
                                </React.Fragment>;
                            })}
                        </div>
                    </div>,
                    /*#__PURE__*/ _jsx("div", {
                        style: {
                            padding: 20
                        },
                        children: [
                            detailTab === 'info' && (()=>{
                                const patchField = async (field, value) => {
                                    await api.patch(`/api/sessions/${sessionDetail.id}`, { [field]: value });
                                    setSessionDetail(d => ({ ...d, [field]: value }));
                                };
                                const toggleField = async (field) => {
                                    const newVal = sessionDetail[field] ? 0 : 1;
                                    await patchField(field, newVal);
                                };
                                const EditableField = ({ label, field, value, placeholder, mono, type, options }) => {
                                    const [isEditing, setIsEditing] = useState(false);
                                    const [val, setVal] = useState(value || '');
                                    const save = async () => {
                                        setIsEditing(false);
                                        if (val !== (value || '')) await patchField(field, val);
                                    };
                                    if (isEditing) {
                                        if (type === 'select') {
                                            return _jsx("div", { children: [
                                                _jsx("div", { style: { color: T.textDim, fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }, children: label }, void 0, false),
                                                _jsx("select", {
                                                    value: val, onChange: e => { setVal(e.target.value); },
                                                    onBlur: save, autoFocus: true,
                                                    style: { ...inputStyle, fontSize: 12, padding: '4px 8px' },
                                                    children: (options || []).map(o => _jsx("option", { value: o, children: o }, o, false))
                                                }, void 0, true),
                                            ] }, field, true);
                                        }
                                        return _jsx("div", { children: [
                                            _jsx("div", { style: { color: T.textDim, fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }, children: label }, void 0, false),
                                            _jsx("input", {
                                                value: val, onChange: e => setVal(e.target.value),
                                                onBlur: save, onKeyDown: e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setIsEditing(false); },
                                                autoFocus: true, placeholder: placeholder || '',
                                                style: { ...inputStyle, fontSize: 12, padding: '4px 8px', fontFamily: mono ? T.mono : T.font },
                                            }, void 0, false),
                                        ] }, field, true);
                                    }
                                    return _jsx("div", {
                                        onClick: () => { setVal(value || ''); setIsEditing(true); },
                                        style: { cursor: 'pointer' },
                                        title: 'Cliquer pour modifier',
                                        children: [
                                            _jsx("div", { style: { color: T.textDim, fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }, children: label }, void 0, false),
                                            _jsx("div", {
                                                style: { color: T.text, fontWeight: mono ? 600 : 400, fontFamily: mono ? T.mono : T.font, borderBottom: `1px dashed ${T.border3}`, paddingBottom: 2, display: 'inline-block' },
                                                children: value || placeholder || '—'
                                            }, void 0, false),
                                        ]
                                    }, field, true);
                                };
                                const CheckboxField = ({ label, field, color }) => {
                                    const checked = sessionDetail[field];
                                    return _jsx("div", {
                                        onClick: () => toggleField(field),
                                        style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: checked ? color : T.textDim, cursor: 'pointer' },
                                        children: [
                                            _jsx("span", { style: { width: 16, height: 16, borderRadius: 3, border: `1px solid ${checked ? color : T.border3}`, background: checked ? alpha(color, 13) : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, transition: 'all 0.15s' }, children: checked ? '✓' : '' }, void 0, false),
                                            label,
                                        ]
                                    }, field, true);
                                };

                                const CONFIG_SUB_TABS = [
                                    { key: 'initialisation', label: 'Initialisation' },
                                    { key: 'dates_prix', label: 'Dates et prix' },
                                    { key: 'apprenants_cfg', label: 'Apprenants' },
                                    { key: 'programme', label: 'Programme' },
                                    { key: 'intervenants', label: 'Intervenants' },
                                ];

                                /* Find the linked formation */
                                const linkedFormation = formations.find(f => f.id === sessionDetail.formation_id) || {};
                                let linkedModules = [];
                                try { linkedModules = JSON.parse(linkedFormation.modules || '[]'); } catch(e) {}

                                return _jsx("div", {
                                    style: { display: 'flex', flexDirection: 'column', gap: 16 },
                                    children: [
                                        /* ── KPI cards ── */
                                        _jsx("div", {
                                            style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
                                            children: [
                                                _jsx(StatCard, { label: "CA Session", value: `${getCA(sessionDetail).toLocaleString('fr-FR')}€`, color: T.gold }, void 0, false),
                                                _jsx(StatCard, { label: "Apprenants", value: `${(sessionDetail.inscriptions?.length) || 0} / ${sessionDetail.max_participants}`, color: T.blue }, void 0, false),
                                                _jsx(StatCard, { label: "Avancement", value: `${getAdvancementScore(getAdvancement(sessionDetail))}%`, color: T.green }, void 0, false),
                                                _jsx(StatCard, { label: "Durée", value: sessionDetail.duration_hours ? `${sessionDetail.duration_hours}h` : '—', color: T.purple }, void 0, false),
                                            ]
                                        }, void 0, true),

                                        /* ── Sous-onglets Configuration ── */
                                        _jsx("div", {
                                            style: { display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 0 },
                                            children: CONFIG_SUB_TABS.map(st => _jsx("button", {
                                                key: st.key,
                                                onClick: () => setConfigSubTab(st.key),
                                                style: {
                                                    padding: '10px 18px', border: 'none', cursor: 'pointer',
                                                    borderBottom: `2px solid ${configSubTab === st.key ? T.gold : 'transparent'}`,
                                                    background: configSubTab === st.key ? T.goldDim || alpha(T.gold, 7) : 'transparent',
                                                    color: configSubTab === st.key ? T.gold : T.textMuted,
                                                    fontSize: 11, fontWeight: configSubTab === st.key ? 700 : 500,
                                                    fontFamily: T.font, borderRadius: configSubTab === st.key ? '8px 8px 0 0' : 0,
                                                    transition: 'all 0.15s',
                                                },
                                                children: st.label
                                            }, st.key, false))
                                        }, void 0, true),

                                        /* ══════ SUB: Initialisation ══════ */
                                        configSubTab === 'initialisation' && _jsx("div", {
                                            style: { display: 'flex', flexDirection: 'column', gap: 16 },
                                            children: [
                                                /* Configuration session */
                                                _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                    children: [
                                                        _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: '⚙️ Configuration session' }, void 0, false),
                                                        _jsx("div", {
                                                            style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 },
                                                            children: [
                                                                _jsx(EditableField, { label: 'Code interne', field: 'code_interne', value: sessionDetail.code_interne, placeholder: 'AF26001', mono: true }, 'cfg-code', false),
                                                                _jsx(EditableField, { label: 'Type de session', field: 'type_session', value: sessionDetail.type_session, type: 'select', options: ['INTER', 'INTRA'] }, 'cfg-type', false),
                                                                _jsx(EditableField, { label: 'Gestionnaire n°1', field: 'gestionnaire_1', value: sessionDetail.gestionnaire_1, placeholder: 'COULIBALY Moustapha' }, 'cfg-gest1', false),
                                                                _jsx(EditableField, { label: 'Gestionnaire n°2', field: 'gestionnaire_2', value: sessionDetail.gestionnaire_2, placeholder: 'Ajouter un gestionnaire' }, 'cfg-gest2', false),
                                                                _jsx(EditableField, { label: 'Fuseau horaire', field: 'fuseau_horaire', value: sessionDetail.fuseau_horaire, type: 'select', options: ['Europe/Paris', 'Europe/London', 'America/New_York', 'Africa/Dakar', 'Africa/Abidjan'] }, 'cfg-tz', false),
                                                                _jsx(EditableField, { label: 'Horaire', field: 'horaire', value: sessionDetail.horaire, placeholder: '09:00 - 13:00 / 14:00 - 17:00' }, 'cfg-horaire', false),
                                                            ]
                                                        }, void 0, true),
                                                        _jsx("div", {
                                                            style: { display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' },
                                                            children: [
                                                                _jsx(CheckboxField, { label: 'Inter entreprise', field: 'inter_entreprise', color: T.blue }, 'chk-inter', false),
                                                                _jsx(CheckboxField, { label: 'Exclure du catalogue en ligne', field: 'exclure_catalogue', color: T.textMuted }, 'chk-excl', false),
                                                                _jsx(CheckboxField, { label: 'Réalisée en sous traitance', field: 'sous_traitance', color: T.purple }, 'chk-sous', false),
                                                            ]
                                                        }, void 0, true),
                                                    ]
                                                }, 'config-session', true),
                                                /* Formation professionnelle */
                                                _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                    children: [
                                                        _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: '🎓 Formation professionnelle' }, void 0, false),
                                                        _jsx("div", {
                                                            style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 },
                                                            children: [
                                                                _jsx(EditableField, { label: "Type d'action de formation", field: 'type_action_formation', value: sessionDetail.type_action_formation, type: 'select', options: ['Action de formation', 'Bilan de compétences', 'Action de VAE', 'Action de formation par apprentissage'] }, 'fp-type', false),
                                                                _jsx(EditableField, { label: 'Spécialité de formation', field: 'specialite_formation', value: sessionDetail.specialite_formation, type: 'select', options: ['100 - Formations générales', '110 - Spécialités pluriscientifiques', '120 - Sciences humaines et droit', '200 - Technologies industrielles', '300 - Sciences sociales', '310 - Spécialités plurivalentes échanges gestion', '320 - Communication et information', '340 - Commerce, vente', '413 - Développement personnel', '414 - Techniques de la communication'] }, 'fp-spec', false),
                                                                _jsx(EditableField, { label: 'Diplôme visé', field: 'diplome_vise', value: sessionDetail.diplome_vise, type: 'select', options: ['Aucun', 'Certificat de compétences', 'Attestation de formation', 'Titre professionnel', "Diplôme d'État"] }, 'fp-diplome', false),
                                                                _jsx(EditableField, { label: 'Nom du titre visé', field: 'nom_titre_vise', value: sessionDetail.nom_titre_vise, placeholder: 'Ex: Expert en stratégie digitale' }, 'fp-titre', false),
                                                            ]
                                                        }, void 0, true),
                                                    ]
                                                }, 'formation-pro', true),
                                                /* Lieu de formation — sélecteur connecté à lieux_formation */
                                                (() => {
                                                    const currentLieu = lieuxList.find(l => l.id === sessionDetail.lieu_formation_id);
                                                    const handleSelectLieu = async (lieuId) => {
                                                        if (lieuId === '__none__') {
                                                            await patchField('lieu_formation_id', null);
                                                            await patchField('adresse', '');
                                                            return;
                                                        }
                                                        const lieu = lieuxList.find(l => l.id === lieuId);
                                                        if (!lieu) return;
                                                        await patchField('lieu_formation_id', lieuId);
                                                        const fullAddr = [lieu.adresse, lieu.postal_code, lieu.ville].filter(Boolean).join(', ');
                                                        await patchField('adresse', fullAddr);
                                                    };
                                                    const handleCreateQuickLieu = async () => {
                                                        const nom = prompt('Nom du lieu :');
                                                        if (!nom) return;
                                                        const adresse = prompt('Adresse :') || '';
                                                        const ville = prompt('Ville :') || '';
                                                        const cp = prompt('Code postal :') || '';
                                                        try {
                                                            const created = await api.post('/api/lieux-formation', { nom, adresse, ville, postal_code: cp });
                                                            const refreshed = await api.get('/api/lieux-formation');
                                                            setLieuxList(refreshed);
                                                            await handleSelectLieu(created.id);
                                                        } catch(e) { console.error('Erreur création lieu', e); }
                                                    };
                                                    return _jsx("div", {
                                                        id: 'section-lieu-detail',
                                                        style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: '📍 Lieu de formation' }, void 0, false),
                                                            _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12 }, children: 'Ce sera le lieu par défaut de vos modules, créneau par créneau.' }, void 0, false),
                                                            /* Toggle formation à distance */
                                                            _jsx("div", {
                                                                onClick: () => toggleField('formation_a_distance'),
                                                                style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' },
                                                                children: [
                                                                    _jsx("div", {
                                                                        style: { width: 36, height: 20, borderRadius: 10, background: sessionDetail.formation_a_distance ? T.blue : T.border3, position: 'relative', transition: 'background 0.2s' },
                                                                        children: _jsx("div", { style: { width: 16, height: 16, borderRadius: '50%', background: 'var(--on-solid)', position: 'absolute', top: 2, left: sessionDetail.formation_a_distance ? 18 : 2, transition: 'left 0.2s', boxShadow: 'var(--shadow-sm)' } }, void 0, false)
                                                                    }, void 0, false),
                                                                    _jsx("span", { style: { fontSize: 12, color: T.text }, children: 'Formation à distance' }, void 0, false),
                                                                ]
                                                            }, void 0, true),
                                                            /* Sélecteur de lieu */
                                                            _jsx("div", {
                                                                style: { marginBottom: 14 },
                                                                children: [
                                                                    _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }, children: 'Lieu enregistré' }, void 0, false),
                                                                    _jsx("div", {
                                                                        style: { display: 'flex', gap: 8, alignItems: 'center' },
                                                                        children: [
                                                                            _jsx("select", {
                                                                                value: sessionDetail.lieu_formation_id || '__none__',
                                                                                onChange: (e) => handleSelectLieu(e.target.value),
                                                                                style: { flex: 1, padding: '7px 10px', fontSize: 12, background: T.bg, color: T.text, border: `1px solid ${T.border3}`, borderRadius: 6, cursor: 'pointer' },
                                                                                children: [
                                                                                    _jsx("option", { value: '__none__', children: '— Aucun lieu sélectionné —' }, '__none__', false),
                                                                                    ...lieuxList.filter(l => l.active !== 0).map(l =>
                                                                                        _jsx("option", { value: l.id, children: `${l.nom}${l.ville ? ` — ${l.ville}` : ''}` }, l.id, false)
                                                                                    )
                                                                                ]
                                                                            }, void 0, true),
                                                                            _jsx("button", {
                                                                                onClick: handleCreateQuickLieu,
                                                                                title: 'Créer un nouveau lieu',
                                                                                style: { padding: '6px 12px', fontSize: 12, background: T.gold, color: 'var(--gold-ink)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
                                                                                children: '+ Lieu'
                                                                            }, void 0, false),
                                                                        ]
                                                                    }, void 0, true),
                                                                ]
                                                            }, void 0, true),
                                                            /* Fiche lieu sélectionné */
                                                            currentLieu && _jsx("div", {
                                                                style: { background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, padding: '12px 16px', marginBottom: 14 },
                                                                children: [
                                                                    _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
                                                                        children: [
                                                                            _jsx("span", { style: { fontSize: 13, fontWeight: 700, color: T.gold }, children: currentLieu.nom }, void 0, false),
                                                                            currentLieu.accessibilite_pmr ? _jsx("span", { style: { fontSize: 10, background: T.blue, color: 'var(--on-solid)', padding: '2px 8px', borderRadius: 10 }, children: '♿ PMR' }, void 0, false) : null,
                                                                        ]
                                                                    }, void 0, true),
                                                                    _jsx("div", {
                                                                        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: T.textMuted },
                                                                        children: [
                                                                            _jsx("div", { children: ['📍 ', [currentLieu.adresse, currentLieu.postal_code, currentLieu.ville].filter(Boolean).join(', ') || 'Non renseigné'] }, void 0, true),
                                                                            currentLieu.capacite ? _jsx("div", { children: `👥 Capacité : ${currentLieu.capacite} places` }, void 0, false) : null,
                                                                            currentLieu.contact_nom ? _jsx("div", { children: `📞 ${currentLieu.contact_nom}${currentLieu.contact_tel ? ' — ' + currentLieu.contact_tel : ''}` }, void 0, false) : null,
                                                                            currentLieu.contact_email ? _jsx("div", { children: `✉️ ${currentLieu.contact_email}` }, void 0, false) : null,
                                                                            currentLieu.equipements ? _jsx("div", { style: { gridColumn: '1 / -1' }, children: `🔧 ${currentLieu.equipements}` }, void 0, false) : null,
                                                                        ].filter(Boolean)
                                                                    }, void 0, true),
                                                                ]
                                                            }, 'lieu-card', true),
                                                            /* Modalité */
                                                            _jsx("div", {
                                                                style: { display: 'grid', gridTemplateColumns: '1fr', gap: 12, fontSize: 12 },
                                                                children: [
                                                                    _jsx(EditableField, { label: 'Modalité', field: 'modality', value: sessionDetail.modality, type: 'select', options: ['presentiel', 'distanciel', 'hybride'] }, 'lieu-modalite', false),
                                                                ]
                                                            }, void 0, true),
                                                        ]
                                                    }, 'lieu-formation', true);
                                                })(),
                                                /* Notes */
                                                sessionDetail.notes && _jsx("div", {
                                                    style: { padding: '10px 14px', background: T.card, borderRadius: 8, fontSize: 12, color: T.textMuted, border: `1px solid ${T.border}` },
                                                    children: sessionDetail.notes
                                                }, void 0, false),
                                            ]
                                        }, 'sub-init', true),

                                        /* ══════ SUB: Dates et prix ══════ */
                                        configSubTab === 'dates_prix' && _jsx("div", {
                                            style: { display: 'flex', flexDirection: 'column', gap: 16 },
                                            children: [
                                                _jsx("div", {
                                                    style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, color: T.textSub },
                                                    children: [
                                                        _jsx("div", { id: 'section-dates', style: { background: T.card, borderRadius: 8, padding: '10px 14px', border: `1px solid ${T.border}` }, children: [
                                                            _jsx("div", { style: { color: T.textDim, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }, children: 'Dates' }, void 0, false),
                                                            fmtDateRange(sessionDetail.start_date, sessionDetail.end_date),
                                                        ] }, void 0, true),
                                                        _jsx("div", { style: { background: T.card, borderRadius: 8, padding: '10px 14px', border: `1px solid ${T.border}` }, children: [
                                                            _jsx("div", { style: { color: T.textDim, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }, children: 'Type / Modalité' }, void 0, false),
                                                            _jsx("span", { style: { fontWeight: 700, color: sessionDetail.type_session === 'INTRA' ? T.purple : T.blue }, children: sessionDetail.type_session || 'INTER' }, void 0, false),
                                                            _jsx("span", { style: { color: T.textSub }, children: [' — ', MODALITY_LABEL[sessionDetail.modality] || sessionDetail.modality] }, void 0, true),
                                                            sessionDetail.tarif > 0 && _jsx("span", { style: { color: T.textDim }, children: [' — ', Number(sessionDetail.tarif).toLocaleString('fr-FR'), '€ HT', sessionDetail.type_session === 'INTRA' ? ' (groupe)' : ' /pers.'] }, void 0, true),
                                                        ] }, void 0, true),
                                                    ]
                                                }, void 0, true),
                                                /* Tarifs éditables */
                                                _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                    children: [
                                                        _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: '💰 Tarification' }, void 0, false),
                                                        _jsx("div", {
                                                            style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 },
                                                            children: [
                                                                _jsx(EditableField, { label: 'Tarif HT (€)', field: 'tarif', value: sessionDetail.tarif ? String(sessionDetail.tarif) : '', placeholder: '0' }, 'prix-tarif', false),
                                                                _jsx(EditableField, { label: 'Coût total (€)', field: 'cout_total', value: sessionDetail.cout_total ? String(sessionDetail.cout_total) : '', placeholder: '0' }, 'prix-cout', false),
                                                                _jsx(EditableField, { label: 'Capacité max', field: 'max_participants', value: String(sessionDetail.max_participants || 12), placeholder: '12' }, 'prix-cap', false),
                                                            ]
                                                        }, void 0, true),
                                                    ]
                                                }, void 0, true),
                                                /* Client — dropdown GRIOTHEQUE uniquement (exonéré TVA) */
                                                (() => {
                                                    const griothequeClients = clientsList.filter(c => c.pillar === 'GRIOTHEQUE' || c.pillar === 'BOTH');
                                                    const currentClient = clientsList.find(c => c.id === sessionDetail.client_id);
                                                    const handleSelectClient = async (cId) => {
                                                        if (cId === '__none__') {
                                                            await patchField('client_id', null);
                                                            return;
                                                        }
                                                        await patchField('client_id', cId);
                                                        const updated = await api.get(`/api/sessions/${sessionDetail.id}`);
                                                        setSessionDetail(updated);
                                                    };
                                                    const handleCreateQuickClient = async () => {
                                                        const company = prompt('Nom de l\'entreprise / organisme :');
                                                        if (!company) return;
                                                        const lastName = prompt('Nom du contact :') || '';
                                                        const firstName = prompt('Prénom :') || '';
                                                        const email = prompt('Email :') || '';
                                                        const phone = prompt('Téléphone :') || '';
                                                        const siret = prompt('SIRET (optionnel) :') || '';
                                                        const typeClient = prompt('Type (entreprise / particulier / opco / institution) :') || 'entreprise';
                                                        try {
                                                            const created = await api.post('/api/clients', {
                                                                company, lastName, firstName, email, phone, siret,
                                                                pillar: 'GRIOTHEQUE',
                                                                tvaApplicable: false,
                                                                tvaRate: 0,
                                                                typeClient,
                                                            });
                                                            const refreshed = await api.get('/api/clients');
                                                            setClientsList(refreshed);
                                                            await handleSelectClient(created.id);
                                                        } catch(e) { console.error('Erreur création client', e); }
                                                    };
                                                    return _jsx("div", {
                                                        id: 'section-client',
                                                        style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                        children: [
                                                            _jsx("div", {
                                                                style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
                                                                children: [
                                                                    _jsx("span", { children: '🏢 Client Griothèque' }, void 0, false),
                                                                    _jsx("span", { style: { fontSize: 9, background: 'var(--success-soft)', color: 'var(--success)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }, children: 'Exonéré TVA' }, void 0, false),
                                                                ]
                                                            }, void 0, true),
                                                            /* Sélecteur client filtré GRIOTHEQUE */
                                                            _jsx("div", {
                                                                style: { marginBottom: 14 },
                                                                children: [
                                                                    _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }, children: 'Client rattaché (formation)' }, void 0, false),
                                                                    _jsx("div", {
                                                                        style: { display: 'flex', gap: 8, alignItems: 'center' },
                                                                        children: [
                                                                            _jsx("select", {
                                                                                value: sessionDetail.client_id || '__none__',
                                                                                onChange: (e) => handleSelectClient(e.target.value),
                                                                                style: { flex: 1, padding: '7px 10px', fontSize: 12, background: T.bg, color: T.text, border: `1px solid ${T.border3}`, borderRadius: 6, cursor: 'pointer' },
                                                                                children: [
                                                                                    _jsx("option", { value: '__none__', children: '— Aucun client sélectionné —' }, '__none__', false),
                                                                                    ...griothequeClients.map(c =>
                                                                                        _jsx("option", { value: c.id, children: `${c.company || ''}${c.company && c.lastName ? ' — ' : ''}${c.lastName} ${c.firstName}`.trim() + (c.typeClient && c.typeClient !== 'entreprise' ? ` (${c.typeClient})` : '') }, c.id, false)
                                                                                    )
                                                                                ]
                                                                            }, void 0, true),
                                                                            _jsx("button", {
                                                                                onClick: handleCreateQuickClient,
                                                                                title: 'Créer un nouveau client formation (exonéré TVA)',
                                                                                style: { padding: '6px 12px', fontSize: 12, background: T.gold, color: 'var(--gold-ink)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
                                                                                children: '+ Client'
                                                                            }, void 0, false),
                                                                        ]
                                                                    }, void 0, true),
                                                                ]
                                                            }, void 0, true),
                                                            /* Fiche client sélectionné */
                                                            currentClient && _jsx("div", {
                                                                style: { background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, padding: '12px 16px' },
                                                                children: [
                                                                    _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
                                                                        children: [
                                                                            _jsx("span", { style: { fontSize: 14, fontWeight: 700, color: T.gold }, children: currentClient.company || `${currentClient.firstName} ${currentClient.lastName}` }, void 0, false),
                                                                            _jsx("span", {
                                                                                style: { fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                                                                                    background: currentClient.tvaApplicable ? 'var(--warning-soft)' : 'var(--success-soft)',
                                                                                    color: currentClient.tvaApplicable ? 'var(--warning)' : 'var(--success)' },
                                                                                children: currentClient.tvaApplicable ? `TVA ${currentClient.tvaRate || 20}%` : 'Exonéré TVA'
                                                                            }, void 0, false),
                                                                        ]
                                                                    }, void 0, true),
                                                                    currentClient.typeClient && currentClient.typeClient !== 'entreprise' && _jsx("div", {
                                                                        style: { fontSize: 10, color: T.purple, fontWeight: 600, marginBottom: 4 },
                                                                        children: currentClient.typeClient.toUpperCase()
                                                                    }, void 0, false),
                                                                    _jsx("div", {
                                                                        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: T.textMuted },
                                                                        children: [
                                                                            (currentClient.lastName || currentClient.firstName) ? _jsx("div", { children: `👤 ${currentClient.firstName} ${currentClient.lastName}`.trim() }, void 0, false) : null,
                                                                            currentClient.email ? _jsx("div", { children: `✉️ ${currentClient.email}` }, void 0, false) : null,
                                                                            currentClient.phone ? _jsx("div", { children: `📞 ${currentClient.phone}` }, void 0, false) : null,
                                                                            currentClient.siret ? _jsx("div", { children: `🏛️ SIRET: ${currentClient.siret}` }, void 0, false) : null,
                                                                            (currentClient.address || currentClient.city) ? _jsx("div", { style: { gridColumn: '1 / -1' }, children: `📍 ${[currentClient.address, currentClient.postalCode, currentClient.city].filter(Boolean).join(', ')}` }, void 0, false) : null,
                                                                        ].filter(Boolean)
                                                                    }, void 0, true),
                                                                ]
                                                            }, 'client-card', true),
                                                        ]
                                                    }, void 0, true);
                                                })(),
                                                /* Planning */
                                                (()=>{
                                                    let pl = [];
                                                    try { pl = JSON.parse(sessionDetail.planning || '[]'); } catch(e) {}
                                                    if (!Array.isArray(pl) || pl.length === 0) return null;
                                                    return _jsx("div", {
                                                        style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: [`📅 Planning — ${pl.length} jour${pl.length > 1 ? 's' : ''}`] }, void 0, true),
                                                            _jsx("div", {
                                                                style: { display: 'flex', flexDirection: 'column', gap: 4 },
                                                                children: pl.map((d, i) => _jsx("div", {
                                                                    style: { display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 8, fontSize: 12, color: T.textSub, padding: '4px 0', borderBottom: i < pl.length - 1 ? `1px solid ${T.border}` : 'none' },
                                                                    children: [
                                                                        _jsx("span", { style: { fontWeight: 600, color: T.text }, children: fmtDate(d.date) }, void 0, false),
                                                                        _jsx("span", { children: ['Matin : ', d.matin || '—'] }, void 0, true),
                                                                        _jsx("span", { children: ['Après-midi : ', d.aprem || '—'] }, void 0, true),
                                                                    ]
                                                                }, i, true))
                                                            }, void 0, false),
                                                        ]
                                                    }, void 0, true);
                                                })(),
                                            ]
                                        }, 'sub-dates', true),

                                        /* ══════ SUB: Apprenants (résumé) ══════ */
                                        configSubTab === 'apprenants_cfg' && _jsx("div", {
                                            children: [
                                                _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                    children: [
                                                        _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: `🎓 Apprenants inscrits (${(sessionDetail.inscriptions || []).length})` }, void 0, false),
                                                        (sessionDetail.inscriptions || []).length === 0
                                                            ? _jsx("div", { style: { textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }, children: 'Aucun apprenant inscrit. Allez dans l\'onglet Apprenants pour en inscrire.' }, void 0, false)
                                                            : _jsx("div", {
                                                                style: { display: 'flex', flexDirection: 'column', gap: 6 },
                                                                children: (sessionDetail.inscriptions || []).map(insc => {
                                                                    const ap = apprenants.find(a => a.id === insc.apprenant_id) || {};
                                                                    return _jsx("div", {
                                                                        style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg },
                                                                        children: [
                                                                            _jsx("div", { style: { width: 32, height: 32, borderRadius: '50%', background: alpha(T.gold, 13), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.gold }, children: (ap.first_name || '?')[0] + (ap.last_name || '?')[0] }, void 0, false),
                                                                            _jsx("div", { children: [
                                                                                _jsx("div", { style: { fontSize: 12, fontWeight: 600, color: T.text }, children: `${ap.first_name || ''} ${ap.last_name || ''}`.trim() || '—' }, void 0, false),
                                                                                _jsx("div", { style: { fontSize: 10, color: T.textDim }, children: [ap.email, ap.company ? ` — ${ap.company}` : ''].filter(Boolean).join('') || '—' }, void 0, false),
                                                                            ] }, void 0, true),
                                                                        ]
                                                                    }, insc.apprenant_id, true);
                                                                })
                                                            }, void 0, false),
                                                        _jsx("button", {
                                                            onClick: () => setDetailTab('apprenants'),
                                                            style: { marginTop: 12, padding: '8px 16px', borderRadius: 8, border: `1px solid ${alpha(T.gold, 27)}`, background: alpha(T.gold, 7), color: T.gold, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font },
                                                            children: '→ Gérer les apprenants'
                                                        }, void 0, false),
                                                    ]
                                                }, void 0, true),
                                            ]
                                        }, 'sub-apprenants-cfg', true),

                                        /* ══════ SUB: Programme ══════ */
                                        configSubTab === 'programme' && _jsx("div", {
                                            children: [
                                                _jsx("div", {
                                                    style: { fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' },
                                                    children: 'Programme de la session'
                                                }, void 0, false),
                                                /* Programme lié actuel */
                                                linkedFormation.id ? _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${alpha(T.gold, 27)}`, padding: '16px 20px', marginBottom: 16 },
                                                    children: [
                                                        _jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, children: [
                                                            _jsx("div", { style: { fontSize: 14, fontWeight: 700, color: T.text }, children: linkedFormation.title || 'Formation' }, void 0, false),
                                                            _jsx("span", { style: { fontSize: 11, fontFamily: T.mono, color: T.gold, fontWeight: 600, background: alpha(T.gold, 8), padding: '2px 8px', borderRadius: 4 }, children: linkedFormation.code || '—' }, void 0, false),
                                                        ] }, void 0, true),
                                                        linkedFormation.description && _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: '1.5' }, children: linkedFormation.description }, void 0, false),
                                                        /* Modules */
                                                        linkedModules.length > 0 && _jsx("div", {
                                                            children: [
                                                                _jsx("div", { style: { fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }, children: `Modules (${linkedModules.length})` }, void 0, false),
                                                                _jsx("div", {
                                                                    style: { display: 'flex', flexDirection: 'column', gap: 4 },
                                                                    children: linkedModules.map((m, i) => _jsx("div", {
                                                                        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, fontSize: 12 },
                                                                        children: [
                                                                            _jsx("span", { style: { fontWeight: 700, color: T.gold, fontSize: 10, minWidth: 24 }, children: `M${i + 1}` }, void 0, false),
                                                                            _jsx("span", { style: { color: T.text }, children: m.title || `Module ${i + 1}` }, void 0, false),
                                                                            m.duration_hours && _jsx("span", { style: { marginLeft: 'auto', fontSize: 10, color: T.textDim }, children: `${m.duration_hours}h` }, void 0, false),
                                                                        ]
                                                                    }, i, true))
                                                                }, void 0, false),
                                                            ]
                                                        }, void 0, true),
                                                    ]
                                                }, void 0, true) : _jsx("div", {
                                                    style: { textAlign: 'center', padding: 30, color: T.textDim, fontSize: 12, border: `1px dashed ${T.border3}`, borderRadius: 10, marginBottom: 16 },
                                                    children: 'Aucun programme lié à cette session.'
                                                }, void 0, false),

                                                /* Choisir un programme existant */
                                                _jsx("div", {
                                                    style: { fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 },
                                                    children: 'Choisir un programme existant'
                                                }, void 0, false),
                                                _jsx("div", {
                                                    style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, overflow: 'hidden' },
                                                    children: formations.filter(f => f.id !== sessionDetail.formation_id).map(f => _jsx("div", {
                                                        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.border}` },
                                                        children: [
                                                            _jsx("div", { children: [
                                                                _jsx("div", { style: { fontSize: 12, fontWeight: 600, color: T.text }, children: f.title }, void 0, false),
                                                                f.description && _jsx("div", { style: { fontSize: 10, color: T.textDim, marginTop: 2 }, children: f.description.substring(0, 80) + (f.description.length > 80 ? '…' : '') }, void 0, false),
                                                            ] }, void 0, true),
                                                            _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [
                                                                _jsx("span", { style: { fontSize: 11, fontFamily: T.mono, color: T.textMuted }, children: f.code || '' }, void 0, false),
                                                                _jsx("button", {
                                                                    onClick: async () => {
                                                                        await patchField('formation_id', f.id);
                                                                        /* Refresh session detail */
                                                                        const updated = await api.get(`/api/sessions/${sessionDetail.id}`);
                                                                        setSessionDetail(updated);
                                                                    },
                                                                    style: { padding: '5px 14px', borderRadius: 6, border: `1px solid ${T.border2}`, background: T.bg, color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, whiteSpace: 'nowrap' },
                                                                    children: 'Choisir le programme'
                                                                }, void 0, false),
                                                            ] }, void 0, true),
                                                        ]
                                                    }, f.id, true))
                                                }, void 0, false),

                                                /* Attente / Synthèse des clients (collapsible placeholders) */
                                                _jsx("div", {
                                                    style: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 },
                                                    children: ['Attente des clients', 'Synthèse des attentes des clients'].map(label => _jsx("div", {
                                                        style: { padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
                                                        children: [
                                                            _jsx("span", { style: { fontSize: 13, fontWeight: 600, color: T.text }, children: label }, void 0, false),
                                                            _jsx("span", { style: { fontSize: 14, color: T.textDim }, children: '▸' }, void 0, false),
                                                        ]
                                                    }, label, true))
                                                }, void 0, false),
                                            ]
                                        }, 'sub-programme', true),

                                        /* ══════ SUB: Intervenants — dropdown connecté formateurs ══════ */
                                        configSubTab === 'intervenants' && (() => {
                                            const currentFormateur = formateursList.find(f => f.id === sessionDetail.formateur_id);
                                            const handleSelectFormateur = async (fId) => {
                                                if (fId === '__none__') {
                                                    await patchField('formateur_id', null);
                                                    await patchField('formateur_name', '');
                                                    return;
                                                }
                                                const f = formateursList.find(x => x.id === fId);
                                                if (!f) return;
                                                await patchField('formateur_id', fId);
                                                await patchField('formateur_name', `${f.first_name} ${f.last_name}`.trim());
                                            };
                                            const handleCreateQuickFormateur = async () => {
                                                const prenom = prompt('Prénom du formateur :');
                                                if (!prenom) return;
                                                const nom = prompt('Nom :') || '';
                                                const email = prompt('Email :') || '';
                                                const tel = prompt('Téléphone :') || '';
                                                const tjm = prompt('TJM (€/jour) :') || '0';
                                                try {
                                                    const created = await api.post('/api/formateurs', { first_name: prenom, last_name: nom, email, phone: tel, tarif_jour: Number(tjm) });
                                                    const refreshed = await api.get('/api/formateurs');
                                                    setFormateursList(refreshed);
                                                    await handleSelectFormateur(created.id);
                                                } catch(e) { console.error('Erreur création formateur', e); }
                                            };
                                            return _jsx("div", {
                                                children: [
                                                    _jsx("div", {
                                                        style: { background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: '16px 20px' },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }, children: '👨‍🏫 Intervenants' }, void 0, false),
                                                            /* Sélecteur formateur */
                                                            _jsx("div", {
                                                                style: { marginBottom: 14 },
                                                                children: [
                                                                    _jsx("div", { style: { fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }, children: 'Formateur principal' }, void 0, false),
                                                                    _jsx("div", {
                                                                        style: { display: 'flex', gap: 8, alignItems: 'center' },
                                                                        children: [
                                                                            _jsx("select", {
                                                                                value: sessionDetail.formateur_id || '__none__',
                                                                                onChange: (e) => handleSelectFormateur(e.target.value),
                                                                                style: { flex: 1, padding: '7px 10px', fontSize: 12, background: T.bg, color: T.text, border: `1px solid ${T.border3}`, borderRadius: 6, cursor: 'pointer' },
                                                                                children: [
                                                                                    _jsx("option", { value: '__none__', children: '— Aucun formateur sélectionné —' }, '__none__', false),
                                                                                    ...formateursList.map(f =>
                                                                                        _jsx("option", { value: f.id, children: `${f.last_name} ${f.first_name}${f.specialite && f.specialite !== '[]' ? ` — ${JSON.parse(f.specialite || '[]').join(', ')}` : ''}` }, f.id, false)
                                                                                    )
                                                                                ]
                                                                            }, void 0, true),
                                                                            _jsx("button", {
                                                                                onClick: handleCreateQuickFormateur,
                                                                                title: 'Créer un nouveau formateur',
                                                                                style: { padding: '6px 12px', fontSize: 12, background: T.gold, color: 'var(--gold-ink)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
                                                                                children: '+ Formateur'
                                                                            }, void 0, false),
                                                                        ]
                                                                    }, void 0, true),
                                                                ]
                                                            }, void 0, true),
                                                            /* Fiche formateur sélectionné */
                                                            currentFormateur && _jsx("div", {
                                                                style: { background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, padding: '12px 16px', marginBottom: 14 },
                                                                children: [
                                                                    _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
                                                                        children: [
                                                                            _jsx("span", { style: { fontSize: 13, fontWeight: 700, color: T.gold }, children: `${currentFormateur.first_name} ${currentFormateur.last_name}` }, void 0, false),
                                                                            _jsx("span", { style: { fontSize: 10, background: T.green, color: 'var(--on-solid)', padding: '2px 8px', borderRadius: 10 }, children: `${currentFormateur.sessions_count || 0} session(s)` }, void 0, false),
                                                                        ]
                                                                    }, void 0, true),
                                                                    _jsx("div", {
                                                                        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: T.textMuted },
                                                                        children: [
                                                                            currentFormateur.email ? _jsx("div", { children: `✉️ ${currentFormateur.email}` }, void 0, false) : null,
                                                                            currentFormateur.phone ? _jsx("div", { children: `📞 ${currentFormateur.phone}` }, void 0, false) : null,
                                                                            currentFormateur.tarif_jour ? _jsx("div", { children: `💰 ${currentFormateur.tarif_jour} €/jour` }, void 0, false) : null,
                                                                            currentFormateur.statut_collab ? _jsx("div", { children: `📋 ${currentFormateur.statut_collab}` }, void 0, false) : null,
                                                                            currentFormateur.qualifications ? _jsx("div", { style: { gridColumn: '1 / -1' }, children: `🎓 ${currentFormateur.qualifications}` }, void 0, false) : null,
                                                                        ].filter(Boolean)
                                                                    }, void 0, true),
                                                                ]
                                                            }, 'formateur-card', true),
                                                            /* Statut */
                                                            _jsx("div", {
                                                                style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
                                                                children: [
                                                                    _jsx("div", { style: { width: 8, height: 8, borderRadius: '50%', background: currentFormateur ? T.green : T.textMuted } }, void 0, false),
                                                                    _jsx("span", { style: { color: currentFormateur ? T.green : T.textMuted, fontWeight: 600 }, children: currentFormateur ? '✓ Assigné' : '⊘ Non assigné' }, void 0, false),
                                                                ]
                                                            }, void 0, true),
                                                        ]
                                                    }, void 0, true),
                                                ]
                                            }, 'sub-intervenants', true);
                                        })(),
                                    ]
                                }, void 0, true);
                            })(),
                            detailTab === 'advancement' && (() => {
                                const smart = computeSmartAdvancement(sessionDetail, evals);
                                if (!smart) return null;

                                const phases = [smart.configuration, smart.gestion, smart.espaceApprenant, smart.suivi];

                                // Calculate global score
                                let totalDone = 0, totalItems = 0;
                                phases.forEach(ph => {
                                    ph.items.forEach(it => {
                                        totalItems++;
                                        if (it.done) totalDone++;
                                    });
                                });

                                return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Header KPIs */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '12px 16px' }}>
                                            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Chiffre d'affaires</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: T.green, fontFamily: T.mono }}>
                                                {getCA(sessionDetail).toLocaleString('fr-FR')}€
                                            </div>
                                        </div>
                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '12px 16px' }}>
                                            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Taux de marge</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: T.gold, fontFamily: T.mono }}>—</div>
                                        </div>
                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '12px 16px' }}>
                                            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Code interne</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{sessionDetail.formation_code || '—'}</div>
                                        </div>
                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '12px 16px' }}>
                                            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Gestionnaire</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>—</div>
                                        </div>
                                    </div>

                                    {/* Global progress */}
                                    <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ flex: 1, height: 10, borderRadius: 5, background: T.border2, overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${totalItems > 0 ? Math.round(totalDone / totalItems * 100) : 0}%`,
                                                    height: '100%',
                                                    borderRadius: 5,
                                                    background: totalDone === totalItems ? T.green : totalDone / totalItems >= 0.5 ? T.gold : T.blue,
                                                    transition: 'width 0.3s'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: T.mono, minWidth: 60, textAlign: 'right' }}>
                                                {totalDone} / {totalItems}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 4-column grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                        {phases.map((phase, idx) => {
                                            const phaseDone = phase.items.filter(it => it.done).length;
                                            const phaseTotal = phase.items.length;
                                            return <div key={idx} style={{
                                                background: T.card,
                                                border: `1px solid ${T.border2}`,
                                                borderRadius: 10,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}>
                                                {/* Colored header with icon */}
                                                <div style={{
                                                    background: phase.color,
                                                    color: 'var(--on-solid)',
                                                    padding: '20px 16px',
                                                    textAlign: 'center',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ fontSize: 32, marginBottom: 8 }}>{phase.icon}</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{phase.label}</div>
                                                    {/* Score badge overlapping */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: -12,
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        background: phaseDone === phaseTotal ? T.green : T.gold,
                                                        color: phaseDone === phaseTotal ? 'var(--on-solid)' : 'var(--gold-ink)',
                                                        padding: '6px 14px',
                                                        borderRadius: 20,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        fontFamily: T.mono,
                                                        border: `2px solid ${T.card}`
                                                    }}>
                                                        {phaseDone}/{phaseTotal}
                                                    </div>
                                                </div>

                                                {/* Items list with padding for badge */}
                                                <div style={{ padding: '16px 16px 12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    {phase.items.map((item, iIdx) => (
                                                        <div key={iIdx} onClick={() => openAdvancementItem(item)} style={{
                                                            background: item.done ? alpha(phase.color, 8) : 'var(--danger-soft)',
                                                            padding: '12px',
                                                            borderRadius: 8,
                                                            borderLeft: `5px solid ${item.done ? phase.color : 'var(--danger)'}`,
                                                            cursor: item.goto ? 'pointer' : 'default',
                                                            transition: 'background 0.15s',
                                                        }} onMouseOver={e => { if (item.goto) e.currentTarget.style.background = item.done ? alpha(phase.color, 14) : 'var(--danger-soft)'; }} onMouseOut={e => { e.currentTarget.style.background = item.done ? alpha(phase.color, 8) : 'var(--danger-soft)'; }}>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: item.sub ? 8 : 0 }}>
                                                                <span style={{
                                                                    width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                                    marginTop: 0, fontSize: 14, fontWeight: 800, color: 'var(--on-solid)',
                                                                    background: item.done ? phase.color : 'var(--danger)'
                                                                }}>
                                                                    {item.done ? '✓' : '!'}
                                                                </span>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{
                                                                        fontSize: 13,
                                                                        fontWeight: 700,
                                                                        color: item.done ? phase.color : 'var(--danger)',
                                                                        marginBottom: item.detail ? 4 : 0
                                                                    }}>
                                                                        {item.label}
                                                                    </div>
                                                                    {item.detail && <div style={{ fontSize: 11, color: T.textMuted }}>
                                                                        {item.detail}
                                                                    </div>}
                                                                </div>
                                                                {item.goto && <span style={{ fontSize: 10, color: item.done ? phase.color : 'var(--danger)', fontWeight: 700, flexShrink: 0 }}>{item.action || 'Ouvrir'} →</span>}
                                                            </div>
                                                            {item.sub && <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                {item.sub.map((sub, sIdx) => (
                                                                    <div key={sIdx} style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        fontSize: 11,
                                                                        color: T.textMuted
                                                                    }}>
                                                                        <span>{sub.label}</span>
                                                                        <span style={{
                                                                            fontWeight: 700,
                                                                            fontFamily: T.mono,
                                                                            color: sub.ok ? T.green : T.gold
                                                                        }}>
                                                                            {sub.value}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>;
                                        })}
                                    </div>
                                </div>;
                            })(),
                            /* ══════ PROGRAMME TAB — Modules avec durées personnalisables ══════ */
                            detailTab === 'programme' && (() => {
                                const saveSmField = async (smId, field, value) => {
                                    const updated = await api.patch(`/api/session-modules/${smId}`, { [field]: value });
                                    setSessMods(prev => prev.map(m => m.id === smId ? { ...m, ...updated } : m));
                                };

                                const totalOriginal = sessMods.reduce((s, m) => s + (parseFloat(m.duration_hours) || 0), 0);
                                const inputSt = { padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' };

                                return <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Programme de la session</div>
                                            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                                                Modules copiés depuis la formation — durées personnalisables pour cette session
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', padding: '6px 14px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)' }}>
                                            {totalOriginal}h total
                                        </div>
                                    </div>

                                    {sessModsLoading ? (
                                        <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 12 }}>Chargement…</div>
                                    ) : sessMods.length === 0 ? (
                                        <div style={{ padding: 40, textAlign: 'center', color: T.textDim, fontSize: 13, border: `1px dashed ${T.border3}`, borderRadius: 10 }}>
                                            Aucun module — les modules seront copiés automatiquement depuis la formation lors de la prochaine session créée.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {sessMods.map((m, idx) => {
                                                const isEditing = editingSm === m.id;
                                                return <div key={m.id} style={{
                                                    background: T.card, border: `1px solid ${isEditing ? 'color-mix(in srgb, var(--warning) 40%, transparent)' : T.border}`,
                                                    borderRadius: 10, padding: '14px 18px', transition: 'border-color 0.15s',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <span style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 12, minWidth: 36, textAlign: 'center', background: 'color-mix(in srgb, var(--warning) 7%, transparent)', padding: '3px 8px', borderRadius: 5 }}>M{idx + 1}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.title}</div>
                                                            {m.description && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{m.description}</div>}
                                                        </div>
                                                        {isEditing ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <input
                                                                    type="number" step="0.5" min="0"
                                                                    value={editSmData.duration_hours ?? m.duration_hours}
                                                                    onChange={e => setEditSmData(p => ({ ...p, duration_hours: e.target.value }))}
                                                                    style={{ ...inputSt, width: 70, textAlign: 'center', fontWeight: 700 }}
                                                                    autoFocus
                                                                />
                                                                <span style={{ fontSize: 12, color: T.textMuted }}>h</span>
                                                                <button onClick={async () => {
                                                                    if (editSmData.duration_hours !== undefined) {
                                                                        await saveSmField(m.id, 'duration_hours', parseFloat(editSmData.duration_hours) || 0);
                                                                    }
                                                                    setEditingSm(null); setEditSmData({});
                                                                }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--warning)', color: 'var(--on-solid)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>✓</button>
                                                                <button onClick={() => { setEditingSm(null); setEditSmData({}); }} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: T.font }}>✕</button>
                                                            </div>
                                                        ) : (
                                                            <div onClick={() => { setEditingSm(m.id); setEditSmData({ duration_hours: m.duration_hours }); }}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, transition: 'border-color 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--warning)'}
                                                                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                                                                title="Cliquer pour modifier la durée"
                                                            >
                                                                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.duration_hours || 0}h</span>
                                                                <span style={{ fontSize: 10, color: T.textDim }}>✏️</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>;
                                            })}
                                        </div>
                                    )}
                                </div>;
                            })(),

                            detailTab === 'documents' && (()=>{
                                const docs = getDocuments(sessionDetail);
                                const inscriptions = sessionDetail.inscriptions || [];
                                const clientName = sessionDetail.client_company || sessionDetail.client_name || 'Client';
                                const generatePdf = (type, apprenantId)=>{
                                    let url;
                                    if (type === 'livret_accueil') {
                                        url = `/api/sessions/${sessionDetail.id}/livret`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                    } else if (type === 'convention') {
                                        url = `/api/sessions/${sessionDetail.id}/convention`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                        else if (inscriptions.length > 0) url += `?apprenant_id=${inscriptions[0].apprenant_id}`;
                                    } else if (type === 'attestation') {
                                        url = `/api/sessions/${sessionDetail.id}/attestation`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                    } else if (type === 'certificat') {
                                        url = `/api/sessions/${sessionDetail.id}/certificat`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                    } else if (type === 'programme') {
                                        url = `/api/sessions/${sessionDetail.id}/programme`;
                                    } else if (type.startsWith('emargement')) {
                                        const emMode = type.split(':')[1] || 'jour';
                                        url = `/api/sessions/${sessionDetail.id}/emargement?mode=${emMode}`;
                                    } else {
                                        url = "/api/sessions/".concat(sessionDetail.id, "/documents?type=").concat(type);
                                        if (apprenantId) url += "&apprenant_id=".concat(apprenantId);
                                    }
                                    window.open(url, '_blank');
                                };
                                const generateAllPerApprenant = (type)=>{
                                    inscriptions.forEach((ins, idx)=>{
                                        setTimeout(()=>generatePdf(type, ins.apprenant_id), idx * 300);
                                    });
                                    setDocStatus(type, 'generated');
                                };

                                const GESTION_SUBTABS = [
                                    { id: 'conventions', label: 'Conventions', icon: '📋' },
                                    { id: 'convocations', label: 'Convocations', icon: '📩' },
                                    { id: 'evaluations', label: 'Évaluations', icon: '📝' },
                                    { id: 'finances', label: 'Finances', icon: '💰' },
                                ];

                                // Helper: build PDF URL for a doc type
                                const buildPdfUrl = (docKey, apprenantId) => {
                                    if (docKey === 'livret_accueil') {
                                        let url = `/api/sessions/${sessionDetail.id}/livret`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                        return url;
                                    }
                                    if (docKey === 'convention') {
                                        let url = `/api/sessions/${sessionDetail.id}/convention`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                        else if (inscriptions.length > 0) url += `?apprenant_id=${inscriptions[0].apprenant_id}`;
                                        return url;
                                    }
                                    if (docKey === 'attestation') {
                                        let url = `/api/sessions/${sessionDetail.id}/attestation`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                        return url;
                                    }
                                    if (docKey === 'certificat') {
                                        let url = `/api/sessions/${sessionDetail.id}/certificat`;
                                        if (apprenantId) url += `?apprenant_id=${apprenantId}`;
                                        return url;
                                    }
                                    if (docKey === 'programme') {
                                        return `/api/sessions/${sessionDetail.id}/programme`;
                                    }
                                    if (docKey.startsWith('emargement')) {
                                        const emMode = docKey.split(':')[1] || 'jour';
                                        return `/api/sessions/${sessionDetail.id}/emargement?mode=${emMode}`;
                                    }
                                    let url = `/api/sessions/${sessionDetail.id}/documents?type=${docKey}`;
                                    if (apprenantId) url += `&apprenant_id=${apprenantId}`;
                                    return url;
                                };

                                // Helper: preview PDF in modal
                                const previewDoc = (docKey, title, apprenantId) => {
                                    setPdfPreview({ url: buildPdfUrl(docKey, apprenantId), title });
                                };

                                // Helper: download PDF
                                const downloadDoc = (docKey, apprenantId) => {
                                    const url = buildPdfUrl(docKey, apprenantId);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${docKey}_${sessionDetail.formation_code || 'doc'}.pdf`;
                                    a.click();
                                };

                                // Helper: render a document card with status + actions (Digiforma-style)
                                const DocCard = ({ docKey, label, icon, canGenerate, perApprenant }) => {
                                    const st = docs[docKey] || 'none';
                                    const info = DOC_STATUS_MAP[st] || DOC_STATUS_MAP.none;
                                    const dateGenerated = docs[docKey + '_date'] || null;
                                    const lastUpdate = docs[docKey + '_updated_at'] || dateGenerated;
                                    const statusDate = docs[docKey + '_' + st + '_at'] || lastUpdate;
                                    const isGenerated = st !== 'none';
                                    const iBtn = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: T.textSub, transition: 'all 0.15s' };
                                    return <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                                        {/* Date line */}
                                        {statusDate && <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
                                            {st === 'generated' ? 'Généré' : st === 'sent' ? 'Envoyé' : st === 'signed' ? 'Signé' : 'Mis à jour'} le {statusDate}
                                        </div>}

                                        {/* Main row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            {/* Download icon-button */}
                                            <button onClick={() => {
                                                if (!canGenerate) return;
                                                const aid = perApprenant && inscriptions.length === 1 ? inscriptions[0].apprenant_id : undefined;
                                                downloadDoc(docKey, aid);
                                            }} title="Télécharger le PDF" style={{
                                                ...iBtn, width: 42, height: 42, background: isGenerated ? alpha('var(--pillar-prod)', 7) : T.card, borderColor: isGenerated ? alpha('var(--pillar-prod)', 27) : T.border2,
                                                color: isGenerated ? 'var(--pillar-prod)' : T.textMuted,
                                            }}>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </button>

                                            {/* Label */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
                                                {!isGenerated && canGenerate && <div style={{ fontSize: 11, color: T.textMuted }}>Pas encore généré</div>}
                                                {isGenerated && !dateGenerated && <div style={{ fontSize: 11, color: info.c }}>{info.l}</div>}
                                            </div>

                                            {/* Action buttons */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {/* Generate / Regenerate */}
                                                {canGenerate && !(perApprenant && inscriptions.length > 1) && <button onClick={() => {
                                                    const aid = perApprenant && inscriptions.length === 1 ? inscriptions[0].apprenant_id : undefined;
                                                    generatePdf(docKey, aid);
                                                    setDocStatus(docKey, 'generated');
                                                }} title={isGenerated ? 'Régénérer' : 'Générer le PDF'} style={{
                                                    ...iBtn, background: alpha('var(--success)', 6), borderColor: alpha('var(--success)', 27), color: 'var(--success)',
                                                }}>
                                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                                </button>}

                                                {/* Preview */}
                                                <button onClick={() => {
                                                    const aid = perApprenant && inscriptions.length === 1 ? inscriptions[0].apprenant_id : undefined;
                                                    previewDoc(docKey, label, aid);
                                                }} title="Prévisualiser" style={{
                                                    ...iBtn, background: alpha('var(--info)', 6), borderColor: alpha('var(--info)', 27), color: 'var(--info)',
                                                }}>
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5"/></svg>
                                                </button>

                                                {/* Send email */}
                                                <button onClick={() => {
                                                    if (!isGenerated) {
                                                        toast.error('Générez d’abord le document avant de l’enregistrer comme envoyé.');
                                                        return;
                                                    }
                                                    setDocStatus(docKey, 'sent');
                                                }} title="Marquer comme envoyé par e-mail" style={{
                                                    ...iBtn, background: alpha('var(--warning)', 6), borderColor: alpha('var(--warning)', 27), color: 'var(--warning)',
                                                }}>
                                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="3" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 3.5l6 4.5 6-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                                </button>

                                                {/* Status pill */}
                                                <button onClick={() => cycleDocStatus(docKey)} title="Cliquer pour changer le statut" style={{
                                                    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                                    background: alpha(info.c, 8), border: `1px solid ${alpha(info.c, 20)}`, color: info.c,
                                                    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', marginLeft: 4,
                                                }}>
                                                    {st === 'signed' && '✓ '}{info.l}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Per-apprenant section */}
                                        {perApprenant && canGenerate && inscriptions.length > 0 && <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>Par apprenant :</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {inscriptions.map(ins => <div key={ins.apprenant_id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6, background: T.bg, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '6px 10px',
                                                }}>
                                                    <span style={{ fontSize: 12, color: T.text }}>{ins.first_name} {ins.last_name}</span>
                                                    <button onClick={() => previewDoc(docKey, `${label} — ${ins.first_name} ${ins.last_name}`, ins.apprenant_id)} title="Prévisualiser" style={{
                                                        width: 24, height: 24, borderRadius: 6, border: `1px solid color-mix(in srgb, var(--info) 20%, transparent)`, background: alpha('var(--info)', 6),
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--info)', fontSize: 11,
                                                    }}>
                                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5"/></svg>
                                                    </button>
                                                    <button onClick={() => downloadDoc(docKey, ins.apprenant_id)} title="Télécharger" style={{
                                                        width: 24, height: 24, borderRadius: 6, border: `1px solid ${T.border2}`, background: 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textMuted, fontSize: 11,
                                                    }}>
                                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    </button>
                                                </div>)}
                                                {inscriptions.length > 1 && <button onClick={() => generateAllPerApprenant(docKey)} style={{
                                                    padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                                                    background: alpha('var(--success)', 7), border: `1px solid color-mix(in srgb, var(--success) 20%, transparent)`, color: 'var(--success)',
                                                }}>Tous ({inscriptions.length})</button>}
                                            </div>
                                        </div>}
                                    </div>;
                                };

                                // Helper: section header with count
                                const SectionHeader = ({ title, description }) => <div style={{ marginBottom: 12 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>
                                    {description && <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{description}</p>}
                                </div>;

                                // Helper: evaluation row
                                const EvalRow = ({ label, description, count, total, modelName }) => {
                                    return <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{label}</div>
                                        <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 12px 0' }}>{description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', border: `3px solid ${count >= total ? 'var(--success)' : T.border2}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 700, color: count >= total ? 'var(--success)' : T.textMuted, background: count >= total ? alpha('var(--success)', 8) : 'transparent',
                                            }}>{count}/{total}</div>
                                            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: 'var(--pillar-prod)', textDecoration: 'none', fontWeight: 500 }}>
                                                {modelName}
                                            </a>
                                        </div>
                                        <button style={{
                                            marginTop: 10, padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            background: 'transparent', border: `1px solid ${T.border2}`, color: T.textSub, display: 'flex', alignItems: 'center', gap: 4,
                                        }}>+ Ajouter</button>
                                    </div>;
                                };

                                return <div>
                                    {/* ── Sub-tab bar ── */}
                                    <div style={{
                                        display: 'flex', gap: 0, marginBottom: 20, background: 'var(--success)', borderRadius: 8, overflow: 'hidden',
                                    }}>
                                        {GESTION_SUBTABS.map(st => <button key={st.id} onClick={() => setGestionSubTab(st.id)} style={{
                                            flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: gestionSubTab === st.id ? 700 : 500,
                                            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                            background: gestionSubTab === st.id ? 'color-mix(in srgb, var(--success) 80%, black)' : 'transparent',
                                            color: 'var(--on-solid)', position: 'relative',
                                        }}>
                                            {st.label}
                                            {gestionSubTab === st.id && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 40, height: 3, borderRadius: '2px 2px 0 0', background: 'var(--on-solid)' }} />}
                                        </button>)}
                                    </div>

                                    {/* ── CONVENTIONS ── */}
                                    {gestionSubTab === 'conventions' && (() => {
                                        // Group inscriptions by company for INTER sessions
                                        const isInter = sessionDetail.type_session === 'INTER' || !sessionDetail.client_company;
                                        const companyGroups = {};
                                        if (isInter && inscriptions.length > 0) {
                                            inscriptions.forEach(ins => {
                                                const co = ins.company || 'Sans entreprise';
                                                if (!companyGroups[co]) companyGroups[co] = [];
                                                companyGroups[co].push(ins);
                                            });
                                        } else {
                                            // INTRA: single client block
                                            companyGroups[clientName] = inscriptions;
                                        }
                                        const companyList = Object.entries(companyGroups);
                                        const colors_avatar = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4'];
                                        const conventionsGenerated = (docs.convention || 'none') !== 'none';
                                        const signedConventions = inscriptions.filter(i => i.convention_signed).length;

                                        const setCompanyConventionsSigned = async (members, signed) => {
                                            if (!members.length) return;
                                            const results = await Promise.all(members.map(member => api.patch('/api/inscriptions', {
                                                id: member.id,
                                                convention_signed: signed ? 1 : 0,
                                            })));
                                            if (results.some(result => result?.__failed)) {
                                                toast.error('Impossible de mettre à jour la signature de cette convention.');
                                                return;
                                            }
                                            toast.success(signed ? 'Convention marquée comme signée.' : 'Signature de la convention retirée.');
                                            loadDetail(selected.id);
                                        };

                                        const CompactContractDoc = ({ docKey, label, description }) => {
                                            const status = docs[docKey] || 'none';
                                            const statusInfo = DOC_STATUS_MAP[status] || DOC_STATUS_MAP.none;
                                            const updatedAt = docs[docKey + '_' + status + '_at'] || docs[docKey + '_updated_at'] || docs[docKey + '_date'];
                                            const ready = status !== 'none';
                                            return <div style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                                padding: '14px 16px', border: `1px solid ${T.border2}`, borderRadius: 10, background: T.card,
                                            }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{label}</div>
                                                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{updatedAt ? `${statusInfo.l} le ${updatedAt}` : description}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                    <button onClick={() => { generatePdf(docKey); setDocStatus(docKey, 'generated'); }} title={ready ? 'Régénérer le document' : 'Générer le document'} style={{
                                                        width: 32, height: 32, borderRadius: 7, border: `1px solid ${alpha('var(--success)', 28)}`, background: alpha('var(--success)', 7), color: 'var(--success)', cursor: 'pointer', fontWeight: 700,
                                                    }}>↓</button>
                                                    <button onClick={() => previewDoc(docKey, label)} title="Prévisualiser" style={{
                                                        width: 32, height: 32, borderRadius: 7, border: `1px solid ${alpha('var(--info)', 28)}`, background: alpha('var(--info)', 7), color: 'var(--info)', cursor: 'pointer', fontWeight: 700,
                                                    }}>⌕</button>
                                                    <button onClick={() => {
                                                        if (!ready) { toast.error('Générez d’abord ce document.'); return; }
                                                        setDocStatus(docKey, 'sent');
                                                    }} title="Enregistrer l’envoi par e-mail" style={{
                                                        width: 32, height: 32, borderRadius: 7, border: `1px solid ${alpha('var(--warning)', 28)}`, background: alpha('var(--warning)', 7), color: 'var(--warning)', cursor: 'pointer', fontWeight: 700,
                                                    }}>✉</button>
                                                </div>
                                            </div>;
                                        };

                                        return <div id="section-conventions">
                                        <SectionHeader title="Conventions et contrats par client" />

                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Dossier complet de la session</div>
                                                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                                                        {conventionsGenerated ? `${signedConventions}/${inscriptions.length} convention${inscriptions.length > 1 ? 's' : ''} signée${signedConventions > 1 ? 's' : ''}` : 'Pas encore généré'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 7 }}>
                                                    <button onClick={() => { generatePdf('convention'); setDocStatus('convention', 'generated'); }} style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${alpha('var(--success)', 28)}`, background: alpha('var(--success)', 7), color: 'var(--success)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Générer</button>
                                                    <button onClick={() => previewDoc('convention', 'Dossier conventions et contrats')} style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${T.border2}`, background: T.card, color: T.textSub, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Prévisualiser</button>
                                                    <button onClick={() => { if (!conventionsGenerated) { toast.error('Générez d’abord le dossier.'); return; } setDocStatus('convention', 'sent'); }} style={{ padding: '8px 12px', borderRadius: 7, border: `1px solid ${alpha('var(--warning)', 28)}`, background: alpha('var(--warning)', 7), color: 'var(--warning)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>E-mail</button>
                                                </div>
                                            </div>
                                        </div>

                                        {companyList.map(([company, members], idx) => {
                                            const allSigned = members.length > 0 && members.every(member => member.convention_signed);
                                            const contactNames = members.map(member => `${member.first_name || ''} ${member.last_name || ''}`.trim()).filter(Boolean);
                                            return <div key={company} style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                                                <div style={{ background: 'var(--surface-2)', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: 9, background: colors_avatar[idx % colors_avatar.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-solid)', fontWeight: 800 }}>{company.charAt(0).toUpperCase()}</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{company}</div>
                                                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{members.length} apprenant{members.length > 1 ? 's' : ''}{contactNames.length ? ` · ${contactNames.join(', ')}` : ''}</div>
                                                    </div>
                                                    <span style={{ padding: '4px 8px', borderRadius: 99, background: alpha(allSigned ? 'var(--success)' : 'var(--warning)', 10), color: allSigned ? 'var(--success)' : 'var(--warning)', fontWeight: 700, fontSize: 10 }}>{allSigned ? 'Signée' : 'À signer'}</span>
                                                </div>
                                                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Convention entreprise</div>
                                                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{conventionsGenerated ? 'Document disponible et modifiable' : 'Générez la convention pour ce client'}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                                        <button onClick={() => { generatePdf('convention', members[0]?.apprenant_id); setDocStatus('convention', 'generated'); }} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${alpha('var(--success)', 28)}`, background: alpha('var(--success)', 7), color: 'var(--success)', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>{conventionsGenerated ? 'Mettre à jour' : 'Générer'}</button>
                                                        <button onClick={() => previewDoc('convention', `Convention — ${company}`, members[0]?.apprenant_id)} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${T.border2}`, background: T.card, color: T.textSub, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>Voir</button>
                                                        <button onClick={() => { if (!conventionsGenerated) { toast.error('Générez d’abord la convention.'); return; } setDocStatus('convention', 'sent'); }} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${alpha('var(--warning)', 28)}`, background: alpha('var(--warning)', 7), color: 'var(--warning)', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>E-mail</button>
                                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 9px', borderRadius: 7, background: alpha(allSigned ? 'var(--success)' : T.textMuted, 7), color: allSigned ? 'var(--success)' : T.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={allSigned} onChange={event => setCompanyConventionsSigned(members, event.target.checked)} style={{ accentColor: 'var(--success)' }} /> Signée
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>;
                                        })}

                                        <div style={{ marginTop: 24 }}>
                                            <SectionHeader title="Autres documents contractuels" />
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                                                {[
                                                    { key: 'programme', label: 'Programme', description: 'Programme de formation' },
                                                    { key: 'cgv', label: 'CGV', description: 'Conditions générales de vente' },
                                                    { key: 'reglement', label: 'Règlement intérieur', description: 'Document interne de la session' },
                                                    { key: 'confidentialite', label: 'Politique de confidentialité', description: 'Information données personnelles' },
                                                ].map(d => <CompactContractDoc key={d.key} docKey={d.key} label={d.label} description={d.description} />)}
                                            </div>
                                        </div>
                                    </div>;
                                    })()}

                                    {/* ── CONVOCATIONS ── */}
                                    {gestionSubTab === 'convocations' && <div id="section-convocations">
                                        <SectionHeader title="Documents de session" description="Convocations, livrets, programme et feuille d'émargement." />
                                        <DocCard docKey="convocation" label="Convocation" icon="📩" canGenerate={true} perApprenant={true} />
                                        <DocCard docKey="livret_accueil" label="Livret d'Accueil & Convocation" icon="📖" canGenerate={true} perApprenant={true} />
                                        <DocCard docKey="programme" label="Programme detaille" icon="📄" canGenerate={true} perApprenant={false} />
                                        {/* Émargement with mode selector */}
                                        <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 16 }}>📋</span>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Feuille d'emargement</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {[
                                                    { mode: 'jour', label: 'Par jour', desc: '1 page/jour' },
                                                    { mode: 'semaine', label: 'Par semaine', desc: '1 page/semaine' },
                                                    { mode: 'demi_journee', label: 'Par demi-journee', desc: 'Matin + AM separes' },
                                                    { mode: 'session', label: 'Session complete', desc: 'Recap sur 1 feuille' },
                                                    { mode: 'module', label: 'Par module', desc: '1 page/module' },
                                                    { mode: 'mensuel', label: 'Par mois', desc: 'Formations longues' },
                                                ].map(opt => (
                                                    <button key={opt.mode} onClick={() => {
                                                        window.open(`/api/sessions/${sessionDetail.id}/emargement?mode=${opt.mode}`, '_blank');
                                                    }} style={{
                                                        flex: '1 1 140px', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                                        background: 'transparent', border: `1px solid ${T.border2}`,
                                                        fontFamily: T.font, textAlign: 'left', transition: 'all 0.15s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = alpha(T.gold, 8); e.currentTarget.style.borderColor = alpha(T.gold, 40); }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = T.border2; }}
                                                    >
                                                        <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{opt.label}</div>
                                                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>{opt.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>Statut par apprenant</div>
                                            {inscriptions.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                                                Aucun apprenant inscrit
                                            </div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {inscriptions.map(ins => {
                                                    const convSent = ins.convocation_sent;
                                                    return <div key={ins.apprenant_id} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '10px 14px',
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{
                                                                width: 28, height: 28, borderRadius: '50%', background: convSent ? alpha('var(--success)', 13) : T.header,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                                                            }}>{convSent ? '✓' : '○'}</div>
                                                            <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{ins.first_name} {ins.last_name}</span>
                                                            {ins.company && <span style={{ fontSize: 11, color: T.textMuted }}>— {ins.company}</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span style={{
                                                                fontSize: 11, fontWeight: 600,
                                                                color: convSent ? 'var(--success)' : 'var(--warning)',
                                                            }}>{convSent ? 'Envoyée' : 'Non envoyée'}</span>
                                                            <button onClick={() => handleInscriptionFlag(ins.id, 'convocation_sent', !!convSent)} style={{
                                                                padding: '5px 9px', borderRadius: 6, border: `1px solid ${convSent ? alpha('var(--success)', 30) : T.border2}`,
                                                                background: convSent ? alpha('var(--success)', 8) : T.card, color: convSent ? 'var(--success)' : T.textSub,
                                                                cursor: 'pointer', fontSize: 10, fontWeight: 700,
                                                            }}>{convSent ? 'Annuler l’envoi' : 'Marquer envoyée'}</button>
                                                        </div>
                                                    </div>;
                                                })}
                                            </div>}
                                        </div>
                                    </div>}

                                    {/* ── ÉVALUATIONS ── */}
                                    {gestionSubTab === 'evaluations' && (() => {
                                        // Hooks hoisted to top-level SessionsView — using parent scope evals/evalSubTab/etc.

                                        const evalsOfType = evals.filter(e => e.type === evalSubTab);
                                        const evalByApprenant = {};
                                        evalsOfType.forEach(e => { evalByApprenant[e.apprenant_id] = e; });
                                        const completedCount = Object.keys(evalByApprenant).length;

                                        const handleSaveEval = async (apprenantId) => {
                                            // Parse structured responses from evalComments (JSON)
                                            let responsesObj = {};
                                            try { responsesObj = JSON.parse(evalComments || '{}'); } catch {}
                                            const result = await api.post('/api/evaluations', {
                                                session_id: sessionDetail.id,
                                                apprenant_id: apprenantId,
                                                type: evalSubTab,
                                                score: evalScore ? parseFloat(evalScore) : null,
                                                comments: evalComments,
                                                responses: JSON.stringify(responsesObj),
                                            });
                                            setEvals(prev => {
                                                const filtered = prev.filter(e => !(e.apprenant_id === apprenantId && e.type === evalSubTab));
                                                return [...filtered, result];
                                            });
                                            setShowEvalForm(null);
                                            setEvalScore('');
                                            setEvalComments('');
                                        };

                                        const handleDeleteEval = async (evalId) => {
                                            if (!(await confirm({ title: 'Supprimer cette évaluation ?', confirmLabel: 'Supprimer' }))) return;
                                            await api.del(`/api/evaluations/${evalId}`);
                                            setEvals(prev => prev.filter(e => e.id !== evalId));
                                        };

                                        const EVAL_TYPES = [
                                            { id: 'positionnement', label: 'Positionnement', desc: 'Évaluation des prérequis et du niveau initial avant la formation.', color: 'var(--pillar-prod)' },
                                            { id: 'acquis', label: 'Acquis', desc: 'Évaluation des compétences acquises pendant ou en fin de formation.', color: 'var(--info)' },
                                            { id: 'satisfaction', label: 'À chaud', desc: 'Évaluation immédiate de la satisfaction en fin de formation.', color: 'var(--success)' },
                                            { id: 'froid', label: 'À froid', desc: 'Évaluation différée (4-8 semaines après) : impact réel sur la pratique.', color: 'var(--warning)' },
                                        ];
                                        const currentType = EVAL_TYPES.find(t => t.id === evalSubTab) || EVAL_TYPES[0];
                                        const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' };

                                        return <div id="section-evaluations">
                                            {/* Eval type tabs */}
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                                {EVAL_TYPES.map(et => {
                                                    const count = evals.filter(e => e.type === et.id).length;
                                                    const active = evalSubTab === et.id;
                                                    return <button key={et.id} onClick={() => { setEvalSubTab(et.id); setShowEvalForm(null); }} style={{
                                                        flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: T.font, transition: 'all 0.15s',
                                                        background: active ? alpha(et.color, 8) : T.card, border: `1px solid ${active ? alpha(et.color, 40) : T.border2}`,
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                                    }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: active ? et.color : T.text }}>{et.label}</span>
                                                        <span style={{ fontSize: 10, color: active ? et.color : T.textMuted }}>{count}/{inscriptions.length}</span>
                                                    </button>;
                                                })}
                                            </div>

                                            {/* Description */}
                                            <div style={{ background: alpha(currentType.color, 3), border: `1px solid ${alpha(currentType.color, 13)}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                                                <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 2 }}>{currentType.label}</div>
                                                <div style={{ fontSize: 11, color: T.textMuted }}>{currentType.desc}</div>
                                            </div>

                                            {/* Progress bar + export */}
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                                                    <span>Progression — {completedCount}/{inscriptions.length} complété{completedCount > 1 ? 's' : ''}</span>
                                                    {completedCount > 0 && <button onClick={() => window.open(`/api/sessions/${sessionDetail.id}/bilan-eval?type=${evalSubTab}`, '_blank')} style={{
                                                        padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                                                        background: alpha(currentType.color, 8), border: `1px solid ${alpha(currentType.color, 27)}`, color: currentType.color,
                                                    }}>Exporter bilan PDF</button>}
                                                </div>
                                                <div style={{ height: 6, borderRadius: 3, background: T.border, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 3, background: currentType.color, width: inscriptions.length ? `${(completedCount / inscriptions.length) * 100}%` : '0%', transition: 'width 0.3s' }} />
                                                </div>
                                            </div>

                                            {/* Apprenants list */}
                                            {!evalsLoaded ? <div style={{ textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }}>Chargement…</div>
                                            : inscriptions.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: T.textDim, fontSize: 12, border: `1px dashed ${T.border3}`, borderRadius: 8 }}>Aucun apprenant inscrit</div>
                                            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {inscriptions.map(ins => {
                                                    const ev = evalByApprenant[ins.apprenant_id];
                                                    const isFormOpen = showEvalForm === ins.apprenant_id;
                                                    return <div key={ins.apprenant_id} style={{ background: T.card, border: `1px solid ${ev ? alpha(currentType.color, 27) : T.border2}`, borderRadius: 10, overflow: 'hidden' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{
                                                                    width: 32, height: 32, borderRadius: '50%',
                                                                    background: ev ? alpha(currentType.color, 13) : T.header,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: 12, fontWeight: 700, color: ev ? currentType.color : 'var(--inverse-fg)',
                                                                }}>{ev ? '✓' : (ins.first_name || '?')[0]}</div>
                                                                <div>
                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ins.first_name} {ins.last_name}</div>
                                                                    {ins.company && <div style={{ fontSize: 10, color: T.textMuted }}>{ins.company}</div>}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                {ev && <span style={{ fontSize: 11, fontWeight: 600, color: currentType.color }}>
                                                                    {ev.score != null ? `${ev.score}/10` : 'Complété'}
                                                                </span>}
                                                                {ev && <button onClick={() => handleDeleteEval(ev.id)} style={{
                                                                    padding: '3px 8px', borderRadius: 4, border: `1px solid color-mix(in srgb, var(--danger) 27%, transparent)`, background: 'transparent',
                                                                    color: 'var(--danger)', fontSize: 10, cursor: 'pointer', fontFamily: T.font,
                                                                }}>✕</button>}
                                                                {!ev && <button onClick={() => {
                                                                    setShowEvalForm(isFormOpen ? null : ins.apprenant_id);
                                                                    setEvalScore(''); setEvalComments('');
                                                                }} style={{
                                                                    padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                                                                    background: isFormOpen ? T.text : 'transparent', border: `1px solid ${isFormOpen ? T.text : T.border2}`,
                                                                    color: isFormOpen ? T.card : T.textSub,
                                                                }}>{isFormOpen ? 'Annuler' : 'Évaluer'}</button>}
                                                            </div>
                                                        </div>
                                                        {/* Inline eval form — structured by type */}
                                                        {isFormOpen && (() => {
                                                            // Questions grids per evaluation type
                                                            const QUESTIONS = {
                                                                positionnement: [
                                                                    "Connaissance du sujet de la formation",
                                                                    "Maîtrise des outils/logiciels abordés",
                                                                    "Expérience pratique dans le domaine",
                                                                    "Capacité à travailler en autonomie sur ces sujets",
                                                                ],
                                                                acquis: [
                                                                    "Compréhension des concepts clés",
                                                                    "Capacité à reproduire les exercices",
                                                                    "Maîtrise des outils présentés",
                                                                    "Atteinte des objectifs pédagogiques",
                                                                ],
                                                                satisfaction: [
                                                                    "La formation a répondu à mes attentes",
                                                                    "Le contenu était adapté à mon niveau",
                                                                    "Les méthodes pédagogiques étaient efficaces",
                                                                    "Le formateur maîtrisait son sujet",
                                                                    "Le formateur était à l'écoute des participants",
                                                                    "Les supports de formation étaient de qualité",
                                                                    "L'organisation matérielle était satisfaisante",
                                                                    "Le rythme de la formation était adapté",
                                                                    "Je recommanderais cette formation",
                                                                ],
                                                                froid: [
                                                                    "J'utilise les compétences acquises dans mon activité",
                                                                    "La formation a eu un impact positif sur ma pratique",
                                                                    "Je me sens plus autonome sur les sujets abordés",
                                                                    "Les connaissances acquises sont toujours pertinentes",
                                                                    "J'ai pu transmettre ces compétences à d'autres",
                                                                    "La formation a contribué à mes objectifs professionnels",
                                                                    "J'aurais besoin d'un approfondissement",
                                                                ],
                                                            };
                                                            const SCALE_LABELS = {
                                                                positionnement: ['1 — Novice', '2', '3 — Intermédiaire', '4', '5 — Expert'],
                                                                acquis: ['1 — Non acquis', '2', '3 — En cours', '4', '5 — Acquis'],
                                                                satisfaction: ['1 — Pas du tout', '2', '3 — Moyennement', '4', '5 — Tout à fait'],
                                                                froid: ['1 — Pas du tout', '2', '3 — Partiellement', '4', '5 — Tout à fait'],
                                                            };
                                                            const questions = QUESTIONS[evalSubTab] || QUESTIONS.satisfaction;
                                                            const scaleLabels = SCALE_LABELS[evalSubTab] || SCALE_LABELS.satisfaction;

                                                            // Use evalResponses state (JSON object { q0: 3, q1: 5, ... })
                                                            const responses = (() => {
                                                                try { return JSON.parse(evalComments || '{}'); } catch { return {}; }
                                                            })();
                                                            const setResponse = (qIdx, val) => {
                                                                const updated = { ...responses, [`q${qIdx}`]: val };
                                                                setEvalComments(JSON.stringify(updated));
                                                                // Auto-calculate average score
                                                                const vals = Object.values(updated).filter(v => typeof v === 'number');
                                                                if (vals.length > 0) {
                                                                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                                                                    setEvalScore(String(Math.round(avg * 20) / 10)); // scale 1-5 → 2-10
                                                                }
                                                            };
                                                            const answeredCount = Object.keys(responses).filter(k => k.startsWith('q') && typeof responses[k] === 'number').length;
                                                            const freeComment = responses._comment || '';

                                                            return <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                                                                {/* Scale legend */}
                                                                <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                                                                    {scaleLabels.map((lbl, i) => (
                                                                        <span key={i} style={{ fontSize: 9, color: T.textMuted, background: T.bg, padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.border}` }}>{lbl}</span>
                                                                    ))}
                                                                </div>

                                                                {/* Questions grid */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                    {questions.map((q, qIdx) => {
                                                                        const val = responses[`q${qIdx}`];
                                                                        return <div key={qIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: qIdx < questions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                                                                            <div style={{ flex: 1, fontSize: 11, color: T.text, lineHeight: 1.3 }}>{q}</div>
                                                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                                                {[1, 2, 3, 4, 5].map(n => (
                                                                                    <button key={n} onClick={() => setResponse(qIdx, n)} style={{
                                                                                        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontFamily: T.font,
                                                                                        fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                                                                                        background: val === n ? currentType.color : 'transparent',
                                                                                        border: `1.5px solid ${val === n ? currentType.color : T.border2}`,
                                                                                        color: val === n ? 'var(--on-solid)' : T.textMuted,
                                                                                    }}>{n}</button>
                                                                                ))}
                                                                            </div>
                                                                        </div>;
                                                                    })}
                                                                </div>

                                                                {/* Free comment */}
                                                                <div style={{ marginTop: 10 }}>
                                                                    <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>
                                                                        {evalSubTab === 'satisfaction' ? 'Points forts, axes d\'amélioration, suggestions' :
                                                                         evalSubTab === 'froid' ? 'Commentaires sur l\'impact à long terme' :
                                                                         'Observations complémentaires'}
                                                                    </div>
                                                                    <textarea style={{ ...inputSt, minHeight: 50, resize: 'vertical' }}
                                                                        placeholder="Commentaire libre (optionnel)…"
                                                                        value={freeComment}
                                                                        onChange={e => {
                                                                            const updated = { ...responses, _comment: e.target.value };
                                                                            setEvalComments(JSON.stringify(updated));
                                                                        }}
                                                                    />
                                                                </div>

                                                                {/* Progress + actions */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                                                    <span style={{ fontSize: 10, color: T.textMuted }}>{answeredCount}/{questions.length} réponses · Score: {evalScore || '—'}/10</span>
                                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                                        <button onClick={() => { setShowEvalForm(null); setEvalComments(''); setEvalScore(''); }} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: T.font }}>Annuler</button>
                                                                        <button onClick={() => handleSaveEval(ins.apprenant_id)} disabled={answeredCount === 0} style={{
                                                                            padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: answeredCount > 0 ? 'pointer' : 'default', fontFamily: T.font,
                                                                            background: answeredCount > 0 ? currentType.color : T.border, color: answeredCount > 0 ? 'var(--on-solid)' : T.textMuted,
                                                                        }}>Enregistrer</button>
                                                                    </div>
                                                                </div>
                                                            </div>;
                                                        })()}
                                                        {/* Show existing eval details */}
                                                        {ev && (() => {
                                                            let parsed = null;
                                                            try { parsed = JSON.parse(ev.comments || '{}'); } catch {}
                                                            if (parsed && typeof parsed === 'object' && Object.keys(parsed).some(k => k.startsWith('q'))) {
                                                                const QUESTIONS_MAP = {
                                                                    positionnement: ["Connaissance du sujet", "Maîtrise des outils", "Expérience pratique", "Autonomie"],
                                                                    acquis: ["Concepts clés", "Reproduction exercices", "Maîtrise outils", "Objectifs atteints"],
                                                                    satisfaction: ["Attentes", "Contenu adapté", "Méthodes efficaces", "Maîtrise formateur", "Écoute formateur", "Supports qualité", "Organisation", "Rythme", "Recommandation"],
                                                                    froid: ["Utilisation compétences", "Impact pratique", "Autonomie", "Pertinence", "Transmission", "Objectifs pro", "Approfondissement"],
                                                                };
                                                                const qLabels = QUESTIONS_MAP[ev.type] || [];
                                                                const answers = Object.entries(parsed).filter(([k]) => k.startsWith('q')).sort(([a], [b]) => a.localeCompare(b));
                                                                const comment = parsed._comment;
                                                                return <div style={{ padding: '6px 16px 10px 58px' }}>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px', marginBottom: comment ? 6 : 0 }}>
                                                                        {answers.map(([k, v]) => {
                                                                            const idx = parseInt(k.replace('q', ''));
                                                                            const label = qLabels[idx] || `Q${idx + 1}`;
                                                                            return <span key={k} style={{ fontSize: 10, color: T.textMuted }}>
                                                                                {label}: <strong style={{ color: currentType.color }}>{v}/5</strong>
                                                                            </span>;
                                                                        })}
                                                                    </div>
                                                                    {comment && <div style={{ fontSize: 11, color: T.textMuted, fontStyle: 'italic', lineHeight: 1.3 }}>« {comment} »</div>}
                                                                </div>;
                                                            }
                                                            return ev.comments ? <div style={{ padding: '0 16px 10px 58px', fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                                                                {ev.comments}
                                                            </div> : null;
                                                        })()}
                                                    </div>;
                                                })}
                                            </div>}

                                            {/* ── Documents post-formation ── */}
                                            <div style={{ marginTop: 24, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Documents post-formation</div>
                                                <DocCard docKey="attestation" label="Attestation de fin de formation" icon="🎓" canGenerate={true} perApprenant={true} />
                                                <DocCard docKey="certificat" label="Certificat de realisation" icon="📜" canGenerate={true} perApprenant={true} />
                                            </div>
                                        </div>;
                                    })()}

                                    {/* ── FINANCES ── */}
                                    {gestionSubTab === 'finances' && (()=>{
                                        const costHT = parseFloat(sessionDetail.tarif) || parseFloat(sessionDetail.cout_total) || parseFloat(sessionDetail.price_ht) || 0;
                                        const costTTC = costHT; /* Griothèque = exonéré TVA, TTC = HT */
                                        const totalFacture = sessionDetail.invoiced_amount || 0;
                                        const totalPaye = sessionDetail.paid_amount || 0;
                                        return <div>
                                            {/* Finance sub-tabs */}
                                            <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                                                {['Produits', 'Charges', 'Bilan Pédagogique et Financier'].map(tab => <button key={tab} style={{
                                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                                    color: tab === 'Produits' ? T.text : T.textMuted, paddingBottom: 4,
                                                    borderBottom: tab === 'Produits' ? `2px solid ${T.gold}` : 'none',
                                                }}>{tab}</button>)}
                                            </div>

                                            {/* Client finance block */}
                                            <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--pillar-prod)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--on-solid)' }}>
                                                        {clientName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-solid)' }}>{clientName}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{inscriptions.length} apprenant{inscriptions.length > 1 ? 's' : ''}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Coût de la formation</div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-solid)' }}>{costHT.toFixed(2)} € HT</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--success-soft)', borderRadius: 4, padding: '1px 6px', display: 'inline-block' }}>Exonéré TVA</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Total facturé</div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: totalFacture > 0 ? 'var(--success)' : 'var(--text)' }}>{totalFacture.toFixed(2)} € HT</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Total payé</div>
                                                        <div style={{ fontSize: 16, fontWeight: 700, color: totalPaye > 0 ? 'var(--success)' : 'var(--text)' }}>{totalPaye.toFixed(2)} €</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KPI sidebar-style in a row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                                                {[
                                                    { label: 'Factures en retard', value: '0', icon: '📄', color: 'var(--danger)' },
                                                    { label: 'Factures payées', value: '0', icon: '✅', color: 'var(--success)' },
                                                    { label: 'Factures - charges', value: `${costHT.toFixed(0)} € HT`, icon: '📊', color: 'var(--pillar-prod)' },
                                                    { label: 'Total des paiements', value: `${totalPaye.toFixed(2)} € TTC`, icon: '💶', color: 'var(--warning)' },
                                                ].map(kpi => <div key={kpi.label} style={{
                                                    background: T.card, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '10px 14px',
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                }}>
                                                    <span style={{ fontSize: 18 }}>{kpi.icon}</span>
                                                    <div>
                                                        <div style={{ fontSize: 10, color: T.textMuted }}>{kpi.label}</div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{kpi.value}</div>
                                                    </div>
                                                </div>)}
                                            </div>

                                            {/* Boutons génération Devis + Facture */}
                                            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                <button onClick={() => {
                                                    const isIntra = (sessionDetail.type_session || '').toLowerCase().includes('intra');
                                                    if (isIntra) {
                                                        setPdfPreview({ url: `/api/sessions/${sessionDetail.id}/devis`, title: `Devis — ${sessionDetail.formation_title || 'Session'}` });
                                                    } else {
                                                        const inscs = sessionDetail.inscriptions || [];
                                                        if (inscs.length === 0) return alert('Aucun apprenant inscrit');
                                                        // Preview first apprenant's devis
                                                        const firstIns = inscs[0];
                                                        setPdfPreview({ url: `/api/sessions/${sessionDetail.id}/devis?apprenant_id=${firstIns.apprenant_id}`, title: `Devis — ${firstIns.first_name || ''} ${firstIns.last_name || ''} — ${sessionDetail.formation_title || 'Session'}`, allUrls: inscs.map(ins => `/api/sessions/${sessionDetail.id}/devis?apprenant_id=${ins.apprenant_id}`), allLabels: inscs.map(ins => `${ins.first_name || ''} ${ins.last_name || ''}`.trim()) });
                                                    }
                                                }} style={{
                                                    padding: '10px 20px', background: 'linear-gradient(135deg, var(--gold-deep), var(--saffron-deep))', color: 'var(--gold-ink)',
                                                    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                                }}>📄 Devis</button>

                                                <button onClick={() => {
                                                    const isIntra = (sessionDetail.type_session || '').toLowerCase().includes('intra');
                                                    if (isIntra) {
                                                        setPdfPreview({ url: `/api/sessions/${sessionDetail.id}/facture`, title: `Facture — ${sessionDetail.formation_title || 'Session'}` });
                                                    } else {
                                                        const inscs = sessionDetail.inscriptions || [];
                                                        if (inscs.length === 0) return alert('Aucun apprenant inscrit');
                                                        const firstIns = inscs[0];
                                                        setPdfPreview({ url: `/api/sessions/${sessionDetail.id}/facture?apprenant_id=${firstIns.apprenant_id}`, title: `Facture — ${firstIns.first_name || ''} ${firstIns.last_name || ''} — ${sessionDetail.formation_title || 'Session'}`, allUrls: inscs.map(ins => `/api/sessions/${sessionDetail.id}/facture?apprenant_id=${ins.apprenant_id}`), allLabels: inscs.map(ins => `${ins.first_name || ''} ${ins.last_name || ''}`.trim()) });
                                                    }
                                                }} style={{
                                                    padding: '10px 20px', background: 'linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 80%, black))', color: 'var(--on-solid)',
                                                    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                                }}>🧾 Facture</button>

                                                <span style={{ fontSize: 10, color: 'var(--text-3)', alignSelf: 'center' }}>
                                                    Griothèque — Exonéré TVA (art. 261-4-4a CGI)
                                                </span>
                                            </div>
                                        </div>;
                                    })()}
                                </div>;
                            })(),
                            detailTab === 'apprenants' && /*#__PURE__*/ _jsx("div", {
                                id: 'section-apprenants',
                                children: [
                                    /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 14
                                        },
                                        children: [
                                            /*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: T.text
                                                },
                                                children: [
                                                    "Inscrits (",
                                                    ((_sessionDetail_inscriptions1 = sessionDetail.inscriptions) === null || _sessionDetail_inscriptions1 === void 0 ? void 0 : _sessionDetail_inscriptions1.length) || 0,
                                                    " / ",
                                                    sessionDetail.max_participants,
                                                    ")"
                                                ]
                                            }, void 0, true),
                                            /*#__PURE__*/ _jsx("button", {
                                                style: {
                                                    ...btnSecondary,
                                                    padding: '6px 14px',
                                                    fontSize: 12
                                                },
                                                onClick: async ()=>{
                                                    const list = await api.get('/api/apprenants');
                                                    setApprenants(list);
                                                    setShowAddApprenant(true);
                                                },
                                                children: "+ Inscrire"
                                            }, void 0, false)
                                        ]
                                    }, void 0, true),
                                    ((_sessionDetail_inscriptions2 = sessionDetail.inscriptions) === null || _sessionDetail_inscriptions2 === void 0 ? void 0 : _sessionDetail_inscriptions2.length) === 0 ? /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            textAlign: 'center',
                                            padding: '24px 0',
                                            color: T.textMuted,
                                            fontSize: 12,
                                            border: "1px solid ".concat(T.border),
                                            borderRadius: 8
                                        },
                                        children: "Aucun apprenant inscrit"
                                    }, void 0, false) : /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 6
                                        },
                                        children: sessionDetail.inscriptions.map((i)=>/*#__PURE__*/ _jsx("div", {
                                                style: {
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    background: T.card,
                                                    border: "1px solid ".concat(T.border2),
                                                    borderRadius: 8,
                                                    padding: '10px 14px'
                                                },
                                                children: [
                                                    /*#__PURE__*/ _jsx("div", {
                                                        children: [
                                                            /*#__PURE__*/ _jsx("span", {
                                                                style: {
                                                                    fontSize: 13,
                                                                    fontWeight: 600,
                                                                    color: T.text
                                                                },
                                                                children: [
                                                                    i.first_name,
                                                                    " ",
                                                                    i.last_name
                                                                ]
                                                            }, void 0, true),
                                                            i.company && /*#__PURE__*/ _jsx("span", {
                                                                style: {
                                                                    fontSize: 12,
                                                                    color: T.textMuted,
                                                                    marginLeft: 8
                                                                },
                                                                children: [
                                                                    "— ",
                                                                    i.company
                                                                ]
                                                            }, void 0, true),
                                                            i.financement && /*#__PURE__*/ _jsx("span", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    marginLeft: 8,
                                                                    fontWeight: 700,
                                                                    color: FINANCEMENT_COLOR[i.financement] || T.textMuted
                                                                },
                                                                children: i.financement
                                                            }, void 0, false),
                                                            i.price_ht > 0 && /*#__PURE__*/ _jsx("span", {
                                                                style: {
                                                                    fontSize: 11,
                                                                    marginLeft: 8,
                                                                    color: T.textDim
                                                                },
                                                                children: [
                                                                    i.price_ht,
                                                                    "€"
                                                                ]
                                                            }, void 0, true)
                                                        ]
                                                    }, void 0, true),
                                                    /*#__PURE__*/ _jsx("div", {
                                                        style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ _jsx(Badge, {
                                                                status: i.status
                                                            }, void 0, false),
                                                            /*#__PURE__*/ _jsx("button", {
                                                                onClick: async ()=>{
                                                                    // Open devis PDF in new tab
                                                                    window.open("/api/sessions/".concat(sessionDetail.id, "/devis?apprenant_id=").concat(i.apprenant_id), '_blank');
                                                                    // Fire webhook to Make
                                                                    try {
                                                                        const webhookUrl = localStorage.getItem('lesgriots_make_webhook_devis') || 'https://hook.eu2.make.com/7pw58igocyspb4oz98fp8475nq6o53du';
                                                                        if (webhookUrl) {
                                                                            await fetch(webhookUrl, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    session_id: sessionDetail.id,
                                                                                    apprenant_id: i.apprenant_id,
                                                                                    apprenant_name: (i.first_name + ' ' + i.last_name).trim(),
                                                                                    apprenant_email: i.email || '',
                                                                                    apprenant_company: i.company || '',
                                                                                    formation_title: sessionDetail.formation_title || '',
                                                                                    formation_code: sessionDetail.formation_code || '',
                                                                                    start_date: sessionDetail.start_date,
                                                                                    end_date: sessionDetail.end_date,
                                                                                    tarif: i.price_ht || sessionDetail.tarif,
                                                                                    type_session: sessionDetail.type_session,
                                                                                    financement: i.financement || '',
                                                                                    devis_pdf_url: window.location.origin + "/api/sessions/" + sessionDetail.id + "/devis?apprenant_id=" + i.apprenant_id,
                                                                                    timestamp: new Date().toISOString(),
                                                                                }),
                                                                            });
                                                                        }
                                                                    } catch(whErr) { console.error('Webhook devis error:', whErr); }
                                                                },
                                                                style: {
                                                                    padding: '3px 10px',
                                                                    background: alpha('var(--gold-deep)', 13),
                                                                    border: '1px solid color-mix(in srgb, var(--gold-deep) 33%, transparent)',
                                                                    borderRadius: 5,
                                                                    color: 'var(--gold-deep)',
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                },
                                                                children: "Devis"
                                                            }, void 0, false),
                                                            i.status !== 'confirme' && /*#__PURE__*/ _jsx("button", {
                                                                onClick: ()=>handleInscriptionStatus(i.id, 'confirme'),
                                                                style: {
                                                                    padding: '3px 8px',
                                                                    background: alpha(T.green, 13),
                                                                    border: "1px solid ".concat(alpha(T.green, 33)),
                                                                    borderRadius: 5,
                                                                    color: T.green,
                                                                    fontSize: 11,
                                                                    cursor: 'pointer'
                                                                },
                                                                children: "✓"
                                                            }, void 0, false),
                                                            i.status !== 'annule' && /*#__PURE__*/ _jsx("button", {
                                                                onClick: ()=>handleInscriptionStatus(i.id, 'annule'),
                                                                style: {
                                                                    padding: '3px 8px',
                                                                    background: alpha(T.danger, 13),
                                                                    border: "1px solid ".concat(alpha(T.danger, 33)),
                                                                    borderRadius: 5,
                                                                    color: T.danger,
                                                                    fontSize: 11,
                                                                    cursor: 'pointer'
                                                                },
                                                                children: "✗"
                                                            }, void 0, false)
                                                        ]
                                                    }, void 0, true)
                                                ]
                                            }, i.id, true))
                                    }, void 0, false)
                                ]
                            }, void 0, true),
                            detailTab === 'emargements' && /*#__PURE__*/ _jsx("div", {
                                id: 'section-emargements',
                                children: [
                                    /* ── Sous-onglets Suivi (style Digiforma) ── */
                                    _jsx("div", {
                                        style: { display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 16 },
                                        children: [
                                            { key: 'emargements', label: 'Émargements', icon: '📋' },
                                            { key: 'absences', label: 'Absences', icon: '⚠️' },
                                            { key: 'emails', label: 'E-mails', icon: '✉️' },
                                            { key: 'suivi_apprenants', label: 'Suivi apprenants', icon: '🎓' },
                                            { key: 'suivi_qualite', label: 'Suivi qualité', icon: '⭐' },
                                        ].map(st => _jsx("button", {
                                            key: st.key,
                                            onClick: () => setSuiviSubTab(st.key),
                                            style: {
                                                padding: '10px 18px', border: 'none', cursor: 'pointer',
                                                borderBottom: `2px solid ${suiviSubTab === st.key ? T.gold : 'transparent'}`,
                                                background: 'transparent',
                                                color: suiviSubTab === st.key ? T.gold : T.textMuted,
                                                fontSize: 11, fontWeight: suiviSubTab === st.key ? 700 : 500,
                                                fontFamily: T.font, letterSpacing: '0.02em',
                                                transition: 'all 0.15s',
                                            },
                                            children: `${st.icon} ${st.label}`
                                        }, st.key, false))
                                    }, void 0, true),

                                    /* ── SUB-TAB: Émargements ── */
                                    suiviSubTab === 'emargements' && _jsx("div", {
                                        children: [
                                            /* Boutons de génération PDF émargement */
                                            _jsx("div", {
                                                style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
                                                children: [
                                                    _jsx("button", {
                                                        onClick: () => {
                                                            const url = `/api/sessions/${selected.id}/documents?type=emargement`;
                                                            setPdfPreview({ url, title: `Émargement — ${selected.formation_title || 'Session'}` });
                                                        },
                                                        style: {
                                                            padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border2}`,
                                                            background: T.card, color: T.text, fontSize: 11, fontWeight: 600,
                                                            cursor: 'pointer', fontFamily: T.font, display: 'flex', alignItems: 'center', gap: 6,
                                                        },
                                                        children: '📄 Feuille 1 page par jour'
                                                    }, 'gen-jour', false),
                                                ].filter(Boolean)
                                            }, void 0, true),

                                            /* Grille de suivi émargement */
                                            _jsx("div", {
                                                style: { fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 },
                                                children: 'Suivi des émargements'
                                            }, void 0, false),
                                            Object.keys(emByDate).length === 0 ? _jsx("div", {
                                                style: { textAlign: 'center', padding: '30px 0', color: T.textMuted, fontSize: 12 },
                                                children: "Aucun émargement — les feuilles sont créées automatiquement à l'inscription des apprenants."
                                            }, void 0, false) : _jsx("div", {
                                                style: { display: 'flex', flexDirection: 'column', gap: 10 },
                                                children: Object.entries(emByDate).map(([date, rows]) => _jsx("div", {
                                                    style: { background: T.card, border: `1px solid ${T.border2}`, borderRadius: 10, overflow: 'hidden' },
                                                    children: [
                                                        _jsx("div", {
                                                            style: { padding: '8px 16px', background: 'var(--surface-2)', borderBottom: `1px solid ${T.border2}`, fontSize: 12, fontWeight: 600, color: T.textSub },
                                                            children: fmtDate(date)
                                                        }, void 0, false),
                                                        _jsx("table", {
                                                            style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
                                                            children: [
                                                                _jsx("thead", {
                                                                    children: _jsx("tr", {
                                                                        children: [
                                                                            _jsx("th", { style: { padding: '8px 16px', textAlign: 'left', color: T.textMuted, fontWeight: 500 }, children: "Apprenant" }, void 0, false),
                                                                            _jsx("th", { style: { padding: '8px 12px', textAlign: 'center', color: T.textMuted, fontWeight: 500 }, children: "Matin" }, void 0, false),
                                                                            _jsx("th", { style: { padding: '8px 12px', textAlign: 'center', color: T.textMuted, fontWeight: 500 }, children: "Après-midi" }, void 0, false),
                                                                        ]
                                                                    }, void 0, true)
                                                                }, void 0, false),
                                                                _jsx("tbody", {
                                                                    children: rows.map(e => _jsx("tr", {
                                                                        style: { borderTop: `1px solid ${T.border}` },
                                                                        children: [
                                                                            _jsx("td", { style: { padding: '8px 16px', color: T.text }, children: [e.first_name, " ", e.last_name] }, void 0, true),
                                                                            ['matin', 'apres_midi'].map(field => _jsx("td", {
                                                                                style: { padding: '8px 12px', textAlign: 'center' },
                                                                                children: _jsx("button", {
                                                                                    onClick: () => handleToggleEmargement(e.id, field, e[field]),
                                                                                    style: {
                                                                                        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                                                                        background: e[field] ? alpha(T.green, 20) : 'transparent',
                                                                                        border: `1px solid ${e[field] ? T.green : T.border3}`,
                                                                                        color: e[field] ? T.green : T.textMuted,
                                                                                    },
                                                                                    children: e[field] ? '✓' : '○'
                                                                                }, void 0, false)
                                                                            }, field, false))
                                                                        ]
                                                                    }, e.id, true))
                                                                }, void 0, false),
                                                            ]
                                                        }, void 0, true),
                                                    ]
                                                }, date, true))
                                            }, void 0, false),

                                            /* Archivage des feuilles signées */
                                            _jsx("div", {
                                                style: { marginTop: 20, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 },
                                                children: [
                                                    _jsx("div", {
                                                        style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 },
                                                        children: 'Archivage des feuilles d\'émargement signées'
                                                    }, void 0, false),
                                                    _jsx("div", {
                                                        style: { fontSize: 11, color: T.textMuted, marginBottom: 12 },
                                                        children: 'Une fois une feuille signée, vous pouvez charger un scan ici pour en garder une archive numérique.'
                                                    }, void 0, false),
                                                    _jsx("button", {
                                                        style: { padding: '6px 14px', borderRadius: 6, border: `1px dashed ${T.border3}`, background: 'transparent', color: T.textSub, fontSize: 11, cursor: 'pointer', fontFamily: T.font },
                                                        children: '📎 Ajouter un document'
                                                    }, void 0, false),
                                                ]
                                            }, void 0, true),
                                        ]
                                    }, 'sub-emargements', true),

                                    /* ── SUB-TAB: Absences ── */
                                    suiviSubTab === 'absences' && _jsx("div", {
                                        children: [
                                            _jsx("div", {
                                                style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' },
                                                children: _jsx("table", {
                                                    style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
                                                    children: [
                                                        _jsx("thead", {
                                                            children: _jsx("tr", {
                                                                style: { background: T.bg },
                                                                children: ['Apprenant', 'Nombre d\'absences', 'Nombre de retards', 'Email', 'Client'].map(h =>
                                                                    _jsx("th", { style: { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: h }, h, false)
                                                                )
                                                            }, void 0, true)
                                                        }, void 0, false),
                                                        _jsx("tbody", {
                                                            children: (sessionDetail?.inscriptions || []).map(insc => {
                                                                const ap = apprenants.find(a => a.id === insc.apprenant_id) || {};
                                                                /* Calculer absences depuis emargements */
                                                                const apEmargements = emargements.filter(e => e.apprenant_id === insc.apprenant_id);
                                                                const totalSlots = apEmargements.length * 2;
                                                                const presentSlots = apEmargements.reduce((sum, e) => sum + (e.matin ? 1 : 0) + (e.apres_midi ? 1 : 0), 0);
                                                                const absentSlots = totalSlots > 0 ? totalSlots - presentSlots : 0;
                                                                return _jsx("tr", {
                                                                    style: { borderTop: `1px solid ${T.border}` },
                                                                    children: [
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.blue, fontWeight: 600, cursor: 'pointer' }, children: `${ap.last_name || ''} ${ap.first_name || ''}`.trim() || '—' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px' }, children: absentSlots > 0 ? _jsx("span", { style: { color: T.danger, fontWeight: 600 }, children: `${absentSlots} demi-journée${absentSlots > 1 ? 's' : ''}` }, void 0, false) : _jsx("span", { style: { color: T.textMuted }, children: 'Aucune absence' }, void 0, false) }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textMuted }, children: 'Aucun retard' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textSub, fontSize: 11 }, children: ap.email || '—' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textSub }, children: ap.company || selected?.client_company || '—' }, void 0, false),
                                                                    ]
                                                                }, insc.apprenant_id, true);
                                                            })
                                                        }, void 0, false),
                                                    ]
                                                }, void 0, true)
                                            }, void 0, false),
                                        ]
                                    }, 'sub-absences', true),

                                    /* ── SUB-TAB: E-mails ── */
                                    suiviSubTab === 'emails' && _jsx("div", {
                                        children: [
                                            /* Boutons d'envoi rapide */
                                            _jsx("div", {
                                                style: { fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 },
                                                children: 'Envoyer un e-mail'
                                            }, void 0, false),
                                            _jsx("div", {
                                                style: { display: 'flex', gap: 8, marginBottom: 20 },
                                                children: [
                                                    { label: '✉️ Apprenants', target: 'apprenants' },
                                                    { label: '✉️ Intervenants', target: 'intervenants' },
                                                    { label: '✉️ Clients', target: 'clients' },
                                                ].map(btn => _jsx("button", {
                                                    style: { padding: '7px 16px', borderRadius: 8, border: `1px solid ${T.border2}`, background: T.card, color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font },
                                                    children: btn.label
                                                }, btn.target, false))
                                            }, void 0, true),

                                            /* Historique des e-mails */
                                            _jsx("div", {
                                                style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' },
                                                children: [
                                                    _jsx("div", {
                                                        style: { padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 0 },
                                                        children: ['E-mails envoyés', 'E-mails planifiés', 'E-mails automatiques'].map((tab, i) =>
                                                            _jsx("span", {
                                                                style: { padding: '4px 14px', fontSize: 11, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? T.gold : T.textMuted, borderBottom: i === 0 ? `2px solid ${T.gold}` : 'none', cursor: 'pointer' },
                                                                children: tab
                                                            }, tab, false)
                                                        )
                                                    }, void 0, true),
                                                    _jsx("table", {
                                                        style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
                                                        children: [
                                                            _jsx("thead", {
                                                                children: _jsx("tr", {
                                                                    style: { background: T.bg },
                                                                    children: ['Envoyé le', 'Email Destinataire', 'Type', 'Sujet', 'Statut'].map(h =>
                                                                        _jsx("th", { style: { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: h }, h, false)
                                                                    )
                                                                }, void 0, true)
                                                            }, void 0, false),
                                                            _jsx("tbody", {
                                                                children: _jsx("tr", {
                                                                    children: _jsx("td", {
                                                                        colSpan: 5,
                                                                        style: { padding: '30px 0', textAlign: 'center', color: T.textDim, fontSize: 12 },
                                                                        children: 'Aucun e-mail envoyé pour cette session.'
                                                                    }, void 0, false)
                                                                }, void 0, false)
                                                            }, void 0, false),
                                                        ]
                                                    }, void 0, true),
                                                ]
                                            }, void 0, true),
                                        ]
                                    }, 'sub-emails', true),

                                    /* ── SUB-TAB: Suivi apprenants ── */
                                    suiviSubTab === 'suivi_apprenants' && _jsx("div", {
                                        children: [
                                            /* Section Attestations */
                                            _jsx("div", {
                                                style: { fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
                                                children: 'Attestations'
                                            }, void 0, false),
                                            _jsx("div", {
                                                style: { background: `${alpha(T.gold, 7)}`, border: `1px solid ${alpha(T.gold, 20)}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 },
                                                children: [
                                                    _jsx("span", { style: { fontSize: 16, marginTop: 1 }, children: 'ℹ️' }, void 0, false),
                                                    _jsx("span", { style: { fontSize: 11, color: T.textSub, lineHeight: '1.5' }, children: 'Les apprenants en situation d\'abandon ou d\'absence sans date de reprise sont automatiquement désélectionnés de l\'envoi des certificats de réalisation, des attestations d\'assiduité et des micro-certifications.' }, void 0, false),
                                                ]
                                            }, void 0, true),

                                            /* Génération documents */
                                            _jsx("div", {
                                                style: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
                                                children: [
                                                    { type: 'certificat', label: 'Certificats de réalisation', icon: '📜' },
                                                    { type: 'attestation', label: 'Attestations d\'assiduité', icon: '📋' },
                                                ].map(doc => _jsx("div", {
                                                    style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 },
                                                    children: [
                                                        _jsx("button", {
                                                            onClick: () => {
                                                                const url = `/api/sessions/${selected.id}/documents?type=${doc.type}`;
                                                                setPdfPreview({ url, title: `${doc.label} — ${selected.formation_title || 'Session'}` });
                                                            },
                                                            style: { padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border2}`, background: T.bg, color: T.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, display: 'flex', alignItems: 'center', gap: 6 },
                                                            children: `${doc.icon} ${doc.label}`
                                                        }, void 0, false),
                                                    ]
                                                }, doc.type, true))
                                            }, void 0, true),

                                            /* Archivage documents */
                                            _jsx("div", {
                                                style: { marginBottom: 20 },
                                                children: [
                                                    _jsx("div", {
                                                        style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6, cursor: 'pointer' },
                                                        children: '▸ Archivage des documents apprenants'
                                                    }, void 0, false),
                                                ]
                                            }, void 0, true),

                                            /* Liste des apprenants */
                                            _jsx("div", {
                                                style: { fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
                                                children: 'Liste des apprenants'
                                            }, void 0, false),
                                            _jsx("div", {
                                                style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' },
                                                children: _jsx("table", {
                                                    style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
                                                    children: [
                                                        _jsx("thead", {
                                                            children: _jsx("tr", {
                                                                style: { background: T.bg },
                                                                children: ['Apprenant', 'Email', 'Entreprise', 'Assiduité', 'Progression'].map(h =>
                                                                    _jsx("th", { style: { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: h }, h, false)
                                                                )
                                                            }, void 0, true)
                                                        }, void 0, false),
                                                        _jsx("tbody", {
                                                            children: (sessionDetail?.inscriptions || []).map(insc => {
                                                                const ap = apprenants.find(a => a.id === insc.apprenant_id) || {};
                                                                const apEm = emargements.filter(e => e.apprenant_id === insc.apprenant_id);
                                                                const totalSlots = apEm.length * 2;
                                                                const presentSlots = apEm.reduce((sum, e) => sum + (e.matin ? 1 : 0) + (e.apres_midi ? 1 : 0), 0);
                                                                const pctAssiduity = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : 0;
                                                                return _jsx("tr", {
                                                                    style: { borderTop: `1px solid ${T.border}` },
                                                                    children: [
                                                                        _jsx("td", { style: { padding: '10px 14px', fontWeight: 600, color: T.text }, children: `${ap.last_name || ''} ${ap.first_name || ''}`.trim() || '—' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textSub, fontSize: 11 }, children: ap.email || '—' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textSub }, children: ap.company || '—' }, void 0, false),
                                                                        _jsx("td", { style: { padding: '10px 14px' }, children: [
                                                                            _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [
                                                                                _jsx("div", { style: { width: 60, height: 6, borderRadius: 3, background: T.border, overflow: 'hidden' }, children: _jsx("div", { style: { width: `${pctAssiduity}%`, height: '100%', background: pctAssiduity >= 80 ? T.green : pctAssiduity >= 50 ? T.gold : T.danger, borderRadius: 3 } }, void 0, false) }, void 0, false),
                                                                                _jsx("span", { style: { fontSize: 11, color: T.textSub, fontWeight: 600 }, children: `${pctAssiduity}%` }, void 0, false),
                                                                            ] }, void 0, true),
                                                                        ] }, void 0, true),
                                                                        _jsx("td", { style: { padding: '10px 14px', color: T.textMuted, fontSize: 11 }, children: `${presentSlots} / ${totalSlots} créneaux` }, void 0, false),
                                                                    ]
                                                                }, insc.apprenant_id, true);
                                                            })
                                                        }, void 0, false),
                                                    ]
                                                }, void 0, true)
                                            }, void 0, false),
                                        ]
                                    }, 'sub-suivi-apprenants', true),

                                    /* ── SUB-TAB: Suivi qualité ── */
                                    suiviSubTab === 'suivi_qualite' && _jsx("div", {
                                        children: [
                                            _jsx("div", {
                                                style: { fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
                                                children: 'Suivi qualité'
                                            }, void 0, false),
                                            _jsx("div", {
                                                style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
                                                children: [
                                                    /* Évaluation à chaud */
                                                    _jsx("div", {
                                                        style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }, children: '🔥 Évaluation à chaud' }, void 0, false),
                                                            _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12 }, children: 'Satisfaction des apprenants en fin de session' }, void 0, false),
                                                            _jsx("div", { style: { textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }, children: 'Aucune évaluation envoyée' }, void 0, false),
                                                        ]
                                                    }, 'eval-chaud', true),
                                                    /* Évaluation à froid */
                                                    _jsx("div", {
                                                        style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }, children: '❄️ Évaluation à froid' }, void 0, false),
                                                            _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12 }, children: 'Impact à 30/90 jours post-formation' }, void 0, false),
                                                            _jsx("div", { style: { textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }, children: 'Aucune évaluation envoyée' }, void 0, false),
                                                        ]
                                                    }, 'eval-froid', true),
                                                    /* Évaluation formateur */
                                                    _jsx("div", {
                                                        style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }, children: '👨‍🏫 Bilan formateur' }, void 0, false),
                                                            _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12 }, children: 'Retour du formateur sur la session' }, void 0, false),
                                                            _jsx("div", { style: { textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }, children: 'Aucun bilan renseigné' }, void 0, false),
                                                        ]
                                                    }, 'eval-formateur', true),
                                                    /* Réclamations */
                                                    _jsx("div", {
                                                        style: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 },
                                                        children: [
                                                            _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }, children: '📢 Réclamations / Incidents' }, void 0, false),
                                                            _jsx("div", { style: { fontSize: 11, color: T.textMuted, marginBottom: 12 }, children: 'Suivi des réclamations et incidents qualité' }, void 0, false),
                                                            _jsx("div", { style: { textAlign: 'center', padding: 20, color: T.textDim, fontSize: 12 }, children: 'Aucune réclamation enregistrée' }, void 0, false),
                                                        ]
                                                    }, 'reclamations', true),
                                                ]
                                            }, void 0, true),
                                        ]
                                    }, 'sub-suivi-qualite', true),
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true)
                ]
            }, void 0, true),
            showForm && /*#__PURE__*/ _jsx(Modal, {
                title: "Nouvelle session",
                onClose: ()=>setShowForm(false),
                width: 600,
                children: /*#__PURE__*/ _jsx(SessionForm, {
                    formations: formations,
                    clients: clients,
                    onSave: handleCreate,
                    onClose: ()=>setShowForm(false)
                }, void 0, false)
            }, void 0, false),
            editing && /*#__PURE__*/ _jsx(Modal, {
                title: "Modifier la session",
                onClose: ()=>setEditing(null),
                width: 600,
                children: /*#__PURE__*/ _jsx(SessionForm, {
                    formations: formations,
                    clients: clients,
                    initial: editing,
                    onSave: handleEdit,
                    onClose: ()=>setEditing(null)
                }, void 0, false)
            }, void 0, false),
            /* ── PDF Preview Modal (upgraded with apprenant selector for inter) ── */
            pdfPreview && <div onClick={() => setPdfPreview(null)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--overlay)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="resp-modal" onClick={e => e.stopPropagation()} style={{ width: 'min(900px, 92vw)', height: 'min(85vh, 900px)', background: 'var(--surface-2)', borderRadius: 14, border: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 18 }}>📄</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfPreview.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            {pdfPreview.allUrls && pdfPreview.allUrls.length > 1 && (
                                <select onChange={e => setPdfPreview(prev => ({ ...prev, url: e.target.value }))} style={{ padding: '6px 10px', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}>
                                    {pdfPreview.allLabels.map((label, i) => <option key={i} value={pdfPreview.allUrls[i]}>{label}</option>)}
                                </select>
                            )}
                            <a href={pdfPreview.url} download style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--gold-deep) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold-deep) 33%, transparent)', color: 'var(--gold-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>⬇ Télécharger</a>
                            <a href={pdfPreview.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'color-mix(in srgb, var(--info) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--info) 33%, transparent)', color: 'var(--info)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>↗ Ouvrir</a>
                            <button onClick={() => setPdfPreview(null)} style={{ padding: '6px 14px', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                        </div>
                    </div>
                    {/* PDF embed */}
                    <object data={pdfPreview.url} type="application/pdf" style={{ flex: 1, border: 'none', background: '#fff', borderRadius: '0 0 14px 14px', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, background: 'var(--surface-2)' }}>
                            <span style={{ fontSize: 48 }}>📄</span>
                            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Impossible d'afficher le PDF dans le navigateur.</p>
                            <button onClick={() => window.open(pdfPreview.url, '_blank')} style={{ padding: '10px 24px', background: 'var(--gold-deep)', color: 'var(--gold-ink)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Ouvrir le PDF</button>
                        </div>
                    </object>
                </div>
            </div>,
            showAddApprenant && (()=>{
                const existingIds = ((sessionDetail === null || sessionDetail === void 0 ? void 0 : sessionDetail.inscriptions) || []).map((i)=>i.apprenant_id);
                return /*#__PURE__*/ _jsx(Modal, {
                    title: "Inscrire un apprenant",
                    onClose: ()=>setShowAddApprenant(false),
                    width: 440,
                    children: /*#__PURE__*/ _jsx("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                        },
                        children: [
                            /*#__PURE__*/ _jsx(Field, {
                                label: "Rechercher un apprenant",
                                children: /*#__PURE__*/ _jsx("input", {
                                    style: inputStyle,
                                    placeholder: "Nom, prénom, email ou entreprise…",
                                    value: selectedApprenantId ? '' : undefined,
                                    onChange: (e)=>{
                                        var _e_target_parentElement_querySelector;
                                        const q = e.target.value.toLowerCase();
                                        setSelectedApprenantId('');
                                        e.target.dataset.q = q;
                                        (_e_target_parentElement_querySelector = e.target.parentElement.querySelector('.apprenant-results')) === null || _e_target_parentElement_querySelector === void 0 ? void 0 : _e_target_parentElement_querySelector.setAttribute('data-q', q);
                                    },
                                    id: "apprenant-search-input"
                                }, void 0, false)
                            }, void 0, false),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    maxHeight: 250,
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4
                                },
                                children: [
                                    apprenants.filter((a)=>!existingIds.includes(a.id)).map((a)=>{
                                        const isSelected = selectedApprenantId === a.id;
                                        return /*#__PURE__*/ _jsx("div", {
                                            onClick: ()=>setSelectedApprenantId(a.id),
                                            style: {
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                border: "1px solid ".concat(isSelected ? T.gold : T.border2),
                                                background: isSelected ? T.goldDim : T.card
                                            },
                                            children: [
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: isSelected ? T.gold : T.text
                                                    },
                                                    children: [
                                                        a.first_name,
                                                        " ",
                                                        a.last_name
                                                    ]
                                                }, void 0, true),
                                                /*#__PURE__*/ _jsx("div", {
                                                    style: {
                                                        fontSize: 10,
                                                        color: T.textDim,
                                                        display: 'flex',
                                                        gap: 8
                                                    },
                                                    children: [
                                                        a.company && /*#__PURE__*/ _jsx("span", {
                                                            children: a.company
                                                        }, void 0, false),
                                                        a.email && /*#__PURE__*/ _jsx("span", {
                                                            children: a.email
                                                        }, void 0, false)
                                                    ]
                                                }, void 0, true)
                                            ]
                                        }, a.id, true);
                                    }),
                                    apprenants.filter((a)=>!existingIds.includes(a.id)).length === 0 && /*#__PURE__*/ _jsx("div", {
                                        style: {
                                            textAlign: 'center',
                                            padding: 16,
                                            color: T.textDim,
                                            fontSize: 12
                                        },
                                        children: "Tous les apprenants sont déjà inscrits"
                                    }, void 0, false)
                                ]
                            }, void 0, true),
                            /*#__PURE__*/ _jsx("div", {
                                style: {
                                    display: 'flex',
                                    gap: 10,
                                    paddingTop: 4
                                },
                                children: [
                                    /*#__PURE__*/ _jsx("button", {
                                        style: btnPrimary,
                                        disabled: !selectedApprenantId,
                                        onClick: handleAddApprenant,
                                        children: "Inscrire"
                                    }, void 0, false),
                                    /*#__PURE__*/ _jsx("button", {
                                        style: btnSecondary,
                                        onClick: ()=>setShowAddApprenant(false),
                                        children: "Annuler"
                                    }, void 0, false)
                                ]
                            }, void 0, true)
                        ]
                    }, void 0, true)
                }, void 0, false);
            })()
        ]
    }, void 0, true);
}

export function ApprenantsView() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [apprenants, setApprenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('infos');
  const [detailData, setDetailData] = useState(null);
  const [viewMode, setViewMode] = useState('pipeline'); // pipeline | table
  const [showPositionnement, setShowPositionnement] = useState(null); // apprenant for positionnement
  const [positionnementForm, setPositionnementForm] = useState({ decision: 'admis', notes: '', amenagements: '', date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get('/api/apprenants');
    setApprenants(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id) => {
    const data = await api.get('/api/apprenants/' + id);
    setDetailData(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = apprenants.filter(a =>
    `${a.first_name} ${a.last_name} ${a.email} ${a.company}`.toLowerCase().includes(search.toLowerCase())
  );

  const ETAT_MAP = {
    new: { l: 'Nouveau', c: T.textDim, icon: '◯' },
    mail_sent: { l: 'Mail envoyé', c: 'var(--gold-deep)', icon: '✉' },
    positionnement_ok: { l: 'Posit. OK', c: 'var(--info)', icon: '✓' },
    doc_genere: { l: 'Docs générés', c: 'var(--pillar-prod)', icon: '📄' },
    doc_envoye: { l: 'Docs envoyés', c: 'var(--warning)', icon: '📨' },
    doc_signe: { l: 'Signés', c: 'var(--success)', icon: '✅' },
    termine: { l: 'Terminé', c: 'var(--success)', icon: '🏁' },
    refuse: { l: 'Refusé', c: T.danger, icon: '✗' },
  };

  const PIPELINE_COLS = [
    { key: 'new', label: 'Nouveaux' },
    { key: 'mail_sent', label: 'Mail envoyé' },
    { key: 'positionnement_ok', label: 'Posit. OK' },
    { key: 'doc_genere', label: 'Docs générés' },
    { key: 'doc_envoye', label: 'Docs envoyés' },
    { key: 'doc_signe', label: 'Signés' },
    { key: 'termine', label: 'Terminé' },
    { key: 'refuse', label: 'Refusé' },
  ];

  const handleCreate = async (data) => {
    const r = await api.post('/api/apprenants', data);
    if (!r?.__failed) toast.success('Apprenant créé');
    setShowForm(false);
    load();
  };
  const handleEdit = async (data) => {
    const r = await api.patch('/api/apprenants/' + editing.id, data);
    if (!r?.__failed) toast.success('Apprenant enregistré');
    setEditing(null);
    load();
    if (selected?.id === editing.id) loadDetail(editing.id);
  };
  const handleDelete = async (id) => {
    if (!(await confirm({ title: 'Supprimer cet apprenant ?', confirmLabel: 'Supprimer' }))) return;
    const r = await api.del('/api/apprenants/' + id);
    if (!r?.__failed) toast.success('Apprenant supprimé');
    if (selected?.id === id) { setSelected(null); setDetailData(null); }
    load();
  };

  const changeEtat = async (id, newEtat) => {
    await api.patch('/api/apprenants/' + id, { etat: newEtat });
    load();
    if (selected?.id === id) loadDetail(id);
  };

  // Positionnement: open form before moving to positionnement_ok
  const handlePositionnementOpen = (apprenant) => {
    setShowPositionnement(apprenant);
    setPositionnementForm({ decision: 'admis', notes: '', amenagements: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handlePositionnementSubmit = async () => {
    const a = showPositionnement;
    if (!a) return;
    // Save positionnement data
    await api.patch('/api/apprenants/' + a.id, {
      etat: positionnementForm.decision === 'refuse' ? 'refuse' : 'positionnement_ok',
      date_positionnement: positionnementForm.date,
      positionnement_decision: positionnementForm.decision,
      positionnement_notes: positionnementForm.notes,
      positionnement_amenagements: positionnementForm.amenagements,
    });
    // Trigger Make webhook
    try {
      fetch('https://hook.eu2.make.com/zugvlj7cju1upq5eyvldj26kegfxd6uy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'positionnement_ok', apprenant_id: a.id, first_name: a.first_name, last_name: a.last_name, email: a.email, decision: positionnementForm.decision }),
      });
    } catch (e) { console.warn('Webhook error', e); }
    setShowPositionnement(null);
    load();
    if (selected?.id === a.id) loadDetail(a.id);
  };

  const handleSelect = async (a) => {
    setSelected(a);
    setDetailTab('infos');
    await loadDetail(a.id);
  };

  // Pipeline column counts
  const byEtat = {};
  PIPELINE_COLS.forEach(col => { byEtat[col.key] = filtered.filter(a => (a.etat || 'new') === col.key); });

  // KPIs
  const total = apprenants.length;
  const enCours = apprenants.filter(a => !['termine', 'refuse'].includes(a.etat || 'new')).length;
  const termines = apprenants.filter(a => a.etat === 'termine').length;

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>Chargement...</div>;

  // ── DETAIL VIEW ──
  if (selected && detailData) {
    const d = detailData;
    const etat = ETAT_MAP[d.etat || 'new'] || ETAT_MAP.new;
    const inscriptions = d.inscriptions || [];
    return (
      <div>
        {/* Back button + header */}
        <button onClick={() => { setSelected(null); setDetailData(null); }} style={{ ...btnPrimary, background: 'transparent', color: T.textMuted, border: 'none', padding: '4px 0', marginBottom: 16, fontSize: 13 }}>
          ← Retour aux apprenants
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: alpha(T.gold, 8), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: T.gold }}>
            {(d.first_name?.[0] || '').toUpperCase()}{(d.last_name?.[0] || '').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.fontDisplay, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
              {d.first_name} {d.last_name}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{d.email} {d.phone ? `· ${d.phone}` : ''}</div>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 6, background: alpha(etat.c, 9), color: etat.c, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${alpha(etat.c, 20)}` }}>
            {etat.icon} {etat.l}
          </span>

          {/* State progression buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(d.etat === 'new' || d.etat === 'mail_sent' || !d.etat) && (
              <button onClick={() => handlePositionnementOpen(d)} style={{ ...btnPrimary, fontSize: 11, padding: '6px 12px' }}>✓ Positionnement</button>
            )}
            {d.etat === 'positionnement_ok' && (
              <button onClick={() => changeEtat(d.id, 'doc_genere')} style={{ ...btnPrimary, fontSize: 11, padding: '6px 12px' }}>📄 Docs générés</button>
            )}
            {d.etat === 'doc_genere' && (
              <button onClick={() => changeEtat(d.id, 'doc_envoye')} style={{ ...btnPrimary, fontSize: 11, padding: '6px 12px' }}>📨 Docs envoyés</button>
            )}
            {d.etat === 'doc_envoye' && (
              <button onClick={() => changeEtat(d.id, 'doc_signe')} style={{ ...btnPrimary, fontSize: 11, padding: '6px 12px' }}>✅ Docs signés</button>
            )}
          </div>

          <button onClick={() => setEditing(d)} style={{ ...btnPrimary, background: 'transparent', border: `1px solid ${T.border}`, color: T.text, fontSize: 11, padding: '6px 12px' }}>✏ Modifier</button>
          <button onClick={() => handleDelete(d.id)} style={{ ...btnPrimary, background: 'transparent', border: `1px solid ${alpha(T.danger, 27)}`, color: T.danger, fontSize: 11, padding: '6px 12px' }}>Supprimer</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
          {['infos', 'sessions', 'suivi'].map(tab => (
            <button key={tab} onClick={() => setDetailTab(tab)} style={{
              padding: '10px 20px', border: 'none', borderBottom: `2px solid ${detailTab === tab ? T.gold : 'transparent'}`,
              background: 'transparent', color: detailTab === tab ? T.gold : T.textMuted,
              fontSize: 12, fontWeight: detailTab === tab ? 700 : 500, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {tab === 'infos' ? 'Infos' : tab === 'sessions' ? 'Sessions' : 'Suivi'}
            </button>
          ))}
        </div>

        {detailTab === 'infos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            {/* Identité */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Identité</div>
              {[['Civilité', d.civilite], ['Prénom', d.first_name], ['Nom', d.last_name], ['Email', d.email], ['Code', d.code_interne], ['Naissance', fmtDate(d.date_naissance)], ['Nationalité', d.nationalite]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Coordonnées */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Coordonnées</div>
              {[['Adresse', d.adresse], ['Code postal', d.code_postal], ['Ville', d.ville], ['Téléphone', d.phone]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Situation */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Situation</div>
              {[['N° Sécu', d.numero_securite_sociale], ['Situation pro', d.situation_professionnelle], ['Statut juridique', d.statut_juridique], ['Entreprise', d.company], ['SIRET', d.siret]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Financement */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Financement</div>
              {[['Mode', d.financement], ['OPCO', d.opco], ['FAF', d.faf], ['Modalité paiement', d.modalite_paiement], ['Statut', d.statut_financement]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Notes — full width */}
            <div style={{ gridColumn: '1 / -1', background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Notes & Motivation</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{d.motivation || d.notes || '—'}</div>
              {d.handicap_detail && <div style={{ marginTop: 8, fontSize: 12, color: T.text }}><strong>Handicap:</strong> {d.handicap_detail}</div>}
            </div>
          </div>
        )}

        {detailTab === 'sessions' && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {inscriptions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: T.textMuted }}>Aucune inscription</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {['Formation', 'Code', 'Dates', 'Lieu', 'Statut session', 'Inscription'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscriptions.map(ins => (
                    <tr key={ins.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{ins.formation_title || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>{ins.formation_code || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{fmtDateRange(ins.start_date, ins.end_date)}</td>
                      <td style={{ padding: '10px 14px' }}>{ins.location || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><Badge status={ins.session_status} /></td>
                      <td style={{ padding: '10px 14px' }}><Badge status={ins.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'suivi' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            {/* Pipeline */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pipeline</div>
              {[['État', ETAT_MAP[d.etat || 'new']?.l], ['Modalité paiement', d.modalite_paiement], ['Financement', d.financement], ['Statut financement', d.statut_financement]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Dates clés */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Dates clés</div>
              {[['Positionnement', fmtDate(d.date_positionnement)], ['Envoi docs', fmtDate(d.date_envoi_doc)], ['Inscription', fmtDate(d.date_inscription)]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
              {d.positionnement_decision && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Décision posit.</div>
                  <div style={{ fontSize: 12, color: d.positionnement_decision === 'refuse' ? T.danger : T.green, fontWeight: 600 }}>
                    {d.positionnement_decision === 'admis' ? 'Admis' : d.positionnement_decision === 'admis_amenagement' ? 'Admis avec aménagement' : 'Refusé'}
                  </div>
                  {d.positionnement_notes && <div style={{ fontSize: 11, color: T.textSub, marginTop: 4 }}>{d.positionnement_notes}</div>}
                  {d.positionnement_amenagements && <div style={{ fontSize: 11, color: T.blue, marginTop: 2 }}>Aménagements: {d.positionnement_amenagements}</div>}
                </div>
              )}
            </div>
            {/* Financement entreprise */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Financement entreprise</div>
              {[['OPCO', d.opco], ['FAF', d.faf], ['SIRET', d.siret], ['Référent', d.nom_referent], ['Email réf.', d.email_referent]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {/* Liens */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Liens</div>
              {d.dossier_url && <a href={d.dossier_url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11, color: T.blue, marginBottom: 6, wordBreak: 'break-all' }}>📁 Dossier</a>}
              {d.lien_calendly && <a href={d.lien_calendly} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11, color: T.blue, wordBreak: 'break-all' }}>📅 Calendly</a>}
              {!d.dossier_url && !d.lien_calendly && <div style={{ fontSize: 12, color: T.textDim }}>—</div>}
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <Modal title="Modifier l'apprenant" onClose={() => setEditing(null)} width={700}>
            <ApprenantForm initial={editing} onSave={handleEdit} onClose={() => setEditing(null)} />
          </Modal>
        )}
      </div>
    );
  }

  // ── MAIN VIEW (Pipeline + Table) ──
  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total apprenants" value={total} />
        <StatCard label="En cours" value={enCours} color={T.blue} />
        <StatCard label="Terminés" value={termines} color={T.green} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un apprenant..."
          style={{ ...inputStyle, maxWidth: 300 }} />

        <div style={{ display: 'flex', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {[{ k: 'pipeline', l: '▦ Pipeline' }, { k: 'table', l: '☰ Table' }].map(m => (
            <button key={m.k} onClick={() => setViewMode(m.k)} style={{
              padding: '7px 14px', border: 'none', fontSize: 11, fontWeight: viewMode === m.k ? 700 : 500, cursor: 'pointer',
              background: viewMode === m.k ? T.card : 'transparent', color: viewMode === m.k ? T.gold : T.textMuted,
              fontFamily: T.font,
            }}>{m.l}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(true)} style={btnPrimary}>+ Ajouter</button>
      </div>

      {/* ── PIPELINE KANBAN VIEW ── */}
      {viewMode === 'pipeline' && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, minHeight: 400 }}>
          {PIPELINE_COLS.filter(col => col.key !== 'refuse').map(col => {
            const colApprenants = byEtat[col.key] || [];
            const etatInfo = ETAT_MAP[col.key];
            return (
              <div key={col.key} style={{ minWidth: 200, maxWidth: 220, flex: '0 0 200px', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div style={{ padding: '10px 12px', background: alpha(etatInfo.c, 7), borderRadius: '10px 10px 0 0', borderBottom: `2px solid ${alpha(etatInfo.c, 27)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: etatInfo.c, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {etatInfo.icon} {col.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: etatInfo.c, background: alpha(etatInfo.c, 13), padding: '1px 6px', borderRadius: 8 }}>
                    {colApprenants.length}
                  </span>
                </div>
                {/* Cards */}
                <div style={{ flex: 1, background: T.bg, borderRadius: '0 0 10px 10px', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colApprenants.map(a => (
                    <div key={a.id} onClick={() => handleSelect(a)} style={{
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = alpha(etatInfo.c, 33); e.currentTarget.style.boxShadow = `0 2px 8px ${alpha(etatInfo.c, 8)}`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                        {a.first_name} {a.last_name}
                      </div>
                      {a.email && <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</div>}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {a.company && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--surface-3)', color: T.textSub }}>{a.company}</span>}
                        {a.financement && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: alpha(FINANCEMENT_COLOR[a.financement] || T.textDim, 9), color: FINANCEMENT_COLOR[a.financement] || T.textDim }}>{a.financement}</span>}
                      </div>
                      {/* Quick action: next step */}
                      {col.key === 'new' || col.key === 'mail_sent' ? (
                        <button onClick={e => { e.stopPropagation(); handlePositionnementOpen(a); }} style={{ marginTop: 6, width: '100%', padding: '4px 0', background: alpha(T.blue, 8), border: `1px solid ${alpha(T.blue, 20)}`, borderRadius: 5, color: T.blue, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          ✓ Positionnement
                        </button>
                      ) : col.key === 'positionnement_ok' ? (
                        <button onClick={e => { e.stopPropagation(); changeEtat(a.id, 'doc_genere'); }} style={{ marginTop: 6, width: '100%', padding: '4px 0', background: alpha('var(--pillar-prod)', 8), border: `1px solid color-mix(in srgb, var(--pillar-prod) 20%, transparent)`, borderRadius: 5, color: 'var(--pillar-prod)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          📄 Générer docs
                        </button>
                      ) : col.key === 'doc_genere' ? (
                        <button onClick={e => { e.stopPropagation(); changeEtat(a.id, 'doc_envoye'); }} style={{ marginTop: 6, width: '100%', padding: '4px 0', background: alpha('var(--warning)', 8), border: `1px solid color-mix(in srgb, var(--warning) 20%, transparent)`, borderRadius: 5, color: 'var(--warning)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          📨 Envoyer docs
                        </button>
                      ) : col.key === 'doc_envoye' ? (
                        <button onClick={e => { e.stopPropagation(); changeEtat(a.id, 'doc_signe'); }} style={{ marginTop: 6, width: '100%', padding: '4px 0', background: alpha(T.green, 8), border: `1px solid ${alpha(T.green, 20)}`, borderRadius: 5, color: T.green, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          ✅ Docs signés
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {colApprenants.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Refusé column — smaller */}
          {(() => {
            const refuses = byEtat['refuse'] || [];
            if (refuses.length === 0) return null;
            return (
              <div style={{ minWidth: 160, maxWidth: 180, flex: '0 0 160px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 12px', background: alpha(T.danger, 7), borderRadius: '10px 10px 0 0', borderBottom: `2px solid ${alpha(T.danger, 27)}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.danger, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✗ Refusés ({refuses.length})
                  </span>
                </div>
                <div style={{ flex: 1, background: T.bg, borderRadius: '0 0 10px 10px', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {refuses.map(a => (
                    <div key={a.id} onClick={() => handleSelect(a)} style={{ background: T.card, border: `1px solid ${alpha(T.danger, 13)}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', opacity: 0.7 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{a.first_name} {a.last_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {['Nom', 'Email / Tél', 'Structure', 'État', 'Financement', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const etat = ETAT_MAP[a.etat || 'new'] || ETAT_MAP.new;
                return (
                  <tr key={a.id} onClick={() => handleSelect(a)} style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{a.civilite ? a.civilite + ' ' : ''}{a.first_name} {a.last_name}</div>
                      {a.code_interne && <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim }}>{a.code_interne}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div>{a.email || '—'}</div>
                      {a.phone && <div style={{ fontSize: 10, color: T.textMuted }}>{a.phone}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: T.textSub }}>{a.company || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: alpha(etat.c, 9), color: etat.c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{etat.l}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {a.financement ? <span style={{ fontSize: 10, fontWeight: 600, color: FINANCEMENT_COLOR[a.financement] || T.textMuted }}>{a.financement}</span> : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); setEditing(a); }} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: T.textMuted }}>✏</button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }} style={{ background: 'none', border: `1px solid ${alpha(T.danger, 20)}`, borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: T.danger }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textMuted }}>Aucun apprenant trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── POSITIONNEMENT MODAL ── */}
      {showPositionnement && (
        <Modal title="Entretien de positionnement" onClose={() => setShowPositionnement(null)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{showPositionnement.first_name} {showPositionnement.last_name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{showPositionnement.email}</div>
            </div>

            <Field label="Date de l'entretien">
              <input type="date" value={positionnementForm.date} onChange={e => setPositionnementForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Décision">
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 'admis', l: '✓ Admis', c: T.green }, { v: 'admis_amenagement', l: '⚠ Admis avec aménagement', c: 'var(--warning)' }, { v: 'refuse', l: '✗ Refusé', c: T.danger }].map(opt => (
                  <button key={opt.v} onClick={() => setPositionnementForm(f => ({ ...f, decision: opt.v }))}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, textAlign: 'center',
                      border: `2px solid ${positionnementForm.decision === opt.v ? opt.c : T.border}`,
                      background: positionnementForm.decision === opt.v ? alpha(opt.c, 8) : T.card,
                      color: positionnementForm.decision === opt.v ? opt.c : T.textMuted,
                    }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Notes de l'entretien">
              <textarea value={positionnementForm.notes} onChange={e => setPositionnementForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Points abordés, observations, niveau initial..." style={{ ...textareaStyle, minHeight: 100 }} />
            </Field>

            {positionnementForm.decision === 'admis_amenagement' && (
              <Field label="Aménagements prévus">
                <textarea value={positionnementForm.amenagements} onChange={e => setPositionnementForm(f => ({ ...f, amenagements: e.target.value }))}
                  placeholder="Décrivez les aménagements prévus..." style={{ ...textareaStyle, minHeight: 72 }} />
              </Field>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowPositionnement(null)} style={{ ...btnPrimary, background: 'transparent', border: `1px solid ${T.border}`, color: T.textSub }}>Annuler</button>
              <button onClick={handlePositionnementSubmit} style={{
                ...btnPrimary,
                background: positionnementForm.decision === 'refuse' ? T.danger : T.green,
                color: 'var(--on-solid)',
              }}>
                {positionnementForm.decision === 'refuse' ? 'Refuser' : 'Valider le positionnement'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit modals */}
      {showForm && (
        <Modal title="Nouvel apprenant" onClose={() => setShowForm(false)} width={700}>
          <ApprenantForm onSave={handleCreate} onClose={() => setShowForm(false)} />
        </Modal>
      )}
      {editing && !selected && (
        <Modal title="Modifier l'apprenant" onClose={() => setEditing(null)} width={700}>
          <ApprenantForm initial={editing} onSave={handleEdit} onClose={() => setEditing(null)} />
        </Modal>
      )}

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// PIPELINE VIEW — Tunnel de vente formation
// ═══════════════════════════════════════════════════════════════
export function GrioPipelineView({ formations }) {
  const STAGES = [
    { key: 'prospect',            label: 'Prospect',            color: 'var(--text-3)',    icon: '○' },
    { key: 'besoin',              label: 'Besoin identifié',    color: 'var(--pillar-prod)', icon: '◐' },
    { key: 'devis_envoye',        label: 'Devis envoyé',        color: 'var(--warning)', icon: '◑' },
    { key: 'convention_signee',   label: 'Convention signée',   color: 'var(--info)', icon: '◉' },
    { key: 'financement_valide',  label: 'Financement validé',  color: 'var(--success)', icon: '●' },
    { key: 'session_planifiee',   label: 'Session planifiée',   color: 'var(--success)', icon: '✦' },
  ];
  const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

  const confirm = useConfirm();
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_name: '', company: '', client_email: '', client_phone: '', formation_id: '', revenue: '', financement: '', notes: '', source: '' });
  const [dragOverStage, setDragOverStage] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/formation-opportunities');
      const data = await res.json();
      setOpps(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await fetch('/api/formation-opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, revenue: parseFloat(form.revenue) || 0 }),
    });
    setForm({ client_name: '', company: '', client_email: '', client_phone: '', formation_id: '', revenue: '', financement: '', notes: '', source: '' });
    setShowForm(false);
    load();
  };

  const handleDrop = async (oppId, newStage) => {
    setOpps(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
    setDragOverStage(null);
    try {
      await fetch(`/api/formation-opportunities/${oppId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch (e) { console.error(e); load(); }
  };

  const handleDelete = async (opp) => {
    if (!(await confirm({ title: `Supprimer l'opportunité "${opp.client_name}" ?`, confirmLabel: 'Supprimer' }))) return;
    await fetch(`/api/formation-opportunities/${opp.id}`, { method: 'DELETE' });
    load();
  };

  const activeOpps = opps.filter(o => o.stage !== 'perdu');
  const byStage = {};
  STAGES.forEach(s => { byStage[s.key] = activeOpps.filter(o => o.stage === s.key); });
  const totalCA = activeOpps.reduce((s, o) => s + (o.revenue || 0), 0);
  const totalOpps = activeOpps.length;

  // Funnel probabilities
  const PROBA = { prospect: 0.1, besoin: 0.25, devis_envoye: 0.5, convention_signee: 0.75, financement_valide: 0.9, session_planifiee: 1.0 };
  const weightedCA = activeOpps.reduce((s, o) => s + (o.revenue || 0) * (PROBA[o.stage] || 0), 0);

  const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>Chargement…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>Pipeline Formation</h2>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Tunnel de vente spécifique Griothèque</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '10px 20px', background: 'var(--pillar-prod)', color: 'var(--on-solid)', border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
        }}>+ Nouvelle opportunité</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 20px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Opportunités</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--pillar-prod)' }}>{totalOpps}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 20px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>CA en jeu</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{totalCA.toLocaleString('fr-FR')}€</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 20px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>CA pondéré</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{Math.round(weightedCA).toLocaleString('fr-FR')}€</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 20px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Perdues</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{opps.filter(o => o.stage === 'perdu').length}</div>
        </div>
      </div>

      {/* Tunnel visuel */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Tunnel de vente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {STAGES.map((s, i) => {
            const count = byStage[s.key].length;
            const ca = byStage[s.key].reduce((sum, o) => sum + (o.revenue || 0), 0);
            const widthPct = 100 - (i * (60 / STAGES.length));
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                <div style={{ width: 120, fontSize: 11, color: T.textMuted, textAlign: 'right', flexShrink: 0 }}>{s.label}</div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{
                    width: `${widthPct}%`, height: 28, background: alpha(s.color, 20),
                    borderRadius: 4, border: `1px solid ${alpha(s.color, 33)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{count}</span>
                    {ca > 0 && <span style={{ fontSize: 11, color: T.textMuted }}>{(ca / 1000).toFixed(1)}k€</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: T.card, border: `1px solid color-mix(in srgb, var(--pillar-prod) 27%, transparent)`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouvelle opportunité</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Nom du contact *</label>
              <input style={inputSt} value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Jean Dupont" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Entreprise</label>
              <input style={inputSt} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Nom entreprise" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Email</label>
              <input style={inputSt} value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="email@exemple.com" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Téléphone</label>
              <input style={inputSt} value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} placeholder="06..." />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Formation liée</label>
              <select style={inputSt} value={form.formation_id} onChange={e => setForm({ ...form, formation_id: e.target.value })}>
                <option value="">— Aucune —</option>
                {formations.map(f => <option key={f.id} value={f.id}>{f.code} — {f.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Montant HT (€)</label>
              <input style={inputSt} type="number" value={form.revenue} onChange={e => setForm({ ...form, revenue: e.target.value })} placeholder="2500" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Financement</label>
              <select style={inputSt} value={form.financement} onChange={e => setForm({ ...form, financement: e.target.value })}>
                <option value="">— Non défini —</option>
                <option value="OPCO">OPCO</option>
                <option value="CPF">CPF</option>
                <option value="Entreprise">Entreprise (direct)</option>
                <option value="Personnel">Personnel</option>
                <option value="Pôle Emploi">Pôle Emploi</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Source</label>
              <input style={inputSt} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Bouche à oreille, site web…" />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' }}>Notes</label>
            <textarea style={{ ...inputSt, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Contexte, besoins spécifiques…" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>Annuler</button>
            <button onClick={handleCreate} disabled={!form.client_name} style={{
              padding: '8px 20px', background: form.client_name ? 'var(--pillar-prod)' : 'var(--surface-3)', border: 'none', borderRadius: 6,
              color: 'var(--on-solid)', fontSize: 12, fontWeight: 700, cursor: form.client_name ? 'pointer' : 'not-allowed', fontFamily: T.font,
            }}>Créer</button>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 'max-content', alignItems: 'flex-start' }}>
          {STAGES.map(col => {
            const colOpps = byStage[col.key];
            const isDragOver = dragOverStage === col.key;
            return (
              <div key={col.key} style={{ width: 220, flexShrink: 0 }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(col.key); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
                onDrop={e => { e.preventDefault(); const oppId = e.dataTransfer.getData('oppId'); if (oppId) handleDrop(oppId, col.key); }}
              >
                {/* Column header */}
                <div style={{
                  background: isDragOver ? alpha(col.color, 9) : T.card,
                  borderTop: `2px solid ${col.color}`,
                  borderLeft: `1px solid ${isDragOver ? alpha(col.color, 40) : alpha(col.color, 20)}`,
                  borderRight: `1px solid ${isDragOver ? alpha(col.color, 40) : alpha(col.color, 20)}`,
                  borderRadius: '10px 10px 0 0', padding: '10px 12px',
                  transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.icon} {col.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, background: alpha(col.color, 13), color: col.color, padding: '1px 6px', borderRadius: 10 }}>{colOpps.length}</span>
                  </div>
                </div>
                {/* Cards */}
                <div style={{
                  background: isDragOver ? alpha(col.color, 3) : T.bg,
                  borderLeft: `1px solid ${alpha(col.color, 13)}`, borderRight: `1px solid ${alpha(col.color, 13)}`,
                  borderBottom: `1px solid ${alpha(col.color, 13)}`, borderRadius: '0 0 10px 10px',
                  padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80,
                  transition: 'background 0.15s',
                }}>
                  {colOpps.map(o => (
                    <div key={o.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('oppId', o.id); e.dataTransfer.effectAllowed = 'move'; }}
                      style={{
                        background: T.card, border: `1px solid ${T.border2 || T.border}`, borderRadius: 8,
                        padding: '10px 12px', cursor: 'grab', transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = alpha(col.color, 40)}
                      onMouseLeave={e => e.currentTarget.style.borderColor = T.border2 || T.border}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{o.client_name}</span>
                        <button onClick={e => { e.stopPropagation(); handleDelete(o); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px 3px', fontSize: 10, color: T.textDim, lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                        >✕</button>
                      </div>
                      {o.company && <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 2 }}>{o.company}</div>}
                      {o.formation_title && <div style={{ fontSize: 10, color: 'var(--pillar-prod)', marginBottom: 2 }}>📚 {o.formation_title}</div>}
                      {o.revenue > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', marginTop: 4 }}>{o.revenue.toLocaleString('fr-FR')}€</div>}
                      {o.financement && <div style={{ fontSize: 9, color: T.textDim, marginTop: 2, background: T.bg, padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>{o.financement}</div>}
                    </div>
                  ))}
                  {colOpps.length === 0 && <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center', padding: '20px 0', fontStyle: 'italic', opacity: 0.5 }}>vide</div>}
                </div>
              </div>
            );
          })}

          {/* Colonne Perdu */}
          {opps.filter(o => o.stage === 'perdu').length > 0 && (
            <div style={{ width: 200, flexShrink: 0 }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage('perdu'); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
              onDrop={e => { e.preventDefault(); const oppId = e.dataTransfer.getData('oppId'); if (oppId) handleDrop(oppId, 'perdu'); }}
            >
              <div style={{ background: T.card, borderTop: '2px solid var(--danger)', borderLeft: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRight: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: '10px 10px 0 0', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>✕ Perdu</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'color-mix(in srgb, var(--danger) 13%, transparent)', color: 'var(--danger)', padding: '1px 6px', borderRadius: 10 }}>{opps.filter(o => o.stage === 'perdu').length}</span>
                </div>
              </div>
              <div style={{ background: T.bg, borderLeft: '1px solid color-mix(in srgb, var(--danger) 13%, transparent)', borderRight: '1px solid color-mix(in srgb, var(--danger) 13%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--danger) 13%, transparent)', borderRadius: '0 0 10px 10px', padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 40 }}>
                {opps.filter(o => o.stage === 'perdu').map(o => (
                  <div key={o.id} style={{ background: T.card, border: `1px solid color-mix(in srgb, var(--danger) 13%, transparent)`, borderRadius: 8, padding: '8px 10px', opacity: 0.6 }}>
                    <div style={{ fontSize: 11, color: T.textMuted, textDecoration: 'line-through' }}>{o.client_name}</div>
                    {o.revenue > 0 && <div style={{ fontSize: 10, color: 'var(--danger)' }}>{o.revenue.toLocaleString('fr-FR')}€</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function GrioOverview({ formations, sessions, clients, onNavigateSession }) {
  // Calculate KPIs
  const totalCAConfirme = sessions.reduce((sum, s) => sum + (s.ca_confirmed || 0), 0);
  const sessionsActives = sessions.filter(s => s.status === 'planned' || s.status === 'ongoing').length;
  const totalApprenants = sessions.reduce((sum, s) => sum + (s.inscriptions_count || 0), 0);
  const formationsActive = formations.filter(f => f.status === 'active').length;

  // Alert: sessions starting this week
  const today = new Date();
  const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = sessions.filter(s => {
    const startDate = new Date(s.start_date + 'T00:00:00');
    return startDate >= today && startDate <= weekLater && s.status === 'planned';
  });

  // Alert: low fill rate (< 50% filled, planned status)
  const sessionsLowFill = sessions.filter(s => 
    s.status === 'planned' && s.max_participants && 
    s.inscriptions_count < (s.max_participants * 0.5)
  );

  // Alert: missing formateur (planned sessions without formateur_name)
  const sessionsMissingFormateur = sessions.filter(s => 
    s.status === 'planned' && (!s.formateur_name || s.formateur_name.trim() === '')
  );

  // Sessions à venir (next 30 days, sorted by date)
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingSessions = sessions
    .filter(s => {
      const startDate = new Date(s.start_date + 'T00:00:00');
      return startDate >= today && startDate <= thirtyDaysLater && 
             (s.status === 'planned' || s.status === 'ongoing');
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Répartition par catégorie (active formations)
  const formationsByCategory = {};
  formations
    .filter(f => f.status === 'active')
    .forEach(f => {
      const cat = f.categorie || 'other';
      formationsByCategory[cat] = (formationsByCategory[cat] || 0) + 1;
    });

  // Indicateurs financiers
  const caConfirme = sessions
    .filter(s => s.ca_confirmed)
    .reduce((sum, s) => sum + s.ca_confirmed, 0);
  const caPotentiel = sessions
    .filter(s => s.status === 'planned' && s.tarif && s.inscriptions_count)
    .reduce((sum, s) => sum + (s.tarif * s.inscriptions_count), 0);
  
  const sessionWithMargin = sessions.filter(s => s.taux_marge && s.taux_marge > 0);
  const avgMargin = sessionWithMargin.length > 0
    ? (sessionWithMargin.reduce((sum, s) => sum + s.taux_marge, 0) / sessionWithMargin.length)
    : 0;

  // Taux de remplissage moyen
  const plannedOngoingSessions = sessions.filter(s => s.status === 'planned' || s.status === 'ongoing');
  const avgFillRate = plannedOngoingSessions.length > 0
    ? plannedOngoingSessions.reduce((sum, s) => {
        if (!s.max_participants || s.max_participants === 0) return sum;
        return sum + (s.inscriptions_count / s.max_participants);
      }, 0) / plannedOngoingSessions.length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Hero KPIs */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: 16
        }}>KPIs</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px'
          }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>CA Confirmé</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)', fontFamily: T.mono }}>
              {(totalCAConfirme / 1000).toFixed(1)}k€
            </div>
          </div>
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px'
          }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Sessions Actives</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--info)', fontFamily: T.mono }}>
              {sessionsActives}
            </div>
          </div>
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px'
          }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Apprenants Inscrits</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--pillar-prod)', fontFamily: T.mono }}>
              {totalApprenants}
            </div>
          </div>
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px'
          }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Formations au Catalogue</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.gold, fontFamily: T.mono }}>
              {formationsActive}
            </div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(sessionsThisWeek.length > 0 || sessionsLowFill.length > 0 || sessionsMissingFormateur.length > 0) && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 16
          }}>Alertes & Actions Urgentes</div>
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12
          }}>
            {sessionsThisWeek.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--gold-deep)' }}>
                ⚠ {sessionsThisWeek.length} session{sessionsThisWeek.length > 1 ? 's' : ''} démarre{sessionsThisWeek.length > 1 ? 'nt' : ''} cette semaine
              </div>
            )}
            {sessionsLowFill.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--warning)' }}>
                📊 {sessionsLowFill.length} session{sessionsLowFill.length > 1 ? 's' : ''} {sessionsLowFill.length > 1 ? 'ont' : 'a'} un taux de remplissage &lt; 50%
              </div>
            )}
            {sessionsMissingFormateur.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>
                👤 {sessionsMissingFormateur.length} session{sessionsMissingFormateur.length > 1 ? 's' : ''} {sessionsMissingFormateur.length > 1 ? 'n\'' : 'n\''} {sessionsMissingFormateur.length > 1 ? 'ont' : 'a'} pas de formateur assigné
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions à venir (30 jours) */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: 16
        }}>Sessions à Venir (30 jours)</div>
        {upcomingSessions.length === 0 ? (
          <div style={{
            background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
            padding: '20px 24px', textAlign: 'center', color: T.textDim
          }}>
            Aucune session prévue dans les 30 prochains jours
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {upcomingSessions.map(session => {
              const fillRate = session.max_participants 
                ? (session.inscriptions_count / session.max_participants) * 100 
                : 0;
              return (
                <div key={session.id} onClick={() => onNavigateSession && onNavigateSession(session.id)} style={{
                  background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
                  padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: T.text }}>
                    {session.client_company ? `${session.client_company} - ` : ''}{session.formation_title || 'Formation'}
                  </div>
                  {(session.code_interne || session.formation_code) && (
                    <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, fontWeight: 700, marginBottom: 6 }}>
                      {session.code_interne || session.formation_code}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>
                    {fmtDateRange(session.start_date, session.end_date)}
                  </div>
                  {session.formateur_name && (
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
                      👤 {session.formateur_name}
                    </div>
                  )}
                  {session.client_company && session.type_session === 'INTRA' && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 8 }}>
                      📍 {session.client_company}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 10 }}>
                    Inscrits: {session.inscriptions_count}/{session.max_participants || '—'}
                  </div>
                  <div style={{ height: 6, background: T.border, borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--info)', width: Math.min(fillRate, 100) + '%',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 9, color: T.textMuted }}>
                      {fillRate.toFixed(0)}% rempli
                    </div>
                    <Badge status={session.status} label={STATUS_LABEL[session.status]} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Répartition par catégorie */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: 16
        }}>Répartition par Catégorie</div>
        <div style={{
          background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12
        }}>
          {Object.entries(formationsByCategory).length === 0 ? (
            <div style={{ color: T.textDim }}>Aucune formation active</div>
          ) : (
            Object.entries(formationsByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => {
                const catObj = FORMATION_CATEGORIES.find(c => c.value === cat);
                const color = CATEGORIE_COLOR[cat] || 'var(--text-3)';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 4 }}>
                        {catObj ? catObj.label : cat}
                      </div>
                      <div style={{
                        height: 6, background: T.border, borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%', background: color,
                          width: (count / Math.max(...Object.values(formationsByCategory))) * 100 + '%'
                        }} />
                      </div>
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: color, minWidth: 40,
                      textAlign: 'right'
                    }}>
                      {count}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Indicateurs financiers */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: 16
        }}>Indicateurs Financiers</div>
        <div style={{
          background: T.card, border: '1px solid ' + T.border, borderRadius: 12,
          padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20
        }}>
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>CA Confirmé</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', fontFamily: T.mono }}>
              {(caConfirme / 1000).toFixed(1)}k€
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
              CA potentiel: {(caPotentiel / 1000).toFixed(1)}k€
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Taux de Marge Moyen</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--info)', fontFamily: T.mono }}>
              {(avgMargin * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
              Sur {sessionWithMargin.length} session{sessionWithMargin.length > 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Taux de Remplissage</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--pillar-prod)', fontFamily: T.mono }}>
              {(avgFillRate * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
              Moyenne active/planifiée
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component: DevisClientBlock (Digiforma-style devis accordion per company) ──
function DevisClientBlock({ company, members, sessionDetail, isInter, colorIdx, colorsAvatar }) {
  const [open, setOpen] = useState(false);
  const [devisList, setDevisList] = useState([]); // track generated devis locally
  const [generating, setGenerating] = useState(false);

  // Generate a devis for this company/apprenant group
  const handleCreateDevis = async () => {
    setGenerating(true);
    try {
      // For INTER: generate devis per apprenant; for INTRA: one global devis
      const firstMember = members[0];
      const apprenantParam = isInter && firstMember ? `&apprenant_id=${firstMember.apprenant_id}` : '';
      const url = `/api/sessions/${sessionDetail.id}/devis?${apprenantParam}`;

      // Open in new tab for download
      window.open(url, '_blank');

      // Track the devis locally
      const now = new Date();
      const devisNum = `${company.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toUpperCase()}-${String(devisList.length + 1).padStart(5, '0')}`;
      setDevisList(prev => [...prev, {
        id: `d_${Date.now()}`,
        number: devisNum,
        date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        generatedAt: now.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        status: 'sent', // default: envoyé
        amount: members.reduce((s, m) => s + (m.price_ht || sessionDetail.tarif || sessionDetail.formation_price_ht || 0), 0),
      }]);
    } catch (e) {
      console.error('Erreur génération devis:', e);
    }
    setGenerating(false);
  };

  const statusMap = {
    draft: { label: 'Brouillon', color: 'var(--text-3)', bg: 'color-mix(in srgb, var(--text-3) 9%, transparent)' },
    sent: { label: 'Envoyé', color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 9%, transparent)' },
    accepted: { label: 'Accepté', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 9%, transparent)' },
    refused: { label: 'Refusé', color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 9%, transparent)' },
  };

  const cycleDevisStatus = (devisId) => {
    const order = ['draft', 'sent', 'accepted', 'refused'];
    setDevisList(prev => prev.map(d => {
      if (d.id !== devisId) return d;
      const idx = order.indexOf(d.status);
      return { ...d, status: order[(idx + 1) % order.length] };
    }));
  };

  const removeDevis = (devisId) => {
    setDevisList(prev => prev.filter(d => d.id !== devisId));
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {/* Accordion header */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--surface-2)', border: `1px solid ${T.border2}`,
          borderRadius: open ? '10px 10px 0 0' : 10, cursor: 'pointer', fontFamily: T.font,
          transition: 'border-radius 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>📁</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Devis et documents du client</span>
          {devisList.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'color-mix(in srgb, var(--success) 13%, transparent)', color: 'var(--success)' }}>
              {devisList.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: 18, color: T.textMuted, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>⌄</span>
      </button>

      {/* Accordion body */}
      {open && (
        <div style={{
          border: `1px solid ${T.border2}`, borderTop: 'none',
          borderRadius: '0 0 10px 10px', padding: '16px 18px', background: T.card,
        }}>
          {/* Devis section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 14, opacity: 0.5 }}>€</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Devis</span>
            </div>

            {/* List of generated devis */}
            {devisList.map(devis => {
              const st = statusMap[devis.status] || statusMap.draft;
              return (
                <div key={devis.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', marginBottom: 8, background: 'var(--surface-2)',
                  border: `1px solid ${T.border2}`, borderRadius: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      Devis n° {devis.number}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>du {devis.date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: T.textMuted }}>
                      Généré le {devis.generatedAt}
                    </span>
                    {/* Download */}
                    <button
                      onClick={() => {
                        const firstMember = members[0];
                        const appParam = isInter && firstMember ? `&apprenant_id=${firstMember.apprenant_id}` : '';
                        window.open(`/api/sessions/${sessionDetail.id}/devis?${appParam}`, '_blank');
                      }}
                      title="Télécharger le devis"
                      style={{
                        width: 30, height: 30, borderRadius: 6, border: `1px solid ${T.border2}`,
                        background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12, color: T.textSub,
                      }}
                    >↓</button>
                    {/* Delete */}
                    <button
                      onClick={() => removeDevis(devis.id)}
                      title="Supprimer"
                      style={{
                        width: 30, height: 30, borderRadius: 6, border: `1px solid color-mix(in srgb, var(--danger) 20%, transparent)`,
                        background: 'color-mix(in srgb, var(--danger) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12, color: 'var(--danger)',
                      }}
                    >✕</button>
                    {/* Status badge (click to cycle) */}
                    <button
                      onClick={() => cycleDevisStatus(devis.id)}
                      title="Cliquer pour changer le statut"
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: st.bg, border: `1px solid ${alpha(st.color, 27)}`, color: st.color,
                        cursor: 'pointer', fontFamily: T.font, whiteSpace: 'nowrap',
                      }}
                    >
                      {devis.status === 'accepted' && '✓ '}{st.label}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={handleCreateDevis}
                disabled={generating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: T.card, border: `1px solid ${T.border2}`, color: T.text,
                  cursor: generating ? 'wait' : 'pointer', fontFamily: T.font,
                }}
              >
                <span style={{ fontSize: 14 }}>+</span> {generating ? 'Génération…' : 'Créer un devis'}
              </button>
            </div>
          </div>

          {/* Autres documents */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 14, opacity: 0.5 }}>📄</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Autres documents</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, fontStyle: 'italic' }}>
              Jamais généré
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                background: T.card, border: `1px solid ${T.border2}`, color: T.textSub,
                cursor: 'pointer', fontFamily: T.font,
              }}>
                Autre document client · Générer le fichier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── View: Paramètres (Company Settings) ───────────────────────────────────
export function ParametresView() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then(data => setSettings(data || {}));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const updated = await res.json();
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Erreur sauvegarde settings:', e);
    }
    setSaving(false);
  };

  if (!settings) return <div style={{ textAlign: 'center', padding: 60, color: T.textMuted }}>Chargement…</div>;

  const Field = ({ label, field, type = 'text', placeholder = '', wide = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        type={type}
        value={settings[field] || ''}
        onChange={e => setSettings(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{
          padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.border2}`,
          background: T.card, fontSize: 13, color: T.text, fontFamily: T.font,
          outline: 'none', width: wide ? '100%' : 'auto',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = T.border2}
      />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paramètres de l'organisme</h2>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            Informations utilisées dans les documents (conventions, attestations, certificats…)
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 28px', borderRadius: 8, border: 'none',
            background: saved ? T.green : 'var(--inverse)', color: saved ? 'var(--on-solid)' : 'var(--inverse-fg)',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            fontFamily: T.font, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </button>
      </div>

      {/* Identité */}
      <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '24px 28px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>◉</span> Identité de l'organisme
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <Field label="Raison sociale" field="company_name" placeholder="LES GRIOTS" />
          <Field label="SIRET" field="siret" placeholder="90262868400018" />
          <Field label="N° Déclaration d'Activité (NDA)" field="nda" placeholder="28760747176" />
          <Field label="Tribunal compétent" field="tribunal_ville" placeholder="Bobigny" />
        </div>
      </div>

      {/* Représentant légal */}
      <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '24px 28px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>◑</span> Représentant légal
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <Field label="Nom complet" field="representant_name" placeholder="COULIBALY Moustapha" />
          <Field label="Fonction" field="representant_title" placeholder="Président" />
        </div>
      </div>

      {/* Coordonnées */}
      <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '24px 28px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>◫</span> Coordonnées
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px 24px' }}>
          <Field label="Adresse" field="address" placeholder="80 avenue du 8 mai 1945" />
          <Field label="Code postal" field="postal_code" placeholder="93100" />
          <Field label="Ville" field="city" placeholder="Montreuil" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginTop: 16 }}>
          <Field label="Email" field="email" type="email" placeholder="contact@lesgriots.com" />
          <Field label="Téléphone" field="phone" placeholder="06 XX XX XX XX" />
        </div>
      </div>

      {/* Informations bancaires (optionnel) */}
      <div style={{ background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '24px 28px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>◈</span> Informations bancaires
          <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 400 }}>(pour les conventions)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <Field label="IBAN" field="iban" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" />
          <Field label="BIC" field="bic" placeholder="XXXXXXXX" />
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.textDim, marginTop: 12, textAlign: 'center' }}>
        Ces informations sont injectées automatiquement dans les conventions, attestations et autres documents générés.
      </div>
    </div>
  );
}

// Branche le toast du kit UI sur le helper `api` (feedback d'erreur global)
export function ApiToastBridge() {
  const { toast } = useToast();
  useEffect(() => {
    apiToast = toast;
    return () => { apiToast = null; };
  }, [toast]);
  return null;
}


/**
 * Charge une fois les quatre jeux de données que se partagent les vues.
 * Les pages de la coquille l'appellent au lieu de refaire le Promise.all.
 */
export function useDonneesFormation() {
  const [donnees, setDonnees] = useState({ formations: [], sessions: [], clients: [], categories: [] });
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    const [f, s, c, cats] = await Promise.all([
      api.get('/api/formations'), api.get('/api/sessions'),
      api.get('/api/clients'), api.get('/api/formation-categories'),
    ]);
    setDonnees({
      formations: Array.isArray(f) ? f : [],
      sessions: Array.isArray(s) ? s : [],
      clients: Array.isArray(c) ? c : [],
      categories: Array.isArray(cats) ? cats : [],
    });
    setChargement(false);
  }, []);

  useEffect(() => { recharger(); }, [recharger]);
  return { ...donnees, chargement, recharger };
}

export default function AncienneApplicationFormations() {
  // Read ?tab= param from URL to allow deep-linking from sidebar
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  })();
  const [view, setView] = useState(initialTab);
  const [formations, setFormations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingSessionId, setPendingSessionId] = useState(null);

  // Navigate to a specific session detail from overview
  const navigateToSession = (sessionId) => {
    setPendingSessionId(sessionId);
    setView('sessions');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [f, s, c, cats] = await Promise.all([
      api.get('/api/formations'), api.get('/api/sessions'),
      api.get('/api/clients'), api.get('/api/formation-categories'),
    ]);
    setFormations(Array.isArray(f) ? f : []);
    setSessions(Array.isArray(s) ? s : []);
    setClients(Array.isArray(c) ? c : []);
    setCategories(Array.isArray(cats) ? cats : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'overview',    label: 'Vue d\'ensemble', icon: '◉' },
    { type: 'divider', label: 'COMMERCIAL' },
    { id: 'pipeline',   label: 'Pipeline',        icon: '⟶' },
    { type: 'divider', label: 'CATALOGUE' },
    { id: 'formations', label: 'Formations',     icon: '▣', count: formations.length },
    { id: 'sessions',   label: 'Sessions',       icon: '◈', count: sessions.length },
    { type: 'divider', label: 'PERSONNES' },
    { id: 'apprenants', label: 'Apprenants',     icon: '◑' },
    { id: 'formateurs', label: 'Intervenants',   icon: '◉' },
    { type: 'divider', label: 'QUALITÉ' },
    { id: 'lieux',      label: 'Lieux',          icon: '◫' },
    { id: 'qualite',    label: 'Qualité',        icon: '◎' },
    { id: 'parametres', label: 'Paramètres',     icon: '⚙' },
  ];

  return (
    <ToastProvider>
    <ConfirmProvider>
    <ApiToastBridge />
    <div className="grio-app" style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font, color: T.text, display: 'flex' }}>
      <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Mobile hamburger */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="grio-sidebar-toggle" style={{
        display: "none", position: "fixed", top: 12, left: 12, zIndex: 200,
        background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 8,
        color: "var(--gold-deep)", padding: "8px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1,
      }}>☰</button>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && <div className="grio-sidebar-backdrop" onClick={() => setSidebarOpen(false)} style={{
        display: "none", position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 99,
      }} />}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          .grio-main > div[style*="padding: 28px 32px"] { padding: 20px 16px !important; }
        }
        @media (max-width: 768px) {
          .grio-sidebar-toggle { display: flex !important; }
          .grio-sidebar-backdrop { display: block !important; }
          .grio-sidebar { position: fixed !important; z-index: 100 !important; transform: translateX(${sidebarOpen ? '0' : '-100%'}) !important; transition: transform 0.25s ease !important; }
          .grio-main { margin-left: 0 !important; }
          .grio-main > div { padding: 14px 12px !important; }
          .grio-app div[style*="grid-template-columns: 1fr 1fr 1fr"],
          .grio-app div[style*="gridTemplateColumns: \\"1fr 1fr 1fr\\""],
          .grio-app div[style*="grid-template-columns: 1fr 1fr"],
          .grio-app div[style*="gridTemplateColumns: \\"1fr 1fr\\""] {
            grid-template-columns: 1fr !important;
          }
          .grio-app table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .grio-app div[style*="maxWidth: 580"], .grio-app div[style*="max-width: 580"] { max-width: 95vw !important; width: 95vw !important; }
        }
      `}} />

      {/* SIDEBAR */}
      <aside className="grio-sidebar" style={{
        '--surface': '#0D0D0C',
        '--surface-2': '#171613',
        '--surface-3': '#24221E',
        '--border': 'rgba(246,245,243,0.10)',
        '--border-2': 'rgba(246,245,243,0.20)',
        '--hover': 'rgba(246,245,243,0.06)',
        '--text': '#F6F5F3',
        '--text-2': '#D4D0C8',
        '--text-3': '#918C82',
        '--gold-deep': '#FFCC00',
        width: 220, minWidth: 220, height: '100vh', background: '#0D0D0C',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, overflow: 'hidden', flexShrink: 0,
      }}>
      {/* Logo + Branding */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <a href="/apercu" style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}>
            <img src="/branding/griotheque-wordmark-paper.svg" alt="LA GRIOTHÈQUE" style={{ width: '100%', maxWidth: 174, height: 'auto', display: 'block' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.20em', textTransform: 'uppercase' }}>OS · Organisme de formation</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text)', background: 'color-mix(in srgb, var(--text) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 20%, transparent)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Qualiopi</span>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          {navItems.map((item, i) => {
            if (item.type === 'divider') {
              return <div key={i} style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.1em',
                padding: '14px 10px 5px', userSelect: 'none',
              }}>{item.label}</div>;
            }
            const isActive = view === item.id;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: T.font,
                background: isActive ? 'color-mix(in srgb, var(--gold-deep) 8%, transparent)' : 'transparent',
                color: isActive ? 'var(--gold-deep)' : 'var(--text-3)', fontSize: 13, fontWeight: isActive ? 600 : 500,
                transition: 'background 0.15s, color 0.15s', textAlign: 'left', width: '100%',
                borderLeft: isActive ? '2px solid var(--gold-deep)' : '2px solid transparent',
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-2)'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}}
              >
                <span style={{ fontSize: 12, opacity: 0.8, width: 18, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
                {item.count !== undefined && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: isActive ? 'color-mix(in srgb, var(--gold-deep) 13%, transparent)' : 'var(--surface-3)', color: isActive ? 'var(--gold-deep)' : 'var(--text-3)' }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Back to OS link at bottom */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <a href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            borderRadius: 6, color: 'var(--text-3)', textDecoration: 'none', fontSize: 12,
            transition: 'color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold-deep)'; e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}>
            <span>←</span> Retour à l'OS
          </a>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="grio-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
      {/* Content */}
      <div className="grio-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: T.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Chargement…</div>
          </div>
        ) : (
          <>
            {view === 'pipeline'   && <GrioPipelineView formations={formations} />}
            {view === 'overview'   && <GrioOverview formations={formations} sessions={sessions} clients={clients} onNavigateSession={navigateToSession} />}
            {view === 'formations' && <FormationsView formations={formations} sessions={sessions} categories={categories} onRefresh={loadData} />}
            {view === 'sessions'   && <SessionsView sessions={sessions} formations={formations} clients={clients} onRefresh={loadData} initialSessionId={pendingSessionId} onSessionOpened={() => setPendingSessionId(null)} />}
            {view === 'apprenants' && <ApprenantsView />}
            {view === 'formateurs' && <FormateursView />}
            {view === 'lieux'      && <LieuxFormationView />}
            {view === 'qualite'    && <QualiteView formations={formations} sessions={sessions} />}
            {view === 'parametres' && <ParametresView />}
          </>
        )}
      </div>
      </div>{/* end grio-main */}
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}

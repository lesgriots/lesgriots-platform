'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const VIEWS = {
  programmes: { label: 'Programmes', title: 'Bibliothèque de programmes', help: 'Créez, structurez et réutilisez vos programmes de formation.' },
  blocs: { label: 'Blocs pédagogiques', title: 'Blocs pédagogiques', help: 'Des briques réutilisables pour composer vos programmes sans dupliquer leur contenu.' },
  evaluations: { label: 'Évaluations', title: "Bibliothèque d’évaluations", help: 'Vos modèles sont prêts à être associés aux programmes et aux sessions.' },
  'programmes-archives': { label: 'Programmes archivés', title: 'Programmes archivés', help: 'Les programmes retirés du catalogue restent consultables ici.' },
  'blocs-archives': { label: 'Blocs pédagogiques archivés', title: 'Blocs pédagogiques archivés', help: 'Les blocs archivés ne sont plus proposés dans les nouveaux programmes.' },
};

const button = { border: 0, borderRadius: 8, padding: '10px 13px', fontWeight: 700, cursor: 'pointer', fontSize: 13 };
const primary = { ...button, background: 'var(--gold)', color: '#171613' };
const quiet = { ...button, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' };

function safeArray(value) { try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return []; } }

export default function LibraryWorkspace() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('vue');
  const [view, setView] = useState(VIEWS[requestedView] ? requestedView : 'programmes');
  const [formations, setFormations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', type: 'positionnement' });
  const [notice, setNotice] = useState('');

  const reload = async () => {
    const [f, b, ba, t, c] = await Promise.all([
      fetch('/api/formations').then(r => r.json()),
      fetch('/api/pedagogical-blocks').then(r => r.json()),
      fetch('/api/pedagogical-blocks?archived=1').then(r => r.json()),
      fetch('/api/evaluation-templates').then(r => r.json()),
      // La complétude est calculée à part : elle relit les onze mentions
      // obligatoires programme par programme, ce que la liste ne fait pas.
      fetch('/api/formations/completude?archives=1').then(r => r.json()).catch(() => null),
    ]);
    const completude = new Map((c?.programmes || []).map(l => [String(l.id), l]));
    setFormations(Array.isArray(f) ? f.map(x => ({ ...x, completude: completude.get(String(x.id)) || null })) : []);
    setBlocks([...(Array.isArray(b) ? b : []), ...(Array.isArray(ba) ? ba : [])]);
    setTemplates(Array.isArray(t) ? t : []);
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (VIEWS[requestedView]) setView(requestedView); }, [requestedView]);

  const label = VIEWS[view];
  const normalized = query.trim().toLocaleLowerCase('fr');
  const activeFormations = useMemo(() => formations.filter(f => (view === 'programmes-archives' ? f.status === 'archived' : f.status !== 'archived') && `${f.title} ${f.code} ${f.categorie || ''}`.toLocaleLowerCase('fr').includes(normalized)), [formations, view, normalized]);
  // Le bilan d'ensemble : combien de programmes sont réellement publiables.
  const bilan = useMemo(() => {
    const notes = activeFormations.map(f => f.completude).filter(Boolean);
    if (!notes.length) return null;
    return {
      total: notes.length,
      publiables: notes.filter(n => n.publiable).length,
      moyenne: Math.round(notes.reduce((t, n) => t + n.pourcentage, 0) / notes.length),
    };
  }, [activeFormations]);
  const visibleBlocks = useMemo(() => blocks.filter(b => (view === 'blocs-archives' ? b.archived : !b.archived) && `${b.title} ${b.category || ''}`.toLocaleLowerCase('fr').includes(normalized)), [blocks, view, normalized]);

  async function create() {
    const endpoint = view === 'blocs' ? '/api/pedagogical-blocks' : view === 'evaluations' ? '/api/evaluation-templates' : '/api/formations';
    const payload = view === 'blocs'
      ? { title: draft.title, category: draft.description }
      : view === 'evaluations'
        ? { title: draft.title, description: draft.description, type: draft.type }
        : { title: draft.title, description: draft.description };
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || 'Impossible de créer cet élément.'); return; }
    setDraft({ title: '', description: '', type: 'positionnement' }); setCreating(false); setNotice('Création enregistrée.'); await reload();
  }
  async function archive(kind, id, archived) {
    const endpoint = kind === 'formation' ? `/api/formations/${id}` : kind === 'block' ? `/api/pedagogical-blocks/${id}` : `/api/evaluation-templates/${id}`;
    const response = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kind === 'formation' ? { status: archived ? 'archived' : 'active' } : { archived }) });
    const data = await response.json();
    setNotice(response.ok ? (archived ? 'Élément archivé.' : 'Élément restauré.') : (data.error || 'Action impossible.'));
    if (response.ok) reload();
  }

  return <div style={{ maxWidth: 1420, margin: '0 auto', padding: '28px 28px 56px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
      <div><p style={{ margin: '0 0 6px', color: 'var(--gold)', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Catalogue · Bibliothèque</p><h1 style={{ margin: 0, fontSize: 30 }}>{label.title}</h1><p style={{ margin: '8px 0 0', color: 'var(--text-2)' }}>{label.help}</p></div>
      {['programmes', 'blocs', 'evaluations'].includes(view) && <button style={primary} onClick={() => { setCreating(true); setNotice(''); }}>+ Créer {view === 'programmes' ? 'un programme' : view === 'blocs' ? 'un bloc' : 'un modèle'}</button>}
    </div>
    {['programmes', 'blocs'].includes(view) && <nav aria-label="Contenu de la bibliothèque" style={{ ...card, display: 'flex', marginBottom: 18 }}>
      {[['programmes', 'Programmes'], ['blocs', 'Blocs pédagogiques']].map(([key, item]) => <button key={key} onClick={() => { setView(key); setCreating(false); setQuery(''); }} style={{ ...button, borderRadius: 0, flex: 1, background: view === key ? 'var(--gold-soft)' : 'transparent', color: view === key ? 'var(--gold)' : 'var(--text-2)', borderBottom: view === key ? '3px solid var(--gold)' : '3px solid transparent' }}>{item}</button>)}
    </nav>}
    {notice && <p role="status" style={{ margin: '0 0 14px', padding: '11px 13px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 13 }}>{notice}</p>}
    {creating && <div style={{ ...card, padding: 18, marginBottom: 18, display: 'grid', gap: 12 }}>
      <strong>Nouvel élément de bibliothèque</strong>
      <input autoFocus placeholder={view === 'evaluations' ? 'Nom du modèle' : 'Titre'} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inputStyle} />
      {view === 'evaluations' && <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} style={inputStyle}><option value="positionnement">Préformation</option><option value="chaud">Évaluation à chaud</option><option value="froid">Évaluation à froid</option><option value="manager">Questionnaire manager</option><option value="formateur">Questionnaire intervenant</option><option value="financeur">Questionnaire financeur</option></select>}
      <input placeholder={view === 'blocs' ? 'Catégorie (facultatif)' : 'Description (facultatif)'} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}><button style={primary} onClick={create}>Enregistrer</button><button style={quiet} onClick={() => setCreating(false)}>Annuler</button></div>
    </div>}
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher" style={{ ...inputStyle, maxWidth: 360 }} />
        <button style={quiet} onClick={() => setQuery('')}>Effacer tout</button>
      </div>
      {view.startsWith('programmes') && bilan && <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-3)' }}>
        Onze mentions sont obligatoires sur un programme de formation.{' '}
        <strong style={{ color: bilan.publiables === bilan.total ? 'var(--actif)' : 'var(--text-2)', fontWeight: 700 }}>
          {bilan.publiables} sur {bilan.total}
        </strong>{' '}
        {bilan.publiables > 1 ? 'sont complets' : 'est complet'}, moyenne {bilan.moyenne} %.
      </p>}
      {view.startsWith('programmes') ? <Programs rows={activeFormations} archived={view === 'programmes-archives'} onArchive={archive} /> : view.startsWith('blocs') ? <Blocks rows={visibleBlocks} archived={view === 'blocs-archives'} onArchive={archive} /> : <Templates rows={templates.filter(t => `${t.title} ${t.description}`.toLocaleLowerCase('fr').includes(normalized))} onArchive={archive} />}
    </div>
  </div>;
}

function Programs({ rows, archived, onArchive }) { return <>{rows.length ? <div>{rows.map(f => <div key={f.id} style={rowStyle}><div style={{ minWidth: 0 }}><Link href={`/catalogue/${f.id}`} style={{ color: 'var(--text)', fontWeight: 750, textDecoration: 'none' }}>{f.title}</Link><div style={metaStyle}>{f.code} · {f.sessions_count || 0} session{Number(f.sessions_count) !== 1 ? 's' : ''} · {f.total_inscriptions || 0} apprenant{Number(f.total_inscriptions) !== 1 ? 's' : ''}</div></div><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Jauge pourcentage={f.completude?.pourcentage} manques={f.completude?.manques} /><Link href={`/catalogue/${f.id}`} style={{ ...quiet, textDecoration: 'none', padding: '8px 10px' }}>Ouvrir</Link><button style={{ ...quiet, padding: '8px 10px' }} onClick={() => onArchive('formation', f.id, !archived)}>{archived ? 'Restaurer' : 'Archiver'}</button></div></div>)}</div> : <Empty text={archived ? 'Aucun programme archivé.' : 'Aucun programme pour le moment. Créez votre premier programme.'} />}</> }
function Blocks({ rows, archived, onArchive }) { return <>{rows.length ? rows.map(b => <div key={b.id} style={rowStyle}><div><strong>{b.title}</strong><div style={metaStyle}>{b.category || 'Sans catégorie'} · utilisé dans {b.formations_count || 0} programme{Number(b.formations_count) !== 1 ? 's' : ''}</div></div><button style={{ ...quiet, padding: '8px 10px' }} onClick={() => onArchive('block', b.id, !archived)}>{archived ? 'Restaurer' : 'Archiver'}</button></div>) : <Empty text={archived ? 'Aucun bloc pédagogique archivé.' : 'Aucun bloc pédagogique. Créez une brique réutilisable.'} />}</> }
function Templates({ rows, onArchive }) { return <>{rows.map(t => <details key={t.id} style={{ borderTop: '1px solid var(--border)', padding: '15px 3px' }} open><summary style={{ cursor: 'pointer', fontWeight: 750 }}>{t.title}{t.automatic ? <span style={{ marginLeft: 9, color: 'var(--gold)', fontSize: 12 }}>Envoi automatique</span> : null}</summary><p style={{ color: 'var(--text-2)', margin: '12px 0' }}>{t.description || 'Aucune description.'}</p><button style={{ ...quiet, padding: '7px 10px' }} onClick={() => onArchive('template', t.id, true)}>Archiver ce modèle</button></details>)}</> }
function Empty({ text }) { return <div style={{ padding: '36px 12px', color: 'var(--text-2)', textAlign: 'center' }}>{text}</div>; }

const inputStyle = { width: '100%', minHeight: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' };
/**
 * Jauge — à combien de pour cent un programme est prêt à être publié.
 *
 * Onze mentions sont attendues : objectifs, public, prérequis, durée,
 * contenu, évaluation, méthodes, moyens, accessibilité, délais d'accès,
 * tarif. La jauge ne juge pas la qualité du texte, elle dit s'il existe.
 *
 * Vert quand tout y est, or sinon : l'or signale ce qui demande une
 * décision, et un programme incomplet en demande une.
 */
function Jauge({ pourcentage, manques = [] }) {
  if (pourcentage === undefined || pourcentage === null) return null;
  const complet = pourcentage === 100;
  const titre = complet
    ? 'Programme complet, publiable en l’état.'
    : `${manques.length} mention(s) à compléter : ${manques.map((m) => m.libelle).join(', ')}.`;

  return (
    <span
      title={titre}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
    >
      <span style={{
        width: 64, height: 5, borderRadius: 999, overflow: 'hidden',
        background: 'var(--surface-3)', display: 'block',
      }}
      >
        <span style={{
          display: 'block', height: '100%', width: `${pourcentage}%`,
          background: complet ? 'var(--actif)' : 'var(--gold)',
          transition: 'width 240ms var(--ease-out)',
        }}
        />
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
        color: complet ? 'var(--actif)' : 'var(--text-3)', minWidth: 34, textAlign: 'right',
      }}
      >
        {pourcentage} %
      </span>
    </span>
  );
}

const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '15px 4px', borderTop: '1px solid var(--border)' };
const metaStyle = { color: 'var(--text-3)', fontSize: 12, marginTop: 5 };

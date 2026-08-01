'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import EditeurQuestionnaires from './EditeurQuestionnaires';
import EditeurFormulaireInscription from './EditeurFormulaireInscription';
import MentionsObligatoires from './MentionsObligatoires';
import { BandeauEncre, BarreOnglets, SousOnglets, Icone } from '@/components/da/BandeauDa';

/* Les trois espaces du programme, aux couleurs d'étape du dossier de
   passation. La maquette en montre quatre, dont « Accueil » : cet espace
   n'existe pas ici, et en fabriquer un vide pour respecter un dessin
   serait ajouter un onglet qui ne mène nulle part. */
const ESPACES = [
  { cle: 'content',   label: 'Contenu',   base: '#6B4FD8', clair: '#8368EE', icone: 'livre' },
  { cle: 'quality',   label: 'Qualité',   base: '#1E8449', clair: '#2B9E5B', icone: 'etoile' },
  { cle: 'diffusion', label: 'Diffusion', base: '#E0A400', clair: '#FFC22E', texte: '#171407', icone: 'oeil' },
];

const inputStyle = { width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '10px 11px', boxSizing: 'border-box', font: 'inherit' };
const panel = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
const primary = { border: 0, borderRadius: 8, padding: '10px 13px', background: 'var(--gold)', color: '#171613', fontWeight: 750, cursor: 'pointer' };
const quiet = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 650, cursor: 'pointer' };
const typeLabels = { positionnement: 'Évaluation préformation pour les apprenants', chaud: 'Évaluation à chaud pour les apprenants', froid: 'Évaluation à froid pour les apprenants', manager: 'Questionnaire pour les managers', formateur: 'Questionnaire pour les intervenants', financeur: 'Questionnaire pour les financeurs et commanditaires' };
function parse(value) { try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return []; } }

export default function ProgramWorkspace({ formationId }) {
  const [formation, setFormation] = useState(null), [templates, setTemplates] = useState([]), [blocks, setBlocks] = useState([]), [allBlocks, setAllBlocks] = useState([]), [resources, setResources] = useState([]);
  const [controle, setControle] = useState(null);
  const [section, setSection] = useState('detail'), [area, setArea] = useState('content'), [editing, setEditing] = useState(false), [notice, setNotice] = useState(''), [resourceDraft, setResourceDraft] = useState({ title: '', url: '' });
  const load = async () => {
    const [f, t, b, a, r] = await Promise.all([
      fetch(`/api/formations/${formationId}`).then(x => x.json()), fetch('/api/evaluation-templates').then(x => x.json()), fetch(`/api/formations/${formationId}/blocks`).then(x => x.json()), fetch('/api/pedagogical-blocks').then(x => x.json()), fetch(`/api/formations/${formationId}/resources`).then(x => x.json()),
    ]);
    // Le contrôle des onze mentions obligatoires, à côté de la fiche : il ne
    // juge pas la qualité du texte, il dit ce qui n'existe pas encore.
    fetch(`/api/formations/${formationId}/programme?controle=1`)
      .then(x => x.json()).then(x => setControle(x?.manques ? x : null)).catch(() => setControle(null));
    setFormation(f?.id ? f : null); setTemplates(Array.isArray(t) ? t : []); setBlocks(Array.isArray(b) ? b : []); setAllBlocks(Array.isArray(a) ? a : []); setResources(Array.isArray(r) ? r : []);
  };
  useEffect(() => { load(); }, [formationId]);
  // Le rattachement vit dans `evaluations_associees`. `evaluation_methods`
  // reste le texte des modalités, imprimé sur le programme : on n'y touche pas.
  const selectedTypes = useMemo(() => new Set(parse(formation?.evaluations_associees)), [formation]);
  if (!formation) return <div style={{ padding: 32, color: 'var(--text-2)' }}>Chargement du programme…</div>;
  async function save(fields) { const r = await fetch(`/api/formations/${formationId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) }); const data = await r.json(); setNotice(r.ok ? 'Programme enregistré.' : (data.error || 'Enregistrement impossible.')); if (r.ok) { setFormation({ ...formation, ...data }); setEditing(false); } }
  async function toggleEvaluation(type) { const next = new Set(selectedTypes); next.has(type) ? next.delete(type) : next.add(type); await save({ evaluations_associees: JSON.stringify([...next]) }); }
  async function addResource(scope) { if (!resourceDraft.title.trim()) return; const r = await fetch(`/api/formations/${formationId}/resources`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...resourceDraft, scope }) }); const data = await r.json(); if (r.ok) { setResources([data, ...resources]); setResourceDraft({ title: '', url: '' }); } else setNotice(data.error || 'Document impossible à ajouter.'); }
  async function attachBlock(blockId) { await fetch(`/api/formations/${formationId}/blocks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block_id: blockId }) }); load(); }
  async function detachBlock(blockId) { await fetch(`/api/formations/${formationId}/blocks?block_id=${blockId}`, { method: 'DELETE' }); load(); }
  const navigation = {
    content: [['detail', 'Détail du programme'], ['mentions', 'Mentions obligatoires']],
    quality: [['quality', 'Synthèse'], ['evaluations', 'Évaluations']],
    diffusion: [['inscription', 'Formulaire d’inscription'], ['learner', 'Ressources apprenant'], ['internal', 'Documents internes']],
  };
  function chooseArea(nextArea) { setArea(nextArea); setSection(navigation[nextArea][0][0]); }
  return <div style={{ maxWidth: 1420, margin: '0 auto', padding: '28px 28px 56px' }}>
    <Link href="/catalogue" style={{ color: 'var(--gold-text)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <Icone nom="retour" taille={15} /> Bibliothèque
    </Link>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
      <BandeauEncre
        surTitre="Bibliothèque · programme d’origine"
        titre={formation.title}
        phrase="Le contenu de référence : les sessions en héritent à leur création, les modifications ultérieures ne redescendent pas."
        chiffres={[
          { label: 'Sessions', valeur: String(formation.sessions?.length || 0), couleur: 'var(--gold)' },
          { label: 'Durée', valeur: `${formation.duration_hours || 0} h` },
          { label: 'Mentions', valeur: controle ? `${controle.remplies ?? 0} / ${controle.total || 11}` : '—',
            couleur: controle && controle.manques?.length ? 'var(--warning-clair)' : 'var(--on-ink)' },
        ]}
      />

      {/* La rangée d'actions, sous le bandeau : elle agit sur le programme,
          elle n'est pas une information sur lui. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {formation.code || 'sans code'}
        </span>
        <a href={`/api/formations/${formationId}/programme${controle && !controle.complet ? '?force=1' : ''}`}
          target="_blank" rel="noreferrer"
          style={{ ...(controle?.complet ? primary : quiet), textDecoration: 'none', display: 'inline-block', marginLeft: 'auto' }}>
          {controle?.complet ? 'Télécharger le programme' : 'Document de travail'}
        </a>
        <button style={quiet} onClick={() => save({ status: formation.status === 'archived' ? 'active' : 'archived' })}>
          {formation.status === 'archived' ? 'Restaurer' : 'Archiver'}
        </button>
      </div>
    </div>
    <Controle controle={controle} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0 18px' }}>
      <BarreOnglets
        onglets={ESPACES.map((e) => ({
          ...e,
          detail: e.cle === 'content' ? `${blocks.length} bloc(s)`
            : e.cle === 'quality' ? `${parse(formation.evaluations_associees).length} évaluation(s)`
            : `${resources.length} document(s)`,
        }))}
        actif={area}
        onChoisir={chooseArea}
      />
      <SousOnglets
        sous={navigation[area]}
        actif={section}
        onChoisir={setSection}
        couleur={ESPACES.find((e) => e.cle === area)?.base}
      />
    </div>
    {notice && <p role="status" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, color: 'var(--text-2)' }}>{notice}</p>}
    {section === 'detail' && <Detail formation={formation} editing={editing} setEditing={setEditing} save={save} blocks={blocks} allBlocks={allBlocks} attach={attachBlock} detach={detachBlock} />}
    {section === 'mentions' && <MentionsObligatoires formationId={formationId} formation={formation} onEnregistre={() => load()} />}
    {section === 'inscription' && <EditeurFormulaireInscription formationId={formationId} />}
    {section === 'learner' && <Resources scope="learner" resources={resources} draft={resourceDraft} setDraft={setResourceDraft} add={addResource} />}
    {section === 'internal' && <Resources scope="internal" resources={resources} draft={resourceDraft} setDraft={setResourceDraft} add={addResource} />}
    {section === 'quality' && <Quality formation={formation} />}
    {section === 'evaluations' && <div style={{ display: 'grid', gap: 22 }}>
      <EditeurQuestionnaires formationId={formationId} />
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Questionnaires servis par ce programme</h3>
          <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.55, maxWidth: 660 }}>
            Ce que l’apprenant se verra proposer dans son espace. Ne rien cocher revient à tout servir : c’est le comportement actuel de tes programmes.
            Les questionnaires destinés à d’autres publics ne sont pas encore adressables, faute d’un lien pour les leur envoyer.
          </p>
        </div>
        {templates.map(t => {
          const servable = ['positionnement', 'chaud', 'froid'].includes(t.type);
          return (
            <label key={t.id} style={{
              ...panel, display: 'flex', gap: 12, alignItems: 'start',
              cursor: servable ? 'pointer' : 'not-allowed', opacity: servable ? 1 : .55,
            }}>
              <input type="checkbox" disabled={!servable} checked={servable && selectedTypes.has(t.type)}
                onChange={() => servable && toggleEvaluation(t.type)} style={{ marginTop: 4 }} />
              <span>
                <strong>{t.title}</strong>
                {!servable && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '2px 7px' }}>autre public</span>}
                <span style={{ display: 'block', marginTop: 5, color: 'var(--text-2)', fontSize: 13 }}>{t.description}</span>
                {!servable && <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)', fontSize: 12 }}>
                  Ce questionnaire ne s’adresse pas à l’apprenant : il faudra un lien propre à son destinataire avant de pouvoir l’envoyer.
                </span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>}
    {section === 'diffusion' && <div style={panel}><h2 style={{ marginTop: 0 }}>Diffusion du programme</h2><p style={{ color: 'var(--text-2)' }}>Ce programme est {formation.status === 'archived' ? 'archivé' : 'actif'} dans la bibliothèque. Les ressources apprenant associées seront reprises dans les sessions créées depuis ce programme.</p><p style={{ color: 'var(--text-2)', fontSize: 13 }}>La publication sur un catalogue en ligne reste volontairement séparée de cette bibliothèque interne.</p></div>}
  </div>;
}

/**
 * Ce qui manque à un programme avant d'être publiable.
 *
 * On ne montre pas un pourcentage seul : un chiffre sans la liste oblige à
 * chercher. Chaque manque porte l'endroit exact où aller le remplir.
 */
function Controle({ controle }) {
  if (!controle || !Array.isArray(controle.manques)) return null;
  const total = controle.total || 11;
  const remplies = controle.remplies ?? (total - controle.manques.length);
  const pct = controle.pourcentage ?? Math.round((remplies / total) * 100);
  const complet = controle.manques.length === 0;
  return (
    <div style={{ ...panel, padding: '14px 18px', marginTop: 16, borderColor: complet ? 'var(--actif)' : 'var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 96, height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)', display: 'block', flexShrink: 0 }}>
          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: complet ? 'var(--actif)' : 'var(--gold)', transition: 'width 240ms var(--ease-out)' }} />
        </span>
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: complet ? 'var(--actif)' : 'var(--text)' }}>{pct} %</strong>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          {complet
            ? 'Les onze mentions obligatoires sont renseignées. Le programme est publiable.'
            : `${remplies} mentions sur ${total}. Il en manque ${controle.manques.length} avant publication.`}
        </span>
      </div>
      {!complet && <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 }}>
        {controle.manques.map((m, i) => <li key={i}><strong style={{ color: 'var(--text)' }}>{m.libelle}</strong> · <span style={{ color: 'var(--text-3)' }}>{m.ou_remplir}</span></li>)}
      </ul>}
    </div>
  );
}

function Detail({ formation, editing, setEditing, save, blocks, allBlocks, attach, detach }) { const [draft, setDraft] = useState({ title: formation.title, description: formation.description || '', objectives: parse(formation.objectives).join('\n'), prerequisites: formation.prerequisites || '' }); useEffect(() => setDraft({ title: formation.title, description: formation.description || '', objectives: parse(formation.objectives).join('\n'), prerequisites: formation.prerequisites || '' }), [formation]); const attached = new Set(blocks.map(b => b.id)); return <div style={{ display: 'grid', gap: 16 }}><div style={panel}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ marginTop: 0 }}>Détail du programme</h2><p style={{ color: 'var(--text-2)', marginTop: -6 }}>Le contenu source, réutilisable dans chaque session.</p></div><button style={quiet} onClick={() => editing ? save({ title: draft.title, description: draft.description, objectives: draft.objectives.split('\n').map(x => x.trim()).filter(Boolean), prerequisites: draft.prerequisites }) : setEditing(true)}>{editing ? 'Enregistrer' : 'Modifier le contenu'}</button></div>{editing ? <div style={{ display: 'grid', gap: 11 }}><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={inputStyle} /><textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} style={{ ...inputStyle, minHeight: 120 }} placeholder="Description" /><textarea value={draft.objectives} onChange={e => setDraft({ ...draft, objectives: e.target.value })} style={{ ...inputStyle, minHeight: 110 }} placeholder="Un objectif par ligne" /><textarea value={draft.prerequisites} onChange={e => setDraft({ ...draft, prerequisites: e.target.value })} style={{ ...inputStyle, minHeight: 70 }} placeholder="Prérequis" /></div> : <><p style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{formation.description || 'Ajoutez une description à ce programme.'}</p><h3>Objectifs pédagogiques</h3>{parse(formation.objectives).length ? <ul>{parse(formation.objectives).map((x, i) => <li key={i}>{x}</li>)}</ul> : <p style={{ color: 'var(--text-3)' }}>Aucun objectif renseigné.</p>}<h3>Prérequis</h3><p style={{ color: 'var(--text-2)' }}>{formation.prerequisites || 'Aucun prérequis renseigné.'}</p></>}</div><div style={panel}><h2 style={{ marginTop: 0 }}>Blocs pédagogiques associés</h2>{blocks.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}><span><strong>{b.title}</strong><small style={{ display: 'block', color: 'var(--text-3)' }}>{b.category || 'Sans catégorie'}</small></span><button style={quiet} onClick={() => detach(b.id)}>Retirer</button></div>)}<select defaultValue="" onChange={e => { if (e.target.value) { attach(e.target.value); e.target.value = ''; } }} style={{ ...inputStyle, marginTop: 12 }}><option value="">Associer un bloc de la bibliothèque…</option>{allBlocks.filter(b => !attached.has(b.id)).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select></div></div> }
function Resources({ scope, resources, draft, setDraft, add }) { const visible = resources.filter(r => r.scope === scope); return <div style={panel}><h2 style={{ marginTop: 0 }}>{scope === 'learner' ? 'Documents Espace Apprenant associés' : 'Documents privés associés'}</h2><p style={{ color: 'var(--text-2)' }}>{scope === 'learner' ? 'Ces documents seront disponibles pour les apprenants dans les sessions.' : 'Ces ressources restent internes à l’équipe pédagogique.'}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0' }}><input placeholder="Nom du document" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, flex: '1 1 240px' }} /><input placeholder="Lien facultatif" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} style={{ ...inputStyle, flex: '1 1 240px' }} /><button style={primary} onClick={() => add(scope)}>Ajouter</button></div>{visible.length ? visible.map(r => <div key={r.id} style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}><strong>{r.title}</strong>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ display: 'block', color: 'var(--gold)', fontSize: 13, marginTop: 4 }}>Ouvrir le lien</a> : null}</div>) : <p style={{ color: 'var(--text-3)', padding: '16px 0' }}>Aucun document associé.</p>}</div> }
function Quality({ formation }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}><div style={panel}><p style={{ color: 'var(--text-3)', marginTop: 0 }}>SESSIONS UTILISANT CE PROGRAMME</p><strong style={{ fontSize: 36, color: 'var(--gold)' }}>{formation.sessions?.length || 0}</strong></div><div style={panel}><p style={{ color: 'var(--text-3)', marginTop: 0 }}>MODÈLES D’ÉVALUATION ASSOCIÉS</p><strong style={{ fontSize: 36, color: 'var(--gold)' }}>{parse(formation.evaluations_associees).length}</strong></div><div style={panel}><p style={{ color: 'var(--text-3)', marginTop: 0 }}>SYNTHÈSE QUALITÉ</p><p style={{ color: 'var(--text-2)' }}>Les résultats réels apparaîtront ici dès que les sessions associent des évaluations et reçoivent des réponses.</p></div></div> }

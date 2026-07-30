'use client';

/**
 * Agenda de formation — calendrier opérationnel.
 *
 * La page reprend le contenu métier attendu d'un agenda d'OF : création
 * depuis la fiche complète, filtres de sessions, trois lectures temporelles et détail sans
 * quitter le calendrier. Elle utilise volontairement les tokens visuels de
 * La Griothèque, plutôt que la direction artistique de l'outil de référence.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { sessionHref } from '@/lib/navigation';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const STATUTS = { planned: 'Planifiée', ongoing: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
const MODALITES = { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Hybride' };

const iso = (value) => value.toISOString().slice(0, 10);
const dateFr = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const token = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-3)' };

const button = {
  minHeight: 34, padding: '6px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)',
  background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
};

export default function AgendaPage() {
  const [sessions, setSessions] = useState(null);
  const [curseur, setCurseur] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [vue, setVue] = useState('calendar');
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('all');
  const [type, setType] = useState('all');
  const [modalite, setModalite] = useState('all');
  const [lieu, setLieu] = useState('all');
  const [selection, setSelection] = useState(null);

  const charger = () => Promise.all([
    fetch('/api/sessions').then((r) => r.ok ? r.json() : []).catch(() => []),
    fetch('/api/formations').then((r) => r.ok ? r.json() : []).catch(() => []),
  ]).then(([liste, programmes]) => {
    const titres = Object.fromEntries((Array.isArray(programmes) ? programmes : []).map((item) => [item.id, item.title]));
    setSessions((Array.isArray(liste) ? liste : []).map((item) => ({ ...item, formation_titre: item.formation_title || titres[item.formation_id] || '' })));
  });

  useEffect(() => { charger(); }, []);

  const lieux = useMemo(() => [...new Set((sessions || []).map((item) => item.location || item.adresse).filter(Boolean))].sort(), [sessions]);
  const visibles = useMemo(() => (sessions || []).filter((item) => {
    const haystack = `${item.session_name || ''} ${item.formation_titre || ''} ${item.code_interne || ''} ${item.formateur_name || ''}`.toLocaleLowerCase();
    return (!recherche || haystack.includes(recherche.toLocaleLowerCase()))
      && (statut === 'all' || String(item.status || '').toLowerCase() === statut)
      && (type === 'all' || String(item.type_session || '').toUpperCase() === type)
      && (modalite === 'all' || String(item.modality || '').toLowerCase() === modalite)
      && (lieu === 'all' || (item.location || item.adresse) === lieu);
  }), [sessions, recherche, statut, type, modalite, lieu]);
  const aujourdhui = iso(new Date());

  const grille = useMemo(() => {
    const annee = curseur.getFullYear();
    const mois = curseur.getMonth();
    const first = new Date(annee, mois, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(annee, mois, 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = iso(date);
      return {
        key, day: date.getDate(), outside: date.getMonth() !== mois, today: key === aujourdhui,
        sessions: visibles.filter((item) => item.start_date && key >= item.start_date && key <= (item.end_date || item.start_date)),
      };
    });
  }, [curseur, visibles, aujourdhui]);

  const dated = useMemo(() => [...visibles].filter((item) => item.start_date).sort((a, b) => a.start_date.localeCompare(b.start_date)), [visibles]);
  const detail = selection?.sessionId ? visibles.find((item) => item.id === selection.sessionId) : null;

  return (
    <>
      <TopBar title="Agenda" subtitle={sessions ? `${visibles.length} session(s) affichée(s)` : ''} />
      <div style={{ padding: '18px 24px 48px', maxWidth: 1900, margin: '0 auto' }}>
        {!sessions ? <Skeleton /> : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <Link href="/sessions/nouvelle" style={{ ...button, background: 'var(--gold)', color: 'var(--gold-ink)', borderColor: 'var(--gold)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>＋ Créer une session</Link>
            <span style={{ ...token, marginLeft: 2 }}>Planning des formations</span>
          </div>

          <section aria-label="Filtres de l'agenda" style={{ display: 'flex', gap: 8, padding: '10px 0 14px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
            <label style={{ position: 'relative', minWidth: 210, flex: '1 1 230px' }}>
              <span style={{ position: 'absolute', left: 11, top: 7, color: 'var(--text-3)' }}>⌕</span>
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Nom ou code" style={{ ...button, width: '100%', paddingLeft: 30, fontWeight: 400 }} />
            </label>
            <Filter label="Statut de la session" value={statut} onChange={setStatut} options={[['all', 'Tous les statuts'], ...Object.entries(STATUTS)]} />
            <Filter label="Inter / Intra" value={type} onChange={setType} options={[['all', 'Inter / Intra'], ['INTER', 'Inter'], ['INTRA', 'Intra']]} />
            <Filter label="Modalités" value={modalite} onChange={setModalite} options={[['all', 'Toutes modalités'], ...Object.entries(MODALITES)]} />
            <Filter label="Lieux" value={lieu} onChange={setLieu} options={[['all', 'Tous les lieux'], ...lieux.map((item) => [item, item])]} />
            {(recherche || statut !== 'all' || type !== 'all' || modalite !== 'all' || lieu !== 'all') && <button type="button" style={button} onClick={() => { setRecherche(''); setStatut('all'); setType('all'); setModalite('all'); setLieu('all'); }}>Effacer</button>}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 285px)', gap: 18, marginTop: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <select aria-label="Période affichée" style={button} defaultValue="month"><option value="month">Mois</option></select>
                <button type="button" style={button} onClick={() => setCurseur(new Date())}>Aujourd’hui</button>
                <button type="button" aria-label="Mois précédent" style={button} onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() - 1, 1))}>‹</button>
                <button type="button" aria-label="Mois suivant" style={button} onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1))}>›</button>
                <strong style={{ fontSize: 15, letterSpacing: '-.015em', margin: '0 auto', textTransform: 'capitalize' }}>{MOIS[curseur.getMonth()]} {curseur.getFullYear()}</strong>
                <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {[['calendar', 'Calendrier'], ['planning', 'Planning'], ['timeline', 'Frise']].map(([id, label]) => <button key={id} type="button" onClick={() => setVue(id)} style={{ ...button, border: 0, borderRadius: 0, background: vue === id ? 'var(--gold-soft)' : 'transparent', color: vue === id ? 'var(--text)' : 'var(--text-3)' }}>{label}</button>)}
                </div>
              </div>

              {vue === 'calendar' && <CalendarGrid cells={grille} onSelectDay={(key, daySessions) => setSelection(daySessions.length ? { sessionId: daySessions[0].id } : { date: key })} onSelectSession={(sessionId) => setSelection({ sessionId })} />}
              {vue === 'planning' && <Planning sessions={dated} onSelect={(sessionId) => setSelection({ sessionId })} />}
              {vue === 'timeline' && <Timeline sessions={dated} onSelect={(sessionId) => setSelection({ sessionId })} />}
            </div>
            <AgendaDetail selection={selection} session={detail} />
          </div>
        </>}
      </div>
    </>
  );
}

function Filter({ label, value, onChange, options }) {
  return <label><span style={visuallyHidden}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} style={button}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
const visuallyHidden = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 };

function CalendarGrid({ cells, onSelectDay, onSelectSession }) {
  return <Card padding="none"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(92px, 1fr))', overflowX: 'auto' }}>
    {JOURS.map((day) => <div key={day} style={{ ...token, padding: '10px 9px', borderBottom: '1px solid var(--border-2)' }}>{day}</div>)}
    {cells.map((cell) => <div key={cell.key} onClick={() => onSelectDay(cell.key, cell.sessions)} style={{ minHeight: 112, padding: 7, cursor: 'pointer', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: cell.outside ? 'var(--surface-2)' : 'transparent', opacity: cell.outside ? .52 : 1 }}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', background: cell.today ? 'var(--gold)' : 'transparent', color: cell.today ? 'var(--gold-ink)' : 'var(--text-3)', fontSize: 11, fontWeight: cell.today ? 700 : 500 }}>{cell.day}</span>
      {cell.sessions.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={(event) => { event.stopPropagation(); onSelectSession(item.id); }} style={{ display: 'block', width: '100%', marginTop: 4, padding: '3px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', cursor: 'pointer', border: 0, borderLeft: '3px solid var(--gold)', borderRadius: 3, background: 'var(--gold-soft)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 600 }}>{item.session_name || item.formation_titre || 'Session'}</button>)}
      {cell.sessions.length > 3 && <div style={{ color: 'var(--text-3)', fontSize: 10, padding: '3px 5px' }}>+ {cell.sessions.length - 3} autres</div>}
    </div>)}
  </div></Card>;
}

function AgendaDetail({ selection, session }) {
  if (session) return <aside style={side}><div style={token}>Détails de la session</div><h2 style={{ fontSize: 16, margin: '8px 0 4px' }}>{session.session_name || session.formation_titre || 'Session'}</h2><p style={{ margin: '0 0 14px', color: 'var(--text-3)', fontSize: 12 }}>{session.code_interne || 'Sans code'}</p><Detail label="Dates" value={`${dateFr(session.start_date)} → ${dateFr(session.end_date || session.start_date)}`} /><Detail label="Statut" value={STATUTS[String(session.status || '').toLowerCase()] || session.status || '—'} /><Detail label="Formateur" value={session.formateur_name || 'Non attribué'} /><Detail label="Lieu" value={session.location || session.adresse || 'À préciser'} /><Detail label="Inscrits" value={`${session.inscriptions_count || 0} apprenant(s)`} /><Link href={sessionHref(session.id)} style={{ display: 'block', marginTop: 16, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--gold)', color: 'var(--gold-ink)', textAlign: 'center', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>Ouvrir la session</Link></aside>;
  if (selection?.date) return <aside style={side}><div style={token}>Journée sélectionnée</div><h2 style={{ fontSize: 16, margin: '8px 0' }}>{dateFr(selection.date)}</h2><p style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>Aucune session ne correspond à cette journée avec les filtres actuels.</p><Link href={`/sessions/nouvelle?date=${selection.date}`} style={{ ...button, width: '100%', marginTop: 12, background: 'var(--gold)', color: 'var(--gold-ink)', borderColor: 'var(--gold)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>＋ Créer une session</Link></aside>;
  return <aside style={side}><div style={token}>Détails</div><p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55 }}>Sélectionne un jour ou une session pour consulter ses informations et l’ouvrir directement.</p><div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}><div style={token}>Guide</div><p style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>Utilise Calendrier pour le mois, Planning pour la liste chronologique et Frise pour situer les sessions dans le temps.</p></div></aside>;
}
const side = { alignSelf: 'start', position: 'sticky', top: 104, padding: 16, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)' };
const Detail = ({ label, value }) => <div style={{ marginTop: 11 }}><div style={token}>{label}</div><div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4 }}>{value}</div></div>;

function Planning({ sessions, onSelect }) {
  if (!sessions.length) return <EmptyState title="Aucune session" message="Aucune session datée ne correspond aux filtres sélectionnés." />;
  return <Card padding="none"><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Session', 'Formation', 'Début', 'Fin', 'Lieu', 'Statut'].map((label) => <th key={label} style={{ ...token, padding: '11px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-2)' }}>{label}</th>)}</tr></thead><tbody>{sessions.map((item) => <tr key={item.id} onClick={() => onSelect(item.id)} style={{ cursor: 'pointer' }}><td style={td}>{item.session_name || item.code_interne || 'Session'}</td><td style={{ ...td, color: 'var(--text-3)' }}>{item.formation_titre || '—'}</td><td style={td}>{dateFr(item.start_date)}</td><td style={td}>{dateFr(item.end_date || item.start_date)}</td><td style={{ ...td, color: 'var(--text-3)' }}>{item.location || item.adresse || '—'}</td><td style={td}>{STATUTS[String(item.status || '').toLowerCase()] || item.status || '—'}</td></tr>)}</tbody></table></Card>;
}
const td = { padding: '11px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5 };

function Timeline({ sessions, onSelect }) {
  if (!sessions.length) return <EmptyState title="Aucune session" message="Aucune session datée ne correspond aux filtres sélectionnés." />;
  const dates = sessions.flatMap((item) => [item.start_date, item.end_date || item.start_date]).filter(Boolean).sort();
  const start = new Date(`${dates[0]}T00:00:00`).getTime(); const end = new Date(`${dates[dates.length - 1]}T00:00:00`).getTime(); const span = Math.max(end - start, 86400000);
  const pos = (date) => ((new Date(`${date}T00:00:00`).getTime() - start) / span) * 100;
  return <Card><div>{sessions.map((item) => { const left = pos(item.start_date); const width = Math.max(pos(item.end_date || item.start_date) - left, 1.5); return <button key={item.id} type="button" onClick={() => onSelect(item.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 26%) 1fr', gap: 12, alignItems: 'center', width: '100%', padding: '7px 0', border: 0, background: 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{item.session_name || item.formation_titre || 'Session'}</span><span style={{ height: 20, position: 'relative', background: 'var(--surface-2)', borderRadius: 3 }}><span style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 4, bottom: 4, minWidth: 6, borderRadius: 2, background: 'var(--gold)' }} /></span></button>; })}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginLeft: '27%' }}><span style={token}>{dateFr(dates[0])}</span><span style={token}>{dateFr(dates[dates.length - 1])}</span></div></Card>;
}

const field = { display: 'grid', gap: 5, marginBottom: 12, color: 'var(--text-2)', fontSize: 12, fontWeight: 600 };
const input = { minHeight: 36, padding: '6px 9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 };

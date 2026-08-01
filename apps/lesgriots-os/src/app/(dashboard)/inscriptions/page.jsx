'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const dateFr = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') : '—';

/*
 * L'entretien préalable, lisible.
 *
 * Cal.com stocke en UTC ; on affiche à Paris. Sans ce fuseau explicite, un
 * créneau de 10 h 40 s'afficherait 08 h 40 sur un serveur en UTC, et personne
 * ne se douterait de rien avant de rater le rendez-vous.
 */
const ENTRETIEN = {
  '': { texte: 'À réserver', couleur: 'var(--warn, #C9821C)' },
  reserve: { texte: 'Réservé', couleur: 'var(--ok, #1E8449)' },
  honore: { texte: 'Fait', couleur: 'var(--text-3)' },
  annule: { texte: 'Annulé', couleur: 'var(--danger, #B83328)' },
  absent: { texte: 'Absent', couleur: 'var(--danger, #B83328)' },
};
const creneauFr = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
};
const button = { minHeight: 34, padding: '6px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 };
const th = { padding: '10px 11px', textAlign: 'left', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '11px', borderBottom: '1px solid var(--border)', fontSize: 12.5, verticalAlign: 'top' };

export default function InscriptionsPage() {
  const [rows, setRows] = useState(null); const [query, setQuery] = useState(''); const [includeConfirmed, setIncludeConfirmed] = useState(false); const [sansEntretien, setSansEntretien] = useState(false); const [selected, setSelected] = useState(new Set());
  const load = () => fetch('/api/inscriptions').then((response) => response.ok ? response.json() : []).then((data) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => (rows || []).filter((item) => (includeConfirmed || item.status !== 'confirme') && (!sansEntretien || !item.entretien_statut) && `${item.first_name} ${item.last_name} ${item.email} ${item.formation_title}`.toLowerCase().includes(query.toLowerCase())), [rows, includeConfirmed, sansEntretien, query]);
  const toggle = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const validate = async () => { await Promise.all([...selected].map((id) => fetch('/api/inscriptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'confirme' }) }))); setSelected(new Set()); load(); };
  const exportCsv = () => { const csv = ['Nom;Email;Programme;Session;Entretien;Creneau;Statut', ...filtered.map((item) => [`${item.first_name} ${item.last_name}`, item.email, item.formation_title, `${item.start_date} → ${item.end_date}`, (ENTRETIEN[item.entretien_statut || ''] || ENTRETIEN['']).texte, creneauFr(item.entretien_le), item.status].map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(';'))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'demandes-inscription.csv'; link.click(); URL.revokeObjectURL(url); };
  return <><TopBar title="Demandes d’inscription" subtitle={rows ? `${filtered.length} demande(s) à traiter` : ''} /><main style={{ padding: '18px 24px 48px' }}>{!rows ? <Skeleton /> : <><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}><button type="button" onClick={exportCsv} style={button}>↓ Exporter</button><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' }}><input type="checkbox" checked={includeConfirmed} onChange={(event) => setIncludeConfirmed(event.target.checked)} /> Inclure les validées</label><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' }}><input type="checkbox" checked={sansEntretien} onChange={(event) => setSansEntretien(event.target.checked)} /> Entretien pas encore réservé</label><button type="button" disabled={!selected.size} onClick={validate} style={{ ...button, opacity: selected.size ? 1 : .45, background: selected.size ? 'var(--gold)' : 'var(--surface)', color: selected.size ? 'var(--gold-ink)' : 'var(--text-3)' }}>Valider manuellement ({selected.size})</button></div><Card padding="none"><div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une demande" style={{ ...button, width: 'min(340px, 100%)', fontWeight: 400 }} /></div>{filtered.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}><thead><tr><th style={th} /><th style={th}>Date</th><th style={th}>Nom</th><th style={th}>Email</th><th style={th}>Programme</th><th style={th}>Session</th><th style={th}>Financement</th><th style={th}>Entretien</th><th style={th}>Statut</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td style={td}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></td><td style={td}>{dateFr(item.created_at?.slice(0, 10))}</td><td style={td}>{item.first_name} {item.last_name}</td><td style={td}>{item.email || '—'}</td><td style={td}>{item.formation_title || '—'}</td><td style={td}>{dateFr(item.start_date)}<br />{dateFr(item.end_date)}</td><td style={td}>{item.financement || '—'}</td><td style={td}>{(() => { const e = ENTRETIEN[item.entretien_statut || ''] || ENTRETIEN['']; const q = creneauFr(item.entretien_le); return <><span style={{ color: e.couleur, fontWeight: 600 }}>{e.texte}</span>{q ? <><br /><span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{q}</span></> : null}</>; })()}</td><td style={td}>{item.status === 'confirme' ? 'Validée' : item.status || 'À traiter'}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucune demande" message="Les demandes reçues et les inscriptions à valider apparaîtront ici." />}</Card></>}</main></>;
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const dateFr = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR') : '—';
const button = { minHeight: 34, padding: '6px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 };
const th = { padding: '10px 11px', textAlign: 'left', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '11px', borderBottom: '1px solid var(--border)', fontSize: 12.5 };

export default function RecyclagesPage() {
  const [rows, setRows] = useState(null); const [query, setQuery] = useState('');
  const load = () => fetch('/api/inscriptions').then((response) => response.ok ? response.json() : []).then((data) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => (rows || []).filter((item) => `${item.first_name} ${item.last_name} ${item.formation_title} ${item.session_name || ''}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const exportCsv = () => { const csv = ['Nom;Session;Fin de validité;Date de relance;État', ...filtered.map((item) => [`${item.first_name} ${item.last_name}`, item.formation_title, item.valid_until, item.follow_up_date, item.follow_up_status].join(';'))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'suivi-recyclages.csv'; link.click(); URL.revokeObjectURL(url); };
  return <><TopBar title="Suivi des recyclages" subtitle={rows ? `${filtered.length} parcours suivi(s)` : ''} /><main style={{ padding: '18px 24px 48px' }}>{!rows ? <Skeleton /> : <><button type="button" onClick={exportCsv} style={{ ...button, marginBottom: 14 }}>↓ Exporter</button><Card padding="none"><div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un apprenant ou une session" style={{ ...button, width: 'min(340px, 100%)', fontWeight: 400 }} /></div>{filtered.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr>{['Nom', 'Nom de la session', 'État de validité', 'Fin de validité', 'Date de relance', 'État de la relance'].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td style={td}>{item.first_name} {item.last_name}</td><td style={td}>{item.formation_title || '—'}</td><td style={td}>{item.valid_until ? (new Date(`${item.valid_until}T00:00:00`) < new Date() ? 'Expirée' : 'Valide') : 'Non configurée'}</td><td style={td}>{dateFr(item.valid_until)}</td><td style={td}>{dateFr(item.follow_up_date)}</td><td style={td}>{item.follow_up_status || 'À relancer'}</td></tr>)}</tbody></table></div> : <EmptyState title="Aucun recyclage" message="Les validités de formation et leurs relances apparaîtront ici." />}</Card></>}</main></>;
}

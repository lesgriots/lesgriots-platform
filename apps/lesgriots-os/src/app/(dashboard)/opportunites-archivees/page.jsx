'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const euros = (amount) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount || 0);
const button = { minHeight: 34, padding: '6px 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 };
const th = { padding: '10px 11px', textAlign: 'left', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '11px', borderBottom: '1px solid var(--border)', fontSize: 12.5 };

export default function OpportunitesArchiveesPage() {
  const [opps, setOpps] = useState(null); const [query, setQuery] = useState('');
  const load = () => fetch('/api/formation-opportunities?archives=1').then((response) => response.ok ? response.json() : []).then((data) => setOpps(Array.isArray(data) ? data : [])).catch(() => setOpps([]));
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => (opps || []).filter((item) => `${item.client_name} ${item.company} ${item.formation_title}`.toLowerCase().includes(query.toLowerCase())), [opps, query]);
  const restore = async (id) => { await fetch(`/api/formation-opportunities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: 0 }) }); load(); };
  return <><TopBar title="Opportunités archivées" subtitle={opps ? `${filtered.length} opportunité(s)` : ''} /><main style={{ padding: '18px 24px 48px' }}>{!opps ? <Skeleton /> : <Card padding="none"><div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une opportunité" style={{ ...button, width: 'min(340px, 100%)', fontWeight: 400 }} /></div>{filtered.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}><thead><tr>{['Client', 'Entreprise', 'Formation', 'Étape', 'Montant', 'Action'].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td style={td}>{item.client_name || '—'}</td><td style={td}>{item.company || '—'}</td><td style={td}>{item.formation_title || '—'}</td><td style={td}>{item.stage || '—'}</td><td style={td}>{euros(item.revenue)}</td><td style={td}><button type="button" onClick={() => restore(item.id)} style={button}>Restaurer</button></td></tr>)}</tbody></table></div> : <EmptyState title="Aucune opportunité archivée" message="Les affaires retirées du tunnel pourront être restaurées depuis cet écran." />}</Card>}</main></>;
}

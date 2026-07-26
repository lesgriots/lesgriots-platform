'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';

const fmtDate = (d) => {
  if (!d) return '—';
  const dateStr = String(d).includes('T') ? d.split('T')[0] : d.split(' ')[0];
  if (!dateStr || dateStr.length < 8) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const STATUS_COLOR = { planned: 'var(--gold-deep)', ongoing: 'var(--info)', completed: 'var(--success)', cancelled: 'var(--danger)' };
const STATUS_LABEL = { planned: 'Planifiée', ongoing: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
const MODALITY_COLOR = { presentiel: 'var(--success)', distanciel: 'var(--info)', hybride: 'var(--pillar-prod)' };
const MODALITY_LABEL = { presentiel: 'Présentiel', distanciel: 'Distanciel', hybride: 'Hybride' };
const TYPE_COLOR = { INTER: 'var(--info)', INTRA: 'var(--gold-deep)' };

export default function SessionsListPage() {
  const [sessions, setSessions] = useState([]);
  const [formations, setFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then(r => r.json()),
      fetch('/api/formations').then(r => r.json()),
    ]).then(([s, f]) => {
      setSessions(Array.isArray(s) ? s : []);
      setFormations(Array.isArray(f) ? f : []);
      setLoading(false);
    }).catch((e) => { console.warn('[Sessions] Chargement échoué :', e); setLoading(false); });
  }, []);

  useEffect(() => {
    if (selected) {
      fetch(`/api/inscriptions?session_id=${selected}`)
        .then(r => r.json())
        .then(d => setInscriptions(Array.isArray(d) ? d : []))
        .catch((e) => { console.warn('[Sessions] Inscriptions non chargées :', e); setInscriptions([]); });
    }
  }, [selected]);

  const filtered = sessions.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchType = typeFilter === 'all' || s.type_session === typeFilter;
    return matchStatus && matchType;
  });

  const statuses = [...new Set(sessions.map(s => s.status).filter(Boolean))];
  const detail = selected ? sessions.find(s => s.id === selected) : null;
  const detailFormation = detail ? formations.find(f => f.id === detail.formation_id) : null;

  if (detail) {
    return (
      <>
        <TopBar title={detail.code || 'Session'} subtitle={detailFormation?.title || ''} />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <button onClick={() => setSelected(null)} style={{
            background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer',
            fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>←</span> Retour aux sessions
          </button>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Formation', value: detailFormation?.title || '—' },
              { label: 'Dates', value: `${fmtDate(detail.date_debut)} → ${fmtDate(detail.date_fin)}` },
              { label: 'Modalité', value: MODALITY_LABEL[detail.modality] || detail.modality || '—', color: MODALITY_COLOR[detail.modality] },
              { label: 'Type', value: detail.type_session || '—', color: TYPE_COLOR[detail.type_session] },
              { label: 'Statut', value: STATUS_LABEL[detail.status] || detail.status, color: STATUS_COLOR[detail.status] },
              { label: 'Tarif', value: fmt(detail.tarif) },
            ].map(c => (
              <div key={c.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '14px 20px', flex: 1, minWidth: 130,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.color || 'var(--text)' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Formateur */}
          {detail.formateur_name && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.04em' }}>FORMATEUR</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{detail.formateur_name}</div>
            </div>
          )}

          {/* Inscrits */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.04em' }}>
              INSCRITS ({inscriptions.length})
            </div>
            {inscriptions.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Aucun inscrit</div>
            ) : inscriptions.map((ins, i) => (
              <div key={ins.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: i < inscriptions.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  {ins.apprenant_first_name || ins.first_name} {ins.apprenant_last_name || ins.last_name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{ins.apprenant_email || ins.email || '—'}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: `color-mix(in srgb, ${STATUS_COLOR[ins.status] || 'var(--text-3)'} 14%, transparent)`,
                  color: STATUS_COLOR[ins.status] || 'var(--text-3)', fontWeight: 500,
                }}>{STATUS_LABEL[ins.status] || ins.status}</span>
                {ins.financement && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-3)' }}>{ins.financement}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Sessions" subtitle={`${sessions.length} sessions de formation`} />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'all', label: 'Toutes' }, ...statuses.map(s => ({ key: s, label: STATUS_LABEL[s] || s }))].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: statusFilter === f.key ? (f.key !== 'all' ? `color-mix(in srgb, ${STATUS_COLOR[f.key]} 14%, transparent)` : 'var(--gold-soft)') : 'transparent',
                color: statusFilter === f.key ? (STATUS_COLOR[f.key] || 'var(--gold)') : 'var(--text-3)',
              }}>{f.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'all', label: 'Tous types' }, { key: 'INTER', label: 'INTER' }, { key: 'INTRA', label: 'INTRA' }].map(f => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)} style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: typeFilter === f.key ? (TYPE_COLOR[f.key] ? `color-mix(in srgb, ${TYPE_COLOR[f.key]} 14%, transparent)` : 'var(--gold-soft)') : 'transparent',
                color: typeFilter === f.key ? (TYPE_COLOR[f.key] || 'var(--gold)') : 'var(--text-3)',
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          <div className="resp-table-head" style={{
            display: 'grid', gridTemplateColumns: '80px 2fr 1fr 90px 80px 70px 90px',
            padding: '10px 20px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em',
          }}>
            <span>CODE</span><span>FORMATION</span><span>DATES</span><span>MODALITÉ</span><span>TYPE</span><span style={{ textAlign: 'right' }}>INSCRITS</span><span style={{ textAlign: 'right' }}>TARIF</span>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Aucune session</div>
          ) : filtered.map((s, i) => {
            const form = formations.find(f => f.id === s.formation_id);
            return (
              <div key={s.id} className="resp-table-row" onClick={() => setSelected(s.id)} style={{
                display: 'grid', gridTemplateColumns: '80px 2fr 1fr 90px 80px 70px 90px',
                padding: '12px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center', fontSize: 13, cursor: 'pointer',
                transition: 'background var(--duration) var(--ease)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{s.code}</span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{form?.title || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(s.date_debut)} → {fmtDate(s.date_fin)}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: `color-mix(in srgb, ${MODALITY_COLOR[s.modality] || 'var(--text-3)'} 14%, transparent)`,
                  color: MODALITY_COLOR[s.modality] || 'var(--text-3)', fontWeight: 500, display: 'inline-block',
                }}>{MODALITY_LABEL[s.modality] || s.modality || '—'}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: s.type_session ? `color-mix(in srgb, ${TYPE_COLOR[s.type_session] || 'var(--text-3)'} 14%, transparent)` : 'transparent',
                  color: TYPE_COLOR[s.type_session] || 'var(--text-3)', fontWeight: 500,
                }}>{s.type_session || '—'}</span>
                <span style={{ textAlign: 'right', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.inscription_count ?? s.nb_inscrits ?? '—'}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: s.tarif ? 'var(--text)' : 'var(--text-3)' }}>
                  {s.tarif ? fmt(s.tarif) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

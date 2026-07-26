'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';

const STATUS_COLOR = { inscrit: 'var(--text-3)', confirme: 'var(--success)', annule: 'var(--danger)', liste_attente: 'var(--gold-deep)' };
const STATUS_LABEL = { inscrit: 'Inscrit', confirme: 'Confirmé', annule: 'Annulé', liste_attente: 'En attente' };
const ETAT_COLOR = {
  prospect: 'var(--text-3)', pre_inscrit: 'var(--gold-deep)', inscrit: 'var(--info)', en_formation: 'var(--success)',
  forme: 'var(--pillar-prod)', abandonne: 'var(--danger)', reporte: 'var(--warning)',
};
const ETAT_LABEL = {
  prospect: 'Prospect', pre_inscrit: 'Pré-inscrit', inscrit: 'Inscrit', en_formation: 'En formation',
  forme: 'Formé', abandonne: 'Abandonné', reporte: 'Reporté',
};
const FINANCEMENT_COLORS = { CPF: 'var(--info)', OPCO: 'var(--pillar-prod)', auto: 'var(--gold-deep)', FAF: 'var(--success)', entreprise: 'var(--warning)' };

export default function ApprenantsPage() {
  const [apprenants, setApprenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [etatFilter, setEtatFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);

  useEffect(() => {
    fetch('/api/apprenants')
      .then(r => r.json())
      .then(d => { setApprenants(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((e) => { console.warn('[Apprenants] Chargement échoué :', e); setLoading(false); });
  }, []);

  useEffect(() => {
    if (selected) {
      fetch(`/api/inscriptions?apprenant_id=${selected}`)
        .then(r => r.json())
        .then(d => setInscriptions(Array.isArray(d) ? d : []))
        .catch((e) => { console.warn('[Apprenants] Inscriptions non chargées :', e); setInscriptions([]); });
    }
  }, [selected]);

  const etats = [...new Set(apprenants.map(a => a.etat).filter(Boolean))].sort();

  const filtered = apprenants.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || (a.first_name || '').toLowerCase().includes(q) || (a.last_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || (a.company || '').toLowerCase().includes(q);
    const matchEtat = etatFilter === 'all' || a.etat === etatFilter;
    return matchSearch && matchEtat;
  });

  const detail = selected ? apprenants.find(a => a.id === selected) : null;

  if (detail) {
    return (
      <>
        <TopBar title={`${detail.first_name} ${detail.last_name}`} subtitle={detail.company || 'Apprenant'} />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <button onClick={() => setSelected(null)} style={{
            background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer',
            fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>←</span> Retour aux apprenants
          </button>

          {/* Info cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'État', value: ETAT_LABEL[detail.etat] || detail.etat || '—', color: ETAT_COLOR[detail.etat] },
              { label: 'Email', value: detail.email || '—' },
              { label: 'Téléphone', value: detail.phone || '—' },
              { label: 'Financement', value: detail.financement || '—', color: FINANCEMENT_COLORS[detail.financement] },
            ].map(c => (
              <div key={c.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '14px 20px', flex: 1, minWidth: 160,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.color || 'var(--text)' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Detail info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.04em' }}>INFORMATIONS</div>
              {[
                { label: 'Entreprise', value: detail.company },
                { label: 'Poste', value: detail.poste },
                { label: 'Ville', value: detail.city },
                { label: 'Code postal', value: detail.postal_code },
                { label: 'Handicap', value: detail.handicap === 1 ? 'Oui' : detail.handicap === 0 ? 'Non' : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.04em' }}>FINANCEMENT</div>
              {[
                { label: 'Type', value: detail.financement },
                { label: 'OPCO/FAF', value: detail.opco_faf_name },
                { label: 'N° Dossier', value: detail.numero_dossier },
                { label: 'Montant pris en charge', value: detail.montant_pris_en_charge ? `${detail.montant_pris_en_charge} €` : null },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inscriptions */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.04em' }}>
              INSCRIPTIONS ({inscriptions.length})
            </div>
            {inscriptions.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Aucune inscription</div>
            ) : inscriptions.map((ins, i) => (
              <div key={ins.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: i < inscriptions.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{ins.session_code || '—'}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{ins.formation_title || ins.session_id}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: `color-mix(in srgb, ${STATUS_COLOR[ins.status] || 'var(--text-3)'} 14%, transparent)`,
                  color: STATUS_COLOR[ins.status] || 'var(--text-3)', fontWeight: 500,
                }}>{STATUS_LABEL[ins.status] || ins.status}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {detail.notes && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.04em' }}>NOTES</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detail.notes}</div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Apprenants" subtitle={`${apprenants.length} apprenants`} />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un apprenant..."
            style={{
              flex: 1, maxWidth: 360, padding: '8px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setEtatFilter('all')} style={{
              padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: etatFilter === 'all' ? 'var(--gold-soft)' : 'transparent',
              color: etatFilter === 'all' ? 'var(--gold)' : 'var(--text-3)',
            }}>Tous</button>
            {etats.map(e => (
              <button key={e} onClick={() => setEtatFilter(e)} style={{
                padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: etatFilter === e ? `color-mix(in srgb, ${ETAT_COLOR[e] || 'var(--text-3)'} 14%, transparent)` : 'transparent',
                color: etatFilter === e ? ETAT_COLOR[e] || 'var(--text-3)' : 'var(--text-3)',
              }}>{ETAT_LABEL[e] || e}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          <div className="resp-table-head" style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px',
            padding: '10px 20px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em',
          }}>
            <span>NOM</span><span>EMAIL</span><span>ENTREPRISE</span><span>FINANCEMENT</span><span>ÉTAT</span>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>{search ? 'Aucun résultat' : 'Aucun apprenant'}</div>
          ) : filtered.map((a, i) => (
            <div key={a.id} className="resp-table-row" onClick={() => setSelected(a.id)} style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 90px',
              padding: '12px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              alignItems: 'center', fontSize: 13, cursor: 'pointer',
              transition: 'background var(--duration) var(--ease)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{a.first_name} {a.last_name}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{a.email || '—'}</span>
              <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{a.company || '—'}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: a.financement ? `color-mix(in srgb, ${FINANCEMENT_COLORS[a.financement] || 'var(--text-3)'} 14%, transparent)` : 'transparent',
                color: FINANCEMENT_COLORS[a.financement] || 'var(--text-3)', fontWeight: 500,
              }}>{a.financement || '—'}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: `color-mix(in srgb, ${ETAT_COLOR[a.etat] || 'var(--text-3)'} 14%, transparent)`,
                color: ETAT_COLOR[a.etat] || 'var(--text-3)', fontWeight: 500,
              }}>{ETAT_LABEL[a.etat] || a.etat || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

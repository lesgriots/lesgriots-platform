'use client';
import { useEffect, useState, use, useCallback, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, SubLabel, EditableField,
  StarRating, MultiCategorySelect, useToast,
} from '@/components/ui';
import { PROVIDER_CATEGORIES, EXPENSE_STATUS } from '@/lib/constants';

const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

const STAGE_LABEL = {
  lead: 'Lead', need: 'Besoin', qualify: 'Qualif', quoted: 'Devis',
  negotiation: 'Négo', signed: 'Signé', active: 'Actif',
  delivered: 'Livré', paid: 'Payé', lost: 'Perdu',
};
const STAGE_TONE = {
  lead: 'neutral', need: 'neutral', qualify: 'info',
  quoted: 'gold', negotiation: 'warning',
  signed: 'success', active: 'success',
  delivered: 'pillar', paid: 'success', lost: 'danger',
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export default function ProviderDetailPage({ params }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    return fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        const provider = (d.providers || []).find(p => p.id === id);
        if (!provider) { setError('NOT_FOUND'); return; }
        // Collect expenses where this provider is referenced (by id or name)
        const expenses = [];
        const tasksAssigned = [];
        const fullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.name;
        for (const proj of (d.projects || [])) {
          for (const e of (proj.expenses || [])) {
            if (e.provider_id === id || e.provider === fullName) {
              expenses.push({ ...e,
                projectId: proj.id, projectCode: proj.code,
                projectName: proj.name, projectPillar: proj.pillar,
                projectStage: proj.stage,
              });
            }
          }
          for (const t of (proj.tasks || [])) {
            if (t.assigneeId === id || t.assigneeName === fullName) {
              tasksAssigned.push({ ...t,
                projectId: proj.id, projectCode: proj.code,
                projectName: proj.name, projectPillar: proj.pillar,
              });
            }
          }
        }
        setData({ provider, expenses, tasksAssigned, projects: d.projects || [] });
      })
      .catch(e => { console.warn('[Prestataire] Chargement échoué :', e); setError(e.message); });
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const saveField = useCallback(async (field, value) => {
    setData(prev => ({ ...prev, provider: { ...prev.provider, [field]: value } }));
    try {
      const r = await fetch(`/api/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Sauvegardé');
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
      reload();
    }
  }, [id, toast, reload]);

  if (error === 'NOT_FOUND') {
    return (
      <>
        <TopBar title="Prestataire introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce prestataire n'existe pas"
            action={<Button variant="primary" href="/providers">← Retour aux prestataires</Button>}
          />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Erreur" />
        <div style={pageStyle}>
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--danger)' }}>Erreur :</strong> {error}</span>
              <Button variant="danger" size="sm" onClick={() => { setError(null); reload(); }}>Réessayer</Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar title="Chargement…" />
        <div style={pageStyle}>
          <Card><Skeleton width="40%" height={20} /></Card>
          <Card style={{ minHeight: 200 }}><Skeleton width="20%" height={14} /></Card>
        </div>
      </>
    );
  }

  const { provider, expenses, tasksAssigned } = data;
  const fullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.name || '—';
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  // Stats
  const totalSpent = expenses.reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
  const totalOverdue = expenses.filter(e => e.status === 'overdue').reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);

  const projectIds = [...new Set(expenses.map(e => e.projectId).concat(tasksAssigned.map(t => t.projectId)))];
  const projectsLinked = projectIds.map(pid => data.projects.find(p => p.id === pid)).filter(Boolean);

  const categories = Array.isArray(provider.categories) ? provider.categories : [];

  return (
    <>
      <TopBar title={fullName} subtitle={categories[0] || provider.category || 'Prestataire'} />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
          <Link href="/providers" style={breadcrumbLink}>← Prestataires</Link>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ color: 'var(--text-2)' }}>{fullName}</span>
        </div>

        {/* Header */}
        <Card>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--gold-soft)', color: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 600,
              fontFamily: 'var(--font-title)', flexShrink: 0,
            }}>
              {initials || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <EditableField
                  value={provider.firstName || ''}
                  onSave={(v) => saveField('firstName', v)}
                  placeholder="Prénom"
                  inputStyle={{ fontSize: 18, fontWeight: 500, padding: '4px 8px' }}
                  containerStyle={{ flex: 1 }}
                />
                <EditableField
                  value={provider.lastName || ''}
                  onSave={(v) => saveField('lastName', v)}
                  placeholder="Nom"
                  inputStyle={{ fontSize: 18, fontWeight: 500, padding: '4px 8px' }}
                  containerStyle={{ flex: 1 }}
                />
              </div>
              <EditableField
                value={provider.company || ''}
                onSave={(v) => saveField('company', v)}
                placeholder="Entreprise / structure"
                inputStyle={{ fontSize: 13, color: 'var(--text-2)' }}
                emptyLabel="+ Ajouter entreprise"
              />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <StarRating
                  value={Number(provider.rating) || 0}
                  onChange={(v) => saveField('rating', v)}
                  size={20}
                />
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Note de qualité
                </span>
              </div>
            </div>
          </div>

          {/* Catégories */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <SubLabel>Catégories d'intervention</SubLabel>
            <MultiCategorySelect
              selected={categories}
              options={PROVIDER_CATEGORIES}
              onChange={(newCats) => saveField('categories', newCats)}
              placeholder="Catégorie"
            />
          </div>
        </Card>

        {/* Stats financières */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}>
          <StatCard label="Total dépensé" value={fmt(totalSpent)} hint={`${expenses.length} dépense${expenses.length > 1 ? 's' : ''}`} />
          <StatCard label="Payé" value={fmt(totalPaid)} tone="success" />
          <StatCard label="En attente" value={fmt(totalPending)} tone={totalPending > 0 ? 'warning' : 'neutral'} />
          <StatCard label="En retard" value={fmt(totalOverdue)} tone={totalOverdue > 0 ? 'danger' : 'neutral'} />
          <StatCard label="Projets liés" value={projectsLinked.length} hint={tasksAssigned.length ? `${tasksAssigned.length} tâche${tasksAssigned.length > 1 ? 's' : ''}` : 'Via dépenses'} />
        </div>

        {/* Tarifs + Contact */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12,
        }}>
          <Card>
            <SectionTitle title="Tarifs" level="h2" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <EditableField
                label="Tarif jour (€)"
                value={provider.tarifJour ?? ''}
                type="number"
                onSave={(v) => saveField('tarifJour', parseFloat(v) || 0)}
                placeholder="0"
              />
              <EditableField
                label="TVA (%)"
                value={provider.tvaRate ?? '20'}
                onSave={(v) => saveField('tvaRate', v)}
              />
              <EditableField
                label="Fourchette min (€)"
                value={provider.tarifMin ?? ''}
                type="number"
                onSave={(v) => saveField('tarifMin', parseFloat(v) || 0)}
                placeholder="0"
              />
              <EditableField
                label="Fourchette max (€)"
                value={provider.tarifMax ?? ''}
                type="number"
                onSave={(v) => saveField('tarifMax', parseFloat(v) || 0)}
                placeholder="0"
              />
            </div>
          </Card>

          <Card>
            <SectionTitle title="Contact" level="h2" />
            <EditableField
              label="Email"
              value={provider.email || ''}
              onSave={(v) => saveField('email', v)}
              placeholder="exemple@email.com"
            />
            <div style={{ marginTop: 12 }}>
              <EditableField
                label="Téléphone"
                value={provider.phone || ''}
                onSave={(v) => saveField('phone', v)}
                placeholder="+33 6 …"
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <EditableField
                label="SIRET"
                value={provider.siret || ''}
                onSave={(v) => saveField('siret', v)}
                placeholder="14 chiffres"
              />
            </div>
          </Card>
        </div>

        {/* Projets liés */}
        {projectsLinked.length > 0 && (
          <Card>
            <SectionTitle
              title="Projets"
              level="h2"
              subtitle={`${projectsLinked.length} projet${projectsLinked.length > 1 ? 's' : ''}`}
            />
            {projectsLinked
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              .map(p => {
                const linkedExpenses = expenses.filter(e => e.projectId === p.id);
                const linkedTasks = tasksAssigned.filter(t => t.projectId === p.id);
                const totalOnProj = linkedExpenses.reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);
                const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 0', borderBottom: '1px solid var(--border)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ width: 4, alignSelf: 'stretch', background: pillarColor, borderRadius: 2 }} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', minWidth: 70 }}>
                      {p.code}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </span>
                    {linkedTasks.length > 0 && (
                      <Badge tone="info" size="sm">{linkedTasks.length} tâche{linkedTasks.length > 1 ? 's' : ''}</Badge>
                    )}
                    <Badge tone={STAGE_TONE[p.stage] || 'neutral'} size="sm">
                      {STAGE_LABEL[p.stage] || p.stage}
                    </Badge>
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: totalOnProj ? 'var(--text)' : 'var(--text-3)',
                      minWidth: 90, textAlign: 'right',
                    }}>
                      {totalOnProj ? fmt(totalOnProj) : '—'}
                    </span>
                  </Link>
                );
              })}
          </Card>
        )}

        {/* Historique dépenses */}
        <Card>
          <SectionTitle
            title="Historique des dépenses"
            level="h2"
            subtitle={`${expenses.length} entrée${expenses.length > 1 ? 's' : ''}`}
          />
          {expenses.length === 0 ? (
            <EmptyState compact icon="—" message="Aucune dépense liée à ce prestataire" />
          ) : (
            expenses
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
              .map(e => (
                <div key={e.id} className="resp-table-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 1.2fr 80px 100px 120px',
                  gap: 10, padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center', fontSize: 12,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontSize: 11,
                  }}>{fmtDate(e.date)}</span>
                  <Link
                    href={`/projects/${e.projectId}`}
                    style={{
                      fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                      fontSize: 11, textDecoration: 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {e.projectCode}
                  </Link>
                  <span style={{
                    color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.label}</span>
                  <span style={{
                    fontSize: 10, color: 'var(--text-3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.category || '—'}</span>
                  <Badge tone={
                    e.status === 'paid' ? 'success'
                    : e.status === 'overdue' ? 'danger'
                    : 'warning'
                  } size="sm">{e.status}</Badge>
                  <span style={{
                    textAlign: 'right', fontFamily: 'var(--font-mono)',
                    fontWeight: 600, color: 'var(--text)',
                  }}>{fmt(e.amount_ttc || e.amountTtc)}</span>
                </div>
              ))
          )}
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, value, hint, tone = 'neutral' }) {
  const color = {
    danger: 'var(--danger)', warning: 'var(--warning)',
    success: 'var(--success)', info: 'var(--info)',
    neutral: 'var(--text)',
  }[tone] || 'var(--text)';
  return (
    <Card>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 600, color,
        fontFamily: 'var(--font-mono)', lineHeight: 1, letterSpacing: -0.5,
      }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>{hint}</div>
      )}
    </Card>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%',
};
const breadcrumbLink = { color: 'var(--text-3)', textDecoration: 'none' };

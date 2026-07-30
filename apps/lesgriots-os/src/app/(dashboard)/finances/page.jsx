'use client';
/**
 * /finances — Hub finances LES GRIOTS.
 *
 * Trois sections :
 *   1. Coûts indirects récurrents (loyer, URSSAF, comptable, soft, etc.)
 *   2. Pilotage trésorerie (soldes + prévisionnel 30/60/90j)
 *   3. Indicateurs business (CA, dépenses directes via projets, marge globale)
 */
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, SectionTitle, useToast, EmptyState, useConfirm,
} from '@/components/ui';
import TreasuryDashboard from '@/components/TreasuryDashboard';

const FREQUENCIES = [
  { key: 'monthly', label: 'Mensuel', months: 1 },
  { key: 'quarterly', label: 'Trimestriel', months: 3 },
  { key: 'yearly', label: 'Annuel', months: 12 },
];

const RECURRING_CATEGORIES = [
  'URSSAF', 'Comptable', 'Logiciels', 'Banque',
  'Assurance', 'Loyer', 'Télécom', 'Mutuelle',
  'Formation', 'Autre',
];

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);
const fmtPrecise = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
}).format(n || 0);

const EMPTY_DRAFT = {
  label: '', amount_ht: 0, tva_rate: 20, category: '',
  frequency: 'monthly', day_of_month: 1, provider: '',
  start_date: '', end_date: '',
};

export default function FinancesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [costs, setCosts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = création, sinon ID du coût édité
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const r = await fetch('/api/recurring-costs');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setCosts(d);
    } catch (e) {
      console.warn('[Finances] Chargement échoué :', e);
      setLoadError(true);
      toast.error(`Chargement : ${e.message}`);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  };

  const openEdit = (cost) => {
    setEditingId(cost.id);
    setDraft({
      label: cost.label || '',
      amount_ht: Number(cost.amount_ht) || 0,
      tva_rate: Number(cost.tva_rate) || 0,
      category: cost.category || '',
      frequency: cost.frequency || 'monthly',
      day_of_month: cost.day_of_month || 1,
      provider: cost.provider || '',
      start_date: cost.start_date || '',
      end_date: cost.end_date || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    if (!draft.label.trim() || saving) return;
    setSaving(true);
    try {
      const url = editingId
        ? `/api/recurring-costs/${editingId}`
        : '/api/recurring-costs';
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Sauvegarde échouée');
      }
      await load();
      toast.success(editingId ? 'Coût modifié' : 'Coût ajouté');
      closeModal();
    } catch (e) {
      toast.error(e.message || 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const update = async (id, patch) => {
    setCosts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    try {
      const r = await fetch(`/api/recurring-costs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${r.status}`);
      }
    } catch (e) {
      toast.error(e.message || 'Erreur réseau');
      load();
    }
  };

  const remove = async (id) => {
    if (!(await confirm({ title: 'Supprimer ce coût récurrent ?', confirmLabel: 'Supprimer' }))) return;
    setCosts(prev => prev.filter(c => c.id !== id));
    try {
      const r = await fetch(`/api/recurring-costs/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${r.status}`);
      }
      toast.success('Supprimé');
    } catch (e) {
      toast.error(e.message || 'Erreur réseau');
      load();
    }
  };

  if (!costs) {
    return (
      <>
        <TopBar title="Finances" />
        <div style={pageStyle}>
          {loadError ? (
            <Card variant="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger les coûts récurrents.</span>
                <Button variant="danger" size="sm" onClick={load}>Réessayer</Button>
              </div>
            </Card>
          ) : (
            <Card><Skeleton width="50%" height={20} /></Card>
          )}
        </div>
      </>
    );
  }

  // Calculs synthèse
  const activeCosts = costs.filter(c => c.active);
  const monthlyTotal = activeCosts.reduce((s, c) => {
    const m = FREQUENCIES.find(f => f.key === c.frequency)?.months || 1;
    return s + (Number(c.amount_ttc) || 0) / m;
  }, 0);
  const yearlyTotal = monthlyTotal * 12;

  return (
    <>
      <TopBar
        title="Finances"
        subtitle="Coûts indirects · Pilotage trésorerie"
      />
      <div style={pageStyle} className="lg-anim-fade">

        {/* KPIs en tête */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}>
          <Kpi label="Coûts récurrents / mois" value={fmt(monthlyTotal)} hint={`${activeCosts.length} actifs`} accent="var(--gold-deep)" />
          <Kpi label="Annualisés" value={fmt(yearlyTotal)} hint="Charges fixes annuelles" />
          <Kpi label="Plus gros poste"
               value={activeCosts.length ? (
                 (() => {
                   const top = [...activeCosts].sort((a, b) => Number(b.amount_ttc) - Number(a.amount_ttc))[0];
                   return top.label.slice(0, 20);
                 })()
               ) : '—'}
               hint={activeCosts.length ? fmt([...activeCosts].sort((a, b) => Number(b.amount_ttc) - Number(a.amount_ttc))[0].amount_ttc) : ''} />
          <Kpi label="Lien rapide" value={<Link href="/pricing" style={{ color: 'var(--gold-deep)', textDecoration: 'none', fontSize: 16 }}>TJM →</Link>} hint="Voir mon plancher" />
        </div>

        {/* Trésorerie */}
        <TreasuryDashboard monthlyRecurringCosts={monthlyTotal} />

        {/* Coûts récurrents */}
        <Card>
          <SectionTitle
            title="Coûts indirects récurrents"
            level="h2"
            subtitle="Charges qui tombent chaque mois indépendamment des projets"
            right={
              <Button size="sm" variant="primary" onClick={openCreate}>
                + Coût récurrent
              </Button>
            }
          />

          {modalOpen && (
            <CostFormModal
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={closeModal}
              isEdit={!!editingId}
              saving={saving}
            />
          )}


          {costs.length === 0 ? (
            <EmptyState
              icon="€"
              title="Aucun coût récurrent"
              message="Ajoute tes charges fixes mensuelles (URSSAF, comptable, logiciels, etc.) pour piloter ta vraie marge nette."
            />
          ) : (
            <>
              <div className="resp-table-head" style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 110px 100px 60px 100px 130px 60px 60px',
                gap: 10, padding: '8px 0',
                fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
                letterSpacing: 0.5, textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                borderBottom: '1px solid var(--border)',
                marginTop: 12,
              }}>
                <span>Libellé</span>
                <span>Catégorie</span>
                <span>Fréquence</span>
                <span style={{ textAlign: 'right' }}>HT</span>
                <span style={{ textAlign: 'center' }}>TVA</span>
                <span style={{ textAlign: 'right' }}>TTC</span>
                <span>Période</span>
                <span style={{ textAlign: 'center' }}>Actif</span>
                <span style={{ textAlign: 'center' }}>Action</span>
              </div>
              {costs.map(c => {
                const hasTva = (Number(c.tva_rate) || 0) > 0;
                return (
                  <div key={c.id} className="resp-table-row" style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 110px 100px 60px 100px 130px 60px 60px',
                    gap: 10, padding: '10px 0',
                    fontSize: 13, alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    opacity: c.active ? 1 : 0.5,
                  }}>
                    <span style={{
                      fontWeight: 500, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.label}
                    </span>
                    <span style={{
                      fontSize: 12, color: 'var(--text-2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.category || '—'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {FREQUENCIES.find(f => f.key === c.frequency)?.label || c.frequency}
                    </span>
                    <span style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text)',
                    }}>
                      {fmtPrecise(c.amount_ht)}
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      {hasTva ? (
                        <Badge tone="info" size="sm">
                          {Number(c.tva_rate).toString().replace(/\.0+$/, '')}%
                        </Badge>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>
                      )}
                    </span>
                    <span style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}>
                      {fmtPrecise(c.amount_ttc)}
                    </span>
                    <PeriodCell cost={c} onUpdate={update} />
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 4, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={!!c.active}
                        onChange={e => update(c.id, { active: e.target.checked })}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        onClick={() => openEdit(c)}
                        style={iconBtn}
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        style={iconBtn}
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Card>

      </div>
    </>
  );
}

// Modale création/édition d'un coût récurrent — UX claire avec labels + toggle TVA
function CostFormModal({ draft, setDraft, onSave, onCancel, isEdit = false, saving = false }) {
  const hasTva = (draft.tva_rate || 0) > 0;
  const amountTtc = hasTva
    ? Math.round(draft.amount_ht * (1 + draft.tva_rate / 100) * 100) / 100
    : draft.amount_ht;

  const tvaRates = [
    { key: 20, label: '20% (standard)' },
    { key: 10, label: '10% (intermédiaire)' },
    { key: 5.5, label: '5,5% (livres, alim.)' },
    { key: 2.1, label: '2,1% (presse, médic.)' },
  ];

  const setTva = (rate) => setDraft(d => ({ ...d, tva_rate: rate }));

  return (
    <div style={modalOverlay} onClick={onCancel}>
    <div className="resp-modal" style={modalBox} onClick={e => e.stopPropagation()}>
      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--text)',
        marginBottom: 14, fontFamily: 'var(--font-title)',
      }}>
        {isEdit ? '✏️ Modifier le coût récurrent' : '💸 Nouveau coût récurrent'}
      </div>

      {/* Ligne 1 : Libellé + Catégorie */}
      <div className="resp-grid-1col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <LabeledField label="Libellé" hint="Ex: URSSAF, Adobe, Comptable, Stock juin-juil…">
          <input
            type="text"
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Décris ce coût en quelques mots"
            autoFocus
            style={inp}
          />
        </LabeledField>
        <LabeledField label="Catégorie" hint="Pour le regroupement comptable">
          <select
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            style={inp}
          >
            <option value="">— Choisir —</option>
            {RECURRING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </LabeledField>
      </div>

      {/* Ligne 2 : Toggle TVA */}
      <div style={{ marginBottom: 14 }}>
        <div style={miniLabel}>Soumis à la TVA ?</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setTva(0)}
            style={togglePill(!hasTva)}
          >
            ❌ Sans TVA
          </button>
          <button
            type="button"
            onClick={() => setTva(20)}
            style={togglePill(hasTva)}
          >
            ✓ Avec TVA
          </button>
          {hasTva && (
            <select
              value={draft.tva_rate}
              onChange={e => setTva(Number(e.target.value))}
              style={{ ...inp, width: 'auto', minWidth: 180 }}
            >
              {tvaRates.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>
          {hasTva
            ? '→ Tu saisis le montant HT, le TTC est calculé automatiquement.'
            : '→ Charges sans TVA : URSSAF, salaires, assurances, intérêts bancaires, certains services bancaires.'}
        </div>
      </div>

      {/* Ligne 3 : Montant + Fréquence + Jour */}
      <div className="resp-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12, marginBottom: 14 }}>
        <LabeledField label={hasTva ? 'Montant HT' : 'Montant'} hint={hasTva ? `TTC = ${amountTtc.toFixed(2)} €` : 'Pas de TVA'}>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              step="0.01"
              value={draft.amount_ht}
              onChange={e => setDraft(d => ({ ...d, amount_ht: Number(e.target.value) || 0 }))}
              placeholder="0.00"
              style={{ ...inp, paddingRight: 28, fontFamily: 'var(--font-mono)', textAlign: 'right' }}
            />
            <span style={{
              position: 'absolute', right: 10, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 12, color: 'var(--text-3)',
            }}>€</span>
          </div>
        </LabeledField>
        <LabeledField label="Fréquence" hint="Tous les combien ce coût tombe-t-il ?">
          <select
            value={draft.frequency}
            onChange={e => setDraft(d => ({ ...d, frequency: e.target.value }))}
            style={inp}
          >
            {FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Jour du mois" hint="Date prélèvement">
          <input
            type="number"
            min="1"
            max="31"
            value={draft.day_of_month}
            onChange={e => setDraft(d => ({ ...d, day_of_month: Number(e.target.value) || 1 }))}
            style={{ ...inp, textAlign: 'center' }}
          />
        </LabeledField>
      </div>

      {/* Ligne 4 : Période temporaire */}
      <div className="resp-grid-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <LabeledField label="Démarre le" hint="Laisse vide si pas de date de début">
          <input
            type="date"
            value={draft.start_date}
            onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))}
            style={inp}
          />
        </LabeledField>
        <LabeledField label="Se termine le" hint="Laisse vide si pas de date de fin">
          <input
            type="date"
            value={draft.end_date}
            onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))}
            style={inp}
          />
        </LabeledField>
        <div style={{
          display: 'flex', alignItems: 'center',
          fontSize: 12, color: (draft.start_date || draft.end_date) ? 'var(--gold-deep)' : 'var(--text-3)',
          background: (draft.start_date || draft.end_date) ? 'var(--gold-soft)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
          padding: 8,
          fontStyle: 'italic',
        }}>
          {(draft.start_date || draft.end_date)
            ? '⏱ Coût temporaire — sera retiré de la trésorerie hors de cette période'
            : '♾ Coût permanent — apparaît chaque mois indéfiniment'}
        </div>
      </div>

      {/* Boutons */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button variant="primary" onClick={onSave} disabled={!draft.label.trim() || saving}>
          {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer les modifications' : 'Enregistrer le coût')}
        </Button>
      </div>
    </div>
    </div>
  );
}

function LabeledField({ label, hint, children }) {
  return (
    <div>
      <div style={{ ...miniLabel, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, fontStyle: 'italic' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function togglePill(active) {
  return {
    padding: '8px 14px',
    border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
    background: active ? 'var(--gold-soft)' : 'var(--surface)',
    color: active ? 'var(--gold-deep)' : 'var(--text-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all var(--duration) var(--ease)',
  };
}

function PeriodCell({ cost, onUpdate }) {
  const [editing, setEditing] = useState(false);

  const fmt = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  };

  if (editing) {
    return (
      <div style={{
        position: 'absolute',
        background: 'var(--surface)',
        border: '1px solid var(--gold)',
        borderRadius: 'var(--radius-sm)',
        padding: 8,
        boxShadow: 'var(--shadow-md)',
        zIndex: 20,
        marginTop: 30,
      }}>
        <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>DÉBUT</div>
        <input
          type="date"
          value={cost.start_date || ''}
          onChange={e => onUpdate(cost.id, { start_date: e.target.value })}
          style={{ ...inp, marginBottom: 6, width: 130 }}
        />
        <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>FIN</div>
        <input
          type="date"
          value={cost.end_date || ''}
          onChange={e => onUpdate(cost.id, { end_date: e.target.value })}
          style={{ ...inp, marginBottom: 6, width: 130 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => { onUpdate(cost.id, { start_date: null, end_date: null }); setEditing(false); }}
            style={{
              flex: 1, padding: '3px 6px', fontSize: 10,
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 3, cursor: 'pointer', color: 'var(--text-3)',
            }}
          >
            Effacer
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              flex: 1, padding: '3px 6px', fontSize: 10,
              background: 'var(--gold)', border: 'none',
              borderRadius: 3, cursor: 'pointer', color: 'var(--gold-ink)', fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  const hasBounds = cost.start_date || cost.end_date;
  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        background: hasBounds ? 'var(--gold-soft)' : 'transparent',
        border: '1px solid ' + (hasBounds ? 'var(--gold)' : 'var(--border)'),
        borderRadius: 'var(--radius-sm)',
        padding: '4px 6px',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: hasBounds ? 'var(--gold-deep)' : 'var(--text-3)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      title={hasBounds ? 'Coût temporaire — clique pour modifier' : 'Permanent — clique pour limiter la période'}
    >
      {hasBounds
        ? `${fmt(cost.start_date) || '…'} → ${fmt(cost.end_date) || '…'}`
        : '♾ permanent'}
    </button>
  );
}

function Kpi({ label, value, hint, accent = 'var(--text)' }) {
  return (
    <Card>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 600, color: accent,
        fontFamily: 'var(--font-title)', lineHeight: 1,
      }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>{hint}</div>}
    </Card>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%', boxSizing: 'border-box',
};

const inp = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  color: 'var(--text)',
  background: 'var(--surface)',
};

const miniLabel = {
  fontSize: 9,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 2,
};

const modalOverlay = {
  position: 'fixed', inset: 0,
  background: 'var(--overlay)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--sp-4)',
};

const modalBox = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-md)',
  width: '100%',
  maxWidth: 640,
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: 'var(--sp-5)',
  boxShadow: 'var(--shadow-lg)',
  border: '1px solid var(--border)',
};

const iconBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  fontSize: 14,
  borderRadius: 4,
  transition: 'background var(--duration) var(--ease)',
};

const inlineInp = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  color: 'var(--text)',
  background: 'transparent',
};

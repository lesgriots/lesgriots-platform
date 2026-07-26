'use client';
/**
 * ForecastItemModal — Saisie d'un mouvement ponctuel de trésorerie.
 *
 * Cas typiques :
 *   - Sortie : achat matériel, acompte IS, TVA à reverser, salaire ponctuel,
 *     dividendes, formation, voyage, etc.
 *   - Entrée : apport personnel, subvention, aide CIR, crédit reçu, etc.
 *
 * Props :
 *   open     : bool
 *   onClose  : () => void
 *   onSaved  : () => void (callback après création)
 *   item     : existant (pour édition), null sinon
 */
import { useState, useEffect } from 'react';
import { Button, useToast, useConfirm } from '@/components/ui';

const OUT_CATEGORIES = [
  'Matériel & équipement',
  'Acompte IS / IR',
  'TVA à reverser',
  'URSSAF (acompte)',
  'Salaire ponctuel',
  'Dividendes versés',
  'Formation',
  'Voyage / déplacement',
  'Investissement',
  'Crédit (remboursement)',
  'Autre',
];

const IN_CATEGORIES = [
  'Apport personnel',
  'Subvention / aide',
  'Crédit reçu',
  'Crédit d\'impôt',
  'Cession / vente',
  'Remboursement',
  'Autre',
];

export default function ForecastItemModal({ open, onClose, onSaved, item = null }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    direction: 'out',
    amount: 0,
    expected_date: new Date().toISOString().slice(0, 10),
    category: '',
    status: 'expected',
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setDraft({
        label: item.label || '',
        direction: item.direction || 'out',
        amount: item.amount || 0,
        expected_date: item.expected_date || new Date().toISOString().slice(0, 10),
        category: item.category || '',
        status: item.status || 'expected',
        notes: item.notes || '',
      });
    } else {
      setDraft({
        label: '',
        direction: 'out',
        amount: 0,
        expected_date: new Date().toISOString().slice(0, 10),
        category: '',
        status: 'expected',
        notes: '',
      });
    }
  }, [item, open]);

  if (!open) return null;

  const save = async () => {
    if (!draft.label.trim()) {
      toast.error('Libellé requis');
      return;
    }
    setBusy(true);
    try {
      const url = item ? `/api/forecast-items/${item.id}` : '/api/forecast-items';
      const method = item ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(item ? 'Mis à jour' : 'Mouvement ajouté');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!item) return;
    if (!(await confirm({ title: 'Supprimer ce mouvement ?', confirmLabel: 'Supprimer' }))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/forecast-items/${item.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${r.status}`);
      }
      toast.success('Supprimé');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cats = draft.direction === 'in' ? IN_CATEGORIES : OUT_CATEGORIES;

  return (
    <div style={overlay} onClick={onClose}>
      <div className="resp-modal" style={modal} onClick={e => e.stopPropagation()}>
        <h3 style={{
          margin: 0, fontSize: 16, fontWeight: 500,
          fontFamily: 'var(--font-title)', color: 'var(--text)',
          marginBottom: 16,
        }}>
          {item ? '✏️ Modifier le mouvement' : '💸 Nouveau mouvement ponctuel'}
        </h3>

        {/* Direction toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, direction: 'out', category: '' }))}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: draft.direction === 'out' ? 'var(--danger-soft)' : 'var(--surface-2)',
              border: '1px solid ' + (draft.direction === 'out' ? 'var(--danger)' : 'var(--border)'),
              color: draft.direction === 'out' ? 'var(--danger)' : 'var(--text-2)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            − Sortie
          </button>
          <button
            type="button"
            onClick={() => setDraft(d => ({ ...d, direction: 'in', category: '' }))}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: draft.direction === 'in' ? 'var(--success-soft)' : 'var(--surface-2)',
              border: '1px solid ' + (draft.direction === 'in' ? 'var(--success)' : 'var(--border)'),
              color: draft.direction === 'in' ? 'var(--success)' : 'var(--text-2)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            + Entrée
          </button>
        </div>

        <Field label="Libellé">
          <input
            type="text"
            autoFocus
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder={draft.direction === 'out' ? 'Ex: Achat caméra Sony FX3' : 'Ex: Subvention CNC reçue'}
            style={inp}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Montant">
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                value={draft.amount}
                onChange={e => setDraft(d => ({ ...d, amount: Number(e.target.value) || 0 }))}
                style={{ ...inp, paddingRight: 28, fontFamily: 'var(--font-mono)', textAlign: 'right' }}
              />
              <span style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12, color: 'var(--text-3)',
              }}>€</span>
            </div>
          </Field>
          <Field label="Date prévue">
            <input
              type="date"
              value={draft.expected_date}
              onChange={e => setDraft(d => ({ ...d, expected_date: e.target.value }))}
              style={inp}
            />
          </Field>
        </div>

        <Field label="Catégorie">
          <select
            value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
            style={inp}
          >
            <option value="">— Choisir —</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Statut">
          <select
            value={draft.status}
            onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
            style={inp}
          >
            <option value="expected">Prévu (estimation)</option>
            <option value="confirmed">Confirmé (engagé / signé)</option>
            <option value="done">Réalisé (déjà encaissé/payé)</option>
            <option value="cancelled">Annulé</option>
          </select>
        </Field>

        <Field label="Notes (optionnel)">
          <textarea
            value={draft.notes}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            rows={2}
            style={{ ...inp, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
          />
        </Field>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}>
          {item ? (
            <Button variant="ghost" size="sm" onClick={del} disabled={busy}>
              🗑 Supprimer
            </Button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
            <Button variant="primary" onClick={save} disabled={busy || !draft.label.trim()}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 4,
      }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'var(--overlay)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--sp-4)',
};

const modal = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-md)',
  width: '100%',
  maxWidth: 480,
  padding: 'var(--sp-5)',
  boxShadow: 'var(--shadow-lg)',
  border: '1px solid var(--border)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const inp = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--surface)',
  fontFamily: 'var(--font-sans)',
};

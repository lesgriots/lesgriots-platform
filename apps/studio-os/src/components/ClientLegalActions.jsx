'use client';
/**
 * ClientLegalActions — Bloc d'actions juridiques sur la fiche client.
 *
 * Génère NDA et MSA FR pré-remplis. Modale légère pour préciser
 * le contexte (NDA) ou les conditions (MSA) avant génération.
 */
import { useState } from 'react';
import { Card, Button, SectionTitle, Badge, useToast } from '@/components/ui';

export default function ClientLegalActions({ client }) {
  const { toast } = useToast();
  const [modal, setModal] = useState(null); // 'nda' | 'msa' | null
  const [busy, setBusy] = useState(false);

  // Form state NDA
  const [ndaContext, setNdaContext] = useState('');
  const [ndaDuration, setNdaDuration] = useState(3);

  // Form state MSA
  const [msaScope, setMsaScope] = useState('');
  const [msaPaymentTerms, setMsaPaymentTerms] = useState('30');
  const [msaJurisdiction, setMsaJurisdiction] = useState('Paris');

  const downloadPdf = async (url, filenameHint) => {
    setBusy(true);
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = filenameHint;
      a.click();
      URL.revokeObjectURL(dlUrl);
      toast.success('Document généré');
      setModal(null);
    } catch (e) {
      toast.error(`Génération : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const generateNda = () => {
    const params = new URLSearchParams();
    if (ndaContext.trim()) params.set('context', ndaContext.trim());
    params.set('duration', String(ndaDuration));
    downloadPdf(
      `/api/clients/${client.id}/nda?${params.toString()}`,
      `NDA-${slugify(client)}.pdf`,
    );
  };

  const generateMsa = () => {
    const params = new URLSearchParams();
    if (msaScope.trim()) params.set('scope', msaScope.trim());
    params.set('payment_terms', msaPaymentTerms);
    params.set('jurisdiction', msaJurisdiction);
    downloadPdf(
      `/api/clients/${client.id}/msa?${params.toString()}`,
      `MSA-${slugify(client)}.pdf`,
    );
  };

  return (
    <Card>
      <SectionTitle
        title="Documents juridiques"
        level="h2"
        subtitle="Générateurs FR pré-remplis depuis cette fiche"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        <ActionRow
          icon="🤝"
          title="NDA — Confidentialité"
          subtitle="Accord de confidentialité réciproque"
          badge="3 ans"
          onClick={() => setModal('nda')}
          disabled={busy}
        />
        <ActionRow
          icon="📄"
          title="MSA — Contrat-cadre"
          subtitle="Conditions générales de prestation"
          badge="Cession CPI"
          onClick={() => setModal('msa')}
          disabled={busy}
        />
      </div>

      {/* Modal NDA */}
      {modal === 'nda' && (
        <Modal onClose={() => setModal(null)} title="Générer un NDA">
          <Field label="Contexte de l'échange (optionnel)">
            <input
              type="text"
              value={ndaContext}
              onChange={e => setNdaContext(e.target.value)}
              placeholder="ex : discussions autour du projet documentaire X"
              style={inputStyle}
            />
          </Field>
          <Field label="Durée de confidentialité (années)">
            <select
              value={ndaDuration}
              onChange={e => setNdaDuration(parseInt(e.target.value, 10))}
              style={inputStyle}
            >
              {[1, 2, 3, 5, 7, 10].map(n => (
                <option key={n} value={n}>{n} an{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </Field>
          <div style={modalFooter}>
            <Button variant="ghost" onClick={() => setModal(null)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="primary" onClick={generateNda} disabled={busy}>
              {busy ? 'Génération…' : 'Générer le PDF'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal MSA */}
      {modal === 'msa' && (
        <Modal onClose={() => setModal(null)} title="Générer un MSA">
          <Field label="Périmètre des prestations (optionnel)">
            <textarea
              value={msaScope}
              onChange={e => setMsaScope(e.target.value)}
              placeholder="ex : direction artistique, production audiovisuelle, conseil éditorial"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </Field>
          <Field label="Délai de paiement (jours, après émission facture)">
            <select
              value={msaPaymentTerms}
              onChange={e => setMsaPaymentTerms(e.target.value)}
              style={inputStyle}
            >
              <option value="30">30 jours (standard B2B)</option>
              <option value="45">45 jours</option>
              <option value="60">60 jours (maximum légal)</option>
              <option value="15">15 jours</option>
              <option value="0">À réception</option>
            </select>
          </Field>
          <Field label="Juridiction compétente">
            <input
              type="text"
              value={msaJurisdiction}
              onChange={e => setMsaJurisdiction(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={modalFooter}>
            <Button variant="ghost" onClick={() => setModal(null)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="primary" onClick={generateMsa} disabled={busy}>
              {busy ? 'Génération…' : 'Générer le PDF'}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function ActionRow({ icon, title, subtitle, badge, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
        width: '100%',
        transition: 'all var(--duration) var(--ease)',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--gold-soft)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {badge && <Badge tone="neutral" size="sm">{badge}</Badge>}
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-4)',
      }}
      onClick={onClose}
    >
      <div
        className="resp-modal"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          maxWidth: 480,
          padding: 'var(--sp-5)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{
          margin: 0, fontSize: 16, fontWeight: 500,
          fontFamily: 'var(--font-title)', color: 'var(--text)',
          marginBottom: 12,
        }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 4,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function slugify(client) {
  const base = client.company || `${client.firstName || ''}-${client.lastName || ''}`;
  return (base || 'client')
    .toString()
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--surface)',
  fontFamily: 'var(--font-sans)',
};

const modalFooter = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 16,
  paddingTop: 12,
  borderTop: '1px solid var(--border)',
};

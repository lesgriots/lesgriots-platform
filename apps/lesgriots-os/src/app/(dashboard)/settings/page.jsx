'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useToast } from '@/components/ui';

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/data').then(r => r.json()),
    ]).then(([s, d]) => {
      setSettings(s || {});
      const projects = d.projects || [];
      const providers = d.providers || [];
      setStats({
        totalProjects: projects.length,
        activeProjects: projects.filter(p => !['paid', 'lost'].includes(p.stage)).length,
        totalProviders: providers.length,
        totalTasks: (d.tasks || []).length,
      });
      setLoading(false);
    }).catch((e) => { console.warn('[Réglages] Chargement échoué :', e); setLoading(false); });
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Erreur ${r.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Réglages enregistrés');
    } catch (e) {
      console.warn('[Réglages] Sauvegarde échouée :', e);
      toast.error(`Réglages non enregistrés : ${e.message || 'erreur réseau'}`);
    }
    setSaving(false);
  };

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <>
        <TopBar title="Réglages" />
        <div style={{ padding: 32, color: 'var(--text-3)' }}>Chargement...</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Réglages" subtitle="Configuration de LES GRIOTS OS" />
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>

        {/* Stats summary */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Projets', value: stats.totalProjects, sub: `${stats.activeProjects} actifs` },
              { label: 'Prestataires', value: stats.totalProviders },
              { label: 'Tâches', value: stats.totalTasks },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '14px 20px', flex: 1, minWidth: 140,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-title)' }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Company info */}
        <Section title="ENTREPRISE">
          <Field label="Raison sociale" value={settings.company_name} onChange={v => update('company_name', v)} />
          <Field label="SIRET" value={settings.siret} onChange={v => update('siret', v)} />
          <Field label="N° Déclaration d'activité (NDA)" value={settings.nda} onChange={v => update('nda', v)} />
          <Field label="TVA Intracommunautaire" value={settings.tva_intra} onChange={v => update('tva_intra', v)} />
        </Section>

        <Section title="ADRESSE">
          <Field label="Adresse" value={settings.address} onChange={v => update('address', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <Field label="Code postal" value={settings.postal_code} onChange={v => update('postal_code', v)} />
            <Field label="Ville" value={settings.city} onChange={v => update('city', v)} />
          </div>
        </Section>

        <Section title="CONTACT">
          <Field label="Email" value={settings.email} onChange={v => update('email', v)} type="email" />
          <Field label="Téléphone" value={settings.phone} onChange={v => update('phone', v)} />
          <Field label="Site web" value={settings.website} onChange={v => update('website', v)} />
        </Section>

        <Section title="BANQUE">
          <Field label="IBAN" value={settings.iban} onChange={v => update('iban', v)} />
          <Field label="BIC" value={settings.bic} onChange={v => update('bic', v)} />
          <Field label="Banque" value={settings.bank_name} onChange={v => update('bank_name', v)} />
        </Section>

        {/* Save */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={save} disabled={saving} style={{
            padding: '10px 28px', borderRadius: 'var(--radius-md)',
            background: 'var(--gold)', color: 'var(--gold-ink)', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity var(--duration) var(--ease)',
          }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
              Enregistré
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
          fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

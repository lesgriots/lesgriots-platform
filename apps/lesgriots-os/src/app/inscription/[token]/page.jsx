'use client';

import { useEffect, useState } from 'react';

const colors = {
  ink: '#171411', paper: '#f6f5f3', surface: '#ffffff', line: '#ddd9d2', gold: '#f5ce16', goldInk: '#262006', muted: '#6e6a63', success: '#18854b', error: '#b5322c',
};

function dateFr(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function InscriptionSessionPage({ params }) {
  const [token, setToken] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', consent: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await Promise.resolve(params);
      const value = resolved?.token || '';
      if (cancelled) return;
      setToken(value);
      const response = await fetch(`/api/public/inscription/${encodeURIComponent(value)}`);
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) setError(payload.error || 'Ce formulaire est indisponible.');
      else setSession(payload.session);
      setLoading(false);
    })().catch(() => { if (!cancelled) { setError('Impossible de charger ce formulaire.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [params]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/public/inscription/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Inscription impossible.');
      setConfirmation(payload);
    } catch (submitError) { setError(submitError.message || 'Inscription impossible.'); }
    finally { setSubmitting(false); }
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', border: `1px solid ${colors.line}`, borderRadius: 9, color: colors.ink, background: colors.surface, font: 'inherit' };
  return <main style={{ minHeight: '100vh', background: colors.paper, color: colors.ink, fontFamily: 'Arial, Helvetica, sans-serif', padding: '28px 16px 56px' }}>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <header style={{ paddingBottom: 22, borderBottom: `1px solid ${colors.line}`, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', fontWeight: 800, color: colors.muted }}>LA GRIOTHÈQUE · ORGANISME DE FORMATION</div>
        <h1 style={{ fontSize: 'clamp(27px, 5vw, 42px)', letterSpacing: '-.05em', margin: '12px 0 6px' }}>Inscription à une session</h1>
        <p style={{ margin: 0, color: colors.muted, lineHeight: 1.5 }}>Complétez vos coordonnées pour demander votre inscription.</p>
      </header>
      {loading && <div style={{ color: colors.muted }}>Chargement du formulaire…</div>}
      {!loading && error && !session && <div role="alert" style={{ padding: 16, background: '#fff0ee', border: '1px solid #edb1ab', color: colors.error, borderRadius: 12 }}>{error}</div>}
      {!loading && session && <>
        <section style={{ background: '#fff9df', border: `1px solid ${colors.gold}`, borderRadius: 13, padding: 18, marginBottom: 18 }}>
          <div style={{ color: colors.muted, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Session concernée</div>
          <h2 style={{ margin: '7px 0', fontSize: 22, letterSpacing: '-.03em' }}>{session.title}</h2>
          <div style={{ color: colors.muted, fontSize: 14, lineHeight: 1.55 }}>{dateFr(session.startDate)}{session.endDate && session.endDate !== session.startDate ? ` — ${dateFr(session.endDate)}` : ''}{session.location ? ` · ${session.location}` : ''}{session.modality ? ` · ${session.modality}` : ''}</div>
          {session.seatsRemaining !== null && <div style={{ marginTop: 9, color: colors.ink, fontSize: 13, fontWeight: 700 }}>{session.seatsRemaining > 0 ? `${session.seatsRemaining} place${session.seatsRemaining > 1 ? 's' : ''} restante${session.seatsRemaining > 1 ? 's' : ''}` : 'Session complète'}</div>}
        </section>
        {confirmation ? <section style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 13, padding: 24 }}>
          <div style={{ color: colors.success, fontWeight: 800, fontSize: 18 }}>✓ {confirmation.alreadyRegistered ? 'Inscription déjà enregistrée' : 'Inscription enregistrée'}</div>
          <p style={{ lineHeight: 1.6, marginBottom: 0 }}>Merci {confirmation.learner.firstName}. L’organisme vous transmettra les informations et questionnaires utiles à votre parcours. Aucun e-mail n’est envoyé automatiquement depuis ce formulaire.</p>
        </section> : <form onSubmit={submit} style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 13, padding: 22, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label>Prénom *<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
            <label>Nom *<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
          </div>
          <label>E-mail *<input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label>Téléphone<input autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
            <label>Entreprise<input autoComplete="organization" value={form.company} onChange={(event) => update('company', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'start', color: colors.muted, fontSize: 13, lineHeight: 1.45 }}><input required type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} style={{ marginTop: 3 }} />J’accepte que La Griothèque utilise ces informations pour traiter ma demande d’inscription.</label>
          {error && <div role="alert" style={{ color: colors.error, fontSize: 14 }}>{error}</div>}
          <button disabled={submitting} type="submit" style={{ border: 0, borderRadius: 9, padding: '13px 16px', background: colors.gold, color: colors.goldInk, fontWeight: 800, fontSize: 15, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? .65 : 1 }}>{submitting ? 'Inscription en cours…' : 'Envoyer mon inscription'}</button>
        </form>}
      </>}
    </div>
  </main>;
}

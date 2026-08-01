'use client';

import { useEffect, useState } from 'react';

const colors = {
  // Les jetons de la maison, thème papier. L'or est le #FFCA00 de la marque,
  // pas le #F5CE16 d'une ancienne itération qui traînait sur les pages
  // publiques : c'est la première chose qu'un candidat voit de vous.
  ink: '#141310', paper: '#f6f5f3', surface: '#ffffff', line: 'rgba(0,0,0,.14)',
  surface2: '#eeebe6', gold: '#FFCA00', goldInk: '#171407', muted: '#6f6b60',
  texte2: '#3a3831', success: '#1E8449', error: '#B83328',
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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', consent: false });
  // Les questions propres au programme, et les réponses qu'on y apporte.
  const [champs, setChamps] = useState([]);
  const [suite, setSuite] = useState(null);
  const [reponses, setReponses] = useState({});

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
      else {
        setSession(payload.session);
        setChamps((payload.champs || []).filter((c) => !c.socle));
        setSuite(payload.suite || null);
      }
      setLoading(false);
    })().catch(() => { if (!cancelled) { setError('Impossible de charger ce formulaire.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [params]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/public/inscription/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, reponses }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Inscription impossible.');
      setConfirmation(payload);
    } catch (submitError) { setError(submitError.message || 'Inscription impossible.'); }
    finally { setSubmitting(false); }
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '12px 13px', border: `1px solid ${colors.line}`, borderRadius: 9, color: colors.ink, background: colors.surface, font: 'inherit' };
  return <><link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <main style={{ minHeight: '100vh', background: colors.paper, color: colors.ink, fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: '28px 16px 56px' }}>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <header style={{ paddingBottom: 24, borderBottom: `1px solid ${colors.line}`, marginBottom: 26 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/griotheque-wordmark-ink.svg" alt="LA GRIOTHÈQUE"
          style={{ display: 'block', width: 176, maxWidth: '58%', height: 'auto' }} />
        <div style={{
          marginTop: 10, fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
          letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, fontWeight: 600,
        }}>Organisme de formation</div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: '-.035em', fontWeight: 600,
          lineHeight: 1.08, margin: '20px 0 8px',
        }}>Demande d’inscription</h1>
        <p style={{ margin: 0, color: colors.muted, lineHeight: 1.6, maxWidth: '58ch' }}>
          Quelques minutes pour nous dire d’où vous partez. Nous revenons vers vous pour valider
          votre place.
        </p>
      </header>
      {loading && <div style={{ color: colors.muted }}>Chargement du formulaire…</div>}
      {!loading && error && !session && <div role="alert" style={{ padding: 16, background: '#fff0ee', border: '1px solid #edb1ab', color: colors.error, borderRadius: 12 }}>{error}</div>}
      {!loading && session && <>
        <section style={{ background: colors.ink, color: colors.paper, borderRadius: 13, padding: '20px 22px', marginBottom: 18 }}>
          <div style={{
            fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, fontWeight: 600,
            letterSpacing: '.16em', textTransform: 'uppercase', opacity: .62,
          }}>Session concernée</div>
          <h2 style={{ margin: '9px 0 7px', fontSize: 21, letterSpacing: '-.03em', fontWeight: 600, lineHeight: 1.25 }}>{session.title}</h2>
          <div style={{ color: 'rgba(246,245,243,.72)', fontSize: 14, lineHeight: 1.55 }}>{dateFr(session.startDate)}{session.endDate && session.endDate !== session.startDate ? ` — ${dateFr(session.endDate)}` : ''}{session.location ? ` · ${session.location}` : ''}{session.modality ? ` · ${session.modality}` : ''}</div>
          {session.seatsRemaining !== null && <div style={{ marginTop: 11, color: colors.gold, fontSize: 13, fontWeight: 700 }}>{session.seatsRemaining > 0 ? `${session.seatsRemaining} place${session.seatsRemaining > 1 ? 's' : ''} restante${session.seatsRemaining > 1 ? 's' : ''}` : 'Session complète'}</div>}
        </section>
        {confirmation ? <section style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 13, padding: 24 }}>
          <div style={{ color: colors.success, fontWeight: 800, fontSize: 18 }}>✓ {confirmation.alreadyRegistered ? 'Inscription déjà enregistrée' : 'Inscription enregistrée'}</div>
          <p style={{ lineHeight: 1.6 }}>Merci {confirmation.learner.firstName}. {(confirmation.suite || suite)?.message}</p>
          {(confirmation.suite || suite)?.lienRdv && <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${colors.line}` }}>
            <p style={{ margin: '0 0 12px', color: colors.muted, lineHeight: 1.55 }}>{(confirmation.suite || suite).texteRdv}</p>
            <a href={(confirmation.suite || suite).lienRdv} target="_blank" rel="noreferrer" style={{ display: 'inline-block', border: 0, borderRadius: 9, padding: '13px 18px', background: colors.ink, color: colors.paper, fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{(confirmation.suite || suite).libelleRdv}</a>
          </div>}
        </section> : <form onSubmit={submit} style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 13, padding: 22, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label>Prénom *<input required autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
            <label>Nom *<input required autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
          </div>
          <label>E-mail *<input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} style={{ ...input, marginTop: 6 }} /></label>
          {champs.map((champ) => {
            const valeur = reponses[champ.cle] ?? (champ.type === 'case' ? false : '');
            const poser = (v) => setReponses((c) => ({ ...c, [champ.cle]: v }));
            const etiquette = `${champ.libelle}${champ.obligatoire ? ' *' : ''}`;
            if (champ.type === 'case') {
              return <label key={champ.cle} style={{ display: 'flex', gap: 10, alignItems: 'start', fontSize: 14, lineHeight: 1.45 }}>
                <input type="checkbox" required={champ.obligatoire} checked={Boolean(valeur)} onChange={(e) => poser(e.target.checked)} style={{ marginTop: 4 }} />
                <span>{etiquette}{champ.aide && <span style={{ display: 'block', color: colors.muted, fontSize: 13 }}>{champ.aide}</span>}</span>
              </label>;
            }
            return <label key={champ.cle}>{etiquette}
              {champ.aide && <span style={{ display: 'block', color: colors.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>{champ.aide}</span>}
              {champ.type === 'liste'
                ? <select required={champ.obligatoire} value={valeur} onChange={(e) => poser(e.target.value)} style={{ ...input, marginTop: 6 }}>
                    <option value="">Choisir…</option>
                    {(champ.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                : champ.type === 'zone'
                  ? <textarea required={champ.obligatoire} rows={3} value={valeur} onChange={(e) => poser(e.target.value)} style={{ ...input, marginTop: 6, resize: 'vertical' }} />
                  : <input
                      required={champ.obligatoire}
                      type={champ.type === 'email' ? 'email' : champ.type === 'tel' ? 'tel' : 'text'}
                      autoComplete={champ.cle === 'phone' ? 'tel' : champ.cle === 'company' ? 'organization' : 'off'}
                      value={valeur}
                      onChange={(e) => poser(e.target.value)}
                      style={{ ...input, marginTop: 6 }}
                    />}
            </label>;
          })}
          <label style={{ display: 'flex', gap: 10, alignItems: 'start', color: colors.muted, fontSize: 13, lineHeight: 1.45 }}><input required type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} style={{ marginTop: 3 }} />J’accepte que La Griothèque utilise ces informations pour traiter ma demande d’inscription.</label>
          {error && <div role="alert" style={{ color: colors.error, fontSize: 14 }}>{error}</div>}
          <button disabled={submitting} type="submit" style={{ border: 0, borderRadius: 9, padding: '13px 16px', background: colors.ink, color: colors.paper, fontWeight: 700, fontSize: 15, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? .65 : 1 }}>{submitting ? 'Inscription en cours…' : 'Envoyer mon inscription'}</button>
        </form>}
      </>}
    </div>
  </main></>;
}

'use client';

/**
 * /emails — écrire aux inscrits, et voir ce qui est parti.
 *
 * Le moteur d'envoi et les cinq modèles existaient ; il manquait l'écran qui
 * relie un modèle à des destinataires réels. Trois temps : on choisit, on lit
 * l'aperçu exact, on envoie. Le journal en dessous garde la trace.
 *
 * Le bandeau du haut ne ment pas sur le mode : tant qu'aucune boîte d'envoi
 * n'est configurée, rien ne part et tout est écrit « simulé ».
 */

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};
const th = { ...mono, fontWeight: 400, textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '10px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 };
const champ = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-2)', background: 'var(--surface)',
  color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5,
};

const STATUTS = { envoye: 'Envoyé', simule: 'Simulé', echec: 'Échec' };

const quand = (d) => d
  ? new Date(d.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function EmailsPage() {
  const [conf, setConf] = useState(null);
  const [journal, setJournal] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');
  const [modele, setModele] = useState('');
  const [detail, setDetail] = useState(null);
  const [exclus, setExclus] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState('');

  const chargerJournal = useCallback(async () => {
    const j = await fetch('/api/emails').then((r) => r.json()).catch(() => null);
    setJournal(j);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/griotheque/emails').then((r) => r.json()).catch(() => null),
      fetch('/api/sessions').then((r) => r.json()).catch(() => []),
    ]).then(([c, s]) => {
      setConf(c);
      setSessions((Array.isArray(s) ? s : []).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')));
    });
    chargerJournal();
  }, [chargerJournal]);

  useEffect(() => {
    if (!session || !modele) { setDetail(null); return; }
    setResultat('');
    fetch(`/api/griotheque/emails?session_id=${session}&template_key=${modele}`)
      .then((r) => r.json()).then(setDetail).catch(() => setDetail(null));
  }, [session, modele]);

  const envoyer = async () => {
    setEnvoi(true); setResultat('');
    const cibles = (detail?.destinataires || []).filter((d) => d.joignable && !exclus.includes(d.id)).map((d) => d.id);
    const r = await fetch('/api/griotheque/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session, template_key: modele, apprenant_ids: cibles }),
    });
    const j = await r.json();
    setResultat(r.ok
      ? `${j.envoyes} message(s) ${j.mode === 'reel' ? 'envoyé(s)' : 'simulé(s)'}${j.ignores ? `, ${j.ignores} sans adresse` : ''}.`
      : (j.error || 'Envoi impossible.'));
    setEnvoi(false);
    chargerJournal();
  };

  const joignables = (detail?.destinataires || []).filter((d) => d.joignable && !exclus.includes(d.id)).length;
  const simulation = conf?.mode === 'simulation';

  return (
    <>
      <TopBar
        title="Emails"
        subtitle={journal ? `${journal.stats.total || 0} message(s) au journal` : ''}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>

        {!conf && <Skeleton />}

        {conf && (
          <>
            {simulation && (
              <Card style={{ borderColor: 'var(--gold)' }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Mode simulation</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  Aucune boîte d’envoi n’est configurée : rien ne part réellement, mais tout est
                  écrit au journal à l’identique. Le jour où les identifiants SMTP sont déposés
                  sur le serveur, les mêmes envois partent pour de vrai, sans changer une ligne.
                </div>
              </Card>
            )}

            {/* ── Écrire ── */}
            <Card>
              <div style={{ ...mono, marginBottom: 12 }}>Écrire aux inscrits</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 11 }}>
                <label>
                  <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Session</span>
                  <select value={session} onChange={(e) => { setSession(e.target.value); setExclus([]); }} style={champ}>
                    <option value="">Choisir…</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {(s.session_name || s.id.slice(0, 8))}{s.start_date ? ` · ${s.start_date}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Modèle</span>
                  <select value={modele} onChange={(e) => setModele(e.target.value)} style={champ}>
                    <option value="">Choisir…</option>
                    {conf.modeles.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>
              </div>

              {modele && (
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '9px 0 0' }}>
                  {conf.modeles.find((m) => m.key === modele)?.description}
                </p>
              )}

              {detail?.destinataires && (
                <>
                  <div style={{ ...mono, margin: '16px 0 7px' }}>
                    Destinataires · {joignables} sur {detail.destinataires.length}
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {detail.destinataires.map((d) => {
                      const off = !d.joignable || exclus.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => d.joignable && setExclus((x) => x.includes(d.id) ? x.filter((y) => y !== d.id) : [...x, d.id])}
                          title={d.joignable ? d.email : 'Aucune adresse email sur cette fiche'}
                          style={{
                            padding: '5px 11px', borderRadius: 20, cursor: d.joignable ? 'pointer' : 'not-allowed',
                            border: '1px solid ' + (off ? 'var(--border)' : 'var(--text)'),
                            background: off ? 'transparent' : 'var(--text)',
                            color: off ? 'var(--text-3)' : 'var(--surface)',
                            fontFamily: 'inherit', fontSize: 11.5,
                            textDecoration: d.joignable ? 'none' : 'line-through',
                          }}
                        >{d.nom}</button>
                      );
                    })}
                  </div>
                </>
              )}

              {detail?.apercu && (
                <>
                  <div style={{ ...mono, margin: '16px 0 7px' }}>Aperçu</div>
                  <div style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 9, padding: 14,
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{detail.apercu.objet}</div>
                    <pre style={{
                      margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                      fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65,
                    }}>{detail.apercu.corps}</pre>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 7 }}>
                    Expéditeur : {conf.expediteur}
                  </div>
                </>
              )}

              {detail && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={envoyer}
                    disabled={envoi || !joignables}
                    style={{
                      padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: 'var(--gold)', color: '#141310', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      opacity: envoi || !joignables ? 0.45 : 1,
                    }}
                  >
                    {envoi ? 'Envoi…' : simulation ? `Simuler l’envoi à ${joignables}` : `Envoyer à ${joignables}`}
                  </button>
                  {resultat && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{resultat}</span>}
                </div>
              )}
            </Card>

            {/* ── Journal ── */}
            <Card padding="none">
              <div style={{ padding: '16px 16px 8px' }}>
                <div style={{ fontWeight: 500 }}>Journal des envois</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {journal
                    ? `${journal.stats.envoyes || 0} envoyé(s) · ${journal.stats.simules || 0} simulé(s) · ${journal.stats.echecs || 0} échec(s)`
                    : ''}
                </div>
              </div>
              {!journal?.items?.length ? (
                <div style={{ padding: 16 }}>
                  <EmptyState title="Journal vide" message="Aucun message n’a encore été composé." />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Quand', 'Destinataire', 'Objet', 'Modèle', 'Statut'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {journal.items.map((e) => (
                      <tr key={e.id}>
                        <td style={{ ...td, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{quand(e.created_at)}</td>
                        <td style={td}>{e.destinataire_nom || e.destinataire}</td>
                        <td style={{ ...td, color: 'var(--text-2)' }}>{e.objet}</td>
                        <td style={{ ...td, ...mono, fontSize: 9.5 }}>{e.template_key || '—'}</td>
                        <td style={{ ...td, ...mono, fontSize: 9.5, color: e.statut === 'echec' ? 'var(--danger)' : 'var(--text-3)' }}>
                          {STATUTS[e.statut] || e.statut}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

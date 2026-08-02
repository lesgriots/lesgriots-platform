'use client';

/**
 * /espace-apprenant — les liens personnels à distribuer.
 *
 * Un lien par inscription. On le copie, on l'envoie ; l'apprenant y émarge,
 * répond aux questionnaires et récupère ses documents. Pas de compte à créer,
 * pas de mot de passe à perdre.
 *
 * Les deux colonnes de droite disent l'essentiel : ce que l'apprenant a
 * réellement fait. Ce sont les preuves qui manquent au dossier d'audit.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};
const th = { ...mono, fontWeight: 400, textAlign: 'left', padding: '11px 10px', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '11px 10px', borderBottom: '1px solid var(--border)', fontSize: 13.5 };

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

export default function EspaceApprenantPage() {
  const [d, setD] = useState(null);
  const [copie, setCopie] = useState(null);
  const [q, setQ] = useState('');
  const [base, setBase] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { setBase(window.location.origin); }, []);

  const charger = useCallback(async () => {
    const r = await fetch('/api/griotheque/espace').then((x) => x.json()).catch(() => null);
    setD(r);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  /*
   * Émettre un lien pouvait échouer sans rien dire : on cliquait, la page se
   * rechargeait à l'identique, la colonne restait vide, et on recliquait. Le
   * refus du serveur est maintenant affiché, et l'émission en lot compte ce
   * qui est réellement passé.
   */
  const poster = async (corps) => {
    const r = await fetch('/api/griotheque/espace', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    if (!r.ok) {
      const d2 = await r.json().catch(() => ({}));
      throw new Error(d2.error || `erreur ${r.status}`);
    }
  };

  const emettre = async (session_id, apprenant_id) => {
    setNotice('');
    try { await poster({ session_id, apprenant_id }); charger(); }
    catch (e) { setNotice(`Lien non émis : ${e.message}`); }
  };

  const emettreTout = async () => {
    const sessions = [...new Set((d?.inscriptions || []).filter((i) => !i.token).map((i) => i.session_id))];
    setNotice('');
    let faits = 0;
    const rates = [];
    for (const s of sessions) {
      try { await poster({ session_id: s }); faits += 1; }
      catch (e) { rates.push(e.message); }
    }
    charger();
    if (rates.length) {
      setNotice(`${faits} session(s) servie(s), ${rates.length} en échec : ${rates[0]}`);
    }
  };

  const copier = (i) => {
    navigator.clipboard?.writeText(`${base}/p/${i.token}`);
    setCopie(i.token);
    setTimeout(() => setCopie(null), 2200);
  };

  const visibles = useMemo(() => {
    const liste = d?.inscriptions || [];
    const t = q.trim().toLowerCase();
    if (!t) return liste;
    return liste.filter((i) => (i.apprenant + ' ' + i.session).toLowerCase().includes(t));
  }, [d, q]);

  return (
    <>
      <TopBar
        title="Espace apprenant"
        subtitle={d ? `${d.avec_lien} lien(s) sur ${d.total} inscription(s)` : ''}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {notice && (
          <div role="alert" style={{
            margin: '0 0 14px', padding: '11px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger-soft)', color: 'var(--text)',
            border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
            fontSize: 12.5, fontWeight: 600,
          }}>{notice}</div>
        )}

        {!d && <Skeleton />}

        {d && (
          <>
            <Card>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                Chaque apprenant reçoit un lien personnel. Il y trouve sa session, son programme,
                ses documents, et il y fait ce qu’on attend de lui : émarger, répondre au
                positionnement, à l’enquête de fin et à celle à froid. Aucun compte à créer.
              </div>
              {d.total > d.avec_lien && (
                <button onClick={emettreTout} style={{
                  marginTop: 12, padding: '9px 16px', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--gold)', color: '#141310',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>
                  Créer les {d.total - d.avec_lien} lien(s) manquant(s)
                </button>
              )}
            </Card>

            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un apprenant ou une session…"
              style={{
                width: '100%', maxWidth: 420, padding: '10px 13px',
                border: '1px solid var(--border-2)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
              }}
            />

            {visibles.length === 0 ? (
              <EmptyState title="Aucune inscription" message="Les liens apparaîtront dès qu’un apprenant est inscrit à une session." />
            ) : (
              <Card padding="none">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Apprenant</th>
                      <th style={th}>Session</th>
                      <th style={th}>Début</th>
                      <th style={th}>Émargé</th>
                      <th style={th}>Évalué</th>
                      <th style={{ ...th, textAlign: 'right' }}>Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((i) => (
                      <tr key={i.session_id + i.apprenant_id}>
                        <td style={{ ...td, fontWeight: 500 }}>{i.apprenant}</td>
                        <td style={{ ...td, color: 'var(--text-3)' }}>{i.session}</td>
                        <td style={{ ...td, color: 'var(--text-3)' }}>{dateFr(i.debut)}</td>
                        <td style={{ ...td, color: i.signatures ? 'inherit' : 'var(--text-3)' }}>
                          {i.signatures || '—'}
                        </td>
                        <td style={{ ...td, color: i.evaluations ? 'inherit' : 'var(--text-3)' }}>
                          {i.evaluations || '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {i.token ? (
                            <button onClick={() => copier(i)} style={{
                              padding: '5px 11px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-2)', background: 'var(--surface)',
                              color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
                            }}>{copie === i.token ? 'Copié' : 'Copier le lien'}</button>
                          ) : (
                            <button onClick={() => emettre(i.session_id, i.apprenant_id)} style={{
                              padding: '5px 11px', borderRadius: 'var(--radius-sm)', border: 'none',
                              background: 'var(--gold)', color: '#141310',
                              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                            }}>Créer</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

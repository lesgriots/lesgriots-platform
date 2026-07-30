'use client';

/**
 * /financeurs — qui paie les formations.
 *
 * Rien n'est saisi deux fois : la page lit ce qui existe déjà sur les
 * inscriptions et les fiches apprenants, et regroupe les variantes d'écriture
 * d'un même dispositif. Un montant n'apparaît que s'il a été facturé.
 */

import { Fragment, useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import Link from 'next/link';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const cellule = { padding: '12px', borderBottom: '1px solid var(--border)', fontSize: 13 };
const entete = {
  textAlign: 'left', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-3)', fontWeight: 500, padding: '13px 12px', borderBottom: '1px solid var(--border)',
};

export default function FinanceursPage() {
  const [data, setData] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/griotheque/financeurs')
      .then((r) => r.json())
      .then((d) => (d.error ? setErreur(d.error) : setData(d)))
      .catch(() => setErreur('Chargement impossible.'));
  }, []);

  const [carnet, setCarnet] = useState([]);
  const [nouveau, setNouveau] = useState('');
  const [occupe, setOccupe] = useState(false);

  const chargerCarnet = () => fetch('/api/financeurs')
    .then((r) => r.ok ? r.json() : [])
    .then((d) => setCarnet(Array.isArray(d) ? d.filter((f) => f.actif !== 0) : []))
    .catch(() => {});

  useEffect(() => { chargerCarnet(); }, []);

  /** Créer une fiche pour un organisme avec lequel on traite vraiment. */
  const creer = async (nom) => {
    const propre = String(nom || '').trim();
    if (!propre) return;
    setOccupe(true);
    try {
      const r = await fetch('/api/financeurs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: propre }),
      });
      if (r.ok) { setNouveau(''); await chargerCarnet(); }
    } finally { setOccupe(false); }
  };

  const total = data?.familles?.reduce((t, f) => t + f.montant, 0) || 0;

  return (
    <>
      <TopBar
        title="Financeurs"
        subtitle={data ? `${data.organismes.length} organisme(s) identifié(s) · ${euros(data.total_pris_en_charge)} pris en charge` : ''}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{erreur}</p></Card>}
        {!data && !erreur && <Skeleton />}

        {/* ── Le carnet : la procédure de chaque organisme, tenue une fois ── */}
        <Card padding="none">
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontWeight: 500 }}>Carnet des financeurs</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>
              Le tableau ci-dessous dit combien chaque dispositif a payé. Le carnet dit comment déposer un dossier chez eux : portail, identifiant, pièces exigées, délai, subrogation.
            </div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') creer(nouveau); }}
              placeholder="Nom d’un financeur, par exemple AFDAS"
              style={{ padding: '10px 12px', border: '1.5px solid var(--border-2)', borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13, minWidth: 260 }}
            />
            <button type="button" disabled={!nouveau.trim() || occupe} onClick={() => creer(nouveau)} style={{
              padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
              cursor: (!nouveau.trim() || occupe) ? 'not-allowed' : 'pointer', opacity: (!nouveau.trim() || occupe) ? .45 : 1,
              background: 'var(--gold)', color: 'var(--gold-ink)', border: '1.5px solid var(--gold)',
            }}>Créer la fiche</button>
          </div>
          {/* Les organismes déjà cités sur les fiches apprenants : un clic suffit. */}
          {data?.organismes?.filter((o) => !carnet.some((f) => f.nom.toLowerCase() === String(o.nom || o.label || '').toLowerCase())).length > 0 && (
            <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Déjà cités sur tes dossiers :</span>
              {data.organismes
                .filter((o) => !carnet.some((f) => f.nom.toLowerCase() === String(o.nom || o.label || '').toLowerCase()))
                .map((o) => {
                  const nom = o.nom || o.label || '';
                  return <button key={nom} type="button" disabled={occupe} onClick={() => creer(nom)} style={{
                    padding: '7px 11px', borderRadius: 9, border: '1.5px solid var(--border-2)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: 12, fontWeight: 800, cursor: occupe ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}>+ {nom}</button>;
                })}
            </div>
          )}
          {carnet.length ? <div style={{ padding: '0 16px 16px', display: 'grid', gap: 8 }}>
            {carnet.map((f) => <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
              <div>
                <b style={{ fontSize: 13 }}>{f.nom}</b>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {f.type || 'Type à définir'}{f.delai_depot ? ` · dépôt ${f.delai_depot}` : ''}{f.subrogation ? ` · ${f.subrogation.startsWith('Oui') ? 'subrogation' : 'sans subrogation'}` : ''}
                </div>
              </div>
              <Link href={`/financeurs/${f.id}`} style={{ padding: '7px 11px', borderRadius: 9, border: '1.5px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ouvrir la fiche →</Link>
            </div>)}
          </div> : <div style={{ padding: '0 16px 18px', fontSize: 12.5, color: 'var(--text-3)' }}>
            Aucune fiche pour l’instant. Commence par ceux avec qui tu traites réellement : ce sont eux dont tu cherches le portail à chaque dossier.
          </div>}
        </Card>

        {data && (
          <>
            {/* Organismes nommés */}
            <Card padding="none">
              <div style={{ padding: '16px 16px 0' }}>
                <div style={{ fontWeight: 500 }}>Organismes financeurs</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>
                  Renseignés sur les fiches apprenants. Clique une ligne pour voir qui est rattaché.
                </div>
              </div>

              {data.organismes.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyState
                    title="Aucun organisme nommé"
                    message="Les fiches apprenants ne portent pas encore de nom d’OPCO ou de FAF."
                  />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Organisme', 'Type', 'Apprenants', 'Montant facturé'].map((h) => (
                        <th key={h} style={entete}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.organismes.map((o) => (
                      <Fragment key={o.type + o.nom}>
                        <tr
                          onClick={() => setOuvert(ouvert === o.type + o.nom ? null : o.type + o.nom)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ ...cellule, fontWeight: 500 }}>{o.nom}</td>
                          <td style={{ ...cellule, color: 'var(--text-3)' }}>{o.type}</td>
                          <td style={cellule}>{o.nb}</td>
                          <td style={{ ...cellule, fontVariantNumeric: 'tabular-nums' }}>
                            {o.montant ? euros(o.montant) : '—'}
                          </td>
                        </tr>
                        {ouvert === o.type + o.nom && (
                          <tr>
                            <td colSpan={4} style={{ ...cellule, background: 'var(--surface-2)' }}>
                              {o.apprenants.map((a) => (
                                <div key={a.id} style={{ fontSize: 12.5, padding: '3px 0' }}>
                                  {a.nom}
                                  {a.entreprise && (
                                    <span style={{ color: 'var(--text-3)' }}> · {a.entreprise}</span>
                                  )}
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Dispositifs */}
            <Card padding="none">
              <div style={{ padding: '16px 16px 0' }}>
                <div style={{ fontWeight: 500 }}>Par dispositif</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>
                  Les variantes d’écriture d’un même dispositif sont regroupées.
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Dispositif', 'Apprenants', 'Inscriptions', 'Montant', 'Part'].map((h) => (
                      <th key={h} style={entete}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.familles.map((f) => (
                    <tr key={f.cle}>
                      <td style={{ ...cellule, fontWeight: f.cle === 'non_renseigne' ? 400 : 500,
                                   color: f.cle === 'non_renseigne' ? 'var(--text-3)' : 'inherit' }}>
                        {f.label}
                      </td>
                      <td style={cellule}>{f.apprenants}</td>
                      <td style={cellule}>{f.inscriptions}</td>
                      <td style={{ ...cellule, fontVariantNumeric: 'tabular-nums' }}>
                        {f.montant ? euros(f.montant) : '—'}
                      </td>
                      <td style={{ ...cellule, width: 180 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, background: 'var(--gold)',
                            width: total ? `${Math.round((f.montant / total) * 100)}%` : '0%',
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {data.non_renseigne > 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
                {data.non_renseigne} apprenant(s) sans dispositif renseigné. C’est la première
                colonne que réclame un audit quand il vérifie la traçabilité du financement.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

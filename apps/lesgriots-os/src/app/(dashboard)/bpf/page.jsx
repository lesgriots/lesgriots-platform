'use client';

/**
 * /bpf — Bilan Pédagogique et Financier.
 *
 * La déclaration annuelle obligatoire à la DREETS, celle qui te liait encore
 * à Digiforma. Chaque case est calculée à partir de tes sessions, tes
 * inscriptions et tes financeurs ; celles que la base ne peut pas déduire
 * restent modifiables et sont enregistrées à part, sans jamais réécrire les
 * données d'origine.
 *
 * Les alertes en tête ne sont pas décoratives : tant qu'un euro n'est pas
 * ventilé, la déclaration ne tombe pas juste.
 */

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, Skeleton } from '@/components/ui';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};

function Section({ lettre, titre, enfants }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ ...mono, fontSize: 11 }}>{lettre}</span>
        <strong style={{ fontSize: 15.5, letterSpacing: '-0.015em' }}>{titre}</strong>
      </div>
      {enfants}
    </Card>
  );
}

function Champ({ label, valeur, calcule, onChange, suffixe = '€' }) {
  const modifiable = typeof onChange === 'function';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 150px', gap: 14, alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 13 }}>
        {label}
        {calcule != null && modifiable && calcule !== valeur && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>
            calculé : {suffixe === '€' ? euros(calcule) : calcule}
          </span>
        )}
      </div>
      {modifiable ? (
        <input
          value={valeur}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
          inputMode="decimal"
          style={{
            width: '100%', padding: '6px 9px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-2)', background: 'var(--surface)',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12.5,
            textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          }}
        />
      ) : (
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13.5, fontWeight: 600 }}>
          {suffixe === '€' ? euros(valeur) : valeur}
        </div>
      )}
    </div>
  );
}

export default function BpfPage() {
  const [d, setD] = useState(null);
  const [annee, setAnnee] = useState(null);
  const [saisi, setSaisi] = useState({});
  const [etat, setEtat] = useState('');

  const charger = useCallback(async (a) => {
    setD(null);
    const r = await fetch('/api/griotheque/bpf' + (a ? '?annee=' + a : ''));
    const j = await r.json();
    setD(j);
    setAnnee(j.annee);
    setSaisi(j.saisi || {});
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async () => {
    setEtat('Enregistrement…');
    await fetch('/api/griotheque/bpf', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annee, saisi }),
    });
    setEtat('Enregistré');
    setTimeout(() => setEtat(''), 2200);
  };

  // La valeur retenue : la correction saisie si elle existe, sinon le calcul.
  const valeur = (cle, calcule) => (saisi[cle] !== undefined && saisi[cle] !== '' ? saisi[cle] : calcule);
  const nombre = (v) => Number(String(v).replace(',', '.')) || 0;
  const majSaisi = (cle) => (v) => setSaisi((s) => ({ ...s, [cle]: v }));

  const totalProduits = d
    ? d.lignes.reduce((t, l) => t + nombre(valeur(l.cle, d.produits[l.cle])), 0)
    : 0;

  return (
    <>
      <TopBar
        title="Bilan Pédagogique et Financier"
        subtitle={d ? `Exercice ${d.annee} · déclaration DREETS` : ''}
        right={d && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={annee || ''}
              onChange={(e) => charger(e.target.value)}
              style={{
                padding: '5px 9px', borderRadius: 'var(--radius-md)', fontSize: 11.5,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {d.annees_disponibles.map((a) => <option key={a} value={a}>Exercice {a}</option>)}
            </select>
            <button onClick={() => window.print()} style={{
              padding: '5px 11px', borderRadius: 'var(--radius-md)', fontSize: 11.5,
              border: '1px solid var(--border-2)', background: 'var(--surface)',
              color: 'var(--text-2)', fontFamily: 'inherit', cursor: 'pointer',
            }}>Imprimer</button>
            <button onClick={enregistrer} style={{
              padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: 11.5, fontWeight: 600,
              border: 'none', background: 'var(--gold)', color: '#141210',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>{etat || 'Enregistrer'}</button>
          </div>
        )}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 900 }}>

        {!d && <Skeleton />}

        {d && (
          <>
            {/* Ce qui empêche la déclaration de tomber juste */}
            {d.alertes.length > 0 && (
              <Card>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  {d.alertes.length} point(s) à régler avant de déclarer
                </div>
                {d.alertes.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '7px 0',
                    borderTop: i ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: a.niveau === 'bloquant' ? 'var(--danger)' : 'var(--gold)',
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.texte}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.quoi}</div>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {d.coherence?.sessions?.length > 0 && <Coherence coherence={d.coherence} />}

            <Section lettre="A" titre="Identification de l’organisme de formation" enfants={
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  ['Numéro de déclaration', d.organisme.nda],
                  ['SIRET', d.organisme.siret],
                  ['Forme juridique', d.organisme.forme_juridique],
                  ['Dénomination', d.organisme.raison_sociale],
                  ['Adresse', [d.organisme.adresse, d.organisme.code_postal, d.organisme.ville].filter(Boolean).join(' ')],
                  ['Représentant légal', d.organisme.representant],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div style={mono}>{l}</div>
                    <div style={{ fontSize: 13.5, marginTop: 3 }}>{v || <span style={{ color: 'var(--danger)' }}>à renseigner dans Paramètres</span>}</div>
                  </div>
                ))}
              </div>
            } />

            <Section lettre="C" titre="Bilan financier hors taxes · origine des produits" enfants={
              <>
                {d.lignes.map((l) => (
                  <Champ
                    key={l.cle}
                    label={<span><span style={{ ...mono, marginRight: 8 }}>{l.ref}</span>{l.label}</span>}
                    valeur={valeur(l.cle, Math.round(d.produits[l.cle]))}
                    calcule={Math.round(d.produits[l.cle])}
                    onChange={majSaisi(l.cle)}
                  />
                ))}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 150px', gap: 14,
                  padding: '13px 0 0', marginTop: 4, borderTop: '2px solid var(--text)',
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Total des produits</div>
                  <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {euros(totalProduits)}
                  </div>
                </div>
                {d.non_ventile > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>
                    {euros(d.non_ventile)} facturés ne tombent dans aucune ligne, faute de dispositif renseigné.
                  </div>
                )}
              </>
            } />

            <Section lettre="E" titre="Personnes dispensant les formations" enfants={
              <>
                <Champ label="Formateurs intervenus dans l’année" suffixe=""
                       valeur={valeur('formateurs', d.pedagogique.formateurs)}
                       calcule={d.pedagogique.formateurs} onChange={majSaisi('formateurs')} />
                <Champ label="Heures de formation dispensées" suffixe=""
                       valeur={valeur('heures_dispensees', Math.round(d.pedagogique.heures_dispensees))}
                       calcule={Math.round(d.pedagogique.heures_dispensees)} onChange={majSaisi('heures_dispensees')} />
              </>
            } />

            <Section lettre="F" titre="Bilan pédagogique" enfants={
              <>
                <Champ label="Nombre de stagiaires formés" suffixe=""
                       valeur={valeur('stagiaires', d.pedagogique.stagiaires)}
                       calcule={d.pedagogique.stagiaires} onChange={majSaisi('stagiaires')} />
                <Champ label="Nombre total d’heures-stagiaires" suffixe=""
                       valeur={valeur('heures_stagiaires', Math.round(d.pedagogique.heures_stagiaires))}
                       calcule={Math.round(d.pedagogique.heures_stagiaires)} onChange={majSaisi('heures_stagiaires')} />
                <Champ label="Sessions tenues dans l’exercice" suffixe=""
                       valeur={valeur('sessions', d.pedagogique.sessions)}
                       calcule={d.pedagogique.sessions} onChange={majSaisi('sessions')} />
              </>
            } />

            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
              Calculé sur {d.lignes_comptees} inscription(s) rattachée(s) à une session de {d.annee}.
              Une valeur corrigée à la main est conservée pour cet exercice et n’écrase jamais la donnée d’origine.
            </p>
          </>
        )}
      </div>
    </>
  );
}


/**
 * Le contrôle de cohérence entre les deux sources de produits.
 *
 * Les montants du Cerfa viennent des inscriptions et de leur financement
 * saisi en texte libre. Les clients de session déclarent la même chose,
 * explicitement. Tant que les deux coexistent, on ne bascule pas la source :
 * on compare, session par session, et on montre où ça diverge.
 *
 * Aucun chiffre de la déclaration n'est modifié par ce bloc. C'est un
 * contrôle, et il doit rester lisible comme tel.
 */
function Coherence({ coherence }) {
  const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
  const dateFr = (v) => {
    if (!v) return '—';
    const dd = new Date(`${String(v).slice(0, 10)}T12:00:00`);
    return Number.isNaN(dd.getTime()) ? v : dd.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const TONS = {
    ok: { couleur: 'var(--success)', mot: 'Concordant' },
    ecart: { couleur: 'var(--danger)', mot: 'Écart' },
    sans_clients: { couleur: 'var(--text-3)', mot: 'Sans client déclaré' },
  };
  const cell = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 };
  const entete = {
    textAlign: 'left', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-3)', fontWeight: 600, padding: '12px', borderBottom: '1px solid var(--border)',
  };

  return (
    <Card padding="none">
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontWeight: 500 }}>Contrôle de cohérence des produits</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '4px 0 12px', lineHeight: 1.55, maxWidth: 720 }}>
          Deux sources décrivent le même argent : les inscriptions avec leur financement écrit à la main, et les clients de session avec leur prix et leurs cases de Cerfa.
          Ce tableau les compare sans rien modifier. Le jour où les deux colonnes concordent partout, on pourra faire des clients de session la source de vérité.
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
          <div><div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Total inscriptions</div><div style={{ fontSize: 18, fontWeight: 800 }}>{euros(coherence.total_inscriptions)}</div></div>
          <div><div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Total clients déclarés</div><div style={{ fontSize: 18, fontWeight: 800 }}>{euros(coherence.total_clients)}</div></div>
          <div><div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>Sessions à renseigner</div><div style={{ fontSize: 18, fontWeight: 800, color: coherence.sessions_sans_clients ? 'var(--gold)' : 'var(--success)' }}>{coherence.sessions_sans_clients} / {coherence.sessions.length}</div></div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={entete}>Session</th>
            <th style={entete}>Date</th>
            <th style={{ ...entete, textAlign: 'right' }}>Inscriptions</th>
            <th style={{ ...entete, textAlign: 'right' }}>Clients déclarés</th>
            <th style={{ ...entete, textAlign: 'right' }}>Écart</th>
            <th style={entete}>État</th>
          </tr></thead>
          <tbody>
            {coherence.sessions.map((s) => {
              const ton = TONS[s.statut] || TONS.ok;
              return (
                <tr key={s.session_id} style={s.statut === 'ecart' ? { background: 'var(--danger-soft)' } : undefined}>
                  <td style={{ ...cell, fontWeight: 500 }}>
                    <a href={`/sessions/${s.session_id}`} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>{s.titre}</a>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.nb_inscriptions} inscription(s) · {s.nb_clients} client(s) déclaré(s)</div>
                  </td>
                  <td style={{ ...cell, color: 'var(--text-3)' }}>{dateFr(s.date)}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{euros(s.total_inscriptions)}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.nb_clients ? euros(s.total_clients) : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.statut === 'ecart' ? 'var(--danger)' : 'var(--text-3)', fontWeight: s.statut === 'ecart' ? 800 : 400 }}>
                    {s.nb_clients ? `${s.ecart > 0 ? '+' : ''}${euros(s.ecart)}` : '—'}
                  </td>
                  <td style={{ ...cell, color: ton.couleur, fontWeight: 700, fontSize: 12 }}>{ton.mot}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 16px 16px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55 }}>
        Une session « sans client déclaré » n’est pas une erreur : elle signifie seulement que sa déclaration repose encore sur le financement saisi à la main.
        Un « écart » en revanche est à traiter, parce que la déclaration sera fausse quelle que soit la source retenue.
      </div>
    </Card>
  );
}

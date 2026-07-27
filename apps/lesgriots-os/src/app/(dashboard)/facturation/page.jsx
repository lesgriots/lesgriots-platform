'use client';

/**
 * /facturation — devis et factures.
 *
 * Les tables et les API existaient depuis le début, sans écran pour les
 * remplir : zéro devis, zéro facture, et un suivi de trésorerie impossible.
 * Cette page est ce qui manquait, rien de plus.
 *
 * Le payeur n'est pas toujours l'apprenant. Entreprise, OPCO, CPF, FAF : le
 * circuit de relance n'est pas le même, donc le payeur est une colonne de
 * plein droit, pas une note en bas de page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton, useConfirm } from '@/components/ui';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  : '—';

const STATUTS_DEVIS = {
  brouillon: 'Brouillon', envoye: 'Envoyé', consulte: 'Consulté',
  accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré',
};
const STATUTS_FACTURE = {
  brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée',
  partiellement_payee: 'Partiellement payée', retard: 'En retard', annulee: 'Annulée',
};
const PAYEURS = {
  apprenant: 'Apprenant', entreprise: 'Entreprise', opco: 'OPCO',
  cpf: 'CPF', faf: 'FAF', autre: 'Autre',
};

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};
const th = { ...mono, fontWeight: 400, textAlign: 'left', padding: '11px 10px', borderBottom: '1px solid var(--border-2)' };
const td = { padding: '12px 10px', borderBottom: '1px solid var(--border)', fontSize: 13.5 };
const champ = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-2)', background: 'var(--surface)',
  color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
};

export default function FacturationPage() {
  const [onglet, setOnglet] = useState('factures');
  const [devis, setDevis] = useState(null);
  const [factures, setFactures] = useState(null);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [formulaire, setFormulaire] = useState(null);
  const confirmer = useConfirm();

  const charger = useCallback(async () => {
    const [d, f, c, s] = await Promise.all([
      fetch('/api/devis').then((r) => r.json()).catch(() => []),
      fetch('/api/factures').then((r) => r.json()).catch(() => []),
      fetch('/api/clients').then((r) => r.json()).catch(() => []),
      fetch('/api/sessions').then((r) => r.json()).catch(() => []),
    ]);
    const liste = (x) => (Array.isArray(x) ? x : (x.items || []));
    setDevis(liste(d)); setFactures(liste(f)); setClients(liste(c)); setSessions(liste(s));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const creer = async (valeurs) => {
    const url = onglet === 'devis' ? '/api/devis' : '/api/factures';
    const ht = Number(String(valeurs.montant_ht).replace(',', '.')) || 0;
    const tva = Number(String(valeurs.tva_rate).replace(',', '.')) || 0;
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...valeurs, montant_ht: ht, tva_rate: tva, montant_ttc: Math.round(ht * (1 + tva / 100) * 100) / 100 }),
    });
    setFormulaire(null);
    charger();
  };

  const majStatut = async (type, id, statut) => {
    await fetch(`/api/${type}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    charger();
  };

  const supprimer = async (type, ligne) => {
    if (!(await confirmer({ title: `Supprimer ${ligne.numero || 'ce document'} ?`, confirmLabel: 'Supprimer' }))) return;
    await fetch(`/api/${type}/${ligne.id}`, { method: 'DELETE' });
    charger();
  };

  const chiffres = useMemo(() => {
    const f = factures || [];
    const attente = f.filter((x) => ['envoyee', 'partiellement_payee', 'retard'].includes(x.statut))
      .reduce((t, x) => t + (x.montant_ttc || 0) - (x.montant_paye || 0), 0);
    const encaisse = f.reduce((t, x) => t + (x.montant_paye || 0), 0);
    const auj = new Date().toISOString().slice(0, 10);
    const retard = f.filter((x) => x.date_echeance && x.date_echeance < auj && x.statut !== 'payee').length;
    const devisOuverts = (devis || []).filter((x) => ['envoye', 'consulte'].includes(x.statut))
      .reduce((t, x) => t + (x.montant_ht || 0), 0);
    return { attente, encaisse, retard, devisOuverts };
  }, [factures, devis]);

  const enCours = onglet === 'devis' ? devis : factures;

  return (
    <>
      <TopBar
        title="Facturation"
        subtitle={enCours ? `${(devis || []).length} devis · ${(factures || []).length} facture(s)` : ''}
        right={
          <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: 2, gap: 1 }}>
            {[['factures', 'Factures'], ['devis', 'Devis']].map(([cle, label]) => (
              <button key={cle} onClick={() => setOnglet(cle)} style={{
                padding: '4px 11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: onglet === cle ? 'var(--surface)' : 'transparent',
                border: '1px solid ' + (onglet === cle ? 'var(--border)' : 'transparent'),
                color: onglet === cle ? 'var(--text)' : 'var(--text-3)',
                fontSize: 11, fontWeight: onglet === cle ? 500 : 400, fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
        }
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!enCours && <Skeleton />}

        {enCours && (
          <>
            <div style={{
              display: 'flex', gap: 34, flexWrap: 'wrap', alignItems: 'flex-end',
              paddingBottom: 16, borderBottom: '1px solid var(--border)',
            }}>
              {[
                ['En attente de paiement', euros(chiffres.attente)],
                ['Encaissé', euros(chiffres.encaisse)],
                ['Devis ouverts', euros(chiffres.devisOuverts)],
                ['En retard', String(chiffres.retard)],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={mono}>{l}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                    color: l === 'En retard' && chiffres.retard ? 'var(--gold-deep)' : 'inherit',
                  }}>{v}</div>
                </div>
              ))}
              <button
                onClick={() => setFormulaire({
                  objet: '', client_id: '', session_id: '', montant_ht: '', tva_rate: '0',
                  statut: 'brouillon', payeur_type: 'entreprise', date_echeance: '', notes: '',
                })}
                style={{
                  marginLeft: 'auto', padding: '9px 16px', borderRadius: 'var(--radius-md)',
                  border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#141210',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                }}
              >{onglet === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'}</button>
            </div>

            {enCours.length === 0 ? (
              <EmptyState
                title={onglet === 'devis' ? 'Aucun devis' : 'Aucune facture'}
                message="Rien n’a encore été émis. C’est ce qui manquait pour suivre ta trésorerie."
              />
            ) : (
              <Card padding="none">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Numéro</th>
                      <th style={th}>Objet</th>
                      <th style={th}>{onglet === 'devis' ? 'Émis le' : 'Payeur'}</th>
                      <th style={th}>{onglet === 'devis' ? 'Valide jusqu’au' : 'Échéance'}</th>
                      <th style={{ ...th, textAlign: 'right' }}>Montant HT</th>
                      <th style={th}>Statut</th>
                      <th style={{ ...th, width: 36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {enCours.map((l) => {
                      const auj = new Date().toISOString().slice(0, 10);
                      const enRetard = onglet === 'factures' && l.date_echeance && l.date_echeance < auj && l.statut !== 'payee';
                      return (
                        <tr key={l.id} style={enRetard ? { background: 'var(--gold-soft)' } : undefined}>
                          <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{l.numero || '—'}</td>
                          <td style={{ ...td, fontWeight: 500 }}>{l.objet || '—'}</td>
                          <td style={{ ...td, color: 'var(--text-3)' }}>
                            {onglet === 'devis' ? dateFr(l.date_emission) : (PAYEURS[l.payeur_type] || '—')}
                          </td>
                          <td style={{ ...td, color: 'var(--text-3)' }}>
                            {dateFr(onglet === 'devis' ? l.valide_jusqu_au : l.date_echeance)}
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {euros(l.montant_ht)}
                          </td>
                          <td style={td}>
                            <select
                              value={l.statut}
                              onChange={(e) => majStatut(onglet, l.id, e.target.value)}
                              style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em',
                                textTransform: 'uppercase', color: 'var(--text-2)', background: 'transparent',
                                border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', cursor: 'pointer',
                              }}
                            >
                              {Object.entries(onglet === 'devis' ? STATUTS_DEVIS : STATUTS_FACTURE)
                                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <button onClick={() => supprimer(onglet, l)} title="Supprimer"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, padding: 0 }}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>

      {formulaire && (
        <Formulaire
          type={onglet}
          valeurs={formulaire}
          clients={clients}
          sessions={sessions}
          onChange={setFormulaire}
          onValider={creer}
          onFermer={() => setFormulaire(null)}
        />
      )}
    </>
  );
}

function Formulaire({ type, valeurs, clients, sessions, onChange, onValider, onFermer }) {
  const maj = (k) => (e) => onChange({ ...valeurs, [k]: e.target.value });
  const nomClient = (c) => c.company || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sans nom';

  return (
    <div onClick={onFermer} style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: 22,
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {type === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, marginBottom: 16 }}>
          L’objet et le montant suffisent. Le numéro est attribué à l’enregistrement.
        </div>

        <div style={{ display: 'grid', gap: 11 }}>
          <label>
            <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Objet</span>
            <input value={valeurs.objet} onChange={maj('objet')} placeholder="Formation Stratégie de marque" style={champ} />
          </label>

          <label>
            <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Client</span>
            <select value={valeurs.client_id} onChange={maj('client_id')} style={champ}>
              <option value="">Aucun</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{nomClient(c)}</option>)}
            </select>
          </label>

          <label>
            <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Session rattachée</span>
            <select value={valeurs.session_id} onChange={maj('session_id')} style={champ}>
              <option value="">Aucune</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.session_name || s.start_date || s.id.slice(0, 8)}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <label>
              <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Montant HT</span>
              <input value={valeurs.montant_ht} onChange={maj('montant_ht')} inputMode="decimal" placeholder="0" style={champ} />
            </label>
            <label>
              <span style={{ ...mono, display: 'block', marginBottom: 4 }}>TVA (%)</span>
              <input value={valeurs.tva_rate} onChange={maj('tva_rate')} inputMode="decimal" placeholder="0" style={champ} />
            </label>
          </div>

          {type === 'factures' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              <label>
                <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Payeur</span>
                <select value={valeurs.payeur_type} onChange={maj('payeur_type')} style={champ}>
                  {Object.entries(PAYEURS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Échéance</span>
                <input type="date" value={valeurs.date_echeance} onChange={maj('date_echeance')} style={champ} />
              </label>
            </div>
          )}

          <label>
            <span style={{ ...mono, display: 'block', marginBottom: 4 }}>Notes</span>
            <textarea value={valeurs.notes} onChange={maj('notes')} rows={3} style={{ ...champ, resize: 'vertical' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onFermer} style={{
            padding: '9px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)',
            background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
          }}>Annuler</button>
          <button
            onClick={() => onValider(valeurs)}
            disabled={!valeurs.objet.trim()}
            style={{
              padding: '9px 16px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--gold)', color: '#141210', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              opacity: valeurs.objet.trim() ? 1 : 0.45,
            }}
          >Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

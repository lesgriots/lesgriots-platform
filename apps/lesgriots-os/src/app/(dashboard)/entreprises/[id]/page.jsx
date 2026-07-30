'use client';

/**
 * /entreprises/[id] — la fiche d'une entreprise cliente.
 *
 * Une fiche entreprise n'est pas un carnet d'adresses. C'est le dossier qui
 * permet, sans rappeler le client, d'éditer une convention conforme, de
 * monter un dossier OPCO, d'émettre une facture qui ne sera pas rejetée et
 * de renseigner le BPF. Chaque champ ici a une raison d'être : elle est
 * écrite sous le champ, pas laissée à deviner.
 *
 * Trois blocs, dans l'ordre où l'information arrive :
 *   1. Identité légale, que le SIRET remplit presque seul.
 *   2. Facturation, y compris ce qu'impose la facturation électronique.
 *   3. Financement, c'est-à-dire l'OPCO.
 * Puis les contacts, et l'historique réel des sessions.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';

const carte = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const attenue = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const titre = { margin: 0, fontSize: 16, letterSpacing: '-.02em', color: 'var(--text)' };
const champStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 11px',
  border: '1px solid var(--border-2)', borderRadius: 9,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};

const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const dateFr = (v) => {
  if (!v) return '—';
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Les champs de la fiche, et pourquoi chacun compte.
 * `cle` correspond au contrat de /api/clients/[id].
 */
const BLOCS = [
  {
    id: 'identite', titre: 'Identité légale',
    intro: 'Ce que la convention de formation doit porter mot pour mot. Le SIRET remplit presque tout le reste.',
    champs: [
      { cle: 'company', libelle: 'Raison sociale', aide: 'Le nom exact au registre, pas le nom commercial.', requis: true },
      { cle: 'siret', libelle: 'SIRET', aide: 'Quatorze chiffres. Clé d’identification sur la convention, la facture et le BPF.', requis: true },
      { cle: 'formeJuridique', libelle: 'Forme juridique', aide: 'SAS, SARL, association, micro-entreprise. Détermine qui peut signer.' },
      { cle: 'tvaNumber', libelle: 'TVA intracommunautaire', aide: 'Obligatoire sur la facture dès que le client est assujetti.' },
      { cle: 'codeNaf', libelle: 'Code NAF / APE', aide: 'Sert au BPF et détermine souvent l’OPCO de rattachement.' },
      { cle: 'effectif', libelle: 'Effectif', aide: 'Moins de 11, 11 à 49, 50 à 249, 250 et plus. Conditionne le niveau de prise en charge.' },
      { cle: 'address', libelle: 'Adresse du siège', aide: 'Celle qui figure sur la convention.', requis: true },
      { cle: 'postalCode', libelle: 'Code postal' },
      { cle: 'city', libelle: 'Ville' },
      { cle: 'siteWeb', libelle: 'Site web' },
    ],
  },
  {
    id: 'facturation', titre: 'Facturation',
    intro: 'À partir du 1er septembre 2026, toute entreprise doit pouvoir recevoir ses factures au format électronique. Le SIRET sert d’adresse de routage : sans lui, la facture n’arrive pas.',
    champs: [
      { cle: 'emailFacturation', libelle: 'E-mail de la comptabilité', aide: 'Rarement le même que le contact commercial. Une facture envoyée au mauvais service, c’est un mois de retard.', requis: true },
      { cle: 'adresseFacturation', libelle: 'Adresse de facturation', aide: 'À remplir seulement si elle diffère du siège.' },
      { cle: 'conditionsReglement', libelle: 'Conditions de règlement', aide: 'À réception, 30 jours, 45 jours fin de mois. C’est ce qui fixe ta date d’échéance.' },
      { cle: 'referenceCommande', libelle: 'Référence ou bon de commande', aide: 'Beaucoup de grands comptes rejettent automatiquement une facture sans référence.' },
      { cle: 'chorusServiceCode', libelle: 'Code service Chorus Pro', aide: 'Client public uniquement. Sans ce code, la facture reste bloquée.' },
      { cle: 'chorusEngagement', libelle: 'Numéro d’engagement', aide: 'Client public uniquement, fourni par l’acheteur.' },
    ],
  },
  {
    id: 'financement', titre: 'Financement',
    intro: 'Qui paie réellement la formation. L’OPCO se saisit avant la session, jamais après.',
    champs: [
      { cle: 'opcoNom', libelle: 'OPCO', aide: 'Afdas, Atlas, Opco EP, Akto… Découle de la convention collective du client.' },
      { cle: 'opcoNumeroAdherent', libelle: 'Numéro d’adhérent OPCO', aide: 'Demandé à chaque dépôt de dossier de prise en charge.' },
    ],
  },
];

/** Les champs sans lesquels on ne peut ni conventionner ni facturer. */
const INDISPENSABLES = [
  ['company', 'la raison sociale'],
  ['siret', 'le SIRET'],
  ['address', 'l’adresse du siège'],
  ['emailFacturation', 'l’e-mail de facturation'],
];

export default function FicheEntreprisePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [fiche, setFiche] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [contacts, setContacts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);

  const charger = async () => {
    try {
      const [c, ct, ss] = await Promise.all([
        fetch(`/api/clients/${id}`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Entreprise introuvable'))),
        fetch(`/api/clients/${id}/contacts`).then((r) => r.ok ? r.json() : []),
        fetch('/api/sessions').then((r) => r.ok ? r.json() : []),
      ]);
      setFiche(c); setBrouillon(c);
      setContacts(Array.isArray(ct) ? ct : []);
      const toutes = Array.isArray(ss) ? ss : (ss.items || []);
      setSessions(toutes.filter((s) => s.client_id === id));
    } catch (e) { setErreur(e.message || 'Chargement impossible.'); }
  };

  useEffect(() => { charger(); }, [id]);

  const modifie = useMemo(
    () => fiche && Object.keys(brouillon).some((k) => brouillon[k] !== fiche[k]),
    [brouillon, fiche],
  );

  const manquants = useMemo(
    () => INDISPENSABLES.filter(([cle]) => !String(brouillon[cle] || '').trim()),
    [brouillon],
  );

  const total = BLOCS.flatMap((b) => b.champs).length;
  const remplis = BLOCS.flatMap((b) => b.champs).filter((c) => String(brouillon[c.cle] || '').trim()).length;

  const enregistrer = async () => {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brouillon),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible');
      setFiche(d); setBrouillon(d);
      setMessage('Fiche enregistrée. Les conventions et factures utiliseront ces informations.');
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(false); }
  };

  /** Reprend les données publiques de l'INSEE à partir du SIRET saisi. */
  const completerParSiret = async () => {
    const requete = String(brouillon.siret || brouillon.company || '').trim();
    if (!requete) return;
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/sirene?q=${encodeURIComponent(requete)}&limit=1`);
      const d = await r.json();
      const t = (d.results || [])[0];
      if (!t) throw new Error('Aucun établissement trouvé pour cette recherche.');
      setBrouillon((c) => ({
        ...c,
        company: c.company || t.nom_complet || '',
        siret: t.siret || t.siren || c.siret || '',
        address: c.address || t.adresse || '',
        postalCode: c.postalCode || t.code_postal || '',
        city: c.city || t.commune || '',
        codeNaf: c.codeNaf || t.activite_code || t.naf || '',
        formeJuridique: c.formeJuridique || t.forme_juridique || '',
        effectif: c.effectif || t.tranche_effectif || '',
      }));
      setMessage('Données publiques reprises. Vérifie puis enregistre.');
    } catch (e) { setErreur(e.message); }
    finally { setOccupe(false); }
  };

  if (erreur && !fiche) return <><TopBar title="Entreprise" /><div style={{ padding: 24 }}><p style={{ color: 'var(--danger)' }}>{erreur}</p></div></>;
  if (!fiche) return <><TopBar title="Entreprise" /><div style={{ padding: 24, ...attenue }}>Chargement…</div></>;

  const caTotal = sessions.reduce((somme, s) => somme + (Number(s.tarif) || 0), 0);

  return <>
    <TopBar title={fiche.company || 'Entreprise'} subtitle={fiche.siret ? `SIRET ${fiche.siret}` : 'SIRET à renseigner'} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>

      <Link href="/entreprises" style={{ ...attenue, textDecoration: 'none' }}>← Toutes les entreprises</Link>

      <section style={{ ...carte, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...attenue, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, fontSize: 10 }}>Complétude du dossier</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>{remplis} / {total} champs</div>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 200 }}>
          <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((remplis / total) * 100)}%`, height: '100%', background: 'var(--gold)' }} />
          </div>
          <div style={{ ...attenue, marginTop: 8 }}>
            {manquants.length
              ? `Il manque ${manquants.map(([, mot]) => mot).join(', ')} : sans ça, ni convention conforme ni facture.`
              : 'Le dossier permet d’éditer une convention et d’émettre une facture.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button type="button" onClick={completerParSiret} disabled={occupe} style={bouton(true)}>Compléter par le SIRET</button>
          <button type="button" onClick={enregistrer} disabled={!modifie || occupe} style={bouton(false, !modifie || occupe)}>
            {occupe ? 'Enregistrement…' : modifie ? 'Enregistrer la fiche' : 'Fiche à jour'}
          </button>
        </div>
      </section>

      {message && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--success-soft)', border: '1.5px solid color-mix(in srgb, var(--success) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{message}</div>}
      {erreur && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{erreur}</div>}

      {BLOCS.map((bloc) => <section key={bloc.id} style={carte}>
        <h2 style={titre}>{bloc.titre}</h2>
        <p style={{ ...attenue, margin: '6px 0 16px' }}>{bloc.intro}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
          {bloc.champs.map((champ) => {
            const vide = !String(brouillon[champ.cle] || '').trim();
            return <label key={champ.cle} style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: champ.requis && vide ? 'var(--danger)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {champ.libelle}{champ.requis ? ' ·' : ''}{champ.requis && vide ? ' à renseigner' : ''}
              </span>
              <input
                value={brouillon[champ.cle] || ''}
                onChange={(e) => setBrouillon((c) => ({ ...c, [champ.cle]: e.target.value }))}
                style={{ ...champStyle, borderColor: champ.requis && vide ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : 'var(--border-2)' }}
              />
              {champ.aide && <span style={{ ...attenue, fontSize: 11.5 }}>{champ.aide}</span>}
            </label>;
          })}
        </div>
      </section>)}

      <section style={carte}>
        <h2 style={titre}>Contacts</h2>
        <p style={{ ...attenue, margin: '6px 0 14px' }}>
          Trois rôles suffisent, et ce sont rarement les mêmes personnes : qui signe la convention, qui reçoit la facture, qui suit les apprenants.
        </p>
        {contacts.length ? <div style={{ display: 'grid', gap: 9 }}>
          {contacts.map((c) => <div key={c.id} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><b style={{ fontSize: 13 }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sans nom'}</b><div style={attenue}>{c.role || 'Rôle à préciser'}</div></div>
            <div style={{ ...attenue, textAlign: 'right' }}>{c.email || 'Sans e-mail'}<br />{c.phone || ''}</div>
          </div>)}
        </div> : <p style={{ ...attenue, margin: 0 }}>Aucun contact enregistré. Au minimum, le signataire de la convention.</p>}
      </section>

      <section style={carte}>
        <h2 style={titre}>Historique</h2>
        <p style={{ ...attenue, margin: '6px 0 14px' }}>{sessions.length} session(s) · {euros(caTotal)} au total.</p>
        {sessions.length ? <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Session', 'Date', 'Montant', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 10px', borderBottom: '1px solid var(--border)', ...attenue, textTransform: 'uppercase', fontSize: 10, fontWeight: 800 }}>{h}</th>)}</tr></thead>
            <tbody>{sessions.map((s) => <tr key={s.id}>
              <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{s.formation_title || s.session_name || s.id}</td>
              <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>{dateFr(s.start_date)}</td>
              <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>{euros(s.tarif)}</td>
              <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                <Link href={`/sessions/${s.id}`} style={{ color: 'var(--gold)', fontWeight: 800, textDecoration: 'none' }}>Ouvrir →</Link>
              </td>
            </tr>)}</tbody>
          </table>
        </div> : <p style={{ ...attenue, margin: 0 }}>Aucune session rattachée à cette entreprise pour le moment.</p>}
      </section>
    </div>
  </>;
}

function bouton(secondaire, desactive = false) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 10,
    fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: desactive ? 'not-allowed' : 'pointer',
    opacity: desactive ? .45 : 1, whiteSpace: 'nowrap',
    background: secondaire ? 'var(--surface)' : 'var(--gold)',
    color: secondaire ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondaire ? 'var(--border-2)' : 'var(--gold)'}`,
  };
}

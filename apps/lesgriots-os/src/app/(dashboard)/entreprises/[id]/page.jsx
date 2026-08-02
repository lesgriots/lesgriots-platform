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

      <Contacts clientId={id} contacts={contacts} onRecharger={charger} />

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

      <AccesEspace id={id} />
    </div>
  </>;
}

/**
 * Le lien de l'espace entreprise.
 *
 * Ce que le client vient chercher par mail, trois fois par dossier : qui est
 * inscrit, qui est venu, où sont les papiers. Lui donner l'adresse une fois
 * coûte moins cher que d'y répondre trois fois, et il y trouve la présence
 * réelle, celle qui décide du remboursement de son OPCO.
 *
 * Le lien est permanent : c'est ce qui le rend utilisable six mois plus tard,
 * et c'est aussi ce qui impose de pouvoir le révoquer d'un bouton.
 */
function AccesEspace({ id }) {
  const [url, setUrl] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/clients/${id}/espace`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivant && d?.url) setUrl(d.url); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [id]);

  const renouveler = async () => {
    setOccupe(true);
    try {
      const r = await fetch(`/api/clients/${id}/espace`, { method: 'POST' });
      const d = await r.json();
      if (d?.url) { setUrl(d.url); setCopie(false); }
    } finally { setOccupe(false); }
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(url); setCopie(true); } catch { /* refus du navigateur */ }
  };

  return (
    <section style={{ ...carte, marginTop: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800 }}>Espace entreprise</h2>
      <p style={{ ...attenue, margin: '0 0 12px' }}>
        L’adresse où cette entreprise retrouve seule ses salariés inscrits, leur présence
        émargée et ses documents. Elle peut aussi la demander depuis <code>/entreprise</code>
        {' '}avec l’e-mail de la fiche ou d’un contact.
      </p>
      {url ? (
        <>
          <div style={{
            padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)',
            border: '1px solid var(--border-2)', fontSize: 12.5, wordBreak: 'break-all',
            fontFamily: 'var(--font-mono, ui-monospace), monospace', marginBottom: 10,
          }}>{url}</div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button type="button" onClick={copier} style={bouton(false)}>
              {copie ? 'Copié' : 'Copier le lien'}
            </button>
            <a href={url} target="_blank" rel="noreferrer" style={{ ...bouton(true), textDecoration: 'none' }}>
              Ouvrir
            </a>
            <button type="button" onClick={renouveler} disabled={occupe} style={bouton(true, occupe)}>
              {occupe ? 'Renouvellement…' : 'Renouveler'}
            </button>
          </div>
          <p style={{ ...attenue, margin: '10px 0 0' }}>
            Renouveler crée une nouvelle adresse et rend l’ancienne inutilisable :
            à faire si le lien a circulé plus loin que prévu.
          </p>
        </>
      ) : (
        <p style={{ ...attenue, margin: 0 }}>Chargement du lien…</p>
      )}
    </section>
  );
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


/**
 * Les rôles d'un contact chez un client.
 *
 * Ils ne sont pas décoratifs : chacun désigne la personne à qui un document
 * précis doit partir. Le signataire reçoit la convention, la facturation
 * reçoit la facture, le suivi reçoit les convocations et les attestations.
 * Deux d'entre eux bloquent une opération quand ils manquent, et la fiche le
 * dit plutôt que de le laisser découvrir au mauvais moment.
 */
const ROLES = [
  { cle: 'Signataire de la convention', aide: 'Celui qui a le pouvoir d’engager l’entreprise. Sans lui, pas de convention valable.', bloquant: 'la convention' },
  { cle: 'Facturation', aide: 'La comptabilité. Rarement la même personne que le commercial.', bloquant: 'la facture' },
  { cle: 'Suivi des apprenants', aide: 'Reçoit les convocations, les émargements et les attestations.' },
  { cle: 'Référent handicap', aide: 'L’interlocuteur pour les aménagements, côté entreprise.' },
  { cle: 'Direction', aide: 'Pour les échanges de haut niveau et les renouvellements.' },
  { cle: 'Autre', aide: '' },
];

const champContact = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px',
  border: '1px solid var(--border-2)', borderRadius: 8,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};

/** Le formulaire d'un contact. Défini hors du parent, sinon le champ perd
 *  le focus à chaque lettre tapée : React remonterait un composant neuf. */
function FormulaireContact({ valeur, onChange, onValider, onAnnuler, occupe }) {
  return (
    <div style={{ padding: 14, border: '1.5px solid color-mix(in srgb, var(--gold) 45%, transparent)', borderRadius: 10, background: 'var(--gold-soft)', display: 'grid', gap: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 11 }}>
        {[['firstName', 'Prénom'], ['lastName', 'Nom'], ['email', 'E-mail'], ['phone', 'Téléphone']].map(([cle, lib]) => (
          <label key={cle} style={{ display: 'grid', gap: 4 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>{lib}</span>
            <input value={valeur[cle] || ''} onChange={(e) => onChange({ ...valeur, [cle]: e.target.value })} style={champContact} />
          </label>
        ))}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Rôle</span>
          <select value={valeur.role || ''} onChange={(e) => onChange({ ...valeur, role: e.target.value })} style={champContact}>
            <option value="">À définir</option>
            {ROLES.map((r) => <option key={r.cle} value={r.cle}>{r.cle}</option>)}
          </select>
        </label>
      </div>
      {valeur.role && ROLES.find((r) => r.cle === valeur.role)?.aide && (
        <div style={{ ...attenue, fontSize: 11.5 }}>{ROLES.find((r) => r.cle === valeur.role).aide}</div>
      )}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" disabled={occupe} onClick={onValider} style={bouton(false, occupe)}>{occupe ? 'Enregistrement…' : 'Enregistrer le contact'}</button>
        <button type="button" onClick={onAnnuler} style={bouton(true)}>Annuler</button>
      </div>
    </div>
  );
}

function Contacts({ clientId, contacts, onRecharger }) {
  const vide = { firstName: '', lastName: '', role: '', email: '', phone: '', notes: '' };
  const [ajout, setAjout] = useState(null);
  const [edition, setEdition] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  const manquants = ROLES.filter((r) => r.bloquant && !contacts.some((c) => c.role === r.cle));

  const enregistrer = async (contact) => {
    if (!String(contact.lastName || '').trim() && !String(contact.firstName || '').trim()) {
      setErreur('Un contact a besoin d’un nom.'); return;
    }
    setOccupe(true); setErreur('');
    try {
      const url = contact.id
        ? `/api/clients/${clientId}/contacts/${contact.id}`
        : `/api/clients/${clientId}/contacts`;
      const r = await fetch(url, {
        method: contact.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
      if (!r.ok) throw new Error('Enregistrement impossible');
      setAjout(null); setEdition(null);
      await onRecharger();
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  const retirer = async (contact) => {
    setOccupe(true); setErreur('');
    try {
      const r = await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Suppression impossible');
      await onRecharger();
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };


  return <section style={carte}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
      <div>
        <h2 style={titre}>Contacts</h2>
        <p style={{ ...attenue, margin: '6px 0 0', maxWidth: 620 }}>
          Une entreprise a rarement un seul interlocuteur. Chaque contact porte un rôle, et le rôle décide de ce qu’il reçoit : la convention au signataire, la facture à la comptabilité, les convocations à celui qui suit les apprenants.
        </p>
      </div>
      {!ajout && <button type="button" onClick={() => setAjout({ ...vide })} style={bouton(false)}>+ Ajouter un contact</button>}
    </div>

    {erreur && <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 12.5, fontWeight: 700 }}>{erreur}</div>}

    {manquants.length > 0 && (
      <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: 'var(--gold-soft)', border: '1.5px solid color-mix(in srgb, var(--gold) 45%, transparent)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
        Aucun contact pour {manquants.map((r) => r.cle.toLowerCase()).join(' ni ')} : {manquants.map((r) => r.bloquant).join(' et ')} ne {manquants.length > 1 ? 'peuvent' : 'peut'} pas partir.
      </div>
    )}

    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {ajout && <FormulaireContact valeur={ajout} onChange={setAjout} occupe={occupe} onValider={() => enregistrer(ajout)} onAnnuler={() => { setAjout(null); setErreur(''); }} />}

      {contacts.map((c) => edition?.id === c.id
        ? <FormulaireContact key={c.id} valeur={edition} onChange={setEdition} occupe={occupe} onValider={() => enregistrer(edition)} onAnnuler={() => { setEdition(null); setErreur(''); }} />
        : <div key={c.id} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13.5 }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sans nom'}</b>
              <div style={{ marginTop: 4 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: c.role ? 'var(--gold-soft)' : 'var(--surface-3)',
                  color: c.role ? 'var(--text)' : 'var(--text-3)',
                  border: `1px solid ${c.role ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'var(--border)'}`,
                }}>{c.role || 'Rôle à définir'}</span>
              </div>
            </div>
            <div style={{ ...attenue, textAlign: 'right', minWidth: 0 }}>
              {c.email ? <a href={`mailto:${c.email}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>{c.email}</a> : 'Sans e-mail'}
              <br />{c.phone || ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setEdition({ ...c }); setAjout(null); }} style={bouton(true)}>Modifier</button>
              <button type="button" disabled={occupe} onClick={() => retirer(c)} style={{ ...bouton(true, occupe), color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}>Retirer</button>
            </div>
          </div>)}

      {!contacts.length && !ajout && <p style={{ ...attenue, margin: 0 }}>Aucun contact enregistré. Commence par le signataire de la convention.</p>}
    </div>
  </section>;
}

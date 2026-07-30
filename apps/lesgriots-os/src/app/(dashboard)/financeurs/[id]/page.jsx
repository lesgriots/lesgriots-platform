'use client';

/**
 * /financeurs/[id] — la fiche d'un organisme financeur.
 *
 * Un financeur, c'est une procédure qu'on refait à chaque dossier : un
 * portail, un identifiant, une liste de pièces, un délai avant la session,
 * une règle de subrogation. Tout cela se rappelle de tête aujourd'hui, ou
 * se recherche dans de vieux e-mails. C'est exactement ce qu'une fiche doit
 * retenir à ta place.
 *
 * Un mot sur la sécurité : on stocke l'identifiant du portail, jamais le mot
 * de passe. Un gestionnaire de mots de passe fait ce travail, pas une base
 * d'application métier.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import FicheEntite, { styleAttenue } from '@/components/donnees/FicheEntite';

const BLOCS = [
  {
    id: 'identite', titre: 'Identité',
    intro: 'Qui paie, et sous quel nom la facture doit être établie.',
    champs: [
      { cle: 'nom', libelle: 'Nom du financeur', aide: 'AFDAS, ATLAS, AGEFICE, FIF PL, France Travail, ou le nom de l’entreprise.', requis: true },
      { cle: 'type', libelle: 'Type', options: ['OPCO', 'FAF', 'France Travail', 'Région', 'CPF', 'Entreprise', 'Particulier', 'Autre'], aide: 'Détermine la case du BPF où la somme sera déclarée.', requis: true },
      { cle: 'siret', libelle: 'SIRET', aide: 'Nécessaire pour facturer, et pour le routage de la facture électronique.' },
      { cle: 'adresse', libelle: 'Adresse de facturation', large: true },
      { cle: 'postal_code', libelle: 'Code postal' },
      { cle: 'ville', libelle: 'Ville' },
    ],
  },
  {
    id: 'procedure', titre: 'La procédure de dépôt',
    intro: 'Ce qu’on cherche systématiquement au mauvais moment, c’est-à-dire trois jours avant la session.',
    champs: [
      { cle: 'portail_url', libelle: 'Portail de dépôt', aide: 'L’adresse exacte, pas la page d’accueil du site.', large: true },
      { cle: 'identifiant_portail', libelle: 'Identifiant du portail', aide: 'L’identifiant seulement. Le mot de passe reste dans ton gestionnaire, jamais ici.' },
      { cle: 'numero_adherent', libelle: 'Notre numéro chez eux', aide: 'Numéro d’adhérent ou d’organisme, redemandé à chaque dossier.' },
      { cle: 'delai_depot', libelle: 'Délai de dépôt', aide: 'Combien de jours avant le début de la session. Passé ce délai, le dossier est refusé.' },
      { cle: 'pieces_exigees', libelle: 'Pièces exigées', aide: 'Programme, convention, devis, attestation de présence… Liste-les une fois, tu ne les rechercheras plus.', lignes: 3, large: true },
    ],
  },
  {
    id: 'argent', titre: 'Paiement',
    intro: 'La subrogation change tout : avec elle le financeur te paie directement, sans elle tu factures le client qui se fait rembourser.',
    champs: [
      { cle: 'subrogation', libelle: 'Subrogation', options: ['Oui, paiement direct à l’organisme', 'Non, le client avance et se fait rembourser'], aide: 'Détermine à qui tu adresses la facture.' },
      { cle: 'delai_paiement', libelle: 'Délai de paiement constaté', aide: 'En jours. C’est ton besoin en trésorerie, pas une donnée théorique.' },
      { cle: 'contact_nom', libelle: 'Interlocuteur', aide: 'La personne qui décroche vraiment.' },
      { cle: 'contact_email', libelle: 'E-mail de l’interlocuteur', type: 'email' },
      { cle: 'contact_tel', libelle: 'Téléphone' },
      { cle: 'notes', libelle: 'Notes', aide: 'Les usages non écrits : ce qu’ils acceptent, ce qu’ils refusent.', lignes: 3, large: true },
    ],
  },
];

const INDISPENSABLES = [
  ['nom', 'le nom du financeur'],
  ['type', 'le type, qui décide de la case du BPF'],
  ['pieces_exigees', 'la liste des pièces exigées'],
];

export default function FicheFinanceurPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [fiche, setFiche] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    fetch(`/api/financeurs/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Financeur introuvable')))
      .then((d) => { setFiche(d); setBrouillon(d); })
      .catch((e) => setErreur(e.message));
  }, [id]);

  const modifie = fiche && Object.keys(brouillon).some((k) => brouillon[k] !== fiche[k]);

  const enregistrer = async () => {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/financeurs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brouillon) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible');
      setFiche(d); setBrouillon(d);
      setMessage('Fiche enregistrée.');
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  if (!fiche) return <><TopBar title="Financeur" /><div style={{ padding: 24, ...styleAttenue }}>{erreur || 'Chargement…'}</div></>;

  return <>
    <TopBar title={fiche.nom || 'Financeur'} subtitle={fiche.type || ''} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
      <Link href="/financeurs" style={{ ...styleAttenue, textDecoration: 'none' }}>← Tous les financeurs</Link>
      <FicheEntite
        blocs={BLOCS} indispensables={INDISPENSABLES} valeurs={brouillon}
        onChange={(cle, v) => setBrouillon((c) => ({ ...c, [cle]: v }))}
        onEnregistrer={enregistrer} modifie={modifie} occupe={occupe}
        message={message} erreur={erreur}
      />
    </div>
  </>;
}

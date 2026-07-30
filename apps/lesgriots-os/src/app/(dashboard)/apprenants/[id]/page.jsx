'use client';

/**
 * /apprenants/[id] — la fiche d'un apprenant.
 *
 * Ici, la question n'est pas « que peut-on savoir » mais « que doit-on
 * savoir ». Un organisme de formation a besoin de l'état civil pour éditer
 * une attestation, de la situation professionnelle pour son BPF, du
 * positionnement pour l'indicateur 4, et du financement pour être payé.
 * Rien d'autre.
 *
 * Le bloc « Données à supprimer » n'est pas décoratif. La base contient des
 * champs hérités qui n'ont rien à faire chez un organisme de formation :
 * numéro de sécurité sociale et détail médical d'un handicap. Le second
 * relève de l'article 9 du RGPD, qui interdit par principe le traitement des
 * données de santé. Ce qu'on a le droit de noter, c'est l'aménagement
 * pédagogique nécessaire, jamais sa cause médicale.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import FicheEntite, { styleCarte, styleAttenue, styleTitre, bouton } from '@/components/donnees/FicheEntite';

const BLOCS = [
  {
    id: 'etat_civil', titre: 'État civil',
    intro: 'Ce qui sera imprimé sur l’attestation de fin de formation et le certificat. Une faute ici, et le document est à refaire.',
    champs: [
      { cle: 'civilite', libelle: 'Civilité', options: ['Madame', 'Monsieur', 'Non précisé'] },
      { cle: 'first_name', libelle: 'Prénom', requis: true },
      { cle: 'last_name', libelle: 'Nom', requis: true },
      { cle: 'date_naissance', libelle: 'Date de naissance', type: 'date', aide: 'Exigée sur l’attestation et par la plupart des financeurs.', requis: true },
      { cle: 'lieu_naissance_ville', libelle: 'Ville de naissance', aide: 'Seulement si la formation débouche sur un titre inscrit au RNCP.' },
      { cle: 'email', libelle: 'E-mail', type: 'email', aide: 'Convocations, questionnaires, espace apprenant : tout passe par là.', requis: true },
      { cle: 'phone', libelle: 'Téléphone', aide: 'Pour le jour J, quand quelqu’un ne trouve pas la salle.' },
      { cle: 'address', libelle: 'Adresse', large: true },
      { cle: 'postal_code', libelle: 'Code postal' },
      { cle: 'city', libelle: 'Ville' },
    ],
  },
  {
    id: 'situation', titre: 'Situation professionnelle',
    intro: 'C’est cette ligne qui remplit ton bilan pédagogique et financier. Un apprenant sans situation renseignée est un stagiaire que le BPF ne saura pas classer.',
    champs: [
      { cle: 'situation_pro', libelle: 'Situation', options: ['Salarié', 'Demandeur d’emploi', 'Indépendant', 'Intermittent', 'Étudiant', 'Autre'], aide: 'Détermine la catégorie déclarée au BPF.', requis: true },
      { cle: 'statut_juridique', libelle: 'Statut juridique', aide: 'Auto-entrepreneur, salarié en CDI, intermittent du spectacle.' },
      { cle: 'company', libelle: 'Entreprise', aide: 'Celle qui l’emploie, pas celle qui paie si elles diffèrent.' },
      { cle: 'siret', libelle: 'SIRET de l’entreprise' },
      { cle: 'nom_referent', libelle: 'Référent dans l’entreprise', aide: 'Qui signe la convention et suit le parcours.' },
      { cle: 'email_referent', libelle: 'E-mail du référent', type: 'email' },
    ],
  },
  {
    id: 'positionnement', titre: 'Positionnement',
    intro: 'Indicateur 4 du référentiel : on doit prouver qu’on a analysé le besoin avant d’inscrire. C’est aussi ce qui évite d’accueillir quelqu’un qui n’a rien à faire là.',
    champs: [
      { cle: 'date_positionnement', libelle: 'Date du positionnement', type: 'date', aide: 'Doit être antérieure à l’inscription. L’auditeur vérifie l’ordre.' },
      { cle: 'niveau_exp', libelle: 'Niveau de départ', aide: 'Débutant, intermédiaire, avancé, mesuré et non déclaré.' },
      { cle: 'experience', libelle: 'Expérience', aide: 'Ce qu’il sait déjà faire, dans ses mots.', lignes: 2, large: true },
      { cle: 'motivation', libelle: 'Attentes et objectifs', aide: 'Ce qu’il vient chercher. Se compare à l’évaluation à chaud.', lignes: 2, large: true },
      { cle: 'positionnement_decision', libelle: 'Décision', options: ['Admis', 'Admis avec réserve', 'Refusé', 'Réorienté'], aide: 'Un refus documenté vaut mieux qu’un abandon en cours de route.' },
      { cle: 'positionnement_amenagements', libelle: 'Aménagement nécessaire', aide: 'Le besoin pédagogique et matériel, jamais sa cause médicale : salle de plain-pied, supports agrandis, temps majoré.', lignes: 2, large: true },
    ],
  },
  {
    id: 'financement', titre: 'Financement',
    intro: 'Qui paie, et par quel dispositif. Sans cette ligne, ni la facture ni le BPF ne tombent juste.',
    champs: [
      { cle: 'financement', libelle: 'Dispositif', aide: 'CPF, OPCO, France Travail, entreprise, fonds propres.', requis: true },
      { cle: 'orga_opco', libelle: 'Organisme financeur', aide: 'Le nom exact : AFDAS, ATLAS, AGEFICE, et non « OPCO ».' },
      { cle: 'statut_financement', libelle: 'Où en est le dossier', options: ['À monter', 'Déposé', 'Accepté', 'Refusé', 'Payé'] },
      { cle: 'modalite_paiement', libelle: 'Modalité de paiement' },
      { cle: 'dossier_url', libelle: 'Lien vers le dossier', aide: 'Le dépôt sur le portail du financeur.', large: true },
    ],
  },
];

const INDISPENSABLES = [
  ['last_name', 'le nom'],
  ['email', 'l’e-mail'],
  ['date_naissance', 'la date de naissance, exigée sur l’attestation'],
  ['situation_pro', 'la situation professionnelle, exigée par le BPF'],
  ['financement', 'le dispositif de financement'],
];

/** Champs hérités qu'un organisme de formation ne doit pas conserver. */
const A_SUPPRIMER = [
  ['num_secu', 'Numéro de sécurité sociale', 'Aucun usage chez un organisme de formation. Sa présence en base est une donnée sensible de plus à protéger, pour rien.'],
  ['precision_handicap', 'Détail du handicap', 'Donnée de santé au sens de l’article 9 du RGPD : son traitement est interdit par principe. Note l’aménagement nécessaire dans le positionnement, pas sa cause.'],
];

export default function FicheApprenantPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [fiche, setFiche] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [inscriptions, setInscriptions] = useState([]);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const charger = () => fetch(`/api/apprenants/${id}`)
    .then((r) => r.ok ? r.json() : Promise.reject(new Error('Apprenant introuvable')))
    .then((d) => { setFiche(d); setBrouillon(d); setInscriptions(d.inscriptions || []); })
    .catch((e) => setErreur(e.message));

  useEffect(() => { charger(); }, [id]);

  const modifie = fiche && Object.keys(brouillon).some((k) => brouillon[k] !== fiche[k]);

  const aSupprimer = useMemo(
    () => A_SUPPRIMER.filter(([cle]) => String(fiche?.[cle] || '').trim()),
    [fiche],
  );

  const enregistrer = async (patch = null) => {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/apprenants/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || brouillon),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible');
      await charger();
      setMessage(patch ? 'Données effacées de la base.' : 'Fiche enregistrée.');
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  if (!fiche) return <><TopBar title="Apprenant" /><div style={{ padding: 24, ...styleAttenue }}>{erreur || 'Chargement…'}</div></>;

  return <>
    <TopBar title={[fiche.first_name, fiche.last_name].filter(Boolean).join(' ') || 'Apprenant'} subtitle={fiche.company || fiche.situation_pro || ''} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
      <Link href="/apprenants" style={{ ...styleAttenue, textDecoration: 'none' }}>← Tous les apprenants</Link>

      {aSupprimer.length > 0 && <section style={{ ...styleCarte, borderColor: 'color-mix(in srgb, var(--danger) 45%, transparent)', background: 'var(--danger-soft)' }}>
        <h2 style={styleTitre}>Données à supprimer</h2>
        <p style={{ ...styleAttenue, margin: '6px 0 12px', color: 'var(--text)' }}>
          Cette fiche contient des informations qu’un organisme de formation n’a pas à conserver. Le RGPD demande de ne garder que ce qui sert.
        </p>
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, color: 'var(--text)', fontSize: 13, lineHeight: 1.7 }}>
          {aSupprimer.map(([cle, libelle, pourquoi]) => <li key={cle}><b>{libelle}</b> · {pourquoi}</li>)}
        </ul>
        <button type="button" disabled={occupe} onClick={() => enregistrer(Object.fromEntries(aSupprimer.map(([cle]) => [cle, ''])))} style={bouton(false, occupe)}>
          Effacer ces données définitivement
        </button>
      </section>}

      <FicheEntite
        blocs={BLOCS} indispensables={INDISPENSABLES} valeurs={brouillon}
        onChange={(cle, v) => setBrouillon((c) => ({ ...c, [cle]: v }))}
        onEnregistrer={() => enregistrer()} modifie={modifie} occupe={occupe}
        message={message} erreur={erreur}
        enfants={<section style={styleCarte}>
          <h2 style={styleTitre}>Parcours</h2>
          <p style={{ ...styleAttenue, margin: '6px 0 12px' }}>{inscriptions.length} inscription(s).</p>
          {inscriptions.length ? <div style={{ display: 'grid', gap: 8 }}>
            {inscriptions.map((i) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', flexWrap: 'wrap' }}>
              <div><b style={{ fontSize: 13 }}>{i.formation_title || i.session_id}</b><div style={styleAttenue}>{i.status || 'Statut à définir'}</div></div>
              {i.session_id && <Link href={`/sessions/${i.session_id}`} style={{ color: 'var(--gold)', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Ouvrir la session →</Link>}
            </div>)}
          </div> : <p style={{ ...styleAttenue, margin: 0 }}>Aucune inscription enregistrée.</p>}
        </section>}
      />
    </div>
  </>;
}

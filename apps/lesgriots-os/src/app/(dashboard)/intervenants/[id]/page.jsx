'use client';

/**
 * /intervenants/[id] — la fiche d'un formateur.
 *
 * L'indicateur 21 du référentiel national qualité demande de prouver la
 * compétence de ceux qui animent, pas de l'affirmer. Et dès 5 000 € de
 * prestation, la loi impose de vérifier tous les six mois la vigilance
 * URSSAF de son sous-traitant. Ces deux exigences se traduisent en dates,
 * et une date périmée est signalée ici en rouge plutôt que découverte le
 * jour de l'audit.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import FicheEntite, { styleCarte, styleAttenue, styleTitre } from '@/components/donnees/FicheEntite';

const BLOCS = [
  {
    id: 'identite', titre: 'Identité',
    intro: 'Ce qui figure sur le contrat, la convention et le programme remis aux apprenants.',
    champs: [
      { cle: 'first_name', libelle: 'Prénom', requis: true },
      { cle: 'last_name', libelle: 'Nom', requis: true },
      { cle: 'email', libelle: 'E-mail', type: 'email', aide: 'C’est par là que partent les convocations et les documents à signer.', requis: true },
      { cle: 'phone', libelle: 'Téléphone' },
      { cle: 'contrat_type', libelle: 'Nature du lien', options: ['Salarié', 'Prestation de services', 'Sous-traitance', 'Bénévole'], aide: 'La sous-traitance déclenche des obligations que le salariat n’a pas.' },
      { cle: 'statut_juridique', libelle: 'Statut juridique', aide: 'Auto-entrepreneur, SASU, portage salarial, intermittent.' },
    ],
  },
  {
    id: 'competence', titre: 'Preuve de compétence',
    intro: 'Indicateur 21 : l’auditeur veut voir, pour chaque intervenant, une preuve datée de ce qu’il sait faire. Indicateur 22 : la preuve qu’il continue de se former.',
    champs: [
      { cle: 'domaines', libelle: 'Domaines d’intervention', aide: 'Les formations qu’il peut animer. Sert aussi à choisir vite quand une date bouge.', lignes: 2, large: true, requis: true },
      { cle: 'qualifications', libelle: 'Diplômes et certifications', aide: 'Intitulé, organisme, année. C’est la pièce que l’auditeur ouvre en premier.', lignes: 2, large: true },
      { cle: 'biographie', libelle: 'Parcours', aide: 'Trois lignes de références réelles, reprises telles quelles sur le programme.', lignes: 3, large: true },
      { cle: 'cv_date', libelle: 'Date du CV au dossier', type: 'date', aide: 'Un CV de plus de deux ans se fait retoquer. Celui-ci est la preuve de l’indicateur 21.' },
      { cle: 'date_dernier_dev_pro', libelle: 'Dernier développement professionnel', type: 'date', aide: 'Formation, conférence, veille formalisée. C’est l’indicateur 22.' },
      { cle: 'evaluation', libelle: 'Note moyenne des apprenants', aide: 'Sur 10. Alimente ton bilan qualité.' },
    ],
  },
  {
    id: 'conformite', titre: 'Conformité de la sous-traitance',
    intro: 'À remplir dès que l’intervenant n’est pas salarié. Sans ces pièces, tu es solidairement responsable en cas de contrôle, et la prestation peut être requalifiée.',
    champs: [
      { cle: 'siret', libelle: 'SIRET', aide: 'Quatorze chiffres. Sans lui, aucune facture de sa part n’est régulière.' },
      { cle: 'nda_numero', libelle: 'Numéro de déclaration d’activité', aide: 'S’il est lui-même organisme de formation. Utile pour la sous-traitance pédagogique.' },
      { cle: 'assurance_rc', libelle: 'Assurance responsabilité civile', aide: 'Assureur et numéro de police.' },
      { cle: 'assurance_echeance', libelle: 'Échéance de la RC pro', type: 'date', aide: 'Une police périmée le jour de la session te laisse sans couverture.' },
      { cle: 'urssaf_vigilance_date', libelle: 'Attestation de vigilance URSSAF', type: 'date', aide: 'Obligatoire dès 5 000 € de prestation, à renouveler tous les six mois.' },
      { cle: 'tarif_jour', libelle: 'Tarif journalier', aide: 'En euros. Alimente le calcul de marge de chaque session.' },
    ],
  },
];

const INDISPENSABLES = [
  ['last_name', 'le nom'],
  ['email', 'l’e-mail'],
  ['domaines', 'les domaines d’intervention, exigés par l’indicateur 21'],
];

/** Une date de plus de N mois est périmée. */
function perime(valeur, mois) {
  if (!valeur) return false;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - mois);
  return d < limite;
}

export default function FicheIntervenantPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [fiche, setFiche] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    fetch(`/api/formateurs/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Intervenant introuvable')))
      .then((d) => { setFiche(d); setBrouillon(d); })
      .catch((e) => setErreur(e.message));
  }, [id]);

  const modifie = fiche && Object.keys(brouillon).some((k) => brouillon[k] !== fiche[k]);

  const alertes = useMemo(() => {
    const l = [];
    const soustraite = ['Prestation de services', 'Sous-traitance'].includes(brouillon.contrat_type);
    if (soustraite && !String(brouillon.siret || '').trim()) l.push('Intervenant non salarié sans SIRET : ses factures ne sont pas régulières.');
    if (perime(brouillon.urssaf_vigilance_date, 6)) l.push('Attestation de vigilance URSSAF de plus de six mois : à redemander.');
    if (brouillon.assurance_echeance && new Date(brouillon.assurance_echeance) < new Date()) l.push('Assurance responsabilité civile échue.');
    if (perime(brouillon.cv_date, 24)) l.push('CV de plus de deux ans : la preuve de compétence de l’indicateur 21 est faible.');
    if (perime(brouillon.date_dernier_dev_pro, 24)) l.push('Aucun développement professionnel depuis deux ans : l’indicateur 22 sera relevé.');
    return l;
  }, [brouillon]);

  const enregistrer = async () => {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/formateurs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brouillon) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible');
      setFiche(d); setBrouillon(d);
      setMessage('Fiche enregistrée.');
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  if (!fiche) return <><TopBar title="Intervenant" /><div style={{ padding: 24, ...styleAttenue }}>{erreur || 'Chargement…'}</div></>;

  return <>
    <TopBar title={[fiche.first_name, fiche.last_name].filter(Boolean).join(' ') || 'Intervenant'} subtitle={fiche.specialite || fiche.contrat_type || ''} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
      <Link href="/intervenants" style={{ ...styleAttenue, textDecoration: 'none' }}>← Tous les intervenants</Link>
      {alertes.length > 0 && <section style={{ ...styleCarte, borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)', background: 'var(--danger-soft)' }}>
        <h2 style={styleTitre}>À traiter avant la prochaine session</h2>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text)', fontSize: 13, lineHeight: 1.7 }}>
          {alertes.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>}
      <FicheEntite
        blocs={BLOCS} indispensables={INDISPENSABLES} valeurs={brouillon}
        onChange={(cle, v) => setBrouillon((c) => ({ ...c, [cle]: v }))}
        onEnregistrer={enregistrer} modifie={modifie} occupe={occupe}
        message={message} erreur={erreur}
      />
    </div>
  </>;
}

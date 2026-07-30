'use client';

/**
 * /lieux/[id] — la fiche d'un lieu de formation.
 *
 * Deux lecteurs : l'apprenant, qui doit savoir où aller, comment y entrer et
 * à quelle heure ; l'auditeur Qualiopi, qui vérifie l'indicateur 26, celui de
 * l'accueil des personnes en situation de handicap. Les deux se servent des
 * mêmes champs, alors on les tient une fois pour toutes.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import FicheEntite, { styleCarte, styleAttenue, styleTitre } from '@/components/donnees/FicheEntite';

const BLOCS = [
  {
    id: 'ou', titre: 'Où, et comment y entrer',
    intro: 'Ce bloc part tel quel dans la convocation. Un apprenant qui cherche la porte est un apprenant en retard.',
    champs: [
      { cle: 'nom', libelle: 'Nom du lieu', aide: 'Celui que l’apprenant lira sur sa convocation.', requis: true },
      { cle: 'type_lieu', libelle: 'Type de lieu', options: ['Nos locaux', 'Locaux du client', 'Lieu loué', 'Distanciel'], aide: 'Détermine qui est responsable de l’accueil et de la sécurité.' },
      { cle: 'adresse', libelle: 'Adresse', aide: 'Numéro et rue, sans abréviation.', requis: true },
      { cle: 'postal_code', libelle: 'Code postal', requis: true },
      { cle: 'ville', libelle: 'Ville', requis: true },
      { cle: 'acces_transport', libelle: 'Accès', aide: 'Métro, gare, parking, code de la porte. C’est ce qu’on te demande la veille au téléphone.', lignes: 2, large: true },
      { cle: 'horaires_acces', libelle: 'Horaires d’ouverture', aide: 'À quelle heure le lieu ouvre vraiment, pas l’heure de la formation.' },
      { cle: 'capacite', libelle: 'Capacité', aide: 'Nombre de places assises. Elle plafonne tes inscriptions.', type: 'number' },
    ],
  },
  {
    id: 'accessibilite', titre: 'Accessibilité',
    intro: 'Indicateur 26 du référentiel national qualité. Un auditeur ne demande pas si tu es accessible, il demande ce que tu réponds à quelqu’un qui te pose la question.',
    champs: [
      { cle: 'accessibilite_pmr', libelle: 'Accessibilité PMR', aide: 'Décris la réalité : plain-pied, ascenseur, rampe, ou non accessible et solution de repli.', lignes: 3, large: true, requis: true },
      { cle: 'referent_handicap', libelle: 'Référent handicap sur place', aide: 'Nom et téléphone de qui prévenir. Un référent sans coordonnées ne sert à rien.' },
      { cle: 'consignes_securite', libelle: 'Consignes de sécurité', aide: 'Issues de secours, point de rassemblement, consignes à énoncer en début de session.', lignes: 2 },
    ],
  },
  {
    id: 'exploitation', titre: 'Exploitation',
    intro: 'Ce qu’il faut pour animer et pour calculer la marge réelle d’une session.',
    champs: [
      { cle: 'equipements', libelle: 'Équipements', aide: 'Vidéoprojecteur, paperboard, wifi et son mot de passe, prises. Ce qui manque, tu l’apportes.', lignes: 2, large: true },
      { cle: 'contact_nom', libelle: 'Contact sur place', aide: 'La personne qui ouvre la porte.' },
      { cle: 'contact_tel', libelle: 'Téléphone du contact' },
      { cle: 'contact_email', libelle: 'E-mail du contact' },
      { cle: 'cout_location', libelle: 'Coût de location', aide: 'Par jour. Sans lui, la marge affichée sur la session est fausse.' },
      { cle: 'notes', libelle: 'Notes', lignes: 2, large: true },
    ],
  },
];

const INDISPENSABLES = [
  ['nom', 'le nom du lieu'],
  ['adresse', 'l’adresse'],
  ['ville', 'la ville'],
  ['accessibilite_pmr', 'la réponse accessibilité, exigée par l’indicateur 26'],
];

export default function FicheLieuPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [fiche, setFiche] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    fetch(`/api/lieux-formation/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Lieu introuvable')))
      .then((d) => { setFiche(d); setBrouillon(d); setSessions(d.sessions || []); })
      .catch((e) => setErreur(e.message));
  }, [id]);

  const modifie = fiche && Object.keys(brouillon).some((k) => brouillon[k] !== fiche[k]);

  const enregistrer = async () => {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/lieux-formation/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(brouillon) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement impossible');
      setFiche({ ...d, sessions }); setBrouillon({ ...d, sessions });
      setMessage('Fiche enregistrée. Les convocations utiliseront ces informations.');
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  if (!fiche) return <><TopBar title="Lieu de formation" /><div style={{ padding: 24, ...styleAttenue }}>{erreur || 'Chargement…'}</div></>;

  return <>
    <TopBar title={fiche.nom || 'Lieu de formation'} subtitle={[fiche.postal_code, fiche.ville].filter(Boolean).join(' ')} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
      <Link href="/lieux" style={{ ...styleAttenue, textDecoration: 'none' }}>← Tous les lieux</Link>
      <FicheEntite
        blocs={BLOCS} indispensables={INDISPENSABLES} valeurs={brouillon}
        onChange={(cle, v) => setBrouillon((c) => ({ ...c, [cle]: v }))}
        onEnregistrer={enregistrer} modifie={modifie} occupe={occupe}
        message={message} erreur={erreur}
        enfants={<section style={styleCarte}>
          <h2 style={styleTitre}>Sessions tenues ici</h2>
          <p style={{ ...styleAttenue, margin: '6px 0 12px' }}>{sessions.length} session(s).</p>
          {sessions.length ? <div style={{ display: 'grid', gap: 8 }}>
            {sessions.slice(0, 12).map((s) => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13 }}>{s.formation_title || s.session_name || s.id}</b>
              <Link href={`/sessions/${s.id}`} style={{ color: 'var(--gold)', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Ouvrir →</Link>
            </div>)}
          </div> : <p style={{ ...styleAttenue, margin: 0 }}>Aucune session n’a encore eu lieu ici.</p>}
        </section>}
      />
    </div>
  </>;
}

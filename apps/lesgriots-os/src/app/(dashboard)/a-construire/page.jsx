'use client';

/**
 * /a-construire — ce qui manque, écrit noir sur blanc.
 *
 * Le menu Configuration promettait sept écrans qui n'existaient pas : les
 * liens ouvraient une page au hasard, souvent celle des coordonnées
 * bancaires. Plutôt que de faire disparaître ces intentions, on les pose
 * ici, avec ce qu'elles feraient et pourquoi elles comptent.
 *
 * Une page comme celle-ci n'a de valeur que si elle reste vraie : chaque
 * ligne qui se construit doit en sortir le jour même.
 */

import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';

const carte = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const attenue = { color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.6 };

const CHANTIERS = [
  {
    titre: 'Comptes d’accès',
    urgence: 'Le plus utile',
    quoi: 'Ouvrir un accès à quelqu’un d’autre, avec ses droits : qui peut voir les apprenants, qui peut envoyer des e-mails, qui peut facturer.',
    pourquoi: 'Aujourd’hui il n’existe aucun écran pour créer un accès. Tu es seul, mais tu ne le resteras pas.',
  },
  {
    titre: 'Modèles de documents',
    quoi: 'Choisir l’en-tête, le pied de page et les mentions de tes conventions, convocations et attestations, au lieu de les subir.',
    pourquoi: 'Les documents se génèrent déjà, mais leur mise en forme est écrite dans le code.',
  },
  {
    titre: 'Formulaire public d’inscription',
    quoi: 'Une page publique où quelqu’un demande à s’inscrire, qui alimente directement tes demandes d’inscription.',
    pourquoi: 'L’écran Inscriptions liste les demandes reçues ; rien ne permet encore d’en recevoir depuis l’extérieur.',
  },
  {
    titre: 'Domaines de compétences',
    quoi: 'Un référentiel de compétences réutilisable, rattaché aux programmes et aux blocs pédagogiques.',
    pourquoi: 'Les compétences sont aujourd’hui du texte libre, différent d’un programme à l’autre.',
  },
  {
    titre: 'Notifications',
    quoi: 'Décider ce qui te fait signe : une session incomplète, une pièce expirée, un questionnaire sans réponse.',
    pourquoi: 'Les alertes existent déjà mais ne vivent que dans les écrans où on les affiche.',
  },
  {
    titre: 'Interconnexions',
    quoi: 'Le lien vers l’extérieur : Mon Compte Formation, les portails OPCO, la facturation électronique.',
    pourquoi: 'La réception des factures au format électronique devient obligatoire au 1er septembre 2026.',
  },
  {
    titre: 'Catalogue en ligne',
    quoi: 'La page publique de tes formations, avec les dates ouvertes à l’inscription.',
    pourquoi: 'Le catalogue existe dans l’OS mais ne sort pas vers le public.',
  },
];

export default function AConstruirePage() {
  return <>
    <TopBar title="Ce qui reste à construire" subtitle={`${CHANTIERS.length} chantiers, écrits noir sur blanc`} />
    <div style={{ padding: '0 24px 48px', maxWidth: 900, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 14 }}>

      <section style={carte}>
        <p style={{ ...attenue, margin: 0, color: 'var(--text-2)' }}>
          Le menu Configuration promettait sept écrans qui n’existaient pas : les liens ouvraient une page au hasard,
          souvent celle des coordonnées bancaires. Ces entrées ont été retirées du menu et posées ici, avec ce qu’elles
          feraient et pourquoi elles comptent. Un menu qui ment coûte plus cher qu’un menu court.
        </p>
      </section>

      {CHANTIERS.map((c) => (
        <section key={c.titre} style={carte}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '-.02em' }}>{c.titre}</h2>
            {c.urgence && (
              <span style={{
                fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em',
                padding: '3px 8px', borderRadius: 999, background: 'var(--gold-soft)', color: 'var(--text)',
                border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
              }}>{c.urgence}</span>
            )}
          </div>
          <p style={{ margin: '8px 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{c.quoi}</p>
          <p style={{ ...attenue, margin: 0 }}>{c.pourquoi}</p>
        </section>
      ))}

      <p style={{ ...attenue, margin: 0 }}>
        Ce qui existe déjà se trouve dans le menu :{' '}
        <Link href="/parametres-formation" style={{ color: 'var(--gold)', textDecoration: 'none' }}>identité de l’organisme</Link>,{' '}
        <Link href="/organisme" style={{ color: 'var(--gold)', textDecoration: 'none' }}>pièces de l’organisme</Link>,{' '}
        <Link href="/emails" style={{ color: 'var(--gold)', textDecoration: 'none' }}>modèles d’e-mails</Link> et{' '}
        <Link href="/espace-apprenant" style={{ color: 'var(--gold)', textDecoration: 'none' }}>espace apprenant</Link>.
      </p>
    </div>
  </>;
}

/**
 * email-inscription.mjs — l'accusé de réception d'une demande d'inscription.
 *
 * Deux messages partent, et ils n'ont pas le même métier.
 *
 * Au candidat : ce à quoi il vient de s'inscrire, écrit dans le corps du
 * message. Pas en pièce jointe. Quelqu'un qui vient de remplir un formulaire
 * lit son téléphone dans la minute qui suit ; il n'ouvrira pas un PDF pour
 * savoir à quelle date il doit se libérer. Le programme complet arrivera plus
 * tard, avec la convocation, quand sa place sera confirmée.
 *
 * À l'organisme : une notification courte. Quelqu'un s'est inscrit, voilà ce
 * qu'il a déclaré, il reste tant de places. Sans cela, une demande peut
 * dormir trois jours avant qu'on la voie.
 */

import { envoyerEmail, expediteur } from './mailer.js';
import { emailHtml } from './email-html.js';

const texte = (v) => String(v ?? '').trim();

const jourFr = (v) => {
  if (!v) return '';
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

/** Les trois lignes de la session, sans sous-titres : elles vivent déjà sous un intitulé. */
function recapitulatif(s) {
  const debut = jourFr(s.start_date);
  const fin = jourFr(s.end_date);
  const quand = fin && fin !== debut ? `Du ${debut}\nau ${fin}` : `Le ${debut}`;
  return [quand, texte(s.horaire), texte(s.adresse) || texte(s.location)].filter(Boolean).join('\n');
}

/**
 * Le message au candidat.
 *
 * Il répond à trois questions, dans cet ordre, et s'arrête : qu'est-ce que
 * vous avez enregistré de moi, à quoi je viens de postuler, et quand aurai-je
 * une réponse.
 *
 * Deux pièges évités ici. Le premier : dire deux fois la même chose. Le texte
 * de suite configurable commençait par « nous avons bien reçu votre demande »,
 * juste après une phrase qui disait déjà exactement cela. Le second : écrire
 * « si une information est inexacte, corrigez-nous » sans montrer aucune des
 * informations saisies. On ne repère pas une erreur dans ce qu'on ne voit pas.
 *
 * Rien sur le matériel à prévoir : à ce stade la place n'est pas confirmée.
 * Le matériel appartient à la convocation.
 */
export async function accuserInscription({
  apprenant, session, suite = {}, financement = '', reglages = {},
}) {
  const titre = texte(session.formation_titre) || 'votre formation';
  const prenom = texte(apprenant.first_name);
  const nom = [apprenant.first_name, apprenant.last_name].filter(Boolean).join(' ');
  const fin = texte(financement);

  const bloc = [
    `Bonjour${prenom ? ` ${prenom}` : ''},`,
    '',
    `Nous avons bien reçu votre demande d'inscription à la formation « ${titre} ».`,
    '',
    'VOTRE DEMANDE',
    ...[nom, texte(apprenant.email), fin ? `Financement envisagé : ${fin}` : ''].filter(Boolean),
    '',
    'LA SESSION VISÉE',
    recapitulatif(session),
    '',
    "Si l'une de ces informations est inexacte, répondez à ce message : nous la corrigeons.",
    '',
    'LA SUITE',
    texte(suite.message)
      || 'Nous examinons votre demande et revenons vers vous sous 3 jours ouvrés.',
    "Dès que votre place est confirmée, vous recevez votre convocation, le programme détaillé et l'accès à votre espace apprenant.",
  ];

  if (texte(suite.lienRdv)) {
    bloc.push(
      '',
      'EN PARLER AVANT',
      texte(suite.texteRdv) || 'Vous préférez en parler de vive voix ? Choisissez un créneau.',
      texte(suite.lienRdv),
    );
  }

  bloc.push('', 'Bien à vous,', `L'équipe ${texte(reglages.company_name) || 'LES GRIOTS'}`);

  const corps = bloc.join('\n');
  const pied = [
    texte(reglages.company_name) || 'LES GRIOTS',
    reglages.nda ? `Déclaration d’activité n° ${reglages.nda}` : '',
    reglages.siret ? `SIRET ${reglages.siret}` : '',
    texte(reglages.email),
  ].filter(Boolean).join(' · ');

  return envoyerEmail({
    destinataire: texte(apprenant.email),
    destinataire_nom: nom,
    objet: `Votre demande d'inscription · ${titre}`,
    corps,
    html: emailHtml({
      titre: `Votre demande d'inscription · ${titre}`,
      corps,
      lien: texte(suite.lienRdv),
      pied,
    }),
    template_key: 'inscription_recue',
    contexte_type: 'session',
    contexte_id: session.id,
  });
}

/** La notification à l'organisme : courte, et elle dit ce qui a été déclaré. */
export async function prevenirOrganisme({
  apprenant, session, reponses = [], placesRestantes = null, reglages = {},
}) {
  const destinataire = texte(reglages.email);
  if (!destinataire) return { statut: 'ignore' };

  const titre = texte(session.formation_titre) || 'une formation';
  const nom = [apprenant.last_name?.toUpperCase(), apprenant.first_name].filter(Boolean).join(' ');

  const corps = [
    `${nom} vient de demander une inscription à « ${titre} ».`,
    '',
    `Adresse : ${texte(apprenant.email)}`,
    placesRestantes !== null ? `Places restantes : ${placesRestantes}` : '',
    '',
    reponses.length ? 'DÉCLARÉ AU FORMULAIRE' : '',
    ...reponses.map((r) => `• ${r.libelle} : ${r.valeur === true ? 'oui' : r.valeur}`),
    '',
    'Le positionnement est déjà consigné sur son inscription. Il reste à statuer.',
  ].filter((l) => l !== undefined).join('\n');

  return envoyerEmail({
    destinataire,
    destinataire_nom: texte(reglages.company_name) || 'LES GRIOTS',
    objet: `Nouvelle inscription — ${nom} · ${titre}`,
    corps,
    html: emailHtml({
      titre: `Nouvelle inscription — ${titre}`,
      corps,
      pied: `Notification automatique · ${expediteur()}`,
    }),
    template_key: 'inscription_notification',
    contexte_type: 'session',
    contexte_id: session.id,
  });
}

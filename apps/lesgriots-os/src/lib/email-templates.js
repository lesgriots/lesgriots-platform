/**
 * Email Templates LES GRIOTS — inspirés de Practical Project Management (The Futur).
 *
 * Structure de chaque template :
 *   key         : identifiant unique
 *   label       : nom affiché
 *   description : à quoi sert ce template
 *   icon        : emoji compact pour le sélecteur
 *   fields      : variables saisies par l'utilisateur (le projet/client donne les autres)
 *   subject({ project, client, vars }) : génère la ligne objet
 *   body({ project, client, vars })    : génère le corps de l'email
 *
 * Helpers de fields :
 *   - type 'text' : input simple
 *   - type 'date' : date picker
 *   - type 'list' : liste éditable (puces) — array de strings
 *   - type 'textarea' : multi-lignes
 */

const fmtDateFr = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const firstName = (client) => {
  if (!client) return 'Client';
  return client.firstName || (client.company ? client.company.split(' ')[0] : 'Client');
};

const projectName = (project) => project?.name || 'votre projet';

// ─────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────

export const EMAIL_TEMPLATES = [
  {
    key: 'approval-request',
    label: 'Approval Request',
    description: 'Confirmer par écrit un accord verbal du client. PPM/The Futur.',
    icon: '✓',
    fields: [
      {
        key: 'subjectFocus',
        label: 'Sujet (élément approuvé)',
        type: 'text',
        placeholder: 'Logo Design · Website Copy · Identité visuelle…',
        defaultFromProject: (p) => p?.name || '',
      },
      {
        key: 'approvedItems',
        label: 'Éléments approuvés',
        type: 'list',
        placeholder: 'Un élément par ligne',
        defaultValue: [],
      },
      {
        key: 'deadline',
        label: 'Deadline de retour',
        type: 'date',
        defaultValue: () => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow.toISOString().slice(0, 10);
        },
      },
      {
        key: 'nextPhase',
        label: 'Prochaine phase',
        type: 'textarea',
        placeholder: 'Décrire ce qui démarre une fois la validation reçue (ex : montage, étalonnage, livraison finale…)',
        rows: 2,
        defaultValue: '',
      },
    ],
    subject: ({ project, vars }) => {
      const focus = vars.subjectFocus || project?.name || 'Validation';
      return `Approval Request: ${focus}`;
    },
    body: ({ project, client, vars }) => {
      const items = Array.isArray(vars.approvedItems) ? vars.approvedItems : [];
      const itemsLines = items.length
        ? items.map(i => `• ${i}`).join('\n')
        : '• [À remplir : élément 1 approuvé]\n• [Élément 2 approuvé]\n• [Élément 3 approuvé]';
      const deadlineStr = vars.deadline ? fmtDateFr(vars.deadline) : 'demain';
      const nextPhase = vars.nextPhase?.trim() || '[Décrire la prochaine phase ici]';

      return `Hey ${firstName(client)} !

J'espère que tu vas bien. Je suis très enthousiaste à l'idée de passer à la prochaine phase de notre collaboration. Pour cela, je voulais confirmer par écrit ton retour de notre échange aujourd'hui.

Voici ce que j'ai retenu :

${itemsLines}

Merci de me confirmer que tout ci-dessus est correct, ou de me signaler si j'ai manqué quelque chose, d'ici ${deadlineStr}.

Une fois la confirmation reçue, l'équipe pourra démarrer la phase suivante : ${nextPhase}.

Comme toujours, n'hésite pas si tu as des questions.

Merci !
${firstName({ firstName: 'Moos' })}
LES GRIOTS · ${projectName(project)}`;
    },
  },

  // ───────────────────────────────────────────────────────
  // Client Onboarding — PPM Chapter 04
  // ───────────────────────────────────────────────────────
  {
    key: 'client-onboarding',
    label: 'Client Onboarding',
    description: 'Email d\'accueil après signature. Pose le cadre, fixe le kickoff, demande les inputs.',
    icon: '👋',
    fields: [
      {
        key: 'kickoffDate',
        label: 'Date de kickoff proposée',
        type: 'date',
        defaultValue: () => {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          return d.toISOString().slice(0, 10);
        },
      },
      {
        key: 'inputsNeeded',
        label: 'Inputs demandés au client',
        type: 'list',
        placeholder: 'Un élément par ligne',
        defaultValue: [
          'Brief écrit (1-2 pages)',
          'Charte graphique existante / logo / typo',
          'Accès aux comptes (Google Drive, réseaux, etc.)',
          'Liste des décideurs côté client',
          'Références visuelles inspirantes',
        ],
      },
      {
        key: 'deadlineInputs',
        label: 'Deadline pour recevoir les inputs',
        type: 'date',
        defaultValue: () => {
          const d = new Date();
          d.setDate(d.getDate() + 5);
          return d.toISOString().slice(0, 10);
        },
      },
    ],
    subject: ({ project }) => `Bienvenue dans la collaboration — ${projectName(project)}`,
    body: ({ project, client, vars }) => {
      const inputs = Array.isArray(vars.inputsNeeded) ? vars.inputsNeeded : [];
      const inputsLines = inputs.map(i => `• ${i}`).join('\n');
      const kickoff = vars.kickoffDate ? fmtDateFr(vars.kickoffDate) : '[date à confirmer]';
      const deadline = vars.deadlineInputs ? fmtDateFr(vars.deadlineInputs) : '[date à confirmer]';

      return `Hey ${firstName(client)},

Très heureux de démarrer cette collaboration. Voici comment on va travailler ensemble pour que tout se passe smooth.

📅 KICKOFF
Je te propose un kickoff le ${kickoff} (45 min). On y alignera périmètre, objectifs, deadlines et qui décide quoi. Confirme-moi ce créneau ou propose-moi une alternative.

📦 INPUTS À M'ENVOYER D'ICI LE ${deadline.toUpperCase()}
${inputsLines}

🗓 RYTHME DE COLLABORATION
• Un point hebdo (15 min) pour caler le statut
• Toute validation client par écrit (mention "approuvé" suffit)
• Délai de retour client : 3 jours ouvrés max pour ne pas décaler les livraisons
• Tout changement de scope discuté avant exécution

Si tu as des questions sur le process ou les livrables, n'hésite pas.

À très vite,
Moos
LES GRIOTS · ${projectName(project)}`;
    },
  },

  // ───────────────────────────────────────────────────────
  // Internal Kickoff — PPM Chapter 05
  // ───────────────────────────────────────────────────────
  {
    key: 'internal-kickoff',
    label: 'Internal Kickoff',
    description: 'Brief équipe interne avant démarrage. Aligne le pourquoi, le quoi, le comment.',
    icon: '🎯',
    fields: [
      {
        key: 'goal',
        label: 'Goal (le pourquoi du projet)',
        type: 'textarea',
        placeholder: 'Pourquoi le client fait ça ? Quel résultat business vise-t-il ?',
        rows: 2,
        defaultFromProject: (p) => p?.creativeBrief?.goal || '',
      },
      {
        key: 'deliverables',
        label: 'Livrables clés',
        type: 'list',
        placeholder: 'Un livrable par ligne',
        defaultValue: [],
      },
      {
        key: 'risks',
        label: 'Risques à surveiller',
        type: 'list',
        placeholder: 'Un risque par ligne (deadline serrée, budget tendu, scope flou, etc.)',
        defaultValue: [],
      },
      {
        key: 'kickoffMeetingDate',
        label: 'Date kickoff interne',
        type: 'date',
        defaultValue: () => new Date().toISOString().slice(0, 10),
      },
    ],
    subject: ({ project }) => `Kickoff interne — ${projectName(project)}`,
    body: ({ project, client, vars }) => {
      const deliverables = Array.isArray(vars.deliverables) ? vars.deliverables : [];
      const dlLines = deliverables.length
        ? deliverables.map(d => `• ${d}`).join('\n')
        : '• [À remplir]';
      const risks = Array.isArray(vars.risks) ? vars.risks : [];
      const riskLines = risks.length
        ? risks.map(r => `⚠️ ${r}`).join('\n')
        : '⚠️ [À identifier ensemble en kickoff]';
      const meetingDate = vars.kickoffMeetingDate ? fmtDateFr(vars.kickoffMeetingDate) : 'à caler';
      const clientName = client?.company || (client ? `${client.firstName} ${client.lastName}`.trim() : '[Client]');

      return `Team,

On démarre le projet ${projectName(project)} pour ${clientName}.
Kickoff interne le ${meetingDate}.

🎯 GOAL
${vars.goal || '[À compléter — pourquoi le client fait ce projet]'}

📦 LIVRABLES
${dlLines}

⚠️ RISQUES À SURVEILLER
${riskLines}

📐 PROCESS
• Tout passe par le dashboard LES GRIOTS OS (tâches, journal, dépenses)
• Validation client toujours par écrit
• Toute modif de scope remontée à Moos avant exécution
• Check-in hebdo (15 min) sur le projet

Préparez vos questions pour le kickoff. On veut sortir de cette réu avec un planning solide et zéro ambiguïté.

À mardi,
Moos`;
    },
  },

  // ───────────────────────────────────────────────────────
  // Delivery Email — PPM Chapter 13
  // ───────────────────────────────────────────────────────
  {
    key: 'delivery',
    label: 'Delivery Email',
    description: 'Livraison finale au client. Récap, fichiers, droits, prochaines étapes.',
    icon: '📦',
    fields: [
      {
        key: 'deliverables',
        label: 'Livrables transmis',
        type: 'list',
        placeholder: 'Un livrable par ligne avec format',
        defaultValue: [
          'Master final (.mp4 H.264, 1080p)',
          'Version raw (.mov ProRes 422)',
          'Visuels clés (.jpg + .psd)',
          'Charte graphique (.pdf)',
        ],
      },
      {
        key: 'fileLink',
        label: 'Lien WeTransfer / Dropbox / Drive',
        type: 'text',
        placeholder: 'https://…',
      },
      {
        key: 'linkExpiry',
        label: 'Le lien expire le',
        type: 'date',
        defaultValue: () => {
          const d = new Date();
          d.setDate(d.getDate() + 14);
          return d.toISOString().slice(0, 10);
        },
      },
      {
        key: 'usageRights',
        label: 'Droits d\'usage cédés',
        type: 'textarea',
        placeholder: 'Durée, territoire, médias couverts',
        rows: 2,
        defaultValue: 'Droits cédés : monde entier, tous médias numériques et imprimés, pour 5 ans à compter de la livraison. Toute exploitation TV / cinéma / hors-cadre à négocier séparément.',
      },
    ],
    subject: ({ project }) => `Livraison finale — ${projectName(project)}`,
    body: ({ project, client, vars }) => {
      const deliverables = Array.isArray(vars.deliverables) ? vars.deliverables : [];
      const dlLines = deliverables.length
        ? deliverables.map(d => `• ${d}`).join('\n')
        : '• [À remplir]';
      const link = vars.fileLink || '[Lien à insérer]';
      const expiry = vars.linkExpiry ? fmtDateFr(vars.linkExpiry) : '[date]';

      return `Hey ${firstName(client)},

Le projet ${projectName(project)} est livré. Voici tout ce qu'il te faut.

📦 LIVRABLES
${dlLines}

🔗 LIEN DE TÉLÉCHARGEMENT
${link}
Le lien expire le ${expiry} — pense à archiver les fichiers de ton côté avant cette date.

⚖️ DROITS D'USAGE
${vars.usageRights || '[À compléter]'}

✅ PROCHAINES ÉTAPES
1. Vérifie que tu as bien reçu et téléchargé tous les fichiers
2. Confirme-moi la bonne réception par retour de mail
3. Si tu as des questions sur l'utilisation, je suis dispo
4. La facture finale arrive sous 48h — règlement à 30 jours

💛 UN MOT
Ce projet a été un vrai plaisir à mener avec toi. Si tu es content du résultat, un témoignage écrit (2-3 phrases) ou une recommandation autour de toi serait inestimable.

Merci pour ta confiance,
Moos
LES GRIOTS`;
    },
  },

  // ───────────────────────────────────────────────────────
  // Redirecting The Team — PPM Chapter 11
  // ───────────────────────────────────────────────────────
  {
    key: 'redirect-team',
    label: 'Redirecting The Team',
    description: 'Recadrer une dérive sans casser le moral. PPM/The Futur.',
    icon: '🧭',
    fields: [
      {
        key: 'whatHappened',
        label: 'Ce qui dérive (factuel)',
        type: 'textarea',
        placeholder: 'Décrire le problème en mode constat, sans jugement',
        rows: 3,
      },
      {
        key: 'whyItMatters',
        label: 'Pourquoi ça pose problème',
        type: 'textarea',
        placeholder: 'Impact sur le projet, le client, l\'équipe',
        rows: 2,
      },
      {
        key: 'expectedAction',
        label: 'Ce qu\'on fait maintenant',
        type: 'textarea',
        placeholder: 'Action concrète attendue + qui + quand',
        rows: 2,
      },
    ],
    subject: ({ project }) => `Réajustement — ${projectName(project)}`,
    body: ({ project, vars }) => {
      return `Team,

Petit point de cadrage rapide sur ${projectName(project)}. Pas un drama, juste un réajustement nécessaire pour qu'on reste alignés.

📋 CE QUE J'OBSERVE
${vars.whatHappened || '[À compléter — fait factuel observé]'}

🎯 POURQUOI ÇA COMPTE
${vars.whyItMatters || '[À compléter — impact sur le projet/client]'}

🚀 CE QU'ON FAIT MAINTENANT
${vars.expectedAction || '[À compléter — action concrète, qui, quand]'}

Je sais que vous donnez le meilleur sur ce projet. Ce message vise pas à pointer, juste à recaler ensemble. Si quelque chose bloque que je devrais savoir, dites-le-moi en DM.

Merci à vous,
Moos`;
    },
  },
];

export const EMAIL_TEMPLATES_MAP = Object.fromEntries(EMAIL_TEMPLATES.map(t => [t.key, t]));

// ─────────────────────────────────────────────────────────
// Templates La Griothèque — emails du cycle de vie d'une session
// (Griothèque Pro / Qualiopi).
//
// Contexte reçu : { session, formation, lieu, horaire, formateurName, lien }
// Voix : souverain et calme, vouvoiement pro chaleureux.
// Signature : « L'équipe La Griothèque ».
// ─────────────────────────────────────────────────────────

const fmtPeriode = (session) => {
  const start = fmtDateFr(session?.start_date);
  const end = fmtDateFr(session?.end_date);
  if (start && end && start !== end) return `du ${start} au ${end}`;
  return start ? `le ${start}` : '[dates à confirmer]';
};

const SIGNATURE_GRIOTHEQUE = `Bien à vous,
L'équipe La Griothèque
LES GRIOTS — Organisme de formation
formation@lesgriots.com`;

export const GRIOTHEQUE_EMAIL_TEMPLATES = [
  {
    key: 'convocation',
    label: 'Convocation',
    description: 'Convocation officielle à la session : dates, lieu, horaires, accès.',
    icon: '📅',
    subject: ({ formation }) => `Convocation — ${formation?.title || 'Votre formation'} · La Griothèque`,
    body: ({ session, formation, lieu, horaire, formateurName, materiel }) => {
      const titre = formation?.title || 'votre formation';
      const lieuStr = lieu || session?.adresse || session?.location || '[lieu à confirmer]';
      const horaireStr = horaire || session?.horaire || '09h00 - 12h30 / 14h00 - 17h30';
      // Ce qu'il faut apporter vient des prérequis du programme. Aucun
      // prérequis, aucune rubrique : une généralité vaut moins que rien.
      const aPrevoir = (materiel || []).length
        ? `\n\n🎒 MATÉRIEL REQUIS\n${materiel.map((x) => `• ${x}`).join('\n')}`
        : '';

      return `Bonjour,

Nous avons le plaisir de vous confirmer votre participation à la formation « ${titre} », qui se tiendra ${fmtPeriode(session)}.

📅 DATES
${fmtPeriode(session)}

📍 LIEU
${lieuStr}

🕘 HORAIRES
${horaireStr}

👤 FORMATION ANIMÉE PAR
${formateurName || 'L\'équipe pédagogique La Griothèque'}${aPrevoir}

♿ ACCESSIBILITÉ
Si vous êtes en situation de handicap ou avez besoin d'un aménagement particulier, signalez-le-nous dès maintenant : nous adapterons l'accueil et la pédagogie.

Nous restons à votre disposition pour toute question d'ici la formation.

${SIGNATURE_GRIOTHEQUE}`;
    },
  },

  {
    key: 'rappel_j7',
    label: 'Rappel J-7',
    description: 'Rappel une semaine avant la session avec les infos pratiques.',
    icon: '⏰',
    subject: ({ formation }) => `Votre formation approche — ${formation?.title || 'La Griothèque'}`,
    body: ({ session, formation, lieu, horaire, materiel }) => {
      const titre = formation?.title || 'votre formation';
      const lieuStr = lieu || session?.adresse || session?.location || '[lieu à confirmer]';
      const horaireStr = horaire || session?.horaire || '09h00 - 12h30 / 14h00 - 17h30';
      const aPrevoir = (materiel || []).length
        ? `\n\n🎒 MATÉRIEL REQUIS\n${materiel.map((x) => `• ${x}`).join('\n')}`
        : '';

      return `Bonjour,

Votre formation « ${titre} » commence dans une semaine, ${fmtPeriode(session)}. Voici un rappel des informations pratiques.

📍 LIEU
${lieuStr}

🕘 HORAIRES
${horaireStr}
Nous vous accueillons dès 15 minutes avant le début de la première journée.

✅ AVANT LA FORMATION
• Si vous ne l'avez pas encore fait, merci de compléter le questionnaire de positionnement qui vous a été transmis
• Vérifiez votre trajet et vos accès
• En cas d'empêchement, prévenez-nous au plus vite pour que nous trouvions une solution ensemble${aPrevoir}

Nous nous réjouissons de vous accueillir.

${SIGNATURE_GRIOTHEQUE}`;
    },
  },

  {
    key: 'enquete_chaud',
    label: 'Enquête à chaud',
    description: 'Enquête de satisfaction envoyée juste après la session (indicateur 30).',
    icon: '🔥',
    subject: ({ formation }) => `Votre avis compte — ${formation?.title || 'La Griothèque'}`,
    body: ({ session, formation, lien }) => {
      const titre = formation?.title || 'la formation';

      return `Bonjour,

Merci d'avoir participé à la formation « ${titre} » ${fmtPeriode(session)}.

Votre regard nous est précieux : il nourrit directement l'amélioration de nos formations. Nous vous invitons à prendre 5 minutes pour répondre à notre enquête de satisfaction.

👉 RÉPONDRE À L'ENQUÊTE
${lien || '{lien}'}

Vos réponses sont traitées avec attention par notre équipe pédagogique. Chaque remarque est lue, chaque suggestion est étudiée.

Merci pour votre confiance.

${SIGNATURE_GRIOTHEQUE}`;
    },
  },

  {
    key: 'enquete_froid',
    label: 'Enquête à froid',
    description: 'Enquête d\'impact envoyée environ 3 mois après la session (indicateur 30).',
    icon: '❄️',
    subject: ({ formation }) => `Quelques semaines après — ${formation?.title || 'La Griothèque'}`,
    body: ({ formation, lien }) => {
      const titre = formation?.title || 'votre formation';

      return `Bonjour,

Il y a quelques semaines, vous participiez à la formation « ${titre} ». Avec le recul, qu'en reste-t-il dans votre pratique ?

Nous aimerions savoir ce que la formation a réellement changé pour vous : mises en pratique, résultats concrets, points restés en suspens. Ce retour à froid est essentiel pour mesurer l'impact durable de nos formations.

👉 RÉPONDRE À L'ENQUÊTE (3 minutes)
${lien || '{lien}'}

Et si de nouveaux besoins de formation ont émergé depuis, parlons-en : notre catalogue évolue avec vous.

Merci pour votre temps et votre confiance.

${SIGNATURE_GRIOTHEQUE}`;
    },
  },

  {
    key: 'envoi_attestation',
    label: 'Envoi attestation',
    description: 'Envoi de l\'attestation de fin de formation (indicateur 11).',
    icon: '🎓',
    subject: ({ formation }) => `Votre attestation de formation — ${formation?.title || 'La Griothèque'}`,
    body: ({ session, formation }) => {
      const titre = formation?.title || 'votre formation';

      return `Bonjour,

Vous trouverez ci-joint votre attestation de fin de formation pour « ${titre} », suivie ${fmtPeriode(session)}.

Ce document officiel atteste de votre participation et des compétences travaillées. Conservez-le précieusement : il peut vous être demandé par votre employeur, votre OPCO ou dans le cadre d'un financement CPF.

📎 PIÈCE JOINTE
Attestation de fin de formation (PDF)

Si une information est inexacte ou s'il vous manque un document (certificat de réalisation, facture, programme), écrivez-nous : nous vous le transmettrons rapidement.

Ce fut un plaisir de vous compter parmi nous. Au plaisir de vous retrouver pour une prochaine formation.

${SIGNATURE_GRIOTHEQUE}`;
    },
  },

  {
    key: 'convention',
    label: 'Convention de formation',
    description: 'Mise à disposition de la convention de formation dans l’espace apprenant.',
    icon: '📄',
    subject: ({ formation }) => `Votre convention — ${formation?.title || 'La Griothèque'}`,
    body: ({ formation }) => `Bonjour,

Votre convention de formation pour « ${formation?.title || 'votre formation'} » est prête. Vous la trouverez en pièce jointe, accompagnée du programme détaillé.

Merci de nous la retourner signée avant le début de la formation. Elle reste également consultable depuis votre Espace Apprenant.

Si une information doit être corrigée, répondez directement à cet e-mail afin que nous puissions la mettre à jour.

${SIGNATURE_GRIOTHEQUE}`,
  },

  {
    key: 'devis',
    label: 'Devis',
    description: 'Envoi du devis au client, avec le programme de formation en pièce jointe.',
    icon: '🧾',
    subject: ({ formation }) => `Votre devis — ${formation?.title || 'La Griothèque'}`,
    body: ({ formation }) => `Bonjour,

Vous trouverez en pièce jointe le devis pour la formation « ${formation?.title || 'votre formation'} », accompagné du programme détaillé.

Pour l'accepter, retournez-le signé avec la mention « Bon pour accord ». L'acceptation vaut commande : une convention de formation sera alors établie.

En cas de prise en charge par un organisme financeur, merci de nous transmettre l'accord de prise en charge avant le début de l'action.

${SIGNATURE_GRIOTHEQUE}`,
  },

  {
    key: 'document_session',
    label: 'Document de session',
    description: 'Partage d’un document lié à une session de formation.',
    icon: '📎',
    subject: ({ formation }) => `Un document pour votre session — ${formation?.title || 'La Griothèque'}`,
    body: ({ formation }) => `Bonjour,

Un document concernant votre session « ${formation?.title || 'votre formation'} » est disponible.

Vous pouvez le consulter depuis votre Espace Apprenant, accessible depuis le lien ci-dessous.

Pour toute question ou correction, répondez directement à cet e-mail.

${SIGNATURE_GRIOTHEQUE}`,
  },
];

/*
 * La relance de signature.
 *
 * Un seul modèle, deux tons. Le premier rappel suppose l'oubli et facilite le
 * geste. Le second dit ce qui se passe si rien n'arrive, sans menacer : la
 * place est tenue pour quelqu'un, et ce quelqu'un peut être un autre. C'est
 * de l'organisation, pas du chantage, et ça se dit comme tel.
 *
 * Pas de relance de paiement dans cette liste : les factures ne sortent pas
 * de cet outil.
 */
GRIOTHEQUE_EMAIL_TEMPLATES.push({
  key: 'relance_signature',
  label: 'Relance de signature',
  description: 'Rappelle une pièce envoyée et non retournée signée.',
  icon: '✍️',
  subject: ({ formation, vars }) => (vars?.dernier
    ? `Dernier rappel : ${vars?.piece || 'document'} — ${formation?.title || 'La Griothèque'}`
    : `${vars?.piece || 'Document'} en attente de signature — ${formation?.title || 'La Griothèque'}`),
  body: ({ session, formation, vars }) => {
    const titre = formation?.title || 'votre formation';
    const piece = vars?.piece || 'le document';
    const debut = session?.start_date
      ? new Date(`${String(session.start_date).slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const corps = vars?.dernier
      ? `Bonjour,

${piece.charAt(0).toUpperCase()}${piece.slice(1)} pour « ${titre} » ne nous est pas revenu signé.

${debut ? `La session commence le ${debut}. ` : ''}Sans document signé, nous ne pouvons pas tenir la place plus longtemps : nous refusons des candidatures pour ces places, et il serait injuste de les garder bloquées.

Ce n'est pas une menace, c'est de l'organisation. Deux façons de faire : signer, scanner et répondre à ce message, ou déposer le document depuis votre espace.

Et si quelque chose bloque, un point à corriger, un accord de financement en attente, dites-le-nous : on trouve une solution.`
      : `Bonjour,

Nous vous avons transmis ${piece} pour la formation « ${titre} », et nous ne l'avons pas encore reçu signé.

${debut ? `La session débute le ${debut}. ` : ''}Il s'agit probablement d'un oubli.

Deux façons de faire : signer, scanner et répondre à ce message, ou déposer le document depuis votre espace.

Si un point doit être corrigé avant signature, répondez-nous, nous le reprenons.`;

    return `${corps}

${SIGNATURE_GRIOTHEQUE}`;
  },
});

export const GRIOTHEQUE_EMAIL_TEMPLATES_MAP = Object.fromEntries(
  GRIOTHEQUE_EMAIL_TEMPLATES.map(t => [t.key, t])
);

/**
 * Résout les defaults d'un template à l'instanciation.
 */
export function getDefaultsForTemplate(template, project) {
  const out = {};
  for (const f of template.fields) {
    if (typeof f.defaultFromProject === 'function') {
      out[f.key] = f.defaultFromProject(project);
    } else if (typeof f.defaultValue === 'function') {
      out[f.key] = f.defaultValue();
    } else if (f.defaultValue !== undefined) {
      out[f.key] = Array.isArray(f.defaultValue) ? [...f.defaultValue] : f.defaultValue;
    } else {
      out[f.key] = f.type === 'list' ? [] : '';
    }
  }
  return out;
}

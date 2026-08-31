// Schéma + valeurs par défaut du contenu éditorial du site lagriotheque.
//
// PHASE 1 — Textes visibles à fort impact.
//   - home    : hero tagline + manifesto
//   - approche: 3 piliers + lede
//   - catalogue, workshops, ressources, agenda : intros de page
//   - faq     : 4 questions génériques répétées sur chaque page formation
//
// Chaque clé peut être étendue : ajoute un champ ici + son label dans
// SITE_CONTENT_SECTIONS, et il devient éditable dans /site/content.
//
// Le helper côté site (text("path", fallback)) lit window.SITE_CONTENT et
// retombe sur le texte hardcodé du composant si la valeur est vide. Donc on
// peut introduire de nouvelles clés sans toucher le site immédiatement.

export const SITE_CONTENT_DEFAULTS = {
  home: {
    // Le hero reel de la page d'accueil. Ces trois cles etaient lues par le
    // site depuis toujours mais n'existaient pas ici : la phrase affichee
    // venait du repli ecrit en dur dans app.jsx, donc elle n'etait pas
    // modifiable sans redeployer.
    hero_eyebrow: "L\u2019école qui transmet les outils pour que les créatifs bâtissent leur récit et vivent de leur passion.",
    manifesto: "Développe ta pratique, clarifie le récit que tu portes, structure tes projets, présente ton travail, trouve les bons partenaires, défends ta valeur et construis une activité qui te permet de durer.",
    // Les deux blocs « derniers contenus » de l'accueil.
    formations_heading: "Nos formations",
    formations_lede: "Des formations courtes et pratiques, pour tous les niveaux et toutes les disciplines. ",
    formations_lede_link: "Trouve la formation faite pour toi.",
    workshops_heading: "Nos workshops",
    workshops_lede: "Des formats courts et intensifs, en groupe restreint, pour pratiquer sur ton projet réel. ",
    workshops_lede_link: "Découvre les prochains workshops.",
    // Vidéo (ou image) de fond du hero. Vide = img/hero.mp4 hardcodé du site.
    hero_video: "",
    // Section « nouveaux imaginaires » (bas de la page d'accueil).
    vision_title: "nouveaux récits,\nnouveaux visages",
    vision_text: "La vision de La Griothèque est de permettre l'émergence de nouveaux récits.",
    vision_video: "",
  },

  approche: {
    title: "Notre approche",
    lede:
      "Trois points qui définissent l'ADN de LA GRIOTHÈQUE — ce qui nous rend différents d'un centre de formation comme les autres.",
    pilier1_title: "Le storytelling au centre",
    pilier1_body:
      "Le récit comme boussole. Stratégie, direction artistique, structure — tout en découle. Avant les outils, avant les formats, avant les plateformes, il y a l'histoire que tu portes et la façon dont les autres se la racontent.",
    pilier2_title: "Par des professionnels en activité",
    pilier2_body:
      "Universal, Sony, Accor Arena, Zéniths. Tes formateurs livrent maintenant — pas en 2015. La méthode arrive du terrain et y retourne. Pas de théorie hors-sol : ce qu'on enseigne, on le pratique encore.",
    pilier3_title: "Formations pratiques",
    pilier3_body:
      "Pédagogie par le faire — tes propres récits comme matière. Tu repars avec un livrable concret, pas un certificat. Plateforme de marque, plan éditorial, vidéo finie, calendrier — utilisable dès le lundi matin.",
    // Bloc partenaires, bas de la page Approche.
    partners_title: "Nos partenaires",
    partners_intro:
      "La Griothèque avance entourée de structures qui accompagnent, financent et font grandir les créatifs et les entrepreneurs.",
    about_lesgriots:
      "LES GRIOTS est une plateforme d'ingénierie narrative et une infrastructure culturelle afro-diasporique. La maison raconte ses propres histoires, structure et amplifie celles des artistes et des marques, et transmet à une nouvelle génération de créatifs de quoi bâtir de nouveaux imaginaires.",
  },

  catalogue: {
    heading: "Formations",
    // Le texte par defaut etait reste en Lorem ipsum. Il ne s'affichait pas
    // (la valeur du back office prenait le dessus), mais il serait remonte a
    // la premiere fois qu'on aurait vide le champ.
    intro:
      "Des formations conçues pour les créatifs qui veulent transformer leurs idées en projets solides.\n\nÀ travers la communication, l’image de marque et les réseaux sociaux, nous transmettons les outils et les méthodes nécessaires pour développer une pratique créative plus forte et plus visible.\n\nAnimées par des professionnels en activité, nos formations privilégient l’apprentissage par la pratique, en petits groupes, avec des formats certifiants et finançables selon les dispositifs disponibles.",
    sub: "Certifiante · éligible CPF · 12 places",
    media: "", // vidéo/image du hero de page (vide = img/hero.mp4)
  },

  workshops_page: {
    heading: "Workshops",
    intro:
      "Des formats courts et immersifs pour approfondir un sujet précis, développer de nouvelles compétences et passer à l’action.",
    sub: "",
    media: "",
  },

  ressources: {
    heading: "Ressources",
    intro:
      "Des outils, des conseils et des inspirations pour développer votre créativité, structurer vos projets et mieux comprendre les enjeux de la création, de la communication et de la stratégie de marque.",
    sub: "Méthodes · templates · études de cas",
    media: "",
  },

  agenda: {
    heading: "Agenda",
    intro:
      "Retrouvez les prochaines formations et workshops : dates, formats, disponibilités et modalités de participation.",
    sub: "Sessions ouvertes · inscription en ligne",
    media: "",
  },

  events_page: {
    heading: "Événements",
    intro:
      "La scène de La Griothèque, en vrai. Masterclasses, talks, soirées et projections pour se rencontrer, apprendre et bâtir ensemble.",
    sub: "",
    media: "",
  },

  contact: {
    title: "À propos",
    line1: "LA GRIOTHÈQUE",
    line2: "Organisme de formation",
    line3: "de la SASU LES GRIOTS",
    line4: "Certifié Qualiopi",
    email: "formations@lesgriots.com",
    instagram_url: "https://instagram.com/lagriotheque",
    instagram_label: "instagram",
    linkedin_url: "https://www.linkedin.com/company/lesgriots",
    linkedin_label: "linkedin",
    // Le lien vers le studio est pilote par le pied de page
    // (footer.col2_studio_url / col2_studio_label), pas ici.
  },

  financement: {
    title: "Comment s'inscrire et quel financement ?",
    col1_intro: "Pour toute question et inscription, écris-nous par mail :",
    col1_email: "formations@lesgriots.com",
    col1_response: "Nous répondons systématiquement sous deux jours ouvrés.",
    col1_eligibility:
      "Que tu sois inscrit·e à la MDA / Agessa, auto-entrepreneur·euse, entreprise individuelle ou dirigeant·e non salarié·e de SASU/EURL, tu cotises déjà pour ta formation professionnelle continue et tu disposes de possibilités de financement.",
    col2_intro:
      "Nous t'accompagnons et simplifions tes démarches administratives auprès des organismes de référence — OPCO (salariés), FAF / FIF-PL / AGEFICE / AFDAS (indépendants selon ton statut). EDOF en cours, CPF à venir.",
    col2_qualiopi:
      "LA GRIOTHÈQUE est le pilier formation de la SASU LES GRIOTS, certifié Qualiopi (Actions de formation), Lauréat French Tech, et déclaré sous le numéro NDA 28760747176 auprès de la DREETS Normandie — spécialité techniques de l'image et du son, métiers connexes du spectacle.",
    col2_accessibility:
      "Pour toute question d'accessibilité ou d'adaptation, merci de nous contacter par mail en amont de l'inscription.",
  },

  footer: {
    marquee:
      "TRANSMETTRE LES OUTILS ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES",
    qualiopi_caption:
      "La certification qualité a été délivrée au titre de la catégorie d'action : Actions de formation",
    col2_studio_label: "les griots studio",
    col2_plateforme_label: "plateforme éditoriale",
    col2_agence_label: "agence créative",
  },

  splash: {
    loading_target: "LOADING",
    cue: "[ ENTRER ]",
  },

  cgv: {
    title: "Conditions générales de vente",
    lede:
      "Applicables aux prestations de formation et d'accompagnement proposées par LA GRIOTHÈQUE, pilier formation de la SASU LES GRIOTS. Version mise à jour le 14 mars 2026.",
    footer_contact:
      "Pour toute question relative aux présentes CGV, contacter LA GRIOTHÈQUE à formations@lesgriots.com.",
  },

  mentions_legales: {
    title: "Mentions légales",
    lede:
      "Informations légales relatives au site lagriotheque.com, édité par la SASU LES GRIOTS. Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN). Version au 25 mai 2026.",
    footer_contact:
      "Pour toute question relative à ces mentions, contacter formations@lesgriots.com.",
  },

  confidentialite: {
    title: "Politique de confidentialité",
    lede:
      "Comment LA GRIOTHÈQUE traite les données personnelles collectées via ce site. Conforme au Règlement général sur la protection des données (RGPD, UE 2016/679) et à la Loi Informatique et Libertés. Version au 25 mai 2026.",
  },

  cta: {
    reserve_label: "Réserver ma place",
    payer_template: "Payer {price}",
    demande_label: "Demander une inscription",
  },

  // PAS ENCORE BRANCHE. Aucun envoi d'e-mail ne lit ces textes aujourd'hui :
  // ils sont ecrits d'avance, pour le jour ou le webhook Stripe et le
  // telechargement de ressource enverront vraiment un message. On les garde
  // plutot que de jeter du texte deja redige, mais rien ne les affiche.
  emails: {
    // Mail envoyé après achat Stripe d'un workshop (déclenché par webhook)
    welcome_subject: "Bienvenue dans LA GRIOTHÈQUE — confirmation de ta place",
    welcome_intro:
      "Merci pour ton inscription au workshop. Tu trouveras ci-dessous le récapitulatif de ton achat et les prochaines étapes pour préparer la session.",
    welcome_signoff: "À très vite,\nL'équipe LA GRIOTHÈQUE",
    // Mail envoyé après téléchargement d'une ressource (lead-gate)
    lead_gate_subject: "Voici ta ressource — LA GRIOTHÈQUE",
    lead_gate_intro:
      "Merci pour ton intérêt. Tu trouveras le téléchargement de la ressource demandée ci-dessous. On reste en contact pour les prochaines parutions.",
    lead_gate_signoff: "Bonne lecture,\nL'équipe LA GRIOTHÈQUE",
  },

  faq: {
    // Q1 : CPF — la réponse change selon si la formation est éligible CPF
    q_cpf: "Puis-je financer cette formation via mon CPF ?",
    a_cpf_yes:
      "Oui, cette formation est éligible CPF. Tu peux t'inscrire directement depuis Mon Compte Formation.",
    a_cpf_no:
      "Cette formation n'est pas éligible CPF, mais des prises en charge OPCO ou FAF sont possibles selon ton statut. Contacte-nous pour étudier un montage.",
    // Q2 : délais d'inscription
    q_delais: "Quels sont les délais d'inscription ?",
    a_delais:
      "Réponse à toute demande sous 48h ouvrées. Inscription possible jusqu'à 14 jours avant le démarrage de la session, dans la limite des places disponibles.",
    // Q3 : après la formation
    q_apres: "Que se passe-t-il après la formation ?",
    a_apres:
      "Tu reçois une attestation de fin de formation. Pour les formations certifiantes, le passage de certification est intégré. Nous gardons le contact via notre newsletter et l'accès à la communauté Griothèque.",
    // Q4 : accessibilité — fallback affiché si la formation n'a pas de texte
    // d'accessibilité custom dans son champ formation.accessibility
    q_handicap: "La formation est-elle accessible aux personnes en situation de handicap ?",
    a_handicap_fallback:
      "Oui. Contacte notre référent handicap pour un entretien préalable et adapter les modalités à ta situation.",
  },
  // Page "Bientôt" (coming soon). S'affiche sur tout le site quand l'accueil
  // est désactivé (Pages → Accueil OFF). Modifiable ici.
  launch: {
    media: "img/hero.mp4",
    title: "Transmettre à une nouvelle génération de créatifs les outils pour bâtir leur récit et vivre de leur passion.",
    text: "Le site arrive très bientôt. Laisse ton email pour être prévenu en premier.",
    cta: "Me prévenir →",
    success: "Merci. On te tient au courant.",
    name_placeholder: "Ton prénom",
    placeholder: "ton@email.com",
    tel_placeholder: "06 00 00 00 00",
    legal: "En t'inscrivant, tu acceptes de recevoir les actualités de LA GRIOTHÈQUE. Désinscription en 1 clic, à tout moment.",
    poster: "img/launch-poster.jpg",
    invalid: "Email invalide, vérifie l'adresse.",
    error: "Une erreur est survenue, réessaie dans un instant.",
  },
};

// Description de la structure pour l'UI du back office.
// Chaque section est un onglet/accordéon dans la page /site/content.
// Pour ajouter un champ : ajoute-le dans SITE_CONTENT_DEFAULTS ci-dessus,
// puis liste-le ici avec son label et son type (text, textarea, html).
export const SITE_CONTENT_SECTIONS = [
  {
    key: "home",
    title: "Page d'accueil",
    desc: "Hero, manifeste, blocs formations et workshops, section vision.",
    fields: [
      { key: "hero_eyebrow", label: "Hero — la phrase (première ligne)", type: "textarea", rows: 3 },
      { key: "manifesto", label: "Manifeste (paragraphe sous le hero)", type: "textarea", rows: 8 },
      { key: "formations_heading", label: "Bloc formations — titre", type: "text" },
      { key: "formations_lede", label: "Bloc formations — chapô", type: "textarea", rows: 3 },
      { key: "formations_lede_link", label: "Bloc formations — fin de phrase cliquable", type: "text" },
      { key: "workshops_heading", label: "Bloc workshops — titre", type: "text" },
      { key: "workshops_lede", label: "Bloc workshops — chapô", type: "textarea", rows: 3 },
      { key: "workshops_lede_link", label: "Bloc workshops — fin de phrase cliquable", type: "text" },
      { key: "hero_video", label: "Vidéo hero (fond plein écran — vide = hero.mp4 par défaut)", type: "upload" },
      { key: "vision_title", label: "Section « nouveaux imaginaires » — titre", type: "textarea", rows: 2 },
      { key: "vision_text", label: "Section « nouveaux imaginaires » — texte", type: "textarea", rows: 5 },
      { key: "vision_video", label: "Section « nouveaux imaginaires » — vidéo/image de fond", type: "upload" },
    ],
  },
  {
    key: "approche",
    title: "Notre approche",
    desc: "Titre, intro, les 3 piliers qui définissent l'ADN.",
    fields: [
      { key: "title", label: "Titre de la page", type: "text" },
      { key: "lede", label: "Intro (lede)", type: "textarea", rows: 3 },
      { key: "pilier1_title", label: "Pilier 1 — titre", type: "text" },
      { key: "pilier1_body", label: "Pilier 1 — texte", type: "textarea", rows: 4 },
      { key: "pilier2_title", label: "Pilier 2 — titre", type: "text" },
      { key: "pilier2_body", label: "Pilier 2 — texte", type: "textarea", rows: 4 },
      { key: "pilier3_title", label: "Pilier 3 — titre", type: "text" },
      { key: "pilier3_body", label: "Pilier 3 — texte", type: "textarea", rows: 4 },
      { key: "partners_title", label: "Bloc partenaires — titre", type: "text" },
      { key: "partners_intro", label: "Bloc partenaires — texte", type: "textarea", rows: 3 },
      { key: "about_lesgriots", label: "À propos — LES GRIOTS, la maison (texte long)", type: "textarea", rows: 8 },
    ],
  },
  {
    key: "catalogue",
    title: "Catalogue (formations)",
    desc: "Intro affichée en tête de la liste des formations.",
    fields: [
      { key: "heading", label: "Titre de la page", type: "text" },
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court (· · ·)", type: "text" },
      { key: "media", label: "Vidéo/image du hero de page (vide = défaut)", type: "upload" },
    ],
  },
  {
    key: "workshops_page",
    title: "Page Workshops",
    desc: "Intro affichée en tête de la liste des workshops.",
    fields: [
      { key: "heading", label: "Titre de la page", type: "text" },
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
      { key: "media", label: "Vidéo/image du hero de page (vide = défaut)", type: "upload" },
    ],
  },
  {
    key: "ressources",
    title: "Page Ressources",
    desc: "Intro affichée en tête de la liste des ressources téléchargeables.",
    fields: [
      { key: "heading", label: "Titre de la page", type: "text" },
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
      { key: "media", label: "Vidéo/image du hero de page (vide = défaut)", type: "upload" },
    ],
  },
  {
    key: "agenda",
    title: "Page Agenda",
    desc: "Intro affichée en tête de l'agenda des sessions.",
    fields: [
      { key: "heading", label: "Titre de la page", type: "text" },
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
      { key: "media", label: "Vidéo/image du hero de page (vide = défaut)", type: "upload" },
    ],
  },
  {
    key: "events_page",
    title: "Page Événements",
    desc: "Titre + intro affichés en tête de la page Événements.",
    fields: [
      { key: "heading", label: "Titre de la page", type: "text" },
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
      { key: "media", label: "Vidéo/image du hero de page (vide = pas de bandeau)", type: "upload" },
    ],
  },
  {
    key: "faq",
    title: "FAQ générique (pages formations)",
    desc: "Les 4 questions/réponses affichées dans l'onglet FAQ de chaque page formation. Les réponses CPF et handicap s'adaptent selon les paramètres de chaque formation.",
    fields: [
      { key: "q_cpf", label: "Q1 — CPF (titre)", type: "text" },
      { key: "a_cpf_yes", label: "Q1 — Réponse si éligible CPF", type: "textarea", rows: 3 },
      { key: "a_cpf_no", label: "Q1 — Réponse si non éligible CPF", type: "textarea", rows: 3 },
      { key: "q_delais", label: "Q2 — Délais (titre)", type: "text" },
      { key: "a_delais", label: "Q2 — Réponse", type: "textarea", rows: 3 },
      { key: "q_apres", label: "Q3 — Après la formation (titre)", type: "text" },
      { key: "a_apres", label: "Q3 — Réponse", type: "textarea", rows: 3 },
      { key: "q_handicap", label: "Q4 — Accessibilité (titre)", type: "text" },
      { key: "a_handicap_fallback", label: "Q4 — Réponse par défaut (si formation sans texte custom)", type: "textarea", rows: 3 },
    ],
  },
  {
    key: "contact",
    title: "Page Contact",
    desc: "Carte d'identité de LA GRIOTHÈQUE + liens sociaux.",
    fields: [
      { key: "title", label: "Titre de la page (interne)", type: "text" },
      { key: "line1", label: "Présentation (texte long, affiché en tête de la page)", type: "textarea", rows: 6 },
      { key: "line2", label: "Ligne 2", type: "text" },
      { key: "line3", label: "Ligne 3", type: "text" },
      { key: "line4", label: "Ligne 4", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "instagram_label", label: "Instagram — libellé", type: "text" },
      { key: "instagram_url", label: "Instagram — URL", type: "text" },
      { key: "linkedin_label", label: "LinkedIn — libellé", type: "text" },
      { key: "linkedin_url", label: "LinkedIn — URL", type: "text" },
    ],
  },
  {
    key: "financement",
    title: "Page Financement",
    desc: "Deux colonnes : modalités d'inscription + dispositifs de prise en charge.",
    fields: [
      { key: "title", label: "Titre", type: "text" },
      { key: "col1_intro", label: "Col 1 — Intro", type: "textarea", rows: 2 },
      { key: "col1_email", label: "Col 1 — Email", type: "text" },
      { key: "col1_response", label: "Col 1 — Réponse / délai", type: "text" },
      { key: "col1_eligibility", label: "Col 1 — Public éligible", type: "textarea", rows: 4 },
      { key: "col2_intro", label: "Col 2 — Dispositifs", type: "textarea", rows: 4 },
      { key: "col2_qualiopi", label: "Col 2 — Qualiopi / NDA", type: "textarea", rows: 5 },
      { key: "col2_accessibility", label: "Col 2 — Accessibilité", type: "textarea", rows: 3 },
    ],
  },
  {
    key: "footer",
    title: "Footer (toutes les pages)",
    desc: "Marquee texte du bas + libellés colonnes secondaires + caption Qualiopi.",
    fields: [
      { key: "marquee", label: "Marquee défilant (bas de page)", type: "textarea", rows: 2 },
      { key: "qualiopi_caption", label: "Caption Qualiopi", type: "textarea", rows: 2 },
      { key: "col2_studio_label", label: "Lien — studio", type: "text" },
      { key: "col2_plateforme_label", label: "Lien — plateforme éditoriale", type: "text" },
      { key: "col2_agence_label", label: "Lien — agence créative", type: "text" },
    ],
  },
  {
    key: "splash",
    title: "Splash (1ʳᵉ arrivée)",
    desc: "Écran d'accueil affiché brièvement à la 1ʳᵉ visite.",
    fields: [
      { key: "loading_target", label: "Texte de chargement (cible scramble)", type: "text" },
      { key: "cue", label: "Cue [ENTRER]", type: "text" },
    ],
  },
  {
    key: "cgv",
    title: "Page CGV — titre + lede",
    desc: "Titre et chapeau de la page CGV. Le corps juridique reste intégré au code (à éditer via merge si besoin).",
    fields: [
      { key: "title", label: "Titre", type: "text" },
      { key: "lede", label: "Chapeau / lede", type: "textarea", rows: 4 },
      { key: "footer_contact", label: "Ligne de contact en bas", type: "textarea", rows: 2 },
    ],
  },
  {
    key: "mentions_legales",
    title: "Page Mentions légales — titre + lede",
    desc: "Titre et chapeau de la page Mentions légales.",
    fields: [
      { key: "title", label: "Titre", type: "text" },
      { key: "lede", label: "Chapeau / lede", type: "textarea", rows: 4 },
      { key: "footer_contact", label: "Ligne de contact en bas", type: "textarea", rows: 2 },
    ],
  },
  {
    key: "confidentialite",
    title: "Page Confidentialité — titre + lede",
    desc: "Titre et chapeau de la politique de confidentialité.",
    fields: [
      { key: "title", label: "Titre", type: "text" },
      { key: "lede", label: "Chapeau / lede", type: "textarea", rows: 4 },
    ],
  },
  {
    key: "cta",
    title: "Libellés CTA (boutons)",
    desc: "Textes des boutons d'action utilisés partout sur le site. {price} est remplacé par le prix dynamique de la formation.",
    fields: [
      { key: "reserve_label", label: "Bouton « Réserver »", type: "text" },
      { key: "payer_template", label: "Bouton « Payer » (utiliser {price})", type: "text" },
      { key: "demande_label", label: "Bouton « Demander une inscription »", type: "text" },
    ],
  },
  {
    key: "emails",
    title: "Templates emails",
    desc: "Sujets et accroches des emails transactionnels (bienvenue Stripe, lead-gate ressource).",
    fields: [
      { key: "welcome_subject", label: "Mail bienvenue (achat workshop) — sujet", type: "text" },
      { key: "welcome_intro", label: "Mail bienvenue — intro", type: "textarea", rows: 4 },
      { key: "welcome_signoff", label: "Mail bienvenue — signature", type: "textarea", rows: 3 },
      { key: "lead_gate_subject", label: "Mail lead-gate (téléchargement ressource) — sujet", type: "text" },
      { key: "lead_gate_intro", label: "Mail lead-gate — intro", type: "textarea", rows: 4 },
      { key: "lead_gate_signoff", label: "Mail lead-gate — signature", type: "textarea", rows: 3 },
    ],
  },
  {
    key: "launch",
    title: "Page « Bientôt » (coming soon)",
    desc: "S'affiche sur tout le site quand l'accueil est désactivé (Pages → Accueil OFF). Les emails saisis arrivent dans les Leads.",
    fields: [
      { key: "media", label: "Vidéo / image de fond", type: "upload" },
      { key: "poster", label: "Image de secours (si la vidéo ne démarre pas)", type: "upload" },
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte sous le titre", type: "textarea", rows: 3 },
      { key: "cta", label: "Bouton", type: "text" },
      { key: "success", label: "Message de remerciement (après envoi)", type: "text" },
      { key: "name_placeholder", label: "Placeholder du champ prénom", type: "text" },
      { key: "placeholder", label: "Placeholder du champ email", type: "text" },
      { key: "tel_placeholder", label: "Placeholder du champ téléphone", type: "text" },
      { key: "legal", label: "Mention légale sous le formulaire (consentement newsletter)", type: "textarea", rows: 2 },
      { key: "invalid", label: "Erreur — adresse invalide", type: "text" },
      { key: "error", label: "Erreur — envoi impossible", type: "text" },
    ],
  },
];

// Merge récursif (un niveau suffit, valeurs sont string) :
// utilisateur peut avoir un store partiel — on complète avec les défauts.
export function mergeSiteContent(stored) {
  const out = {};
  for (const section of Object.keys(SITE_CONTENT_DEFAULTS)) {
    out[section] = {
      ...SITE_CONTENT_DEFAULTS[section],
      ...((stored && stored[section]) || {}),
    };
  }
  // Préserve aussi des sections custom non encore listées (futur-proofing)
  if (stored) {
    for (const k of Object.keys(stored)) {
      if (!(k in out)) out[k] = stored[k];
    }
  }
  return out;
}

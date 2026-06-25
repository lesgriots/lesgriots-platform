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
    hero_tagline_line1: "L'école de transmission",
    hero_tagline_line2: "pour la nouvelle génération",
    hero_tagline_line3: "créative.",
    manifesto:
      "LA GRIOTHÈQUE est une école dédiée à la transmission de méthodes éprouvées sur le terrain, au croisement de la direction artistique, du récit de marque et de la production. Dans un paysage culturel saturé, où trop de talents avancent sans cadre et trop de récits puissants se dissipent faute de structure, nous offrons aux artistes, aux créatifs et aux entrepreneurs de la prochaine génération les outils pour bâtir leur récit et créer de nouveaux imaginaires.",
    latest_tab_formations: "Nos formations",
    latest_tab_workshops: "Workshops",
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
  },

  catalogue: {
    intro:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    sub: "Lorem ipsum · dolor sit amet · consectetur",
  },

  workshops_page: {
    intro:
      "Des formats courts, intenses, pour passer à l'action sur un sujet précis : récit de marque, structure éditoriale, négociation, propriété intellectuelle. Une journée pour repartir avec un livrable.",
    sub: "Formats courts · livrable concret · sans pré-requis",
  },

  ressources: {
    intro:
      "Outils, guides et frameworks issus de la méthode LA GRIOTHÈQUE. Téléchargeables après inscription — on garde le contact pour t'envoyer les mises à jour.",
    sub: "Méthodes · templates · études de cas",
  },

  agenda: {
    intro:
      "Les prochaines sessions ouvertes — formations longues et workshops. Inscription en ligne, financement CPF/OPCO possible sur la majorité des formats.",
    sub: "Sessions ouvertes · inscription en ligne",
  },

  contact: {
    title: "Contact",
    line1: "LA GRIOTHÈQUE",
    line2: "Organisme de formation",
    line3: "de la SASU LES GRIOTS",
    line4: "Certifié Qualiopi",
    location_main: "Présentiel à Paris",
    location_hq: "Siège social — Le Havre",
    email: "formations@lesgriots.com",
    instagram_url: "https://instagram.com/lagriotheque",
    instagram_label: "instagram",
    linkedin_url: "https://linkedin.com",
    linkedin_label: "linkedin",
    studio_url: "https://lesgriotsxstudio.com",
    studio_label: "lesgriotsxstudio.com",
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
      "TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES",
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
    telecharger_label: "Télécharger",
    demande_label: "Demander une inscription",
    contact_label: "Nous contacter",
  },

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
};

// Description de la structure pour l'UI du back office.
// Chaque section est un onglet/accordéon dans la page /site/content.
// Pour ajouter un champ : ajoute-le dans SITE_CONTENT_DEFAULTS ci-dessus,
// puis liste-le ici avec son label et son type (text, textarea, html).
export const SITE_CONTENT_SECTIONS = [
  {
    key: "home",
    title: "Page d'accueil",
    desc: "Hero, tagline, manifeste, libellés des onglets formations/workshops.",
    fields: [
      { key: "hero_tagline_line1", label: "Tagline — ligne 1", type: "text" },
      { key: "hero_tagline_line2", label: "Tagline — ligne 2", type: "text" },
      { key: "hero_tagline_line3", label: "Tagline — ligne 3", type: "text" },
      { key: "manifesto", label: "Manifeste (paragraphe sous le hero)", type: "textarea", rows: 8 },
      { key: "latest_tab_formations", label: "Onglet « Nos formations »", type: "text" },
      { key: "latest_tab_workshops", label: "Onglet « Workshops »", type: "text" },
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
    ],
  },
  {
    key: "catalogue",
    title: "Catalogue (formations)",
    desc: "Intro affichée en tête de la liste des formations.",
    fields: [
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court (· · ·)", type: "text" },
    ],
  },
  {
    key: "workshops_page",
    title: "Page Workshops",
    desc: "Intro affichée en tête de la liste des workshops.",
    fields: [
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
    ],
  },
  {
    key: "ressources",
    title: "Page Ressources",
    desc: "Intro affichée en tête de la liste des ressources téléchargeables.",
    fields: [
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
    ],
  },
  {
    key: "agenda",
    title: "Page Agenda",
    desc: "Intro affichée en tête de l'agenda des sessions.",
    fields: [
      { key: "intro", label: "Texte d'intro", type: "textarea", rows: 4 },
      { key: "sub", label: "Sous-titre court", type: "text" },
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
      { key: "line1", label: "Ligne 1 (nom de marque)", type: "text" },
      { key: "line2", label: "Ligne 2", type: "text" },
      { key: "line3", label: "Ligne 3", type: "text" },
      { key: "line4", label: "Ligne 4", type: "text" },
      { key: "location_main", label: "Lieu principal", type: "text" },
      { key: "location_hq", label: "Siège social", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "instagram_label", label: "Instagram — libellé", type: "text" },
      { key: "instagram_url", label: "Instagram — URL", type: "text" },
      { key: "linkedin_label", label: "LinkedIn — libellé", type: "text" },
      { key: "linkedin_url", label: "LinkedIn — URL", type: "text" },
      { key: "studio_label", label: "Studio — libellé", type: "text" },
      { key: "studio_url", label: "Studio — URL", type: "text" },
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
      { key: "telecharger_label", label: "Bouton « Télécharger »", type: "text" },
      { key: "demande_label", label: "Bouton « Demander une inscription »", type: "text" },
      { key: "contact_label", label: "Bouton « Nous contacter »", type: "text" },
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

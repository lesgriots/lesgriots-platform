export const PILLAR_MAP = {
  STUDIO: { label: "LESGRIOTSxSTUDIO", prefix: "STU", color: "#D4A843" },
  PROD: { label: "Production Originale", prefix: "PRD", color: "#8B6914" },
  GRIOTHEQUE: { label: "La Griothèque", prefix: "FOR", color: "#9B59B6" },
};

// ── Disciplines créatives LES GRIOTS ──
// Permet de trier les projets selon les axes signature.
// Un projet peut avoir 1, 2 ou les 3 disciplines.
export const DISCIPLINES = [
  {
    key: 'image',
    label: 'Image',
    icon: '◳',
    color: '#2670B4',  // bleu studio
    description: 'Photo, direction artistique, identité visuelle, branding visuel',
  },
  {
    key: 'stories',
    label: 'Stories',
    icon: '✎',
    color: '#B07A0E',  // saffron
    description: 'Récit, écriture, scénario, conception narrative',
  },
  {
    key: 'movement',
    label: 'Movement',
    icon: '↻',
    color: '#8347A1',  // violet prod
    description: 'Motion, vidéo, performance, chorégraphie, captation',
  },
];

export const DISCIPLINE_MAP = Object.fromEntries(DISCIPLINES.map(d => [d.key, d]));

// 7 catégories simples — alignées avec la grille comptable LES GRIOTS
export const EXPENSE_CATEGORIES = [
  "Sous-traitance",
  "Matériel & équipement",
  "Lieu (studio, salle)",
  "Transport & déplacements",
  "Repas & hébergement",
  "Logiciels & licences",
  "Autre",
];

// Couleurs associées pour les graphiques / badges
export const EXPENSE_CATEGORY_COLORS = {
  "Sous-traitance":            "#C46B3D", // terracotta
  "Matériel & équipement":     "#8347A1", // violet
  "Lieu (studio, salle)":      "#2670B4", // bleu
  "Transport & déplacements":  "#5C8F4A", // vert
  "Repas & hébergement":       "#B07A0E", // saffron
  "Logiciels & licences":      "#7A7066", // gris foncé
  "Autre":                     "#A6A6A6",
};

// Pipeline aligné sur le framework The Futur / Chris Do
// "The proposal should never be the first thing, and we hope it is not the last."
export const PIPELINE_STAGES = [
  // ── Sales funnel (The Futur) ──
  { key: "lead",        label: "Inquiry",        sublabel: "Premier contact",                color: "#555",    icon: "01" },
  { key: "need",        label: "Establish Need",  sublabel: "Besoin identifié",               color: "#6B6B6B", icon: "02" },
  { key: "qualify",     label: "Qualify",         sublabel: "Budget · timing · besoin OK",    color: "#8B6914", icon: "03" },
  { key: "quoted",      label: "Proposal",        sublabel: "Devis envoyé",                   color: "#C17817", icon: "04" },
  { key: "negotiation", label: "Négociation",     sublabel: "Ajustements en cours",           color: "#D4A843", icon: "🤝" },
  { key: "signed",      label: "Contract",        sublabel: "Signé — projet confirmé",        color: "#27AE60", icon: "05" },
  // ── Execution ──
  { key: "active",      label: "En cours",        sublabel: "Production active",              color: "#D4A843", icon: "⚡" },
  { key: "delivered",   label: "Livré",           sublabel: "En attente de paiement",         color: "#4A7C59", icon: "📦" },
  { key: "paid",        label: "Payé",            sublabel: "Mission accomplie",              color: "#2E8B57", icon: "💰" },
  { key: "lost",        label: "Perdu",           sublabel: "Pas conclu",                     color: "#C0392B", icon: "✕" },
];

export const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]));

export const EXPENSE_STATUS = {
  paid: { label: "Payé", color: "#4A7C59" },
  pending: { label: "En attente", color: "#D4A843" },
  overdue: { label: "En retard", color: "#C0392B" },
};

export const IP_REVENUE_SOURCES = [
  "Licensing", "Ventes", "Diffusion", "Coproduction",
  "Exposition", "Subvention", "Sponsoring", "Autre",
];

export const TVA_RATES = [
  { key: "20", label: "20% (taux normal)", rate: 0.20 },
  { key: "10", label: "10% (taux intermédiaire)", rate: 0.10 },
  { key: "5.5", label: "5,5% (taux réduit)", rate: 0.055 },
  { key: "2.1", label: "2,1% (taux super-réduit)", rate: 0.021 },
  { key: "0", label: "0% (franchise de base)", rate: 0 },
];

export const TVA_MAP = Object.fromEntries(TVA_RATES.map(t => [t.key, t]));

export const PROVIDER_CATEGORIES = [
  "Monteur", "Étalonneur / Coloriste", "Réal", "Motion designer",
  "Sound designer / Mixeur", "Cadreur / Chef op", "Photographe",
  "Graphiste / DA", "Maquilleur / Styliste", "Régisseur",
  "Danseur", "Chorégraphe", "Location matériel", "Location salle",
  "Autre",
];

export const PROJECT_TEMPLATES = [
  { key: "strategy", label: "Stratégie & Narration", pillar: "STUDIO", defaultBudget: 4000, priceRange: [2000, 6000],
    typicalExpenses: ["Déplacements", "Repas professionnels", "Logiciels & abonnements"],
    defaultLines: [],
    notes: "Prestation Strategy & Narrative — positionnement, récit de marque, plateforme narrative." },
  { key: "da", label: "Direction Artistique", pillar: "STUDIO", defaultBudget: 6000, priceRange: [4000, 8000],
    typicalExpenses: ["Sous-traitance créative", "Logiciels & abonnements", "Communication & pub"],
    defaultLines: [],
    notes: "Prestation DA — identité visuelle, direction créative, univers graphique." },
  { key: "production", label: "Production Audiovisuelle", pillar: "STUDIO", defaultBudget: 8000, priceRange: [2000, 15000],
    typicalExpenses: ["Sous-traitance créative", "Location matériel", "Location salle/studio", "Déplacements", "Hébergement"],
    defaultLines: [
      { label: "Réal", category: "Sous-traitance créative" },
      { label: "Monteur", category: "Sous-traitance créative" },
      { label: "Étalonneur / Coloriste", category: "Sous-traitance créative" },
      { label: "Location caméra", category: "Location matériel" },
      { label: "Location lumière", category: "Location matériel" },
      { label: "Location studio / décor", category: "Location salle/studio" },
      { label: "Déplacements", category: "Déplacements" },
      { label: "Hébergement", category: "Hébergement" },
    ],
    notes: "Prestation production AV — tournage, post-production, livrables vidéo." },
  { key: "movement", label: "Movement Direction", pillar: "STUDIO", defaultBudget: 0, priceRange: null,
    typicalExpenses: ["Déplacements", "Hébergement", "Sous-traitance créative", "Repas professionnels"],
    defaultLines: [],
    notes: "Direction du mouvement — chorégraphie, mise en scène corporelle. Sur devis." },
  { key: "ip", label: "Production Originale / IP", pillar: "PROD", defaultBudget: 0, priceRange: null,
    typicalExpenses: ["Sous-traitance créative", "Location matériel", "Location salle/studio", "Déplacements", "Hébergement", "Communication & pub"],
    defaultLines: [],
    notes: "IP propre LES GRIOTS — série, documentaire, installation. Sur devis." },
  { key: "formation", label: "Formation / Masterclass", pillar: "GRIOTHEQUE", defaultBudget: 3000, priceRange: [1500, 8000],
    typicalExpenses: ["Honoraires", "Location salle/studio", "Logiciels & abonnements", "Communication & pub", "Déplacements"],
    defaultLines: [
      { label: "Intervenant·e", category: "Honoraires" },
      { label: "Location salle", category: "Location salle/studio" },
      { label: "Communication", category: "Communication & pub" },
    ],
    notes: "Formation, masterclass ou workshop La Griothèque — présentiel ou distanciel." },
];

// Production task templates par type de projet
export const PRODUCTION_TASK_TEMPLATES = {
  strategy: [
    "Audit narratif & recherche",
    "Architecture de marque",
    "Plateforme narrative",
    "Rédaction livrables",
    "Présentation client",
    "Validation & ajustements",
    "Livraison finale",
  ],
  da: [
    "Références & inspirations",
    "Moodboard",
    "Direction artistique v1",
    "Feedback & ajustements",
    "DA finale",
    "Déclinaisons",
    "Validation client",
    "Livraison des fichiers",
  ],
  production: [
    "Écriture & storyboard",
    "Repérage lieux",
    "Casting",
    "Pré-production",
    "Tournage",
    "Montage rough cut",
    "Montage fine cut",
    "Validation client",
    "Étalonnage",
    "Sound design & mixage",
    "Motion & VFX",
    "Export masters",
    "Livraison",
  ],
  movement: [
    "Recherche & références mouvements",
    "Conception chorégraphique",
    "Répétitions",
    "Filage",
    "Captation / Tournage",
    "Montage",
    "Livraison",
  ],
  ip: [
    "Développement",
    "Écriture",
    "Pré-production",
    "Tournage / Production",
    "Montage",
    "Post-production",
    "Distribution & diffusion",
  ],
  dc: [
    "Brief créatif & immersion",
    "Recherche & références",
    "Analyse concurrentielle",
    "Concept créatif",
    "Moodboard & univers visuel",
    "Présentation concept",
    "Direction artistique",
    "Supervision création",
    "Retours & ajustements",
    "Validation finale",
    "Livraison des guidelines",
    "Archivage créatif",
  ],
  formation: [
    "Cadrage pédagogique",
    "Identification intervenant·e",
    "Convention de formation",
    "Conception du programme",
    "Création des supports",
    "Communication & inscriptions",
    "Logistique (salle / lien visio)",
    "Session de formation",
    "Émargement & évaluation",
    "Attestation de réalisation",
    "Bilan pédagogique",
    "Facturation & suivi paiement",
  ],
};

// Phase groups par template — pour colorer et titrer les sections dans la liste de tâches
export const TASK_PHASE_GROUPS = {
  strategy: [
    { label: "Recherche & stratégie", color: "#D4A843", tasks: ["Audit narratif & recherche", "Architecture de marque", "Plateforme narrative"] },
    { label: "Production", color: "#3498DB", tasks: ["Rédaction livrables", "Présentation client"] },
    { label: "Livraison", color: "#4A7C59", tasks: ["Validation & ajustements", "Livraison finale"] },
  ],
  da: [
    { label: "Exploration", color: "#D4A843", tasks: ["Références & inspirations", "Moodboard"] },
    { label: "Création", color: "#9B59B6", tasks: ["Direction artistique v1", "Feedback & ajustements", "DA finale", "Déclinaisons"] },
    { label: "Livraison", color: "#4A7C59", tasks: ["Validation client", "Livraison des fichiers"] },
  ],
  production: [
    { label: "Développement", color: "#D4A843", tasks: ["Écriture & storyboard", "Repérage lieux", "Casting"] },
    { label: "Pré-production", color: "#3498DB", tasks: ["Pré-production", "Tournage"] },
    { label: "Post-production", color: "#9B59B6", tasks: ["Montage rough cut", "Montage fine cut", "Validation client", "Étalonnage", "Sound design & mixage", "Motion & VFX"] },
    { label: "Livraison", color: "#4A7C59", tasks: ["Export masters", "Livraison"] },
  ],
  movement: [
    { label: "Création", color: "#D4A843", tasks: ["Recherche & références mouvements", "Conception chorégraphique", "Répétitions", "Filage"] },
    { label: "Captation", color: "#C0392B", tasks: ["Captation / Tournage"] },
    { label: "Post-production", color: "#9B59B6", tasks: ["Montage"] },
    { label: "Livraison", color: "#4A7C59", tasks: ["Livraison"] },
  ],
  ip: [
    { label: "Développement", color: "#D4A843", tasks: ["Développement", "Écriture"] },
    { label: "Production", color: "#C0392B", tasks: ["Pré-production", "Tournage / Production"] },
    { label: "Post-production", color: "#9B59B6", tasks: ["Montage", "Post-production"] },
    { label: "Diffusion", color: "#27AE60", tasks: ["Distribution & diffusion"] },
  ],
  dc: [
    { label: "Découverte", color: "#D4A843", tasks: ["Brief créatif & immersion", "Recherche & références", "Analyse concurrentielle"] },
    { label: "Concept", color: "#E67E22", tasks: ["Concept créatif", "Moodboard & univers visuel", "Présentation concept"] },
    { label: "Direction", color: "#9B59B6", tasks: ["Direction artistique", "Supervision création", "Retours & ajustements"] },
    { label: "Livraison", color: "#4A7C59", tasks: ["Validation finale", "Livraison des guidelines", "Archivage créatif"] },
  ],
  formation: [
    { label: "Ingénierie", color: "#9B59B6", tasks: ["Cadrage pédagogique", "Identification intervenant·e", "Convention de formation", "Conception du programme", "Création des supports"] },
    { label: "Déploiement", color: "#3498DB", tasks: ["Communication & inscriptions", "Logistique (salle / lien visio)", "Session de formation"] },
    { label: "Suivi qualité", color: "#4A7C59", tasks: ["Émargement & évaluation", "Attestation de réalisation", "Bilan pédagogique", "Facturation & suivi paiement"] },
  ],
};

// Lookup plat : titre de tâche → { label, color } de sa phase
export const TASK_TITLE_TO_PHASE = Object.values(TASK_PHASE_GROUPS).reduce((acc, groups) => {
  groups.forEach(({ label, color, tasks }) => {
    tasks.forEach(title => { acc[title] = { label, color }; });
  });
  return acc;
}, {});

// Types de tâches de production
export const TASK_TYPES = [
  { key: "recherche",    label: "Recherche",       color: "#8B6914" },
  { key: "ecriture",    label: "Écriture",         color: "#8B4513" },
  { key: "storyboard",  label: "Storyboard",       color: "#6B4C9A" },
  { key: "preprod",     label: "Pré-production",   color: "#2E6DA4" },
  { key: "tournage",    label: "Tournage",         color: "#C0392B" },
  { key: "montage",     label: "Montage",          color: "#3498DB" },
  { key: "etalonnage",  label: "Étalonnage",       color: "#1ABC9C" },
  { key: "sound",       label: "Sound design",     color: "#9B59B6" },
  { key: "motion",      label: "Motion / VFX",     color: "#E67E22" },
  { key: "da",          label: "DA / Moodboard",   color: "#D4A843" },
  { key: "presentation",label: "Présentation",     color: "#27AE60" },
  { key: "validation",  label: "Validation",       color: "#2ECC71" },
  { key: "export",      label: "Export / Livraison", color: "#4A7C59" },
  { key: "admin",       label: "Admin",            color: "#555" },
  { key: "autre",       label: "Autre",            color: "#444" },
];

// PPM phases (8 phases The Futur)
export const PPM_PHASE_KEYS = [
  { key: "onboarding", label: "Onboarding" },
  { key: "kickoff", label: "Kickoff" },
  { key: "assignation", label: "Assignation" },
  { key: "checkins", label: "Check-ins" },
  { key: "soumission", label: "Soumission" },
  { key: "feedback", label: "Feedback" },
  { key: "dangerzone", label: "Danger Zone" },
  { key: "livraison", label: "Livraison" },
];

export function generateProjectCode(pillar, year, index) {
  return `${PILLAR_MAP[pillar]?.prefix || "GRT"}-${String(year).slice(-2)}-${String(index).padStart(3, "0")}`;
}

export function generateBDCNumber(projectCode, bdcIndex) {
  return `BDC-${projectCode}-${String(bdcIndex).padStart(2, "0")}`;
}

/* global React */
// i18n — tiny FR/EN dictionary + hook + global setter.

const I18N_KEY = "lgs.lang";
const I18N_EVENT = "lgs:lang-change";

function getLang() {
  try {
    const l = localStorage.getItem(I18N_KEY);
    if (l === "fr" || l === "en") return l;
  } catch (e) {}
  return "en";
}

function setLang(l) {
  try { localStorage.setItem(I18N_KEY, l); } catch (e) {}
  window.dispatchEvent(new CustomEvent(I18N_EVENT, { detail: l }));
}

function useLang() {
  const [lang, set] = React.useState(getLang());
  React.useEffect(() => {
    const h = (e) => set(e.detail || getLang());
    window.addEventListener(I18N_EVENT, h);
    return () => window.removeEventListener(I18N_EVENT, h);
  }, []);
  return lang;
}

const DICT = {
  "menu.menu":     { en: "MENU",      fr: "MENU" },
  "menu.home":     { en: "HOME",      fr: "ACCUEIL" },
  // Sticker (idcard) — clé dédiée pour découpler du menu (le menu n'a
  // plus d'entrée HOME, le sticker assume seul ce rôle).
  "sticker.home":  { en: "HOME",      fr: "ACCUEIL" },
  "menu.work":     { en: "WORK",      fr: "PROJETS" },
  "menu.about":    { en: "ABOUT",     fr: "À PROPOS" },
  "menu.eco":      { en: "ECOSYSTEM", fr: "ÉCOSYSTÈME" },
  "menu.view":     { en: "[VIEW]",    fr: "[VOIR]" },
  "menu.inquiry":  { en: "INQUIRY",   fr: "CONTACT" },
  "menu.strip":    { en: "STRIP",     fr: "BANDE" },
  "menu.index":    { en: "INDEX",     fr: "INDEX" },

  // Index view headers
  "idx.project":   { en: "PROJECT",  fr: "PROJET" },
  "idx.client":    { en: "CLIENT",   fr: "CLIENT" },
  "idx.services":  { en: "SERVICES", fr: "SERVICES" },
  "idx.year":      { en: "YEAR",     fr: "ANNÉE" },

  // Inquiry modal
  "inq.title":     { en: "NEW INQUIRY",         fr: "NOUVELLE DEMANDE" },
  "inq.subtitle":  { en: "Tell us about your project — we read every line.",
                    fr: "Parlez-nous de votre projet — nous lisons chaque ligne." },
  "inq.name":      { en: "NAME",                fr: "NOM" },
  "inq.company":   { en: "COMPANY",             fr: "SOCIÉTÉ" },
  "inq.email":     { en: "EMAIL",               fr: "EMAIL" },
  "inq.services":  { en: "SERVICES",            fr: "SERVICES" },
  "inq.description":{en: "DESCRIPTION",         fr: "DESCRIPTION" },
  "inq.budget":    { en: "BUDGET",              fr: "BUDGET" },
  "inq.required":  { en: "REQUIRED",            fr: "REQUIS" },
  "inq.send":      { en: "SEND INQUIRY",        fr: "ENVOYER" },
  "inq.close":     { en: "CLOSE",               fr: "FERMER" },
  "inq.cancel":    { en: "CANCEL",              fr: "ANNULER" },
  "inq.thanks":    { en: "INQUIRY RECEIVED. WE'LL REPLY WITHIN 48 HOURS.",
                    fr: "DEMANDE REÇUE. NOUS RÉPONDONS SOUS 48 H." },

  "home.booking":  { en: "NOW BOOKING — 26",       fr: "DISPONIBLE — 26" },
  "home.locs":     { en: "",  fr: "" },
  "home.scroll":   { en: "(05) WORKS — SCROLL ∞",  fr: "(05) PROJETS — SCROLL ∞" },

  "filt.all":      { en: "ALL",          fr: "TOUS" },
  "filt.film":     { en: "FILM",         fr: "FILM" },
  "filt.editorial":{ en: "EDITORIAL",    fr: "ÉDITORIAL" },
  "filt.campaign": { en: "CAMPAIGN",     fr: "CAMPAGNE" },
  "filt.music":    { en: "MUSIC VIDEO",  fr: "CLIP" },

  "viewer.close":    { en: "CLOSE",       fr: "FERMER" },
  "viewer.info":     { en: "INFORMATION", fr: "INFORMATIONS" },
  "viewer.project":  { en: "PROJECT",     fr: "PROJET" },
  "viewer.overview": { en: "GALLERY",     fr: "GALERIE" },
  "viewer.gallery":  { en: "GALLERY",     fr: "GALERIE" },

  "about.intro": {
    en: [
      "LESGRIOTSxSTUDIO IS A TRANSDISCIPLINARY CREATIVE STUDIO.",
      "WE COMBINE ARTISTIC DIRECTION, MOVEMENT, AND AUDIOVISUAL PRODUCTION TO DESIGN NARRATIVES THAT RESONATE ACROSS IMAGE, STORY, AND PERFORMANCE.",
      "OUR PRACTICE IS ROOTED IN AFRO-DIASPORIC PERSPECTIVES AND DEDICATED TO BUILDING CULTURAL LEGACIES THROUGH POWERFUL VISUAL STORYTELLING.",
      "WE ARE DRIVEN BY COLLABORATION AND THRIVE IN CREATIVE ENVIRONMENTS WHERE MEANING AND IMPACT ARE AT THE CORE.",
    ],
    fr: [
      "LESGRIOTSxSTUDIO EST UN STUDIO CRÉATIF TRANSDISCIPLINAIRE.",
      "NOUS RÉUNISSONS DIRECTION ARTISTIQUE, MOUVEMENT ET PRODUCTION AUDIOVISUELLE POUR CONSTRUIRE DES RÉCITS QUI RÉSONNENT À TRAVERS L'IMAGE, L'HISTOIRE ET LA PERFORMANCE.",
      "NOTRE PRATIQUE EST ANCRÉE DANS DES PERSPECTIVES AFRO-DIASPORIQUES ET DÉDIÉE À LA CONSTRUCTION D'HÉRITAGES CULTURELS PAR UN STORYTELLING VISUEL PUISSANT.",
      "NOUS SOMMES MUS PAR LA COLLABORATION ET PROSPÉRONS DANS DES ENVIRONNEMENTS CRÉATIFS OÙ LE SENS ET L'IMPACT SONT AU CŒUR.",
    ],
  },
  "about.services":      { en: "SERVICES",       fr: "SERVICES" },
  "about.contact":       { en: "CONTACTS",       fr: "CONTACTS" },
  "about.svc.brand":     { en: "BRAND STRATEGY",      fr: "STRATÉGIE DE MARQUE" },
  "about.svc.creative":  { en: "CREATIVE DIRECTION",  fr: "DIRECTION CRÉATIVE" },
  "about.svc.stage":     { en: "STAGE DIRECTION & MOVEMENT", fr: "DIRECTION SCÉNIQUE & MOUVEMENT" },
  "about.svc.production":{ en: "PRODUCTION",          fr: "PRODUCTION" },

  "eco.title":      { en: "(03) — ECOSYSTEM",  fr: "(03) — ÉCOSYSTÈME" },
  "eco.lead": {
    en: "No one tells a story alone. Here are the hands, the studios and the institutions that work with — and around — Les Griots. An open circle.",
    fr: "Personne ne raconte une histoire seul. Voici les mains, les studios et les institutions qui travaillent avec — et autour — des Griots. Un cercle ouvert.",
  },
  "eco.s1": { en: "PERMANENT COLLABORATORS", fr: "COLLABORATEURS PERMANENTS" },
  "eco.s2": { en: "PARTNER STUDIOS",         fr: "STUDIOS PARTENAIRES" },
  "eco.s3": { en: "RETURNING CLIENTS",       fr: "CLIENTS FIDÈLES" },
  "eco.s4": { en: "FESTIVALS · DISTRIBUTION",fr: "FESTIVALS · DISTRIBUTION" },
  "eco.s5": { en: "FRIENDS OF THE STUDIO",   fr: "AMIS DU STUDIO" },

  "foot.back":  { en: "BACK",  fr: "RETOUR" },
  "foot.copy":  { en: "COPYRIGHT © LES GRIOTS, ALL RIGHTS RESERVED.", fr: "COPYRIGHT © LES GRIOTS, TOUS DROITS RÉSERVÉS." },
  "foot.locs":  { en: "",  fr: "" },

  "boot.system":  { en: "SYSTEM ONLINE",   fr: "SYSTÈME EN LIGNE" },
  "boot.node":    { en: "NODE 26 · PAR",   fr: "NŒUD 26 · PAR" },
  "boot.loading": { en: "LOADING ARCHIVE", fr: "CHARGEMENT ARCHIVE" },
  "boot.l1": { en: "lesgriotsxstudio/v.04",                    fr: "lesgriotsxstudio/v.04" },
  "boot.l2": { en: "mounting cabinet/",                        fr: "montage cabinet/" },
  "boot.l3": { en: "instrument serif · jetbrains mono — ok",   fr: "instrument serif · jetbrains mono — ok" },
  "boot.l4": { en: "loading covers · 05 works",                fr: "chargement covers · 05 projets" },
  "boot.l5": { en: "scanlines · grain · vignette — ok",        fr: "bruit · grain · vignette — ok" },
  "boot.l6": { en: "creative studio",                          fr: "studio créatif" },
  "boot.l7": { en: "press any key",                            fr: "appuyez sur une touche" },
  "boot.k1": { en: "INIT",   fr: "INIT" },
  "boot.k2": { en: "BOOT",   fr: "DÉMARR" },
  "boot.k3": { en: "FONTS",  fr: "FONTES" },
  "boot.k4": { en: "ASSETS", fr: "MÉDIAS" },
  "boot.k5": { en: "CRT",    fr: "CRT" },
  "boot.k6": { en: "INDEX",  fr: "INDEX" },
  "boot.k7": { en: "READY",  fr: "PRÊT" },
};

function t(key, lang) {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] !== undefined ? entry[lang] : entry.en;
}

window.useLang = useLang;
window.getLang = getLang;
window.setLang = setLang;
window.tr = t;

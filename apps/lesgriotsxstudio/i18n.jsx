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
  "menu.talent":   { en: "TALENT",    fr: "TALENT" },
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

  // About intro — aligné sur la bible LES GRIOTS (juin 2026) :
  //   §1  Mission AGENCE = structurer et amplifier les récits (des autres)
  //   §2  Méthode = ingénierie narrative (stratégie, DA, mouvement, prod AV)
  //   §3  Perspective culturelle et traditionnelle (figure du griot) +
  //       légitimité terrain (Universal, Sony, Warner, Accor Arena)
  // Note interne : le fait que le studio ne porte qu'un seul talent (Moos)
  // reste dans la bible/CRM, pas exposé sur la page About publique.
  "about.intro": {
    en: [
      "LESGRIOTSxSTUDIO IS THE CREATIVE AGENCY OF LES GRIOTS. OUR MISSION: TO STRUCTURE AND AMPLIFY THE NARRATIVES OF THE BRANDS, ARTISTS AND INSTITUTIONS WHO ENTRUST THEIRS TO US.",
      "WE PRACTICE NARRATIVE ENGINEERING — STRATEGY, CREATIVE DIRECTION, MOVEMENT, AUDIOVISUAL PRODUCTION — IN SERVICE OF A SINGLE GOAL: A STORY THAT HOLDS, ACROSS EVERY SURFACE, AGAINST EVERY DISTRACTION.",
      "OUR PERSPECTIVE IS CULTURAL AND TRADITIONAL — ROOTED IN THE AFRICAN DIASPORA, DRAWING FROM THE FIGURE OF THE GRIOT. OUR LEGITIMACY COMES FROM THE FIELD — UNIVERSAL, SONY, WARNER, ACCOR ARENA — AND RETURNS THERE.",
    ],
    fr: [
      "LESGRIOTSxSTUDIO EST L'AGENCE CRÉATIVE DE LES GRIOTS. NOTRE MISSION : STRUCTURER ET AMPLIFIER LES RÉCITS DES MARQUES, ARTISTES ET INSTITUTIONS QUI NOUS CONFIENT LES LEURS.",
      "NOUS PRATIQUONS UNE INGÉNIERIE NARRATIVE — STRATÉGIE, DIRECTION CRÉATIVE, MOUVEMENT, PRODUCTION AUDIOVISUELLE — AU SERVICE D'UN SEUL OBJECTIF : QUE LE RÉCIT TIENNE DEBOUT, SUR TOUS LES SUPPORTS, FACE À TOUTES LES DISTRACTIONS.",
      "NOTRE PERSPECTIVE EST CULTURELLE ET TRADITIONNELLE — ANCRÉE DANS LA DIASPORA AFRICAINE, INSPIRÉE PAR LA FIGURE DU GRIOT. NOTRE LÉGITIMITÉ VIENT DU TERRAIN — UNIVERSAL, SONY, WARNER, ACCOR ARENA — ET Y RETOURNE.",
    ],
  },
  "about.services":      { en: "SERVICES",       fr: "SERVICES" },
  "about.contact":       { en: "CONTACTS",       fr: "CONTACTS" },
  // Services alignés sur la nomenclature pricing de la bible (5 lignes).
  // Les clés historiques (.brand / .creative / .stage / .production) sont
  // conservées pour ne pas casser l'AboutView ; on en ajoute une 5e (.special).
  "about.svc.brand":     { en: "STRATEGY & NARRATIVE",      fr: "STRATÉGIE & RÉCIT" },
  "about.svc.creative":  { en: "CREATIVE DIRECTION",        fr: "DIRECTION CRÉATIVE" },
  "about.svc.stage":     { en: "MOVEMENT DIRECTION",        fr: "DIRECTION DU MOUVEMENT" },
  "about.svc.production":{ en: "AUDIOVISUAL PRODUCTION",    fr: "PRODUCTION AUDIOVISUELLE" },
  "about.svc.special":   { en: "SPECIAL PROJECTS",          fr: "PROJETS SPÉCIAUX" },

  // Page Talent — kicker + role + bio.
  // Bio = prose narrative à la 3e personne, 2 paragraphes (background +
  // structure / reconnaissances). Sentence case pour confort de lecture
  // longue. Surchargeable via SITE_CONTENT.talent.bio dans data.jsx.
  "talent.kicker": { en: "(02) — TALENT",            fr: "(02) — TALENT" },
  "talent.role":   { en: "CREATIVE DIRECTOR · STORYTELLER",
                     fr: "DIRECTEUR CRÉATIF · STORYTELLER" },
  "talent.bio": {
    en: [
      "Moos Coulibaly is a multidisciplinary French-Senegalese artist and the founder of LES GRIOTS. A dancer turned choreographer for Rilès — whom he now accompanies on Zéniths and Accor Arena as movement director and co-live director — he then established himself as a director for Médine, Oumar (Sony Music France) and DONI M, before becoming creative director and brand strategist for Vacra (Universal Music France, Gold and Platinum), Eesah Yasuke (Warner), FILA and CCN Le Havre.",
      "In 2021, he founded SASU LES GRIOTS, a narrative engineering platform structured around three pillars: a creative agency, an original IP studio rooted in Afro-diasporic perspectives, and La Griothèque — his Qualiopi-certified training body, now CPF-eligible through the RS7200 certification. French Tech Laureate. MansaLab incubation.",
      "@mooscoulibaly",
    ],
    fr: [
      "Moos Coulibaly est artiste multidisciplinaire franco-sénégalais et fondateur de LES GRIOTS. Danseur devenu chorégraphe pour Rilès — qu'il accompagne aujourd'hui sur Zéniths et Accor Arena en tant que directeur du mouvement et co-directeur live — il s'est ensuite imposé comme réalisateur auprès de Médine, Oumar (Sony Music France) et DONI M, puis comme directeur créatif et stratège de marque pour Vacra (Universal Music France, Disque d'Or et Platine), Eesah Yasuke (Warner), FILA et le CCN Le Havre.",
      "En 2021, il fonde la SASU LES GRIOTS, plateforme d'ingénierie narrative articulée en trois piliers : une agence créative, une production originale d'IPs ancrée dans les perspectives afro-diasporiques, et La Griothèque — son organisme de formation Qualiopi certifié, désormais éligible CPF via la certification RS7200. Lauréat French Tech. Incubé MansaLab.",
      "@mooscoulibaly",
    ],
  },

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

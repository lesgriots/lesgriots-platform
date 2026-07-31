/**
 * documents-accueil.mjs — la convocation et le livret d'accueil.
 *
 * Même philosophie que le programme : le layout sait dessiner, ce fichier
 * sait ce que le document doit dire, et il va le chercher dans la base.
 * La convocation est nominative (une session, un apprenant) ; le livret
 * est de session (le même pour tous les participants d'une session).
 */

const texte = (v) => String(v ?? '').trim();

const jourFr = (v, options = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', options);
};

function reglagesDe(db) {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
}

function piedDePage(reglages) {
  return [
    texte(reglages.company_name) || 'LES GRIOTS',
    reglages.siret ? `SIRET ${reglages.siret}` : '',
    reglages.nda ? `Déclaration d'activité n° ${reglages.nda}` : '',
    [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    texte(reglages.email),
  ].filter(Boolean).join(' · ');
}

function chargerSession(db, sessionId) {
  const s = db.prepare(`
    SELECT s.*, f.title AS formation_titre, f.duration_hours, f.duration_days, f.modality AS formation_modalite
    FROM sessions s JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) throw new Error('Session introuvable.');
  return s;
}

function datesLisibles(s) {
  const debut = jourFr(s.start_date);
  const fin = jourFr(s.end_date);
  if (!fin || fin === debut) return `Le ${debut}`;
  const memeMois = String(s.start_date).slice(0, 7) === String(s.end_date).slice(0, 7);
  return memeMois
    ? `Du ${jourFr(s.start_date, { day: 'numeric' })} au ${fin}`
    : `Du ${debut} au ${fin}`;
}

const MODALITES = { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Mixte' };

/* ── La convocation ───────────────────────────────────────────────────── */

/**
 * `apprenantId` optionnel : sans lui, la convocation est générée pour le
 * premier inscrit de la session (utile pour un aperçu).
 */
export function construireConvocation(db, sessionId, apprenantId = null) {
  const s = chargerSession(db, sessionId);
  const reglages = reglagesDe(db);

  const apprenant = apprenantId
    ? db.prepare('SELECT * FROM apprenants WHERE id = ?').get(apprenantId)
    : db.prepare(`
        SELECT a.* FROM apprenants a
        JOIN inscriptions i ON i.apprenant_id = a.id
        WHERE i.session_id = ? ORDER BY a.last_name LIMIT 1
      `).get(sessionId);
  if (!apprenant) throw new Error('Aucun apprenant inscrit sur cette session.');

  const heures = Number(s.duration_hours) || 0;

  return {
    apprenant: [apprenant.first_name, apprenant.last_name].filter(Boolean).join(' ').trim() || 'Participant',
    entreprise: texte(apprenant.company),
    apprenantEmail: texte(apprenant.email),
    titre: texte(s.formation_titre),
    dates: datesLisibles(s),
    // Horaires : une session à horaires uniques garde sa case dans la
    // grille ; une session qui détaille ses journées (blocs séparés par une
    // ligne vide) gagne un planning pleine largeur, une ligne par jour.
    ...(() => {
      const brut = texte(s.horaire);
      if (!brut) return { horaires: '9h30 - 12h30 / 13h30 - 17h30', planning: [] };
      const blocs = brut.split(/\n\s*\n/).map((b) => b.split(/\n/).map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
      if (blocs.length <= 1) {
        return { horaires: (blocs[0] || []).join(' · '), planning: [] };
      }
      return {
        horaires: '',
        planning: blocs.map((b) => ({ jour: b[0], creneaux: b.slice(1).join(' · ') || '' })),
      };
    })(),
    duree: heures ? `${heures} h` : '',
    lieu: texte(s.adresse) || texte(s.location) || 'Lieu communiqué prochainement',
    modalite: MODALITES[s.modality] || MODALITES[s.formation_modalite] || 'Présentiel',
    formateur: texte(s.formateur_name),
    representant: `L'équipe ${texte(reglages.company_name) || 'LES GRIOTS'}`,
    organisme: 'Organisme de formation certifié Qualiopi',
    contactEmail: texte(reglages.email),
    piedDePage: piedDePage(reglages),
    maj: new Date().toLocaleDateString('fr-FR'),
    _apprenant: apprenant, // pour l'appelant (envoi d'email, nommage)
  };
}

/* ── Le livret d'accueil ──────────────────────────────────────────────── */

/**
 * Le livret garde son contenu éditorial (valeurs de la maison, règles de
 * vie, déroulé type) : c'est un texte de marque, pas une donnée. Seuls le
 * pratique, les contacts et le millésime viennent de la base.
 */
export function construireLivret(db, sessionId = null) {
  const reglages = reglagesDe(db);
  const s = sessionId ? chargerSession(db, sessionId) : null;

  const contactEmail = texte(reglages.email) || 'contact@lesgriots.com';

  const societe = [
    ['Raison sociale', texte(reglages.company_name)],
    ['SIRET', texte(reglages.siret)],
    ["N° de déclaration d'activité", texte(reglages.nda)],
    ['Adresse', [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
    ['Contact', texte(reglages.email)],
    ['Représentant', [reglages.representant_name, reglages.representant_title].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v).map(([label, value]) => ({ label, value }));

  return {
    piedDePage: piedDePage(reglages),
    societe,
    contactEmail,
    contactAccessibilite: contactEmail,
    promo: String(new Date(s?.start_date || Date.now()).getFullYear()),
    maj: new Date().toLocaleDateString('fr-FR'),
    sommaire: [
      { n: '01', label: 'Qui sommes-nous', href: '#qui' },
      { n: '02', label: 'Le déroulé', href: '#deroule' },
      { n: '03', label: 'Infos pratiques', href: '#pratique' },
      { n: '04', label: 'Règles de vie', href: '#regles' },
      { n: '05', label: 'Accessibilité', href: '#acces' },
      { n: '06', label: 'Vos contacts', href: '#contacts' },
    ],
    // Les trois piliers de « Notre approche », textes réels du site
    // (SITE_CONTENT de lagriotheque.com, pas les textes de secours).
    valeurs: [
      { titre: 'Le récit comme point de départ', texte: "Avant les outils, il y a une vision. Chaque création forte commence par une histoire à raconter. Nous aidons les créatifs à clarifier leur intention, structurer leur pensée et construire un récit cohérent qui donne du sens à leur travail." },
      { titre: "L'expérience du terrain comme transmission", texte: "Apprendre de ceux qui créent aujourd'hui. Nos formations sont animées par des professionnels en activité qui partagent leurs expériences, leurs méthodes et les enseignements issus de projets réels." },
      { titre: 'La pratique comme moteur', texte: "Les compétences se construisent en faisant. Nos formations privilégient l'expérimentation, les cas concrets et la mise en application pour transformer les connaissances en savoir-faire." },
    ],
    etapes: [
      { quand: 'J-14', titre: 'Confirmation et auto-positionnement', texte: 'Vous recevez votre convocation, le programme détaillé et un court questionnaire pour situer votre niveau et vos attentes.' },
      { quand: 'J-2', titre: 'Rappel et checklist', texte: "Lieu, horaires, accès et matériel à prévoir. C'est le moment de nous signaler tout besoin d'adaptation." },
      { quand: 'Jour J', titre: 'La formation', texte: "Accueil 15 minutes avant. Alternance d'apports et d'ateliers, avec des retours individualisés sur votre projet." },
      { quand: 'J+7', titre: 'Après la formation', texte: 'Évaluation à chaud, certificat de réalisation, supports et ressources partagés. Un point de suivi est proposé à 30 jours.' },
    ],
    pratique: [
      { label: 'Lieu', value: texte(s?.adresse) || texte(s?.location) || 'Communiqué avec votre convocation' },
      { label: 'Horaires', value: texte(s?.horaire) || '9 h 30 – 17 h 30 · accueil dès 9 h 15' },
      { label: 'Pauses', value: 'Deux pauses · 1 h de déjeuner' },
      { label: 'Matériel', value: '', items: ['Ordinateur ou smartphone selon la formation', 'Précisé dans votre convocation'] },
      { label: 'Effectif', value: `${s?.max_participants || 12} participants maximum` },
      { label: 'Restauration', value: 'Café et thé sur place · restaurants à proximité' },
    ],
    regles: [
      { titre: 'Ponctualité', texte: "Les sessions commencent à l'heure. En cas de retard ou d'absence, prévenez-nous au plus vite — l'émargement conditionne votre certificat." },
      { titre: 'Bienveillance', texte: "Aucune remarque discriminatoire ou dévalorisante n'est tolérée. On critique le travail, jamais la personne." },
      { titre: 'Confidentialité', texte: "Les projets partagés en salle restent dans la salle. Rien n'est diffusé sans l'accord de son auteur." },
      { titre: 'Téléphones', texte: 'Le smartphone est un outil de travail ici. En dehors des exercices, on le met en silencieux.' },
      { titre: "Droit à l'image", texte: 'Des photos peuvent être prises pendant la session. Vous pouvez refuser à tout moment, sans justification.' },
    ],
    contacts: [
      { role: 'Coordination pédagogique', nom: `L'équipe ${texte(reglages.company_name) || 'LES GRIOTS'}`, email: contactEmail },
      { role: 'Référent handicap', nom: 'Référent accessibilité', email: contactEmail },
      { role: 'Administratif & financement', nom: 'Service formation', email: contactEmail },
    ],
  };
}

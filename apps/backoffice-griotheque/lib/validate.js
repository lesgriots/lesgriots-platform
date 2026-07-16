// Validation légère des payloads avant écriture dans griotheque.json.
// Objectif : empêcher un payload malformé de casser l'export data.jsx ou
// de polluer le store — pas de schéma lourd, juste les invariants vitaux.
//
// Invariants :
//   - le payload est un objet (pas un array, pas null)
//   - `id` est slug-safe (il finit dans des noms de fichiers et des URLs)
//   - les champs "identité" requis sont des strings non vides
//   - les champs listés comme string ne sont pas des objets/arrays

const SLUG_RE = /^[a-z0-9_-]+$/i;

// Champs requis (string non vide) par collection.
const REQUIRED = {
  formations: ["title"],
  workshops: ["title"],
  trainers: ["name"],
  sessions: [],
  resources: ["title"],
  events: ["title"],
};

// Champs qui, s'ils sont présents, doivent être des strings (pas objets/arrays).
// NB : overview / description / chapters / program ne sont PAS listés — ils
// peuvent légitimement être des tableaux (paragraphes, modules).
const STRING_FIELDS = {
  formations: ["title", "tagline", "discipline", "duration", "format", "location", "price", "trainer_id"],
  workshops: ["title", "tagline", "discipline", "duration", "format", "location", "price", "trainer_id"],
  trainers: ["name", "role", "bio", "photo"],
  sessions: ["date", "formation_id", "workshop_id", "status"],
  resources: ["title", "type", "format", "href"],
  events: ["title", "date", "time", "location", "city", "link", "link_label", "status"],
};

/**
 * Valide un payload d'entité. Renvoie null si OK, sinon un message d'erreur.
 * @param {string} kind — formations|workshops|trainers|sessions|resources
 * @param {object} obj — le payload (avec id déjà positionné)
 */
export function validateEntity(kind, obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return "Payload invalide : objet attendu.";
  }
  if (!obj.id || typeof obj.id !== "string" || !SLUG_RE.test(obj.id)) {
    return "id invalide : lettres, chiffres, tirets et underscores uniquement.";
  }
  if (obj.id.length > 100) return "id trop long (max 100 caractères).";

  for (const field of REQUIRED[kind] || []) {
    const v = obj[field];
    if (typeof v !== "string" || !v.trim()) {
      return `Champ requis manquant ou vide : ${field}.`;
    }
  }
  for (const field of STRING_FIELDS[kind] || []) {
    const v = obj[field];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return `Champ ${field} : texte attendu.`;
    }
  }
  return null;
}

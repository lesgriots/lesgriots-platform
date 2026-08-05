// Passerelle Systeme.io — partagée par /api/leads et /api/subscribe.
//
// Rôle : chaque capture d'email sur le site (newsletter, ressource, CPF,
// inscription, contact) est upsertée comme contact Systeme.io, avec :
//   - les champs standard  : first_name, surname, phone_number
//   - le champ perso       : "source" (dernière action, ex. "inscription:workshop:…")
//   - des tags             : "site-lagriotheque", "src-<source>", "sujet-<slug>"
//
// ⚠️ Plan gratuit Systeme.io = 1 tag maximum. La création de tags échoue
// alors en 422 "Please upgrade your plan" : on la tolère en silence, le champ
// "source" porte la segmentation en attendant. Dès que le compte passe sur un
// plan payant, les tags se créent et se posent tout seuls, sans redéploiement.
//
// Clé API : SYSTEMEIO_API_KEY (nom historique SYSTEME_API_KEY accepté en
// secours) dans /etc/lagriotheque-backoffice.env. Absente → passerelle inactive.
//
// Tout est best-effort : une panne Systeme.io ne doit jamais bloquer la
// capture — le lead est déjà enregistré dans le BO avant l'appel.

const SIO_API = "https://api.systeme.io/api";

export function sioKey() {
  return process.env.SYSTEMEIO_API_KEY || process.env.SYSTEME_API_KEY || "";
}

export function sioSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function sioFetch(key, path, options = {}) {
  const res = await fetch(SIO_API + path, {
    ...options,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  // 422 = "existe déjà" ou "limite du plan" → toléré, l'appelant gère.
  if (!res.ok && res.status !== 422) {
    throw new Error(`systeme.io ${path} → ${res.status}`);
  }
  return data;
}

// Sépare "Prénom Nom [Nom2…]" quand le formulaire n'envoie qu'un champ name.
export function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function sioFindOrCreateContact(key, { email, fields }) {
  // Création directe ; 422 = contact existant → on le retrouve par email
  // et on met à jour ses champs (la dernière action gagne).
  const created = await sioFetch(key, "/contacts", {
    method: "POST",
    body: JSON.stringify({ email, locale: "fr", fields }),
  });
  if (created && created.id) return created;

  const found = await sioFetch(key, "/contacts?email=" + encodeURIComponent(email));
  const contact = found && found.items && found.items[0] ? found.items[0] : null;
  if (contact && contact.id && fields.length) {
    await sioFetch(key, "/contacts/" + contact.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/merge-patch+json" },
      body: JSON.stringify({ fields }),
    }).catch(() => { /* les champs attendront la prochaine action */ });
  }
  return contact;
}

async function sioTagIds(key, names) {
  const out = [];
  let existing = [];
  try {
    const list = await sioFetch(key, "/tags?limit=100");
    existing = (list && list.items) || [];
  } catch (e) { /* liste indisponible → on tentera la création */ }
  for (const name of names) {
    try {
      let tag = existing.find((t) => t.name === name);
      if (!tag) {
        // Plan gratuit : répond 422 "upgrade your plan" sans créer → skip.
        tag = await sioFetch(key, "/tags", { method: "POST", body: JSON.stringify({ name }) });
        if (!tag || !tag.id) {
          const rel = await sioFetch(key, "/tags?limit=100");
          tag = ((rel && rel.items) || []).find((t) => t.name === name);
        }
      }
      if (tag && tag.id) out.push(tag.id);
    } catch (e) { /* un tag qui échoue ne bloque pas les autres */ }
  }
  return out;
}

/**
 * Upsert un contact Systeme.io + champs + tags. Ne jette jamais côté appelant
 * s'il est utilisé en fire-and-forget avec .catch().
 *
 * @param {object} p
 * @param {string} p.email        — requis
 * @param {string} [p.firstName]
 * @param {string} [p.lastName]
 * @param {string} [p.phone]
 * @param {string} [p.source]     — valeur du champ perso "source" (ex. "ressource:guide-recit")
 * @param {string[]} [p.tags]     — noms de tags à poser (créés si le plan le permet)
 */
export async function syncContactToSystemeIo({ email, firstName, lastName, phone, source, tags = [] }) {
  const key = sioKey();
  if (!key || !email) return;

  const fields = [];
  if (firstName) fields.push({ slug: "first_name", value: String(firstName).slice(0, 80) });
  if (lastName) fields.push({ slug: "surname", value: String(lastName).slice(0, 80) });
  if (phone) fields.push({ slug: "phone_number", value: String(phone).slice(0, 40) });
  if (source) fields.push({ slug: "source", value: String(source).slice(0, 120) });

  const contact = await sioFindOrCreateContact(key, { email, fields });
  if (!contact || !contact.id) return;

  const ids = await sioTagIds(key, tags);
  for (const tagId of ids) {
    await sioFetch(key, `/contacts/${contact.id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    }).catch(() => {});
  }
}

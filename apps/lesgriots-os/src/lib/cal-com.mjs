/**
 * cal-com.mjs — lire l'agenda, pas seulement l'écouter.
 *
 * Le webhook prévient en temps réel, et c'est la bonne façon de travailler :
 * rien à interroger, rien à attendre. Mais un webhook est un message unique.
 * S'il tombe pendant un redéploiement, personne ne le rejoue, et l'inscription
 * reste éternellement « en attente d'entretien » alors que le créneau est pris.
 * On relance alors quelqu'un qui a déjà réservé, et c'est exactement ce qu'un
 * candidat retient d'un organisme.
 *
 * L'API sert de filet. Elle répond à une question que le webhook ne peut pas
 * poser : « qu'est-ce que j'ai raté ? » On lui demande les réservations
 * modifiées depuis tant de jours, on les rapproche des inscriptions, et on
 * comble les trous. Elle sert aussi à reprendre l'historique le jour du
 * branchement, pour que les dossiers déjà ouverts ne repartent pas de zéro.
 *
 * La clé vit dans CAL_API_KEY, jamais en base : une clé d'API dans une table
 * ressort dans une sauvegarde, un export, une capture d'écran.
 */

const BASE = process.env.CAL_API_BASE || 'https://api.cal.com/v2';
const VERSION = process.env.CAL_API_VERSION || '2026-05-01';

const texte = (v) => String(v ?? '').trim();

export function calConfigure() {
  return {
    pret: Boolean(process.env.CAL_API_KEY),
    base: BASE,
    version: VERSION,
  };
}

/** Un appel, une réponse, et un message d'erreur qui dit quoi faire. */
async function appeler(chemin, params = {}) {
  const cle = process.env.CAL_API_KEY;
  if (!cle) throw new Error('CAL_API_KEY absente : ajoutez-la dans /etc/lesgriots-os.env.');

  const url = new URL(`${BASE}${chemin}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cle}`,
      'cal-api-version': VERSION,
      Accept: 'application/json',
    },
    // Un agenda qui ne répond pas en dix secondes ne doit pas retenir l'OS.
    signal: AbortSignal.timeout(10000),
  });

  const brut = await r.text();
  if (!r.ok) {
    throw new Error(`Cal.com ${r.status} : ${brut.slice(0, 200)}`);
  }
  try { return JSON.parse(brut); }
  catch { throw new Error('Cal.com a répondu autre chose que du JSON.'); }
}

/**
 * Les réservations, page par page. Cal.com pagine par curseur ; on suit le
 * fil tant qu'il en reste, avec une borne dure pour ne jamais boucler.
 */
export async function calReservations({ apres = '', email = '', maxPages = 10 } = {}) {
  const toutes = [];
  let curseur;

  for (let page = 0; page < maxPages; page += 1) {
    const rep = await appeler('/bookings', {
      afterUpdatedAt: apres,
      attendeeEmail: email,
      take: 100,
      cursor: curseur,
    });
    const lot = Array.isArray(rep?.data) ? rep.data : [];
    toutes.push(...lot);

    curseur = rep?.pagination?.nextCursor;
    if (!rep?.pagination?.hasMore || !curseur || !lot.length) break;
  }
  return toutes;
}

/** Le statut Cal.com traduit dans le vocabulaire de l'OS. */
export function etatDepuis(reservation) {
  const s = String(reservation?.status || '').toLowerCase();
  if (s === 'cancelled' || s === 'rejected') return 'annule';
  if (s === 'accepted' || s === 'upcoming' || s === 'pending') {
    const debut = Date.parse(reservation?.start || reservation?.startTime || '');
    // Un créneau accepté et déjà passé, c'est un entretien qui a eu lieu.
    return Number.isFinite(debut) && debut < Date.now() ? 'honore' : 'reserve';
  }
  if (s === 'past') return 'honore';
  return '';
}

function adresseDe(reservation) {
  const a = reservation?.attendees?.[0];
  return texte(a?.email || reservation?.attendeeEmail || reservation?.responses?.email);
}

/**
 * Le rattrapage.
 *
 * On ne réécrit que ce qui diffère : une inscription déjà à jour n'est pas
 * touchée, sinon le journal se remplit de lignes qui ne disent rien.
 */
export function synchroniserEntretiens(db, reservations) {
  const trouver = db.prepare(`
    SELECT i.id, i.session_id, i.entretien_statut, i.entretien_ref,
           a.first_name, a.last_name
    FROM inscriptions i
    JOIN apprenants a ON a.id = i.apprenant_id
    WHERE LOWER(a.email) = LOWER(?) AND i.status <> 'annule'
    ORDER BY CASE WHEN COALESCE(i.entretien_statut, '') = '' THEN 0 ELSE 1 END,
             i.created_at DESC
    LIMIT 1
  `);
  const majour = db.prepare(`
    UPDATE inscriptions
    SET entretien_statut = ?, entretien_le = ?, entretien_ref = ?, entretien_lien = ?
    WHERE id = ?
  `);

  const bilan = { lues: reservations.length, rattachees: 0, inchangees: 0, orphelines: 0 };

  for (const r of reservations) {
    const email = adresseDe(r);
    const etat = etatDepuis(r);
    if (!email || !etat) continue;

    const ligne = trouver.get(email);
    if (!ligne) { bilan.orphelines += 1; continue; }

    const ref = texte(r.uid || r.id);
    if (ligne.entretien_statut === etat && ligne.entretien_ref === ref) {
      bilan.inchangees += 1;
      continue;
    }

    majour.run(
      etat,
      etat === 'annule' ? '' : texte(r.start || r.startTime),
      ref,
      texte(r.meetingUrl || r.location || ''),
      ligne.id,
    );
    bilan.rattachees += 1;
  }
  return bilan;
}

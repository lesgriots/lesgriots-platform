/**
 * Les jetons publics, en un seul endroit.
 *
 * Trois portes ouvrent sur des données nominatives sans qu'aucun compte
 * n'existe : l'espace apprenant, l'espace entreprise, et le téléchargement
 * d'une pièce. Tant que chacune résolvait son jeton dans son coin, il
 * suffisait d'en oublier une pour ouvrir une fenêtre.
 *
 * Un jeton résolu répond toujours à la même question : au nom de qui parle
 * celui qui le présente. Le reste, c'est-à-dire ce que cette personne a le
 * droit de voir, se décide ensuite, à un seul endroit lui aussi
 * (`pieceAutorisee`).
 */

/**
 * @returns {null | {portee:'apprenant', session_id, apprenant_id, temporaire:boolean}
 *                 | {portee:'entreprise', client_id, temporaire:boolean}}
 */
export function resoudreJeton(db, token) {
  if (!token || typeof token !== 'string' || token.length > 128) return null;
  const maintenant = new Date().toISOString();

  // ── Apprenant ──
  const acces = db.prepare('SELECT * FROM espace_acces WHERE token = ?').get(token);
  if (acces) {
    if (acces.expires_at && acces.expires_at < maintenant) return null;
    return { portee: 'apprenant', session_id: acces.session_id, apprenant_id: acces.apprenant_id, temporaire: true };
  }
  const lien = db.prepare('SELECT * FROM espace_liens WHERE token = ?').get(token);
  if (lien) {
    if (lien.expires_at && lien.expires_at < maintenant.slice(0, 10)) return null;
    return { portee: 'apprenant', session_id: lien.session_id, apprenant_id: lien.apprenant_id, temporaire: false };
  }

  // ── Entreprise ──
  const accesE = db.prepare('SELECT * FROM espace_entreprise_acces WHERE token = ?').get(token);
  if (accesE) {
    if (accesE.expires_at && accesE.expires_at < maintenant) return null;
    return { portee: 'entreprise', client_id: accesE.client_id, temporaire: true };
  }
  const lienE = db.prepare('SELECT * FROM espace_entreprise_liens WHERE token = ?').get(token);
  if (lienE) {
    if (lienE.expires_at && lienE.expires_at < maintenant.slice(0, 10)) return null;
    return { portee: 'entreprise', client_id: lienE.client_id, temporaire: false };
  }

  return null;
}

/** Les jours de formation : le planning s'il existe, sinon les jours ouvrés. */
export function joursDeSession(s) {
  try {
    const p = JSON.parse(s.planning || 'null');
    if (Array.isArray(p) && p.length) return p.map((j) => (typeof j === 'string' ? j : j.date)).filter(Boolean);
  } catch { /* planning libre ou absent */ }
  if (!s.start_date) return [];
  const jours = [];
  const fin = s.end_date || s.start_date;
  for (let d = new Date(s.start_date); d <= new Date(fin); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) jours.push(d.toISOString().slice(0, 10));
  }
  return jours.slice(0, 30);
}

/**
 * Toutes les entreprises présentes sur une session.
 *
 * Trois sources, parce que l'information s'est accumulée en trois temps :
 * la ligne de facturation par client, le rattachement historique porté par
 * la session, et l'employeur de chaque inscrit. Une session « mono-client »
 * est une session dont ces trois sources ne désignent qu'une entreprise :
 * c'est la seule situation où l'on peut lui remettre les pièces de session
 * sans risquer de lui montrer celles d'un concurrent.
 */
export function clientsDeSession(db, session) {
  const ids = new Set();
  for (const r of db.prepare('SELECT client_id FROM session_clients WHERE session_id = ?').all(session.id)) {
    if (r.client_id) ids.add(r.client_id);
  }
  if (session.client_id) ids.add(session.client_id);
  for (const r of db.prepare(`
    SELECT DISTINCT a.client_id FROM inscriptions i
    JOIN apprenants a ON a.id = i.apprenant_id
    WHERE i.session_id = ? AND COALESCE(a.client_id, '') <> ''
  `).all(session.id)) {
    if (r.client_id) ids.add(r.client_id);
  }
  return [...ids];
}

/**
 * Une pièce est-elle remettable au porteur de ce jeton ?
 *
 * Liste blanche, toujours. Une liste d'exclusions échoue en s'ouvrant : la
 * catégorie inventée demain devient visible sans que personne ne l'ait
 * décidé. C'est exactement ainsi qu'une feuille d'émargement, avec les
 * signatures manuscrites de tous les participants, s'était retrouvée dans
 * l'espace d'un apprenant.
 */
export function pieceAutorisee(db, scope, doc) {
  if (!doc || doc.archived) return false;

  if (scope.portee === 'apprenant') {
    // Ses pièces nominatives, et les supports de sa session.
    if (doc.contexte_type === 'apprenant' && doc.contexte_id === scope.apprenant_id) {
      return ['convocation', 'attestation', 'certificat', 'support'].includes(doc.categorie);
    }
    if (doc.contexte_type === 'session' && doc.contexte_id === scope.session_id) {
      return doc.categorie === 'support';
    }
    return false;
  }

  if (scope.portee === 'entreprise') {
    if (doc.contexte_type === 'client' && doc.contexte_id === scope.client_id) return true;

    // Les attestations de ses propres salariés : c'est elle qui les envoie
    // en formation, et son OPCO les réclame pour solder le dossier.
    if (doc.contexte_type === 'apprenant') {
      const a = db.prepare('SELECT client_id FROM apprenants WHERE id = ?').get(doc.contexte_id);
      return Boolean(a && a.client_id === scope.client_id)
        && ['attestation', 'certificat'].includes(doc.categorie);
    }

    if (doc.contexte_type === 'session') {
      const s = db.prepare('SELECT id, client_id FROM sessions WHERE id = ?').get(doc.contexte_id);
      if (!s) return false;
      const clients = clientsDeSession(db, s);
      // Session partagée avec d'autres entreprises : ses pièces ne sont pas
      // les siennes seules, on ne les remet pas.
      if (clients.length !== 1 || clients[0] !== scope.client_id) return false;
      return ['convention', 'contrat', 'facture', 'devis', 'emargement', 'programme'].includes(doc.categorie);
    }
    return false;
  }

  return false;
}

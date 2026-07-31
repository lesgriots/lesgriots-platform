/**
 * convention-donnees.mjs — ce qu'une convention de formation doit dire.
 *
 * Le contenu juridique (les onze articles) vit dans le layout : c'est un
 * texte de la maison, pas une donnée. Ce fichier assemble tout le reste :
 * les parties, l'action de formation, les stagiaires, le prix.
 */

import { construireProgramme } from './programme-donnees.mjs';

const texte = (v) => String(v ?? '').trim();

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}).format(Number(n) || 0);

const jourFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function construireConvention(db, sessionId) {
  const s = db.prepare(`
    SELECT s.*, f.title AS formation_titre, f.duration_hours, f.duration_days,
           f.modality AS formation_modalite, f.objectives
    FROM sessions s JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) throw new Error('Session introuvable.');

  const reglages = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));

  const client = s.client_id ? db.prepare('SELECT * FROM clients WHERE id = ?').get(s.client_id) : null;

  const stagiaires = db.prepare(`
    SELECT a.first_name, a.last_name FROM apprenants a
    JOIN inscriptions i ON i.apprenant_id = a.id
    WHERE i.session_id = ? ORDER BY a.last_name ASC
  `).all(sessionId).map((a) => [a.first_name, a.last_name].filter(Boolean).join(' ').trim()).filter(Boolean);

  const heures = Number(s.duration_hours) || 0;
  const jours = Number(s.duration_days) || 0;
  const debut = jourFr(s.start_date);
  const fin = jourFr(s.end_date);

  const prixHT = Number(s.tarif) || 0;
  // LES GRIOTS est exonéré de TVA sur la formation (art. 261-4-4°a du CGI).
  const tvaApplicable = reglages.tva_applicable === '1';
  const tauxTva = tvaApplicable ? (Number(reglages.tva_rate) || 20) : 0;
  const prixTTC = prixHT * (1 + tauxTva / 100);

  const numero = `CF-${String(s.start_date || '').slice(0, 4) || new Date().getFullYear()}-${texte(s.code_interne) || String(sessionId).slice(0, 8).toUpperCase()}`;

  const objectifs = (() => {
    const brut = s.objectives;
    if (!brut) return [];
    try { const j = JSON.parse(brut); if (Array.isArray(j)) return j.map(String).map((x) => x.trim()).filter(Boolean); } catch { /* texte */ }
    return String(brut).split(/\r?\n/).map((x) => x.replace(/^\s*[-—•*]\s*/, '').trim()).filter(Boolean);
  })();

  // L'annexe : le programme de la formation, tel que le construit déjà le
  // générateur de programmes. L'article 1 promet qu'il est annexé ; il l'est.
  let annexe = null;
  try {
    const { valeurs } = construireProgramme(db, s.formation_id);
    annexe = {
      objectifs: valeurs.objectifs || [],
      audience: valeurs.audience || [],
      prerequis: valeurs.prerequis || [],
      modules: valeurs.modules || [],
      totalHeures: valeurs.totalHeures || '',
      methodes: valeurs.methodes || '',
      evaluation: Array.isArray(valeurs.evaluation) ? valeurs.evaluation : (valeurs.evaluation ? [valeurs.evaluation] : []),
      moyens: valeurs.moyens || '',
      accessibilite: valeurs.accessibilite || '',
    };
    // Une annexe vide n'a pas à imprimer sa page de titre : si le programme
    // n'a rien à dire, l'annexe disparaît et l'article 1 devra attendre.
    const rien = Object.values(annexe).every((v) => (Array.isArray(v) ? !v.length : !texte(v)));
    if (rien) annexe = null;
  } catch { /* formation introuvable : la convention reste valide sans annexe */ }

  return {
    annexe,
    numero,
    etablieLe: new Date().toLocaleDateString('fr-FR'),
    titre: texte(s.formation_titre),

    organismeTexte: `${texte(reglages.company_name) || 'LES GRIOTS'}, SASU au capital de 1 000 €, dont le siège social est situé au ${[texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}, immatriculée sous le numéro SIRET ${texte(reglages.siret)}, déclarée en tant qu'organisme de formation sous le numéro ${texte(reglages.nda)} auprès de la DREETS de Normandie, représentée par ${texte(reglages.representant_name)}${reglages.representant_title ? ', ' + texte(reglages.representant_title) : ''}.`,

    clientTexte: client
      ? `${texte(client.company) || [client.first_name, client.last_name].filter(Boolean).join(' ')}${client.siret ? ', SIRET ' + texte(client.siret) : ''}${client.address ? ', dont le siège est situé au ' + [texte(client.address), [client.postal_code, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''}, représenté(e) par ${[client.first_name, client.last_name].filter(Boolean).join(' ') || 'son représentant légal'}.`
      : 'Le Client, dont les coordonnées figurent au dossier.',
    clientNom: client ? (texte(client.company) || [client.first_name, client.last_name].filter(Boolean).join(' ')) : 'Le Client',
    clientRepresentant: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : '',

    caracteristiques: [
      { label: 'Intitulé', value: texte(s.formation_titre) },
      { label: "Type d'action", value: texte(s.type_action) || 'Action de formation' },
      { label: 'Durée', value: heures ? `${heures} heures${jours ? ` (${jours} jour${jours > 1 ? 's' : ''})` : ''}` : '' },
      { label: 'Modalité', value: { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Mixte' }[s.modality || s.formation_modalite] || 'Présentiel' },
      { label: 'Dates', value: fin && fin !== debut ? `Du ${debut} au ${fin}` : `Le ${debut}` },
      { label: 'Horaires', value: texte(s.horaire) || '9h30 - 12h30 / 13h30 - 17h30' },
      { label: 'Lieu', value: texte(s.adresse) || texte(s.location) || '' },
    ].filter((c) => c.value),

    objectifs,
    stagiaires: stagiaires.length ? stagiaires : ['(liste à compléter)'],
    nbStagiaires: stagiaires.length || 1,

    prixHT: euros(prixHT),
    mentionTva: tvaApplicable
      ? `soit ${euros(prixTTC)} TTC, TVA ${tauxTva} %`
      : 'TVA non applicable, art. 261-4-4°a du CGI',
    parStagiaire: stagiaires.length > 1 && prixHT ? `Soit ${euros(prixHT / stagiaires.length)} HT par stagiaire.` : '',
    modalitesReglement: texte(reglages.payment_terms) || '30 jours à réception de facture',

    representant: [reglages.representant_name, reglages.representant_title].filter(Boolean).join(' · '),
    organisme: texte(reglages.company_name) || 'LES GRIOTS',
    contactEmail: texte(reglages.email),
    piedDePage: [
      texte(reglages.company_name) || 'LES GRIOTS',
      reglages.siret ? `SIRET ${reglages.siret}` : '',
      reglages.nda ? `Déclaration d'activité n° ${reglages.nda}` : '',
      [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      texte(reglages.email),
    ].filter(Boolean).join(' · '),
    maj: new Date().toLocaleDateString('fr-FR'),
  };
}

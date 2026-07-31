/**
 * devis-donnees.mjs — ce qu'un devis de formation doit dire.
 *
 * Un devis engage un prix pour une prestation datée. Il porte donc son
 * numéro, sa durée de validité, le détail de ce qui est vendu, et la place
 * où le client écrit « Bon pour accord ». Le reste est du bavardage.
 */

const texte = (v) => String(v ?? '').trim();

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}).format(Number(n) || 0);

const jourFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const MODALITES = { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Mixte' };

/**
 * `validiteJours` : au-delà, le prix n'engage plus. Trente jours est
 * l'usage, et c'est ce que les financeurs attendent de voir écrit.
 */
export function construireDevis(db, sessionId, { numero = '', validiteJours = 30 } = {}) {
  const s = db.prepare(`
    SELECT s.*, f.title AS formation_titre, f.duration_hours, f.duration_days, f.modality AS formation_modalite
    FROM sessions s JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) throw new Error('Session introuvable.');

  const reglages = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  const client = s.client_id ? db.prepare('SELECT * FROM clients WHERE id = ?').get(s.client_id) : null;

  const stagiaires = db.prepare(
    'SELECT COUNT(*) AS n FROM inscriptions WHERE session_id = ?',
  ).get(sessionId)?.n || 0;

  const heures = Number(s.duration_hours) || 0;
  const jours = Number(s.duration_days) || 0;

  // Les lignes : le détail de la session s'il existe, sinon la formation
  // entière en une ligne. Un devis sans ligne n'a rien à facturer.
  const modules = db.prepare(`
    SELECT title, nature, duration_hours, prix_ht FROM session_modules
    WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC
  `).all(sessionId).filter((m) => Number(m.prix_ht) > 0);

  const lignes = modules.length
    ? modules.map((m) => ({
        designation: texte(m.title) || 'Prestation',
        detail: [texte(m.nature), m.duration_hours ? `${m.duration_hours} h` : ''].filter(Boolean).join(' · '),
        quantite: '1',
        prix: euros(m.prix_ht),
      }))
    : [{
        designation: texte(s.formation_titre),
        detail: [
          heures ? `${heures} heures${jours ? ` (${jours} jour${jours > 1 ? 's' : ''})` : ''}` : '',
          MODALITES[s.modality || s.formation_modalite] || 'Présentiel',
          stagiaires ? `${stagiaires} participant${stagiaires > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(' · '),
        quantite: '1',
        prix: euros(s.tarif),
      }];

  const totalHT = modules.length
    ? modules.reduce((t, m) => t + (Number(m.prix_ht) || 0), 0)
    : (Number(s.tarif) || 0);

  const tvaApplicable = reglages.tva_applicable === '1';
  const tauxTva = tvaApplicable ? (Number(reglages.tva_rate) || 20) : 0;
  const montantTva = totalHT * tauxTva / 100;

  const aujourdhui = new Date();
  const echeance = new Date(aujourdhui.getTime() + validiteJours * 86400000);

  const annee = aujourdhui.getFullYear();
  const rang = (db.prepare('SELECT COUNT(*) AS n FROM devis WHERE numero LIKE ?').get(`DV-${annee}-%`)?.n || 0) + 1;

  return {
    numero: numero || `DV-${annee}-${String(rang).padStart(3, '0')}`,
    emisLe: aujourdhui.toLocaleDateString('fr-FR'),
    valideJusquau: echeance.toLocaleDateString('fr-FR'),
    validiteJours: String(validiteJours),

    titre: texte(s.formation_titre),
    dates: (() => {
      const debut = jourFr(s.start_date);
      const fin = jourFr(s.end_date);
      return fin && fin !== debut ? `Du ${debut} au ${fin}` : `Le ${debut}`;
    })(),
    lieu: texte(s.adresse) || texte(s.location) || '',

    clientNom: client ? (texte(client.company) || [client.first_name, client.last_name].filter(Boolean).join(' ')) : 'Le Client',
    clientAdresse: client
      ? [texte(client.address), [client.postal_code, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      : '',
    clientSiret: client && client.siret ? `SIRET ${texte(client.siret)}` : '',
    clientContact: client ? [texte(client.email), texte(client.phone)].filter(Boolean).join(' · ') : '',

    lignes,
    totalHT: euros(totalHT),
    ligneTva: tvaApplicable ? `TVA ${tauxTva} % : ${euros(montantTva)}` : 'TVA non applicable, art. 261-4-4°a du CGI',
    totalTTC: euros(totalHT + montantTva),
    afficherTTC: tvaApplicable,

    modalitesReglement: texte(reglages.payment_terms) || '30 jours à réception de facture',
    coordonneesBancaires: [reglages.iban ? `IBAN ${texte(reglages.iban)}` : '', reglages.bic ? `BIC ${texte(reglages.bic)}` : ''].filter(Boolean).join(' · '),

    // Les identifiants de l'émetteur : ce qu'un service comptable saisit
    // dans son logiciel avant de payer.
    siret: reglages.siret ? `SIRET ${texte(reglages.siret)}` : '',
    nda: reglages.nda ? `Déclaration d'activité n° ${texte(reglages.nda)}` : '',
    tvaIntra: reglages.tva_number ? `TVA intracom. ${texte(reglages.tva_number)}` : '',
    telephone: texte(reglages.phone),

    // Mentions exigées entre professionnels : pénalités de retard et
    // indemnité forfaitaire de recouvrement (art. L.441-10 et D.441-5 du
    // code de commerce).
    penalites: "En cas de retard de paiement, des pénalités au taux de trois fois le taux d'intérêt légal sont exigibles, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L.441-10 et D.441-5 du code de commerce). Aucun escompte n'est accordé pour paiement anticipé.",

    organisme: texte(reglages.company_name) || 'LES GRIOTS',
    organismeAdresse: [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    representant: [reglages.representant_name, reglages.representant_title].filter(Boolean).join(' · '),
    contactEmail: texte(reglages.email),
    piedDePage: [
      texte(reglages.company_name) || 'LES GRIOTS',
      reglages.siret ? `SIRET ${reglages.siret}` : '',
      reglages.nda ? `Déclaration d'activité n° ${reglages.nda}` : '',
      [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      texte(reglages.email),
    ].filter(Boolean).join(' · '),
  };
}

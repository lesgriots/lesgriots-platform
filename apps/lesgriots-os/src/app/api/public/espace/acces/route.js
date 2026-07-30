/**
 * /api/public/espace/acces — l'apprenant demande son lien de connexion.
 *
 * Pourquoi : le lien personnel permanent ouvre l'espace à quiconque le
 * reçoit, indéfiniment. Ici l'apprenant saisit son adresse et reçoit un lien
 * qui expire. Son adresse devient la preuve d'identité ; le lien n'est plus
 * qu'un ticket.
 *
 * Trois précautions, parce que la route est ouverte à tous :
 *
 *   1. Aucune énumération. La réponse est identique que l'adresse existe ou
 *      non. Sinon, la route dirait à un curieux qui est inscrit chez toi.
 *   2. Un débit borné. Trois demandes par heure et par adresse : au-delà, on
 *      répond la même phrase sans rien envoyer. Personne ne s'en sert pour
 *      inonder la boîte de quelqu'un.
 *   3. Une durée courte. Le lien vaut deux heures, le temps de le lire et de
 *      cliquer, pas le temps de traîner dans une boîte partagée.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { envoyerEmail } from '@/lib/mailer';
import { habiller, pieceLogo } from '@/lib/email-marque';

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';
const HEURES = 2;
const MAX_PAR_HEURE = 3;

/** La même phrase dans tous les cas : elle ne révèle rien. */
const REPONSE = {
  ok: true,
  message: 'Si cette adresse correspond à une inscription, un lien de connexion vient de lui être envoyé. Il est valable deux heures.',
};

const organisme = (db) => {
  const lire = (cle, defaut = '') => {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
    return r && r.value ? r.value : defaut;
  };
  return {
    raison_sociale: lire('company_name', 'LES GRIOTS'),
    nda: lire('nda') || lire('numero_declaration'),
    siret: lire('siret'),
    email: lire('email'),
  };
};

export async function POST(request) {
  try {
    const db = getDb();
    const { email = '' } = await request.json().catch(() => ({}));
    const adresse = String(email).trim().toLowerCase();
    if (!adresse || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) return NextResponse.json(REPONSE);

    // Débit borné, avant toute lecture des inscrits.
    const recents = db.prepare(`
      SELECT COUNT(*) AS n FROM espace_acces
      WHERE email = ? AND created_at > datetime('now', '-1 hour')
    `).get(adresse).n;
    if (recents >= MAX_PAR_HEURE) return NextResponse.json(REPONSE);

    // Les sessions à venir ou récentes de cet apprenant. On ne rouvre pas
    // l'espace d'une formation terminée depuis six mois.
    const liens = db.prepare(`
      SELECT l.session_id, l.apprenant_id, s.start_date, s.end_date,
             COALESCE(f.title, s.session_name, s.id) AS titre
      FROM espace_liens l
      JOIN apprenants a ON a.id = l.apprenant_id
      JOIN sessions s ON s.id = l.session_id
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE lower(a.email) = ?
        AND (COALESCE(s.end_date, s.start_date) >= date('now', '-6 months'))
      ORDER BY s.start_date DESC
      LIMIT 5
    `).all(adresse);
    if (!liens.length) return NextResponse.json(REPONSE);

    const expire = new Date(Date.now() + HEURES * 3600 * 1000).toISOString();
    const ip = request.headers.get('x-forwarded-for') || '';
    const lignes = [];

    for (const l of liens) {
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare(`
        INSERT INTO espace_acces (id, token, session_id, apprenant_id, email, expires_at, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`ea_${crypto.randomBytes(6).toString('hex')}`, token, l.session_id, l.apprenant_id, adresse, expire, ip);
      lignes.push({ titre: l.titre, debut: l.start_date, url: `${BASE}/p/${token}` });
    }

    const objet = 'Votre lien de connexion à l’espace apprenant';
    const corps = [
      'Bonjour,',
      '',
      lignes.length > 1
        ? 'Voici vos liens de connexion. Ils sont valables deux heures.'
        : 'Voici votre lien de connexion. Il est valable deux heures.',
      '',
      ...lignes.map((x) => `${x.titre}${x.debut ? ` · ${x.debut}` : ''}\n${x.url}`),
      '',
      'Si vous n’avez pas demandé ce lien, ignorez ce message : personne d’autre ne peut s’en servir sans y avoir accès.',
    ].join('\n');

    await envoyerEmail({
      destinataire: adresse,
      objet, corps,
      html: habiller({ objet, corps, lien: lignes[0].url, organisme: organisme(db) }),
      pieces: pieceLogo(),
      template_key: 'acces_espace',
      contexte_type: 'espace',
      contexte_id: liens[0].session_id,
    });

    return NextResponse.json(REPONSE);
  } catch (e) {
    console.error('[espace/acces] échec :', e.message);
    // Même en cas d'incident, on ne dit rien de plus au visiteur.
    return NextResponse.json(REPONSE);
  }
}

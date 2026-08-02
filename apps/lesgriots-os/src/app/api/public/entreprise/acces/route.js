/**
 * /api/public/entreprise/acces — l'entreprise demande son lien.
 *
 * Mêmes précautions que la porte de l'espace apprenant, pour les mêmes
 * raisons : aucune énumération, un débit borné, une durée courte. La réponse
 * est identique que l'adresse soit connue ou non, sinon la route dit à un
 * curieux quelles entreprises se forment chez toi.
 *
 * Deux adresses ouvrent : celle de la fiche entreprise, et celle d'un de ses
 * contacts. Un service RH change de main plus souvent qu'une fiche.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { envoyerEmail } from '@/lib/mailer';
import { habiller, pieceLogo } from '@/lib/email-marque';

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';
const HEURES = 4;
const MAX_PAR_HEURE = 3;

const REPONSE = {
  ok: true,
  message: 'Si cette adresse est celle d’une entreprise cliente, un lien d’accès vient de lui être envoyé. Il est valable quatre heures.',
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

    const recents = db.prepare(`
      SELECT COUNT(*) AS n FROM espace_entreprise_acces
      WHERE email = ? AND created_at > datetime('now', '-1 hour')
    `).get(adresse).n;
    if (recents >= MAX_PAR_HEURE) return NextResponse.json(REPONSE);

    const parFiche = db.prepare('SELECT id, company FROM clients WHERE lower(email) = ?').all(adresse);
    const parContact = db.prepare(`
      SELECT c.id, c.company FROM client_contacts ct
      JOIN clients c ON c.id = ct.client_id
      WHERE lower(ct.email) = ?
    `).all(adresse);

    const vus = new Set();
    const entreprises = [...parFiche, ...parContact].filter((c) => {
      if (!c || vus.has(c.id)) return false;
      vus.add(c.id); return true;
    });
    if (!entreprises.length) return NextResponse.json(REPONSE);

    const expire = new Date(Date.now() + HEURES * 3600 * 1000).toISOString();
    const ip = request.headers.get('x-forwarded-for') || '';
    const lignes = [];

    for (const c of entreprises) {
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare(`
        INSERT INTO espace_entreprise_acces (id, token, client_id, email, expires_at, ip)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`ee_${crypto.randomBytes(6).toString('hex')}`, token, c.id, adresse, expire, ip);
      lignes.push({ titre: c.company || 'Votre entreprise', url: `${BASE}/e/${token}` });
    }

    const objet = 'Votre accès à l’espace entreprise';
    const corps = [
      'Bonjour,',
      '',
      'Voici votre lien d’accès à l’espace entreprise. Vous y retrouvez vos salariés inscrits,',
      'leur présence, et vos documents. Le lien est valable quatre heures.',
      '',
      ...lignes.map((x) => `${x.titre}\n${x.url}`),
      '',
      'Si vous n’avez pas demandé ce lien, ignorez ce message.',
    ].join('\n');

    await envoyerEmail({
      destinataire: adresse,
      objet, corps,
      html: habiller({ objet, corps, lien: lignes[0].url, organisme: organisme(db) }),
      pieces: pieceLogo(),
      template_key: 'acces_espace_entreprise',
      contexte_type: 'espace',
      contexte_id: entreprises[0].id,
    });

    return NextResponse.json(REPONSE);
  } catch (e) {
    console.error('[entreprise/acces] échec :', e.message);
    return NextResponse.json(REPONSE);
  }
}

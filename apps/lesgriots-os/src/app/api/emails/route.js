/**
 * /api/emails — journal des envois, et envoi manuel.
 *
 * GET  : les 200 derniers emails, avec le mode courant du moteur.
 * POST : envoie (ou simule) un email et le journalise.
 *
 * Le champ `mode` renvoyé par le GET dit franchement où on en est :
 * « reel » si le SMTP est configuré, « simulation » sinon. L'interface peut
 * ainsi afficher un bandeau plutôt que laisser croire que les emails partent.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { envoyerEmail, smtpConfigure, expediteur } from '@/lib/mailer';

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const conditions = [];
    const params = [];
    for (const field of ['contexte_type', 'contexte_id']) {
      const value = searchParams.get(field);
      if (value) {
        conditions.push(`${field} = ?`);
        params.push(value);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = db.prepare(`
      SELECT id, template_key, destinataire, destinataire_nom, objet,
             statut, erreur, contexte_type, contexte_id, created_at
      FROM emails
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `).all(...params);

    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN statut = 'envoye' THEN 1 ELSE 0 END) AS envoyes,
        SUM(CASE WHEN statut = 'simule' THEN 1 ELSE 0 END) AS simules,
        SUM(CASE WHEN statut = 'echec'  THEN 1 ELSE 0 END) AS echecs
      FROM emails
      ${where}
    `).get(...params);

    return NextResponse.json({
      items,
      stats,
      mode: smtpConfigure() ? 'reel' : 'simulation',
      expediteur: expediteur(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const body = await req.json();
    const {
      destinataire = '', destinataire_nom = '', objet = '', corps = '',
      template_key = '', contexte_type = '', contexte_id = '',
    } = body;

    const res = await envoyerEmail({
      destinataire, destinataire_nom, objet, corps,
      template_key, contexte_type, contexte_id,
    });

    // 'echec' = refus métier (adresse invalide, SMTP en erreur) → 422, pas 500 :
    // la requête était correcte, c'est l'envoi qui n'a pas abouti.
    return NextResponse.json(res, { status: res.statut === 'echec' ? 422 : 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('emails:read', _GET);
export const POST = withGuard('emails:send', _POST);

/**
 * /api/griotheque/rendez-vous — l'état des entretiens, et le rattrapage.
 *
 * GET  dit où en est chaque inscription vis-à-vis de son entretien, et si la
 *      clé d'API est en place. C'est ce que lira le cockpit de session.
 * POST interroge Cal.com et comble ce que le webhook a pu manquer. À lancer
 *      à la main aujourd'hui, par la file d'envois programmés demain.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { calConfigure, calReservations, synchroniserEntretiens } from '@/lib/cal-com.mjs';

export const dynamic = 'force-dynamic';

async function _GET(request) {
  const db = getDb();
  const sessionId = request.nextUrl.searchParams.get('session_id') || '';

  const lignes = db.prepare(`
    SELECT i.id, i.session_id, i.entretien_statut, i.entretien_le, i.entretien_lien,
           a.first_name, a.last_name
    FROM inscriptions i
    JOIN apprenants a ON a.id = i.apprenant_id
    WHERE i.status <> 'annule' AND (? = '' OR i.session_id = ?)
    ORDER BY i.created_at DESC
    LIMIT 500
  `).all(sessionId, sessionId);

  const compte = { attente: 0, reserve: 0, honore: 0, annule: 0, absent: 0 };
  for (const l of lignes) {
    const e = l.entretien_statut || '';
    if (!e) compte.attente += 1;
    else if (compte[e] !== undefined) compte[e] += 1;
  }

  return NextResponse.json({ ok: true, agenda: calConfigure(), compte, entretiens: lignes });
}

async function _POST(request) {
  const { pret } = calConfigure();
  if (!pret) {
    return NextResponse.json(
      { error: 'Clé Cal.com absente. Ajoutez CAL_API_KEY dans /etc/lesgriots-os.env.' },
      { status: 503 },
    );
  }

  let jours = 30;
  try {
    const corps = await request.json();
    const n = Number(corps?.jours);
    // Trois cent soixante-cinq jours suffisent à reprendre un historique ;
    // au-delà on lit des réservations qui ne concernent plus personne.
    if (Number.isFinite(n) && n > 0) jours = Math.min(n, 365);
  } catch { /* corps vide : on garde trente jours */ }

  const apres = new Date(Date.now() - jours * 86400000).toISOString();

  const reservations = await calReservations({ apres });
  const bilan = synchroniserEntretiens(getDb(), reservations);

  return NextResponse.json({ ok: true, depuis: apres, ...bilan });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('sessions:update', _POST);

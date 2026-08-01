/**
 * /api/public/rendez-vous — l'agenda prévient l'OS.
 *
 * Le formulaire d'inscription ne conclut rien : il ouvre un appel de
 * positionnement de vingt minutes, et c'est cet appel qui décide. Sans ce
 * point d'entrée, l'OS ne sait pas si le créneau a été pris. Il relance donc
 * quelqu'un qui a déjà réservé, ou pire, il ne relance pas celui qui n'a rien
 * fait, et le dossier dort.
 *
 * La route accepte les deux agendas, sans qu'on ait à choisir aujourd'hui :
 *
 *   Cal.com   en-tête x-cal-signature-256, HMAC-SHA256 du corps brut
 *   Calendly  en-tête Calendly-Webhook-Signature, « t=…,v1=… », HMAC du
 *             couple horodatage.corps
 *
 * Le secret vit dans RDV_WEBHOOK_SECRET. Sans secret configuré, la route
 * refuse tout : un point d'entrée public non signé est une porte ouverte sur
 * les données d'inscription.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';

export const dynamic = 'force-dynamic';

const texte = (v) => String(v ?? '').trim();

/** Comparaison à durée constante : deux signatures ne se comparent pas avec ===. */
function memeSignature(a, b) {
  const x = Buffer.from(texte(a));
  const y = Buffer.from(texte(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function hmac(secret, donnee) {
  return crypto.createHmac('sha256', secret).update(donnee, 'utf8').digest('hex');
}

/** Vrai si le corps brut porte une signature valable, quelle que soit sa provenance. */
function signatureValable(req, brut, secret) {
  const cal = req.headers.get('x-cal-signature-256');
  if (cal) return memeSignature(cal, hmac(secret, brut));

  const cly = req.headers.get('calendly-webhook-signature');
  if (cly) {
    const parts = Object.fromEntries(
      cly.split(',').map((p) => p.split('=').map((x) => x.trim())),
    );
    if (!parts.t || !parts.v1) return false;
    // Rejouer un message vieux de plus de cinq minutes ne doit pas passer.
    const age = Math.abs(Date.now() / 1000 - Number(parts.t));
    if (!Number.isFinite(age) || age > 300) return false;
    return memeSignature(parts.v1, hmac(secret, `${parts.t}.${brut}`));
  }
  return false;
}

/**
 * Ramène les deux formats à un seul.
 * Cal.com : { triggerEvent, payload: { uid, startTime, attendees:[{email}] } }
 * Calendly : { event, payload: { email, scheduled_event: { start_time, uri } } }
 */
function normaliser(corps) {
  const p = corps?.payload || {};

  if (corps?.triggerEvent) {
    const t = String(corps.triggerEvent).toUpperCase();
    const quoi = t === 'BOOKING_CREATED' || t === 'BOOKING_RESCHEDULED' ? 'reserve'
      : t === 'BOOKING_CANCELLED' || t === 'BOOKING_REJECTED' ? 'annule'
      : t === 'MEETING_ENDED' ? 'honore'
      : t === 'BOOKING_NO_SHOW_UPDATED' ? 'absent'
      : '';
    return {
      quoi,
      email: texte(p.attendees?.[0]?.email || p.responses?.email?.value || p.email),
      debut: texte(p.startTime || p.start_time),
      ref: texte(p.uid || p.bookingId || p.id),
      lien: texte(p.metadata?.videoCallUrl || p.location),
    };
  }

  if (corps?.event) {
    const e = String(corps.event).toLowerCase();
    const quoi = e === 'invitee.created' ? 'reserve'
      : e === 'invitee.canceled' ? 'annule'
      : e === 'invitee_no_show.created' ? 'absent'
      : '';
    const ev = p.scheduled_event || {};
    return {
      quoi,
      email: texte(p.email),
      debut: texte(ev.start_time),
      ref: texte(p.uri || ev.uri),
      lien: texte(ev.location?.join_url || ev.location?.location),
    };
  }

  return { quoi: '', email: '', debut: '', ref: '', lien: '' };
}

export async function POST(req) {
  const secret = process.env.RDV_WEBHOOK_SECRET || '';
  if (!secret) {
    console.warn('[rendez-vous] RDV_WEBHOOK_SECRET absent : appel refusé.');
    return NextResponse.json({ error: 'non configuré' }, { status: 503 });
  }

  const brut = await req.text();
  if (!signatureValable(req, brut, secret)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 });
  }

  let corps;
  try { corps = JSON.parse(brut); }
  catch { return NextResponse.json({ error: 'corps illisible' }, { status: 400 }); }

  const ev = normaliser(corps);
  // Un événement qu'on ne sait pas traduire n'est pas une erreur : l'agenda
  // en émet vingt, on en écoute quatre. On répond 200 pour qu'il ne réessaie pas.
  if (!ev.quoi || !ev.email) return NextResponse.json({ ok: true, ignore: true });

  const db = getDb();

  /*
   * À qui rattacher ce rendez-vous ?
   *
   * À l'inscription la plus récente de cette adresse qui attend encore son
   * entretien. Quelqu'un qui s'inscrit à deux sessions et prend un créneau
   * fait avancer la dernière demande, pas la première : c'est le comportement
   * le moins surprenant, et le seul qu'on puisse déduire d'un e-mail.
   */
  const ligne = db.prepare(`
    SELECT i.id, i.session_id, a.first_name, a.last_name
    FROM inscriptions i
    JOIN apprenants a ON a.id = i.apprenant_id
    WHERE LOWER(a.email) = LOWER(?) AND i.status <> 'annule'
    ORDER BY CASE WHEN COALESCE(i.entretien_statut, '') = '' THEN 0 ELSE 1 END,
             i.created_at DESC
    LIMIT 1
  `).get(ev.email);

  if (!ligne) {
    console.warn('[rendez-vous] aucune inscription pour', ev.email);
    return NextResponse.json({ ok: true, rattache: false });
  }

  db.prepare(`
    UPDATE inscriptions
    SET entretien_statut = ?,
        entretien_le = ?,
        entretien_ref = ?,
        entretien_lien = ?
    WHERE id = ?
  `).run(
    ev.quoi,
    ev.quoi === 'annule' ? '' : ev.debut,
    ev.ref,
    ev.lien,
    ligne.id,
  );

  /*
   * La trace lisible. Le tableau des e-mails d'une session est l'endroit où
   * l'on regarde ce qui s'est passé : un rendez-vous pris y a sa place autant
   * qu'un message envoyé.
   */
  const nom = [ligne.first_name, ligne.last_name].filter(Boolean).join(' ') || ev.email;
  const dit = { reserve: 'a réservé son entretien', annule: 'a annulé son entretien',
                honore: 'a fait son entretien', absent: 'ne s’est pas présenté à l’entretien' }[ev.quoi];
  db.prepare(`
    INSERT INTO emails (id, template_key, destinataire, destinataire_nom, objet, corps,
                        statut, contexte_type, contexte_id)
    VALUES (?, 'rendez_vous', ?, ?, ?, ?, 'envoye', 'session', ?)
  `).run(
    crypto.randomUUID(), ev.email, nom,
    `${nom} ${dit}`,
    [`${nom} ${dit}.`, ev.debut ? `Créneau : ${ev.debut}` : '', ev.lien || '']
      .filter(Boolean).join('\n'),
    ligne.session_id,
  );

  return NextResponse.json({ ok: true, inscription: ligne.id, statut: ev.quoi });
}

/** Un GET sert à vérifier que l'URL répond avant de la coller dans l'agenda. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    configure: Boolean(process.env.RDV_WEBHOOK_SECRET),
    agendas: ['cal.com', 'calendly'],
  });
}

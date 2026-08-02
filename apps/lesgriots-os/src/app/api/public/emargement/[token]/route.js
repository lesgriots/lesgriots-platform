import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';

/**
 * API PUBLIQUE — Émargement en ligne par token.
 *
 * ⚠️ SANS withGuard (accès apprenant via lien), donc :
 *   - validation token systématique (existence, kind, expiration)
 *   - réponses minimales : AUCUNE donnée sensible (pas d'emails, téléphones, prix)
 *
 * GET  /api/public/emargement/:token → session + inscrits (id, prénom, nom)
 *      + jours de session + signatures existantes (sans PNG).
 * POST /api/public/emargement/:token
 *      body { apprenantId | formateur: true, date, period, signaturePng, signedName }
 */

const MAX_PNG_BYTES = 200 * 1024; // 200 KB décodés

function resolveLink(db, token) {
  if (!token || typeof token !== 'string' || token.length > 128) return null;
  const link = db.prepare(
    "SELECT * FROM public_links WHERE token = ? AND kind = 'emargement'"
  ).get(token);
  if (!link) return null;
  if (link.expires_at && link.expires_at < new Date().toISOString().slice(0, 10)) return null;
  return link;
}

/** Jours de formation : planning JSON si présent, sinon jours ouvrés start→end. */
function sessionDays(session) {
  try {
    const planning = JSON.parse(session.planning || '[]');
    if (Array.isArray(planning) && planning.length) {
      return planning.map(p => String(p.date || '').slice(0, 10)).filter(Boolean);
    }
  } catch { /* fallback ci-dessous */ }

  const days = [];
  const start = new Date(`${String(session.start_date).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(session.end_date || session.start_date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return days;
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 400) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard += 1;
  }
  return days;
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const link = resolveLink(db, token);
    if (!link) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }

    const session = db.prepare(`
      SELECT s.id, s.start_date, s.end_date, s.location, s.adresse, s.horaire,
        s.formateur_name, s.planning, f.title as formation_title
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(link.session_id);
    if (!session) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }

    const inscrits = db.prepare(`
      SELECT a.id, a.first_name, a.last_name
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ? AND i.status != 'annule'
      ORDER BY a.last_name ASC, a.first_name ASC
    `).all(link.session_id);

    // Signatures existantes — SANS le PNG (payload léger, rien de sensible)
    const signatures = db.prepare(`
      SELECT apprenant_id, signer_role, date, period, signed_name, signed_at
      FROM signatures WHERE session_id = ?
    `).all(link.session_id);

    return NextResponse.json({
      session: {
        formationTitle: session.formation_title || 'Formation',
        startDate: session.start_date,
        endDate: session.end_date,
        formateurName: session.formateur_name || '',
        lieu: session.adresse || session.location || '',
        horaire: session.horaire || '',
      },
      jours: sessionDays(session),
      inscrits: inscrits.map(a => ({ id: a.id, firstName: a.first_name, lastName: a.last_name })),
      signatures,
    });
  } catch (err) {
    console.error('[public/emargement] GET', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const link = resolveLink(db, token);
    if (!link) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Corps JSON requis' }, { status: 400 });
    }
    const { apprenantId = null, formateur = false, date, period, signaturePng, signedName = '' } = body || {};

    // ── Validation période / date ──
    if (!['matin', 'apres_midi'].includes(period)) {
      return NextResponse.json({ error: "period doit être 'matin' ou 'apres_midi'" }, { status: 400 });
    }
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(link.session_id);
    if (!session) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }
    const day = String(date || '').slice(0, 10);
    const days = sessionDays(session);
    if (!day || !days.includes(day)) {
      return NextResponse.json({ error: 'Date hors de la période de session' }, { status: 400 });
    }

    // ── Validation signataire ──
    const signerRole = formateur === true ? 'formateur' : 'apprenant';
    let finalApprenantId = null;
    if (signerRole === 'apprenant') {
      if (!apprenantId) {
        return NextResponse.json({ error: 'apprenantId requis' }, { status: 400 });
      }
      const insc = db.prepare(`
        SELECT id FROM inscriptions
        WHERE session_id = ? AND apprenant_id = ? AND status != 'annule'
      `).get(link.session_id, apprenantId);
      if (!insc) {
        return NextResponse.json({ error: 'Apprenant non inscrit à cette session' }, { status: 400 });
      }
      finalApprenantId = apprenantId;
    }

    // ── Validation PNG ──
    if (typeof signaturePng !== 'string' || !signaturePng.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'signaturePng doit être un data URI PNG base64' }, { status: 400 });
    }
    const b64 = signaturePng.slice('data:image/png;base64,'.length);
    const approxBytes = Math.floor(b64.length * 3 / 4);
    if (approxBytes > MAX_PNG_BYTES || approxBytes < 100) {
      return NextResponse.json({ error: 'Signature invalide (taille max 200 Ko)' }, { status: 400 });
    }

    const safeName = String(signedName || '').slice(0, 200);
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64);

    // ── UPSERT sur la contrainte UNIQUE ──
    // NB : apprenant_id NULL (formateur) n'entre pas en conflit UNIQUE en SQLite,
    // on gère donc l'upsert manuellement pour couvrir les deux cas.
    const existing = finalApprenantId
      ? db.prepare(`
          SELECT id FROM signatures
          WHERE session_id = ? AND apprenant_id = ? AND signer_role = ? AND date = ? AND period = ?
        `).get(link.session_id, finalApprenantId, signerRole, day, period)
      : db.prepare(`
          SELECT id FROM signatures
          WHERE session_id = ? AND apprenant_id IS NULL AND signer_role = ? AND date = ? AND period = ?
        `).get(link.session_id, signerRole, day, period);

    if (existing) {
      db.prepare(`
        UPDATE signatures
        SET signature_png = ?, signed_name = ?, signed_at = datetime('now'), ip = ?
        WHERE id = ?
      `).run(signaturePng, safeName, ip, existing.id);
    } else {
      db.prepare(`
        INSERT INTO signatures (id, session_id, apprenant_id, signer_role, date, period, signature_png, signed_name, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), link.session_id, finalApprenantId, signerRole, day, period, signaturePng, safeName, ip);
    }

    /*
     * La signature fait foi, la feuille de présence suit.
     *
     * Cette route n'écrivait que dans `signatures`. L'espace apprenant, lui,
     * écrit dans les deux tables. Deux chemins pour le même geste, deux
     * résultats : une session pouvait afficher douze signatures dans la table
     * des preuves et zéro présence dans le tableau du cockpit, celui qu'on
     * imprime pour l'auditeur.
     *
     * Un intervenant qui signe ne coche rien : la feuille compte les
     * présences des apprenants, sa signature à lui est une preuve distincte.
     */
    if (finalApprenantId && signerRole !== 'formateur' && signerRole !== 'intervenant') {
      const colonne = period === 'matin' ? 'matin' : 'apres_midi';
      const ligne = db.prepare('SELECT id FROM emargements WHERE session_id = ? AND apprenant_id = ? AND date = ?')
        .get(link.session_id, finalApprenantId, day);
      if (ligne) {
        db.prepare(`UPDATE emargements SET ${colonne} = 1 WHERE id = ?`).run(ligne.id);
      } else {
        db.prepare(`INSERT INTO emargements (id, session_id, apprenant_id, date, ${colonne}) VALUES (?, ?, ?, ?, 1)`)
          .run(randomUUID(), link.session_id, finalApprenantId, day);
      }
    }

    return NextResponse.json({ ok: true, date: day, period, signerRole }, { status: 201 });
  } catch (err) {
    console.error('[public/emargement] POST', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

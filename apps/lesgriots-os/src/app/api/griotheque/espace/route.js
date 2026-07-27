/**
 * /api/griotheque/espace — les liens personnels des apprenants.
 *
 * GET  : l'état de chaque inscription, avec son lien s'il existe et ce que
 *        l'apprenant a déjà fait.
 * POST : émet le lien manquant pour une inscription, ou pour toute une session.
 *
 * Le lien ne périme pas tant que la session vit : un apprenant doit pouvoir
 * revenir chercher son attestation des mois plus tard.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const lignes = db.prepare(`
      SELECT i.session_id, i.apprenant_id,
             a.first_name, a.last_name,
             s.session_name, s.start_date, s.end_date,
             f.title AS formation_titre,
             e.token,
             (SELECT COUNT(*) FROM signatures g
               WHERE g.session_id = i.session_id AND g.apprenant_id = i.apprenant_id) AS signatures,
             (SELECT COUNT(*) FROM evaluations v
               WHERE v.session_id = i.session_id AND v.apprenant_id = i.apprenant_id) AS evaluations
      FROM inscriptions i
      LEFT JOIN apprenants a ON a.id = i.apprenant_id
      LEFT JOIN sessions s ON s.id = i.session_id
      LEFT JOIN formations f ON f.id = s.formation_id
      LEFT JOIN espace_liens e ON e.session_id = i.session_id AND e.apprenant_id = i.apprenant_id
      ORDER BY s.start_date DESC
    `).all();

    return NextResponse.json({
      inscriptions: lignes.map((l) => ({
        session_id: l.session_id,
        apprenant_id: l.apprenant_id,
        apprenant: [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Sans nom',
        session: l.session_name || l.formation_titre || 'Session',
        debut: l.start_date,
        token: l.token || null,
        signatures: l.signatures,
        evaluations: l.evaluations,
      })),
      avec_lien: lignes.filter((l) => l.token).length,
      total: lignes.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const db = getDb();
    const { session_id, apprenant_id } = await request.json();
    if (!session_id) return NextResponse.json({ error: 'Session requise' }, { status: 400 });

    const cibles = apprenant_id
      ? [{ apprenant_id }]
      : db.prepare('SELECT apprenant_id FROM inscriptions WHERE session_id = ?').all(session_id);

    const inserer = db.prepare(`
      INSERT OR IGNORE INTO espace_liens (id, token, session_id, apprenant_id)
      VALUES (?, ?, ?, ?)
    `);
    let crees = 0;
    for (const c of cibles) {
      if (!c.apprenant_id) continue;
      const r = inserer.run('esp_' + crypto.randomBytes(6).toString('hex'),
                            crypto.randomBytes(16).toString('hex'), session_id, c.apprenant_id);
      crees += r.changes;
    }

    return NextResponse.json({ crees }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);

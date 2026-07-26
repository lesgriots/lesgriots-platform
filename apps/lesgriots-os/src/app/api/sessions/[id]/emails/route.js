import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest } from '@/lib/api-guard';
import { GRIOTHEQUE_EMAIL_TEMPLATES_MAP } from '@/lib/email-templates';

/**
 * GET /api/sessions/:id/emails?type=convocation|rappel_j7|enquete_chaud|enquete_froid|envoi_attestation
 * → { type, subject, body } prêts à copier, avec les vraies données de la session.
 *
 * Pour enquete_chaud / enquete_froid : le lien public du questionnaire correspondant
 * est injecté s'il existe (dernier créé), sinon le placeholder {lien} reste visible.
 */

const TYPE_TO_QUESTIONNAIRE = {
  enquete_chaud: 'chaud',
  enquete_froid: 'froid',
};

async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';

  const template = GRIOTHEQUE_EMAIL_TEMPLATES_MAP[type];
  if (!template) {
    return badRequest(`type invalide. Types disponibles : ${Object.keys(GRIOTHEQUE_EMAIL_TEMPLATES_MAP).join(', ')}`);
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT s.*, f.title as f_title, f.code as f_code, f.duration_hours as f_duration_hours,
      l.nom as lieu_nom, l.adresse as lieu_adresse, l.postal_code as lieu_cp, l.ville as lieu_ville
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    LEFT JOIN lieux_formation l ON l.id = s.lieu_formation_id
    WHERE s.id = ?
  `).get(id);
  if (!session) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  // Formateur
  let formateurName = session.formateur_name || '';
  if (session.formateur_id) {
    const f = db.prepare('SELECT first_name, last_name FROM formateurs WHERE id = ?').get(session.formateur_id);
    if (f) formateurName = `${f.first_name || ''} ${f.last_name || ''}`.trim();
  }

  // Lieu complet
  let lieu = '';
  if (session.lieu_nom) {
    lieu = [session.lieu_nom, session.lieu_adresse, `${session.lieu_cp || ''} ${session.lieu_ville || ''}`.trim()]
      .filter(Boolean).join(', ');
  } else {
    lieu = session.adresse || session.location || '';
  }

  // Lien public du questionnaire si pertinent
  let lien = '';
  const qType = TYPE_TO_QUESTIONNAIRE[type];
  if (qType) {
    const link = db.prepare(`
      SELECT token FROM public_links
      WHERE session_id = ? AND kind = 'questionnaire' AND questionnaire_type = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(id, qType);
    if (link) {
      const origin = request.nextUrl?.origin || '';
      lien = `${origin}/p/questionnaire/${link.token}`;
    }
  }

  const ctx = {
    session,
    formation: { title: session.f_title, code: session.f_code, duration_hours: session.f_duration_hours },
    lieu,
    horaire: session.horaire || '',
    formateurName,
    lien,
  };

  return NextResponse.json({
    type,
    label: template.label,
    subject: template.subject(ctx),
    body: template.body(ctx),
    lien: lien || null,
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

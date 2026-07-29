import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { enrollLearnerInSession } from '@/lib/inscription-flow';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function registrationContext(db, token) {
  const link = db.prepare(`
    SELECT * FROM session_registration_links
    WHERE token = ? AND is_active = 1
  `).get(token);
  if (!link) return { error: 'Ce lien d’inscription est introuvable ou n’est plus actif.', status: 404 };
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { error: 'Ce lien d’inscription a expiré.', status: 410 };
  }
  const session = db.prepare(`
    SELECT s.id, s.start_date, s.end_date, s.location, s.modality, s.max_participants, s.status,
      f.title AS formation_title
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    WHERE s.id = ?
  `).get(link.session_id);
  if (!session) return { error: 'Cette session n’existe plus.', status: 404 };
  if (['cancelled', 'annulee', 'annulée', 'completed', 'terminee', 'terminée', 'archived', 'archivee', 'archivée'].includes(String(session.status || '').toLowerCase())) {
    return { error: 'Les inscriptions pour cette session sont fermées.', status: 410 };
  }
  return { link, session };
}

function sessionPayload(db, session) {
  const enrolled = db.prepare(`
    SELECT COUNT(*) AS total FROM inscriptions
    WHERE session_id = ? AND status != 'annule'
  `).get(session.id)?.total || 0;
  const capacity = Number(session.max_participants || 0);
  return {
    title: session.formation_title || 'Session de formation',
    startDate: session.start_date,
    endDate: session.end_date,
    location: session.location || '',
    modality: session.modality || '',
    seatsRemaining: capacity > 0 ? Math.max(0, capacity - enrolled) : null,
  };
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const context = registrationContext(db, token);
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
    return NextResponse.json({ session: sessionPayload(db, context.session) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Impossible de charger ce formulaire.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const context = registrationContext(db, token);
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Formulaire invalide.' }, { status: 400 }); }
    const firstName = text(body?.firstName, 100);
    const lastName = text(body?.lastName, 100);
    const email = text(body?.email, 160).toLowerCase();
    const phone = text(body?.phone, 40);
    const company = text(body?.company, 160);

    if (!firstName || !lastName || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Prénom, nom et une adresse e-mail valide sont requis.' }, { status: 400 });
    }
    if (!body?.consent) return NextResponse.json({ error: 'Votre accord pour traiter cette inscription est requis.' }, { status: 400 });

    let learner = db.prepare(`
      SELECT id, first_name, last_name, email, phone, company FROM apprenants
      WHERE lower(trim(email)) = ?
      ORDER BY created_at ASC LIMIT 1
    `).get(email);

    const existing = learner
      ? db.prepare('SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?').get(context.session.id, learner.id)
      : null;
    if (!existing && Number(context.session.max_participants || 0) > 0) {
      const enrolled = db.prepare(`SELECT COUNT(*) AS total FROM inscriptions WHERE session_id = ? AND status != 'annule'`).get(context.session.id)?.total || 0;
      if (enrolled >= Number(context.session.max_participants)) {
        return NextResponse.json({ error: 'Cette session est complète.' }, { status: 409 });
      }
    }

    if (learner) {
      db.prepare(`
        UPDATE apprenants SET first_name = ?, last_name = ?, phone = ?, company = ? WHERE id = ?
      `).run(firstName, lastName, phone || learner.phone || '', company || learner.company || '', learner.id);
      learner = db.prepare('SELECT id, first_name, last_name, email FROM apprenants WHERE id = ?').get(learner.id);
    } else {
      const learnerId = randomUUID();
      db.prepare(`
        INSERT INTO apprenants (id, first_name, last_name, email, phone, company)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(learnerId, firstName, lastName, email, phone, company);
      learner = { id: learnerId, first_name: firstName, last_name: lastName, email };
    }

    const enrollment = enrollLearnerInSession(db, { sessionId: context.session.id, apprenantId: learner.id, session: context.session });
    return NextResponse.json({
      ok: true,
      alreadyRegistered: enrollment.alreadyEnrolled,
      learner: { firstName: learner.first_name, lastName: learner.last_name },
      questionnairesPrepared: enrollment.questionnaireLinks.map((item) => item.questionnaire_type),
    }, { status: enrollment.alreadyEnrolled ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Impossible de finaliser l’inscription.' }, { status: 500 });
  }
}

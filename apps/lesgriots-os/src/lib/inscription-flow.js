import crypto, { randomUUID } from 'crypto';
import { addDays } from '@/lib/session-lifecycle';

/**
 * Prépare les trois questionnaires individuels liés à une inscription.
 * Cette fonction ne fait volontairement aucun envoi d'e-mail.
 */
export function createLearnerQuestionnaireLinks(db, { sessionId, apprenantId, session }) {
  const startDate = String(session.start_date || '').slice(0, 10);
  const endDate = String(session.end_date || session.start_date || '').slice(0, 10);
  const expiresAt = addDays(endDate, 120) || null;
  const plans = [
    { type: 'positionnement', slotDate: startDate || null },
    { type: 'chaud', slotDate: endDate || null },
    { type: 'froid', slotDate: addDays(endDate, 90) || null },
  ];
  const existing = new Set(db.prepare(`
    SELECT questionnaire_type FROM public_links
    WHERE session_id = ? AND apprenant_id = ? AND kind = 'questionnaire'
  `).all(sessionId, apprenantId).map((item) => item.questionnaire_type));
  const insert = db.prepare(`
    INSERT INTO public_links (id, kind, token, session_id, apprenant_id, questionnaire_type, slot_date, expires_at)
    VALUES (?, 'questionnaire', ?, ?, ?, ?, ?, ?)
  `);

  for (const plan of plans) {
    if (existing.has(plan.type)) continue;
    insert.run(randomUUID(), crypto.randomBytes(24).toString('hex'), sessionId, apprenantId, plan.type, plan.slotDate, expiresAt);
  }
}

export function learnerQuestionnaireLinks(db, sessionId, apprenantId) {
  return db.prepare(`
    SELECT id, token, questionnaire_type, slot_date, expires_at
    FROM public_links
    WHERE session_id = ? AND apprenant_id = ? AND kind = 'questionnaire'
    ORDER BY created_at ASC
  `).all(sessionId, apprenantId);
}

export function enrollLearnerInSession(db, { sessionId, apprenantId, session, status = 'inscrit', financement = '', priceHt = 0 }) {
  const existing = db.prepare('SELECT * FROM inscriptions WHERE session_id = ? AND apprenant_id = ?').get(sessionId, apprenantId);
  if (existing) {
    createLearnerQuestionnaireLinks(db, { sessionId, apprenantId, session });
    return { inscription: existing, alreadyEnrolled: true, questionnaireLinks: learnerQuestionnaireLinks(db, sessionId, apprenantId) };
  }

  const id = randomUUID();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO inscriptions (id, session_id, apprenant_id, status, financement, price_ht)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, apprenantId, status, financement, priceHt);

    const start = new Date(`${String(session.start_date).slice(0, 10)}T12:00:00Z`);
    const end = new Date(`${String(session.end_date || session.start_date).slice(0, 10)}T12:00:00Z`);
    for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      db.prepare(`
        INSERT OR IGNORE INTO emargements (id, session_id, apprenant_id, date, matin, apres_midi)
        VALUES (?, ?, ?, ?, 0, 0)
      `).run(randomUUID(), sessionId, apprenantId, day.toISOString().slice(0, 10));
    }
    createLearnerQuestionnaireLinks(db, { sessionId, apprenantId, session });
  })();

  return {
    inscription: db.prepare('SELECT * FROM inscriptions WHERE id = ?').get(id),
    alreadyEnrolled: false,
    questionnaireLinks: learnerQuestionnaireLinks(db, sessionId, apprenantId),
  };
}

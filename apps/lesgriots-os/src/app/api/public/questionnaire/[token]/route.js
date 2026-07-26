import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import {
  QUESTIONNAIRES,
  QUESTIONNAIRE_TYPE_TO_EVALUATION,
  computeScore,
} from '@/lib/questionnaires';

/**
 * API PUBLIQUE — Questionnaires par token (positionnement, chaud, froid, formateur).
 *
 * ⚠️ SANS withGuard : validation token systématique + réponses minimales
 * (aucun email / téléphone / prix ne transite).
 *
 * GET  /api/public/questionnaire/:token → type + questions + inscrits (si lien global).
 * POST /api/public/questionnaire/:token
 *      body { apprenantId?, answers: { <questionKey>: valeur }, comments? }
 *      → écrit dans evaluations (chaud→satisfaction, froid→froid, positionnement→positionnement)
 *      → bilan formateur → qualiopi_evidence (kind 'note', indicateur 30)
 *      Anti-doublon : 409 si une évaluation existe déjà pour (session, apprenant, type).
 */

function resolveLink(db, token) {
  if (!token || typeof token !== 'string' || token.length > 128) return null;
  const link = db.prepare(
    "SELECT * FROM public_links WHERE token = ? AND kind = 'questionnaire'"
  ).get(token);
  if (!link) return null;
  if (link.expires_at && link.expires_at < new Date().toISOString().slice(0, 10)) return null;
  if (!QUESTIONNAIRES[link.questionnaire_type]) return null;
  return link;
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
      SELECT s.id, s.start_date, s.end_date, f.title as formation_title
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(link.session_id);
    if (!session) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }

    const def = QUESTIONNAIRES[link.questionnaire_type];
    const payload = {
      type: def.type,
      label: def.label,
      intro: def.intro,
      questions: def.questions,
      session: {
        formationTitle: session.formation_title || 'Formation',
        startDate: session.start_date,
        endDate: session.end_date,
      },
      apprenant: null,
      inscrits: null,
    };

    if (link.questionnaire_type === 'formateur') {
      // Le formateur n'a pas besoin de la liste des inscrits
      return NextResponse.json(payload);
    }

    if (link.apprenant_id) {
      const a = db.prepare('SELECT id, first_name, last_name FROM apprenants WHERE id = ?').get(link.apprenant_id);
      if (a) payload.apprenant = { id: a.id, firstName: a.first_name, lastName: a.last_name };
    } else {
      // Lien global : chaque répondant choisit son nom dans la liste
      const inscrits = db.prepare(`
        SELECT a.id, a.first_name, a.last_name
        FROM inscriptions i
        JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ? AND i.status != 'annule'
        ORDER BY a.last_name ASC, a.first_name ASC
      `).all(link.session_id);
      payload.inscrits = inscrits.map(a => ({ id: a.id, firstName: a.first_name, lastName: a.last_name }));
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[public/questionnaire] GET', err);
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
    const { answers, comments = '' } = body || {};
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return NextResponse.json({ error: 'answers (objet) requis' }, { status: 400 });
    }
    const rawAnswers = JSON.stringify(answers);
    if (rawAnswers.length > 20000) {
      return NextResponse.json({ error: 'Réponses trop volumineuses' }, { status: 400 });
    }
    const safeComments = String(comments || '').slice(0, 5000);
    const qType = link.questionnaire_type;

    // ── Bilan formateur → preuve Qualiopi (indicateur 30) ──
    if (qType === 'formateur') {
      db.prepare(`
        INSERT INTO qualiopi_evidence (id, indicator, kind, ref, note, session_id)
        VALUES (?, 30, 'note', 'bilan_formateur', ?, ?)
      `).run(
        randomUUID(),
        JSON.stringify({ answers, comments: safeComments, submitted_at: new Date().toISOString() }),
        link.session_id
      );
      return NextResponse.json({ ok: true, type: 'formateur' }, { status: 201 });
    }

    // ── Questionnaires apprenants → table evaluations ──
    const evalType = QUESTIONNAIRE_TYPE_TO_EVALUATION[qType];
    if (!evalType) {
      return NextResponse.json({ error: 'Type de questionnaire invalide' }, { status: 400 });
    }

    const apprenantId = link.apprenant_id || body.apprenantId;
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

    // Anti-doublon
    const existing = db.prepare(`
      SELECT id FROM evaluations WHERE session_id = ? AND apprenant_id = ? AND type = ?
    `).get(link.session_id, apprenantId, evalType);
    if (existing) {
      return NextResponse.json({ error: 'Réponse déjà enregistrée pour ce questionnaire' }, { status: 409 });
    }

    const score = computeScore(qType, answers);

    db.prepare(`
      INSERT INTO evaluations (id, session_id, apprenant_id, type, score, responses, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), link.session_id, apprenantId, evalType, score, rawAnswers, safeComments);

    return NextResponse.json({ ok: true, type: qType, score }, { status: 201 });
  } catch (err) {
    console.error('[public/questionnaire] POST', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

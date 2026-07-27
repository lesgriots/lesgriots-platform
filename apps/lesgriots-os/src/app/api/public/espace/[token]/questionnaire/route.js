/**
 * /api/public/espace/[token]/questionnaire?type=… — la définition d'un
 * questionnaire, pour l'afficher côté apprenant.
 *
 * Lecture seule et sans donnée personnelle : ce sont des questions, pas des
 * réponses. Le jeton reste exigé, pour qu'on ne puisse pas moissonner les
 * questionnaires depuis l'extérieur.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { QUESTIONNAIRES, QUESTIONNAIRE_TYPE_TO_EVALUATION } from '@/lib/questionnaires';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const lien = db.prepare('SELECT id FROM espace_liens WHERE token = ?').get(token);
    if (!lien) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

    const type = new URL(request.url).searchParams.get('type');
    const q = QUESTIONNAIRES[type];
    if (!q || !QUESTIONNAIRE_TYPE_TO_EVALUATION[type]) {
      return NextResponse.json({ error: 'Questionnaire inconnu' }, { status: 404 });
    }

    return NextResponse.json({ type: q.type, label: q.label, intro: q.intro, questions: q.questions });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

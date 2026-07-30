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
import { QUESTIONNAIRE_TYPE_TO_EVALUATION } from '@/lib/questionnaires';
import { definitionEffective } from '@/lib/questionnaires-formation.mjs';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    // Les deux sortes de jetons ouvrent le même questionnaire.
    const lien = db.prepare('SELECT session_id FROM espace_liens WHERE token = ?').get(token)
      || db.prepare("SELECT session_id FROM espace_acces WHERE token = ? AND expires_at > datetime('now')").get(token);
    if (!lien) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

    const type = new URL(request.url).searchParams.get('type');
    if (!QUESTIONNAIRE_TYPE_TO_EVALUATION[type]) {
      return NextResponse.json({ error: 'Questionnaire inconnu' }, { status: 404 });
    }

    // Le programme de la session décide des questions posées.
    const s = db.prepare('SELECT formation_id FROM sessions WHERE id = ?').get(lien.session_id);
    const q = definitionEffective(db, s?.formation_id, type);
    if (!q) return NextResponse.json({ error: 'Questionnaire inconnu' }, { status: 404 });

    return NextResponse.json({ type: q.type, label: q.label, intro: q.intro, questions: q.questions, sur_mesure: q.sur_mesure });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

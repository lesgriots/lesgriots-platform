import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const formations = db.prepare(`
      SELECT f.*,
        COUNT(DISTINCT s.id) as sessions_count,
        COUNT(DISTINCT i.id) as total_inscriptions
      FROM formations f
      LEFT JOIN sessions s ON s.formation_id = f.id
      LEFT JOIN inscriptions i ON i.session_id = s.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `).all();
    return NextResponse.json(formations);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
    trimStrings(body);
    const {
      title, description = '', objectives = '[]', duration_hours = 0,
      duration_days = 0, modality = 'presentiel', level = '',
      price_ht = 0, max_participants = 12, prerequisites = '',
      program = '{}', evaluation_methods = '[]', target_audience = '',
      accessibility = '', status = 'active', thematique = '',
      certification = 'Aucune', financement_eligible = '[]',
      probleme_resolu = '', livrables_cles = '', format_label = '',
      delais_acces = '', modalites_pedagogiques = '', moyens_materiels = '',
      positionnement_grille = '[]', categorie = '', type_formation = 'standard'
    } = body;

    if (!title || typeof title !== 'string') return badRequest('Champ "title" requis');

    // Générer un code PR26-XXX (Programme — convention Digiforma)
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const idx = db.prepare("SELECT next_index FROM next_indices WHERE pillar = 'GRIOTHEQUE'").get();
    const nextIdx = idx ? idx.next_index : 1;
    const code = `PR${yearStr}${String(nextIdx).padStart(3, '0')}`;
    db.prepare("UPDATE next_indices SET next_index = next_index + 1 WHERE pillar = 'GRIOTHEQUE'").run();

    const id = randomUUID();
    db.prepare(`
      INSERT INTO formations (id, code, title, description, objectives, duration_hours, duration_days,
        modality, level, price_ht, max_participants, prerequisites, program,
        evaluation_methods, target_audience, accessibility, status, thematique, certification,
        financement_eligible, probleme_resolu, livrables_cles, format_label,
        delais_acces, modalites_pedagogiques, moyens_materiels, positionnement_grille, categorie, type_formation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, title, description,
      typeof objectives === 'string' ? objectives : JSON.stringify(objectives),
      toNum(duration_hours), toNum(duration_days), modality, level, toNum(price_ht), toNum(max_participants, 12),
      prerequisites,
      typeof program === 'string' ? program : JSON.stringify(program),
      typeof evaluation_methods === 'string' ? evaluation_methods : JSON.stringify(evaluation_methods),
      target_audience, accessibility, status, thematique, certification,
      typeof financement_eligible === 'string' ? financement_eligible : JSON.stringify(financement_eligible),
      probleme_resolu, livrables_cles, format_label,
      delais_acces, modalites_pedagogiques, moyens_materiels,
      typeof positionnement_grille === 'string' ? positionnement_grille : JSON.stringify(positionnement_grille),
      categorie, type_formation);

    const formation = db.prepare('SELECT * FROM formations WHERE id = ?').get(id);
    return NextResponse.json(formation, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);

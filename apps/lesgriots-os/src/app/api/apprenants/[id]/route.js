import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const apprenant = db.prepare('SELECT * FROM apprenants WHERE id = ?').get(id);
    if (!apprenant) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });

    const inscriptions = db.prepare(`
      SELECT i.*, s.start_date, s.end_date, s.location, s.status as session_status,
        f.title as formation_title, f.code as formation_code
      FROM inscriptions i
      JOIN sessions s ON s.id = i.session_id
      JOIN formations f ON f.id = s.formation_id
      WHERE i.apprenant_id = ?
      ORDER BY s.start_date DESC
    `).all(id);

    return NextResponse.json({ ...apprenant, inscriptions });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const allowed = ['first_name','last_name','email','phone','company',
      'address','postal_code','city','financement','notes',
      'date_naissance','situation_pro','statut_juridique',
      'handicap','precision_handicap','experience',
      'niveau_exp','motivation','modalite_paiement',
      'connu_comment','reseaux',
      'etat','etat_relance',
      'orga_opco','faf','statut_financement',
      'financement_entreprise','siret','entreprise_adresse',
      'entreprise_cp','entreprise_ville','entreprise_tel',
      'email_referent','nom_referent','dossier_url',
      'lien_calendly','date_positionnement','date_envoi_doc',
      'date_inscription','client_id',
      'positionnement_decision','positionnement_notes','positionnement_amenagements',
      'civilite','nationalite','lieu_naissance_ville','lieu_naissance_dept',
      'lieu_naissance_cp','num_secu','langue','code_interne'];

    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        // JSON fields should be stringified
        if (['connu_comment', 'reseaux', 'etat_relance'].includes(key) && Array.isArray(body[key])) {
          values.push(JSON.stringify(body[key]));
        } else {
          values.push(body[key]);
        }
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    const exists2 = db.prepare('SELECT id FROM apprenants WHERE id = ?').get(id);
    if (!exists2) return NextResponse.json({ error: 'Apprenant non trouvé', code: 'NOT_FOUND' }, { status: 404 });

    values.push(id);
    db.prepare(`UPDATE apprenants SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const apprenant = db.prepare('SELECT * FROM apprenants WHERE id = ?').get(id);
    return NextResponse.json(apprenant);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM apprenants WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Apprenant non trouvé', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM apprenants WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('apprenants:read', _GET);
export const PATCH = withGuard('apprenants:update', _PATCH);
export const DELETE = withGuard('apprenants:delete', _DELETE);

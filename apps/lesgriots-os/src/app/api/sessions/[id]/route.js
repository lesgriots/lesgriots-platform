import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.duration_hours, f.price_ht as formation_price_ht,
        c.company as client_company, c.first_name as client_first_name,
        c.last_name as client_last_name, c.email as client_email,
        c.phone as client_phone, c.address as client_address,
        c.postal_code as client_postal_code, c.city as client_city,
        c.siret as client_siret,
        p.code as project_code, p.name as project_name, p.stage as project_stage
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      LEFT JOIN clients c ON c.id = s.client_id
      LEFT JOIN projects p ON p.id = s.project_id
      WHERE s.id = ?
    `).get(id);
    if (!session) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });

    const inscriptions = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.email, a.phone, a.company
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ?
      ORDER BY a.last_name ASC
    `).all(id);

    const emargements = db.prepare(`
      SELECT e.*, a.first_name, a.last_name
      FROM emargements e
      JOIN apprenants a ON a.id = e.apprenant_id
      WHERE e.session_id = ?
      ORDER BY e.date ASC, a.last_name ASC
    `).all(id);

    return NextResponse.json({ ...session, inscriptions, emargements });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const exists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Session non trouvée', code: 'NOT_FOUND' }, { status: 404 });

    const allowed = ['start_date','end_date','location','modality','max_participants',
      'status','formateur_id','formateur_name','notes','type_session','horaire','tarif','adresse',
      'code_interne','advancement','documents','taux_marge',
      'lien_emargement','url_programme','formation_prete','planning','client_id',
      'project_id','cout_total','ca_confirmed',
      'gestionnaire_1','gestionnaire_2','inter_entreprise','exclure_catalogue',
      'sous_traitance','fuseau_horaire','type_action_formation','specialite_formation',
      'diplome_vise','nom_titre_vise','formation_a_distance','lieu_formation_id'];
    allowed.push('convocation_auto_enabled','convocation_lead_days','convocation_document_template','convocation_email_template');
    allowed.push('espace_nom_public','espace_description','espace_options');
    allowed.push('rappel_auto_enabled','rappel_lead_days','chaud_auto_enabled','chaud_delai_jours','froid_auto_enabled','froid_delai_jours');

    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        const val = body[key];
        values.push(typeof val === 'object' ? JSON.stringify(val) : val);
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // ── Régénérer les émargements si les dates ont changé ──
    if ('start_date' in body || 'end_date' in body) {
      const sess = db.prepare('SELECT start_date, end_date FROM sessions WHERE id = ?').get(id);
      if (sess && sess.start_date && sess.end_date) {
        const apprenants = db.prepare(
          'SELECT DISTINCT apprenant_id FROM inscriptions WHERE session_id = ?'
        ).all(id);

        if (apprenants.length > 0) {
          // Collect existing attendance data (matin/apres_midi already marked)
          const existingRows = db.prepare(
            'SELECT apprenant_id, date, matin, apres_midi FROM emargements WHERE session_id = ?'
          ).all(id);
          const existingMap = {};
          for (const r of existingRows) {
            existingMap[`${r.apprenant_id}_${r.date}`] = { matin: r.matin, apres_midi: r.apres_midi };
          }

          // Delete all existing emargements for this session
          db.prepare('DELETE FROM emargements WHERE session_id = ?').run(id);

          // Regenerate for new date range, preserving attendance data where dates overlap
          const start = new Date(sess.start_date + 'T00:00:00');
          const end = new Date(sess.end_date + 'T00:00:00');
          const insert = db.prepare(
            'INSERT INTO emargements (id, session_id, apprenant_id, date, matin, apres_midi) VALUES (?, ?, ?, ?, ?, ?)'
          );
          for (const { apprenant_id } of apprenants) {
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              const key = `${apprenant_id}_${dateStr}`;
              const prev = existingMap[key];
              insert.run(randomUUID(), id, apprenant_id, dateStr, prev?.matin || 0, prev?.apres_midi || 0);
            }
          }
        }
      }
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return NextResponse.json(session);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Session non trouvée', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);
export const PATCH = withGuard('sessions:update', _PATCH);
export const DELETE = withGuard('sessions:delete', _DELETE);

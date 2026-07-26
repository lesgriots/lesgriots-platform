import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const formation_id = searchParams.get('formation_id');

    let query = `
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        COUNT(i.id) as inscriptions_count,
        c.company as client_company
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      LEFT JOIN inscriptions i ON i.session_id = s.id
      LEFT JOIN clients c ON c.id = s.client_id
    `;
    const args = [];
    if (formation_id) {
      query += ' WHERE s.formation_id = ?';
      args.push(formation_id);
    }
    query += ' GROUP BY s.id ORDER BY s.start_date ASC';

    const sessions = db.prepare(query).all(...args);
    return NextResponse.json(sessions);
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
      formation_id, start_date, end_date,
      location = '', modality = 'presentiel', max_participants = 12,
      status = 'planned', formateur_id = null, formateur_name = '', notes = '',
      type_session = 'INTER', horaire = '', tarif = 0, adresse = '',
      code_interne = '', advancement = '{}', documents = '{}', taux_marge = 0,
      lien_emargement = '', url_programme = '', formation_prete = 0,
      planning = '[]', client_id = null,
      project_id = null, cout_total = 0, ca_confirmed = 0
    } = body;

    if (!formation_id || !start_date || !end_date) {
      return badRequest('formation_id, start_date, end_date requis');
    }

    // Auto-generate code_interne: AF26001, AF26002... (Action de Formation — convention Digiforma)
    let finalCodeInterne = code_interne;
    if (!finalCodeInterne) {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const countRow = db.prepare("SELECT COUNT(*) as cnt FROM sessions").get();
      const nextNum = (countRow?.cnt || 0) + 1;
      finalCodeInterne = `AF${yearStr}${String(nextNum).padStart(3, '0')}`;
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO sessions (id, formation_id, start_date, end_date, location, modality,
        max_participants, status, formateur_id, formateur_name, notes,
        type_session, horaire, tarif, adresse, code_interne, advancement, documents, taux_marge,
        lien_emargement, url_programme, formation_prete, planning, client_id,
        project_id, cout_total, ca_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, formation_id, start_date, end_date, location, modality,
      toNum(max_participants, 12), status, formateur_id, formateur_name, notes,
      type_session, horaire, toNum(tarif), adresse, finalCodeInterne, advancement, documents, toNum(taux_marge),
      lien_emargement, url_programme, formation_prete,
      typeof planning === 'string' ? planning : JSON.stringify(planning),
      client_id, project_id, toNum(cout_total), toNum(ca_confirmed));

    // Auto-copy formation modules to session_modules with default durations
    const formationModules = db.prepare(
      'SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(formation_id);
    if (formationModules.length > 0) {
      const insertMod = db.prepare(`
        INSERT INTO session_modules (id, session_id, module_id, title, description, objectives, duration_hours, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of formationModules) {
        const smId = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        insertMod.run(smId, id, m.id, m.title, m.description, m.objectives, m.duration_hours, m.sort_order);
      }
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return NextResponse.json(session, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);
export const POST = withGuard('sessions:create', _POST);

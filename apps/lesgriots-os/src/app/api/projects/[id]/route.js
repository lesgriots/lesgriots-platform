import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// PUT /api/projects/:id — Update project
async function _PUT(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Projet non trouvé', code: 'NOT_FOUND' }, { status: 404 });

    const body = await req.json();
    const fields = [];
    const values = [];

    const mapping = {
      name: 'name', client: 'client',
      clientId: 'client_id',
      clientFirstName: 'client_first_name',
      clientLastName: 'client_last_name',
      clientContact: 'client_contact',
      clientContactFirstName: 'client_contact_first_name',
      clientContactLastName: 'client_contact_last_name',
      paymentTerms: 'payment_terms',
      clientEmail: 'client_email', clientPhone: 'client_phone',
      clientAddress: 'client_address', stage: 'stage', revenue: 'revenue',
      budget: 'budget', notes: 'notes', bdcCount: 'bdc_count',
      startDate: 'start_date', endDate: 'end_date', hoursSpent: 'hours_spent',
      tvaRate: 'tva_rate',
    };

    for (const [jsKey, dbCol] of Object.entries(mapping)) {
      if (body[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        values.push(body[jsKey]);
      }
    }

    // ppmPhases stored as JSON
    if (body.ppmPhases !== undefined) {
      fields.push('ppm_phases = ?');
      values.push(JSON.stringify(body.ppmPhases));
    }
    // taskPhaseValidations stored as JSON
    if (body.taskPhaseValidations !== undefined) {
      fields.push('task_phase_validations = ?');
      values.push(JSON.stringify(body.taskPhaseValidations));
    }
    // creativeBrief stored as JSON
    if (body.creativeBrief !== undefined) {
      fields.push('creative_brief = ?');
      values.push(JSON.stringify(body.creativeBrief));
    }
    // projectJournal stored as JSON array
    if (body.projectJournal !== undefined) {
      fields.push('project_journal = ?');
      values.push(JSON.stringify(body.projectJournal));
    }
    // disciplines (Image/Stories/Movement) stored as JSON array of keys
    if (body.disciplines !== undefined) {
      fields.push('disciplines = ?');
      values.push(JSON.stringify(Array.isArray(body.disciplines) ? body.disciplines : []));
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// DELETE /api/projects/:id
async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Projet non trouvé', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('projects:update', _PUT);
export const DELETE = withGuard('projects:delete', _DELETE);

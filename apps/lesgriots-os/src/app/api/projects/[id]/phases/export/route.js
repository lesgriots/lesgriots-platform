// GET /api/projects/[id]/phases/export — Génère un PDF des phases & tâches du projet.
import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(_request, { params }) {
  const { id } = await params;

  try {
    const db = getDb();
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });

    const linkedClient = p.client_id
      ? db.prepare('SELECT * FROM clients WHERE id = ?').get(p.client_id)
      : null;

    const phases = db.prepare(`
      SELECT id, name, color, start_date, end_date, sort_order
      FROM production_phases WHERE project_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(id).map(ph => ({
      id: ph.id, name: ph.name, color: ph.color,
      startDate: ph.start_date, endDate: ph.end_date,
      sortOrder: ph.sort_order,
    }));

    const tasks = db.prepare(`
      SELECT id, title, status, phase, phase_group,
             assignee_id, assignee_name, due_date, sort_order,
             complexity, estimated_hours, depends_on
      FROM tasks WHERE project_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(id).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      phase_group: t.phase_group,
      assignee_name: t.assignee_name,
      due_date: t.due_date,
      sort_order: t.sort_order,
      complexity: t.complexity || 'simple',
      estimated_hours: t.estimated_hours,
      depends_on: (() => { try { return JSON.parse(t.depends_on || '[]'); } catch { return []; } })(),
    }));

    const payload = {
      project: {
        id: p.id,
        code: p.code,
        name: p.name,
        pillar: p.pillar,
        template: p.template,
        client: p.client,
        startDate: p.start_date,
        endDate: p.end_date,
        revenue: p.revenue,
        budget: p.budget,
      },
      client: linkedClient ? {
        company: linkedClient.company,
        firstName: linkedClient.first_name,
        lastName: linkedClient.last_name,
        email: linkedClient.email,
      } : null,
      phases,
      tasks,
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_phases.py');
    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 20 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      return NextResponse.json(
        { error: 'PDF generation failed', detail: stderr },
        { status: 500 }
      );
    }

    const filename = `Roadmap-${p.code || id.slice(0, 8)}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);

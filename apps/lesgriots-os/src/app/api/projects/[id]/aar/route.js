// GET /api/projects/[id]/aar — Génère un After Action Review PDF pour le projet.
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

    const tasks = db.prepare(`
      SELECT id, title, status, assignee_name FROM tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(id);

    const expenses = db.prepare(`
      SELECT id, amount_ttc, status, label
      FROM expenses WHERE project_id = ?
    `).all(id).catch(() => []);

    const journal = db.prepare(`
      SELECT content, created_at FROM journal
      WHERE project_id = ?
      ORDER BY created_at DESC LIMIT 20
    `).all(id).catch(() => []);

    let brief = {};
    try { brief = JSON.parse(p.creative_brief || '{}'); }
    catch { brief = {}; }

    const payload = {
      project: {
        id: p.id, code: p.code, name: p.name,
        pillar: p.pillar, template: p.template, client: p.client,
        startDate: p.start_date, endDate: p.end_date,
        revenue: p.revenue, budget: p.budget,
        hoursSpent: p.hours_spent,
        notes: p.notes,
        creativeBrief: brief,
      },
      client: linkedClient ? {
        company: linkedClient.company,
        firstName: linkedClient.first_name,
        lastName: linkedClient.last_name,
      } : null,
      tasks,
      expenses,
      journal: journal.map(j => ({ content: j.content, createdAt: j.created_at })),
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_aar.py');
    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15000,
      });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      return NextResponse.json(
        { error: 'PDF generation failed', detail: stderr },
        { status: 500 }
      );
    }

    const filename = `AAR-${p.code || id.slice(0, 8)}.pdf`;
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

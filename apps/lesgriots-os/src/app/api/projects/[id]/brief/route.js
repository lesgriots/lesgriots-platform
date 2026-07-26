// GET /api/projects/[id]/brief — Génère un PDF du Creative Brief du projet.
// Appelle src/lib/generate_brief.py via execFile pour produire le PDF.
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

    // Client lié si dispo
    const linkedClient = p.client_id
      ? db.prepare('SELECT * FROM clients WHERE id = ?').get(p.client_id)
      : null;

    // Parse creative_brief JSON
    let brief = {};
    try { brief = JSON.parse(p.creative_brief || '{}'); }
    catch { brief = {}; }

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
        notes: p.notes,
      },
      client: linkedClient
        ? {
            company: linkedClient.company,
            firstName: linkedClient.first_name,
            lastName: linkedClient.last_name,
            email: linkedClient.email,
          }
        : null,
      brief,
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_brief.py');
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

    const filename = `Brief-${p.code || id.slice(0, 8)}.pdf`;
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

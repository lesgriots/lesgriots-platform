// GET /api/projects/[id]/media-release — Génère une cession de droit à l'image FR pré-remplie.
import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const duration = searchParams.get('duration') || '10 (dix) ans';
  const territory = searchParams.get('territory') || 'monde entier';

  try {
    const db = getDb();
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });

    const linkedClient = p.client_id
      ? db.prepare('SELECT * FROM clients WHERE id = ?').get(p.client_id)
      : null;

    const payload = {
      project: {
        name: p.name,
        code: p.code,
        pillar: p.pillar,
        client: p.client,
      },
      client: linkedClient ? {
        company: linkedClient.company,
        firstName: linkedClient.first_name,
        lastName: linkedClient.last_name,
      } : null,
      signed_at: 'Paris',
      date: new Date().toISOString().slice(0, 10),
      duration,
      territory,
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_media_release.py');
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

    const filename = `CessionImage-${p.code || id.slice(0, 8)}.pdf`;
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

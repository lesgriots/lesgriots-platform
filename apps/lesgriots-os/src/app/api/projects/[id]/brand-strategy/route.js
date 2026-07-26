// GET /api/projects/[id]/brand-strategy — Génère un Brand Strategy Workbook (The Futur).
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

    let brief = {};
    try { brief = JSON.parse(p.creative_brief || '{}'); }
    catch { brief = {}; }

    // brand_strategy stocké dans la colonne notes en JSON (best-effort)
    // ou via une nouvelle colonne dédiée — pour V1 on extrait depuis brief.brandPositioning si dispo
    const strategy = {
      brand_name: p.name,
      mission: brief.goal || '',
      manifesto: brief.brandPositioning || '',
    };

    const payload = {
      project: {
        id: p.id, code: p.code, name: p.name,
        pillar: p.pillar, client: p.client,
      },
      client: linkedClient ? {
        company: linkedClient.company,
        firstName: linkedClient.first_name,
        lastName: linkedClient.last_name,
      } : null,
      brief,
      strategy,
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_brand_strategy.py');
    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 15 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      return NextResponse.json(
        { error: 'PDF generation failed', detail: stderr },
        { status: 500 }
      );
    }

    const filename = `BrandStrategy-${p.code || id.slice(0, 8)}.pdf`;
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

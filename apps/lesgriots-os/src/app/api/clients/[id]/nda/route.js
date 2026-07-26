// GET /api/clients/[id]/nda — Génère un NDA FR pré-rempli depuis la fiche client.
import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const context = searchParams.get('context') || '';
  const durationYears = parseInt(searchParams.get('duration') || '3', 10);

  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!c) return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });

    const payload = {
      client: {
        company: c.company,
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email,
        address: c.address,
        siret: c.siret,
        title: c.title,
      },
      context: context || 'des discussions et échanges professionnels',
      duration_years: durationYears,
      signed_at: 'Paris',
      date: new Date().toISOString().slice(0, 10),
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_nda.py');
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

    const slug = (c.company || `${c.first_name || ''}-${c.last_name || ''}`)
      .toString()
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || id.slice(0, 8);
    const filename = `NDA-${slug}.pdf`;
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
export const GET = withGuard('clients:read', _GET);

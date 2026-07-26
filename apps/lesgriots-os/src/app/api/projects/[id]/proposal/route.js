// GET /api/projects/[id]/proposal — Génère une Proposal PDF (Chris Do · The Perfect Proposal).
// Query params : challenge, approach, outcome, payment_terms, levels (JSON stringifié)
import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

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

    // Génération automatique des 3 niveaux si non fournis
    const baseRevenue = parseFloat(p.revenue) || 10000;
    let levels;
    try {
      levels = JSON.parse(searchParams.get('levels') || 'null');
    } catch { levels = null; }
    if (!levels) {
      levels = [
        { name: 'GOOD', price_ht: Math.round(baseRevenue * 0.6 / 100) * 100,
          included: ['Brief & kickoff', 'Phase 1 du périmètre', 'Livrable principal', '1 round de révisions'] },
        { name: 'BETTER', price_ht: Math.round(baseRevenue / 100) * 100, recommended: true,
          included: ['Tout GOOD', 'Périmètre complet', 'Livrables additionnels', '2 rounds de révisions', 'Support post-livraison 30j'] },
        { name: 'BEST', price_ht: Math.round(baseRevenue * 1.6 / 100) * 100,
          included: ['Tout BETTER', 'Stratégie + production étendue', 'Variations supplémentaires', 'Coaching équipe', 'Support 90j'] },
      ];
    }

    const payload = {
      project: {
        id: p.id, code: p.code, name: p.name,
        pillar: p.pillar, template: p.template, client: p.client,
        startDate: p.start_date, endDate: p.end_date,
        revenue: p.revenue, budget: p.budget,
      },
      client: linkedClient ? {
        company: linkedClient.company,
        firstName: linkedClient.first_name,
        lastName: linkedClient.last_name,
      } : null,
      brief,
      levels,
      challenge: searchParams.get('challenge') || '',
      approach: searchParams.get('approach') || '',
      outcome: searchParams.get('outcome') || '',
      payment_terms: parseInt(searchParams.get('payment_terms') || '30', 10),
    };

    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_proposal.py');
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

    const filename = `Proposal-${p.code || id.slice(0, 8)}.pdf`;
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

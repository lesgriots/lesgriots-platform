import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/bilan-eval?type=satisfaction|froid|positionnement|acquis
 * Generates a Bilan d'Évaluation PDF (synthesis of all evaluations for a type).
 */
async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const evalType = searchParams.get('type') || 'satisfaction';

  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

    // Get all evaluations of this type for this session
    const evals = db.prepare(`
      SELECT e.*, a.first_name, a.last_name
      FROM evaluations e
      JOIN apprenants a ON a.id = e.apprenant_id
      WHERE e.session_id = ? AND e.type = ?
    `).all(id, evalType);

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const payload = {
      formationTitle: session.formation_title || 'Formation',
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      evalType,
      evaluations: evals.map(ev => {
        let responses = {};
        // Try parsing responses field first, then comments as JSON
        try { responses = JSON.parse(ev.responses || '{}'); } catch {}
        if (Object.keys(responses).length === 0) {
          try { responses = JSON.parse(ev.comments || '{}'); } catch {}
        }
        return {
          stagiaireName: `${ev.last_name || ''} ${ev.first_name || ''}`.trim(),
          score: ev.score,
          responses,
          comments: ev.comments || '',
        };
      }),
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28 76 07471 76',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_bilan_eval.py');
    console.log('[bilan-eval] Generating for session:', id, 'type:', evalType, 'count:', evals.length);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[bilan-eval] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation bilan PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
      }, { status: 500 });
    }

    const typeLabel = { satisfaction: 'AChaud', froid: 'AFroid', positionnement: 'Positionnement', acquis: 'Acquis' }[evalType] || evalType;
    const sessionCode = session.code_interne || session.formation_code || id.slice(0, 6);
    const safeFilename = `Bilan-${typeLabel}-${sessionCode}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[bilan-eval] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

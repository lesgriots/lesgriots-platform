import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/emargement?mode=jour|semaine|demi_journee|session|module|mensuel
 * Generates a Feuille d'Emargement PDF.
 *
 * Modes:
 *   - jour (default): one page per training day
 *   - semaine: one page per week (groups days)
 *   - demi_journee: one page per half-day (morning/afternoon)
 *   - session: one recap sheet for the entire session
 *   - module: one page per training module
 *   - mensuel: one page per month (for long trainings)
 */
async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'jour';

  const VALID_MODES = ['jour', 'semaine', 'demi_journee', 'session', 'module', 'mensuel'];
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({
      error: `Mode invalide: ${mode}. Modes disponibles: ${VALID_MODES.join(', ')}`,
    }, { status: 400 });
  }

  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.duration_hours as f_duration_hours
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

    // All inscribed apprenants
    const inscriptions = db.prepare(`
      SELECT a.id as apprenant_id, a.first_name, a.last_name
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ?
    `).all(id);

    // Signatures électroniques recueillies via la page publique /p/emargement
    const signatureRows = db.prepare(`
      SELECT apprenant_id, signer_role, date, period, signature_png, signed_name
      FROM signatures WHERE session_id = ?
    `).all(id);

    // Modules (for mode=module)
    const modules = db.prepare(`
      SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC
    `).all(session.formation_id || '');

    let formateurName = session.formateur_name || '';
    if (session.formateur_id) {
      const f = db.prepare('SELECT first_name, last_name FROM formateurs WHERE id = ?').get(session.formateur_id);
      if (f) formateurName = `${f.first_name || ''} ${f.last_name || ''}`.trim();
    }
    if (!formateurName) formateurName = 'Moustapha COULIBALY';

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Parse planning
    let planning = [];
    try { planning = JSON.parse(session.planning || '[]'); } catch { planning = []; }

    // Parse modules for mode=module
    const moduleData = modules.map(m => {
      let items = [];
      try { items = JSON.parse(m.objectives || '[]'); } catch { items = []; }
      return {
        title: m.title || '',
        items,
        duration_hours: m.duration_hours || 0,
      };
    });

    const payload = {
      mode,
      formationTitle: session.formation_title || 'Formation',
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      location: session.adresse || session.location || '',
      horaires: session.horaire || '09h00 - 12h30 / 14h00 - 17h30',
      planning,
      modules: moduleData,
      stagiaires: inscriptions.map(i => ({
        id: i.apprenant_id,
        firstName: i.first_name || '',
        lastName: i.last_name || '',
      })),
      signatures: signatureRows.map(r => ({
        apprenantId: r.apprenant_id || '',
        signerRole: r.signer_role,
        date: r.date,
        period: r.period,
        png: r.signature_png,
        signedName: r.signed_name || '',
      })),
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      formateurName,
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28 76 07471 76',
      emailFormation: 'formation@lesgriots.com',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_emargement.py');
    console.log('[emargement] Generating for session:', id, 'mode:', mode);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });
    } catch (pyErr) {
      console.error('[emargement] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation emargement PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
      }, { status: 500 });
    }

    const sessionCode = session.code_interne || session.formation_code || id.slice(0, 6);
    const modeLabel = { jour: 'Jour', semaine: 'Semaine', demi_journee: 'DemiJournee', session: 'Session', module: 'Module', mensuel: 'Mensuel' }[mode] || mode;
    const safeFilename = `Emargement-${modeLabel}-${sessionCode}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[emargement] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

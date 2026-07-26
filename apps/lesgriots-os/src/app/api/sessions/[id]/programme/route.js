import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/programme
 * Generates a Programme Detaille PDF for the session's formation.
 * No apprenant_id needed — programme is per-formation.
 */
async function _GET(request, { params }) {
  const { id } = await params;

  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.description as formation_description,
        f.duration_hours, f.duration_days, f.price_ht as formation_price_ht,
        f.modality as formation_modality, f.prerequisites,
        f.objectives, f.evaluation_methods, f.target_audience,
        f.delais_acces, f.modalites_pedagogiques, f.moyens_materiels
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

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

    let objectives = [];
    try { objectives = JSON.parse(session.objectives || '[]'); } catch { objectives = []; }

    const moduleData = modules.map(m => {
      let items = [];
      try { items = JSON.parse(m.objectives || '[]'); } catch { items = []; }
      if (items.length === 0 && m.description) {
        items = m.description.split('\n').filter(l => l.trim());
      }
      return { title: m.title || '', items, duration_hours: m.duration_hours || 0 };
    });

    const payload = {
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      formationTitle: session.formation_title || 'Formation',
      formationDescription: session.formation_description || '',
      formationObjectives: objectives,
      formationPrerequisites: session.prerequisites || 'Aucun',
      formationPublic: session.target_audience || 'TPE, independants, entrepreneurs',
      formationModality: (session.modality || session.formation_modality || 'presentiel')
        .replace('presentiel', 'Presentiel').replace('distanciel', 'Distanciel').replace('hybride', 'Hybride'),
      formationEvaluation: session.evaluation_methods || 'Continue + a chaud + a froid',
      formationMethod: session.modalites_pedagogiques || 'Active et participative',
      formationMoyensMateriels: session.moyens_materiels || '',
      formationDelais: session.delais_acces || 'Minimum deux semaines apres validation',
      durationHours: session.duration_hours || 0,
      durationDays: session.duration_days || 0,
      modules: moduleData,
      formateurName,
      location: session.adresse || session.location || '',
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28 76 07471 76',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '76610',
      city: settings.city || 'Le Havre',
      emailFormation: 'formation@lesgriots.com',
      phoneFormation: '06 47 04 15 35',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_programme.py');
    console.log('[programme] Generating for session:', id);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[programme] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation programme PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
      }, { status: 500 });
    }

    const sessionCode = session.code_interne || session.formation_code || id.slice(0, 6);
    const safeFilename = `Programme-${sessionCode}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[programme] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

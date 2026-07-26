import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/certificat?apprenant_id=xxx
 * Generates a Certificat de Realisation PDF.
 */
async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const apprenantId = searchParams.get('apprenant_id');

  if (!apprenantId) {
    return NextResponse.json({ error: 'apprenant_id est requis' }, { status: 400 });
  }

  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.duration_hours, f.modality as formation_modality, f.objectives
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

    const inscription = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.company as apprenant_company
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ? AND i.apprenant_id = ?
    `).get(id, apprenantId);

    if (!inscription) {
      return NextResponse.json({ error: 'Inscription non trouvee' }, { status: 404 });
    }

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    let objectives = [];
    try { objectives = JSON.parse(session.objectives || '[]'); } catch { objectives = []; }

    const payload = {
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      stagiairePrenom: inscription.first_name || '',
      stagiaireName: inscription.last_name || '',
      stagiaireCompany: inscription.apprenant_company || '',
      formationTitle: session.formation_title || 'Formation',
      formationObjectives: objectives,
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      durationHours: session.duration_hours || 0,
      location: session.adresse || session.location || '',
      formationModality: (session.modality || session.formation_modality || 'presentiel')
        .replace('presentiel', 'Presentiel').replace('distanciel', 'Distanciel').replace('hybride', 'Hybride'),
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28 76 07471 76',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '76610',
      city: settings.city || 'Le Havre',
      certificatDate: new Date().toISOString().slice(0, 10),
      representantOf: settings.representant || 'Moustapha COULIBALY',
      emailFormation: 'formation@lesgriots.com',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_certificat.py');
    console.log('[certificat] Generating for session:', id, 'apprenant:', apprenantId);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[certificat] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation certificat PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
      }, { status: 500 });
    }

    const appSlug = `${inscription.last_name || 'stagiaire'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const safeFilename = `Certificat-${appSlug}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[certificat] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

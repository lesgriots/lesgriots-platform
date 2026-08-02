import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { lireObjectifs } from '@/lib/objectifs.mjs';

/**
 * GET /api/sessions/:id/attestation?apprenant_id=xxx
 * Generates an Attestation de fin de formation PDF.
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
        f.duration_hours, f.modality as formation_modality,
        f.objectives, f.target_audience
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

    const inscription = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.email as apprenant_email,
        a.company as apprenant_company
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ? AND i.apprenant_id = ?
    `).get(id, apprenantId);

    if (!inscription) {
      return NextResponse.json({ error: 'Inscription non trouvee' }, { status: 404 });
    }

    let formateurName = session.formateur_name || '';
    if (session.formateur_id) {
      const f = db.prepare('SELECT first_name, last_name FROM formateurs WHERE id = ?').get(session.formateur_id);
      if (f) formateurName = `${f.first_name || ''} ${f.last_name || ''}`.trim();
    }
    if (!formateurName) formateurName = 'Moustapha COULIBALY';

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Le champ accepte du JSON comme du texte tapé à la main. Ne lire que le
    // JSON produisait un document sans un seul objectif, sans le dire.
    const objectives = lireObjectifs(session.objectives);

    /*
     * Un document à « 0 heure » ne vaut rien, et coûte cher.
     *
     * C'est la pièce que l'OPCO lit pour payer et que l'auditeur regarde pour
     * vérifier la réalisation. Sortie avec une durée nulle, elle est refusée
     * en aval, mais rien ici ne l'avait signalé. Mieux vaut un refus net,
     * qui dit où corriger, qu'un PDF officiel qui se fera retoquer.
     */
    const heures = Number(session.duration_hours) || 0;
    if (!heures) {
      return NextResponse.json({
        error: 'Durée de la formation absente : le document sortirait à 0 heure. '
             + 'Renseigne la durée sur la fiche programme, puis relance.',
      }, { status: 422 });
    }

    const payload = {
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      stagiairePrenom: inscription.first_name || '',
      stagiaireName: inscription.last_name || '',
      stagiaireCompany: inscription.apprenant_company || '',
      formationTitle: session.formation_title || 'Formation',
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      durationHours: heures,
      location: session.adresse || session.location || '',
      formationModality: (session.modality || session.formation_modality || 'presentiel')
        .replace('presentiel', 'Presentiel').replace('distanciel', 'Distanciel').replace('hybride', 'Hybride'),
      formationObjectives: objectives,
      formateurName,
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28 76 07471 76',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '76610',
      city: settings.city || 'Le Havre',
      attestationDate: new Date().toISOString().slice(0, 10),
      emailFormation: 'formation@lesgriots.com',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_attestation.py');
    console.log('[attestation] Generating for session:', id, 'apprenant:', apprenantId);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[attestation] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation attestation PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
      }, { status: 500 });
    }

    const appSlug = `${inscription.last_name || 'stagiaire'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const safeFilename = `Attestation-${appSlug}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[attestation] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/convention?apprenant_id=xxx
 * Generates a Convention de Formation PDF for a specific apprenant.
 * Query params:
 *   apprenant_id (required) — ID of the apprenant
 * Returns: application/pdf
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

    // Load session + formation
    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.description as formation_description,
        f.duration_hours, f.duration_days, f.price_ht as formation_price_ht,
        f.modality as formation_modality, f.prerequisites,
        f.objectives, f.evaluation_methods, f.target_audience,
        f.delais_acces, f.modalites_pedagogiques, f.moyens_materiels,
        f.program as formation_program
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvee' }, { status: 404 });
    }

    // Load apprenant + inscription
    const inscription = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.email as apprenant_email,
        a.phone as apprenant_phone, a.company as apprenant_company,
        a.siret as apprenant_siret, a.address as apprenant_address,
        a.postal_code as apprenant_postal_code, a.city as apprenant_city
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ? AND i.apprenant_id = ?
    `).get(id, apprenantId);

    if (!inscription) {
      return NextResponse.json({ error: 'Inscription non trouvee' }, { status: 404 });
    }

    // Load all inscriptions for this session (convention can list multiple stagiaires)
    const allInscriptions = db.prepare(`
      SELECT a.first_name, a.last_name, a.email, a.company
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ?
    `).all(id);

    // Load modules
    const modules = db.prepare(`
      SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC
    `).all(session.formation_id || '');

    // Load formateur
    let formateurName = session.formateur_name || '';
    if (session.formateur_id) {
      const formateur = db.prepare('SELECT * FROM formateurs WHERE id = ?').get(session.formateur_id);
      if (formateur) {
        formateurName = `${formateur.first_name || ''} ${formateur.last_name || ''}`.trim();
      }
    }
    if (!formateurName) formateurName = 'Moustapha COULIBALY';

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Parse objectives
    let objectives = [];
    try {
      objectives = JSON.parse(session.objectives || '[]');
    } catch { objectives = []; }

    // Convention number
    const yr = String(new Date().getFullYear()).slice(2);
    const appInitials = `${(inscription.first_name || '')[0] || ''}${(inscription.last_name || '')[0] || ''}`.toUpperCase();
    const dateSlug = (session.start_date || '').replace(/-/g, '').slice(2, 8);
    const conventionNumber = `CONV-${yr}-${dateSlug}-${appInitials}`;

    // Build payload
    const payload = {
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      // Convention info
      conventionNumber,
      conventionDate: new Date().toISOString().slice(0, 10),

      // Client / stagiaire
      clientName: inscription.apprenant_company || `${inscription.first_name} ${inscription.last_name}`,
      clientSiret: inscription.apprenant_siret || '',
      clientAddress: inscription.apprenant_address || '',
      clientPostalCode: inscription.apprenant_postal_code || '',
      clientCity: inscription.apprenant_city || '',
      clientRepresentant: `${inscription.first_name || ''} ${inscription.last_name || ''}`.trim(),

      // Stagiaires list
      stagiaires: allInscriptions.map(i => ({
        firstName: i.first_name,
        lastName: i.last_name,
        email: i.email || '',
        company: i.company || '',
      })),

      // Formation
      formationTitle: session.formation_title || 'Formation',
      formationDescription: session.formation_description || '',
      formationObjectives: objectives,
      formationPrerequisites: session.prerequisites || 'Aucun',
      formationPublic: session.target_audience || 'TPE, independants, entrepreneurs',
      formationModality: (session.modality || session.formation_modality || 'presentiel')
        .replace('presentiel', 'Presentiel')
        .replace('distanciel', 'Distanciel')
        .replace('hybride', 'Hybride'),
      formationEvaluation: session.evaluation_methods || 'Continue + a chaud + a froid',
      formationSanction: 'Attestation de fin de formation',

      // Modules
      modules: modules.map(m => {
        let items = [];
        try {
          items = JSON.parse(m.objectives || '[]');
        } catch { items = []; }
        if (items.length === 0 && m.description) {
          items = m.description.split('\n').filter(l => l.trim());
        }
        return { title: m.title || '', items, duration_hours: m.duration_hours || 0 };
      }),

      // Session dates
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      durationHours: session.duration_hours || session.formation_duration_hours || 0,
      durationDays: session.duration_days || session.formation_duration_days || 0,
      location: session.adresse || session.location || '',
      horaires: session.horaire || '09h00 - 12h30 / 14h00 - 17h30',

      // Formateur
      formateurName,

      // Financier
      priceHt: session.price_ht || session.formation_price_ht || 0,
      tvaApplicable: settings.tva_applicable !== 'false',
      tvaRate: parseFloat(settings.tva_rate || '20') / 100,

      // Organisme (from settings)
      companyName: settings.company_name || 'LES GRIOTS',
      legalStatus: settings.legal_status || 'SASU',
      capital: '1000',
      rcs: settings.siren || '902 628 684',
      siret: settings.siret || '90262868400018',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '76610',
      city: settings.city || 'Le Havre',
      nda: settings.nda || '28 76 07471 76',
      dreets: 'DREETS de Normandie',
      emailFormation: 'formation@lesgriots.com',
      phoneFormation: '06 47 04 15 35',
      representantOf: settings.representant || 'Moustapha COULIBALY',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_convention.py');
    console.log('[convention] Generating for session:', id, 'apprenant:', apprenantId);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[convention] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur generation convention PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
        hint: 'Verifiez que python3 et reportlab sont installes: pip3 install reportlab'
      }, { status: 500 });
    }

    console.log('[convention] PDF generated:', pdfBuffer.length, 'bytes');

    const appSlug = `${inscription.last_name || 'client'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const sessionCode = session.code_interne || session.formation_code || id.slice(0, 6);
    const safeFilename = `Convention-${appSlug}-${sessionCode}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (err) {
    console.error('[convention] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

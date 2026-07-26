import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/livret?apprenant_id=xxx
 * Generates a Livret d'Accueil & Convocation PDF for a specific apprenant.
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
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
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
      return NextResponse.json({ error: 'Inscription non trouvée' }, { status: 404 });
    }

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
      const raw = session.objectives || '[]';
      objectives = JSON.parse(raw);
    } catch { objectives = []; }

    // Parse planning (session.planning is JSON array)
    let planning = [];
    try {
      const raw = session.planning || '[]';
      planning = JSON.parse(raw);
    } catch { planning = []; }

    // Parse modules into chapitres with items
    const moduleData = modules.map(m => {
      let items = [];
      try {
        const rawObj = JSON.parse(m.objectives || '[]');
        items = Array.isArray(rawObj) ? rawObj : [];
      } catch { items = []; }
      // If objectives empty, try description
      if (items.length === 0 && m.description) {
        items = m.description.split('\n').filter(l => l.trim());
      }
      return {
        title: m.title || '',
        items,
      };
    });

    // Generate dossier number
    const appInitials = `${(inscription.first_name || '')[0] || ''}${(inscription.last_name || '')[0] || ''}`.toUpperCase();
    const yr = String(new Date().getFullYear()).slice(2);
    const sessionCode = session.code_interne || session.formation_code || id.slice(0, 6);
    const dateSlug = (session.start_date || '').replace(/-/g, '').slice(2, 8);
    const dossierNumber = `${yr}A${appInitials}${dateSlug}`;

    // Build payload
    const payload = {
      logoPath: path.join(process.cwd(), 'public/branding/griotheque-logo-ink.png'),
      // Stagiaire
      stagiairePrenom: inscription.first_name || '',
      stagiaireName: inscription.last_name || '',
      stagiaireCompany: inscription.apprenant_company || '',
      stagiaireSiret: inscription.apprenant_siret || '',
      stagiaireEmail: inscription.apprenant_email || '',
      dossierNumber,

      // Formation
      formationTitle: session.formation_title || 'Formation',
      formationDescription: session.formation_description || '',
      formationObjectives: objectives,
      formationPrerequisites: session.prerequisites || 'Aucun',
      formationPublic: session.target_audience || 'TPE, indépendants, entrepreneurs',
      formationModality: (session.modality || session.formation_modality || 'presentiel')
        .replace('presentiel', 'Présentiel')
        .replace('distanciel', 'Distanciel')
        .replace('hybride', 'Hybride'),
      formationEvaluation: 'Continue + à chaud + à froid',
      formationSanction: 'Attestation de fin de formation',
      formationDelais: session.delais_acces || 'Minimum deux semaines après validation',
      formationAdmission: 'Sur entretien préalable',
      formationMethod: session.modalites_pedagogiques || 'Active et participative',
      formationMoyensMateriels: session.moyens_materiels || '',

      // Modules / programme
      modules: moduleData,

      // Planning
      planning,

      // Session
      startDate: session.start_date || '',
      endDate: session.end_date || '',
      location: session.adresse || session.location || '',
      horaires: session.horaire || '09h00 – 12h30 · 14h00 – 17h30',

      // Formateur
      formateurName,

      // Company (from settings)
      companyName: settings.company_name || 'LES GRIOTS',
      legalStatus: settings.legal_status || 'SASU',
      capital: '1000 €',
      rcs: settings.siren || '902 628 684',
      siret: settings.siret || '90262868400018',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '76610',
      city: settings.city || 'Le Havre',
      nda: settings.nda || '28 76 07471 76',
      dreets: 'DREETS de Normandie',
      emailFormation: 'formation@lesgriots.com',
      phoneFormation: '06 47 04 15 35',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_livret.py');
    console.log('[livret] Generating for session:', id, 'apprenant:', apprenantId);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
      });
    } catch (pyErr) {
      console.error('[livret] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur génération livret PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
        hint: 'Vérifiez que python3 et reportlab sont installés: pip3 install reportlab'
      }, { status: 500 });
    }

    console.log('[livret] PDF generated:', pdfBuffer.length, 'bytes');

    const appSlug = `${inscription.last_name || 'stagiaire'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const safeFilename = `Livret-Convocation-${appSlug}-${sessionCode}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (err) {
    console.error('[livret] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

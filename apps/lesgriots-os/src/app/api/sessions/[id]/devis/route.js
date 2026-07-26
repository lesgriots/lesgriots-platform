import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/devis?apprenant_id=xxx
 * Generates a devis PDF for a specific apprenant in a formation session.
 * - Inter: 1 devis par apprenant (tarif individuel)
 * - Intra: 1 devis global (tarif forfaitaire pour l'entreprise)
 * Query params:
 *   apprenant_id (required for inter) — ID of the apprenant/inscription
 * Returns: application/pdf
 */
async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const apprenantId = searchParams.get('apprenant_id');

  try {
    const db = getDb();

    // Load session with formation + client joins
    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.description as formation_description,
        f.duration_hours, f.duration_days, f.price_ht as formation_price_ht,
        f.modality as formation_modality, f.level as formation_level,
        f.max_participants, f.prerequisites, f.objectives, f.evaluation_methods,
        f.target_audience, f.accessibility, f.certification,
        f.delais_acces, f.modalites_pedagogiques, f.moyens_materiels,
        f.categorie, f.type_formation,
        c.company as client_company, c.first_name as client_first_name,
        c.last_name as client_last_name, c.email as client_email,
        c.phone as client_phone, c.address as client_address,
        c.postal_code as client_postal_code, c.city as client_city,
        c.siret as client_siret
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.id = ?
    `).get(id);

    if (!session) {
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    const typeSession = session.type_session || 'inter';
    const isIntra = typeSession.toLowerCase().includes('intra');

    // For inter sessions, apprenant_id is required
    let apprenant = null;
    let inscription = null;
    if (apprenantId) {
      // Load apprenant + inscription details
      inscription = db.prepare(`
        SELECT i.*, a.first_name, a.last_name, a.email as apprenant_email,
          a.phone as apprenant_phone, a.company as apprenant_company,
          a.address as apprenant_address, a.postal_code as apprenant_postal_code,
          a.city as apprenant_city, a.financement as apprenant_financement
        FROM inscriptions i
        JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ? AND i.apprenant_id = ?
      `).get(id, apprenantId);

      if (!inscription) {
        return NextResponse.json({ error: 'Inscription non trouvée pour cet apprenant' }, { status: 404 });
      }
    } else if (!isIntra) {
      return NextResponse.json({
        error: 'apprenant_id requis pour les sessions inter-entreprises'
      }, { status: 400 });
    }

    // Fetch modules for detailed description
    const modules = db.prepare(`
      SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC
    `).all(session.formation_id || '');

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Parse dates
    const startDateFr = session.start_date
      ? new Date(session.start_date).toLocaleDateString('fr-FR')
      : '';
    const endDateFr = session.end_date
      ? new Date(session.end_date).toLocaleDateString('fr-FR')
      : '';

    // Build description from modules
    let descriptionDetails = session.formation_description || '';
    if (modules.length > 0) {
      descriptionDetails += '\n\nContenu pédagogique :\n';
      modules.forEach((m, i) => {
        descriptionDetails += `${i + 1}. ${m.title}`;
        if (m.duration_hours) descriptionDetails += ` (${m.duration_hours}h)`;
        descriptionDetails += '\n';
      });
    }

    // Griothèque = exonéré de TVA
    const pillar = 'GRIOTHEQUE';
    const tvaRate = 0;

    // Determine pricing and client info based on inter/intra
    let lines = [];
    let devisNumber, clientName, clientFirstName, clientLastName, clientEmail;
    let clientAddress, clientSiret, clientCompany;
    const year = new Date().getFullYear();
    const yr = String(year).slice(2);

    if (isIntra) {
      // INTRA: devis global pour l'entreprise cliente de la session
      const tarif = parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
      const nbApprenants = db.prepare(`SELECT COUNT(*) as c FROM inscriptions WHERE session_id = ?`).get(id)?.c || 1;

      devisNumber = `D-GR-${yr}-${(session.formation_code || id.slice(0, 6)).toUpperCase()}-INTRA`;
      clientCompany = session.client_company || '';
      clientFirstName = session.client_first_name || '';
      clientLastName = session.client_last_name || '';
      clientEmail = session.client_email || '';
      clientAddress = [session.client_address, session.client_postal_code, session.client_city].filter(Boolean).join(', ');
      clientSiret = session.client_siret || '';
      clientName = clientCompany;

      lines.push({
        description: `Formation "${session.formation_title}" — Session intra-entreprise\n${session.duration_hours || ''}h (${session.duration_days || ''} jour(s))\nDu ${startDateFr} au ${endDateFr}\n${nbApprenants} apprenant(s)`,
        qty: 1,
        unit: 'forfait',
        priceHT: tarif,
        tvaRate,
      });
    } else {
      // INTER: devis individuel par apprenant
      // Prix = inscription.price_ht si défini, sinon tarif session, sinon tarif formation
      const tarif = parseFloat(inscription.price_ht) || parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
      const appName = `${inscription.first_name} ${inscription.last_name}`.trim();
      const appCompany = inscription.apprenant_company || '';

      // Build unique devis number with apprenant initials
      const initials = `${(inscription.first_name || '')[0] || ''}${(inscription.last_name || '')[0] || ''}`.toUpperCase();
      devisNumber = `D-GR-${yr}-${(session.formation_code || id.slice(0, 6)).toUpperCase()}-${initials}`;

      // Client = the apprenant (or their company)
      clientCompany = appCompany;
      clientFirstName = inscription.first_name || '';
      clientLastName = inscription.last_name || '';
      clientEmail = inscription.apprenant_email || '';
      clientAddress = [inscription.apprenant_address, inscription.apprenant_postal_code, inscription.apprenant_city].filter(Boolean).join(', ');
      clientSiret = ''; // apprenants don't typically have SIRET
      clientName = appCompany || appName;

      lines.push({
        description: `Formation "${session.formation_title}" — Session inter-entreprises\n${session.duration_hours || ''}h (${session.duration_days || ''} jour(s))\nDu ${startDateFr} au ${endDateFr}\nApprenant : ${appName}`,
        qty: 1,
        unit: 'personne',
        priceHT: tarif,
        tvaRate,
      });

      // Add financement info if present
      if (inscription.financement || inscription.apprenant_financement) {
        const fin = inscription.financement || inscription.apprenant_financement;
        descriptionDetails += `\nFinancement : ${fin}`;
      }
    }

    const today = new Date().toLocaleDateString('fr-FR');

    // Build per-module lines for the pricing table (Ecohesens style)
    const moduleLines = [];
    if (modules.length > 0) {
      const perModulePrice = isIntra
        ? (parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0) / modules.length
        : (parseFloat(inscription?.price_ht) || parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0) / modules.length;

      modules.forEach(m => {
        moduleLines.push({
          description: `${m.title}${m.description ? ' - ' + m.description : ''}`,
          qty: 1,
          priceHT: Math.round(perModulePrice * 100) / 100,
        });
      });
    } else {
      // No modules: single line
      const singlePrice = isIntra
        ? (parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0)
        : (parseFloat(inscription?.price_ht) || parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0);
      moduleLines.push({
        description: session.formation_title || 'Formation',
        qty: 1,
        priceHT: singlePrice,
      });
    }

    // Fetch all apprenants for this devis
    let apprenantsList = [];
    if (isIntra) {
      const allInscriptions = db.prepare(`
        SELECT a.first_name, a.last_name, a.civilite
        FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ?
      `).all(id);
      apprenantsList = allInscriptions;
    } else if (inscription) {
      apprenantsList = [{ first_name: inscription.first_name, last_name: inscription.last_name, civilite: '' }];
    }

    const payload = {
      // Company (from settings)
      companyName:      settings.company_name  || 'LES GRIOTS',
      siret:            settings.siret         || '90262868400018',
      nda:              settings.nda           || '28760747176',
      address:          settings.address       || '80 avenue du 8 mai 1945',
      postalCode:       settings.postal_code   || '93100',
      city:             settings.city          || 'Montreuil',
      phone:            settings.phone         || '',
      email:            settings.email         || 'contact@lesgriots.com',
      tvaNumber:        settings.tva_number    || '',
      representantName: settings.representant_name  || 'COULIBALY Moustapha',
      representantTitle: settings.representant_title || 'Président',

      // Pillar / TVA
      pillar,
      tvaRate,

      // Devis meta
      devisNumber,
      devisDate: today,
      devisDateLong: '', // will be computed by Python

      // Formation + session context
      formation: {
        title: session.formation_title || '',
        code: session.formation_code || '',
        duration_hours: session.duration_hours || '',
        duration_days: session.duration_days || '',
      },
      session: {
        start_date: session.start_date || '',
        end_date: session.end_date || '',
        location: session.location || '',
        adresse: session.adresse || '',
      },

      // Client
      clientName,
      clientAddress,
      clientSiret,
      clientEmail,
      effectifs: String(apprenantsList.length || 1),

      // Apprenants list
      apprenants: apprenantsList,

      // Lines (one per module, Ecohesens style)
      lines: moduleLines,
    };

    // Run existing Python devis script
    const scriptPath = path.join(process.cwd(), 'src/lib/generate_devis.py');
    console.log('[devis-formation] Generating devis for session:', id, 'apprenant:', apprenantId || 'intra', 'script:', scriptPath);

    let pdfBuffer;
    try {
      pdfBuffer = execFileSync('python3', [scriptPath], {
        input: JSON.stringify(payload),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15000,
      });
    } catch (pyErr) {
      console.error('[devis-formation] Python error:', pyErr.stderr?.toString() || pyErr.message);
      return NextResponse.json({
        error: 'Erreur génération devis PDF',
        detail: pyErr.stderr?.toString() || pyErr.message,
        hint: 'Vérifiez que python3 et reportlab sont installés: pip3 install reportlab'
      }, { status: 500 });
    }

    console.log('[devis-formation] PDF generated:', pdfBuffer.length, 'bytes');

    const clientSlug = (clientCompany || clientLastName || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFilename = `Devis-${devisNumber}-${clientSlug}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (err) {
    console.error('[devis-formation] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

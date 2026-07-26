import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(request, { params }) {
  const { id } = await params;

  try {
    const db = getDb();
    // Load project
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });

    // Load linked client if any
    const linkedClient = p.client_id
      ? db.prepare('SELECT * FROM clients WHERE id = ?').get(p.client_id)
      : null;

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Determine pillar — projects are always AGENCE (Studio/Prod)
    const pillar = 'AGENCE';
    const tvaRate = 20; // Agence = TVA 20%

    // Build devis number — prefixe D-AG pour Agence
    const year = new Date().getFullYear();
    const devisNumber = `D-AG-${String(year).slice(2)}-${p.code || id.slice(0, 6).toUpperCase()}`;
    const today = new Date().toLocaleDateString('fr-FR');

    // Parse delivery date
    const endDateFr = p.end_date
      ? new Date(p.end_date).toLocaleDateString('fr-FR')
      : '';
    const startDateFr = p.start_date
      ? new Date(p.start_date).toLocaleDateString('fr-FR')
      : '';

    const payload = {
      // Company (from settings — keys are snake_case in DB)
      companyName:    settings.company_name   || 'LES GRIOTS',
      legalStatus:    settings.legal_status   || 'SASU',
      siret:          settings.siret          || '90262868400018',
      tvaNumber:      settings.tva_number     || '',
      address:        settings.address        || '80 avenue du 8 mai 1945',
      postalCode:     settings.postal_code    || '93100',
      city:           settings.city           || 'Montreuil',
      phone:          settings.phone          || '',
      email:          settings.email          || 'contact@lesgriots.com',
      nda:            settings.nda            || '28760747176',
      representantName: settings.representant_name || 'COULIBALY Moustapha',
      paymentTerms:   p.payment_terms || settings.payment_terms || '30 jours à réception de facture',
      latePaymentNote: settings.late_payment_note || "En cas de retard de paiement, des pénalités de 3× le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.",
      tvaNote:        settings.tva_note || '',

      // Devis meta
      devisNumber,
      devisDate: today,

      // Project
      projectCode: p.code || '',
      projectName: p.name || '',
      startDate:   startDateFr,
      endDate:     endDateFr,
      notes:       p.notes || '',

      // Client — prefer linked client entity, fall back to inline fields
      clientName:               linkedClient?.company      || p.client               || '',
      clientFirstName:          linkedClient?.first_name   || p.client_first_name    || '',
      clientLastName:           linkedClient?.last_name    || p.client_last_name     || '',
      clientContactFirstName:   p.client_contact_first_name || '',
      clientContactLastName:    p.client_contact_last_name  || '',
      clientContact:            p.client_contact       || '',
      clientEmail:              linkedClient?.email        || p.client_email         || '',
      clientAddress:            linkedClient ? [linkedClient.address, linkedClient.postal_code, linkedClient.city].filter(Boolean).join(', ') : (p.client_address || ''),
      clientSiret:              linkedClient?.siret        || '',

      // Pillar / TVA
      pillar,
      tvaRate,

      // Financials — one line per project
      revenue:   p.revenue || 0,
      lines: [{
        description: p.name || 'Prestation créative',
        qty: 1,
        unit: 'forfait',
        priceHT: p.revenue || 0,
        tvaRate,
      }],
    };

    // Run Python script — pass JSON via stdin to avoid shell escaping issues
    const scriptPath = path.join(process.cwd(), 'src/lib/generate_devis.py');
    const pdfBuffer = execFileSync('python3', [scriptPath], {
      input: JSON.stringify(payload),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    });

    const safeFilename = `Devis-${devisNumber}-${(p.client || 'client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (err) {
    console.error('Devis generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);

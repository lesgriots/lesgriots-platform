import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/expenses/:id/bdc
 * Generates a BDC (Bon de Commande) PDF for an expense
 */
async function _GET(request, { params }) {
  const { id } = await params;

  try {
    const db = getDb();

    // Load expense
    const e = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!e) return NextResponse.json({ error: 'Dépense non trouvée' }, { status: 404 });
    if (!e.bdc_number) return NextResponse.json({ error: 'Cette dépense n\'a pas de numéro BDC' }, { status: 400 });

    // Load project
    const project = e.project_id
      ? db.prepare('SELECT * FROM projects WHERE id = ?').get(e.project_id)
      : null;

    // Load provider if linked
    const provider = e.provider_id
      ? db.prepare('SELECT * FROM providers WHERE id = ?').get(e.provider_id)
      : null;

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Build payload
    const payload = {
      // BDC meta
      bdcNumber: e.bdc_number,
      bdcDate: e.date || new Date().toISOString().split('T')[0],

      // Project
      projectCode: project?.code || '',
      projectName: project?.name || '',

      // Company (emitter)
      companyName: settings.company_name || 'LES GRIOTS',
      legalStatus: settings.legal_status || 'SASU',
      siret: settings.siret || '90262868400018',
      tvaNumber: settings.tva_number || '',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '93100',
      city: settings.city || 'Montreuil',
      phone: settings.phone || '',
      email: settings.email || 'contact@lesgriots.com',
      representantName: settings.representant_name || 'COULIBALY Moustapha',
      iban: settings.iban || '',
      bic: settings.bic || '',

      // Provider (recipient)
      providerName: provider
        ? `${provider.first_name || ''} ${provider.last_name || provider.name || ''}`.trim()
        : (e.provider || ''),
      providerCompany: provider?.company || '',
      providerEmail: provider?.email || '',
      providerPhone: provider?.phone || '',
      providerSiret: provider?.siret || '',
      providerAddress: '', // providers table doesn't have address yet

      // Order lines
      tvaRate: parseFloat(e.tva_rate) || 20,
      lines: [{
        description: e.label || 'Prestation',
        qty: 1,
        unit: 'forfait',
        priceHT: e.amount_ht || 0,
      }],

      // Conditions
      paymentMode: settings.payment_mode || 'Virement bancaire',
      paymentTerms: settings.payment_terms || '30 jours à réception de facture',
      notes: e.notes || '',
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_bdc.py');
    const pdfBuffer = execFileSync('python3', [scriptPath], {
      input: JSON.stringify(payload),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    });

    const provName = (provider?.company || provider?.name || e.provider || 'prestataire').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFilename = `${e.bdc_number}-${provName}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('BDC generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('expenses:read', _GET);

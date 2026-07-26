import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/projects/:id/facture
 * Generates a facture PDF for a project (Agence — TVA 20%)
 */
async function _GET(request, { params }) {
  const { id } = await params;

  try {
    const db = getDb();
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });

    const linkedClient = p.client_id
      ? db.prepare('SELECT * FROM clients WHERE id = ?').get(p.client_id)
      : null;

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const yr = String(new Date().getFullYear()).slice(2);
    const today = new Date().toLocaleDateString('fr-FR');
    const factureNumber = `F-AG-${yr}-${p.code || id.slice(0, 6).toUpperCase()}`;

    // Échéance 30 jours
    const echeanceDate = new Date();
    echeanceDate.setDate(echeanceDate.getDate() + 30);
    const echeance = echeanceDate.toLocaleDateString('fr-FR');

    const clientName = linkedClient?.company || p.client || '';
    const clientAddress = linkedClient
      ? [linkedClient.address, linkedClient.postal_code, linkedClient.city].filter(Boolean).join(', ')
      : (p.client_address || '');
    const clientSiret = linkedClient?.siret || '';
    const clientEmail = linkedClient?.email || p.client_email || '';

    const payload = {
      pillar: 'AGENCE',
      tvaRate: 20,
      companyName: settings.company_name || 'LES GRIOTS',
      siret: settings.siret || '90262868400018',
      nda: settings.nda || '28760747176',
      address: settings.address || '80 avenue du 8 mai 1945',
      postalCode: settings.postal_code || '93100',
      city: settings.city || 'Montreuil',
      phone: settings.phone || '',
      email: settings.email || 'contact@lesgriots.com',
      tvaNumber: settings.tva_number || '',
      representantName: settings.representant_name || 'COULIBALY Moustapha',
      iban: settings.iban || '',
      bic: settings.bic || '',
      factureNumber,
      factureDate: today,
      echeance,
      paymentMode: p.payment_mode || 'Virement bancaire',
      paymentTerms: p.payment_terms || settings.payment_terms || '30 jours à réception de facture',
      clientName,
      clientAddress,
      clientSiret,
      clientEmail,
      lines: [{
        description: (p.name || 'Prestation créative') + (p.notes ? '\n' + p.notes : ''),
        qty: 1,
        unit: 'forfait',
        priceHT: p.revenue || 0,
      }],
    };

    const scriptPath = path.join(process.cwd(), 'src/lib/generate_documents.py');
    const pdfBuffer = execFileSync('python3', [scriptPath, 'facture'], {
      input: JSON.stringify(payload),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    });

    const safeFilename = `Facture-${factureNumber}-${(clientName || 'client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Facture generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);

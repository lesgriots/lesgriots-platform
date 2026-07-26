import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sessions/:id/facture?apprenant_id=xxx
 * Generates a facture PDF for a formation session (Griothèque — exonéré TVA)
 * - Intra: 1 facture globale pour le client
 * - Inter: 1 facture par apprenant (ou son financeur)
 */
async function _GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const apprenantId = searchParams.get('apprenant_id');

  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code,
        f.duration_hours, f.duration_days, f.price_ht as formation_price_ht,
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

    if (!session) return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });

    const typeSession = session.type_session || 'inter';
    const isIntra = typeSession.toLowerCase().includes('intra');
    const yr = String(new Date().getFullYear()).slice(2);
    const today = new Date().toLocaleDateString('fr-FR');

    // Load settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    // Modules for description
    const modules = db.prepare('SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC').all(session.formation_id || '');

    // Date formatting
    const startFr = session.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR') : '';
    const endFr = session.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR') : '';

    let factureNumber, clientName, clientAddress, clientSiret, clientEmail, lines = [];

    if (isIntra) {
      const tarif = parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
      const nbApprenants = db.prepare('SELECT COUNT(*) as c FROM inscriptions WHERE session_id = ?').get(id)?.c || 1;
      factureNumber = `F-GR-${yr}-${(session.code_interne || session.formation_code || id.slice(0, 6)).toUpperCase()}`;
      clientName = session.client_company || '';
      clientAddress = [session.client_address, session.client_postal_code, session.client_city].filter(Boolean).join(', ');
      clientSiret = session.client_siret || '';
      clientEmail = session.client_email || '';

      lines.push({
        description: `Formation "${session.formation_title}"\nSession intra-entreprise — ${session.duration_hours || ''}h\nDu ${startFr} au ${endFr} — ${nbApprenants} apprenant(s)`,
        qty: 1, unit: 'forfait', priceHT: tarif,
      });
    } else {
      if (!apprenantId) return NextResponse.json({ error: 'apprenant_id requis pour inter' }, { status: 400 });
      const insc = db.prepare(`
        SELECT i.*, a.first_name, a.last_name, a.email as ap_email, a.company as ap_company,
          a.address as ap_address, a.postal_code as ap_cp, a.city as ap_city
        FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ? AND i.apprenant_id = ?
      `).get(id, apprenantId);
      if (!insc) return NextResponse.json({ error: 'Inscription non trouvée' }, { status: 404 });

      const tarif = parseFloat(insc.price_ht) || parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
      const initials = `${(insc.first_name || '')[0] || ''}${(insc.last_name || '')[0] || ''}`.toUpperCase();
      factureNumber = `F-GR-${yr}-${(session.code_interne || id.slice(0, 6)).toUpperCase()}-${initials}`;
      clientName = insc.ap_company || `${insc.first_name} ${insc.last_name}`.trim();
      clientAddress = [insc.ap_address, insc.ap_cp, insc.ap_city].filter(Boolean).join(', ');
      clientSiret = '';
      clientEmail = insc.ap_email || '';

      lines.push({
        description: `Formation "${session.formation_title}"\nSession inter — ${session.duration_hours || ''}h\nDu ${startFr} au ${endFr}\nApprenant : ${insc.first_name} ${insc.last_name}`,
        qty: 1, unit: 'personne', priceHT: tarif,
      });
    }

    // Échéance = 30 jours
    const echeanceDate = new Date();
    echeanceDate.setDate(echeanceDate.getDate() + 30);
    const echeance = echeanceDate.toLocaleDateString('fr-FR');

    const payload = {
      pillar: 'GRIOTHEQUE',
      tvaRate: 0,
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
      paymentMode: 'Virement bancaire',
      paymentTerms: '30 jours à réception de facture',
      clientName,
      clientAddress,
      clientSiret,
      clientEmail,
      lines,
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
    return NextResponse.json({ error: err.message, detail: err.stderr?.toString() || '' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

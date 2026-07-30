import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { envoyerEmail, smtpConfigure } from '@/lib/mailer';
import { DOCUMENT_ART_DIRECTION, getDocumentTemplate } from '@/lib/document-templates';

/**
 * Génère le devis d'une session une seule fois, pour l'aperçu PDF comme pour
 * l'envoi par e-mail. Une session intra porte un devis entreprise, une session
 * inter porte un devis par apprenant.
 */
async function genererDevisSession(id, apprenantId) {
  const db = getDb();
  const session = db.prepare(`
    SELECT s.*, f.title as formation_title, f.code as formation_code,
      f.description as formation_description, f.duration_hours, f.duration_days,
      f.price_ht as formation_price_ht, c.company as client_company,
      c.first_name as client_first_name, c.last_name as client_last_name,
      c.email as client_email, c.address as client_address,
      c.postal_code as client_postal_code, c.city as client_city,
      c.siret as client_siret
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = ?
  `).get(id);

  if (!session) {
    const error = new Error('Session non trouvée');
    error.status = 404;
    throw error;
  }

  const isIntra = (session.type_session || 'inter').toLowerCase().includes('intra');
  let inscription = null;
  if (apprenantId) {
    inscription = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.email as apprenant_email,
        a.company as apprenant_company, a.address as apprenant_address,
        a.postal_code as apprenant_postal_code, a.city as apprenant_city,
        a.financement as apprenant_financement
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ? AND i.apprenant_id = ?
    `).get(id, apprenantId);
    if (!inscription) {
      const error = new Error('Inscription non trouvée pour cet apprenant');
      error.status = 404;
      throw error;
    }
  } else if (!isIntra) {
    const error = new Error('apprenant_id requis pour les sessions inter-entreprises');
    error.status = 400;
    throw error;
  }

  const modules = db.prepare('SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC')
    .all(session.formation_id || '');
  const settings = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value]));
  const startDateFr = session.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR') : '';
  const endDateFr = session.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR') : '';
  const tvaRate = 0;
  const year = String(new Date().getFullYear()).slice(2);

  let devisNumber;
  let clientName;
  let clientEmail;
  let clientAddress;
  let clientSiret;
  let clientCompany;
  let apprenants = [];
  let totalHT;

  if (isIntra) {
    totalHT = parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
    const effectif = db.prepare('SELECT COUNT(*) as count FROM inscriptions WHERE session_id = ?').get(id)?.count || 1;
    devisNumber = `D-GR-${year}-${(session.formation_code || id.slice(0, 6)).toUpperCase()}-INTRA`;
    clientCompany = session.client_company || '';
    clientName = clientCompany || `${session.client_first_name || ''} ${session.client_last_name || ''}`.trim() || 'Client';
    clientEmail = session.client_email || '';
    clientAddress = [session.client_address, session.client_postal_code, session.client_city].filter(Boolean).join(', ');
    clientSiret = session.client_siret || '';
    apprenants = db.prepare(`
      SELECT a.first_name, a.last_name, a.civilite
      FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ?
    `).all(id);
    if (!apprenants.length) apprenants = Array.from({ length: effectif }, () => ({}));
  } else {
    totalHT = parseFloat(inscription.price_ht) || parseFloat(session.tarif) || parseFloat(session.formation_price_ht) || 0;
    const fullName = `${inscription.first_name || ''} ${inscription.last_name || ''}`.trim();
    const initials = `${(inscription.first_name || '')[0] || ''}${(inscription.last_name || '')[0] || ''}`.toUpperCase();
    devisNumber = `D-GR-${year}-${(session.formation_code || id.slice(0, 6)).toUpperCase()}-${initials}`;
    clientCompany = inscription.apprenant_company || '';
    clientName = clientCompany || fullName || 'Apprenant';
    clientEmail = inscription.apprenant_email || '';
    clientAddress = [inscription.apprenant_address, inscription.apprenant_postal_code, inscription.apprenant_city].filter(Boolean).join(', ');
    clientSiret = '';
    apprenants = [{ first_name: inscription.first_name, last_name: inscription.last_name, civilite: '' }];
  }

  const lines = modules.length
    ? modules.map((module) => ({
        description: `${module.title}${module.description ? ` - ${module.description}` : ''}`,
        qty: 1,
        priceHT: Math.round((totalHT / modules.length) * 100) / 100,
      }))
    : [{ description: session.formation_title || 'Formation', qty: 1, priceHT: totalHT }];

  const payload = {
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
    representantTitle: settings.representant_title || 'Président',
    pillar: 'GRIOTHEQUE',
    tvaRate,
    devisNumber,
    devisDate: new Date().toLocaleDateString('fr-FR'),
    devisDateLong: '',
    formation: {
      title: session.formation_title || '', code: session.formation_code || '',
      duration_hours: session.duration_hours || '', duration_days: session.duration_days || '',
    },
    session: {
      start_date: session.start_date || '', end_date: session.end_date || '',
      location: session.location || '', adresse: session.adresse || '',
    },
    clientName, clientAddress, clientSiret, clientEmail,
    effectifs: String(apprenants.length || 1),
    apprenants,
    lines,
  };

  let pdfBuffer;
  try {
    pdfBuffer = execFileSync('python3', [path.join(process.cwd(), 'src/lib/generate_devis.py')], {
      input: JSON.stringify(payload), maxBuffer: 10 * 1024 * 1024, timeout: 15000,
    });
  } catch (error) {
    console.error('[devis-formation] Erreur PDF :', error.stderr?.toString() || error.message);
    const pdfError = new Error('Erreur génération devis PDF');
    pdfError.status = 500;
    throw pdfError;
  }

  const clientSlug = (clientCompany || clientName || 'client').replace(/[^a-zA-Z0-9]/g, '_');
  const documentTemplate = getDocumentTemplate('devis');
  return {
    pdfBuffer,
    safeFilename: `Devis-${devisNumber}-${clientSlug}.pdf`,
    session,
    destinataire: { email: clientEmail, nom: clientName },
    documentTemplate,
  };
}

async function _GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const devis = await genererDevisSession(id, searchParams.get('apprenant_id'));
    return new NextResponse(devis.pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${devis.safeFilename}"`,
        'Content-Length': String(devis.pdfBuffer.length),
        'X-Document-Template': devis.documentTemplate?.id || 'devis',
        'X-Document-Template-Version': DOCUMENT_ART_DIRECTION.version,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

/** POST /api/sessions/:id/devis — envoie le PDF du devis en pièce jointe. */
async function _POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const devis = await genererDevisSession(id, body.apprenant_id || '');
    const destinataire = String(body.destinataire || devis.destinataire.email || '').trim();
    const destinataireNom = String(body.destinataire_nom || devis.destinataire.nom || '').trim();
    const formation = devis.session.formation_title || devis.session.title || 'votre formation';
    const objet = body.objet || `Votre devis — ${formation}`;
    const corps = body.corps || `Bonjour ${destinataireNom || ''},\n\nVeuillez trouver en pièce jointe le devis relatif à la formation « ${formation} ».\n\nBien cordialement,\nLA GRIOTHÈQUE`;

    if (!destinataire) return NextResponse.json({ error: 'Ajoutez une adresse e-mail destinataire.' }, { status: 422 });

    const result = await envoyerEmail({
      destinataire,
      destinataire_nom: destinataireNom,
      objet,
      corps,
      pieces: [{ filename: devis.safeFilename, content: devis.pdfBuffer, contentType: 'application/pdf' }],
      template_key: 'devis_session',
      contexte_type: 'session',
      contexte_id: id,
    });

    return NextResponse.json({
      ...result,
      fichier: devis.safeFilename,
      mode: smtpConfigure() ? 'reel' : 'simulation',
      template: {
        id: devis.documentTemplate?.id || 'devis',
        titre: devis.documentTemplate?.title || 'Devis de formation',
        direction_artistique: DOCUMENT_ART_DIRECTION.name,
        version: DOCUMENT_ART_DIRECTION.version,
      },
    }, {
      status: result.statut === 'echec' ? 422 : 201,
    });
  } catch (error) {
    console.error('[devis-formation] Erreur e-mail :', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
export const POST = withGuard('emails:send', _POST);

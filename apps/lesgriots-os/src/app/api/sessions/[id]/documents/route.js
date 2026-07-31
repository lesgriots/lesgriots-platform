import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { execFileSync } from 'child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'path';
import { withGuard } from '@/lib/api-guard';
import { rendre } from '@/lib/rendre-modele.mjs';
import { construireProgramme } from '@/lib/programme-donnees.mjs';
import { construireConvocation } from '@/lib/documents-accueil.mjs';
import { construireConvention } from '@/lib/convention-donnees.mjs';
import { construireEmargement } from '@/lib/emargement-donnees.mjs';

/**
 * GET /api/sessions/:id/documents?type=programme|convention|convocation|emargement|attestation|certificat
 *     &apprenant_id=xxx  (required for convocation & attestation — per-apprenant docs)
 * Returns: application/pdf
 */
async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get('type');
    const apprenantId = searchParams.get('apprenant_id');

    const validTypes = ['programme', 'convention', 'convocation', 'emargement', 'attestation', 'certificat'];
    if (!docType || !validTypes.includes(docType)) {
      return NextResponse.json({ error: `type requis. Valides : ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Fetch session with joins
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

    // Fetch inscriptions (apprenants of this session)
    const inscriptions = db.prepare(`
      SELECT i.*, a.first_name, a.last_name, a.email, a.phone, a.company,
        a.civilite, a.code_interne
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      WHERE i.session_id = ?
      ORDER BY a.last_name ASC
    `).all(id);

    // Fetch modules
    const modules = db.prepare(`
      SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC
    `).all(session.formation_id || '');

    // Load company settings from DB
    const settingsRows = db.prepare("SELECT key, value FROM settings").all();
    const companySettings = {};
    settingsRows.forEach(r => { companySettings[r.key] = r.value; });

    // Build payload
    const payload = {
      // Company info (from settings table)
      companyName: companySettings.company_name || 'LES GRIOTS',
      siret: companySettings.siret || '90262868400018',
      nda: companySettings.nda || '',
      address: companySettings.address || '80 avenue du 8 mai 1945',
      postalCode: companySettings.postal_code || '93100',
      city: companySettings.city || 'Montreuil',
      email: companySettings.email || 'contact@lesgriots.com',
      phone: companySettings.phone || '06 XX XX XX XX',
      representantName: companySettings.representant_name || '',
      representantTitle: companySettings.representant_title || '',
      tribunalVille: companySettings.tribunal_ville || 'Bobigny',
      iban: companySettings.iban || '',
      bic: companySettings.bic || '',

      // Formation
      formation: {
        code: session.formation_code,
        title: session.formation_title,
        description: session.formation_description,
        duration_hours: session.duration_hours,
        duration_days: session.duration_days,
        price_ht: session.formation_price_ht,
        modality: session.formation_modality,
        level: session.formation_level,
        max_participants: session.max_participants,
        prerequisites: session.prerequisites,
        objectives: session.objectives,
        evaluation_methods: session.evaluation_methods,
        target_audience: session.target_audience,
        accessibility: session.accessibility,
        certification: session.certification,
        delais_acces: session.delais_acces,
        modalites_pedagogiques: session.modalites_pedagogiques,
        moyens_materiels: session.moyens_materiels,
      },

      // Session
      session: {
        start_date: session.start_date,
        end_date: session.end_date,
        location: session.location,
        adresse: session.adresse,
        modality: session.modality,
        horaire: session.horaire,
        formateur_name: session.formateur_name,
        tarif: session.tarif,
        type_session: session.type_session,
        client_company: session.client_company,
        client_siret: session.client_siret,
        client_email: session.client_email,
        client_address: session.client_address,
        client_postal_code: session.client_postal_code,
        client_city: session.client_city,
        client_repr_first: session.client_first_name || '',
        client_repr_last: session.client_last_name || '',
        client_repr_role: 'Représentant légal',
      },

      // Modules
      modules,

      // Apprenants
      apprenants: inscriptions.map(i => ({
        first_name: i.first_name,
        last_name: i.last_name,
        email: i.email,
        phone: i.phone,
        company: i.company,
        civilite: i.civilite,
        code_interne: i.code_interne,
      })),
    };

    // For per-apprenant documents (convocation, attestation)
    if (['convocation', 'attestation'].includes(docType)) {
      if (apprenantId) {
        const apprenant = inscriptions.find(i => i.apprenant_id === apprenantId);
        if (!apprenant) {
          return NextResponse.json({ error: 'Apprenant non inscrit à cette session' }, { status: 404 });
        }
        payload.apprenant = {
          first_name: apprenant.first_name,
          last_name: apprenant.last_name,
          email: apprenant.email,
          phone: apprenant.phone,
          company: apprenant.company,
        };
      } else {
        // If no apprenant_id, use first one (for preview)
        if (inscriptions.length > 0) {
          const first = inscriptions[0];
          payload.apprenant = {
            first_name: first.first_name,
            last_name: first.last_name,
            email: first.email,
            phone: first.phone,
            company: first.company,
          };
        } else {
          payload.apprenant = { first_name: 'Prénom', last_name: 'NOM', email: '', phone: '', company: '' };
        }
      }
    }

    /*
     * Trois documents ont maintenant leur maquette maison, dessinée au
     * Template Studio et imprimée par Chromium. Cette route reste leur porte
     * d'entrée historique : c'est elle que visent les liens archivés au
     * registre de session, les envois par courriel et l'outil MCP. On la fait
     * donc pointer vers le nouveau rendu, sinon deux mises en page du même
     * document vivent en parallèle et c'est l'ancienne qu'on voit en
     * cliquant. Émargement, attestation et certificat gardent le générateur
     * Python : ils n'ont pas encore de modèle équivalent.
     */
    const MAQUETTES = {
      programme: 'Programme de Formation.dc.html',
      convention: 'Convention.dc.html',
      convocation: 'Convocation.dc.html',
      emargement: 'Emargement.dc.html',
    };

    let pdfBuffer;

    if (MAQUETTES[docType]) {
      if (docType === 'programme' && !session.formation_id) {
        return NextResponse.json({ error: 'Cette session n’est rattachée à aucune formation.' }, { status: 400 });
      }
      const modele = path.join(process.cwd(), 'resources/template-studio/geist-mono/source', MAQUETTES[docType]);
      const valeurs = docType === 'convention' ? construireConvention(db, id)
        : docType === 'convocation' ? construireConvocation(db, id, apprenantId)
        : docType === 'emargement' ? construireEmargement(db, id)
        : construireProgramme(db, session.formation_id).valeurs;

      const dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-session-'));
      try {
        const sortie = path.join(dossier, 'document.pdf');
        await rendre(modele, valeurs, sortie);
        pdfBuffer = await fs.readFile(sortie);
      } finally {
        await fs.rm(dossier, { recursive: true, force: true });
      }
    } else {
      // Call Python script
      const scriptPath = path.join(process.cwd(), 'src', 'lib', 'generate_documents.py');
      console.log('[documents] Generating:', docType, 'for session:', id, 'script:', scriptPath);
      try {
        pdfBuffer = execFileSync('python3', [scriptPath, docType], {
          input: JSON.stringify(payload),
          maxBuffer: 10 * 1024 * 1024,
          timeout: 15000,
        });
      } catch (pyErr) {
        console.error('[documents] Python error:', pyErr.stderr?.toString() || pyErr.message);
        return NextResponse.json({
          error: 'Erreur génération PDF',
          detail: pyErr.stderr?.toString() || pyErr.message,
          hint: 'Vérifiez que python3 et reportlab sont installés: pip3 install reportlab'
        }, { status: 500 });
      }
    }
    console.log('[documents] PDF generated:', pdfBuffer.length, 'bytes');

    // File name — nomenclature LES GRIOTS :
    // Convention_YYYYMMDD_NOM_Prenom_TITRE_FORMATION_-_CLIENT.pdf
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Nom/prénom (apprenant pour docs individuels, client pour docs session)
    let nameStr = '';
    if (['convocation', 'attestation'].includes(docType) && payload.apprenant) {
      const ln = (payload.apprenant.last_name || '').toUpperCase().trim();
      const fn = (payload.apprenant.first_name || '').trim();
      nameStr = `${ln}_${fn}`;
    } else if (session.client_last_name || session.client_first_name) {
      const ln = (session.client_last_name || '').toUpperCase().trim();
      const fn = (session.client_first_name || '').trim();
      nameStr = `${ln}_${fn}`;
    }

    // Titre formation en MAJUSCULES, espaces → underscores
    const titreSlug = (session.formation_title || 'FORMATION')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Client (entreprise)
    const clientSlug = (session.client_company || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Type de document en français avec majuscule
    const docLabels = {
      programme: 'Programme',
      convention: 'Convention',
      convocation: 'Convocation',
      emargement: 'Emargement',
      attestation: 'Attestation',
      certificat: 'Certificat',
    };
    const docLabel = docLabels[docType] || docType;

    // Code session (ex: AF26001)
    const sessionCode = (session.code_interne || '')
      .replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    // Assemblage : Convention_AF26001_20250701_NOM_Prenom_TITRE_-_CLIENT.pdf
    let fileName = docLabel;
    if (sessionCode) fileName += '_' + sessionCode;
    fileName += '_' + dateStr;
    if (nameStr) fileName += '_' + nameStr;
    fileName += '_' + titreSlug;
    if (clientSlug) fileName += '_-_' + clientSlug;
    fileName += '.pdf';

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
        // Un document régénéré doit se voir tout de suite : sans cela le
        // navigateur ressert l'exemplaire précédent dans la fenêtre d'aperçu.
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[documents] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);

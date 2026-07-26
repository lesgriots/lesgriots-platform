import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const apprenants = db.prepare(`
      SELECT a.*,
        COUNT(DISTINCT i.id) as formations_count
      FROM apprenants a
      LEFT JOIN inscriptions i ON i.apprenant_id = a.id
      GROUP BY a.id
      ORDER BY a.last_name ASC, a.first_name ASC
    `).all();
    return NextResponse.json(apprenants);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
    trimStrings(body);
    if (!body.first_name && !body.last_name && !body.email) {
      return badRequest('Champ "first_name"/"last_name" ou "email" requis');
    }
    const {
      first_name = '', last_name = '', email = '', phone = '',
      company = '', address = '', postal_code = '', city = '',
      financement = '', notes = '',
      dateNaissance = '', situationPro = '', statutJuridique = '',
      handicap = 0, precisionHandicap = '', experience = 0,
      niveauExp = '', motivation = '', modalitePaiement = '',
      connuComment = [], reseaux = [],
      etat = 'new', etatRelance = [],
      orgaOpco = '', faf = '', statutFinancement = 'not_started',
      financementEntreprise = 0, siret = '', entrepriseAdresse = '',
      entrepriseCp = '', entrepriseVille = '', entrepriseTel = '',
      emailReferent = '', nomReferent = '', dossierUrl = '',
      lienCalendly = '', datePositionnement = '', dateEnveiDoc = '',
      dateInscription = '', client_id = null,
      civilite = '', nationalite = 'Française', lieu_naissance_ville = '',
      lieu_naissance_dept = '', lieu_naissance_cp = '', num_secu = '',
      langue = 'Français', code_interne = '',
    } = body;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO apprenants (
        id, first_name, last_name, email, phone,
        company, address, postal_code, city, financement, notes,
        date_naissance, situation_pro, statut_juridique,
        handicap, precision_handicap, experience,
        niveau_exp, motivation, modalite_paiement,
        connu_comment, reseaux,
        etat, etat_relance,
        orga_opco, faf, statut_financement,
        financement_entreprise, siret, entreprise_adresse,
        entreprise_cp, entreprise_ville, entreprise_tel,
        email_referent, nom_referent, dossier_url,
        lien_calendly, date_positionnement, date_envoi_doc,
        date_inscription, client_id,
        civilite, nationalite, lieu_naissance_ville,
        lieu_naissance_dept, lieu_naissance_cp, num_secu,
        langue, code_interne
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, first_name, last_name, email, phone,
      company, address, postal_code, city, financement, notes,
      dateNaissance, situationPro, statutJuridique,
      handicap, precisionHandicap, experience,
      niveauExp, motivation, modalitePaiement,
      JSON.stringify(connuComment), JSON.stringify(reseaux),
      etat, JSON.stringify(etatRelance),
      orgaOpco, faf, statutFinancement,
      financementEntreprise, siret, entrepriseAdresse,
      entrepriseCp, entrepriseVille, entrepriseTel,
      emailReferent, nomReferent, dossierUrl,
      lienCalendly, datePositionnement, dateEnveiDoc,
      dateInscription, client_id,
      civilite, nationalite, lieu_naissance_ville,
      lieu_naissance_dept, lieu_naissance_cp, num_secu,
      langue, code_interne
    );

    const apprenant = db.prepare('SELECT * FROM apprenants WHERE id = ?').get(id);
    return NextResponse.json(apprenant, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('apprenants:read', _GET);
export const POST = withGuard('apprenants:create', _POST);

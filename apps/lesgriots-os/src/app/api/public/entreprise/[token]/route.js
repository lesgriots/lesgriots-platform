/**
 * API PUBLIQUE — l'espace entreprise, par jeton.
 *
 * Une entreprise qui envoie ses salariés se former a trois questions, et
 * l'organisme y répond aujourd'hui par mail, une par une : qui est inscrit,
 * qui est venu, où sont les papiers. Cette route répond aux trois d'un coup.
 *
 * Ce qu'elle ne dit pas, et pourquoi :
 *
 *   · le contenu des questionnaires. La satisfaction d'un salarié sur sa
 *     formation n'appartient pas à son employeur ; il apprend seulement si
 *     la réponse a été remise, parce que cela conditionne le solde du
 *     dossier OPCO.
 *   · les coordonnées personnelles des salariés. L'entreprise les a déjà.
 *   · les pièces d'une session partagée avec d'autres entreprises.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { resoudreJeton, joursDeSession, clientsDeSession, pieceAutorisee } from '@/lib/espace-jetons.mjs';

const reglage = (db, cle, defaut = '') => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
  return r && r.value ? r.value : defaut;
};

export async function GET(request, { params }) {
  try {
    const db = getDb();
    const scope = resoudreJeton(db, (await params).token);
    if (!scope || scope.portee !== 'entreprise') {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });
    }

    const client = db.prepare('SELECT id, company, first_name, last_name, siret FROM clients WHERE id = ?')
      .get(scope.client_id);
    if (!client) return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 });

    const salaries = db.prepare(`
      SELECT id, first_name, last_name FROM apprenants WHERE client_id = ?
    `).all(scope.client_id);
    const idsSalaries = new Set(salaries.map((s) => s.id));

    /* Les sessions où au moins un de ses salariés est inscrit. C'est la bonne
       définition : elle attrape l'intra comme l'inter, et elle ne dépend pas
       de la ligne de facturation, qui peut manquer. */
    const sessions = idsSalaries.size ? db.prepare(`
      SELECT DISTINCT s.*, f.title AS formation_titre, f.duration_hours
      FROM sessions s
      JOIN inscriptions i ON i.session_id = s.id
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE i.apprenant_id IN (${[...idsSalaries].map(() => '?').join(',')})
      ORDER BY COALESCE(s.start_date, '9999') DESC
      LIMIT 40
    `).all(...idsSalaries) : [];

    const auj = new Date().toISOString().slice(0, 10);
    const documentsClient = db.prepare(`
      SELECT * FROM documents WHERE contexte_type = 'client' AND contexte_id = ?
        AND COALESCE(archived, 0) = 0 ORDER BY created_at DESC
    `).all(scope.client_id);

    const sortie = sessions.map((s) => {
      const jours = joursDeSession(s);
      const demiJournees = jours.length * 2;

      const inscrits = db.prepare(`
        SELECT i.apprenant_id, i.status, a.first_name, a.last_name
        FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ? AND a.client_id = ?
        ORDER BY a.last_name, a.first_name
      `).all(s.id, scope.client_id);

      const gens = inscrits.map((i) => {
        const presence = db.prepare(`
          SELECT COALESCE(SUM(matin), 0) + COALESCE(SUM(apres_midi), 0) AS n
          FROM emargements WHERE session_id = ? AND apprenant_id = ?
        `).get(s.id, i.apprenant_id).n || 0;
        const rendues = db.prepare('SELECT type FROM evaluations WHERE session_id = ? AND apprenant_id = ?')
          .all(s.id, i.apprenant_id).map((x) => x.type);
        const attestation = db.prepare(`
          SELECT id, libelle, categorie FROM documents
          WHERE contexte_type = 'apprenant' AND contexte_id = ?
            AND categorie IN ('attestation', 'certificat') AND COALESCE(archived, 0) = 0
          ORDER BY created_at DESC LIMIT 1
        `).get(i.apprenant_id);
        return {
          prenom: i.first_name || '', nom: i.last_name || '',
          statut: i.status || 'inscrit',
          presence: { signees: presence, total: demiJournees },
          positionnement: rendues.includes('positionnement'),
          satisfaction: rendues.includes('satisfaction'),
          attestation: attestation ? { id: attestation.id, libelle: attestation.libelle || 'Attestation' } : null,
        };
      });

      const clients = clientsDeSession(db, s);
      const partagee = clients.length > 1;
      const pieces = partagee ? [] : db.prepare(`
        SELECT * FROM documents WHERE contexte_type = 'session' AND contexte_id = ?
          AND COALESCE(archived, 0) = 0 ORDER BY created_at DESC
      `).all(s.id).filter((doc) => pieceAutorisee(db, scope, doc));

      const debut = s.start_date ? String(s.start_date).slice(0, 10) : '';
      const fin = String(s.end_date || s.start_date || '').slice(0, 10);

      return {
        id: s.id,
        titre: s.espace_nom_public || s.session_name || s.formation_titre || 'Formation',
        debut, fin, horaire: s.horaire || '',
        modalite: s.modality || '',
        duree_heures: s.duration_hours || 0,
        etat: !debut ? 'a_planifier' : (auj < debut ? 'a_venir' : (fin && auj > fin ? 'terminee' : 'en_cours')),
        partagee,
        salaries: gens,
        documents: pieces.map((d) => ({ id: d.id, categorie: d.categorie, libelle: d.libelle, signe: d.signe })),
      };
    });

    return NextResponse.json({
      entreprise: {
        nom: client.company || [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Votre entreprise',
        siret: client.siret || '',
      },
      sessions: sortie,
      documents: documentsClient.map((d) => ({ id: d.id, categorie: d.categorie, libelle: d.libelle, signe: d.signe })),
      organisme: {
        marque: reglage(db, 'marque_formation', 'LA GRIOTHÈQUE'),
        nom: reglage(db, 'company_name', 'LA GRIOTHÈQUE'),
        email: reglage(db, 'email', 'formation@lesgriots.com'),
        telephone: reglage(db, 'phone'),
        nda: reglage(db, 'nda') || reglage(db, 'numero_declaration'),
      },
    });
  } catch (e) {
    console.error('[public/entreprise]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const IDS = {
  session: 'demo-game-of-work-2026', formation: 'demo-strategie-contenu', client: 'demo-game-of-works', formateur: 'demo-moustapha-coulibaly',
};

/**
 * Jeu de données local et explicitement démonstratif. Il ne mélange aucune
 * donnée avec les imports métier : il permet d'évaluer le cockpit d'une
 * session complète avant l'import de Digiforma/CSV.
 */
async function _POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'La démo est disponible uniquement en local.' }, { status: 404 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(IDS.session);
  if (existing) return NextResponse.json({ session_id: IDS.session, created: false });

  const run = db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO clients (id, company, email, city, pillar, tva_applicable, type_client) VALUES (?, ?, ?, ?, 'GRIOTHEQUE', 0, 'entreprise')`)
      .run(IDS.client, 'GAME OF WORKS', 'work@mooscoulibaly.com', 'Le Havre');
    db.prepare(`INSERT OR IGNORE INTO formateurs (id, first_name, last_name, email, statut_collab, domaines) VALUES (?, ?, ?, ?, 'actif', ?)`)
      .run(IDS.formateur, 'Moustapha', 'COULIBALY', 'work@mooscoulibaly.com', JSON.stringify(['Stratégie de contenu', 'Réalisation vidéo']));
    db.prepare(`INSERT OR IGNORE INTO formations (id, code, title, description, objectives, duration_hours, duration_days, modality, price_ht, max_participants, target_audience, prerequisites, status, categorie)
      VALUES (?, ?, ?, ?, ?, 14, 2, 'presentiel', 2000, 12, ?, ?, 'active', 'Réalisation')`)
      .run(IDS.formation, 'PR26001', 'Stratégie de contenu & création vidéo au téléphone - LA GRIOTHEQUE',
        'Une formation de deux jours pour structurer sa stratégie de contenu et produire ses vidéos au téléphone.',
        JSON.stringify(['Filmer, monter et publier avec un smartphone', 'Construire une stratégie éditoriale activable']),
        'Entrepreneurs, équipes et créatifs indépendants.', 'Aucun prérequis technique.');
    db.prepare(`INSERT INTO sessions (id, formation_id, start_date, end_date, location, modality, max_participants, status, formateur_id, formateur_name, notes, type_session, horaire, tarif, adresse, code_interne, advancement, documents, taux_marge, planning, client_id, cout_total, ca_confirmed, gestionnaire_1, inter_entreprise, fuseau_horaire)
      VALUES (?, ?, '2026-06-15', '2026-06-16', 'Le Havre', 'presentiel', 12, 'completed', ?, ?, '', 'INTRA', '09:00 - 12:30 · 13:30 - 17:00', 2000, '82 rue des chargeurs réunis, 76600 Le Havre', 'AF1940101526', '{}', '{}', 0, '[]', ?, 2000, 0, 'COULIBALY Moustapha', 1, 'Europe/Paris')`)
      .run(IDS.session, IDS.formation, IDS.formateur, 'COULIBALY Moustapha', IDS.client);

    const moduleInsert = db.prepare(`INSERT OR IGNORE INTO modules (id, formation_id, title, description, objectives, duration_hours, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const sessionModuleInsert = db.prepare(`INSERT OR IGNORE INTO session_modules (id, session_id, module_id, title, description, objectives, duration_hours, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    [
      ['demo-module-1', 'Module 1 — Cadrer sa stratégie', 'Cible, intention et piliers de contenu.', 3.5],
      ['demo-module-2', 'Module 02 — Filmer & interviewer', 'Prise de vue mobile, lumière et interview.', 3.5],
      ['demo-module-3', 'Module 03 — Monter & publier', 'Montage mobile, sous-titres et diffusion.', 3.5],
      ['demo-module-4', 'Module 04 — Penser son contenu', 'Calendrier éditorial et feuille de route.', 3.5],
    ].forEach(([id, moduleTitle, description, duration, order]) => {
      const sortOrder = Number(order) || ['demo-module-1', 'demo-module-2', 'demo-module-3', 'demo-module-4'].indexOf(id);
      moduleInsert.run(id, IDS.formation, moduleTitle, description, '[]', duration, sortOrder);
      sessionModuleInsert.run(`sm-${id}`, IDS.session, id, moduleTitle, description, '[]', duration, sortOrder);
    });

    const learners = [
      ['demo-apprenant-1', 'Awa', 'DIALLO', 'awa@example.test'], ['demo-apprenant-2', 'Samira', 'KONE', 'samira@example.test'],
      ['demo-apprenant-3', 'Kévin', 'MARTIN', 'kevin@example.test'], ['demo-apprenant-4', 'Maya', 'TRAORÉ', 'maya@example.test'],
    ];
    const learnerInsert = db.prepare(`INSERT OR IGNORE INTO apprenants (id, first_name, last_name, email, company, city) VALUES (?, ?, ?, ?, 'GAME OF WORKS', 'Le Havre')`);
    const inscriptionInsert = db.prepare(`INSERT OR IGNORE INTO inscriptions (id, session_id, apprenant_id, status, financement, price_ht, convention_signed, convocation_sent, attestation_sent, valid_until, follow_up_status) VALUES (?, ?, ?, 'confirme', 'Entreprise', 500, 1, 1, 0, '2028-06-16', 'a_relancer')`);
    const attendanceInsert = db.prepare(`INSERT OR IGNORE INTO emargements (id, session_id, apprenant_id, date, matin, apres_midi) VALUES (?, ?, ?, ?, ?, ?)`);
    learners.forEach(([id, firstName, lastName, email], index) => {
      learnerInsert.run(id, firstName, lastName, email);
      inscriptionInsert.run(`demo-inscription-${index + 1}`, IDS.session, id);
      attendanceInsert.run(`demo-attendance-${index + 1}-a`, IDS.session, id, '2026-06-15', 1, 1);
      attendanceInsert.run(`demo-attendance-${index + 1}-b`, IDS.session, id, '2026-06-16', index === 3 ? 0 : 1, index === 3 ? 0 : 1);
    });
    db.prepare(`INSERT OR IGNORE INTO evaluations (id, session_id, apprenant_id, type, score, responses, comments) VALUES (?, ?, ?, 'satisfaction', 9, '{}', 'Très bonne session.')`)
      .run('demo-evaluation-1', IDS.session, 'demo-apprenant-1');
  });
  run();

  return NextResponse.json({ session_id: IDS.session, created: true }, { status: 201 });
}

export const POST = withGuard('sessions:create', _POST);

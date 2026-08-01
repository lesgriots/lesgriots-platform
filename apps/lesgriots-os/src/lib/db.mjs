import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// process.cwd() = racine du projet Next.js, stable quel que soit l'environnement
const DB_PATH = path.join(process.cwd(), 'data', 'lesgriots.db');

let _db = null;

export function getDb() {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      company TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      city TEXT DEFAULT '',
      country TEXT DEFAULT 'France',
      siret TEXT DEFAULT '',
      tva_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_contacts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      first_name TEXT DEFAULT '',
      last_name TEXT DEFAULT '',
      role TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      pillar TEXT NOT NULL CHECK(pillar IN ('STUDIO','PROD')),
      template TEXT,
      client TEXT DEFAULT '',
      client_contact TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      client_address TEXT DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'lead',
      revenue REAL DEFAULT 0,
      budget REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      bdc_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      amount_ht REAL DEFAULT 0,
      tva_rate TEXT DEFAULT '20',
      tva_amount REAL DEFAULT 0,
      amount_ttc REAL DEFAULT 0,
      category TEXT DEFAULT '',
      provider TEXT DEFAULT '',
      provider_id TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('paid','pending','overdue')),
      date TEXT,
      notes TEXT DEFAULT '',
      bdc_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      categories TEXT DEFAULT '[]',
      rating INTEGER DEFAULT 0,
      tarif_jour REAL DEFAULT 0,
      tva_rate TEXT DEFAULT '20',
      siret TEXT DEFAULT '',
      email TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ip_revenues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source TEXT DEFAULT '',
      label TEXT NOT NULL,
      amount REAL DEFAULT 0,
      date TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      type TEXT DEFAULT 'freelance' CHECK(type IN ('internal','freelance')),
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      provider_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
      phase TEXT DEFAULT '',
      phase_group TEXT DEFAULT '',
      assignee_id TEXT,
      assignee_name TEXT DEFAULT '',
      due_date TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_phases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#D4A843',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      locked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS postings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase_id TEXT REFERENCES production_phases(id) ON DELETE SET NULL,
      note TEXT DEFAULT '',
      posted_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ppm_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase_key TEXT NOT NULL,
      note TEXT DEFAULT '',
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS next_indices (
      pillar TEXT PRIMARY KEY,
      next_index INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    INSERT OR IGNORE INTO next_indices (pillar, next_index) VALUES ('STUDIO', 1);
    INSERT OR IGNORE INTO next_indices (pillar, next_index) VALUES ('PROD', 1);
    INSERT OR IGNORE INTO next_indices (pillar, next_index) VALUES ('GRIOTHEQUE', 1);

    INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name', 'LES GRIOTS');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('representant_name', 'COULIBALY Moustapha');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('representant_title', 'Président');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('siret', '90262868400018');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('siren', '902628684');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('nda', '28760747176');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('address', '80 avenue du 8 mai 1945');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('postal_code', '93100');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('city', 'Montreuil');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('email', 'contact@lesgriots.com');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('phone', '06 XX XX XX XX');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tribunal_ville', 'Bobigny');

    -- MLE / TJM plancher SASU (Chris Do · Painless Pricing, adapté SASU FR)
    -- Tout est mensuel en € sauf indication contraire
    -- pricing_personal_monthly = NET visé / mois (salaire net sur compte perso ou équivalent)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_personal_monthly', '2500');
    -- pricing_business_monthly = coûts fixes pro SASU / mois (URSSAF forfait, comptable, soft, mutuelle, RC pro)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_business_monthly', '800');
    -- pricing_savings_target = réserve trésorerie SASU / mois (matelas, investissements, formations)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_savings_target', '500');
    -- pricing_profit_margin = marge bénéfice cible % (avant IS)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_profit_margin', '20');
    -- pricing_billable_hours_per_week = h facturables réelles (≈ 50% du temps total)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_billable_hours_per_week', '20');
    -- pricing_weeks_per_year = semaines facturables (52 - congés - jours fériés)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_weeks_per_year', '46');
    -- SASU specifics :
    -- pricing_strategy : 'salary' | 'mix' | 'dividends' (stratégie de rémunération)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_strategy', 'salary');
    -- pricing_charges_ratio : ratio NET → COÛT TOTAL pour la SASU (cotisations patronales + salariales)
    -- ~1.85 = ratio standard SASU président assimilé salarié (entre 1.6 et 2.2 selon tranche)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_charges_ratio', '1.85');
    -- pricing_is_rate : taux IS sur bénéfice (15% jusqu'à 42500€, 25% au-delà)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_is_rate', '15');
    -- pricing_smic_net : SMIC NET utilisé pour la stratégie "mix" (salaire minimum pour valider trimestres retraite)
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_smic_net', '1400');
  `);

  // ── Questionnaires sur mesure, programme par programme ──
  //
  // Le tronc commun reste dans le code : c'est lui qui garantit qu'une note
  // de satisfaction veut dire la même chose d'une formation à l'autre.
  // Cette table ne porte que l'écart au tronc :
  //
  //   positionnement  → remplacement complet. Les questions génériques
  //                     n'apprennent rien ; celles du programme, oui.
  //   chaud, froid    → questions ajoutées à la fin, après le tronc commun.
  //                     La moyenne reste comparable, tes questions passent
  //                     quand même.
  db.exec(`
    CREATE TABLE IF NOT EXISTS formation_questionnaires (
      id TEXT PRIMARY KEY,
      formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
      moment TEXT NOT NULL CHECK(moment IN ('positionnement','chaud','froid')),
      questions TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_formation_questionnaires
      ON formation_questionnaires(formation_id, moment);

    -- ── Formulaire d'inscription, par programme ──────────────────────────
    -- Le formulaire se définit sur le programme et non sur la session : un
    -- programme tourne plusieurs fois, et refaire le formulaire à chaque date
    -- est l'endroit exact où les versions divergent.
    CREATE TABLE IF NOT EXISTS formulaires_inscription (
      formation_id TEXT PRIMARY KEY REFERENCES formations(id) ON DELETE CASCADE,
      champs TEXT NOT NULL DEFAULT '[]',
      -- Ce qui se passe une fois le formulaire envoyé : le message affiché et,
      -- s'il y en a un, le lien de prise de rendez-vous. Le formulaire tient
      -- lieu d'entretien préalable, l'appel le complète quand il le faut.
      suite TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Les réponses au formulaire vivent sur l'inscription, pas sur l'apprenant :
  // la même personne peut répondre différemment d'une session à l'autre, et
  // c'est la réponse d'alors qui compte pour le dossier de cette session.
  const colsInscriptions = db.prepare('PRAGMA table_info(inscriptions)').all().map((c) => c.name);
  if (!colsInscriptions.includes('reponses_inscription')) {
    db.exec("ALTER TABLE inscriptions ADD COLUMN reponses_inscription TEXT NOT NULL DEFAULT '[]'");
  }

  // ── Questionnaires associés à un programme ──
  // Le lien existait déjà, mais il écrivait dans `evaluation_methods`, la
  // colonne qui porte les modalités d'évaluation en toutes lettres : celles
  // qu'on imprime sur le programme et qu'on montre à l'apprenant. Cocher un
  // modèle effaçait donc ce texte. Le rattachement a maintenant sa propre
  // colonne, et la prose reste la prose.
  const colsFormationsEval = db.prepare("PRAGMA table_info(formations)").all().map(c => c.name);
  if (!colsFormationsEval.includes('evaluations_associees')) {
    db.exec("ALTER TABLE formations ADD COLUMN evaluations_associees TEXT DEFAULT '[]'");
  }

  // ── Amélioration continue : indicateurs 31 et 32 ──
  //
  // Trois niveaux, et c'est leur emboîtement qui fait la démarche qualité :
  //
  //   Axe d'amélioration   la grande ligne qu'on suit sur l'année
  //     ↳ Incident         ce qui a été constaté : réclamation, incident,
  //                        suggestion, note basse, abandon
  //       ↳ Action         ce qu'on change, qui le fait, pour quand
  //
  // L'auditeur ne regarde pas trois listes côte à côte : il cherche le lien
  // de cause à effet. Une action doit pointer vers l'incident qui l'a
  // déclenchée, et l'incident vers l'axe qu'il alimente.
  //
  // La table `reclamations` existait déjà et tient le rôle d'incident : on
  // l'étend plutôt que d'en créer une seconde qui dirait la même chose.
  db.exec(`
    CREATE TABLE IF NOT EXISTS axes_amelioration (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      statut TEXT NOT NULL DEFAULT 'ouvert'
        CHECK(statut IN ('ouvert','en_cours','atteint','abandonne')),
      date_echeance TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS actions_correctives (
      id TEXT PRIMARY KEY,
      incident_id TEXT REFERENCES reclamations(id) ON DELETE SET NULL,
      axe_id TEXT REFERENCES axes_amelioration(id) ON DELETE SET NULL,
      nom TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'corrective'
        CHECK(type IN ('corrective','preventive','amelioration')),
      responsable TEXT DEFAULT '',
      statut TEXT NOT NULL DEFAULT 'a_faire'
        CHECK(statut IN ('a_faire','en_cours','faite','abandonnee')),
      date_echeance TEXT DEFAULT '',
      date_realisation TEXT DEFAULT '',
      preuve TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_actions_incident ON actions_correctives(incident_id);
    CREATE INDEX IF NOT EXISTS idx_actions_axe ON actions_correctives(axe_id);
  `);

  // L'incident se rattache à un axe, et porte sa cause.
  const colsRecl = db.prepare("PRAGMA table_info(reclamations)").all().map(c => c.name);
  if (!colsRecl.includes('axe_id')) db.exec("ALTER TABLE reclamations ADD COLUMN axe_id TEXT DEFAULT ''");
  if (!colsRecl.includes('cause')) db.exec("ALTER TABLE reclamations ADD COLUMN cause TEXT DEFAULT ''");

  // ── Le prix, module par module ────────────────────────────────────────
  //
  // Une session ne se vend pas d'un bloc : le client achète trois modules à
  // cinq cents euros, et c'est cette ligne à ligne qui part au devis. Le
  // montant total de l'affaire en découle, il ne se saisit pas à côté.
  const modCols = db.prepare("PRAGMA table_info(session_modules)").all().map((c) => c.name);
  if (!modCols.includes('prix_ht')) db.exec("ALTER TABLE session_modules ADD COLUMN prix_ht REAL DEFAULT 0");
  if (!modCols.includes('nature')) db.exec("ALTER TABLE session_modules ADD COLUMN nature TEXT DEFAULT 'Formation'");

  // ── Les envois automatiques, au-delà de la convocation ──
  // Le rappel se joue avant la session, les deux enquêtes après. Chacun a
  // son interrupteur et son délai, parce qu'un organisme ne veut pas
  // forcément relancer un intra de deux personnes comme un inter de douze.
  // Tout est désarmé par défaut : une automatisation qu'on n'a pas choisie
  // est une automatisation qui surprend.
  const colsEnvois = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  for (const [nom, type] of [
    ['rappel_auto_enabled', 'INTEGER DEFAULT 0'],
    ['rappel_lead_days', 'INTEGER DEFAULT 7'],
    ['chaud_auto_enabled', 'INTEGER DEFAULT 0'],
    ['chaud_delai_jours', 'INTEGER DEFAULT 1'],    // le lendemain de la fin
    ['froid_auto_enabled', 'INTEGER DEFAULT 0'],
    ['froid_delai_jours', 'INTEGER DEFAULT 90'],   // trois mois après
  ]) {
    if (!colsEnvois.includes(nom)) db.exec(`ALTER TABLE sessions ADD COLUMN ${nom} ${type}`);
  }

  // ── Espace apprenant : ce que la session en montre ──
  // L'espace affichait tout, tout le temps. Or ce qui doit être visible
  // dépend de la session : un intra n'expose pas la liste des participants,
  // et les boutons d'émargement n'ont de sens que si la présence se signe
  // en ligne. Le nom interne d'une session n'est pas non plus celui qu'on
  // montre à l'apprenant.
  const colsSessionsEspace = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  for (const [nom, type] of [
    ['espace_nom_public', "TEXT DEFAULT ''"],
    ['espace_description', "TEXT DEFAULT ''"],
    ['espace_options', "TEXT DEFAULT ''"],   // JSON, vide = on prend les réglages par défaut
  ]) {
    if (!colsSessionsEspace.includes(nom)) db.exec(`ALTER TABLE sessions ADD COLUMN ${nom} ${type}`);
  }

  // ── Les clients d'une session ──
  // Une session n'a pas un client, elle en a autant qu'il y a de payeurs.
  // Chacun a son prix, son nombre d'apprenants au devis, son bon de commande
  // et surtout ses cases de BPF : c'est là que se décide dans quelle ligne du
  // Cerfa tombera l'argent. Jusqu'ici la session portait un seul `client_id`
  // et un seul tarif, ce qui rendait toute session inter-entreprises fausse.
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_clients (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      client_id TEXT DEFAULT '',
      commercial TEXT DEFAULT '',
      nb_apprenants_devis INTEGER DEFAULT 0,

      -- Tarif propre à ce client sur cette session
      tarif_special INTEGER DEFAULT 0,
      type_prix TEXT DEFAULT 'Formation & frais pédagogiques',
      description_prix TEXT DEFAULT '',
      mode_facturation TEXT DEFAULT 'Par client',
      prix REAL DEFAULT 0,
      tva REAL DEFAULT 0,

      code_client_comptable TEXT DEFAULT '',
      bon_commande TEXT DEFAULT '',

      -- Les quatre cases qui orientent le BPF
      sous_traitance INTEGER DEFAULT 0,
      dispositif_recherche_emploi INTEGER DEFAULT 0,
      bpf_autres_produits INTEGER DEFAULT 0,
      bpf_autres_apprenants INTEGER DEFAULT 0,

      -- Financeur externe, et qui il paie
      financeur_id TEXT DEFAULT '',
      subrogation INTEGER DEFAULT 0,
      montant_finance REAL DEFAULT 0,

      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_session_clients ON session_clients(session_id);
  `);

  // ── Fiche opportunité : de quoi entrer dans l'affaire, pas seulement la voir ──
  // Une carte de pipeline qu'on déplace sans pouvoir l'ouvrir ne sert qu'à
  // décorer. Ces colonnes rattachent l'opportunité au client, au bon de
  // commande et à la date visée, pour que la session se crée depuis elle.
  const colsOpp = db.prepare("PRAGMA table_info(formation_opportunities)").all().map(c => c.name);
  const champsOpp = [
    ['client_id', "TEXT DEFAULT ''"],            // rattachement à la fiche entreprise
    ['bon_commande', "TEXT DEFAULT ''"],         // référence exigée par les grands comptes
    ['date_session_prevue', "TEXT DEFAULT ''"],  // la date visée, avant qu'une session existe
    ['gestionnaire', "TEXT DEFAULT ''"],         // qui suit l'affaire
    ['financeur_id', "TEXT DEFAULT ''"],         // fiche financeur, quand il y en a un
  ];
  for (const [nom, type] of champsOpp) {
    if (!colsOpp.includes(nom)) db.exec(`ALTER TABLE formation_opportunities ADD COLUMN ${nom} ${type}`);
  }

  // Le journal de l'affaire : qui l'a déplacée, quand, d'où vers où. C'est
  // ce qu'on relit six mois plus tard pour comprendre pourquoi elle traîne.
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunite_evenements (
      id TEXT PRIMARY KEY,
      opportunite_id TEXT NOT NULL REFERENCES formation_opportunities(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note',
      texte TEXT NOT NULL DEFAULT '',
      auteur TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_opp_evenements ON opportunite_evenements(opportunite_id);
  `);

  // ── Fiche lieu : ce que l'audit Qualiopi et l'apprenant demandent ──
  // L'indicateur 26 porte sur l'accessibilité aux personnes en situation de
  // handicap : il faut pouvoir dire, lieu par lieu, ce qui est accessible et
  // qui contacter. Le reste sert à convoquer sans rappeler personne.
  const colsLieux = db.prepare("PRAGMA table_info(lieux_formation)").all().map(c => c.name);
  const champsLieu = [
    ['type_lieu', "TEXT DEFAULT ''"],           // nos locaux, locaux du client, distanciel
    ['acces_transport', "TEXT DEFAULT ''"],     // métro, gare, parking : ça part dans la convocation
    ['horaires_acces', "TEXT DEFAULT ''"],      // à quelle heure le lieu ouvre vraiment
    ['referent_handicap', "TEXT DEFAULT ''"],   // qui prévenir sur place, indicateur 26
    ['consignes_securite', "TEXT DEFAULT ''"],  // issues de secours, consignes à énoncer
    ['cout_location', "TEXT DEFAULT ''"],       // pour la marge réelle d'une session
  ];
  for (const [nom, type] of champsLieu) {
    if (!colsLieux.includes(nom)) db.exec(`ALTER TABLE lieux_formation ADD COLUMN ${nom} ${type}`);
  }

  // ── Fiche intervenant : les preuves qu'un auditeur réclame ──
  // Indicateur 21 : la compétence des intervenants doit être prouvée, pas
  // affirmée. Et dès 5 000 € de prestation, la loi impose de vérifier la
  // vigilance URSSAF de son sous-traitant, tous les six mois.
  const colsFormateurs = db.prepare("PRAGMA table_info(formateurs)").all().map(c => c.name);
  const champsFormateur = [
    ['siret', "TEXT DEFAULT ''"],
    ['nda_numero', "TEXT DEFAULT ''"],            // s'il est lui-même organisme de formation
    ['assurance_rc', "TEXT DEFAULT ''"],          // assureur et numéro de police
    ['assurance_echeance', "TEXT DEFAULT ''"],    // une RC pro périmée invalide la sous-traitance
    ['urssaf_vigilance_date', "TEXT DEFAULT ''"], // attestation à renouveler tous les six mois
    ['cv_date', "TEXT DEFAULT ''"],               // date du CV au dossier, preuve de l'indicateur 21
    ['contrat_type', "TEXT DEFAULT ''"],          // salarié, prestation, sous-traitance
  ];
  for (const [nom, type] of champsFormateur) {
    if (!colsFormateurs.includes(nom)) db.exec(`ALTER TABLE formateurs ADD COLUMN ${nom} ${type}`);
  }

  // ── Financeurs : jusqu'ici déduits des inscriptions, jamais tenus ──
  // Un financeur est une organisation avec laquelle on traite plusieurs fois :
  // un portail, une procédure, des pièces exigées, un délai de paiement.
  // Rien de tout ça ne tient dans un champ texte d'inscription.
  db.exec(`
    CREATE TABLE IF NOT EXISTS financeurs (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL DEFAULT '',
      type TEXT DEFAULT '',                 -- OPCO, FAF, France Travail, Région, CPF, Entreprise
      siret TEXT DEFAULT '',
      adresse TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      ville TEXT DEFAULT '',
      contact_nom TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      contact_tel TEXT DEFAULT '',
      numero_adherent TEXT DEFAULT '',      -- notre identifiant chez eux
      portail_url TEXT DEFAULT '',          -- où déposer le dossier
      identifiant_portail TEXT DEFAULT '',  -- l'identifiant, jamais le mot de passe
      pieces_exigees TEXT DEFAULT '',       -- ce qu'ils réclament à chaque dossier
      delai_depot TEXT DEFAULT '',          -- combien de jours avant la session
      subrogation TEXT DEFAULT '',          -- paiement direct à l'organisme, ou non
      delai_paiement TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      actif INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Fiche entreprise : ce qu'un organisme de formation doit détenir ──
  // Une entreprise cliente n'est pas seulement un nom et une adresse. Sans
  // ces champs, on ne peut ni éditer une convention conforme, ni monter un
  // dossier OPCO, ni router une facture électronique (obligatoire à la
  // réception au 1er septembre 2026), ni renseigner le BPF.
  const colsClients = db.prepare("PRAGMA table_info(clients)").all().map(c => c.name);
  const champsEntreprise = [
    ['forme_juridique', "TEXT DEFAULT ''"],      // SAS, SARL, association, auto-entrepreneur
    ['code_naf', "TEXT DEFAULT ''"],             // APE : sert au BPF et au ciblage
    ['effectif', "TEXT DEFAULT ''"],             // tranche : conditionne l'OPCO et le financement
    ['site_web', "TEXT DEFAULT ''"],
    ['adresse_facturation', "TEXT DEFAULT ''"],  // quand la facture ne va pas au siège
    ['email_facturation', "TEXT DEFAULT ''"],    // la compta, pas le contact commercial
    ['conditions_reglement', "TEXT DEFAULT ''"], // 30 jours fin de mois, à réception…
    ['reference_commande', "TEXT DEFAULT ''"],   // bon de commande : sans lui, facture rejetée
    ['chorus_service_code', "TEXT DEFAULT ''"],  // secteur public : code service Chorus Pro
    ['chorus_engagement', "TEXT DEFAULT ''"],    // secteur public : numéro d'engagement
    ['opco_nom', "TEXT DEFAULT ''"],
    ['opco_numero_adherent', "TEXT DEFAULT ''"],
  ];
  for (const [nom, type] of champsEntreprise) {
    if (!colsClients.includes(nom)) db.exec(`ALTER TABLE clients ADD COLUMN ${nom} ${type}`);
  }

  // Migrations for existing databases
  const cols = db.prepare("PRAGMA table_info(providers)").all().map(c => c.name);
  if (!cols.includes('categories')) {
    db.exec("ALTER TABLE providers ADD COLUMN categories TEXT DEFAULT '[]'");
  }
  if (!cols.includes('rating')) {
    db.exec("ALTER TABLE providers ADD COLUMN rating INTEGER DEFAULT 0");
  }
  if (!cols.includes('phone')) {
    db.exec("ALTER TABLE providers ADD COLUMN phone TEXT DEFAULT ''");
  }
  if (!cols.includes('company')) {
    db.exec("ALTER TABLE providers ADD COLUMN company TEXT DEFAULT ''");
  }
  if (!cols.includes('first_name')) {
    db.exec("ALTER TABLE providers ADD COLUMN first_name TEXT DEFAULT ''");
    // Migrate existing name → first_name (keep name intact for display fallback)
    db.exec("UPDATE providers SET first_name = name WHERE first_name = ''");
  }
  if (!cols.includes('last_name')) {
    db.exec("ALTER TABLE providers ADD COLUMN last_name TEXT DEFAULT ''");
  }
  if (!cols.includes('tarif_min')) {
    db.exec("ALTER TABLE providers ADD COLUMN tarif_min REAL DEFAULT 0");
    // Migrate existing tarif_jour → tarif_min as starting point
    db.exec("UPDATE providers SET tarif_min = tarif_jour WHERE tarif_jour > 0");
  }
  if (!cols.includes('tarif_max')) {
    db.exec("ALTER TABLE providers ADD COLUMN tarif_max REAL DEFAULT 0");
  }
  // Migrate old single category to categories JSON array
  const toMigrate = db.prepare("SELECT id, category, categories FROM providers WHERE categories = '[]' AND category != ''").all();
  for (const p of toMigrate) {
    db.prepare("UPDATE providers SET categories = ? WHERE id = ?").run(JSON.stringify([p.category]), p.id);
  }

  // Migration: add start_date and end_date to projects
  const projCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols.includes('start_date')) {
    db.exec("ALTER TABLE projects ADD COLUMN start_date TEXT DEFAULT ''");
  }
  if (!projCols.includes('end_date')) {
    db.exec("ALTER TABLE projects ADD COLUMN end_date TEXT DEFAULT ''");
  }
  if (!projCols.includes('hours_spent')) {
    db.exec("ALTER TABLE projects ADD COLUMN hours_spent REAL DEFAULT 0");
  }
  if (!projCols.includes('ppm_phases')) {
    db.exec("ALTER TABLE projects ADD COLUMN ppm_phases TEXT DEFAULT '{}'");
  }

  // Migration: add phase_group to tasks
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name);
  if (!taskCols.includes('phase_group')) {
    db.exec("ALTER TABLE tasks ADD COLUMN phase_group TEXT DEFAULT ''");
  }
  // Migration: PPM tasks attributes (Practical Project Management / The Futur)
  // - complexity : 'simple' ou 'complex' (default 'simple')
  // - estimated_hours : heures estimées (REAL, nullable)
  // - depends_on : JSON array d'ids de tâches qui doivent finir avant
  if (!taskCols.includes('complexity')) {
    db.exec("ALTER TABLE tasks ADD COLUMN complexity TEXT DEFAULT 'simple'");
  }
  if (!taskCols.includes('estimated_hours')) {
    db.exec("ALTER TABLE tasks ADD COLUMN estimated_hours REAL");
  }
  if (!taskCols.includes('depends_on')) {
    db.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT DEFAULT '[]'");
  }

  // ── Tables workflow templates (PPM / tâches réutilisables) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      pillar TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_template_tasks (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      phase_group TEXT DEFAULT '',
      complexity TEXT DEFAULT 'simple',
      estimated_hours REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      depends_on TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed initial — uniquement si table vide
  const wfCount = db.prepare('SELECT COUNT(*) as c FROM workflow_templates').get().c;
  if (wfCount === 0) {
    seedWorkflowTemplates(db);
  } else {
    // Migration ciblée : insérer le workflow Brand Strategy s'il manque (DB existante)
    const hasBrand = db.prepare("SELECT id FROM workflow_templates WHERE id = ?").get('wf_brand_strategy');
    if (!hasBrand) {
      seedWorkflowTemplates(db, ['wf_brand_strategy']);
    }
  }

  // ── Tables finances (coûts indirects + trésorerie) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_costs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      amount_ht REAL DEFAULT 0,
      tva_rate REAL DEFAULT 20,
      amount_ttc REAL DEFAULT 0,
      category TEXT DEFAULT '',
      frequency TEXT DEFAULT 'monthly' CHECK(frequency IN ('monthly','quarterly','yearly')),
      day_of_month INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      provider TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_balances (
      id TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      snapshot_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS forecast_items (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('in','out')),
      amount REAL DEFAULT 0,
      expected_date TEXT NOT NULL,
      category TEXT DEFAULT '',
      status TEXT DEFAULT 'expected' CHECK(status IN ('expected','confirmed','done','cancelled')),
      source_type TEXT DEFAULT 'manual',
      source_id TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_costs(active);
    CREATE INDEX IF NOT EXISTS idx_bank_date ON bank_balances(account_name, snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_forecast_date ON forecast_items(expected_date, status);
  `);

  // Migration : start_date / end_date sur recurring_costs (DB existante)
  const rcCols = db.prepare("PRAGMA table_info(recurring_costs)").all().map(c => c.name);
  if (!rcCols.includes('start_date')) {
    db.exec("ALTER TABLE recurring_costs ADD COLUMN start_date TEXT");
  }
  if (!rcCols.includes('end_date')) {
    db.exec("ALTER TABLE recurring_costs ADD COLUMN end_date TEXT");
  }

  // Seed recurring_costs si vide — exemples basés sur structure SASU type
  const rcCount = db.prepare('SELECT COUNT(*) as c FROM recurring_costs').get().c;
  if (rcCount === 0) {
    const insertRc = db.prepare(`
      INSERT INTO recurring_costs (id, label, amount_ht, amount_ttc, tva_rate, category, frequency, day_of_month, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seed = [
      ['rc_urssaf', 'URSSAF (cotisations sociales)', 280, 280, 0, 'URSSAF', 'monthly', 5, 'Cotisations forfaitaires SASU sans salaire'],
      ['rc_comptable', 'Comptable', 150, 180, 20, 'Comptable', 'monthly', 10, 'Honoraires expert-comptable'],
      ['rc_adobe', 'Adobe Creative Cloud', 50, 60, 20, 'Logiciels', 'monthly', 15, 'Suite création'],
      ['rc_qonto', 'Qonto', 9, 10.80, 20, 'Banque', 'monthly', 1, 'Compte pro'],
      ['rc_assurance', 'Assurance RC pro', 45, 45, 0, 'Assurance', 'monthly', 1, 'Responsabilité civile professionnelle'],
    ];
    const tx = db.transaction(() => {
      for (const row of seed) insertRc.run(...row);
    });
    tx();
  }


  // Migration: add task_phase_validations to projects
  const projCols2 = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols2.includes('task_phase_validations')) {
    db.exec("ALTER TABLE projects ADD COLUMN task_phase_validations TEXT DEFAULT '{}'");
  }
  // Migration: add disciplines (Image/Stories/Movement) to projects
  if (!projCols2.includes('disciplines')) {
    db.exec("ALTER TABLE projects ADD COLUMN disciplines TEXT DEFAULT '[]'");
  }

  // Migration: update pillar CHECK to include GRIOTHEQUE (recreate table)
  const projSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (projSchema && !projSchema.sql.includes('GRIOTHEQUE')) {
    db.exec("PRAGMA foreign_keys = OFF");
    db.transaction(() => {
      db.exec(`
        CREATE TABLE projects_new (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          pillar TEXT NOT NULL CHECK(pillar IN ('STUDIO','PROD','GRIOTHEQUE')),
          template TEXT,
          client TEXT DEFAULT '',
          client_contact TEXT DEFAULT '',
          client_email TEXT DEFAULT '',
          client_phone TEXT DEFAULT '',
          client_address TEXT DEFAULT '',
          stage TEXT NOT NULL DEFAULT 'lead',
          revenue REAL DEFAULT 0,
          budget REAL DEFAULT 0,
          notes TEXT DEFAULT '',
          bdc_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          start_date TEXT DEFAULT '',
          end_date TEXT DEFAULT '',
          hours_spent REAL DEFAULT 0,
          ppm_phases TEXT DEFAULT '{}',
          task_phase_validations TEXT DEFAULT '{}'
        );
        INSERT INTO projects_new SELECT
          id, code, name, pillar, template, client, client_contact, client_email, client_phone,
          client_address, stage, revenue, budget, notes, bdc_count, created_at,
          COALESCE(start_date,''), COALESCE(end_date,''), COALESCE(hours_spent,0),
          COALESCE(ppm_phases,'{}'), COALESCE(task_phase_validations,'{}')
        FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_new RENAME TO projects;
      `);
    })();
    db.exec("PRAGMA foreign_keys = ON");
  }

  // Migration: add GRIOTHEQUE to next_indices
  db.prepare("INSERT OR IGNORE INTO next_indices (pillar, next_index) VALUES ('GRIOTHEQUE', 1)").run();

  // Migration: add payment_terms to projects
  const projCols3 = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3.includes('payment_terms')) {
    db.exec("ALTER TABLE projects ADD COLUMN payment_terms TEXT DEFAULT ''");
  }
  // (re-read for next checks)
  const projCols3b = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3b.includes('client_contact_first_name')) {
    db.exec("ALTER TABLE projects ADD COLUMN client_contact_first_name TEXT DEFAULT ''");
  }
  if (!projCols3b.includes('client_contact_last_name')) {
    db.exec("ALTER TABLE projects ADD COLUMN client_contact_last_name TEXT DEFAULT ''");
  }
  // Migration: add creative_brief to projects
  const projCols3c = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3c.includes('creative_brief')) {
    db.exec("ALTER TABLE projects ADD COLUMN creative_brief TEXT DEFAULT '{}'");
  }
  // Migration: add project_journal to projects
  const projCols3d = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3d.includes('project_journal')) {
    db.exec("ALTER TABLE projects ADD COLUMN project_journal TEXT DEFAULT '[]'");
  }
  // Migration: add client_first_name / client_last_name (for individual clients)
  const projCols3e = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3e.includes('client_first_name')) {
    db.exec("ALTER TABLE projects ADD COLUMN client_first_name TEXT DEFAULT ''");
  }
  if (!projCols3e.includes('client_last_name')) {
    db.exec("ALTER TABLE projects ADD COLUMN client_last_name TEXT DEFAULT ''");
  }
  // Migration: add client_id FK to projects (proper clients table)
  if (!projCols3e.includes('client_id')) {
    db.exec("ALTER TABLE projects ADD COLUMN client_id TEXT REFERENCES clients(id)");
  }
  // Migration: add tva_rate to projects
  const projCols3f = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!projCols3f.includes('tva_rate')) {
    db.exec("ALTER TABLE projects ADD COLUMN tva_rate TEXT DEFAULT '20'");
  }

  // ─── MODULE GRIOTHEQUE / QUALIOPI ────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS formations (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      objectives TEXT DEFAULT '[]',
      duration_hours REAL DEFAULT 0,
      duration_days REAL DEFAULT 0,
      modality TEXT DEFAULT 'presentiel' CHECK(modality IN ('presentiel','distanciel','hybride')),
      level TEXT DEFAULT '',
      price_ht REAL DEFAULT 0,
      max_participants INTEGER DEFAULT 12,
      prerequisites TEXT DEFAULT '',
      program TEXT DEFAULT '{}',
      evaluation_methods TEXT DEFAULT '[]',
      target_audience TEXT DEFAULT '',
      accessibility TEXT DEFAULT '',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','draft','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      location TEXT DEFAULT '',
      modality TEXT DEFAULT 'presentiel',
      max_participants INTEGER DEFAULT 12,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','ongoing','completed','cancelled')),
      formateur_id TEXT,
      formateur_name TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS apprenants (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      company TEXT DEFAULT '',
      address TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      city TEXT DEFAULT '',
      financement TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inscriptions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'inscrit' CHECK(status IN ('inscrit','confirme','annule','liste_attente')),
      financement TEXT DEFAULT '',
      price_ht REAL DEFAULT 0,
      convention_signed INTEGER DEFAULT 0,
      convocation_sent INTEGER DEFAULT 0,
      attestation_sent INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emargements (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      matin INTEGER DEFAULT 0,
      apres_midi INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('positionnement','acquis','satisfaction','froid')),
      score REAL,
      responses TEXT DEFAULT '{}',
      comments TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Mot de passe : la voie d'entrée qui ne dépend de personne ──
  // Ni d'un email qui doit partir, ni d'un second appareil déjà connecté, ni
  // d'un accès au serveur. Ajouté après coup, donc en ALTER : la table users
  // existe déjà dans les bases en service.
  try {
    const colonnes = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (!colonnes.includes('password_hash')) {
      db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''");
    }
    if (!colonnes.includes('password_set_at')) {
      db.exec("ALTER TABLE users ADD COLUMN password_set_at TEXT DEFAULT ''");
    }
  } catch (e) {
    console.warn('[db] colonne mot de passe :', e.message);
  }

  // ── Table formateurs ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS formateurs (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      biographie TEXT DEFAULT '',
      qualifications TEXT DEFAULT '',
      domaines TEXT DEFAULT '[]',
      specialite TEXT DEFAULT '[]',
      statut_juridique TEXT DEFAULT '',
      statut_collab TEXT DEFAULT 'actif',
      evaluation TEXT DEFAULT '',
      feedback_interne TEXT DEFAULT '',
      date_dernier_dev_pro TEXT DEFAULT '',
      tarif_jour REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Table modules (sous-parties d'une formation) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      objectives TEXT DEFAULT '[]',
      duration_hours REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Index on modules.formation_id
  db.exec('CREATE INDEX IF NOT EXISTS idx_modules_formation_id ON modules(formation_id)');

  // ── Bibliothèque pédagogique ────────────────────────────────────────────
  // Les blocs sont indépendants des programmes : une mise à jour de bloc peut
  // donc être réutilisée dans plusieurs formations, sans dupliquer le contenu.
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedagogical_blocks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      objectives TEXT DEFAULT '[]',
      content TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS formation_blocks (
      formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
      block_id TEXT NOT NULL REFERENCES pedagogical_blocks(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (formation_id, block_id)
    );

    CREATE TABLE IF NOT EXISTS formation_resources (
      id TEXT PRIMARY KEY,
      formation_id TEXT NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'internal' CHECK(scope IN ('internal','learner')),
      resource_type TEXT NOT NULL DEFAULT 'document',
      url TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluation_templates (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      automatic INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_pedagogical_blocks_archived ON pedagogical_blocks(archived)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_formation_resources_formation_id ON formation_resources(formation_id)');

  const evaluationTemplateCount = db.prepare('SELECT COUNT(*) AS count FROM evaluation_templates').get().count;
  if (evaluationTemplateCount === 0) {
    const addEvaluationTemplate = db.prepare('INSERT INTO evaluation_templates (id, type, title, description, automatic) VALUES (?, ?, ?, ?, ?)');
    [
      ['eval-positionnement', 'positionnement', 'Évaluation préformation pour les apprenants', 'Sonde les attentes et diagnostique le besoin avant la session.', 0],
      ['eval-chaud', 'chaud', 'Évaluation à chaud pour les apprenants', 'Mesure la satisfaction immédiatement après la formation.', 1],
      ['eval-froid', 'froid', 'Évaluation à froid pour les apprenants', 'Mesure l’impact professionnel après la formation.', 1],
      ['eval-manager', 'manager', 'Questionnaire pour les managers des apprenants', 'Recueille le retour du responsable hiérarchique.', 0],
      ['eval-formateur', 'formateur', 'Questionnaire pour les intervenants', 'Recueille le retour de l’intervenant.', 0],
      ['eval-financeur', 'financeur', 'Questionnaire pour les financeurs et commanditaires', 'Recueille le retour du financeur.', 0],
    ].forEach(([id, type, title, description, automatic]) => addEvaluationTemplate.run(id, type, title, description, automatic));
  }

  // ── Inscriptions : validité et relance de recyclage ────────────────────
  // Une inscription reste la source de vérité ; ces trois champs permettent
  // de suivre une certification à renouveler sans créer une fiche doublon.
  const inscriptionCols = db.prepare("PRAGMA table_info(inscriptions)").all().map(c => c.name);
  if (!inscriptionCols.includes('valid_until')) db.exec("ALTER TABLE inscriptions ADD COLUMN valid_until TEXT DEFAULT ''");
  if (!inscriptionCols.includes('follow_up_date')) db.exec("ALTER TABLE inscriptions ADD COLUMN follow_up_date TEXT DEFAULT ''");
  if (!inscriptionCols.includes('follow_up_status')) db.exec("ALTER TABLE inscriptions ADD COLUMN follow_up_status TEXT DEFAULT 'a_relancer'");
  db.exec('CREATE INDEX IF NOT EXISTS idx_inscriptions_valid_until ON inscriptions(valid_until)');

  // ── Table session_modules (modules copiés par session avec durées personnalisables) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_modules (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      objectives TEXT DEFAULT '[]',
      duration_hours REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_modules_session_id ON session_modules(session_id)');

  // ── Table : catégories dynamiques de formations ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS formation_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT DEFAULT '#888888',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── Migrations : enrichissement tables formations/sessions/apprenants ──

  // -- Formations : champs Notion manquants --
  const fCols = db.prepare("PRAGMA table_info(formations)").all().map(c => c.name);
  if (!fCols.includes('thematique')) {
    db.exec("ALTER TABLE formations ADD COLUMN thematique TEXT DEFAULT ''");
  }
  if (!fCols.includes('certification')) {
    db.exec("ALTER TABLE formations ADD COLUMN certification TEXT DEFAULT 'Aucune'");
  }
  if (!fCols.includes('financement_eligible')) {
    db.exec("ALTER TABLE formations ADD COLUMN financement_eligible TEXT DEFAULT '[]'");
  }
  if (!fCols.includes('probleme_resolu')) {
    db.exec("ALTER TABLE formations ADD COLUMN probleme_resolu TEXT DEFAULT ''");
  }
  if (!fCols.includes('livrables_cles')) {
    db.exec("ALTER TABLE formations ADD COLUMN livrables_cles TEXT DEFAULT ''");
  }
  if (!fCols.includes('format_label')) {
    db.exec("ALTER TABLE formations ADD COLUMN format_label TEXT DEFAULT ''");
  }
  if (!fCols.includes('categorie')) {
    db.exec("ALTER TABLE formations ADD COLUMN categorie TEXT DEFAULT ''");
  }

  // -- Sessions : champs Notion manquants --
  const sCols = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols.includes('type_session')) {
    db.exec("ALTER TABLE sessions ADD COLUMN type_session TEXT DEFAULT 'INTER'");
  }
  if (!sCols.includes('horaire')) {
    db.exec("ALTER TABLE sessions ADD COLUMN horaire TEXT DEFAULT ''");
  }
  if (!sCols.includes('tarif')) {
    db.exec("ALTER TABLE sessions ADD COLUMN tarif REAL DEFAULT 0");
  }
  if (!sCols.includes('adresse')) {
    db.exec("ALTER TABLE sessions ADD COLUMN adresse TEXT DEFAULT ''");
  }
  if (!sCols.includes('code_interne')) {
    db.exec("ALTER TABLE sessions ADD COLUMN code_interne TEXT DEFAULT ''");
  }
  if (!sCols.includes('advancement')) {
    db.exec("ALTER TABLE sessions ADD COLUMN advancement TEXT DEFAULT '{}'");
  }
  if (!sCols.includes('documents')) {
    db.exec("ALTER TABLE sessions ADD COLUMN documents TEXT DEFAULT '{}'");
  }
  if (!sCols.includes('taux_marge')) {
    db.exec("ALTER TABLE sessions ADD COLUMN taux_marge REAL DEFAULT 0");
  }

  // -- Formations : champs Digiforma templates + positionnement --
  const fCols2 = db.prepare("PRAGMA table_info(formations)").all().map(c => c.name);
  if (!fCols2.includes('delais_acces')) {
    db.exec("ALTER TABLE formations ADD COLUMN delais_acces TEXT DEFAULT ''");
  }
  if (!fCols2.includes('modalites_pedagogiques')) {
    db.exec("ALTER TABLE formations ADD COLUMN modalites_pedagogiques TEXT DEFAULT ''");
  }
  if (!fCols2.includes('moyens_materiels')) {
    db.exec("ALTER TABLE formations ADD COLUMN moyens_materiels TEXT DEFAULT ''");
  }
  if (!fCols2.includes('positionnement_grille')) {
    db.exec("ALTER TABLE formations ADD COLUMN positionnement_grille TEXT DEFAULT '[]'");
  }
  if (!fCols2.includes('type_formation')) {
    db.exec("ALTER TABLE formations ADD COLUMN type_formation TEXT DEFAULT 'standard'");
  }

  // -- Seed catégories par défaut si table vide --
  const catCount = db.prepare("SELECT COUNT(*) as cnt FROM formation_categories").get().cnt;
  if (catCount === 0) {
    const seedCats = [
      ['realisation', 'Réalisation', '#E67E22', 1],
      ['narration', 'Narration & Écriture', '#9B59B6', 2],
      ['production', 'Production', '#3498DB', 3],
      ['postprod', 'Post-production', '#27AE60', 4],
      ['son', 'Son & Musique', '#E74C3C', 5],
      ['culture', 'Culture & Patrimoine', '#D4A843', 6],
      ['entrepreneuriat', 'Entrepreneuriat créatif', '#1ABC9C', 7],
      ['numerique', 'Numérique & IA', '#2980B9', 8],
    ];
    const ins = db.prepare("INSERT INTO formation_categories (id, label, color, sort_order) VALUES (?, ?, ?, ?)");
    for (const c of seedCats) ins.run(...c);
  }

  // -- Sessions : champs Notion (émargement, programme, prêt) --
  const sCols2 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols2.includes('lien_emargement')) {
    db.exec("ALTER TABLE sessions ADD COLUMN lien_emargement TEXT DEFAULT ''");
  }
  if (!sCols2.includes('url_programme')) {
    db.exec("ALTER TABLE sessions ADD COLUMN url_programme TEXT DEFAULT ''");
  }
  if (!sCols2.includes('formation_prete')) {
    db.exec("ALTER TABLE sessions ADD COLUMN formation_prete INTEGER DEFAULT 0");
  }
  if (!sCols2.includes('planning')) {
    db.exec("ALTER TABLE sessions ADD COLUMN planning TEXT DEFAULT '[]'");
  }
  if (!sCols2.includes('client_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN client_id TEXT REFERENCES clients(id)");
  }

  // -- Inscriptions : champs positionnement (décision, aménagement, notes entretien) --
  const iCols = db.prepare("PRAGMA table_info(inscriptions)").all().map(c => c.name);
  if (!iCols.includes('positionnement_decision')) {
    db.exec("ALTER TABLE inscriptions ADD COLUMN positionnement_decision TEXT DEFAULT ''");
  }
  if (!iCols.includes('positionnement_amenagement')) {
    db.exec("ALTER TABLE inscriptions ADD COLUMN positionnement_amenagement TEXT DEFAULT ''");
  }
  if (!iCols.includes('positionnement_notes')) {
    db.exec("ALTER TABLE inscriptions ADD COLUMN positionnement_notes TEXT DEFAULT ''");
  }

  /*
   * -- Inscriptions : l'entretien préalable --
   *
   * Le formulaire ne conclut rien : il ouvre un appel de positionnement de
   * vingt minutes, et c'est cet appel qui décide. Tant que l'OS ignorait si
   * le créneau avait été réservé, il ne pouvait ni relancer au bon moment ni
   * dire où en était un dossier. Ces quatre colonnes sont remplies par le
   * webhook de l'agenda (Cal.com ou Calendly), pas à la main.
   *
   * entretien_statut : '' | 'reserve' | 'honore' | 'annule' | 'absent'
   */
  for (const [col, decl] of [
    ['entretien_statut', "TEXT DEFAULT ''"],
    ['entretien_le', "TEXT DEFAULT ''"],
    ['entretien_ref', "TEXT DEFAULT ''"],
    ['entretien_lien', "TEXT DEFAULT ''"],
  ]) {
    if (!iCols.includes(col)) db.exec(`ALTER TABLE inscriptions ADD COLUMN ${col} ${decl}`);
  }

  // -- Sessions : lien projet + champs financiers (unification business) --
  const sCols3 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols3.includes('project_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id)");
  }
  if (!sCols3.includes('cout_total')) {
    db.exec("ALTER TABLE sessions ADD COLUMN cout_total REAL DEFAULT 0");
  }
  if (!sCols3.includes('ca_confirmed')) {
    db.exec("ALTER TABLE sessions ADD COLUMN ca_confirmed REAL DEFAULT 0");
  }

  // -- Apprenants : lien client (entreprise) --
  const aCols = db.prepare("PRAGMA table_info(apprenants)").all().map(c => c.name);
  if (!aCols.includes('client_id')) {
    db.exec("ALTER TABLE apprenants ADD COLUMN client_id TEXT REFERENCES clients(id)");
  }

  // -- Apprenants : champs Notion manquants (pipeline Qualiopi complet) --
  const appMigrations = [
    ["date_naissance", "TEXT DEFAULT ''"],
    ["situation_pro", "TEXT DEFAULT ''"],
    ["statut_juridique", "TEXT DEFAULT ''"],
    ["handicap", "INTEGER DEFAULT 0"],
    ["precision_handicap", "TEXT DEFAULT ''"],
    ["experience", "INTEGER DEFAULT 0"],
    ["niveau_exp", "TEXT DEFAULT ''"],
    ["motivation", "TEXT DEFAULT ''"],
    ["modalite_paiement", "TEXT DEFAULT ''"],
    ["connu_comment", "TEXT DEFAULT '[]'"],
    ["reseaux", "TEXT DEFAULT '[]'"],
    ["etat", "TEXT DEFAULT 'new'"],
    ["etat_relance", "TEXT DEFAULT '[]'"],
    ["orga_opco", "TEXT DEFAULT ''"],
    ["faf", "TEXT DEFAULT ''"],
    ["statut_financement", "TEXT DEFAULT 'not_started'"],
    ["financement_entreprise", "INTEGER DEFAULT 0"],
    ["siret", "TEXT DEFAULT ''"],
    ["entreprise_adresse", "TEXT DEFAULT ''"],
    ["entreprise_cp", "TEXT DEFAULT ''"],
    ["entreprise_ville", "TEXT DEFAULT ''"],
    ["entreprise_tel", "TEXT DEFAULT ''"],
    ["email_referent", "TEXT DEFAULT ''"],
    ["nom_referent", "TEXT DEFAULT ''"],
    ["dossier_url", "TEXT DEFAULT ''"],
    ["lien_calendly", "TEXT DEFAULT ''"],
    ["date_positionnement", "TEXT DEFAULT ''"],
    ["date_envoi_doc", "TEXT DEFAULT ''"],
    ["date_inscription", "TEXT DEFAULT ''"],
    ["positionnement_decision", "TEXT DEFAULT ''"],
    ["positionnement_notes", "TEXT DEFAULT ''"],
    ["positionnement_amenagements", "TEXT DEFAULT ''"],
  ];
  for (const [col, def] of appMigrations) {
    if (!aCols.includes(col)) {
      db.exec(`ALTER TABLE apprenants ADD COLUMN ${col} ${def}`);
    }
  }

  // ── Table : lieux de formation ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS lieux_formation (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL DEFAULT '',
      adresse TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      ville TEXT DEFAULT '',
      pays TEXT DEFAULT 'France',
      capacite INTEGER DEFAULT 0,
      accessibilite_pmr INTEGER DEFAULT 0,
      equipements TEXT DEFAULT '',
      contact_nom TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      contact_tel TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // -- Apprenants : champs Digiforma manquants (civilité, nationalité, lieu naissance, n° sécu) --
  const aCols2 = db.prepare("PRAGMA table_info(apprenants)").all().map(c => c.name);
  const appMigrations2 = [
    ["civilite", "TEXT DEFAULT ''"],
    ["nationalite", "TEXT DEFAULT 'Française'"],
    ["lieu_naissance_ville", "TEXT DEFAULT ''"],
    ["lieu_naissance_dept", "TEXT DEFAULT ''"],
    ["lieu_naissance_cp", "TEXT DEFAULT ''"],
    ["num_secu", "TEXT DEFAULT ''"],
    ["langue", "TEXT DEFAULT 'Français'"],
    ["code_interne", "TEXT DEFAULT ''"],
  ];
  for (const [col, def] of appMigrations2) {
    if (!aCols2.includes(col)) {
      db.exec(`ALTER TABLE apprenants ADD COLUMN ${col} ${def}`);
    }
  }

  // -- Sessions : lieu_formation_id FK --
  const sCols4 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols4.includes('lieu_formation_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN lieu_formation_id TEXT REFERENCES lieux_formation(id)");
  }

  // -- Sessions : champs Configuration Digiforma --
  const sCols5 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  const sessMigrations = [
    ["gestionnaire_1", "TEXT DEFAULT 'COULIBALY Moustapha'"],
    ["gestionnaire_2", "TEXT DEFAULT ''"],
    ["inter_entreprise", "INTEGER DEFAULT 1"],
    ["exclure_catalogue", "INTEGER DEFAULT 0"],
    ["sous_traitance", "INTEGER DEFAULT 0"],
    ["fuseau_horaire", "TEXT DEFAULT 'Europe/Paris'"],
    ["type_action_formation", "TEXT DEFAULT 'Action de formation'"],
    ["specialite_formation", "TEXT DEFAULT '100 - Formations générales'"],
    ["diplome_vise", "TEXT DEFAULT 'Aucun'"],
    ["nom_titre_vise", "TEXT DEFAULT ''"],
    ["formation_a_distance", "INTEGER DEFAULT 0"],
    ["convocation_auto_enabled", "INTEGER DEFAULT 0"],
    ["convocation_lead_days", "INTEGER DEFAULT 4"],
    ["convocation_document_template", "TEXT DEFAULT 'Modèle par défaut'"],
    ["convocation_email_template", "TEXT DEFAULT 'Modèle par défaut'"],
  ];
  for (const [col, def] of sessMigrations) {
    if (!sCols5.includes(col)) {
      db.exec(`ALTER TABLE sessions ADD COLUMN ${col} ${def}`);
    }
  }

  // ── Migration: GRT-XX-XXX → PRXXYYY (formations) & GRT-XX-XXX-SNN → AFXXYYY (sessions) ──
  const oldFormations = db.prepare("SELECT id, code FROM formations WHERE code LIKE 'GRT-%'").all();
  for (const f of oldFormations) {
    // GRT-26-001 → PR26001
    const m = f.code.match(/^GRT-(\d{2})-(\d{3})$/);
    if (m) {
      const newCode = `PR${m[1]}${m[2]}`;
      db.prepare("UPDATE formations SET code = ? WHERE id = ?").run(newCode, f.id);
    }
  }
  const oldSessions = db.prepare("SELECT id, code_interne FROM sessions WHERE code_interne LIKE 'GRT-%'").all();
  for (const s of oldSessions) {
    // GRT-26-001-S01 → AF26XXX (sequential)
    const m = s.code_interne.match(/^GRT-(\d{2})-/);
    if (m) {
      const yr = m[1];
      const countBefore = db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE code_interne LIKE 'AF%'").get()?.cnt || 0;
      const newCode = `AF${yr}${String(countBefore + 1).padStart(3, '0')}`;
      db.prepare("UPDATE sessions SET code_interne = ? WHERE id = ?").run(newCode, s.id);
    }
  }

  // ── Migration: clients — ajout pillar + tva_applicable pour séparer Agence / Griothèque ──
  const cCols = db.prepare("PRAGMA table_info(clients)").all().map(c => c.name);
  const clientMigrations = [
    ["pillar", "TEXT DEFAULT 'AGENCE'"],         // AGENCE | GRIOTHEQUE | BOTH
    ["tva_applicable", "INTEGER DEFAULT 1"],      // 1 = TVA applicable (Agence), 0 = exonéré (Griothèque)
    ["tva_rate", "REAL DEFAULT 20.0"],            // Taux TVA par défaut
    ["type_client", "TEXT DEFAULT 'entreprise'"], // entreprise | particulier | opco | institution
  ];
  for (const [col, def] of clientMigrations) {
    if (!cCols.includes(col)) {
      db.exec(`ALTER TABLE clients ADD COLUMN ${col} ${def}`);
    }
  }

  // ── Migration: Add session_name to sessions table ──
  const sCols6 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols6.includes('session_name')) {
    db.exec("ALTER TABLE sessions ADD COLUMN session_name TEXT DEFAULT ''");
  }

  // ── Migration: Add missing fields to apprenants for Notion sync ──
  const aCols3 = db.prepare("PRAGMA table_info(apprenants)").all().map(c => c.name);
  const appMigrations3 = [
    ["autres_situation_pro", "TEXT DEFAULT ''"],
    ["autres_statut_juridique", "TEXT DEFAULT ''"],
    ["date_selectionne", "TEXT DEFAULT '[]'"],
    ["path_dropbox", "TEXT DEFAULT ''"],
  ];
  for (const [col, def] of appMigrations3) {
    if (!aCols3.includes(col)) {
      db.exec(`ALTER TABLE apprenants ADD COLUMN ${col} ${def}`);
    }
  }

  // ── Migration: Add tarif_jour to formateurs table ──
  const formateurCols = db.prepare("PRAGMA table_info(formateurs)").all().map(c => c.name);
  if (!formateurCols.includes('tarif_jour')) {
    db.exec("ALTER TABLE formateurs ADD COLUMN tarif_jour REAL DEFAULT 0");
  }

  // ── Migration: Add notion_page_url to all main tables ──
  const fColsNotion = db.prepare("PRAGMA table_info(formations)").all().map(c => c.name);
  if (!fColsNotion.includes('notion_page_url')) {
    db.exec("ALTER TABLE formations ADD COLUMN notion_page_url TEXT DEFAULT ''");
  }

  const sCols7 = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (!sCols7.includes('notion_page_url')) {
    db.exec("ALTER TABLE sessions ADD COLUMN notion_page_url TEXT DEFAULT ''");
  }

  const aCols4 = db.prepare("PRAGMA table_info(apprenants)").all().map(c => c.name);
  if (!aCols4.includes('notion_page_url')) {
    db.exec("ALTER TABLE apprenants ADD COLUMN notion_page_url TEXT DEFAULT ''");
  }

  const formateurCols2 = db.prepare("PRAGMA table_info(formateurs)").all().map(c => c.name);
  if (!formateurCols2.includes('notion_page_url')) {
    db.exec("ALTER TABLE formateurs ADD COLUMN notion_page_url TEXT DEFAULT ''");
  }

  // ── Creation: notion_sync_map table for Notion↔OS sync tracking ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS notion_sync_map (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      os_id TEXT NOT NULL,
      notion_page_url TEXT NOT NULL,
      notion_collection_id TEXT NOT NULL,
      last_synced_at TEXT,
      sync_direction TEXT DEFAULT 'both',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_sync_map_entity ON notion_sync_map(entity_type, os_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sync_map_notion ON notion_sync_map(notion_page_url)");

  // ── WAL checkpoint on startup (keeps WAL file small) ──
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}

  // ── Indexes on foreign keys for query performance ──
  const indexes = [
    ['idx_client_contacts_client_id', 'client_contacts', 'client_id'],
    ['idx_projects_client_id', 'projects', 'client_id'],
    ['idx_expenses_project_id', 'expenses', 'project_id'],
    ['idx_expenses_provider_id', 'expenses', 'provider_id'],
    ['idx_ip_revenues_project_id', 'ip_revenues', 'project_id'],
    ['idx_tasks_project_id', 'tasks', 'project_id'],
    ['idx_tasks_assignee_id', 'tasks', 'assignee_id'],
    ['idx_production_phases_project_id', 'production_phases', 'project_id'],
    ['idx_postings_project_id', 'postings', 'project_id'],
    ['idx_postings_phase_id', 'postings', 'phase_id'],
    ['idx_ppm_logs_project_id', 'ppm_logs', 'project_id'],
    ['idx_sessions_formation_id', 'sessions', 'formation_id'],
    ['idx_sessions_client_id', 'sessions', 'client_id'],
    ['idx_sessions_project_id', 'sessions', 'project_id'],
    ['idx_sessions_formateur_id', 'sessions', 'formateur_id'],
    ['idx_inscriptions_session_id', 'inscriptions', 'session_id'],
    ['idx_inscriptions_apprenant_id', 'inscriptions', 'apprenant_id'],
    ['idx_emargements_session_id', 'emargements', 'session_id'],
    ['idx_emargements_apprenant_id', 'emargements', 'apprenant_id'],
    ['idx_evaluations_session_id', 'evaluations', 'session_id'],
    ['idx_evaluations_apprenant_id', 'evaluations', 'apprenant_id'],
    ['idx_team_members_provider_id', 'team_members', 'provider_id'],
    ['idx_apprenants_client_id', 'apprenants', 'client_id'],
    ['idx_sessions_lieu_formation_id', 'sessions', 'lieu_formation_id'],
  ];
  for (const [name, table, column] of indexes) {
    db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${column})`);
  }

  // ── Auth & RBAC tables ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'collaborateur' CHECK(role IN ('admin','manager','collaborateur')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions_auth (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'collaborateur' CHECK(role IN ('admin','manager','collaborateur')),
      token TEXT UNIQUE NOT NULL,
      invited_by TEXT REFERENCES users(id),
      used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Ensure Moos is admin ──
  const moos = db.prepare("SELECT id FROM users WHERE email = ?").get('moos.coulibaly@gmail.com');
  if (!moos) {
    db.prepare(`INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)`).run(
      'usr_moos', 'moos.coulibaly@gmail.com', 'Moos Coulibaly', 'admin'
    );
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_auth_user_id ON sessions_auth(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_auth_token ON sessions_auth(token)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);

  // ── Table : tunnel de vente formations (Griothèque Pipeline) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS formation_opportunities (
      id TEXT PRIMARY KEY,
      formation_id TEXT REFERENCES formations(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL DEFAULT '',
      client_email TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      company TEXT DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'prospect' CHECK(stage IN ('prospect','besoin','devis_envoye','convention_signee','financement_valide','session_planifiee','perdu')),
      revenue REAL DEFAULT 0,
      financement TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      source TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const opportunityCols = db.prepare("PRAGMA table_info(formation_opportunities)").all().map(c => c.name);
  if (!opportunityCols.includes('session_id')) {
    db.exec('ALTER TABLE formation_opportunities ADD COLUMN session_id TEXT REFERENCES sessions(id)');
  }
  if (!opportunityCols.includes('archived')) {
    db.exec('ALTER TABLE formation_opportunities ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }
  // Migration des affaires déjà importées avant l'existence de session_id.
  db.exec("UPDATE formation_opportunities SET session_id = substr(source, 9) WHERE session_id IS NULL AND source LIKE 'session:%'");
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_stage ON formation_opportunities(stage)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_formation_id ON formation_opportunities(formation_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_session_id ON formation_opportunities(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_archived ON formation_opportunities(archived)');

  // ── Migration: élargir CHECK constraint evaluations pour ajouter 'froid' ──
  try {
    const checkInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='evaluations'").get();
    if (checkInfo && checkInfo.sql && !checkInfo.sql.includes("'froid'")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS evaluations_new (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('positionnement','acquis','satisfaction','froid')),
          score REAL,
          responses TEXT DEFAULT '{}',
          comments TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO evaluations_new SELECT * FROM evaluations;
        DROP TABLE evaluations;
        ALTER TABLE evaluations_new RENAME TO evaluations;
      `);
    }
  } catch (e) {
    // Silently ignore if migration already done or table doesn't exist yet
  }

  // ── Module Griothèque Pro : checklist cycle de vie, liens publics, signatures, preuves Qualiopi ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_checklist (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      due_at TEXT NOT NULL DEFAULT '',
      done_at TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      UNIQUE(session_id, step_key)
    );

    -- ── GESTION DE L'ORGANISME (pilotage de l'OF lui-même) ──────────────
    -- Pièces officielles de l'organisme de formation, avec dates de validité.
    -- Sert deux usages : l'alerte avant péremption (Kbis, Qualiopi, assurance
    -- RC pro, attestation URSSAF…) et le volet « Organisme » du dossier
    -- d'audit Qualiopi. Le fichier n'est pas stocké en base : on garde une
    -- référence (chemin, URL de coffre-fort ou simple numéro de pièce).
    CREATE TABLE IF NOT EXISTS organisme_documents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'autre'
        CHECK(type IN ('kbis','nda','qualiopi','assurance_rc','urssaf',
                       'certification','reglement_interieur','cgv','autre')),
      libelle TEXT NOT NULL DEFAULT '',
      reference TEXT DEFAULT '',
      emis_le TEXT DEFAULT '',
      expire_le TEXT DEFAULT '',
      emetteur TEXT DEFAULT '',
      fichier TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      indicator INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_organisme_documents_type ON organisme_documents(type);
    CREATE INDEX IF NOT EXISTS idx_organisme_documents_expire ON organisme_documents(expire_le);

    -- Registre des réclamations, incidents et suggestions.
    -- Indicateur 31 du RNQ (traitement des aléas et réclamations) : l'auditeur
    -- attend un registre daté ET la trace du traitement (analyse, action
    -- corrective, responsable, clôture). Un registre vide mais tenu est
    -- recevable ; un registre inexistant ne l'est pas.
    CREATE TABLE IF NOT EXISTS reclamations (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL DEFAULT '',
      nature TEXT NOT NULL DEFAULT 'reclamation'
        CHECK(nature IN ('reclamation','incident','suggestion')),
      origine TEXT NOT NULL DEFAULT 'apprenant'
        CHECK(origine IN ('apprenant','client','formateur','financeur','partenaire','interne','autre')),
      canal TEXT DEFAULT '',
      auteur_nom TEXT DEFAULT '',
      auteur_email TEXT DEFAULT '',
      objet TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      gravite TEXT NOT NULL DEFAULT 'mineure'
        CHECK(gravite IN ('mineure','majeure','critique')),
      statut TEXT NOT NULL DEFAULT 'ouverte'
        CHECK(statut IN ('ouverte','en_cours','resolue','classee')),
      analyse TEXT DEFAULT '',
      action_corrective TEXT DEFAULT '',
      responsable TEXT DEFAULT '',
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      apprenant_id TEXT REFERENCES apprenants(id) ON DELETE SET NULL,
      recue_le TEXT NOT NULL DEFAULT (date('now')),
      resolue_le TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reclamations_statut ON reclamations(statut);
    CREATE INDEX IF NOT EXISTS idx_reclamations_recue_le ON reclamations(recue_le);

    -- Liens de connexion à usage unique (voie d'entrée sans Google OAuth).
    -- Généré en ligne de commande sur le serveur : node scripts/lien-connexion.mjs
    -- Durée de vie courte + usage unique : le lien vaut mot de passe le temps
    -- d'un clic, il ne doit pas traîner. Ne remplace pas OAuth à terme.
    CREATE TABLE IF NOT EXISTS login_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_login_links_token ON login_links(token);

    -- Journal des emails : tout envoi, réel ou simulé, laisse une trace.
    -- Sert trois choses : savoir ce qui est parti à qui et quand (l'auditeur
    -- le demande pour les convocations et les questionnaires), diagnostiquer
    -- un échec, et faire tourner l'app sans SMTP configuré (statut 'simule').
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      template_key TEXT DEFAULT '',
      destinataire TEXT NOT NULL DEFAULT '',
      destinataire_nom TEXT DEFAULT '',
      objet TEXT NOT NULL DEFAULT '',
      corps TEXT DEFAULT '',
      statut TEXT NOT NULL DEFAULT 'simule'
        CHECK(statut IN ('simule','envoye','echec')),
      erreur TEXT DEFAULT '',
      message_id TEXT DEFAULT '',
      contexte_type TEXT DEFAULT '',
      contexte_id TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at);
    CREATE INDEX IF NOT EXISTS idx_emails_contexte ON emails(contexte_type, contexte_id);

    -- ── CYCLE DE VIE COMMERCIAL (cahier des charges § 12 et 13) ──────────
    -- L'OS savait déjà GÉNÉRER un devis ou une facture en PDF ; il ne savait
    -- pas ce qu'ils devenaient. Ces deux tables suivent la vie du document :
    -- envoyé, accepté, payé, en retard. C'est ce qui alimente le tableau de
    -- bord financier et les relances.
    CREATE TABLE IF NOT EXISTS devis (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL DEFAULT '',
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      formation_id TEXT REFERENCES formations(id) ON DELETE SET NULL,
      apprenant_id TEXT REFERENCES apprenants(id) ON DELETE SET NULL,
      objet TEXT NOT NULL DEFAULT '',
      montant_ht REAL NOT NULL DEFAULT 0,
      tva_rate REAL NOT NULL DEFAULT 0,
      montant_ttc REAL NOT NULL DEFAULT 0,
      statut TEXT NOT NULL DEFAULT 'brouillon'
        CHECK(statut IN ('brouillon','envoye','consulte','accepte','refuse','expire')),
      date_emission TEXT NOT NULL DEFAULT (date('now')),
      date_envoi TEXT DEFAULT '',
      date_reponse TEXT DEFAULT '',
      valide_jusqu_au TEXT DEFAULT '',
      fichier TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);

    -- Le payeur n'est pas toujours l'apprenant : entreprise, OPCO, CPF, FAF.
    -- La subrogation (l'OF encaisse directement le financeur) change le
    -- circuit de relance, d'où le drapeau dédié.
    CREATE TABLE IF NOT EXISTS factures (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL DEFAULT '',
      devis_id TEXT REFERENCES devis(id) ON DELETE SET NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      apprenant_id TEXT REFERENCES apprenants(id) ON DELETE SET NULL,
      objet TEXT NOT NULL DEFAULT '',
      montant_ht REAL NOT NULL DEFAULT 0,
      tva_rate REAL NOT NULL DEFAULT 0,
      montant_ttc REAL NOT NULL DEFAULT 0,
      montant_paye REAL NOT NULL DEFAULT 0,
      statut TEXT NOT NULL DEFAULT 'brouillon'
        CHECK(statut IN ('brouillon','envoyee','payee','partiellement_payee','retard','annulee')),
      payeur_type TEXT NOT NULL DEFAULT 'apprenant'
        CHECK(payeur_type IN ('apprenant','entreprise','opco','cpf','faf','autre')),
      subrogation INTEGER NOT NULL DEFAULT 0,
      date_emission TEXT NOT NULL DEFAULT (date('now')),
      date_echeance TEXT DEFAULT '',
      date_paiement TEXT DEFAULT '',
      fichier TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
    CREATE INDEX IF NOT EXISTS idx_factures_echeance ON factures(date_echeance);

    -- ── COFFRE-FORT DOCUMENTAIRE (§ 15) ─────────────────────────────────
    -- Indexe les documents rattachés à une entité (apprenant, session,
    -- formateur, client…). Le fichier lui-même n'est pas stocké en base : on
    -- garde son emplacement. Deux apports par rapport à un simple dossier :
    -- la VERSION (on retrouve la convention v1 signée après une v2) et la
    -- date d'expiration (CV, habilitations).
    -- NB : les pièces réglementaires de l'OF vivent dans organisme_documents,
    -- qui a ses champs propres (émetteur, indicateur RNQ).
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      categorie TEXT NOT NULL DEFAULT 'autre'
        CHECK(categorie IN ('convention','contrat','cv','attestation','certificat',
                            'emargement','facture','devis','programme','support','autre')),
      libelle TEXT NOT NULL DEFAULT '',
      fichier TEXT DEFAULT '',
      contexte_type TEXT NOT NULL DEFAULT 'autre'
        CHECK(contexte_type IN ('apprenant','session','formation','formateur',
                                'client','projet','organisme','autre')),
      contexte_id TEXT DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      expire_le TEXT DEFAULT '',
      signe INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_documents_contexte ON documents(contexte_type, contexte_id);
    CREATE INDEX IF NOT EXISTS idx_documents_categorie ON documents(categorie);

    CREATE TABLE IF NOT EXISTS public_links (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('emargement','questionnaire')),
      token TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT REFERENCES apprenants(id) ON DELETE CASCADE,
      questionnaire_type TEXT,
      slot_date TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Le lien personnel d'un apprenant vers son espace. Table à part plutôt
    -- qu'une valeur de plus dans public_links : la contrainte CHECK de cette
    -- table est figée dans les bases déjà déployées, et une migration de
    -- schéma n'a pas sa place pour ajouter une porte d'entrée.
    CREATE TABLE IF NOT EXISTS espace_liens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_espace_liens_token ON espace_liens(token);

    -- Accès à usage limité, demandé par l'apprenant lui-même.
    --
    -- Le lien personnel permanent a un défaut que Digiforma reconnaît dans
    -- sa propre interface : transféré à quelqu'un d'autre, il ouvre l'espace
    -- à cette personne, indéfiniment. Ici l'apprenant saisit son adresse et
    -- reçoit un lien qui meurt après quelques heures. L'adresse devient la
    -- preuve d'identité, et le lien n'est plus qu'un ticket.
    CREATE TABLE IF NOT EXISTS espace_acces (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_espace_acces_token ON espace_acces(token);
    CREATE INDEX IF NOT EXISTS idx_espace_acces_email ON espace_acces(email, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_espace_liens_couple
      ON espace_liens(session_id, apprenant_id);

    -- Lien public d'inscription, séparé des liens de présence/questionnaire
    -- afin de conserver la contrainte CHECK historique de public_links.
    CREATE TABLE IF NOT EXISTS session_registration_links (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_session_registration_links_token ON session_registration_links(token);
    CREATE INDEX IF NOT EXISTS idx_session_registration_links_session_id ON session_registration_links(session_id);

    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      apprenant_id TEXT REFERENCES apprenants(id) ON DELETE CASCADE,
      signer_role TEXT NOT NULL DEFAULT 'apprenant' CHECK(signer_role IN ('apprenant','formateur')),
      date TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('matin','apres_midi')),
      signature_png TEXT NOT NULL,
      signed_name TEXT DEFAULT '',
      signed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip TEXT DEFAULT '',
      UNIQUE(session_id, apprenant_id, signer_role, date, period)
    );

    CREATE TABLE IF NOT EXISTS qualiopi_evidence (
      id TEXT PRIMARY KEY,
      indicator INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('document','lien','note','auto')),
      ref TEXT DEFAULT '',
      note TEXT DEFAULT '',
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      formation_id TEXT REFERENCES formations(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_session_checklist_session_id ON session_checklist(session_id);
    CREATE INDEX IF NOT EXISTS idx_public_links_session_id ON public_links(session_id);
    CREATE INDEX IF NOT EXISTS idx_public_links_token ON public_links(token);
    CREATE INDEX IF NOT EXISTS idx_signatures_session_id ON signatures(session_id);
    CREATE INDEX IF NOT EXISTS idx_qualiopi_evidence_indicator ON qualiopi_evidence(indicator);
  `);
}

// ────────────────────────────────────────────────────────────
// Seed initial workflow_templates depuis constants.js
// Si onlyIds est fourni, ne seed que les templates dont l'id est dans la liste
// ────────────────────────────────────────────────────────────
function seedWorkflowTemplates(db, onlyIds = null) {
  // Templates inspirés de constants.js PROJECT_TEMPLATES + PRODUCTION_TASK_TEMPLATES + TASK_PHASE_GROUPS
  const TEMPLATES = [
    {
      id: 'wf_strategy', name: 'Stratégie & Narration', pillar: 'STUDIO', icon: '🎯',
      description: 'Audit, architecture de marque, plateforme narrative.',
      groups: [
        { label: 'Recherche & stratégie', tasks: ['Audit narratif & recherche', 'Architecture de marque', 'Plateforme narrative'], complexity: 'complex' },
        { label: 'Production', tasks: ['Rédaction livrables', 'Présentation client'], complexity: 'simple' },
        { label: 'Livraison', tasks: ['Validation & ajustements', 'Livraison finale'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_da', name: 'Direction Artistique', pillar: 'STUDIO', icon: '🎨',
      description: 'Identité visuelle, direction créative, univers graphique.',
      groups: [
        { label: 'Exploration', tasks: ['Références & inspirations', 'Moodboard'], complexity: 'simple' },
        { label: 'Création', tasks: ['Direction artistique v1', 'Feedback & ajustements', 'DA finale', 'Déclinaisons'], complexity: 'complex' },
        { label: 'Livraison', tasks: ['Validation client', 'Livraison des fichiers'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_production', name: 'Production Audiovisuelle', pillar: 'STUDIO', icon: '🎬',
      description: 'Tournage, post-production, livrables vidéo.',
      groups: [
        { label: 'Développement', tasks: ['Écriture & storyboard', 'Repérage lieux', 'Casting'], complexity: 'complex' },
        { label: 'Pré-production', tasks: ['Pré-production', 'Tournage'], complexity: 'complex' },
        { label: 'Post-production', tasks: ['Montage rough cut', 'Montage fine cut', 'Validation client', 'Étalonnage', 'Sound design & mixage', 'Motion & VFX'], complexity: 'complex' },
        { label: 'Livraison', tasks: ['Export masters', 'Livraison'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_movement', name: 'Movement Direction', pillar: 'STUDIO', icon: '🩰',
      description: 'Chorégraphie, mise en scène corporelle.',
      groups: [
        { label: 'Création', tasks: ['Recherche & références mouvements', 'Conception chorégraphique', 'Répétitions', 'Filage'], complexity: 'complex' },
        { label: 'Captation', tasks: ['Captation / Tournage'], complexity: 'complex' },
        { label: 'Post-production', tasks: ['Montage'], complexity: 'complex' },
        { label: 'Livraison', tasks: ['Livraison'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_ip', name: 'Production Originale / IP', pillar: 'PROD', icon: '🎥',
      description: 'IP propre LES GRIOTS — série, documentaire, installation.',
      groups: [
        { label: 'Développement', tasks: ['Développement', 'Écriture'], complexity: 'complex' },
        { label: 'Production', tasks: ['Pré-production', 'Tournage / Production'], complexity: 'complex' },
        { label: 'Post-production', tasks: ['Montage', 'Post-production'], complexity: 'complex' },
        { label: 'Diffusion', tasks: ['Distribution & diffusion'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_dc', name: 'Direction Créative', pillar: 'STUDIO', icon: '🧭',
      description: 'Brief, concept, supervision, guidelines.',
      groups: [
        { label: 'Découverte', tasks: ['Brief créatif & immersion', 'Recherche & références', 'Analyse concurrentielle'], complexity: 'complex' },
        { label: 'Concept', tasks: ['Concept créatif', 'Moodboard & univers visuel', 'Présentation concept'], complexity: 'complex' },
        { label: 'Direction', tasks: ['Direction artistique', 'Supervision création', 'Retours & ajustements'], complexity: 'complex' },
        { label: 'Livraison', tasks: ['Validation finale', 'Livraison des guidelines', 'Archivage créatif'], complexity: 'simple' },
      ],
    },
    {
      id: 'wf_brand_strategy', name: 'Brand Strategy (The Futur)', pillar: 'STUDIO', icon: '🧬',
      description: 'Stratégie de marque complète en 5 étapes — méthode The Futur (Chris Do).',
      groups: [
        { label: '1. Mission · Vision · Goals', tasks: [
          'Atelier facilitation client',
          'Mission statement (raison d\'être de la marque)',
          'Vision statement (où elle va dans 5 ans)',
          'Goals (3 objectifs business mesurables)',
          'Valeurs fondatrices (3 à 5 max)',
          'Validation Mission/Vision/Goals',
        ], complexity: 'complex' },
        { label: '2. Brand Personality', tasks: [
          'Archétype de marque (les 12 archétypes de Jung)',
          'Tone of voice (3 adjectifs incarnés)',
          'Brand persona (description humaine)',
          'Manifesto / point of view',
          'Validation Personality',
        ], complexity: 'complex' },
        { label: '3. Target Audience & Research', tasks: [
          'Recherche quantitative (data marché)',
          'Recherche qualitative (interviews cibles)',
          'Persona 1 (cœur de cible)',
          'Persona 2 (cible secondaire)',
          'Jobs to be done (besoins fonctionnels et émotionnels)',
          'Validation Audience',
        ], complexity: 'complex' },
        { label: '4. Gap Analysis', tasks: [
          'Audit concurrentiel (5 marques benchmark)',
          'Positioning map (axes différenciants)',
          'SWOT marque',
          'Identification des gaps à exploiter',
          'Validation Gap Analysis',
        ], complexity: 'complex' },
        { label: '5. Roadmap', tasks: [
          'Roadmap 12 mois (jalons stratégiques)',
          'Brand pillars (3 piliers de communication)',
          'Naming framework (si applicable)',
          'Plateforme messaging (taglines, accroches)',
          'Plan d\'activation (touchpoints prioritaires)',
          'Workbook final',
          'Présentation finale & atelier handoff',
        ], complexity: 'complex' },
      ],
    },
    {
      id: 'wf_formation', name: 'Formation / Masterclass', pillar: 'GRIOTHEQUE', icon: '🎓',
      description: 'Formation, masterclass ou workshop La Griothèque.',
      groups: [
        { label: 'Ingénierie', tasks: ['Cadrage pédagogique', 'Identification intervenant·e', 'Convention de formation', 'Conception du programme', 'Création des supports'], complexity: 'complex' },
        { label: 'Déploiement', tasks: ['Communication & inscriptions', 'Logistique (salle / lien visio)', 'Session de formation'], complexity: 'simple' },
        { label: 'Clôture', tasks: ['Émargement & évaluation', 'Attestation de réalisation', 'Bilan pédagogique', 'Facturation & suivi paiement'], complexity: 'simple' },
      ],
    },
  ];

  const insertTpl = db.prepare(`
    INSERT INTO workflow_templates (id, name, description, pillar, icon)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO workflow_template_tasks (id, template_id, title, phase_group, complexity, sort_order, depends_on)
    VALUES (?, ?, ?, ?, ?, ?, '[]')
  `);

  const tx = db.transaction(() => {
    for (const tpl of TEMPLATES) {
      if (onlyIds && !onlyIds.includes(tpl.id)) continue;
      insertTpl.run(tpl.id, tpl.name, tpl.description, tpl.pillar, tpl.icon);
      let order = 0;
      for (const grp of tpl.groups) {
        for (const title of grp.tasks) {
          const tid = `wft_${tpl.id.slice(3)}_${order}_${Math.random().toString(36).slice(2, 7)}`;
          insertTask.run(tid, tpl.id, title, grp.label, grp.complexity || 'simple', order);
          order += 1;
        }
      }
    }
  });
  tx();
}

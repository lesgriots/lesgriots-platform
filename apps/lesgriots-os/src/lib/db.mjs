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
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_stage ON formation_opportunities(stage)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_fo_formation_id ON formation_opportunities(formation_id)');

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

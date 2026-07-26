#!/usr/bin/env node
/**
 * MCP Server — LES GRIOTS OS  v2.0
 *
 * Expose les données et actions de LES GRIOTS OS comme outils MCP.
 * Connexion via HTTP à l'app Next.js (local ou VPS).
 *
 * Changements v2 :
 *  - Error handling robuste (plus de crash silencieux)
 *  - Timeout sur tous les fetch (10s)
 *  - Handlers resources/list, prompts/list pour compatibilité clients MCP
 *  - Logging stderr pour debug
 *  - Outils granulaires (appels API ciblés au lieu de /api/data pour tout)
 *  - Nouveaux outils : factures, devis Griothèque, tâches, settings, apprenants
 *
 * Usage:
 *   OS_URL=https://os.lesgriots.fr node mcp-server.js
 *   OS_URL=http://localhost:3000 node mcp-server.js  (dev local)
 *
 * Installation dans Cowork/Claude Desktop :
 *   {
 *     "mcpServers": {
 *       "lesgriots": {
 *         "command": "node",
 *         "args": ["/chemin/vers/mcp-server.js"],
 *         "env": { "OS_URL": "http://localhost:3000" }
 *       }
 *     }
 *   }
 */

const DASHBOARD_URL = process.env.OS_URL || process.env.DASHBOARD_URL || 'http://localhost:3000';
const FETCH_TIMEOUT = 10_000; // 10s

// Clé API pour s'authentifier auprès de l'OS (header x-api-key, validé par withGuard)
const OS_API_KEY = process.env.OS_API_KEY || '';
function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (OS_API_KEY) headers['x-api-key'] = OS_API_KEY;
  return headers;
}

// ── Logging (stderr only — stdout is reserved for MCP protocol) ───────────
function log(...args) {
  process.stderr.write(`[lesgriots-mcp] ${args.join(' ')}\n`);
}

// ── MCP Protocol over stdio (newline-delimited JSON) ──────────────────────

process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line in buffer
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      pendingRequests++;
      handleMessage(msg)
        .catch((err) => {
          log('Unhandled error in handleMessage:', err.message);
          if (msg.id !== undefined) {
            send({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: -32603, message: `Internal error: ${err.message}` },
            });
          }
        })
        .finally(() => {
          pendingRequests--;
          maybeExit();
        });
    } catch (parseErr) {
      log('JSON parse error:', parseErr.message, '— line:', line.slice(0, 200));
    }
  }
});

// Track pending requests so we don't exit while work is in flight
let pendingRequests = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && pendingRequests === 0) {
    log('All requests done, shutting down');
    process.exit(0);
  }
}

process.stdin.on('end', () => {
  log('stdin closed');
  stdinClosed = true;
  maybeExit();
});

// Catch unhandled errors so the process doesn't die silently
process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION:', err.message);
  log(err.stack);
});
process.on('unhandledRejection', (err) => {
  log('UNHANDLED REJECTION:', err?.message || err);
});

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// ── HTTP helper with timeout ──────────────────────────────────────────────

async function api(path, method = 'GET', body = null) {
  const url = `${DASHBOARD_URL}${path}`;
  const opts = {
    method,
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`Timeout: l'OS ne répond pas (${url}). Vérifiez que le serveur Next.js tourne.`);
    }
    throw new Error(`Connexion impossible à l'OS (${url}): ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Outils disponibles ────────────────────────────────────────────────────

const TOOLS = [
  // ── Dashboard / Vue globale ──
  {
    name: 'resume_dashboard',
    description: "Donne un résumé complet de LES GRIOTS OS : CA agence, CA formation, projets actifs, pipeline, alertes, stats Griothèque",
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Projets (Agence) ──
  {
    name: 'get_projets',
    description: 'Récupère tous les projets LES GRIOTS avec leurs stats (revenu, stage, client, dépenses)',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Filtrer par stage : lead, need, qualify, quoted, negotiation, signed, active, delivered, paid, lost' },
        pillar: { type: 'string', description: 'Filtrer par pilier : STUDIO, PROD, GRIOTHEQUE' },
      },
    },
  },
  {
    name: 'creer_projet',
    description: 'Crée un nouveau projet dans LES GRIOTS OS',
    inputSchema: {
      type: 'object',
      required: ['name', 'pillar'],
      properties: {
        name: { type: 'string', description: 'Nom du projet' },
        pillar: { type: 'string', description: 'STUDIO, PROD ou GRIOTHEQUE' },
        client: { type: 'string', description: 'Nom du client' },
        revenue: { type: 'number', description: 'Revenu HT en euros' },
        stage: { type: 'string', description: 'Stage initial (défaut: lead)' },
        notes: { type: 'string', description: 'Notes sur le projet' },
        startDate: { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Date de livraison (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'changer_stage',
    description: "Change le stage d'un projet (ex: passer en signed, active, delivered...)",
    inputSchema: {
      type: 'object',
      required: ['projectId', 'stage'],
      properties: {
        projectId: { type: 'string', description: 'ID du projet' },
        stage: { type: 'string', description: 'Nouveau stage : lead, need, qualify, quoted, negotiation, signed, active, delivered, paid, lost' },
      },
    },
  },
  {
    name: 'modifier_projet',
    description: "Modifie les champs d'un projet existant",
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string', description: 'ID du projet' },
        name: { type: 'string' },
        revenue: { type: 'number' },
        client: { type: 'string' },
        notes: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
    },
  },
  {
    name: 'generer_devis',
    description: "Génère le PDF du devis pour un projet Agence et retourne l'URL",
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string', description: 'ID du projet' },
      },
    },
  },
  {
    name: 'generer_facture',
    description: "Génère le PDF de la facture pour un projet Agence et retourne l'URL",
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string', description: 'ID du projet' },
      },
    },
  },

  // ── Clients ──
  {
    name: 'get_clients',
    description: 'Récupère tous les clients du répertoire avec leur CA et projets associés',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'creer_client',
    description: 'Ajoute un nouveau client dans le répertoire',
    inputSchema: {
      type: 'object',
      required: ['company'],
      properties: {
        company: { type: 'string', description: 'Nom de la société' },
        firstName: { type: 'string', description: 'Prénom du contact principal' },
        lastName: { type: 'string', description: 'Nom du contact principal' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        postalCode: { type: 'string' },
        city: { type: 'string' },
        siret: { type: 'string' },
      },
    },
  },

  // ── Prestataires ──
  {
    name: 'get_prestataires',
    description: 'Récupère tous les prestataires avec leurs compétences, TJM et note',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Tâches ──
  {
    name: 'get_taches',
    description: 'Récupère les tâches, optionnellement filtrées par projet',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID du projet pour filtrer les tâches' },
      },
    },
  },
  {
    name: 'creer_tache',
    description: 'Crée une nouvelle tâche dans un projet',
    inputSchema: {
      type: 'object',
      required: ['projectId', 'title'],
      properties: {
        projectId: { type: 'string', description: 'ID du projet' },
        title: { type: 'string', description: 'Titre de la tâche' },
        description: { type: 'string' },
        status: { type: 'string', description: 'todo, doing, done, blocked' },
        phase: { type: 'string', description: 'Phase du projet' },
        assigneeName: { type: 'string', description: 'Nom de la personne assignée' },
        dueDate: { type: 'string', description: 'Date limite (YYYY-MM-DD)' },
      },
    },
  },

  // ── Réglages (Settings) ──
  {
    name: 'get_reglages',
    description: "Récupère les paramètres de la société (SIRET, adresse, email, TVA, etc.)",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'modifier_reglages',
    description: "Met à jour un ou plusieurs paramètres de la société",
    inputSchema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        siret: { type: 'string' },
        siren: { type: 'string' },
        address: { type: 'string' },
        postal_code: { type: 'string' },
        city: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        tva_number: { type: 'string' },
        nda: { type: 'string' },
        representant_name: { type: 'string' },
        iban: { type: 'string' },
        bic: { type: 'string' },
        payment_terms: { type: 'string' },
      },
    },
  },

  // ── Griothèque — Formations ──
  {
    name: 'get_formations',
    description: 'Liste toutes les formations du catalogue La Griothèque avec stats (sessions, inscriptions)',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrer par statut : active, draft, archived' },
      },
    },
  },
  {
    name: 'creer_formation',
    description: 'Crée une nouvelle formation dans le catalogue La Griothèque',
    inputSchema: {
      type: 'object',
      required: ['title', 'duration_hours', 'price_ht'],
      properties: {
        title: { type: 'string', description: 'Titre de la formation' },
        duration_hours: { type: 'number', description: 'Durée en heures' },
        price_ht: { type: 'number', description: 'Prix HT en euros' },
        description: { type: 'string' },
        objectives: { type: 'string', description: 'Objectifs (JSON array)' },
        modality: { type: 'string', description: 'presentiel, distanciel, hybride' },
        level: { type: 'string' },
        max_participants: { type: 'number' },
        prerequisites: { type: 'string' },
        target_audience: { type: 'string' },
        accessibility: { type: 'string' },
      },
    },
  },

  // ── Griothèque — Sessions ──
  {
    name: 'get_sessions',
    description: 'Liste les sessions de formation avec infos formation, client et inscriptions',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrer par statut : planned, ongoing, completed, cancelled' },
        formation_id: { type: 'string', description: 'Filtrer par formation' },
      },
    },
  },
  {
    name: 'creer_session',
    description: 'Crée une session pour une formation existante',
    inputSchema: {
      type: 'object',
      required: ['formation_id', 'start_date', 'end_date'],
      properties: {
        formation_id: { type: 'string', description: 'ID de la formation' },
        start_date: { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Date de fin (YYYY-MM-DD)' },
        location: { type: 'string' },
        modality: { type: 'string', description: 'presentiel, distanciel, hybride' },
        max_participants: { type: 'number' },
        formateur_name: { type: 'string' },
        type_session: { type: 'string', description: 'INTRA ou INTER' },
        tarif: { type: 'number', description: 'Tarif HT' },
        adresse: { type: 'string' },
        horaire: { type: 'string', description: 'Ex: 9h-13h / 14h-18h' },
      },
    },
  },
  {
    name: 'generer_devis_session',
    description: "Génère le PDF du devis de formation (Griothèque) pour une session et retourne l'URL",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session' },
      },
    },
  },
  {
    name: 'generer_facture_session',
    description: "Génère le PDF de la facture de formation (Griothèque) pour une session et retourne l'URL",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session' },
      },
    },
  },

  // ── Griothèque — Livret d'Accueil & Convocation ──
  {
    name: 'generer_livret',
    description: "Génère le PDF du Livret d'Accueil & Convocation pour un apprenant inscrit à une session de formation. Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId', 'apprenantId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
        apprenantId: { type: 'string', description: "ID de l'apprenant" },
      },
    },
  },

  // ── Griothèque — Apprenants ──
  {
    name: 'get_apprenants',
    description: 'Liste les apprenants inscrits aux formations La Griothèque',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'inscrire_apprenant',
    description: "Inscrit un apprenant existant à une session de formation",
    inputSchema: {
      type: 'object',
      required: ['session_id', 'apprenant_id'],
      properties: {
        session_id: { type: 'string', description: 'ID de la session' },
        apprenant_id: { type: 'string', description: "ID de l'apprenant" },
        price_ht: { type: 'number', description: 'Prix HT pour cet apprenant' },
        financement: { type: 'string', description: 'Mode de financement (OPCO, CPF, etc.)' },
        status: { type: 'string', description: 'inscrit, confirme, annule, liste_attente' },
      },
    },
  },

  // ── Griothèque — Convention de Formation ──
  {
    name: 'generer_convention',
    description: "Génère le PDF de la Convention de Formation pour un apprenant/client inscrit à une session. Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId', 'apprenantId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
        apprenantId: { type: 'string', description: "ID de l'apprenant (représentant client)" },
      },
    },
  },

  // ── Griothèque — Attestation de fin de formation ──
  {
    name: 'generer_attestation',
    description: "Génère le PDF de l'Attestation de fin de formation pour un apprenant. Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId', 'apprenantId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
        apprenantId: { type: 'string', description: "ID de l'apprenant" },
      },
    },
  },

  // ── Griothèque — Certificat de réalisation ──
  {
    name: 'generer_certificat',
    description: "Génère le PDF du Certificat de Réalisation pour un apprenant (obligatoire Qualiopi). Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId', 'apprenantId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
        apprenantId: { type: 'string', description: "ID de l'apprenant" },
      },
    },
  },

  // ── Griothèque — Programme détaillé ──
  {
    name: 'generer_programme',
    description: "Génère le PDF du Programme Détaillé de la formation liée à une session. Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
      },
    },
  },

  // ── Griothèque — Feuille d'émargement ──
  {
    name: 'generer_emargement',
    description: "Génère le PDF de la Feuille d'Émargement pour une session. Modes : jour (1 page/jour), semaine (1 page/semaine), demi_journee (matin/après-midi séparés), session (récap sur 1 feuille), module (1 page/module), mensuel (1 page/mois). Retourne l'URL du PDF.",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session de formation' },
        mode: { type: 'string', enum: ['jour', 'semaine', 'demi_journee', 'session', 'module', 'mensuel'], description: "Mode d'émargement (défaut: jour)" },
      },
    },
  },

  // ── CRUD Formateurs ──
  {
    name: 'get_formateurs',
    description: 'Liste les formateurs de La Griothèque',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'creer_formateur',
    description: 'Crée un nouveau formateur',
    inputSchema: {
      type: 'object',
      required: ['firstName', 'lastName'],
      properties: {
        firstName: { type: 'string', description: 'Prénom' },
        lastName: { type: 'string', description: 'Nom' },
        email: { type: 'string' },
        phone: { type: 'string' },
        speciality: { type: 'string', description: 'Spécialité du formateur' },
        bio: { type: 'string', description: 'Biographie courte' },
      },
    },
  },

  // ── Modifier client ──
  {
    name: 'modifier_client',
    description: "Modifie les informations d'un client existant (nom, email, entreprise, SIRET, etc.)",
    inputSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: { type: 'string', description: 'ID du client' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        company: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        siret: { type: 'string' },
        address: { type: 'string' },
        postalCode: { type: 'string' },
        city: { type: 'string' },
      },
    },
  },

  // ── Créer apprenant ──
  {
    name: 'creer_apprenant',
    description: "Crée un nouvel apprenant dans la base La Griothèque",
    inputSchema: {
      type: 'object',
      required: ['firstName', 'lastName'],
      properties: {
        firstName: { type: 'string', description: 'Prénom' },
        lastName: { type: 'string', description: 'Nom' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        siret: { type: 'string' },
        address: { type: 'string' },
        postalCode: { type: 'string' },
        city: { type: 'string' },
      },
    },
  },

  // ── Modifier formation ──
  {
    name: 'modifier_formation',
    description: "Modifie une formation existante (titre, durée, prix, programme, etc.)",
    inputSchema: {
      type: 'object',
      required: ['formationId'],
      properties: {
        formationId: { type: 'string', description: 'ID de la formation' },
        title: { type: 'string' },
        description: { type: 'string' },
        duration_hours: { type: 'number' },
        duration_days: { type: 'number' },
        price_ht: { type: 'number' },
        modality: { type: 'string', description: 'presentiel, distanciel, hybride' },
        prerequisites: { type: 'string' },
        objectives: { type: 'string', description: 'JSON array of objectives' },
        target_audience: { type: 'string' },
      },
    },
  },

  // ── Modifier session ──
  {
    name: 'modifier_session',
    description: "Modifie une session de formation existante (dates, lieu, formateur, etc.)",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        location: { type: 'string' },
        adresse: { type: 'string' },
        formateur_id: { type: 'string' },
        status: { type: 'string', description: 'planifiee, en_cours, terminee, annulee' },
        horaire: { type: 'string' },
        max_participants: { type: 'number' },
      },
    },
  },

  // ── Évaluations ──
  {
    name: 'get_evaluations',
    description: "Liste les évaluations d'une session de formation. Types: positionnement, acquis, satisfaction (à chaud), froid (à froid).",
    inputSchema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'ID de la session' },
        type: { type: 'string', enum: ['positionnement', 'acquis', 'satisfaction', 'froid'], description: 'Type d\'évaluation' },
      },
    },
  },

  // ── Data.gouv.fr — API Sirene ──
  {
    name: 'recherche_siret',
    description: "Recherche une entreprise française par nom, SIRET ou SIREN via l'API Sirene (data.gouv.fr). Retourne raison sociale, SIRET, adresse, activité, effectifs, état.",
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: "Nom d'entreprise, SIRET ou SIREN à rechercher" },
        code_postal: { type: 'string', description: 'Filtrer par code postal (optionnel)' },
        limit: { type: 'number', description: 'Nombre de résultats max (défaut: 5)' },
      },
    },
  },
  {
    name: 'info_siret',
    description: "Récupère les informations détaillées d'une entreprise par SIRET (14 chiffres) ou SIREN (9 chiffres) : dirigeants, finances, établissements, adresse complète.",
    inputSchema: {
      type: 'object',
      required: ['siret'],
      properties: {
        siret: { type: 'string', description: 'Numéro SIRET (14 chiffres) ou SIREN (9 chiffres)' },
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────

async function executeTool(name, args) {
  log(`Executing tool: ${name}`, JSON.stringify(args));

  // ── Dashboard résumé ──
  if (name === 'resume_dashboard') {
    const data = await api('/api/data');
    const projects = data.projects || [];
    const WON = ['signed', 'active', 'delivered', 'paid'];
    const ACTIVE = ['active', 'signed'];
    const caConfirme = projects.filter(p => WON.includes(p.stage)).reduce((s, p) => s + (p.revenue || 0), 0);
    const pipeline = projects.filter(p => ['lead', 'need', 'qualify', 'quoted', 'negotiation'].includes(p.stage)).reduce((s, p) => s + (p.revenue || 0), 0);
    const actifs = projects.filter(p => ACTIVE.includes(p.stage));
    const aLivrer = projects.filter(p => p.stage === 'delivered');
    const aFacturer = projects.filter(p => p.stage === 'delivered' && (p.revenue || 0) > 0);
    const gs = data.griothequeStats || {};

    return {
      résumé: 'LES GRIOTS OS',
      date: new Date().toLocaleDateString('fr-FR'),
      agence: {
        caConfirméHT: `${caConfirme.toLocaleString('fr-FR')} €`,
        pipelinePotentiel: `${pipeline.toLocaleString('fr-FR')} €`,
        projetsActifs: actifs.map(p => `${p.code} — ${p.name} (${p.client || 'sans client'})`),
        projetsÀLivrer: aLivrer.map(p => `${p.code} — ${p.name}`),
        projetsÀFacturer: aFacturer.map(p => `${p.code} — ${p.name} — ${(p.revenue || 0).toLocaleString('fr-FR')} €`),
      },
      griothèque: {
        caConfirmé: `${(gs.caConfirmed || 0).toLocaleString('fr-FR')} €`,
        caPipeline: `${(gs.caPending || 0).toLocaleString('fr-FR')} €`,
        sessionsActives: gs.sessionsCount || 0,
        apprenants: gs.apprenantsCount || 0,
      },
      nbClients: (data.clients || []).length,
      nbPrestataires: (data.providers || []).length,
    };
  }

  // ── Projets ──
  if (name === 'get_projets') {
    const data = await api('/api/data');
    let projects = data.projects || [];
    if (args.stage) projects = projects.filter(p => p.stage === args.stage);
    if (args.pillar) projects = projects.filter(p => p.pillar === args.pillar);
    return projects.map(p => ({
      id: p.id, code: p.code, nom: p.name, client: p.client, pilier: p.pillar,
      stage: p.stage, revenuHT: p.revenue,
      depenses: (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      dateDebut: p.startDate, dateFin: p.endDate,
    }));
  }

  if (name === 'creer_projet') {
    const data = await api('/api/data');
    const id = `p_${Date.now()}`;
    const pillar = (args.pillar || 'STUDIO').toUpperCase();
    const existing = (data.projects || []).filter(p => p.pillar === pillar);
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = pillar === 'STUDIO' ? 'STU' : pillar === 'PROD' ? 'PRD' : 'GRT';
    const num = String(existing.length + 1).padStart(3, '0');
    const code = `${prefix}-${year}-${num}`;

    await api('/api/projects', 'POST', {
      id, code, name: args.name, pillar,
      client: args.client || '', revenue: args.revenue || 0,
      stage: args.stage || 'lead', notes: args.notes || '',
      startDate: args.startDate || '', endDate: args.endDate || '',
      tvaRate: '20',
    });
    return { ok: true, id, code, message: `Projet "${args.name}" créé avec le code ${code}` };
  }

  if (name === 'changer_stage') {
    await api(`/api/projects/${args.projectId}`, 'PUT', { stage: args.stage });
    return { ok: true, message: `Projet ${args.projectId} → ${args.stage}` };
  }

  if (name === 'modifier_projet') {
    const { projectId, ...fields } = args;
    await api(`/api/projects/${projectId}`, 'PUT', fields);
    return { ok: true, message: `Projet ${projectId} mis à jour` };
  }

  if (name === 'generer_devis') {
    const url = `${DASHBOARD_URL}/api/projects/${args.projectId}/devis`;
    return { ok: true, url, message: `Devis Agence prêt : ${url}` };
  }

  if (name === 'generer_facture') {
    const url = `${DASHBOARD_URL}/api/projects/${args.projectId}/facture`;
    return { ok: true, url, message: `Facture Agence prête : ${url}` };
  }

  // ── Clients ──
  if (name === 'get_clients') {
    const data = await api('/api/data');
    const WON = ['signed', 'active', 'delivered', 'paid'];
    return (data.clients || []).map(c => {
      const projs = (data.projects || []).filter(p =>
        WON.includes(p.stage) && (
          p.clientId === c.id ||
          (c.company && p.client && c.company.toLowerCase().includes(p.client.toLowerCase()))
        )
      );
      return {
        id: c.id, société: c.company, prénom: c.firstName, nom: c.lastName,
        email: c.email, ville: c.city, siret: c.siret || '',
        caTotal: projs.reduce((s, p) => s + (p.revenue || 0), 0),
        nbProjets: projs.length,
      };
    });
  }

  if (name === 'creer_client') {
    const id = `cli_${Date.now()}`;
    await api('/api/clients', 'POST', { id, ...args });
    return { ok: true, id, message: `Client "${args.company}" créé` };
  }

  // ── Prestataires ──
  if (name === 'get_prestataires') {
    const data = await api('/api/data');
    return (data.providers || []).map(p => ({
      id: p.id, prénom: p.firstName, nom: p.lastName, société: p.company,
      compétences: p.categories, tjmMin: p.tarifMin || p.tarifJour,
      tjmMax: p.tarifMax, note: p.rating, email: p.email, téléphone: p.phone,
    }));
  }

  // ── Tâches ──
  if (name === 'get_taches') {
    const qs = args.projectId ? `?projectId=${args.projectId}` : '';
    const tasks = await api(`/api/tasks${qs}`);
    return (tasks || []).map(t => ({
      id: t.id, projetId: t.projectId, titre: t.title, description: t.description,
      statut: t.status, phase: t.phase, assigné: t.assigneeName,
      dateLimite: t.dueDate,
    }));
  }

  if (name === 'creer_tache') {
    const result = await api('/api/tasks', 'POST', {
      projectId: args.projectId,
      title: args.title,
      description: args.description || '',
      status: args.status || 'todo',
      phase: args.phase || '',
      assigneeName: args.assigneeName || '',
      dueDate: args.dueDate || '',
    });
    return { ok: true, id: result.id, message: `Tâche "${args.title}" créée` };
  }

  // ── Réglages ──
  if (name === 'get_reglages') {
    return await api('/api/settings');
  }

  if (name === 'modifier_reglages') {
    const result = await api('/api/settings', 'PUT', args);
    return { ok: true, message: 'Réglages mis à jour', settings: result };
  }

  // ── Formations (Griothèque) ──
  if (name === 'get_formations') {
    const data = await api('/api/data');
    let formations = data.griothequeStats?.formations || [];
    if (args.status) formations = formations.filter(f => f.status === args.status);
    return formations.map(f => ({
      id: f.id, code: f.code, titre: f.title, durée_h: f.duration_hours,
      prix_ht: f.price_ht, modalité: f.modality, statut: f.status,
      sessions: f.sessions_count || 0, inscriptions: f.total_inscriptions || 0,
    }));
  }

  if (name === 'creer_formation') {
    const id = `form_${Date.now()}`;
    const body = { id, title: args.title, duration_hours: args.duration_hours, price_ht: args.price_ht };
    for (const k of ['description', 'objectives', 'modality', 'level', 'max_participants', 'prerequisites', 'target_audience', 'accessibility']) {
      if (args[k] !== undefined) body[k] = args[k];
    }
    const result = await api('/api/formations', 'POST', body);
    return { ok: true, id: result.id || id, message: `Formation "${args.title}" créée` };
  }

  // ── Sessions (Griothèque) ──
  if (name === 'get_sessions') {
    const data = await api('/api/data');
    let sessions = data.griothequeStats?.sessions || [];
    if (args.status) sessions = sessions.filter(s => s.status === args.status);
    if (args.formation_id) sessions = sessions.filter(s => s.formation_id === args.formation_id);
    return sessions.map(s => ({
      id: s.id, code_interne: s.code_interne, formation: s.formation_title,
      formation_code: s.formation_code, début: s.start_date, fin: s.end_date,
      type: s.type_session || 'INTER', client: s.client_company,
      inscrits: s.inscriptions_count || 0, statut: s.status,
      lieu: s.adresse || s.location,
    }));
  }

  if (name === 'creer_session') {
    const id = `sess_${Date.now()}`;
    const body = { id, formation_id: args.formation_id, start_date: args.start_date, end_date: args.end_date };
    for (const k of ['location', 'modality', 'max_participants', 'formateur_name', 'type_session', 'tarif', 'adresse', 'horaire']) {
      if (args[k] !== undefined) body[k] = args[k];
    }
    const result = await api('/api/sessions', 'POST', body);
    return { ok: true, id: result.id || id, message: `Session créée du ${args.start_date} au ${args.end_date}` };
  }

  if (name === 'generer_devis_session') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/devis`;
    return { ok: true, url, message: `Devis formation (Griothèque) prêt : ${url}` };
  }

  if (name === 'generer_facture_session') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/facture`;
    return { ok: true, url, message: `Facture formation (Griothèque) prête : ${url}` };
  }

  // ── Livret d'Accueil & Convocation ──
  if (name === 'generer_livret') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/livret?apprenant_id=${args.apprenantId}`;
    // Verify the PDF generates successfully
    try {
      const res = await fetch(url, { headers: apiHeaders(), signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Erreur génération livret (${res.status}): ${errText.slice(0, 200)}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('pdf')) {
        throw new Error(`Réponse inattendue (${contentType}). Vérifiez que python3 et reportlab sont installés.`);
      }
      return { ok: true, url, message: `Livret d'Accueil & Convocation prêt : ${url}` };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error(`Timeout: la génération du livret a pris trop de temps. Vérifiez le serveur.`);
      }
      throw err;
    }
  }

  // ── Convention de Formation ──
  if (name === 'generer_convention') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/convention?apprenant_id=${args.apprenantId}`;
    try {
      const res = await fetch(url, { headers: apiHeaders(), signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Erreur génération convention (${res.status}): ${errText.slice(0, 200)}`);
      }
      return { ok: true, url, message: `Convention de Formation prête : ${url}` };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('Timeout génération convention');
      throw err;
    }
  }

  // ── Attestation de fin de formation ──
  if (name === 'generer_attestation') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/attestation?apprenant_id=${args.apprenantId}`;
    try {
      const res = await fetch(url, { headers: apiHeaders(), signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Erreur génération attestation (${res.status}): ${errText.slice(0, 200)}`);
      }
      return { ok: true, url, message: `Attestation de fin de formation prête : ${url}` };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('Timeout génération attestation');
      throw err;
    }
  }

  // ── Certificat de réalisation ──
  if (name === 'generer_certificat') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/certificat?apprenant_id=${args.apprenantId}`;
    try {
      const res = await fetch(url, { headers: apiHeaders(), signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Erreur génération certificat (${res.status}): ${errText.slice(0, 200)}`);
      }
      return { ok: true, url, message: `Certificat de Réalisation prêt : ${url}` };
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('Timeout génération certificat');
      throw err;
    }
  }

  // ── Programme détaillé ──
  if (name === 'generer_programme') {
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/programme`;
    return { ok: true, url, message: `Programme Détaillé prêt : ${url}` };
  }

  // ── Feuille d'émargement ──
  if (name === 'generer_emargement') {
    const mode = args.mode || 'jour';
    const url = `${DASHBOARD_URL}/api/sessions/${args.sessionId}/emargement?mode=${mode}`;
    const modeLabels = { jour: 'par jour', semaine: 'par semaine', demi_journee: 'par demi-journée', session: 'session complète', module: 'par module', mensuel: 'mensuel' };
    return { ok: true, url, mode, message: `Feuille d'Émargement (${modeLabels[mode] || mode}) prête : ${url}` };
  }

  // ── Formateurs ──
  if (name === 'get_formateurs') {
    try {
      const formateurs = await api('/api/formateurs');
      return (formateurs || []).map(f => ({
        id: f.id, prénom: f.first_name, nom: f.last_name, email: f.email,
        téléphone: f.phone, spécialité: f.speciality,
      }));
    } catch {
      return [];
    }
  }

  if (name === 'creer_formateur') {
    const id = `form_${Date.now()}`;
    const body = {
      id,
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email || '',
      phone: args.phone || '',
      speciality: args.speciality || '',
      bio: args.bio || '',
    };
    const result = await api('/api/formateurs', 'POST', body);
    return { ok: true, id: result.id || id, message: `Formateur ${args.firstName} ${args.lastName} créé` };
  }

  // ── Modifier client ──
  if (name === 'modifier_client') {
    const { clientId, ...fields } = args;
    await api(`/api/clients/${clientId}`, 'PUT', fields);
    return { ok: true, message: `Client ${clientId} mis à jour` };
  }

  // ── Créer apprenant ──
  if (name === 'creer_apprenant') {
    const id = `app_${Date.now()}`;
    const body = {
      id,
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email || '',
      phone: args.phone || '',
      company: args.company || '',
      siret: args.siret || '',
      address: args.address || '',
      postal_code: args.postalCode || '',
      city: args.city || '',
    };
    const result = await api('/api/apprenants', 'POST', body);
    return { ok: true, id: result.id || id, message: `Apprenant ${args.firstName} ${args.lastName} créé` };
  }

  // ── Modifier formation ──
  if (name === 'modifier_formation') {
    const { formationId, ...fields } = args;
    await api(`/api/formations/${formationId}`, 'PUT', fields);
    return { ok: true, message: `Formation ${formationId} mise à jour` };
  }

  // ── Modifier session ──
  if (name === 'modifier_session') {
    const { sessionId, ...fields } = args;
    await api(`/api/sessions/${sessionId}`, 'PUT', fields);
    return { ok: true, message: `Session ${sessionId} mise à jour` };
  }

  // ── Évaluations ──
  if (name === 'get_evaluations') {
    try {
      let url = `/api/evaluations?session_id=${args.sessionId}`;
      if (args.type) url += `&type=${args.type}`;
      const evals = await api(url);
      return evals || [];
    } catch {
      return [];
    }
  }

  // ── Apprenants ──
  if (name === 'get_apprenants') {
    try {
      const apprenants = await api('/api/apprenants');
      return (apprenants || []).map(a => ({
        id: a.id, prénom: a.first_name, nom: a.last_name, email: a.email,
        téléphone: a.phone, entreprise: a.company, ville: a.city,
      }));
    } catch {
      return [];
    }
  }

  if (name === 'inscrire_apprenant') {
    const id = `insc_${Date.now()}`;
    const body = { id, session_id: args.session_id, apprenant_id: args.apprenant_id };
    for (const k of ['price_ht', 'financement', 'status']) {
      if (args[k] !== undefined) body[k] = args[k];
    }
    const result = await api('/api/inscriptions', 'POST', body);
    return { ok: true, id: result.id || id, message: 'Apprenant inscrit à la session' };
  }

  // ── Data.gouv.fr — API Sirene (pas besoin de l'OS) ──
  if (name === 'recherche_siret') {
    const q = args.query;
    if (!q) throw new Error('Paramètre "query" requis');
    const params = new URLSearchParams({ q, per_page: String(args.limit || 5) });
    if (args.code_postal) params.set('code_postal', args.code_postal);
    const url = `https://recherche-entreprises.api.gouv.fr/search?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`API Sirene erreur ${res.status}`);
    const result = await res.json();
    return (result.results || []).map(e => ({
      siren: e.siren,
      siret_siege: e.siege?.siret || '',
      nom: e.nom_complet || e.nom_raison_sociale || '',
      nature_juridique: e.nature_juridique || '',
      activite_principale: e.activite_principale || '',
      date_creation: e.date_creation || '',
      etat: e.etat_administratif === 'A' ? 'Active' : 'Fermée',
      adresse: e.siege ? `${e.siege.adresse || ''}, ${e.siege.code_postal || ''} ${e.siege.commune || ''}` : '',
      code_postal: e.siege?.code_postal || '',
    }));
  }

  if (name === 'info_siret') {
    const siret = (args.siret || '').replace(/\s/g, '');
    if (!siret || siret.length < 9) throw new Error('SIRET (14 chiffres) ou SIREN (9 chiffres) requis');
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`API Sirene erreur ${res.status}`);
    const result = await res.json();
    if (!result.results || result.results.length === 0) throw new Error(`Aucun résultat pour ${siret}`);
    const e = result.results[0];
    const siege = e.siege || {};
    return {
      siren: e.siren,
      siret_siege: siege.siret || '',
      nom_complet: e.nom_complet || '',
      nature_juridique: e.nature_juridique || '',
      activite_principale: e.activite_principale || '',
      date_creation: e.date_creation || '',
      etat: e.etat_administratif === 'A' ? 'Active' : 'Fermée',
      adresse_siege: `${siege.numero_voie || ''} ${siege.type_voie || ''} ${siege.libelle_voie || ''}`.trim(),
      code_postal: siege.code_postal || '',
      commune: siege.commune || '',
      dirigeants: (e.dirigeants || []).map(d => ({
        nom: `${d.prenom || ''} ${d.nom || ''}`.trim(),
        qualite: d.qualite || '',
      })),
      finances: e.finances ? { ca: e.finances.ca, resultat: e.finances.resultat_net, annee: e.finances.annee_cloture } : null,
    };
  }

  throw new Error(`Outil inconnu : ${name}`);
}

// ── Message router ────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const { method, id, params } = msg;

  // ── Lifecycle ──
  if (method === 'initialize') {
    log('Client connected, protocol version:', params?.protocolVersion);
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'lesgriots-os', version: '2.0.0' },
      },
    });
    return;
  }

  // ── Notifications (no id → no response) ──
  if (method === 'notifications/initialized') {
    log('Client initialized successfully');
    return;
  }

  // Ignore any other notification (no id)
  if (id === undefined || id === null) {
    log('Notification (ignored):', method);
    return;
  }

  // ── Tools ──
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    try {
      const result = await executeTool(name, toolArgs || {});
      send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      });
    } catch (err) {
      log(`Tool ${name} error:`, err.message);
      send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `Erreur : ${err.message}` }], isError: true },
      });
    }
    return;
  }

  // ── Resources (empty — no resources exposed) ──
  if (method === 'resources/list') {
    send({ jsonrpc: '2.0', id, result: { resources: [] } });
    return;
  }

  // ── Prompts (empty — no prompts exposed) ──
  if (method === 'prompts/list') {
    send({ jsonrpc: '2.0', id, result: { prompts: [] } });
    return;
  }

  // ── Ping ──
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  // ── Unknown method ──
  log('Unknown method:', method);
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

log(`LES GRIOTS OS MCP Server v2.0 started — target: ${DASHBOARD_URL}`);

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

// ── Status mapping tables ──
const SESSION_STATUS_MAP = {
  'Préparation': 'planned',
  'Session prete': 'planned',
  'Inscription ouverte': 'planned',
  'En cours': 'ongoing',
  'Terminé': 'completed',
};

const APPRENANT_ETAT_MAP = {
  'New': 'new',
  'Mail préinscription envoyé': 'preinscription_sent',
  'Positionnement ok': 'positionnement_ok',
  'Document généré': 'doc_generated',
  'Documents envoyé': 'doc_sent',
  'Document signé': 'doc_signed',
  'Terminé': 'completed',
  'Refusé': 'refused',
};

const APPRENANT_STATUT_FIN_MAP = {
  'Not started': 'not_started',
  'Refusée': 'refused',
  'In progress': 'in_progress',
  'Done': 'done',
};

const FORMATION_STATUS_MAP = {
  'Active': 'active',
  'Brouillon': 'draft',
  'Archivée': 'archived',
};

const FORMATION_MODALITY_MAP = {
  'Présentiel': 'presentiel',
  'Distanciel': 'distanciel',
  'Hybride': 'hybride',
};

// ── Helper: extract page ID from Notion URL ──
function notionPageId(url) {
  if (!url) return null;
  // URLs look like https://www.notion.so/31b077f91ed881578d9eec63e5f5a49c
  const m = url.match(/([a-f0-9]{32})$/);
  if (m) {
    const raw = m[1];
    return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
  }
  return url;
}

// ── Helper: safely JSON-stringify arrays ──
function toJsonArray(val) {
  if (!val) return '[]';
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? val : '[]'; } catch { return '[]'; }
  }
  return '[]';
}

// ── Helper: checkbox to integer ──
function checkboxToInt(val) {
  if (val === '__YES__' || val === true || val === 1) return 1;
  return 0;
}

// ── IMPORT FORMATIONS ──
function importFormations(db, formations, notionUrlToOsId) {
  const stats = { inserted: 0, updated: 0, skipped: 0 };

  for (const f of formations) {
    const props = f.properties;
    const notionUrl = props.url || f.url;

    // Check if already synced
    const existing = db.prepare(
      "SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'formation'"
    ).get(notionUrl);

    const code = props['Code'] || '';
    const title = props['Formation'] || f.title || '';

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE formations SET
          title = ?, code = CASE WHEN ? != '' THEN ? ELSE code END,
          price_ht = ?, max_participants = ?, format_label = ?,
          thematique = ?, certification = ?,
          financement_eligible = ?, target_audience = ?,
          probleme_resolu = ?, livrables_cles = ?,
          description = CASE WHEN ? != '' THEN ? ELSE description END,
          modality = ?, niveau = ?,
          notion_page_url = ?
        WHERE id = ?
      `).run(
        title, code, code,
        props['Prix (€)'] || 0, props['Participants max'] || 12, props['Format'] || '',
        props['Thématique'] || '', props['Certification'] || 'Aucune',
        toJsonArray(props['Financement']), toJsonArray(props['Cibles']),
        props['Problème résolu'] || '', props['Livrables clés'] || '',
        props['Description'] || '', props['Description'] || '',
        FORMATION_MODALITY_MAP[props['Modalité']] || 'presentiel',
        props['Niveau'] || '',
        notionUrl,
        existing.os_id
      );
      notionUrlToOsId[notionUrl] = existing.os_id;
      stats.updated++;
    } else {
      // Insert new
      const id = randomUUID();
      // Generate code if empty
      const finalCode = code || `NI-${Date.now().toString(36).toUpperCase()}`;

      // Ensure code uniqueness
      const codeExists = db.prepare("SELECT id FROM formations WHERE code = ?").get(finalCode);
      if (codeExists) {
        notionUrlToOsId[notionUrl] = codeExists.id;
        stats.skipped++;
        continue;
      }

      db.prepare(`
        INSERT INTO formations (
          id, code, title, description, objectives, duration_hours, duration_days,
          modality, level, price_ht, max_participants, prerequisites,
          evaluation_methods, target_audience, accessibility, status,
          thematique, certification, financement_eligible, probleme_resolu,
          livrables_cles, format_label, notion_page_url
        ) VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, '', '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, finalCode, title,
        props['Description'] || '',
        props['Durée (h)'] || 0, props['Durée (j)'] || 0,
        FORMATION_MODALITY_MAP[props['Modalité']] || 'presentiel',
        props['Niveau'] || '',
        props['Prix (€)'] || 0, props['Participants max'] || 12,
        toJsonArray(props['Cibles']),
        props['Accessibilité'] || '',
        FORMATION_STATUS_MAP[props['Statut']] || 'active',
        props['Thématique'] || '', props['Certification'] || 'Aucune',
        toJsonArray(props['Financement']),
        props['Problème résolu'] || '', props['Livrables clés'] || '',
        props['Format'] || '',
        notionUrl
      );

      // Register in sync map
      db.prepare(`
        INSERT OR REPLACE INTO notion_sync_map (id, entity_type, os_id, notion_page_url, notion_collection_id, last_synced_at, sync_direction)
        VALUES (?, 'formation', ?, ?, '0c7e6dfc-ae95-4852-848f-d254fd30e9ba', datetime('now'), 'notion_to_os')
      `).run(randomUUID(), id, notionUrl);

      notionUrlToOsId[notionUrl] = id;
      stats.inserted++;
    }
  }
  return stats;
}

// ── IMPORT FORMATEURS ──
function importFormateurs(db, formateurs, notionUrlToOsId) {
  const stats = { inserted: 0, updated: 0, skipped: 0 };

  for (const f of formateurs) {
    const props = f.properties;
    const notionUrl = props.url || f.url;

    const existing = db.prepare(
      "SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'formateur'"
    ).get(notionUrl);

    // Split "Nom Prénom" from Notion title
    const fullName = props['Nom'] || f.title || '';
    const parts = fullName.split(' ');
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';

    if (existing) {
      db.prepare(`
        UPDATE formateurs SET
          first_name = ?, last_name = ?, email = ?,
          phone = ?, biographie = ?, qualifications = ?,
          domaines = ?, specialite = ?,
          statut_juridique = ?, statut_collab = ?,
          evaluation = ?, feedback_interne = ?,
          tarif_jour = ?,
          notion_page_url = ?
        WHERE id = ?
      `).run(
        firstName, lastName, props['Email'] || '',
        props['Phone'] || '', props['Biographie'] || '', props['Qualifications / Diplômes'] || '',
        toJsonArray(props["Domaines d'intervention"]), toJsonArray(props['Spécialité']),
        props['Statut'] || '', props['Statut collaboration'] || 'actif',
        props['Evaluation'] || '', props['Feebck interne'] || '',
        props['Tarif jour (€)'] || 0,
        notionUrl,
        existing.os_id
      );
      notionUrlToOsId[notionUrl] = existing.os_id;
      stats.updated++;
    } else {
      const id = randomUUID();

      db.prepare(`
        INSERT INTO formateurs (
          id, first_name, last_name, email, phone, biographie, qualifications,
          domaines, specialite, statut_juridique, statut_collab,
          evaluation, feedback_interne, tarif_jour,
          date_dernier_dev_pro, notion_page_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, firstName, lastName, props['Email'] || '',
        props['Phone'] || '', props['Biographie'] || '', props['Qualifications / Diplômes'] || '',
        toJsonArray(props["Domaines d'intervention"]), toJsonArray(props['Spécialité']),
        props['Statut'] || '', props['Statut collaboration'] || 'actif',
        props['Evaluation'] || '', props['Feebck interne'] || '',
        props['Tarif jour (€)'] || 0,
        props['date:Date dernier dev. pro:start'] || '',
        notionUrl
      );

      db.prepare(`
        INSERT OR REPLACE INTO notion_sync_map (id, entity_type, os_id, notion_page_url, notion_collection_id, last_synced_at, sync_direction)
        VALUES (?, 'formateur', ?, ?, '241077f9-1ed8-8196-9a4a-000b729abc5c', datetime('now'), 'notion_to_os')
      `).run(randomUUID(), id, notionUrl);

      notionUrlToOsId[notionUrl] = id;
      stats.inserted++;
    }
  }
  return stats;
}

// ── IMPORT SESSIONS ──
function importSessions(db, sessions, notionUrlToOsId) {
  const stats = { inserted: 0, updated: 0, skipped: 0 };

  for (const s of sessions) {
    const props = s.properties;
    const notionUrl = props.url || s.url;

    const existing = db.prepare(
      "SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'session'"
    ).get(notionUrl);

    // Resolve formation_id from Notion relation
    let formationId = null;
    const formationRel = props['FORMATION'];
    if (Array.isArray(formationRel) && formationRel.length > 0) {
      const formNotionUrl = formationRel[0];
      formationId = notionUrlToOsId[formNotionUrl] || null;
    }

    // Resolve formateur_id from Notion relation
    let formateurId = null;
    let formateurName = '';
    const formateurRel = props['Formateurs'];
    if (Array.isArray(formateurRel) && formateurRel.length > 0) {
      const fmtNotionUrl = formateurRel[0];
      formateurId = notionUrlToOsId[fmtNotionUrl] || null;
      if (formateurId) {
        const fmt = db.prepare("SELECT first_name, last_name FROM formateurs WHERE id = ?").get(formateurId);
        if (fmt) formateurName = `${fmt.first_name} ${fmt.last_name}`.trim();
      }
    }

    // Skip sessions without a resolved formation
    if (!formationId) {
      // Try to find by session name in formations
      stats.skipped++;
      continue;
    }

    const sessionName = (props['Nom de la session'] || s.title || '').replace(/\*\*/g, '').trim();
    const startDate = props['date:Date:start'] || '';
    const endDate = props['date:Date:end'] || startDate;
    const status = SESSION_STATUS_MAP[props['Statut']] || 'planned';

    if (existing) {
      db.prepare(`
        UPDATE sessions SET
          session_name = ?, formation_id = ?,
          start_date = ?, end_date = ?,
          status = ?, type_session = ?,
          tarif = ?, adresse = ?, horaire = ?,
          notes = ?, formateur_id = ?, formateur_name = ?,
          code_interne = ?,
          notion_page_url = ?
        WHERE id = ?
      `).run(
        sessionName, formationId,
        startDate, endDate,
        status, props['Type'] || 'INTER',
        props['Tarif'] || 0, props['Adresse'] || '', props['Horaire '] || '',
        props['Observations'] || '', formateurId, formateurName,
        props['Identifiant'] ? `NS${String(props['Identifiant']).padStart(3, '0')}` : '',
        notionUrl,
        existing.os_id
      );
      notionUrlToOsId[notionUrl] = existing.os_id;
      stats.updated++;
    } else {
      const id = randomUUID();
      const codeInterne = props['Identifiant'] ? `NS${String(props['Identifiant']).padStart(3, '0')}` : '';

      db.prepare(`
        INSERT INTO sessions (
          id, formation_id, start_date, end_date, location, modality,
          max_participants, status, formateur_id, formateur_name, notes,
          type_session, horaire, tarif, adresse, code_interne, session_name,
          notion_page_url
        ) VALUES (?, ?, ?, ?, ?, 'presentiel', 12, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, formationId, startDate || new Date().toISOString().split('T')[0], endDate || startDate || new Date().toISOString().split('T')[0],
        props['Adresse'] || '',
        status, formateurId, formateurName,
        props['Observations'] || '',
        props['Type'] || 'INTER', props['Horaire '] || '',
        props['Tarif'] || 0, props['Adresse'] || '',
        codeInterne, sessionName,
        notionUrl
      );

      db.prepare(`
        INSERT OR REPLACE INTO notion_sync_map (id, entity_type, os_id, notion_page_url, notion_collection_id, last_synced_at, sync_direction)
        VALUES (?, 'session', ?, ?, '241077f9-1ed8-81b4-86c1-000b633ddd62', datetime('now'), 'notion_to_os')
      `).run(randomUUID(), id, notionUrl);

      notionUrlToOsId[notionUrl] = id;
      stats.inserted++;
    }
  }
  return stats;
}

// ── IMPORT APPRENANTS ──
function importApprenants(db, apprenants, notionUrlToOsId) {
  const stats = { inserted: 0, updated: 0, skipped: 0, inscriptions: 0 };

  for (const a of apprenants) {
    const props = a.properties;
    const notionUrl = props.url || a.url;

    const existing = db.prepare(
      "SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'apprenant'"
    ).get(notionUrl);

    const lastName = props['Nom'] || a.title || '';
    const firstName = props['Prénom'] || '';

    // Skip test/empty entries
    if (!lastName || lastName.toLowerCase().includes('test') || lastName.toLowerCase().includes('type ') || lastName.toLowerCase().includes('positionnement')) {
      stats.skipped++;
      continue;
    }

    const apprenantData = {
      first_name: firstName,
      last_name: lastName,
      email: props['Email Address'] || '',
      phone: props['Téléphone'] || '',
      company: props['Entreprise'] || '',
      address: props['Adresse perso'] || '',
      postal_code: props['CP perso'] ? String(Math.round(props['CP perso'])) : '',
      city: props['Ville perso'] || '',
      financement: props['Financement'] || '',
      notes: props['Precision/besoins/autre'] || '',
      date_naissance: props['date:Date de naissance:start'] || '',
      situation_pro: props['Situation Pro'] || '',
      statut_juridique: props['Statut jurique'] || '',
      handicap: checkboxToInt(props['Handicap']),
      precision_handicap: props['Precision Handicap'] || '',
      experience: checkboxToInt(props['Experience']),
      niveau_exp: props['Niveau exp'] || '',
      motivation: props['Motivation'] || '',
      modalite_paiement: props['Modalité de paiement'] || '',
      connu_comment: toJsonArray(props['Connu comment']),
      reseaux: toJsonArray(props['Réseaux']),
      etat: APPRENANT_ETAT_MAP[props['Etat']] || 'new',
      etat_relance: toJsonArray(props['Etat relance']),
      orga_opco: props['Orga'] || '',
      faf: props['FAF'] || '',
      statut_financement: APPRENANT_STATUT_FIN_MAP[props['Statut Fianncement ']] || 'not_started',
      financement_entreprise: checkboxToInt(props['Financement par entreprise ']),
      siret: props['Siret'] ? String(Math.round(props['Siret'])) : '',
      entreprise_adresse: props['Adresse pro'] || '',
      entreprise_cp: props['CP pro'] ? String(Math.round(props['CP pro'])) : '',
      entreprise_ville: props['Ville pro'] || '',
      entreprise_tel: props['Tel entreprise'] || '',
      email_referent: props['E-mail Referent'] || '',
      nom_referent: props['Nom referent'] || '',
      dossier_url: props['Dossier stagiaire'] || '',
      lien_calendly: props['Lien calendly'] || '',
      date_positionnement: props['date:Date positionnement:start'] || '',
      date_envoi_doc: props['date:Date envoi doc:start'] || '',
      date_inscription: props["date:Date d'inscription:start"] || '',
      civilite: props['Civilité'] || '',
      nationalite: props['Nationalité'] || '',
      lieu_naissance_ville: props['Lieu naissance'] || '',
      langue: props['Langue'] || '',
      autres_situation_pro: props['Autres Situation Pro'] || '',
      autres_statut_juridique: props['Autres Statut juridique'] || '',
      date_selectionne: toJsonArray(props['Date sélectionné']),
      path_dropbox: props['Path lower dropbox'] || '',
      positionnement_decision: props['Décision positionnement'] || '',
      positionnement_notes: props['Notes positionnement'] || '',
      positionnement_amenagements: props['Aménagements'] || '',
    };

    let apprenantId;

    if (existing) {
      apprenantId = existing.os_id;
      const setClauses = Object.keys(apprenantData).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE apprenants SET ${setClauses}, notion_page_url = ? WHERE id = ?`).run(
        ...Object.values(apprenantData), notionUrl, apprenantId
      );
      notionUrlToOsId[notionUrl] = apprenantId;
      stats.updated++;
    } else {
      apprenantId = randomUUID();
      const cols = ['id', ...Object.keys(apprenantData), 'notion_page_url'];
      const placeholders = cols.map(() => '?').join(', ');
      db.prepare(`INSERT INTO apprenants (${cols.join(', ')}) VALUES (${placeholders})`).run(
        apprenantId, ...Object.values(apprenantData), notionUrl
      );

      db.prepare(`
        INSERT OR REPLACE INTO notion_sync_map (id, entity_type, os_id, notion_page_url, notion_collection_id, last_synced_at, sync_direction)
        VALUES (?, 'apprenant', ?, ?, '241077f9-1ed8-8193-a41c-000b0ca0bfa2', datetime('now'), 'notion_to_os')
      `).run(randomUUID(), apprenantId, notionUrl);

      notionUrlToOsId[notionUrl] = apprenantId;
      stats.inserted++;
    }

    // Create inscriptions from session relations
    const sessionRel = props['Sessions assginés '];
    if (sessionRel) {
      const sessionUrls = typeof sessionRel === 'string' ? [sessionRel] : (Array.isArray(sessionRel) ? sessionRel : []);
      for (const sessionUrl of sessionUrls) {
        const sessionId = notionUrlToOsId[sessionUrl];
        if (!sessionId) continue;

        // Check if inscription exists
        const existingInsc = db.prepare(
          "SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?"
        ).get(sessionId, apprenantId);

        if (!existingInsc) {
          db.prepare(`
            INSERT INTO inscriptions (id, session_id, apprenant_id, status, financement, price_ht)
            VALUES (?, ?, ?, 'inscrit', ?, 0)
          `).run(randomUUID(), sessionId, apprenantId, apprenantData.financement);
          stats.inscriptions++;
        }
      }
    }
  }
  return stats;
}

// ── POST handler ──
async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const { formations = [], formateurs = [], sessions = [], apprenants = [] } = body;

    // Map Notion URLs → OS IDs (for resolving relations)
    const notionUrlToOsId = {};

    // Pre-populate with existing sync map entries
    const existingMappings = db.prepare("SELECT notion_page_url, os_id FROM notion_sync_map").all();
    for (const m of existingMappings) {
      notionUrlToOsId[m.notion_page_url] = m.os_id;
    }

    // Import order matters: formations & formateurs first (no dependencies),
    // then sessions (depend on formations & formateurs),
    // then apprenants (depend on sessions for inscriptions)
    const results = db.transaction(() => {
      const fStats = importFormations(db, formations, notionUrlToOsId);
      const fmtStats = importFormateurs(db, formateurs, notionUrlToOsId);
      const sStats = importSessions(db, sessions, notionUrlToOsId);
      const aStats = importApprenants(db, apprenants, notionUrlToOsId);

      return {
        formations: fStats,
        formateurs: fmtStats,
        sessions: sStats,
        apprenants: aStats,
        sync_map_entries: db.prepare("SELECT COUNT(*) as cnt FROM notion_sync_map").get().cnt,
      };
    })();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (e) {
    console.error('Notion sync error:', e);
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}

// ── GET handler: return sync status ──
async function _GET() {
  try {
    const db = getDb();
    const syncMap = db.prepare(`
      SELECT entity_type, COUNT(*) as count, MAX(last_synced_at) as last_sync
      FROM notion_sync_map
      GROUP BY entity_type
    `).all();

    const totals = {
      formations: db.prepare("SELECT COUNT(*) as cnt FROM formations").get().cnt,
      sessions: db.prepare("SELECT COUNT(*) as cnt FROM sessions").get().cnt,
      apprenants: db.prepare("SELECT COUNT(*) as cnt FROM apprenants").get().cnt,
      formateurs: db.prepare("SELECT COUNT(*) as cnt FROM formateurs").get().cnt,
      inscriptions: db.prepare("SELECT COUNT(*) as cnt FROM inscriptions").get().cnt,
    };

    return NextResponse.json({ sync_map: syncMap, totals });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('settings:update', _POST);
export const GET = withGuard('settings:read', _GET);

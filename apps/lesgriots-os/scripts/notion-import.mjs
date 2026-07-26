#!/usr/bin/env node
/**
 * Notion → OS Import Script (Phase 1)
 * Reads a JSON payload from stdin and writes to SQLite.
 * Usage: node scripts/notion-import.mjs < data.json
 */

import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'lesgriots.db');
console.log(`[import] Using DB: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read JSON from first argument (file path)
const jsonPath = process.argv[2];
if (!jsonPath) { console.error('Usage: node scripts/notion-import.mjs <data.json>'); process.exit(1); }
const payload = JSON.parse(readFileSync(jsonPath, 'utf8'));

// ── Status mapping ──
const SESSION_STATUS = { 'Préparation': 'planned', 'Session prete': 'planned', 'Inscription ouverte': 'planned', 'En cours': 'ongoing', 'Terminé': 'completed' };
const APPRENANT_ETAT = { 'New': 'new', 'Mail préinscription envoyé': 'preinscription_sent', 'Positionnement ok': 'positionnement_ok', 'Document généré': 'doc_generated', 'Documents envoyé': 'doc_sent', 'Document signé': 'doc_signed', 'Terminé': 'completed', 'Refusé': 'refused' };
const APPRENANT_FIN = { 'Not started': 'not_started', 'Refusée': 'refused', 'In progress': 'in_progress', 'Done': 'done' };
const FORM_STATUS = { 'Active': 'active', 'Brouillon': 'draft', 'Archivée': 'archived' };
const MODALITY = { 'Présentiel': 'presentiel', 'Distanciel': 'distanciel', 'Hybride': 'hybride' };

const toJson = v => { if (!v) return '[]'; if (Array.isArray(v)) return JSON.stringify(v); return '[]'; };
const chk = v => (v === '__YES__' || v === true || v === 1) ? 1 : 0;

// Map Notion URLs → OS IDs
const urlMap = {};
// Pre-populate from existing sync map
try {
  const existing = db.prepare("SELECT notion_page_url, os_id FROM notion_sync_map").all();
  for (const m of existing) urlMap[m.notion_page_url] = m.os_id;
} catch { /* table may not exist yet */ }

// Create notion_sync_map table if it doesn't exist
try {
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
} catch (e) { console.warn('[warn] notion_sync_map table creation failed:', e.message); }

function syncMapInsert(entityType, osId, notionUrl, collectionId) {
  try {
    db.prepare(`INSERT OR REPLACE INTO notion_sync_map (id, entity_type, os_id, notion_page_url, notion_collection_id, last_synced_at, sync_direction) VALUES (?, ?, ?, ?, ?, datetime('now'), 'notion_to_os')`).run(randomUUID(), entityType, osId, notionUrl, collectionId);
  } catch (e) { console.warn(`  [warn] sync_map insert failed: ${e.message}`); }
}

// ── FORMATIONS ──
console.log('\n=== FORMATIONS ===');
let fInserted = 0, fUpdated = 0, fSkipped = 0;
for (const f of payload.formations || []) {
  const p = f.properties;
  const url = p.url || f.url;
  const title = p['Formation'] || f.title || '';
  const code = p['Code'] || '';

  // Check by code first
  const byCode = code ? db.prepare("SELECT id FROM formations WHERE code = ?").get(code) : null;
  // Check by sync map
  const bySyncMap = db.prepare("SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'formation'").pluck().get(url);

  if (byCode || bySyncMap) {
    const existingId = bySyncMap || byCode.id;
    db.prepare(`UPDATE formations SET title=?, price_ht=?, max_participants=?, format_label=?, thematique=?, certification=?, financement_eligible=?, target_audience=?, probleme_resolu=?, livrables_cles=?, notion_page_url=? WHERE id=?`).run(
      title, p['Prix (€)']||0, p['Participants max']||12, p['Format']||'', p['Thématique']||'', p['Certification']||'Aucune', toJson(p['Financement']), toJson(p['Cibles']), p['Problème résolu']||'', p['Livrables clés']||'', url, existingId
    );
    urlMap[url] = existingId;
    if (!bySyncMap) syncMapInsert('formation', existingId, url, '0c7e6dfc-ae95-4852-848f-d254fd30e9ba');
    console.log(`  [update] ${title} (${code})`);
    fUpdated++;
  } else {
    const id = randomUUID();
    const finalCode = code || `NI-${Date.now().toString(36).toUpperCase()}`;
    db.prepare(`INSERT INTO formations (id, code, title, description, objectives, duration_hours, duration_days, modality, level, price_ht, max_participants, prerequisites, evaluation_methods, target_audience, accessibility, status, thematique, certification, financement_eligible, probleme_resolu, livrables_cles, format_label, notion_page_url) VALUES (?,?,?,?,'[]',?,?,?,?,?,?,'','[]',?,?,?,?,?,?,?,?,?,?)`).run(
      id, finalCode, title, p['Description']||'', p['Durée (h)']||0, p['Durée (j)']||0, MODALITY[p['Modalité']]||'presentiel', p['Niveau']||'', p['Prix (€)']||0, p['Participants max']||12, toJson(p['Cibles']), p['Accessibilité']||'', FORM_STATUS[p['Statut']]||'active', p['Thématique']||'', p['Certification']||'Aucune', toJson(p['Financement']), p['Problème résolu']||'', p['Livrables clés']||'', p['Format']||'', url
    );
    syncMapInsert('formation', id, url, '0c7e6dfc-ae95-4852-848f-d254fd30e9ba');
    urlMap[url] = id;
    console.log(`  [insert] ${title} (${finalCode})`);
    fInserted++;
  }
}
console.log(`Formations: ${fInserted} inserted, ${fUpdated} updated, ${fSkipped} skipped`);

// ── CATALOGUE ALIASES ──
console.log('\n=== CATALOGUE ALIASES ==');
const catMap = payload.catalogueMap || {};
let aliasCount = 0;
for (const [catUrl, formUrl] of Object.entries(catMap)) {
  const formId = urlMap[formUrl];
  if (formId) {
    urlMap[catUrl] = formId;
    console.log(`  [alias] ${catUrl.slice(-12)} → formation ${formId.slice(0,8)}`);
    aliasCount++;
  } else {
    console.log(`  [skip] ${catUrl.slice(-12)} — target formation not found`);
  }
}
console.log(`Catalogue aliases: ${aliasCount} mapped`);


// ── FORMATEURS ──
console.log('\n=== FORMATEURS ===');
let fmtInserted = 0, fmtUpdated = 0;
for (const f of payload.formateurs || []) {
  const p = f.properties;
  const url = p.url || f.url;
  const fullName = p['Nom'] || f.title || '';
  const parts = fullName.split(' ');
  const lastName = parts[0] || '';
  const firstName = parts.slice(1).join(' ') || '';

  const bySyncMap = db.prepare("SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'formateur'").pluck().get(url);

  if (bySyncMap) {
    db.prepare(`UPDATE formateurs SET first_name=?, last_name=?, email=?, phone=?, biographie=?, qualifications=?, domaines=?, specialite=?, statut_juridique=?, statut_collab=?, evaluation=?, feedback_interne=?, tarif_jour=?, notion_page_url=? WHERE id=?`).run(
      firstName, lastName, p['Email']||'', p['Phone']||'', p['Biographie']||'', p['Qualifications / Diplômes']||'', toJson(p["Domaines d'intervention"]), toJson(p['Spécialité']), p['Statut']||'', p['Statut collaboration']||'actif', p['Evaluation']||'', p['Feebck interne']||'', p['Tarif jour (€)']||0, url, bySyncMap
    );
    urlMap[url] = bySyncMap;
    console.log(`  [update] ${fullName}`);
    fmtUpdated++;
  } else {
    const id = randomUUID();
    db.prepare(`INSERT INTO formateurs (id, first_name, last_name, email, phone, biographie, qualifications, domaines, specialite, statut_juridique, statut_collab, evaluation, feedback_interne, tarif_jour, date_dernier_dev_pro, notion_page_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, firstName, lastName, p['Email']||'', p['Phone']||'', p['Biographie']||'', p['Qualifications / Diplômes']||'', toJson(p["Domaines d'intervention"]), toJson(p['Spécialité']), p['Statut']||'', p['Statut collaboration']||'actif', p['Evaluation']||'', p['Feebck interne']||'', p['Tarif jour (€)']||0, p['date:Date dernier dev. pro:start']||'', url
    );
    syncMapInsert('formateur', id, url, '241077f9-1ed8-8196-9a4a-000b729abc5c');
    urlMap[url] = id;
    console.log(`  [insert] ${fullName}`);
    fmtInserted++;
  }
}
console.log(`Formateurs: ${fmtInserted} inserted, ${fmtUpdated} updated`);

// ── SESSIONS ──
console.log('\n=== SESSIONS ===');
let sInserted = 0, sUpdated = 0, sSkipped = 0;
for (const s of payload.sessions || []) {
  const p = s.properties;
  const url = p.url || s.url;
  const sessionName = (p['Nom de la session'] || s.title || '').replace(/\*\*/g, '').trim();

  // Resolve formation
  let formationId = null;
  const formRel = p['FORMATION'];
  if (Array.isArray(formRel) && formRel.length > 0) formationId = urlMap[formRel[0]] || null;
  if (!formationId) { console.log(`  [skip] ${sessionName} — no formation link`); sSkipped++; continue; }

  // Resolve formateur
  let formateurId = null, formateurName = '';
  const fmtRel = p['Formateurs'];
  if (Array.isArray(fmtRel) && fmtRel.length > 0) {
    formateurId = urlMap[fmtRel[0]] || null;
    if (formateurId) {
      const fmt = db.prepare("SELECT first_name, last_name FROM formateurs WHERE id = ?").get(formateurId);
      if (fmt) formateurName = `${fmt.first_name} ${fmt.last_name}`.trim();
    }
  }

  const startDate = p['date:Date:start'] || '';
  const endDate = p['date:Date:end'] || startDate;
  const status = SESSION_STATUS[p['Statut']] || 'planned';
  const codeInterne = p['Identifiant'] ? `NS${String(p['Identifiant']).padStart(3, '0')}` : '';

  const bySyncMap = db.prepare("SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'session'").pluck().get(url);

  if (bySyncMap) {
    db.prepare(`UPDATE sessions SET session_name=?, formation_id=?, start_date=?, end_date=?, status=?, type_session=?, tarif=?, adresse=?, horaire=?, notes=?, formateur_id=?, formateur_name=?, code_interne=?, notion_page_url=? WHERE id=?`).run(
      sessionName, formationId, startDate, endDate, status, p['Type']||'INTER', p['Tarif']||0, p['Adresse']||'', p['Horaire ']||'', p['Observations']||'', formateurId, formateurName, codeInterne, url, bySyncMap
    );
    urlMap[url] = bySyncMap;
    console.log(`  [update] ${sessionName}`);
    sUpdated++;
  } else {
    const id = randomUUID();
    db.prepare(`INSERT INTO sessions (id, formation_id, start_date, end_date, location, modality, max_participants, status, formateur_id, formateur_name, notes, type_session, horaire, tarif, adresse, code_interne, session_name, notion_page_url) VALUES (?,?,?,?,?,'presentiel',12,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, formationId, startDate || new Date().toISOString().split('T')[0], endDate || startDate || new Date().toISOString().split('T')[0], p['Adresse']||'', status, formateurId, formateurName, p['Observations']||'', p['Type']||'INTER', p['Horaire ']||'', p['Tarif']||0, p['Adresse']||'', codeInterne, sessionName, url
    );
    syncMapInsert('session', id, url, '241077f9-1ed8-81b4-86c1-000b633ddd62');
    urlMap[url] = id;
    console.log(`  [insert] ${sessionName} (${startDate} → ${endDate})`);
    sInserted++;
  }
}
console.log(`Sessions: ${sInserted} inserted, ${sUpdated} updated, ${sSkipped} skipped`);

// ── APPRENANTS ──
console.log('\n=== APPRENANTS ===');
let aInserted = 0, aUpdated = 0, aSkipped = 0, inscCreated = 0;
for (const a of payload.apprenants || []) {
  const p = a.properties;
  const url = p.url || a.url;
  const lastName = p['Nom'] || a.title || '';
  const firstName = p['Prénom'] || '';

  if (!lastName || /test|type \d|positionnement|melissa/i.test(lastName)) {
    console.log(`  [skip] ${lastName} ${firstName} (test/empty)`);
    aSkipped++;
    continue;
  }

  const data = {
    first_name: firstName, last_name: lastName,
    email: p['Email Address']||'', phone: p['Téléphone']||'',
    company: p['Entreprise']||'', address: p['Adresse perso']||'',
    postal_code: p['CP perso'] ? String(Math.round(p['CP perso'])) : '',
    city: p['Ville perso']||'', financement: p['Financement']||'',
    notes: p['Precision/besoins/autre']||'',
    date_naissance: p['date:Date de naissance:start']||'',
    situation_pro: p['Situation Pro']||'', statut_juridique: p['Statut jurique']||'',
    handicap: chk(p['Handicap']), precision_handicap: p['Precision Handicap']||'',
    experience: chk(p['Experience']), niveau_exp: p['Niveau exp']||'',
    motivation: p['Motivation']||'', modalite_paiement: p['Modalité de paiement']||'',
    connu_comment: toJson(p['Connu comment']), reseaux: toJson(p['Réseaux']),
    etat: APPRENANT_ETAT[p['Etat']]||'new',
    etat_relance: toJson(p['Etat relance']),
    orga_opco: p['Orga']||'', faf: p['FAF']||'',
    statut_financement: APPRENANT_FIN[p['Statut Fianncement ']]||'not_started',
    financement_entreprise: chk(p['Financement par entreprise ']),
    siret: p['Siret'] ? String(Math.round(p['Siret'])) : '',
    entreprise_adresse: p['Adresse pro']||'', entreprise_cp: p['CP pro'] ? String(Math.round(p['CP pro'])) : '',
    entreprise_ville: p['Ville pro']||'', entreprise_tel: p['Tel entreprise']||'',
    email_referent: p['E-mail Referent']||'', nom_referent: p['Nom referent']||'',
    dossier_url: p['Dossier stagiaire']||'', lien_calendly: p['Lien calendly']||'',
    date_positionnement: p['date:Date positionnement:start']||'',
    date_envoi_doc: p['date:Date envoi doc:start']||'',
    date_inscription: p["date:Date d'inscription:start"]||'',
    civilite: p['Civilité']||'', nationalite: p['Nationalité']||'',
    lieu_naissance_ville: p['Lieu naissance']||'', langue: p['Langue']||'',
    autres_situation_pro: p['Autres Situation Pro']||'',
    autres_statut_juridique: p['Autres Statut juridique']||'',
    date_selectionne: toJson(p['Date sélectionné']),
    path_dropbox: p['Path lower dropbox']||'',
    positionnement_decision: p['Décision positionnement']||'',
    positionnement_notes: p['Notes positionnement']||'',
    positionnement_amenagements: p['Aménagements']||'',
  };

  let appId;
  const bySyncMap = db.prepare("SELECT os_id FROM notion_sync_map WHERE notion_page_url = ? AND entity_type = 'apprenant'").pluck().get(url);

  if (bySyncMap) {
    appId = bySyncMap;
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE apprenants SET ${sets}, notion_page_url = ? WHERE id = ?`).run(...Object.values(data), url, appId);
    urlMap[url] = appId;
    console.log(`  [update] ${firstName} ${lastName}`);
    aUpdated++;
  } else {
    appId = randomUUID();
    const cols = ['id', ...Object.keys(data), 'notion_page_url'];
    const ph = cols.map(() => '?').join(', ');
    db.prepare(`INSERT INTO apprenants (${cols.join(', ')}) VALUES (${ph})`).run(appId, ...Object.values(data), url);
    syncMapInsert('apprenant', appId, url, '241077f9-1ed8-8193-a41c-000b0ca0bfa2');
    urlMap[url] = appId;
    console.log(`  [insert] ${firstName} ${lastName}`);
    aInserted++;
  }

  // Create inscriptions
  const sessRel = p['Sessions assginés '];
  if (sessRel) {
    const sessUrls = typeof sessRel === 'string' ? [sessRel] : (Array.isArray(sessRel) ? sessRel : []);
    for (const su of sessUrls) {
      const sessId = urlMap[su];
      if (!sessId) continue;
      const existingI = db.prepare("SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?").get(sessId, appId);
      if (!existingI) {
        db.prepare("INSERT INTO inscriptions (id, session_id, apprenant_id, status, financement, price_ht) VALUES (?,?,?,'inscrit',?,0)").run(randomUUID(), sessId, appId, data.financement);
        console.log(`    [inscription] → session ${sessId.slice(0,8)}`);
        inscCreated++;
      }
    }
  }
}
console.log(`Apprenants: ${aInserted} inserted, ${aUpdated} updated, ${aSkipped} skipped`);
console.log(`Inscriptions: ${inscCreated} created`);

// ── Summary ──
const syncCount = db.prepare("SELECT COUNT(*) as cnt FROM notion_sync_map").get().cnt;
console.log(`\n=== DONE === sync_map entries: ${syncCount}`);
db.close();

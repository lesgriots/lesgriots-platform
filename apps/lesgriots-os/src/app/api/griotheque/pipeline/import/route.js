/**
 * /api/griotheque/pipeline/import — reprendre les données déjà saisies.
 *
 * Le pipeline commercial était vide alors que les affaires existent : elles
 * ont été saisies directement en sessions, sans jamais passer par le tunnel.
 * Cette route reconstruit le pipeline à partir de ces sessions réelles.
 *
 * Deux garde-fous. GET ne fait que montrer ce qui serait créé, rien n'est
 * écrit. Et chaque opportunité garde sa provenance dans `source`
 * (« session:<id> »), donc relancer l'import ne crée jamais de doublon.
 *
 * Aucune donnée n'est inventée : le tarif, la date et le nom viennent de la
 * session. Les sessions terminées ou annulées sont écartées, elles ne sont
 * plus des affaires en cours.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const STATUTS_EN_COURS = ['planned', 'ongoing', 'confirmed', 'planifiee', 'en_cours'];

// L'affaire est déjà signée puisqu'une session existe : elle entre au bout
// du tunnel, pas au début.
const ETAPE_PAR_STATUT = {
  planned: 'session_planifiee',
  planifiee: 'session_planifiee',
  confirmed: 'session_planifiee',
  ongoing: 'session_planifiee',
  en_cours: 'session_planifiee',
};

function candidates(db) {
  const sessions = db.prepare(`
    SELECT s.id, s.session_name, s.start_date, s.status, s.tarif, s.client_id,
           f.title AS formation_titre, f.id AS formation_id,
           c.company, c.first_name, c.last_name, c.email, c.phone,
           (SELECT COUNT(*) FROM inscriptions i WHERE i.session_id = s.id) AS inscrits
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    LEFT JOIN clients c ON c.id = s.client_id
    ORDER BY s.start_date DESC
  `).all();

  const dejaLa = new Set(
    db.prepare(`SELECT source FROM formation_opportunities WHERE source LIKE 'session:%'`)
      .all().map((r) => r.source),
  );

  return sessions
    .filter((s) => STATUTS_EN_COURS.includes(String(s.status || '').toLowerCase()))
    .filter((s) => !dejaLa.has('session:' + s.id))
    .map((s) => ({
      source: 'session:' + s.id,
      // Le nom de session porte souvent le nom du client ; à défaut, la formation.
      client_name: (s.session_name || '').trim() || s.company || s.formation_titre || 'Session sans nom',
      company: s.company || '',
      client_email: s.email || '',
      client_phone: s.phone || '',
      contact_name: [s.first_name, s.last_name].filter(Boolean).join(' '),
      formation_id: s.formation_id || null,
      formation_titre: s.formation_titre || '',
      revenue: Number(s.tarif) || 0,
      stage: ETAPE_PAR_STATUT[String(s.status || '').toLowerCase()] || 'session_planifiee',
      date: s.start_date,
      inscrits: s.inscrits,
      notes: `Reprise de la session du ${s.start_date}${s.inscrits ? ` · ${s.inscrits} inscrit(s)` : ''}`,
    }));
}

async function _GET() {
  const db = getDb();
  const liste = candidates(db);
  return NextResponse.json({
    a_creer: liste.length,
    montant: liste.reduce((t, o) => t + o.revenue, 0),
    apercu: liste,
  });
}

async function _POST() {
  const db = getDb();
  const liste = candidates(db);
  const maintenant = new Date().toISOString();

  const inserer = db.prepare(`
    INSERT INTO formation_opportunities
      (id, formation_id, session_id, client_name, client_email, client_phone, contact_name,
       company, stage, revenue, financement, notes, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)
  `);

  const tout = db.transaction((rows) => {
    rows.forEach((o, i) => {
      inserer.run(
        'fo_import_' + Date.now() + '_' + i,
        o.formation_id, o.source.slice('session:'.length), o.client_name, o.client_email, o.client_phone,
        o.contact_name, o.company, o.stage, o.revenue, o.notes, o.source,
        maintenant, maintenant,
      );
    });
  });
  tout(liste);

  return NextResponse.json({ crees: liste.length, montant: liste.reduce((t, o) => t + o.revenue, 0) });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);

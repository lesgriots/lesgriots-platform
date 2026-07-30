import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const row = db.prepare('SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id WHERE fo.id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Le journal de l'affaire, du plus récent au plus ancien.
  const evenements = db.prepare(
    'SELECT * FROM opportunite_evenements WHERE opportunite_id = ? ORDER BY created_at DESC'
  ).all(id);

  // La session rattachée, s'il y en a une : c'est elle qui dit où on en est.
  //
  // On remonte aussi ce qui se lit sur la fiche sans avoir à ouvrir la
  // session : inter ou intra, le type d'action, la spécialité. Ce sont les
  // trois lignes que l'auditeur et le BPF réclament.
  const session = row.session_id
    ? db.prepare(`
        SELECT s.id, s.start_date, s.end_date, s.status, s.session_name, s.tarif,
               s.type_session, s.inter_entreprise, s.type_action_formation,
               s.specialite_formation, s.code_interne,
               f.title AS formation_title,
               (SELECT COUNT(*) FROM inscriptions i WHERE i.session_id = s.id) AS inscrits
        FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
      `).get(row.session_id)
    : null;

  // Les modules vendus, et leur prix. C'est cette ligne à ligne qui fait le
  // montant : un total saisi à côté finit toujours par mentir.
  const modules = row.session_id
    ? db.prepare(`
        SELECT id, title, duration_hours, prix_ht, nature, sort_order
        FROM session_modules WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC
      `).all(row.session_id)
    : [];

  // Les devis émis pour cette session : leur numéro, leur date, leur sort.
  const devis = row.session_id
    ? db.prepare(`
        SELECT id, numero, objet, montant_ht, montant_ttc, statut,
               date_emission, date_envoi, date_reponse, fichier
        FROM devis WHERE session_id = ? ORDER BY date_emission DESC, numero DESC
      `).all(row.session_id)
    : [];

  return NextResponse.json({ ...row, evenements, session, modules, devis });
}

async function _PATCH(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const exists = db.prepare('SELECT id FROM formation_opportunities WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const map = {
    formation_id: 'formation_id', session_id: 'session_id', client_name: 'client_name', client_email: 'client_email',
    client_phone: 'client_phone', contact_name: 'contact_name', company: 'company',
    stage: 'stage', revenue: 'revenue', financement: 'financement',
    notes: 'notes', source: 'source', archived: 'archived',
    client_id: 'client_id', bon_commande: 'bon_commande',
    date_session_prevue: 'date_session_prevue', gestionnaire: 'gestionnaire',
    financeur_id: 'financeur_id',
  };

  // Un changement d'étape se journalise tout seul : c'est la trace qu'on
  // relira pour comprendre pourquoi une affaire a mis six mois.
  const avant = db.prepare('SELECT stage, session_id FROM formation_opportunities WHERE id = ?').get(id);
  const journaliser = (type, texte) => {
    try {
      db.prepare(
        'INSERT INTO opportunite_evenements (id, opportunite_id, type, texte, auteur) VALUES (?, ?, ?, ?, ?)'
      ).run(`ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, id, type, texte, body.auteur || '');
    } catch (e) {
      console.error('[opportunites] journalisation impossible :', e.message);
    }
  };

  const sets = ['updated_at = ?'];
  const vals = [new Date().toISOString()];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = ?`); vals.push(body[k]); }
  }

  vals.push(id);
  db.prepare(`UPDATE formation_opportunities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  if (body.stage !== undefined && avant && body.stage !== avant.stage) {
    journaliser('etape', `Déplacement de l’opportunité de l’étape ${avant.stage} à l’étape ${body.stage}`);
  }
  if (body.session_id !== undefined && avant && body.session_id !== avant.session_id && body.session_id) {
    journaliser('session', 'Une session de formation a été rattachée à cette opportunité');
  }

  const updated = db.prepare('SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id WHERE fo.id = ?').get(id);
  return NextResponse.json(updated);
}

async function _DELETE(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const exists = db.prepare('SELECT id FROM formation_opportunities WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM formation_opportunities WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);

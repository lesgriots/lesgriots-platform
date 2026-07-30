/**
 * /api/qualite/actions — ce qu'on change, et à cause de quoi.
 *
 * Une action porte toujours son origine : l'incident qui l'a déclenchée, ou
 * l'axe qu'elle sert. C'est ce lien que l'auditeur cherche, pas la liste.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = ['incident_id', 'axe_id', 'nom', 'type', 'responsable', 'statut', 'date_echeance', 'date_realisation', 'preuve'];

// Les deux rattachements sont des clés étrangères : une chaîne vide venue d'un
// menu déroulant « Aucun » ne pointe sur rien et fait échouer l'insertion.
// C'est null qu'il faut écrire, pas ''.
const LIENS = ['incident_id', 'axe_id'];
const valeur = (champ, v) => (LIENS.includes(champ) ? (v || null) : v);

async function _GET() {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT c.*, r.objet AS incident_objet, a.nom AS axe_nom
      FROM actions_correctives c
      LEFT JOIN reclamations r ON r.id = c.incident_id
      LEFT JOIN axes_amelioration a ON a.id = c.axe_id
      ORDER BY c.created_at DESC
    `).all();
    return NextResponse.json(items);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

async function _POST(request) {
  try {
    const db = getDb();
    const corps = await request.json();
    if (!String(corps.nom || '').trim()) return NextResponse.json({ error: 'Une action a besoin d’un intitulé.' }, { status: 400 });
    const id = `act_${Date.now()}`;
    const presents = CHAMPS.filter((c) => c in corps);
    db.prepare(`INSERT INTO actions_correctives (id, ${presents.join(', ')}) VALUES (?, ${presents.map(() => '?').join(', ')})`)
      .run(id, ...presents.map((c) => valeur(c, corps[c])));
    return NextResponse.json(db.prepare('SELECT * FROM actions_correctives WHERE id = ?').get(id), { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

async function _PATCH(request) {
  try {
    const db = getDb();
    const { id, ...corps } = await request.json();
    const sets = [], valeurs = [];
    for (const c of CHAMPS) if (c in corps) { sets.push(`${c} = ?`); valeurs.push(valeur(c, corps[c])); }
    if (!sets.length) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
    // Une action passée à « faite » sans date se date d'aujourd'hui.
    if (corps.statut === 'faite' && !corps.date_realisation) {
      sets.push('date_realisation = ?'); valeurs.push(new Date().toISOString().slice(0, 10));
    }
    valeurs.push(id);
    db.prepare(`UPDATE actions_correctives SET ${sets.join(', ')} WHERE id = ?`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM actions_correctives WHERE id = ?').get(id));
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export const GET = withGuard('qualite:read', _GET);
export const POST = withGuard('qualite:create', _POST);
export const PATCH = withGuard('qualite:create', _PATCH);

// POST /api/projects/[id]/journal — append une entrée au journal du projet.
// Atomique : lit l'array, append, écrit. Pas de race condition côté Next single-process.
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

const ALLOWED_TYPES = new Set(['email', 'call', 'meeting', 'note', 'milestone', 'devis', 'paiement']);

async function _POST(request, { params }) {
  const { id } = await params;
  const db = getDb();

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const type = ALLOWED_TYPES.has(body.type) ? body.type : 'note';
  const content = (body.content || '').toString().trim();
  if (!content) {
    return NextResponse.json({ error: 'EMPTY_CONTENT' }, { status: 400 });
  }

  const project = db.prepare('SELECT id, project_journal FROM projects WHERE id = ?').get(id);
  if (!project) {
    return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 });
  }

  let journal = [];
  try { journal = JSON.parse(project.project_journal || '[]'); }
  catch { journal = []; }
  if (!Array.isArray(journal)) journal = [];

  const entry = {
    id: 'j_' + randomUUID().replace(/-/g, '').slice(0, 12),
    date: body.date || new Date().toISOString().slice(0, 10),
    type,
    content,
    author: body.author || 'Moos',
    createdAt: new Date().toISOString(),
  };
  journal.unshift(entry);  // dernière en tête

  db.prepare('UPDATE projects SET project_journal = ? WHERE id = ?')
    .run(JSON.stringify(journal), id);

  return NextResponse.json({ ok: true, entry, count: journal.length });
}

// DELETE /api/projects/[id]/journal?entryId=j_xxx — supprime une entrée par id.
// Egalement supporté : body JSON { entryId } pour les clients qui n'envoient pas de query.
async function _DELETE(request, { params }) {
  const { id } = await params;
  const db = getDb();

  // Récupération de l'entryId via query OU body
  const url = new URL(request.url);
  let entryId = url.searchParams.get('entryId');
  if (!entryId) {
    try {
      const body = await request.json();
      entryId = body?.entryId;
    } catch { /* pas de body, OK */ }
  }
  if (!entryId) {
    return NextResponse.json({ error: 'ENTRY_ID_REQUIRED' }, { status: 400 });
  }

  const project = db.prepare('SELECT id, project_journal FROM projects WHERE id = ?').get(id);
  if (!project) {
    return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 });
  }

  let journal = [];
  try { journal = JSON.parse(project.project_journal || '[]'); }
  catch { journal = []; }
  if (!Array.isArray(journal)) journal = [];

  const before = journal.length;
  const next = journal.filter(e => e.id !== entryId);
  if (next.length === before) {
    return NextResponse.json({ error: 'ENTRY_NOT_FOUND', entryId }, { status: 404 });
  }

  db.prepare('UPDATE projects SET project_journal = ? WHERE id = ?')
    .run(JSON.stringify(next), id);

  return NextResponse.json({ ok: true, removed: entryId, count: next.length });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('projects:create', _POST);
export const DELETE = withGuard('projects:delete', _DELETE);

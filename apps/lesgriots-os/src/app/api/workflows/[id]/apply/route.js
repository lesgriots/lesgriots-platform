// POST /api/workflows/[id]/apply  body { projectId }
// Crée toutes les tâches du workflow template dans le projet cible.
// Re-mappe les dépendances internes (depends_on) sur les nouveaux ids de tâches.
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

function makeId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

async function _POST(req, { params }) {
  const { id: templateId } = await params;
  const db = getDb();
  const tpl = db.prepare('SELECT id, name FROM workflow_templates WHERE id = ?').get(templateId);
  if (!tpl) return NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const projectId = body?.projectId;
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 });

  const templateTasks = db.prepare(`
    SELECT * FROM workflow_template_tasks WHERE template_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(templateId);

  if (templateTasks.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'Template vide' });
  }

  // Map template_task_id → new project_task_id
  const idMap = {};
  for (const t of templateTasks) idMap[t.id] = makeId();

  const existingCount = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?').get(projectId).c;
  const insert = db.prepare(`
    INSERT INTO tasks (
      id, project_id, title, description, status, phase, phase_group,
      assignee_id, assignee_name, due_date, sort_order,
      complexity, estimated_hours, depends_on
    ) VALUES (?, ?, ?, '', 'todo', '', ?, NULL, '', '', ?, ?, ?, ?)
  `);

  // ── Création automatique des production_phases ──
  // Pour chaque phase_group unique du workflow, créer une production_phase
  // si elle n'existe pas déjà sur ce projet.
  const PHASE_COLORS = [
    '#C46B3D', '#B07A0E', '#2670B4', '#8347A1',
    '#1E8449', '#C9821C', '#B83328', '#5C5246',
  ];
  const existingPhases = db.prepare(`
    SELECT name FROM production_phases WHERE project_id = ?
  `).all(projectId).map(p => p.name);
  const existingPhasesSet = new Set(existingPhases);

  // Collecter les phase_groups uniques dans l'ordre d'apparition
  const phaseGroupsInOrder = [];
  const seen = new Set();
  for (const t of templateTasks) {
    const pg = t.phase_group;
    if (pg && !seen.has(pg)) {
      phaseGroupsInOrder.push(pg);
      seen.add(pg);
    }
  }

  const insertPhase = db.prepare(`
    INSERT INTO production_phases (id, project_id, name, color, start_date, end_date, sort_order)
    VALUES (?, ?, ?, ?, '', '', ?)
  `);
  const maxSortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM production_phases WHERE project_id = ?').get(projectId).m;

  const tx = db.transaction(() => {
    // 1) Créer les phases manquantes
    let nextSort = maxSortOrder + 1;
    let phasesCreated = 0;
    for (const pg of phaseGroupsInOrder) {
      if (!existingPhasesSet.has(pg)) {
        const color = PHASE_COLORS[(maxSortOrder + 1 + phasesCreated) % PHASE_COLORS.length];
        insertPhase.run(
          'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          projectId, pg, color, nextSort,
        );
        nextSort += 1;
        phasesCreated += 1;
      }
    }

    // 2) Insérer les tâches
    templateTasks.forEach((t, i) => {
      let originalDeps = [];
      try { originalDeps = JSON.parse(t.depends_on || '[]'); } catch { originalDeps = []; }
      const remappedDeps = originalDeps
        .map(depId => idMap[depId])
        .filter(Boolean);
      insert.run(
        idMap[t.id],
        projectId,
        t.title || '',
        t.phase_group || '',
        existingCount + i,
        t.complexity || 'simple',
        t.estimated_hours,
        JSON.stringify(remappedDeps),
      );
    });
  });
  tx();

  return NextResponse.json({
    ok: true,
    created: templateTasks.length,
    templateId, templateName: tpl.name,
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('projects:create', _POST);

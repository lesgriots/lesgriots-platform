/**
 * /api/qualite/dossier — dossier d'audit Qualiopi assemblé (§ 16).
 *
 * Rassemble en une fois tout ce qu'un auditeur demande, dans l'ordre où il le
 * demande : l'organisme et ses pièces, l'offre de formation, les sessions avec
 * leurs preuves (émargements, évaluations), les formateurs, le registre des
 * réclamations. Et surtout : ce qui MANQUE, signalé pièce par pièce.
 *
 * Deux formats :
 *   · ?format=json (défaut) — pour l'interface
 *   · ?format=html          — page autonome, imprimable en PDF depuis le
 *     navigateur (Cmd+P → Enregistrer en PDF). Pas de dépendance d'archivage :
 *     un fichier qu'on peut relire dans dix ans sans outil particulier.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const PIECES_ATTENDUES = [
  { type: 'kbis',         label: 'Extrait Kbis' },
  { type: 'nda',          label: 'Déclaration d’activité (NDA)' },
  { type: 'qualiopi',     label: 'Certificat Qualiopi' },
  { type: 'assurance_rc', label: 'Assurance responsabilité civile professionnelle' },
  { type: 'urssaf',       label: 'Attestation de vigilance URSSAF' },
];

function assembler(db) {
  const auj = new Date().toISOString().slice(0, 10);
  const reglages = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value])
  );

  const pieces = db.prepare('SELECT * FROM organisme_documents WHERE archived = 0').all();
  const piecesEtat = PIECES_ATTENDUES.map((att) => {
    const p = pieces.find((x) => x.type === att.type);
    if (!p) return { ...att, present: false, statut: 'manquante' };
    const perime = p.expire_le && p.expire_le < auj;
    return {
      ...att, present: true, libelle: p.libelle, reference: p.reference,
      expire_le: p.expire_le, statut: perime ? 'expiree' : 'valide',
    };
  });

  const formations = db.prepare(`
    SELECT f.id, f.title, f.duration_hours, f.objectives, f.prerequisites,
           (SELECT COUNT(*) FROM sessions s WHERE s.formation_id = f.id) AS nb_sessions
    FROM formations f ORDER BY f.title
  `).all();

  const sessions = db.prepare(`
    SELECT s.id, s.session_name, s.start_date, s.end_date, s.status,
           s.formateur_name, f.title AS formation_titre,
           (SELECT COUNT(*) FROM inscriptions i WHERE i.session_id = s.id)  AS nb_inscrits,
           -- Le dossier d'audit compte des présences signées, pas des lignes
           -- préparées : elles existent dès l'inscription.
           (SELECT COUNT(*) FROM emargements e
            WHERE e.session_id = s.id AND (e.matin = 1 OR e.apres_midi = 1)) AS nb_emargements,
           (SELECT COUNT(*) FROM evaluations v WHERE v.session_id = s.id)   AS nb_evaluations,
           (SELECT COUNT(*) FROM evaluations v WHERE v.session_id = s.id AND v.type = 'satisfaction') AS nb_satisfaction,
           (SELECT ROUND(AVG(v.score), 2) FROM evaluations v WHERE v.session_id = s.id AND v.type = 'satisfaction' AND v.score IS NOT NULL) AS note_satisfaction
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    ORDER BY s.start_date DESC
  `).all();

  // Une session terminée sans émargement ni évaluation est le premier point
  // qu'un auditeur relève : on le remonte explicitement plutôt que de le noyer.
  const sessionsIncompletes = sessions.filter((s) =>
    s.end_date && s.end_date < auj && (s.nb_emargements === 0 || s.nb_satisfaction === 0));

  const formateurs = db.prepare('SELECT * FROM formateurs').all();
  const reclamations = db.prepare('SELECT * FROM reclamations ORDER BY recue_le DESC').all();

  const manques = [];
  for (const p of piecesEtat) {
    if (p.statut === 'manquante') manques.push(`Pièce absente : ${p.label}`);
    if (p.statut === 'expiree') manques.push(`Pièce expirée : ${p.label} (${p.expire_le})`);
  }
  for (const s of sessionsIncompletes) {
    const quoi = [];
    if (!s.nb_emargements) quoi.push('émargement');
    if (!s.nb_satisfaction) quoi.push('enquête de satisfaction');
    manques.push(`Session « ${s.session_name || s.formation_titre || s.id} » (${s.start_date}) : ${quoi.join(' et ')} manquant(s)`);
  }
  if (!formateurs.length) manques.push('Aucun formateur enregistré');

  // Score : part des contrôles automatiques satisfaits. Volontairement simple
  // et lisible — il indique une tendance, il ne remplace pas l'audit.
  const controles = piecesEtat.length + Math.max(sessions.filter((s) => s.end_date && s.end_date < auj).length, 1) + 1;
  const score = Math.max(0, Math.round(((controles - manques.length) / controles) * 100));

  return {
    genere_le: new Date().toISOString(),
    organisme: {
      raison_sociale: reglages.company_name || '', siren: reglages.siren || '',
      siret: reglages.siret || '', nda: reglages.nda || '',
      adresse: [reglages.address, reglages.postal_code, reglages.city].filter(Boolean).join(', '),
      email: reglages.email || '', telephone: reglages.phone || '',
      representant: reglages.representant_name || '',
    },
    pieces: piecesEtat,
    formations, sessions, formateurs, reclamations,
    synthese: {
      score_conformite: score,
      nb_formations: formations.length,
      nb_sessions: sessions.length,
      nb_sessions_incompletes: sessionsIncompletes.length,
      nb_reclamations: reclamations.length,
      nb_reclamations_ouvertes: reclamations.filter((r) => ['ouverte', 'en_cours'].includes(r.statut)).length,
      manques,
    },
  };
}

const echapper = (v) => String(v ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function enHtml(d) {
  const o = d.organisme;
  const ligne = (cells) => `<tr>${cells.map((c) => `<td>${echapper(c)}</td>`).join('')}</tr>`;
  const dateFr = (x) => x ? new Date(x).toLocaleDateString('fr-FR') : '—';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Dossier d'audit — ${echapper(o.raison_sociale || 'Organisme')}</title>
<style>
 @page { size: A4; margin: 14mm; }
 body { font-family: 'Geist','Inter',system-ui,sans-serif; color:#111; background:#f6f5f3; margin:0; padding:28px; line-height:1.5; }
 .wrap { max-width: 980px; margin: 0 auto; }
 h1 { font-size: 28px; letter-spacing:-.02em; margin:0 0 4px; }
 h2 { font-size: 16px; margin:34px 0 10px; padding-top:14px; border-top:2px solid #000; }
 .meta { color:#666; font-size:13px; }
 table { width:100%; border-collapse:collapse; font-size:12.5px; margin-top:6px; }
 th { text-align:left; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#777; border-bottom:1px solid #000; padding:0 8px 6px 0; }
 td { padding:7px 8px 7px 0; border-bottom:1px solid rgba(0,0,0,.12); vertical-align:top; }
 .score { display:inline-block; background:#ffca00; padding:10px 16px; font-weight:700; font-size:20px; }
 .manques { background:#fff; border-left:3px solid #E0604F; padding:12px 16px; margin-top:10px; }
 .manques li { font-size:13px; margin-bottom:4px; }
 .ok { color:#1f7a44; } .ko { color:#b03030; font-weight:600; }
 @media print { body { background:#fff; padding:0; } .noprint { display:none; } }
</style></head><body><div class="wrap">
<h1>Dossier d'audit Qualiopi</h1>
<p class="meta">${echapper(o.raison_sociale)} · SIREN ${echapper(o.siren)} · NDA ${echapper(o.nda)}<br>
Généré le ${new Date(d.genere_le).toLocaleString('fr-FR')}</p>
<p class="noprint meta">Astuce : Cmd+P puis « Enregistrer en PDF » pour archiver ce dossier.</p>

<h2>Synthèse</h2>
<p><span class="score">${d.synthese.score_conformite}%</span></p>
<p class="meta">${d.synthese.nb_formations} formation(s) · ${d.synthese.nb_sessions} session(s) ·
${d.synthese.nb_reclamations} réclamation(s) dont ${d.synthese.nb_reclamations_ouvertes} en cours</p>
${d.synthese.manques.length
  ? `<div class="manques"><strong>À traiter avant l'audit</strong><ul>${d.synthese.manques.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>`
  : `<p class="ok">Aucun manque détecté par les contrôles automatiques.</p>`}

<h2>Organisme</h2>
<table><tbody>
${ligne(['Raison sociale', o.raison_sociale])}${ligne(['SIRET', o.siret])}
${ligne(['Déclaration d’activité', o.nda])}${ligne(['Adresse', o.adresse])}
${ligne(['Contact', [o.email, o.telephone].filter(Boolean).join(' · ')])}
${ligne(['Représentant', o.representant])}
</tbody></table>

<h2>Pièces officielles</h2>
<table><thead><tr><th>Pièce</th><th>Référence</th><th>Validité</th><th>État</th></tr></thead><tbody>
${d.pieces.map((p) => `<tr><td>${echapper(p.label)}</td><td>${echapper(p.reference || '—')}</td>
<td>${p.expire_le ? echapper(p.expire_le) : '—'}</td>
<td class="${p.statut === 'valide' ? 'ok' : 'ko'}">${p.statut}</td></tr>`).join('')}
</tbody></table>

<h2>Offre de formation</h2>
<table><thead><tr><th>Formation</th><th>Durée</th><th>Sessions</th></tr></thead><tbody>
${d.formations.map((f) => `<tr><td>${echapper(f.title)}</td><td>${echapper(f.duration_hours || '—')}</td><td>${f.nb_sessions}</td></tr>`).join('') || '<tr><td colspan="3">Aucune</td></tr>'}
</tbody></table>

<h2>Sessions et preuves</h2>
<table><thead><tr><th>Session</th><th>Dates</th><th>Inscrits</th><th>Émarg.</th><th>Éval.</th><th>Satisf.</th></tr></thead><tbody>
${d.sessions.map((s) => `<tr><td>${echapper(s.session_name || s.formation_titre || '—')}</td>
<td>${dateFr(s.start_date)}${s.end_date ? ' → ' + dateFr(s.end_date) : ''}</td>
<td>${s.nb_inscrits}</td><td class="${s.nb_emargements ? 'ok' : 'ko'}">${s.nb_emargements}</td>
<td>${s.nb_evaluations}</td><td>${s.note_satisfaction ?? '—'}</td></tr>`).join('') || '<tr><td colspan="6">Aucune</td></tr>'}
</tbody></table>

<h2>Formateurs</h2>
<table><thead><tr><th>Nom</th><th>Email</th></tr></thead><tbody>
${d.formateurs.map((f) => `<tr><td>${echapper(f.nom || f.name || '—')}</td><td>${echapper(f.email || '—')}</td></tr>`).join('') || '<tr><td colspan="2">Aucun</td></tr>'}
</tbody></table>

<h2>Registre des réclamations</h2>
<table><thead><tr><th>Réf.</th><th>Reçue le</th><th>Objet</th><th>Gravité</th><th>Statut</th></tr></thead><tbody>
${d.reclamations.map((r) => `<tr><td>${echapper(r.reference)}</td><td>${echapper(r.recue_le)}</td>
<td>${echapper(r.objet)}</td><td>${echapper(r.gravite)}</td><td>${echapper(r.statut)}</td></tr>`).join('')
  || '<tr><td colspan="5">Registre tenu, aucune entrée à ce jour.</td></tr>'}
</tbody></table>

<p class="meta" style="margin-top:34px">Document généré automatiquement par LES GRIOTHÈQUE OS.
Les contrôles sont automatiques et ne se substituent pas à l'examen de l'auditeur.</p>
</div></body></html>`;
}

async function _GET(req) {
  try {
    const db = getDb();
    const dossier = assembler(db);
    if (new URL(req.url).searchParams.get('format') === 'html') {
      return new Response(enHtml(dossier), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return NextResponse.json(dossier);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('qualite:read', _GET);

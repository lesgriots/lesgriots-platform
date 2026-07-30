/**
 * /api/griotheque/envois-auto — l'envoi automatique des convocations.
 *
 * Jusqu'ici, la case « activer l'envoi automatique » de l'écran Convocations
 * enregistrait une préférence que rien n'exécutait. Un interrupteur qui ne
 * fait rien est moins grave qu'un interrupteur qui fait croire : celui-là
 * laissait penser que les convocations partaient seules.
 *
 * Cette route est le moteur qui manquait. Elle est appelée chaque matin par
 * un timer systemd (le VPS n'a pas de cron), avec la clé d'API du serveur.
 *
 * Trois garde-fous, parce qu'un envoi automatique qui se trompe est pire
 * qu'un envoi manuel oublié :
 *
 *   1. Idempotence. Un apprenant qui a déjà reçu sa convocation pour cette
 *      session ne la reçoit jamais deux fois. La preuve est le journal des
 *      e-mails, pas une case cochée à la main.
 *   2. Fenêtre, pas instant. On envoie quand il reste au plus N jours avant
 *      le début, et pas après le début. Si le serveur était éteint un matin,
 *      le rattrapage du lendemain fonctionne encore.
 *   3. Essai à blanc. Avec ?simulation=1, la route dit exactement ce qu'elle
 *      ferait sans rien envoyer. C'est ce qu'on regarde avant d'activer.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { smtpConfigure } from '@/lib/mailer';

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';

/** Les sessions dont l'envoi automatique est armé et qui approchent. */
function sessionsEligibles(db, aujourdhui) {
  return db.prepare(`
    SELECT s.id, s.start_date, s.session_name,
           COALESCE(s.convocation_lead_days, 4) AS jours,
           COALESCE(f.title, s.session_name, s.id) AS titre
    FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
    WHERE COALESCE(s.convocation_auto_enabled, 0) = 1
      AND COALESCE(s.start_date, '') <> ''
      AND s.start_date >= ?
      AND COALESCE(s.status, '') NOT IN ('annulee', 'archivee')
  `).all(aujourdhui);
}

/** Les apprenants de la session qui n'ont pas encore reçu leur convocation. */
function aConvoquer(db, session_id) {
  return db.prepare(`
    SELECT a.id, a.first_name, a.last_name, a.email
    FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
    WHERE i.session_id = ?
      AND COALESCE(a.email, '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM emails e
        WHERE e.template_key = 'convocation'
          AND e.contexte_id = i.session_id
          AND e.destinataire = a.email
          AND e.statut IN ('envoye', 'simule')
      )
  `).all(session_id);
}

const joursAvant = (depart, aujourdhui) =>
  Math.round((new Date(`${depart}T12:00:00`) - new Date(`${aujourdhui}T12:00:00`)) / 86400000);

async function _POST(request) {
  try {
    const db = getDb();
    const params = new URL(request.url).searchParams;
    const simulation = params.get('simulation') === '1';
    const aujourdhui = params.get('date') || new Date().toISOString().slice(0, 10);

    const rapport = {
      date: aujourdhui,
      simulation,
      mode_smtp: smtpConfigure() ? 'reel' : 'simulation',
      sessions_armees: 0,
      sessions_traitees: [],
      envoyes: 0,
      ignores_sans_email: 0,
    };

    const sessions = sessionsEligibles(db, aujourdhui);
    rapport.sessions_armees = sessions.length;

    for (const s of sessions) {
      const reste = joursAvant(s.start_date, aujourdhui);
      // Fenêtre : on entre dans la zone d'envoi et on n'en est pas sorti.
      if (reste > Number(s.jours)) continue;

      const cibles = aConvoquer(db, s.id);
      const sansEmail = db.prepare(`
        SELECT COUNT(*) AS n FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
        WHERE i.session_id = ? AND COALESCE(a.email, '') = ''
      `).get(s.id).n;
      rapport.ignores_sans_email += sansEmail;

      const trace = {
        session_id: s.id, titre: s.titre, debut: s.start_date,
        jours_avant: reste, delai_configure: Number(s.jours),
        a_convoquer: cibles.map((c) => [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email),
        sans_email: sansEmail,
        envoyes: 0,
      };

      if (!cibles.length) { rapport.sessions_traitees.push(trace); continue; }

      if (!simulation) {
        // On réutilise le moteur habillé plutôt que d'en réécrire un second :
        // même modèle, même logo, même programme joint, même journalisation.
        const r = await fetch(`${BASE}/api/griotheque/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.OS_API_KEY || '' },
          body: JSON.stringify({
            session_id: s.id, template_key: 'convocation',
            apprenant_ids: cibles.map((c) => c.id),
          }),
        });
        const d = await r.json().catch(() => ({}));
        trace.envoyes = Number(d.envoyes || 0) + Number(d.simules || 0);
        trace.echecs = Number(d.echecs || 0);
        rapport.envoyes += trace.envoyes;

        // La case « convocation envoyée » de la fiche suit l'envoi réel.
        if (trace.envoyes) {
          const marquer = db.prepare('UPDATE inscriptions SET convocation_sent = 1 WHERE session_id = ? AND apprenant_id = ?');
          for (const c of cibles) { try { marquer.run(s.id, c.id); } catch (e) { console.error('[envois-auto]', e.message); } }
        }
      }

      rapport.sessions_traitees.push(trace);
    }

    console.info(`[envois-auto] ${aujourdhui} · ${rapport.sessions_armees} session(s) armée(s) · ${rapport.envoyes} envoi(s)${simulation ? ' (simulation)' : ''}`);
    return NextResponse.json(rapport);
  } catch (e) {
    console.error('[envois-auto] échec :', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** GET = essai à blanc, toujours. Pratique pour regarder sans risque. */
async function _GET(request) {
  const url = new URL(request.url);
  url.searchParams.set('simulation', '1');
  return _POST(new Request(url, { method: 'POST', headers: request.headers }));
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('emails:send', _POST);

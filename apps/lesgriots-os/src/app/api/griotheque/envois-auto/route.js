/**
 * /api/griotheque/envois-auto — les envois qui partent tout seuls.
 *
 * Quatre campagnes, chacune accrochée à un moment du cycle de la session :
 *
 *   convocation     N jours avant le début     (défaut 4)
 *   rappel J-7      N jours avant le début     (défaut 7)
 *   enquête à chaud N jours après la fin       (défaut 1)
 *   enquête à froid N jours après la fin       (défaut 90)
 *
 * Les deux enquêtes ne sont pas du confort : l'indicateur 30 du référentiel
 * national qualité demande de recueillir les appréciations des apprenants,
 * et rien ne le remplira tant que l'envoi reste manuel.
 *
 * Cette route est appelée chaque matin par un timer systemd (le VPS n'a pas
 * de cron), avec la clé d'API du serveur.
 *
 * Quatre garde-fous, parce qu'un envoi automatique qui se trompe est pire
 * qu'un envoi manuel oublié :
 *
 *   1. Idempotence. Un apprenant qui a déjà reçu ce message pour cette
 *      session ne le reçoit jamais deux fois. La preuve est le journal des
 *      e-mails, pas une case cochée à la main.
 *   2. Fenêtre, pas instant. On envoie dans un intervalle, pas à une date
 *      exacte : si le serveur était éteint un matin, le lendemain rattrape.
 *   3. Fenêtre fermée à l'autre bout. On ne réveille pas une session d'il y
 *      a deux ans parce que quelqu'un vient d'armer un interrupteur.
 *   4. Essai à blanc. Un GET dit exactement ce qui partirait sans rien
 *      envoyer. C'est ce qu'on regarde avant d'armer.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { smtpConfigure } from '@/lib/mailer';

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';

/**
 * Les campagnes. `jours()` donne le délai réglé sur la session, `ouverte()`
 * dit si on est dans la fenêtre d'envoi, à partir des dates de la session.
 */
export const CAMPAGNES = [
  {
    cle: 'convocation', template: 'convocation', libelle: 'Convocation',
    actif: (s) => Number(s.convocation_auto_enabled) === 1,
    jours: (s) => Number(s.convocation_lead_days ?? 4),
    ouverte: (s, auj, n) => {
      if (!s.start_date) return false;
      const reste = ecart(s.start_date, auj);
      return reste <= n && reste >= 0;
    },
  },
  {
    cle: 'rappel', template: 'rappel_j7', libelle: 'Rappel avant la session',
    actif: (s) => Number(s.rappel_auto_enabled) === 1,
    jours: (s) => Number(s.rappel_lead_days ?? 7),
    ouverte: (s, auj, n) => {
      if (!s.start_date) return false;
      const reste = ecart(s.start_date, auj);
      return reste <= n && reste >= 0;
    },
  },
  {
    cle: 'chaud', template: 'enquete_chaud', libelle: 'Enquête à chaud',
    actif: (s) => Number(s.chaud_auto_enabled) === 1,
    jours: (s) => Number(s.chaud_delai_jours ?? 1),
    ouverte: (s, auj, n) => {
      const fin = s.end_date || s.start_date;
      if (!fin) return false;
      const depuis = -ecart(fin, auj);            // jours écoulés depuis la fin
      return depuis >= n && depuis <= n + 30;     // un mois pour rattraper
    },
  },
  {
    cle: 'froid', template: 'enquete_froid', libelle: 'Enquête à froid',
    actif: (s) => Number(s.froid_auto_enabled) === 1,
    jours: (s) => Number(s.froid_delai_jours ?? 90),
    ouverte: (s, auj, n) => {
      const fin = s.end_date || s.start_date;
      if (!fin) return false;
      const depuis = -ecart(fin, auj);
      return depuis >= n && depuis <= n + 60;     // deux mois pour rattraper
    },
  },
];

/**
 * Le programme retient-il ce questionnaire ?
 *
 * La fiche du programme décide des questionnaires servis. Une enquête que
 * l'espace apprenant ne proposera pas ne doit pas partir : sinon l'apprenant
 * reçoit un e-mail, clique, et ne trouve rien à remplir. Liste vide = tout
 * est servi, comme partout ailleurs.
 */
function retenuParLeProgramme(session, campagne) {
  if (campagne !== 'chaud' && campagne !== 'froid') return true;
  let retenus = [];
  try { retenus = JSON.parse(session.formation_evaluations || '[]') || []; } catch { retenus = []; }
  return !retenus.length || retenus.includes(campagne);
}

/** Jours entre une date et aujourd'hui : positif si la date est à venir. */
function ecart(date, auj) {
  return Math.round((new Date(`${String(date).slice(0, 10)}T12:00:00`) - new Date(`${auj}T12:00:00`)) / 86400000);
}

/** Les apprenants de la session qui n'ont pas encore reçu ce message. */
function aRelancer(db, session_id, template_key) {
  return db.prepare(`
    SELECT a.id, a.first_name, a.last_name, a.email
    FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
    WHERE i.session_id = ?
      AND COALESCE(a.email, '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM emails e
        WHERE e.template_key = ?
          AND e.contexte_id = i.session_id
          AND e.destinataire = a.email
          -- Seul un envoi réel compte. Une simulation, journalisée tant que
          -- le SMTP n'est pas configuré, marquait le destinataire comme servi :
          -- le jour où l'envoi devenait réel, la convocation ne partait plus
          -- jamais. Elle était brûlée sans avoir été lue par personne.
          AND e.statut = 'envoye'
          -- Un e-mail de test envoyé à soi-même ne vaut pas envoi réel.
          AND COALESCE(e.contexte_type, '') <> 'test'
      )
  `).all(session_id, template_key);
}

async function _POST(request) {
  try {
    const db = getDb();
    const params = new URL(request.url).searchParams;
    const simulation = params.get('simulation') === '1';
    const aujourdhui = params.get('date') || new Date().toISOString().slice(0, 10);

    const rapport = {
      date: aujourdhui, simulation,
      mode_smtp: smtpConfigure() ? 'reel' : 'simulation',
      campagnes: {}, envoyes: 0, ignores_sans_email: 0, traces: [],
    };

    // Toutes les sessions vivantes : la fenêtre de chaque campagne fera le tri.
    const sessions = db.prepare(`
      SELECT s.*, COALESCE(f.title, s.session_name, s.id) AS titre,
             f.evaluations_associees AS formation_evaluations
      FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
      WHERE COALESCE(s.status, '') NOT IN ('annulee', 'archivee')
        AND COALESCE(s.start_date, '') <> ''
    `).all();

    for (const c of CAMPAGNES) {
      rapport.campagnes[c.cle] = { libelle: c.libelle, sessions_armees: 0, envoyes: 0 };

      for (const s of sessions) {
        if (!c.actif(s)) continue;
        // Cohérence avec la fiche du programme : inutile d'envoyer une
        // enquête que l'espace apprenant ne proposera pas. L'apprenant
        // cliquerait pour ne rien trouver à remplir.
        if (!retenuParLeProgramme(s, c.cle)) continue;
        rapport.campagnes[c.cle].sessions_armees += 1;

        const n = c.jours(s);
        if (!c.ouverte(s, aujourdhui, n)) continue;

        const cibles = aRelancer(db, s.id, c.template);
        const sansEmail = db.prepare(`
          SELECT COUNT(*) AS n FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
          WHERE i.session_id = ? AND COALESCE(a.email, '') = ''
        `).get(s.id).n;
        rapport.ignores_sans_email += sansEmail;

        const trace = {
          campagne: c.cle, libelle: c.libelle,
          session_id: s.id, titre: s.titre,
          debut: s.start_date, fin: s.end_date || s.start_date,
          delai_configure: n, sans_email: sansEmail,
          a_convoquer: cibles.map((x) => [x.first_name, x.last_name].filter(Boolean).join(' ') || x.email),
          envoyes: 0,
        };
        if (!cibles.length) { rapport.traces.push(trace); continue; }

        if (!simulation) {
          // On réutilise le moteur habillé plutôt que d'en écrire un second :
          // même modèle, même logo, même journalisation.
          const r = await fetch(`${BASE}/api/griotheque/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.OS_API_KEY || '' },
            body: JSON.stringify({ session_id: s.id, template_key: c.template, apprenant_ids: cibles.map((x) => x.id) }),
          });
          const d = await r.json().catch(() => ({}));
          trace.envoyes = Number(d.envoyes || 0);
          trace.simules = Number(d.simules || 0);
          trace.echecs = Number(d.echecs || 0);
          rapport.envoyes += trace.envoyes;
          rapport.campagnes[c.cle].envoyes += trace.envoyes;

          // Le drapeau « convocation envoyée » ne se lève que sur un envoi réel.
          if (c.cle === 'convocation' && trace.envoyes) {
            const marquer = db.prepare('UPDATE inscriptions SET convocation_sent = 1 WHERE session_id = ? AND apprenant_id = ?');
            for (const x of cibles) { try { marquer.run(s.id, x.id); } catch (e) { console.error('[envois-auto]', e.message); } }
          }
        }

        rapport.traces.push(trace);
      }
    }

    console.info(`[envois-auto] ${aujourdhui} · ${rapport.envoyes} envoi(s)${simulation ? ' (simulation)' : ''}`);
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

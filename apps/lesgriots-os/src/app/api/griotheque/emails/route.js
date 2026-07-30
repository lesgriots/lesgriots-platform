/**
 * /api/griotheque/emails — écrire aux inscrits d'une session.
 *
 * Les modèles Griothèque (convocation, rappel, enquêtes, attestation,
 * convention et documents de session)
 * existaient depuis le début et n'avaient jamais servi : rien ne les reliait à
 * des destinataires réels.
 *
 * Deux principes.
 *   · Aperçu avant envoi. On voit le message exact qui partira, destinataire
 *     par destinataire, avant de cliquer.
 *   · Le lien personnel de l'apprenant est ajouté au message. Sans lui, l'email
 *     demande d'émarger ou de répondre sans dire où, et rien ne rentre.
 *
 * Tant que le SMTP n'est pas configuré, tout est journalisé en « simulé » :
 * on voit ce qui SERAIT parti, sans rien envoyer.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { envoyerEmail, smtpConfigure, expediteur } from '@/lib/mailer';
import { GRIOTHEQUE_EMAIL_TEMPLATES, GRIOTHEQUE_EMAIL_TEMPLATES_MAP } from '@/lib/email-templates';
import { habiller, pieceLogo } from '@/lib/email-marque';

/** L'identité de l'organisme, pour la mention légale en pied d'email. */
function organisme(db) {
  const lire = (cle, defaut = '') => {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
    return r && r.value ? r.value : defaut;
  };
  return {
    raison_sociale: lire('company_name', 'LES GRIOTS'),
    nda: lire('nda') || lire('numero_declaration'),
    siret: lire('siret'),
    email: lire('email'),
  };
}

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';

/** Le lien personnel, créé à la volée si l'apprenant n'en a pas encore. */
function lienEspace(db, session_id, apprenant_id) {
  const existant = db.prepare('SELECT token FROM espace_liens WHERE session_id = ? AND apprenant_id = ?')
    .get(session_id, apprenant_id);
  if (existant) return `${BASE}/p/${existant.token}`;
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT OR IGNORE INTO espace_liens (id, token, session_id, apprenant_id) VALUES (?, ?, ?, ?)')
    .run('esp_' + crypto.randomBytes(6).toString('hex'), token, session_id, apprenant_id);
  return `${BASE}/p/${token}`;
}

function contexte(db, session_id) {
  const s = db.prepare(`
    SELECT s.*, f.title, f.duration_hours FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
  `).get(session_id);
  if (!s) return null;
  const lieu = s.lieu_formation_id
    ? db.prepare('SELECT nom, adresse, postal_code, ville FROM lieux_formation WHERE id = ?').get(s.lieu_formation_id)
    : null;
  return {
    session: s,
    formation: { title: s.title, duration_hours: s.duration_hours },
    lieu: lieu ? [lieu.nom, lieu.adresse, lieu.postal_code, lieu.ville].filter(Boolean).join(', ')
               : (s.adresse || s.location || ''),
    horaire: s.horaire || '',
    formateurName: s.formateur_name || '',
  };
}

function destinataires(db, session_id) {
  return db.prepare(`
    SELECT a.id, a.first_name, a.last_name, a.email
    FROM inscriptions i JOIN apprenants a ON a.id = i.apprenant_id
    WHERE i.session_id = ?
  `).all(session_id);
}

function composer(db, modele, ctx, session_id, apprenant) {
  const objet = typeof modele.subject === 'function' ? modele.subject(ctx) : String(modele.subject || '');
  const corpsBase = typeof modele.body === 'function' ? modele.body(ctx) : String(modele.body || '');
  const lien = lienEspace(db, session_id, apprenant.id);
  const prenom = apprenant.first_name || '';
  const corps = corpsBase.replace(/^Bonjour,/, prenom ? `Bonjour ${prenom},` : 'Bonjour,')
    + `\n\n———\nVOTRE ESPACE APPRENANT\nTout s'y trouve : votre programme, vos documents, l'émargement et les questionnaires.\n${lien}\n`;
  // La version HTML porte la marque ; le texte reste envoyé en parallèle pour
  // les clients qui ne rendent pas le HTML.
  const html = habiller({ objet, corps: corpsBase.replace(/^Bonjour,/, prenom ? `Bonjour ${prenom},` : 'Bonjour,'), lien, organisme: organisme(db) });
  return { objet, corps, html, lien };
}

async function _GET(request) {
  try {
    const db = getDb();
    const p = new URL(request.url).searchParams;
    const session_id = p.get('session_id');
    const template_key = p.get('template_key');

    const base = {
      modeles: GRIOTHEQUE_EMAIL_TEMPLATES.map((t) => ({ key: t.key, label: t.label, description: t.description })),
      mode: smtpConfigure() ? 'reel' : 'simulation',
      expediteur: expediteur(),
    };

    if (!session_id || !template_key) return NextResponse.json(base);

    const modele = GRIOTHEQUE_EMAIL_TEMPLATES_MAP[template_key];
    const ctx = contexte(db, session_id);
    if (!modele || !ctx) return NextResponse.json({ ...base, error: 'Session ou modèle inconnu' }, { status: 404 });

    const gens = destinataires(db, session_id);
    const premier = gens[0];
    return NextResponse.json({
      ...base,
      destinataires: gens.map((g) => ({
        id: g.id,
        nom: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Sans nom',
        email: g.email || '',
        joignable: Boolean(g.email),
      })),
      apercu: premier ? composer(db, modele, ctx, session_id, premier) : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const db = getDb();
    const { session_id, template_key, apprenant_ids } = await request.json();
    const modele = GRIOTHEQUE_EMAIL_TEMPLATES_MAP[template_key];
    const ctx = contexte(db, session_id);
    if (!modele || !ctx) return NextResponse.json({ error: 'Session ou modèle inconnu' }, { status: 400 });

    const gens = destinataires(db, session_id)
      .filter((g) => !apprenant_ids || apprenant_ids.includes(g.id));

    // Un statut « envoyé » ne doit être retourné que lorsque le transport SMTP
    // l'a réellement accepté. Avant, chaque tentative était comptée comme un
    // envoi, y compris les échecs SMTP : l'interface pouvait donc annoncer un
    // email envoyé alors que personne ne l'avait reçu.
    let envoyes = 0, simules = 0, echecs = 0, ignores = 0;
    for (const g of gens) {
      if (!g.email) { ignores += 1; continue; }
      const { objet, corps, html } = composer(db, modele, ctx, session_id, g);
      const resultat = await envoyerEmail({
        destinataire: g.email,
        destinataire_nom: [g.first_name, g.last_name].filter(Boolean).join(' '),
        objet, corps, html,
        pieces: pieceLogo(),
        template_key,
        contexte_type: 'session',
        contexte_id: session_id,
      });
      if (resultat.statut === 'envoye') envoyes += 1;
      else if (resultat.statut === 'simule') simules += 1;
      else echecs += 1;
    }

    return NextResponse.json({
      envoyes,
      simules,
      echecs,
      ignores,
      mode: smtpConfigure() ? 'reel' : 'simulation',
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('emails:send', _POST);

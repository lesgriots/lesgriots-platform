/**
 * LES GRIOTHÈQUE OS — moteur d'envoi d'emails.
 *
 * Deux modes, choisis automatiquement selon la configuration :
 *
 *   · CONFIGURÉ  — les variables SMTP_* sont présentes dans /etc/lesgriots-os.env :
 *     l'email part réellement, et l'envoi est journalisé.
 *   · SIMULATION — aucune configuration SMTP : rien ne part, mais tout est
 *     journalisé à l'identique avec le statut « simule ». L'app fonctionne
 *     complètement, on voit ce qui SERAIT parti, et le jour où les identifiants
 *     sont déposés les mêmes envois partent pour de vrai sans changer une ligne.
 *
 * Ce choix évite le piège classique : construire des automatisations qu'on ne
 * peut ni tester ni observer tant que la boîte d'envoi n'est pas tranchée.
 *
 * Variables attendues (toutes optionnelles) :
 *   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_SECURE (0/1)
 *   MAIL_FROM       ex. "LA GRIOTHÈQUE <formation@lesgriots.com>"
 *   MAIL_REPLY_TO   ex. "formations@lesgriots.com"
 *   MAIL_DRY_RUN=1  force la simulation même si le SMTP est configuré (recette)
 */

import { getDb } from './db.mjs';
import { pieceLogo, CID as CID_LOGO } from './email-marque';
import { randomUUID } from 'crypto';

export function smtpConfigure() {
  if (process.env.MAIL_DRY_RUN === '1') return false;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function expediteur() {
  return process.env.MAIL_FROM || 'LA GRIOTHÈQUE <formation@lesgriots.com>';
}

function emailValide(adresse) {
  return typeof adresse === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse.trim());
}

/**
 * Envoie (ou simule) un email et le journalise systématiquement.
 * Ne lève jamais : un échec d'envoi ne doit pas casser l'action métier qui
 * l'a déclenché (une inscription reste valide même si l'email échoue).
 *
 * @returns {{id, statut, erreur}} statut ∈ 'envoye' | 'simule' | 'echec'
 */
/**
 * Le logo, joint d'office quand le HTML le réclame.
 *
 * Le gabarit d'email porte un `<img src="cid:logogriotheque">` en tête, et
 * l'image ne s'affiche que si la pièce jointe correspondante voyage avec le
 * message. Or c'était à chaque appelant d'y penser : deux l'avaient fait,
 * l'accusé de réception d'inscription et la notification à l'organisme ne
 * l'avaient pas fait. Ces deux-là, les plus envoyés, partaient donc avec un
 * cadre d'image vide en haut du message.
 *
 * On ne le laisse plus à la mémoire de personne : si le HTML appelle le
 * logo et qu'aucune pièce ne le porte, le mailer l'ajoute. Le fichier est lu
 * une fois et gardé en mémoire, et s'il manque, l'envoi part quand même.
 */
function avecLogo(html, pieces) {
  if (!html || !html.includes(`cid:${CID_LOGO}`)) return pieces;
  if (pieces.some((p) => p?.cid === CID_LOGO)) return pieces;
  return [...pieceLogo(), ...pieces];
}

export async function envoyerEmail({
  destinataire,
  destinataire_nom = '',
  objet = '',
  corps = '',
  html = '',
  pieces = [],
  template_key = '',
  contexte_type = '',
  contexte_id = '',
}) {
  const db = getDb();
  const id = randomUUID();

  const journaliser = (statut, erreur = '', message_id = '') => {
    try {
      db.prepare(`
        INSERT INTO emails
          (id, template_key, destinataire, destinataire_nom, objet, corps,
           statut, erreur, message_id, contexte_type, contexte_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, template_key, destinataire || '', destinataire_nom, objet, corps,
        statut, erreur, message_id, contexte_type, contexte_id || '');
    } catch (e) {
      console.error('[mailer] journalisation impossible :', e.message);
    }
    return { id, statut, erreur };
  };

  if (!emailValide(destinataire)) return journaliser('echec', 'Adresse invalide');
  if (!objet) return journaliser('echec', 'Objet vide');

  if (!smtpConfigure()) {
    console.info(`[mailer] SIMULATION → ${destinataire} : ${objet}`);
    return journaliser('simule');
  }

  try {
    // Import tardif : la dépendance n'est chargée que si un envoi réel a lieu.
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === '1',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // Le texte brut reste envoyé en parallèle du HTML : certains clients ne
    // rendent pas le HTML, et un message illisible vaut un message perdu.
    const info = await transport.sendMail({
      from: expediteur(),
      to: destinataire_nom ? `${destinataire_nom} <${destinataire}>` : destinataire,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject: objet,
      text: corps,
      ...(html ? { html } : {}),
      ...((() => { const jointes = avecLogo(html, pieces); return jointes.length ? { attachments: jointes } : {}; })()),
    });

    return journaliser('envoye', '', info?.messageId || '');
  } catch (e) {
    console.error('[mailer] échec envoi :', e.message);
    return journaliser('echec', String(e.message).slice(0, 500));
  }
}

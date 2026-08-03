import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { enrollLearnerInSession } from '@/lib/inscription-flow';
import { formulaireDeSession, verifierReponses, resumePositionnement } from '@/lib/formulaire-inscription.mjs';
import { accuserInscription, prevenirOrganisme } from '@/lib/email-inscription.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Rattacher l'inscription à une fiche entreprise, depuis le SIRET déclaré.
 *
 * C'est le chaînon qui manquait. Jusqu'ici le formulaire enregistrait le nom
 * de l'entreprise en texte libre dans une colonne de la fiche apprenant, et
 * rien ne reliait cette chaîne de caractères à la table des entreprises :
 * l'espace entreprise ne pouvait donc jamais se remplir, et il fallait
 * rattacher chaque apprenant à la main.
 *
 * Le SIRET est la bonne clé, parce que c'est la seule qui ne change pas
 * quand quelqu'un écrit « Flag Training » un jour et « FLAG TRAINING SAS »
 * le lendemain.
 *
 * Les contacts déclarés deviennent des contacts de la fiche. Ce n'est pas du
 * zèle : c'est leur adresse qui leur ouvrira l'espace entreprise, et c'est
 * au signataire que partira la convention.
 */
function rattacherEntreprise(db, { siret, raisonSociale, adresse, signataireNom, signataireEmail, factureEmail }) {
  const chiffres = String(siret || '').replace(/\D/g, '');
  if (chiffres.length !== 14) return null;

  let client = db.prepare("SELECT id FROM clients WHERE replace(replace(siret, ' ', ''), '-', '') = ?").get(chiffres);
  if (!client) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO clients (id, company, siret, address, email)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, raisonSociale || 'Entreprise', chiffres, adresse || '', signataireEmail || '');
    client = { id };
  } else if (raisonSociale) {
    // Une fiche créée à la volée porte parfois un nom provisoire : on le
    // complète, on n'écrase jamais un nom déjà saisi à la main.
    db.prepare("UPDATE clients SET company = CASE WHEN COALESCE(company, '') IN ('', 'Entreprise') THEN ? ELSE company END WHERE id = ?")
      .run(raisonSociale, client.id);
  }

  const ajouterContact = (email, nom, role) => {
    if (!email || !EMAIL_RE.test(email)) return;
    const deja = db.prepare('SELECT id FROM client_contacts WHERE client_id = ? AND lower(email) = ?')
      .get(client.id, email.toLowerCase());
    if (deja) return;
    const [prenom = '', ...reste] = String(nom || '').split(/\s+/);
    db.prepare(`
      INSERT INTO client_contacts (id, client_id, first_name, last_name, role, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), client.id, prenom, reste.join(' '), role, email);
  };
  ajouterContact(signataireEmail, signataireNom, 'Signataire de la convention');
  ajouterContact(factureEmail, '', 'Facturation');

  return client.id;
}

function registrationContext(db, token) {
  const link = db.prepare(`
    SELECT * FROM session_registration_links
    WHERE token = ? AND is_active = 1
  `).get(token);
  if (!link) return { error: 'Ce lien d’inscription est introuvable ou n’est plus actif.', status: 404 };
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { error: 'Ce lien d’inscription a expiré.', status: 410 };
  }
  const session = db.prepare(`
    SELECT s.id, s.start_date, s.end_date, s.location, s.modality, s.max_participants, s.status,
      s.client_id,
      f.title AS formation_title, f.prerequisites, s.horaire, s.adresse
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    WHERE s.id = ?
  `).get(link.session_id);
  if (!session) return { error: 'Cette session n’existe plus.', status: 404 };
  if (['cancelled', 'annulee', 'annulée', 'completed', 'terminee', 'terminée', 'archived', 'archivee', 'archivée'].includes(String(session.status || '').toLowerCase())) {
    return { error: 'Les inscriptions pour cette session sont fermées.', status: 410 };
  }
  return { link, session };
}

function sessionPayload(db, session) {
  const enrolled = db.prepare(`
    SELECT COUNT(*) AS total FROM inscriptions
    WHERE session_id = ? AND status != 'annule'
  `).get(session.id)?.total || 0;
  const capacity = Number(session.max_participants || 0);
  return {
    title: session.formation_title || 'Session de formation',
    startDate: session.start_date,
    endDate: session.end_date,
    location: session.location || '',
    modality: session.modality || '',
    seatsRemaining: capacity > 0 ? Math.max(0, capacity - enrolled) : null,
  };
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const context = registrationContext(db, token);
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
    const { champs, suite, financement } = formulaireDeSession(db, context.session.id);
    return NextResponse.json({ session: sessionPayload(db, context.session), champs, suite, financement });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Impossible de charger ce formulaire.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const db = getDb();
    const context = registrationContext(db, token);
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Formulaire invalide.' }, { status: 400 }); }
    const firstName = text(body?.firstName, 100);
    const lastName = text(body?.lastName, 100);
    const email = text(body?.email, 160).toLowerCase();
    const phone = text(body?.phone, 40) || text(body?.reponses?.phone, 40);
    // La raison sociale du bloc financement fait foi ; l'ancien champ libre
    // « Entreprise ou structure » reste accepté, le temps que les
    // formulaires personnalisés d'avant la séparation s'éteignent.
    const company = text(body?.reponses?.raisonSociale, 160) || text(body?.company, 160);

    if (!firstName || !lastName || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Prénom, nom et une adresse e-mail valide sont requis.' }, { status: 400 });
    }
    if (!body?.consent) return NextResponse.json({ error: 'Votre accord pour traiter cette inscription est requis.' }, { status: 400 });

    // Les questions propres à ce programme, contrôlées côté serveur : le
    // formulaire du navigateur peut être contourné, pas celui-ci.
    const { champs, suite } = formulaireDeSession(db, context.session.id);
    const controle = verifierReponses(champs, body?.reponses || {});
    if (controle.erreur) return NextResponse.json({ error: controle.erreur }, { status: 400 });

    let learner = db.prepare(`
      SELECT id, first_name, last_name, email, phone, company FROM apprenants
      WHERE lower(trim(email)) = ?
      ORDER BY created_at ASC LIMIT 1
    `).get(email);

    const existing = learner
      ? db.prepare('SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?').get(context.session.id, learner.id)
      : null;
    if (!existing && Number(context.session.max_participants || 0) > 0) {
      const enrolled = db.prepare(`SELECT COUNT(*) AS total FROM inscriptions WHERE session_id = ? AND status != 'annule'`).get(context.session.id)?.total || 0;
      if (enrolled >= Number(context.session.max_participants)) {
        return NextResponse.json({ error: 'Cette session est complète.' }, { status: 409 });
      }
    }

    if (learner) {
      db.prepare(`
        UPDATE apprenants SET first_name = ?, last_name = ?, phone = ?, company = ? WHERE id = ?
      `).run(firstName, lastName, phone || learner.phone || '', company || learner.company || '', learner.id);
      learner = db.prepare('SELECT id, first_name, last_name, email FROM apprenants WHERE id = ?').get(learner.id);
    } else {
      const learnerId = randomUUID();
      db.prepare(`
        INSERT INTO apprenants (id, first_name, last_name, email, phone, company)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(learnerId, firstName, lastName, email, phone, company);
      learner = { id: learnerId, first_name: firstName, last_name: lastName, email };
    }

    /*
     * Le rattachement à l'entreprise, avant l'inscription : si la fiche
     * entreprise doit être créée, autant qu'elle le soit avant que quoi que
     * ce soit d'autre ne s'écrive.
     */
    const rep = body?.reponses || {};

    /*
     * En intra, l'entreprise est déjà connue : c'est celle de la session.
     *
     * Depuis que le bloc financement ne s'affiche plus en intra, personne ne
     * saisit plus de SIRET sur ces formulaires, et le rattachement par SIRET
     * ne se déclenche donc jamais : les salariés arrivaient sans employeur,
     * et l'espace entreprise restait vide pour eux. Il n'y a rien à demander,
     * il y a à recopier ce que la session sait déjà.
     *
     * Une seule entreprise, sinon on ne devine pas : une session à deux
     * clients n'apprend pas de quel côté ranger un inscrit.
     */
    const clientsSession = [...new Set([
      ...db.prepare("SELECT client_id FROM session_clients WHERE session_id = ? AND COALESCE(client_id, '') <> ''")
        .all(context.session.id).map((r) => r.client_id),
      ...(context.session.client_id ? [context.session.client_id] : []),
    ])];
    if (clientsSession.length === 1) {
      db.prepare("UPDATE apprenants SET client_id = ? WHERE id = ? AND COALESCE(client_id, '') = ''")
        .run(clientsSession[0], learner.id);
    }

    if (['Mon employeur', 'Un OPCO'].includes(text(rep.financement, 60))) {
      try {
        const clientId = rattacherEntreprise(db, {
          siret: rep.siret,
          raisonSociale: text(rep.raisonSociale, 160),
          adresse: text(rep.adresseFacturation, 400),
          signataireNom: text(rep.signataireNom, 120),
          signataireEmail: text(rep.signataireEmail, 160).toLowerCase(),
          factureEmail: text(rep.factureEmail, 160).toLowerCase(),
        });
        if (clientId) {
          db.prepare("UPDATE apprenants SET client_id = ? WHERE id = ? AND COALESCE(client_id, '') = ''")
            .run(clientId, learner.id);
        }
      } catch (e) {
        // Une inscription ne se perd pas pour un SIRET mal saisi : on la
        // garde, et le rattachement se fera à la main depuis la fiche.
        console.warn('[inscription] rattachement entreprise impossible :', e.message);
      }
    }

    const enrollment = enrollLearnerInSession(db, { sessionId: context.session.id, apprenantId: learner.id, session: context.session });

    /*
     * Le formulaire tient lieu d'entretien préalable : ses réponses sont la
     * trace de positionnement à l'entrée. On les range sur l'inscription, en
     * clair à côté du brut, pour qu'un auditeur n'ait pas à ouvrir du JSON
     * pour savoir ce que la personne a déclaré. Le financement déclaré
     * alimente le champ prévu pour lui.
     */
    const financement = controle.reponses.find((r) => r.cle === 'financement')?.valeur || '';
    if (controle.reponses.length) {
      db.prepare(`
        UPDATE inscriptions
        SET reponses_inscription = ?,
            positionnement_notes = CASE WHEN COALESCE(positionnement_notes, '') = ''
                                        THEN ? ELSE positionnement_notes END,
            financement = CASE WHEN COALESCE(financement, '') = '' AND ? <> ''
                               THEN ? ELSE financement END
        WHERE session_id = ? AND apprenant_id = ?
      `).run(
        JSON.stringify(controle.reponses),
        resumePositionnement(controle.reponses),
        financement, financement,
        context.session.id, learner.id,
      );
    }

    /*
     * L'accusé de réception part maintenant, pas plus tard.
     *
     * Jusqu'ici la personne voyait un écran et rien d'autre : si elle fermait
     * l'onglet, il ne lui restait aucune trace de sa démarche, et l'organisme
     * ne savait pas qu'une demande était arrivée tant qu'il n'allait pas
     * regarder.
     *
     * Un envoi qui échoue ne doit pas faire échouer l'inscription : elle est
     * enregistrée, c'est le principal. On avale donc l'erreur après l'avoir
     * consignée, plutôt que de renvoyer un 500 à quelqu'un dont la demande
     * est bel et bien passée.
     */
    if (!enrollment.alreadyEnrolled) {
      const reglages = Object.fromEntries(
        db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]),
      );
      const capacite = Number(context.session.max_participants || 0);
      const inscrits = db.prepare(
        "SELECT COUNT(*) AS n FROM inscriptions WHERE session_id = ? AND status != 'annule'",
      ).get(context.session.id)?.n || 0;

      const infos = {
        apprenant: { ...learner, email },
        session: { ...context.session, formation_titre: context.session.formation_title },
        reglages,
      };

      /*
       * Pas de programme en pièce jointe ici, et c'est délibéré.
       *
       * Le programme envoyé avant l'entretien est forcément le programme
       * générique. Or c'est l'appel de positionnement qui dit à quoi la
       * session ressemblera pour cette personne-là. Envoyer le générique
       * maintenant oblige à en renvoyer un second après, et c'est ainsi
       * qu'on se retrouve avec deux versions en circulation.
       *
       * Le programme part donc avec la confirmation d'inscription, après
       * l'entretien. accuserInscription accepte des pièces jointes : le jour
       * où un programme personnalisé existe, il se branche ici.
       */
      try {
        await accuserInscription({ ...infos, suite, financement });
      } catch (e) { console.warn('[inscription] accusé non envoyé :', e.message); }

      try {
        await prevenirOrganisme({
          ...infos,
          reponses: controle.reponses,
          placesRestantes: capacite > 0 ? Math.max(0, capacite - inscrits) : null,
        });
      } catch (e) { console.warn('[inscription] notification non envoyée :', e.message); }
    }

    return NextResponse.json({
      ok: true,
      alreadyRegistered: enrollment.alreadyEnrolled,
      learner: { firstName: learner.first_name, lastName: learner.last_name },
      questionnairesPrepared: enrollment.questionnaireLinks.map((item) => item.questionnaire_type),
      suite,
    }, { status: enrollment.alreadyEnrolled ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Impossible de finaliser l’inscription.' }, { status: 500 });
  }
}

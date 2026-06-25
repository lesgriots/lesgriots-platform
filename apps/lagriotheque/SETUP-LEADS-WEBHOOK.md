# Webhook leads — formation "Télécharger le programme"

## Vue d'ensemble

Quand un visiteur remplit le formulaire **"Télécharger le programme"** sur une
page formation de lagriotheque.com, deux choses se passent en parallèle :

1. **Côté navigateur** — Le PDF du programme se télécharge directement sur
   l'appareil du visiteur. Pas d'attente d'email, c'est immédiat.
2. **Côté serveur (Make.com)** — Le frontend POST un JSON vers le webhook Make.
   Make orchestre :
   - **Notion** — Ajoute le lead dans *Leads formations — La Griothèque*
   - **Gmail** — Envoie un mail de **remerciement + lien prise de RDV**
     (Cal.com / Calendly). PAS le PDF — il l'a déjà.
   - **Notification Moos** — Mail/Slack avec récap du lead

Si le webhook est en erreur, le frontend bascule sur un `mailto:` avec les
coordonnées préremplies → on ne perd jamais un lead. Le PDF se télécharge dans
tous les cas.

## PDF des programmes

Convention : `apps/lagriotheque/img/programmes/{formation-id}.pdf`

Exemple :
- `img/programmes/rs-crea-2-8.pdf`
- `img/programmes/strategie-de-marque.pdf`

Override possible via `formation.programmePdfUrl` dans `data.jsx` si on
héberge ailleurs (Drive public, S3…).

---

## 1. Notion — déjà créé ✅

**Base de leads :** [Leads formations — La Griothèque](https://app.notion.com/p/dfdaed5aa1c442dea7932e4833dd849f)
- Parent : 📚 LA GRIOTHÈQUE
- Data source ID : `b0599f89-e1c8-474f-810c-3adff2c0a23c`

Champs :
- **Prénom** *(title)*, **Nom**, **Email**, **Téléphone**
- **Formation demandée**, **Formation ID**, **Code RS**, **Prix HT**, **Éligible CPF**
- **Statut** *(Pas commencé / En cours / Terminé)* — à personnaliser en `Nouveau /
  Programme envoyé / Contacté / Inscrit / Perdu` dans Notion
- **Source**, **URL page**, **Date demande**, **Notes**

---

## 2. Préparer les PDF programmes

Un PDF par formation, hébergé sur un stockage stable (Drive partagé,
Notion file public, S3…). Convention de nommage :

```
programme-{formation-id}.pdf
```

Exemple : `programme-rs-crea-2-8.pdf`

Note la URL publique de chaque PDF. On utilisera `formation.id` envoyé par
le frontend pour résoudre l'URL côté Make.

---

## 3. Scénario Make.com à créer

### Modules à enchaîner

| # | Module                            | Action |
|---|-----------------------------------|--------|
| 1 | **Webhooks** → Custom webhook     | Reçoit le POST JSON du formulaire |
| 2 | **Notion** → Create database item | Crée le lead dans la base ci-dessus |
| 3 | *(Router)* — branche A            | Mail au lead |
| 4 | **Gmail** → Send email            | **Remerciement + lien Cal.com** (pas de PDF !) |
| 5 | *(Router)* — branche B            | Notif interne |
| 6 | **Gmail** → Send email            | Mail à Moos avec récap du lead |

⚠️ **Le PDF n'est PAS envoyé par mail.** Il a déjà été téléchargé côté
navigateur au moment du clic. Le mail Gmail au lead est juste un mail de
**prise de RDV** avec un lien Cal.com / Calendly + remerciement.

### Schéma du payload reçu (module 1)

Configure le webhook Make pour parser ce JSON :

```json
{
  "firstName": "Aïcha",
  "lastName": "Diallo",
  "email": "aicha@example.com",
  "phone": "+33612345678",
  "formation": {
    "id": "rs-crea-2-8",
    "title": "Formation Communiquer sur les réseaux sociaux",
    "cpf": true,
    "rs": "RS7200",
    "price": "1500€"
  },
  "consent": true,
  "source": "lagriotheque-download-modal",
  "submittedAt": "2026-06-16T14:32:00.000Z",
  "pageUrl": "https://lagriotheque.com/#/formations/rs-crea-2-8"
}
```

### Mapping Notion (module 2)

| Champ Notion         | Source webhook                                   |
|----------------------|--------------------------------------------------|
| Prénom               | `firstName`                                      |
| Nom                  | `lastName`                                       |
| Email                | `email`                                          |
| Téléphone            | `phone`                                          |
| Formation demandée   | `formation.title`                                |
| Formation ID         | `formation.id`                                   |
| Code RS              | `formation.rs`                                   |
| Prix HT              | `formation.price`                                |
| Éligible CPF         | `formation.cpf`                                  |
| Source               | `source`                                         |
| URL page             | `pageUrl`                                        |
| Statut               | (laisser vide → défaut "Pas commencé")           |

### Gmail au lead — Remerciement (module 4) — version minimale

- **À :** `{{1.email}}`
- **De :** `formations@lesgriots.com`
- **Sujet :** `Merci pour ton intérêt pour "{{1.formation.title}}" 🙏`
- **Type de contenu :** HTML
- **PAS DE PIÈCE JOINTE** — le PDF a déjà été téléchargé côté navigateur.
- **Corps :**

  ```html
  <p>Bonjour {{1.firstName}},</p>

  <p>Merci d'avoir téléchargé le programme de
  <strong>{{1.formation.title}}</strong> — tu dois le retrouver dans tes
  téléchargements.</p>

  <p>Je te recontacte sous 24-48h pour répondre à tes questions et voir
  ensemble si la formation correspond bien à ton projet.</p>

  <p>À très vite,<br>
  <strong>Moos Coulibaly</strong><br>
  LA GRIOTHÈQUE</p>
  ```

  C'est volontairement court — pas de Cal.com à configurer, tu recontactes
  manuellement quand tu vois passer le lead dans Notion.

### Notif Moos (module 6)

- **À :** `moos@lesgriots.com` (ou Slack si tu préfères)
- **Sujet :** `🆕 Lead — {{firstName}} {{lastName}} · {{formation.title}}`
- **Corps :**
  ```
  Nouveau lead pour {{formation.title}}

  {{firstName}} {{lastName}}
  📧 {{email}}
  📞 {{phone}}

  Prix : {{formation.price}}
  CPF : {{formation.cpf}}

  Demande reçue le {{submittedAt}}
  Page : {{pageUrl}}

  → Notion : https://app.notion.com/p/dfdaed5aa1c442dea7932e4833dd849f
  ```

### Réponse au frontend

Make doit retourner un `200 OK` (n'importe quel JSON, le frontend ne lit pas
le body). Si le scénario réussit, le visiteur voit l'écran de remerciement.

---

## 4. Brancher le webhook côté site ✅ déjà fait

Webhook créé et déjà collé dans `apps/lagriotheque/data.jsx` :

```js
"leadsWebhookUrl": "https://hook.eu2.make.com/4cto3sd9wfc4sddpryb0h34hf7793i31"
```

Scénario Make.com créé : **id 9397890** (zone eu2.make.com, team "My Team",
organisation LES GRIOTS). Pour l'instant il ne contient QUE le trigger webhook
— tu dois ajouter les modules Notion + Gmail dans l'UI Make puis l'activer.

**Connexions disponibles dans Make pour le câblage** :
- `My Notion Public connection` (id 13893065) — pour le module Notion
- `My Google Restricted connection` (id 13901899) — pour les modules Gmail
  (déjà utilisée par tes autres scénarios Pré-inscription / Devis)

---

## 5. Tests

1. Visite une page formation, ouvre la modale "Télécharger le programme"
2. Remplis le form avec tes vraies coordonnées
3. Vérifie :
   - ✅ Lead créé dans Notion avec tous les champs
   - ✅ PDF reçu dans ton inbox
   - ✅ Notification Moos reçue
4. Désactive temporairement le scénario Make → soumets à nouveau
   → vérifie que ton client mail s'ouvre avec le mailto fallback (=
   on ne perd pas le lead même en cas de panne)

---

## Optionnel — Séquence de nurturing

Pour aller plus loin, branche le scénario Make sur un outil d'email marketing
(Mailerlite, Brevo, Resend) :

- **J+0** : envoi du PDF (déjà géré)
- **J+3** : "T'as eu le temps de regarder le programme ?"
- **J+7** : "Voici une session qui démarre le X"
- **J+14** : "Une question avant de t'inscrire ?"

Si le lead s'inscrit → le scénario s'arrête (champ Statut = "Inscrit" dans
Notion → trigger qui sort le lead de la séquence).

#!/usr/bin/env python3
"""
LES GRIOTS — Générateur NDA (Accord de confidentialité) FR.

Génère un accord de confidentialité réciproque entre LES GRIOTS SASU
et le client (personne morale ou physique).

Structure :
  - Header : titre + référence
  - Parties (LES GRIOTS + Client)
  - 10 articles : objet, informations confidentielles, obligations,
    exceptions, durée, restitution, propriété, non-engagement,
    juridiction, signatures
  - Disclaimer juridique
  - Bloc signature 2 colonnes

Usage: echo '<json>' | python3 generate_nda.py

JSON attendu :
{
  "client": { company, firstName, lastName, email, address, siret, title },
  "context": "Discussions autour du projet X",  # objet de l'échange (optionnel)
  "duration_years": 3,                          # durée confidentialité (default 3)
  "signed_at": "Paris",                         # lieu (default Paris)
  "date": "2026-05-13"                          # date (default today)
}
"""
import sys
import json
import io
from datetime import datetime

from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.lib.units import mm
from reportlab.lib import colors

from legal_common import (
    W, H, MARGIN, PAPER, SURFACE, INK, INK2, INK3, HAIR, TERRACOTTA,
    LES_GRIOTS,
    make_styles, hr, page_header_footer, signature_block,
    disclaimer_text, fmt_date_fr, safe, client_display_name, client_signatory,
)


def build_nda(payload):
    """Construit la liste de Flowables du NDA."""
    client = payload.get("client") or {}
    context = safe(payload.get("context"), "des discussions et échanges professionnels")
    duration = int(payload.get("duration_years") or 3)
    place = safe(payload.get("signed_at"), "Paris")
    date_str = fmt_date_fr(payload.get("date"))

    styles = make_styles()
    story = []

    # ── Titre ──
    story.append(Paragraph("Accord de confidentialité", styles["title"]))
    story.append(Paragraph(
        f"Accord réciproque · {place}, le {date_str}",
        styles["subtitle"],
    ))

    # ── Parties ──
    story.append(Paragraph("ENTRE LES SOUSSIGNÉS", styles["section"]))
    story.append(hr())

    story.append(Paragraph("<b>D'une part,</b>", styles["body_left"]))
    story.append(Paragraph(
        f"<b>{LES_GRIOTS['nom_legal']}</b>, {LES_GRIOTS['forme']} au capital de "
        f"{LES_GRIOTS['capital']}, immatriculée au RCS de {LES_GRIOTS['rcs']}, "
        f"dont le siège social est situé {LES_GRIOTS['siege']}, "
        f"représentée par <b>{LES_GRIOTS['representant_nom']}</b>, "
        f"en qualité de {LES_GRIOTS['representant_titre']}, dûment habilité aux fins des présentes,",
        styles["body"],
    ))
    story.append(Paragraph(
        "Ci-après dénommée « <b>LES GRIOTS</b> »,",
        styles["body_left"],
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>D'autre part,</b>", styles["body_left"]))

    company = safe(client.get("company"))
    sign_name, sign_title, sign_email = client_signatory(client)
    siret = safe(client.get("siret"))
    address = safe(client.get("address"))

    if company:
        client_intro = f"<b>{company}</b>"
        if siret:
            client_intro += f", immatriculée sous le numéro SIRET {siret}"
        if address:
            client_intro += f", dont le siège est situé {address}"
        client_intro += f", représentée par <b>{sign_name}</b>"
        if sign_title and sign_title != "[Fonction]":
            client_intro += f", en qualité de {sign_title}"
        client_intro += ", dûment habilité·e aux fins des présentes,"
    else:
        client_intro = f"<b>{sign_name}</b>"
        if address:
            client_intro += f", demeurant {address}"
        client_intro += ","

    story.append(Paragraph(client_intro, styles["body"]))
    story.append(Paragraph(
        "Ci-après dénommé·e « <b>le Bénéficiaire</b> »,",
        styles["body_left"],
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Ensemble dénommées « <b>les Parties</b> » et individuellement « <b>une Partie</b> ».",
        styles["body_left"],
    ))

    # ── Préambule ──
    story.append(Paragraph("PRÉAMBULE", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        f"Les Parties envisagent, dans le cadre de {context}, de s'échanger des informations "
        f"de nature confidentielle. Elles entendent encadrer par le présent accord les conditions "
        f"de divulgation, de protection et d'utilisation desdites informations.",
        styles["body"],
    ))
    story.append(Paragraph(
        "Il a été convenu et arrêté ce qui suit :",
        styles["body_left"],
    ))

    # ── Articles ──
    articles = [
        ("Article 1 — Objet",
         "Le présent accord a pour objet de définir les conditions dans lesquelles "
         "les Parties s'engagent à préserver la confidentialité des Informations Confidentielles "
         "qu'elles seraient amenées à se communiquer mutuellement."),

        ("Article 2 — Définition des Informations Confidentielles",
         "Sont qualifiées d'« Informations Confidentielles » toutes les informations, "
         "données, documents, savoir-faire, stratégies, fichiers, créations, plans, "
         "tarifs, listes de clients ou prestataires, méthodes ou éléments techniques, "
         "commerciaux ou financiers, sous quelque forme que ce soit (écrite, orale, "
         "graphique, numérique, électronique), communiqués entre les Parties dans le cadre "
         "de leurs échanges, qu'ils soient ou non expressément identifiés comme confidentiels."),

        ("Article 3 — Obligations des Parties",
         "Chaque Partie s'engage à : (i) ne pas divulguer les Informations Confidentielles "
         "à des tiers sans accord écrit préalable de la Partie émettrice ; (ii) n'utiliser "
         "les Informations Confidentielles que dans le cadre strict du présent accord ; "
         "(iii) appliquer aux Informations Confidentielles au moins le même degré de "
         "protection que celui qu'elle applique à ses propres informations confidentielles, "
         "et en tout état de cause un degré raisonnable de protection ; "
         "(iv) limiter l'accès aux Informations Confidentielles à ses préposés, salariés, "
         "sous-traitants ou conseils ayant strictement besoin d'en connaître pour l'exécution "
         "des présentes, sous réserve qu'ils soient soumis à une obligation de confidentialité "
         "équivalente."),

        ("Article 4 — Exceptions",
         "Ne sont pas considérées comme Informations Confidentielles les informations qui : "
         "(a) sont ou tombent dans le domaine public sans manquement de la Partie réceptrice ; "
         "(b) étaient déjà légitimement connues de la Partie réceptrice avant divulgation ; "
         "(c) ont été obtenues légitimement d'un tiers non soumis à une obligation de "
         "confidentialité ; (d) ont été développées indépendamment par la Partie réceptrice ; "
         "(e) doivent être divulguées en vertu d'une obligation légale, réglementaire ou "
         "d'une décision de justice, sous réserve d'en informer préalablement et sans délai "
         "la Partie émettrice."),

        ("Article 5 — Durée",
         f"Le présent accord prend effet à compter de sa signature et reste en vigueur "
         f"pendant toute la durée des échanges entre les Parties, et perdure pendant une "
         f"durée de <b>{duration} ({duration_in_words(duration)}) ans</b> à compter de la "
         f"dernière communication d'Informations Confidentielles."),

        ("Article 6 — Restitution / destruction",
         "À première demande de la Partie émettrice, et en tout état de cause à l'expiration "
         "du présent accord, chaque Partie restituera ou détruira, selon les instructions reçues, "
         "l'ensemble des Informations Confidentielles en sa possession (originaux, copies, "
         "supports numériques inclus) et attestera par écrit de cette restitution ou destruction."),

        ("Article 7 — Propriété intellectuelle",
         "Les Informations Confidentielles restent l'entière propriété de la Partie qui les "
         "communique. Le présent accord n'emporte aucune cession ni licence, expresse ou "
         "implicite, de droit de propriété intellectuelle au profit de la Partie réceptrice. "
         "Toute exploitation devra faire l'objet d'un accord écrit séparé."),

        ("Article 8 — Absence d'engagement",
         "Le présent accord ne crée aucune obligation pour les Parties de poursuivre les "
         "discussions ni de conclure tout autre accord, partenariat ou prestation. Aucune "
         "des Parties n'est tenue de divulguer des Informations Confidentielles."),

        ("Article 9 — Données personnelles (RGPD)",
         "Dans la mesure où l'exécution des présentes implique le traitement de données à "
         "caractère personnel, chaque Partie s'engage à respecter le Règlement (UE) 2016/679 "
         "(RGPD) et la loi Informatique et Libertés modifiée. Les Parties limiteront le "
         "traitement aux seules données strictement nécessaires."),

        ("Article 10 — Droit applicable et juridiction",
         "Le présent accord est régi par le droit français. En cas de différend relatif "
         "à son interprétation ou à son exécution, les Parties s'engagent à rechercher une "
         "solution amiable. À défaut, compétence exclusive est attribuée aux tribunaux "
         "compétents du ressort de la Cour d'appel de Paris."),
    ]

    for title, body in articles:
        story.append(Paragraph(title, styles["article_num"]))
        story.append(Paragraph(body, styles["body"]))

    # ── Signature ──
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Fait à <b>{place}</b>, le <b>{date_str}</b>, en deux exemplaires originaux.",
        styles["body_left"],
    ))
    story.append(Spacer(1, 6 * mm))

    story.append(signature_block(
        "Pour LES GRIOTS",
        [
            (LES_GRIOTS["representant_titre"], LES_GRIOTS["representant_nom"]),
            ("Email", LES_GRIOTS["email"]),
        ],
        "Pour le Bénéficiaire",
        [
            ("Nom et fonction", f"{sign_name}" + (f" — {sign_title}" if sign_title and sign_title != '[Fonction]' else "")),
            ("Email", sign_email or "_________________"),
            ("Société", company or "_________________"),
        ],
    ))

    # ── Disclaimer ──
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(disclaimer_text(short=True), styles["disclaimer"]))

    return story


def duration_in_words(n):
    """Convertit 1..10 en mots français."""
    words = {1: "un", 2: "deux", 3: "trois", 4: "quatre", 5: "cinq",
             6: "six", 7: "sept", 8: "huit", 9: "neuf", 10: "dix"}
    return words.get(n, str(n))


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 4 * mm, bottomMargin=MARGIN,
        title="NDA — LES GRIOTS",
        author="LES GRIOTS",
    )

    frame = Frame(
        MARGIN, MARGIN,
        W - 2 * MARGIN, H - 2 * MARGIN - 8 * mm,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    def on_page(canvas, doc):
        page_header_footer(canvas, doc, "Accord de confidentialité", "NDA")

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=on_page),
    ])

    story = build_nda(payload)
    doc.build(story)

    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

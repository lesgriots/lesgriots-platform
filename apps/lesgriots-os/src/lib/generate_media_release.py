#!/usr/bin/env python3
"""
LES GRIOTS — Générateur Cession de droit à l'image FR.

Génère une autorisation d'enregistrement et de diffusion conforme :
  - art. 9 Code civil (droit à l'image)
  - art. L.121-1 à L.121-2 CPI (droit moral des artistes-interprètes si applicable)
  - RGPD (Règlement UE 2016/679) — finalité, durée, droit d'accès et de retrait

Document à faire signer par chaque personne apparaissant dans une captation :
interviewé·e, figurant·e, intervenant·e, participant·e à un événement filmé.

Structure :
  - Header
  - Identité de la personne autorisant l'enregistrement
  - Identité du projet et du producteur (LES GRIOTS)
  - 8 articles : objet, supports, exploitations, durée et territoire,
    gratuité, RGPD, droit moral, juridiction
  - Bloc signature
  - Disclaimer

Usage: echo '<json>' | python3 generate_media_release.py
"""
import sys
import json
import io

from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.lib.units import mm

from legal_common import (
    W, H, MARGIN, PAPER, INK, INK2, INK3, HAIR, TERRACOTTA,
    LES_GRIOTS,
    make_styles, hr, page_header_footer, signature_block,
    disclaimer_text, fmt_date_fr, safe,
)


def build_release(payload):
    """Construit la liste de Flowables."""
    project = payload.get("project") or {}
    client = payload.get("client") or {}
    place = safe(payload.get("signed_at"), "Paris")
    date_str = fmt_date_fr(payload.get("date"))
    duration = safe(payload.get("duration"), "10 (dix) ans")
    territory = safe(payload.get("territory"), "monde entier")

    styles = make_styles()
    story = []

    # ── Titre ──
    story.append(Paragraph("Autorisation de captation et de diffusion", styles["title"]))
    story.append(Paragraph(
        f"Droit à l'image · Droit à la voix · {place}, le {date_str}",
        styles["subtitle"],
    ))

    # ── Encadré projet ──
    project_name = safe(project.get("name"), "[Nom du projet]")
    project_code = safe(project.get("code"))
    pillar = safe(project.get("pillar"))
    project_client = safe(project.get("client") or (client.get("company") if client else ""))

    proj_rows = [
        ["Projet", project_name],
        ["Réf. interne", project_code or "—"],
        ["Pilier", pillar or "Production"],
    ]
    if project_client:
        proj_rows.append(["Commanditaire", project_client])

    tbl = Table(proj_rows, colWidths=[40 * mm, (W - 2 * MARGIN) - 40 * mm])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), INK3),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HAIR),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8 * mm))

    # ── Identité de la personne autorisant ──
    story.append(Paragraph("La personne soussignée", styles["section"]))
    story.append(hr())

    story.append(Paragraph(
        "<b>Je soussigné·e</b> (à compléter ci-dessous) :",
        styles["body_left"],
    ))

    person_rows = [
        ["Nom et prénom", "_______________________________________________"],
        ["Né·e le", "____ / ____ / ________"],
        ["Adresse", "_______________________________________________"],
        ["Email", "_______________________________________________"],
        ["Téléphone", "_______________________________________________"],
        ["Pour mineur·e — Représentant·e légal·e", "_______________________________________________"],
    ]
    tbl2 = Table(person_rows, colWidths=[58 * mm, (W - 2 * MARGIN) - 58 * mm])
    tbl2.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), INK2),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HAIR),
    ]))
    story.append(tbl2)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(
        "Ci-après dénommé·e « <b>l'Intervenant·e</b> »,",
        styles["body_left"],
    ))

    # ── Identité du producteur ──
    story.append(Paragraph("Le producteur", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        f"<b>{LES_GRIOTS['nom_legal']}</b>, {LES_GRIOTS['forme']} au capital de "
        f"{LES_GRIOTS['capital']}, immatriculée au RCS de {LES_GRIOTS['rcs']}, "
        f"siège social {LES_GRIOTS['siege']}, représentée par "
        f"{LES_GRIOTS['representant_nom']}, {LES_GRIOTS['representant_titre']}.",
        styles["body"],
    ))
    story.append(Paragraph(
        "Ci-après dénommée « <b>le Producteur</b> ».",
        styles["body_left"],
    ))

    # ── Préambule ──
    story.append(Paragraph("Préambule", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        f"L'Intervenant·e participe à la captation organisée par le Producteur dans le cadre "
        f"du projet « <b>{project_name}</b> » désigné ci-dessus. La présente autorisation a "
        f"pour objet d'encadrer les conditions d'enregistrement, de fixation et d'exploitation "
        f"de son image, de sa voix et de ses propos.",
        styles["body"],
    ))

    # ── Articles ──
    articles = [
        ("Article 1 — Autorisation",
         "L'Intervenant·e autorise expressément le Producteur à le/la filmer, photographier, "
         "enregistrer (image et son), interviewer dans le cadre du Projet ci-dessus désigné. "
         "Cette autorisation porte sur l'ensemble des prises de vues et de sons réalisées "
         "par le Producteur ou par toute personne dûment mandatée par lui."),

        ("Article 2 — Étendue de l'exploitation",
         "L'Intervenant·e autorise le Producteur, et tout cessionnaire qu'il aura désigné, "
         "à reproduire, représenter, diffuser, exploiter et adapter tout ou partie des "
         "enregistrements réalisés, sur tous supports connus ou inconnus à ce jour, "
         "notamment : (i) supports audiovisuels (film, série, documentaire, capsule, podcast) ; "
         "(ii) supports numériques (sites web, réseaux sociaux, plateformes de streaming, "
         "newsletters, applications mobiles) ; (iii) supports de communication "
         "(bandes-annonces, teasers, making-of, supports promotionnels) ; (iv) supports "
         "imprimés (presse, dossier de presse, communication interne)."),

        ("Article 3 — Modifications et adaptations",
         "L'Intervenant·e autorise le Producteur à effectuer tout montage, modification, "
         "traduction, sous-titrage, doublage ou adaptation des enregistrements, dès lors "
         "que cela ne porte pas atteinte à son honneur, à sa réputation ou ne déforme pas "
         "ses propos d'une manière contraire à sa pensée."),

        ("Article 4 — Durée et territoire",
         f"La présente autorisation est consentie pour une durée de <b>{duration}</b> "
         f"à compter de la date de signature, pour une diffusion sur le <b>{territory}</b>, "
         f"et pour le nombre d'exploitations que le Producteur jugera utiles dans la limite "
         f"du présent contrat."),

        ("Article 5 — Caractère gratuit",
         "La présente autorisation est consentie à titre gratuit. L'Intervenant·e renonce "
         "à toute rémunération au titre des exploitations ci-dessus définies. "
         "Cette renonciation ne prive pas l'Intervenant·e des droits dont il/elle pourrait "
         "bénéficier en tant qu'artiste-interprète au sens du Code de la propriété intellectuelle, "
         "lesquels feraient le cas échéant l'objet d'un accord distinct."),

        ("Article 6 — Données personnelles (RGPD)",
         "Conformément au Règlement (UE) 2016/679 et à la loi Informatique et Libertés modifiée, "
         "l'Intervenant·e est informé·e que les données collectées (nom, prénom, image, voix, "
         "coordonnées) sont traitées par le Producteur dans le cadre de la production et "
         "diffusion du Projet. Ces données sont conservées pendant la durée de l'autorisation "
         "et l'archivage légal correspondant. L'Intervenant·e dispose d'un droit d'accès, "
         "de rectification, d'effacement et d'opposition, exerçable à l'adresse : "
         f"<b>{LES_GRIOTS['email']}</b>. Il/elle peut également introduire une réclamation "
         "auprès de la CNIL (www.cnil.fr)."),

        ("Article 7 — Droits moraux et garanties",
         "L'Intervenant·e garantit n'être lié·e par aucun contrat d'exclusivité s'opposant à "
         "la présente autorisation. Il/elle reconnaît avoir été informé·e de la finalité du "
         "Projet, des modalités de captation et des supports de diffusion envisagés. "
         "Le Producteur s'engage à ne pas utiliser les enregistrements dans un contexte "
         "diffamatoire, calomnieux ou portant atteinte à la dignité de l'Intervenant·e."),

        ("Article 8 — Droit applicable et juridiction",
         "La présente autorisation est régie par le droit français. Tout différend relatif à "
         "son interprétation ou à son exécution sera soumis, à défaut d'accord amiable, "
         "aux tribunaux compétents du ressort de la Cour d'appel de Paris."),
    ]

    for title, body in articles:
        story.append(Paragraph(title, styles["article_num"]))
        story.append(Paragraph(body, styles["body"]))

    # ── Mention « Lu et approuvé » ──
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Fait à <b>{place}</b>, le <b>{date_str}</b>, en deux exemplaires originaux.",
        styles["body_left"],
    ))
    story.append(Spacer(1, 6 * mm))

    # ── Signature ──
    story.append(signature_block(
        "L'Intervenant·e",
        [
            ("Nom et prénom", "_________________________________"),
            ("Date", "____ / ____ / ________"),
            "<i>Mention manuscrite : « Lu et approuvé, bon pour autorisation »</i>",
        ],
        "Pour le Producteur",
        [
            (LES_GRIOTS["representant_titre"], LES_GRIOTS["representant_nom"]),
            ("Email", LES_GRIOTS["email"]),
            ("Société", f"{LES_GRIOTS['nom_legal']} {LES_GRIOTS['forme']}"),
        ],
    ))

    # ── Disclaimer ──
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(disclaimer_text(short=True), styles["disclaimer"]))

    return story


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
        title="Cession droit à l'image — LES GRIOTS",
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
        page_header_footer(canvas, doc, "Cession droit à l'image", "Media Release")

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=on_page),
    ])

    story = build_release(payload)
    doc.build(story)

    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

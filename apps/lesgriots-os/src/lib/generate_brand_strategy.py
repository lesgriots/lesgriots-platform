#!/usr/bin/env python3
"""
LES GRIOTS — Générateur Brand Strategy Workbook PDF.

Workbook livrable client, inspiré de The Futur — Brand Strategy Fundamentals.

Structure (8 pages) :
  - Cover : nom marque + client + date
  - Page 2 — Sommaire & méthodo
  - Page 3 — Étape 1 : Mission · Vision · Goals
  - Page 4 — Étape 2 : Brand Personality
  - Page 5 — Étape 3 : Target Audience
  - Page 6 — Étape 4 : Gap Analysis
  - Page 7 — Étape 5 : Roadmap
  - Page 8 — Brand Pillars & Activation

Le workbook est livré semi-pré-rempli (sections facilement complétées depuis
le brief existant + champs vides pour les sections analytiques).

Usage: echo '<json>' | python3 generate_brand_strategy.py
"""
import sys
import json
import io

from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.lib.units import mm
from reportlab.lib import colors

from legal_common import (
    W, H, MARGIN, PAPER, SURFACE, INK, INK2, INK3, HAIR, TERRACOTTA, SAFFRON, GOLD_SOFT,
    LES_GRIOTS,
    make_styles, hr, fmt_date_fr, safe,
)


def header_footer(canvas, doc, brand_name):
    """Header/footer pour toutes les pages."""
    canvas.saveState()
    # Header
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(MARGIN, H - 12 * mm, "LES GRIOTS")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN + 22 * mm, H - 12 * mm, "BRAND STRATEGY WORKBOOK")
    canvas.drawRightString(W - MARGIN, H - 12 * mm, brand_name.upper()[:40])
    # Filet
    canvas.setStrokeColor(HAIR)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, H - 14 * mm, W - MARGIN, H - 14 * mm)
    # Footer
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN, 12 * mm, "Méthodo The Futur — adaptée LES GRIOTS")
    canvas.drawRightString(W - MARGIN, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(canvas, doc, brand_name, client_name, ref, date_str):
    """Cover spéciale."""
    canvas.saveState()
    # Fond
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # Bandeau couleur en haut
    canvas.setFillColor(TERRACOTTA)
    canvas.rect(0, H - 30 * mm, W, 30 * mm, fill=1, stroke=0)
    canvas.setFillColor(SAFFRON)
    canvas.rect(0, H - 33 * mm, W, 3 * mm, fill=1, stroke=0)

    # Identité top
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(colors.HexColor("#FFFFFF"))
    canvas.drawString(MARGIN, H - 18 * mm, "LES GRIOTS · BRAND STRATEGY")

    # Titre central
    canvas.setFont("Helvetica-Bold", 32)
    canvas.setFillColor(INK)
    canvas.drawCentredString(W / 2, H / 2 + 30 * mm, "BRAND")
    canvas.drawCentredString(W / 2, H / 2 + 15 * mm, "STRATEGY")
    canvas.setFont("Helvetica", 18)
    canvas.setFillColor(INK2)
    canvas.drawCentredString(W / 2, H / 2 - 0 * mm, "Workbook")

    # Filet
    canvas.setStrokeColor(TERRACOTTA)
    canvas.setLineWidth(1.5)
    canvas.line(W / 2 - 20 * mm, H / 2 - 12 * mm, W / 2 + 20 * mm, H / 2 - 12 * mm)

    # Bloc bas — Pour / Date
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(INK3)
    canvas.drawCentredString(W / 2, 60 * mm, "POUR")
    canvas.setFont("Helvetica", 16)
    canvas.setFillColor(INK)
    canvas.drawCentredString(W / 2, 50 * mm, brand_name[:50])
    if client_name and client_name != brand_name:
        canvas.setFont("Helvetica", 11)
        canvas.setFillColor(INK2)
        canvas.drawCentredString(W / 2, 42 * mm, client_name[:50])

    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(INK3)
    canvas.drawCentredString(W / 2, 30 * mm, f"{ref} · {date_str}")

    canvas.restoreState()


def filled_or_empty(value, height_mm=22):
    """Retourne soit le contenu rempli, soit un cadre vide pour écrire."""
    if value:
        return Paragraph(value, ParagraphStyleSimple(11, INK, leading=15))
    return Table(
        [[""]],
        colWidths=[(W - 2 * MARGIN)],
        rowHeights=[height_mm * mm],
        style=TableStyle([("BOX", (0, 0), (-1, -1), 0.4, HAIR)]),
    )


def ParagraphStyleSimple(size, color, bold=False, leading=None):
    from reportlab.lib.styles import ParagraphStyle
    return ParagraphStyle(
        f"s{size}_{bold}",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading or (size * 1.3),
        textColor=color,
        spaceAfter=6,
    )


def build_workbook(payload):
    project = payload.get("project") or {}
    client = payload.get("client") or {}
    brief = payload.get("brief") or {}
    strategy = payload.get("strategy") or {}  # Données pré-remplies user

    brand_name = safe(strategy.get("brand_name") or project.get("name"), "[Nom de marque]")

    styles = make_styles()
    story = []

    # ── Page 2 — Sommaire & méthodo ──
    story.append(Paragraph("Sommaire & méthodologie", styles["title"]))
    story.append(Paragraph(
        "<i>5 étapes pour bâtir une stratégie de marque solide</i>",
        styles["subtitle"],
    ))
    story.append(hr())

    story.append(Paragraph(
        "Ce workbook s'appuie sur la méthode de stratégie de marque enseignée par The Futur (Chris Do). "
        "Elle repose sur 5 étapes séquentielles : on ne peut pas définir une cible si on n'a pas posé sa "
        "mission, ni faire une roadmap si on ne sait pas où sont les gaps. La stratégie de marque n'est "
        "pas le logo — c'est la <b>raison d'exister</b> de la marque, ce qui la rend unique et désirable.",
        styles["body"],
    ))

    steps = [
        ("01", "Mission · Vision · Goals", "Pourquoi cette marque existe, où elle va, quels objectifs"),
        ("02", "Brand Personality", "Comment la marque parle, se comporte, est perçue"),
        ("03", "Target Audience", "Qui sont les personnes que la marque sert vraiment"),
        ("04", "Gap Analysis", "Où la marque peut se différencier sur son marché"),
        ("05", "Roadmap", "Comment activer la stratégie sur 12 mois"),
    ]
    for num, title, desc in steps:
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            f"<font color='#C46B3D' size='14'><b>{num}</b></font> &nbsp; "
            f"<b>{title}</b> — <font color='#5C5246'>{desc}</font>",
            styles["body_left"],
        ))

    story.append(PageBreak())

    # ── Étape 1 — Mission · Vision · Goals ──
    story.append(Paragraph("01 · Mission · Vision · Goals", styles["title"]))
    story.append(hr())

    story.append(Paragraph("MISSION", styles["section"]))
    story.append(Paragraph(
        "<i>Pourquoi la marque existe. Sa raison d'être au présent. Ce qu'elle fait pour qui.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("mission") or brief.get("goal"), 22))

    story.append(Paragraph("VISION", styles["section"]))
    story.append(Paragraph(
        "<i>Où la marque va dans 5 ans. Le futur qu'elle veut créer.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("vision"), 22))

    story.append(Paragraph("GOALS (3 objectifs business à 12 mois)", styles["section"]))
    story.append(Paragraph(
        "<i>SMART : Spécifiques, Mesurables, Atteignables, Réalistes, Temporels.</i>",
        styles["footnote"],
    ))
    for i in range(1, 4):
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"<b>Goal {i}</b>", styles["label"]))
        story.append(filled_or_empty(strategy.get(f"goal_{i}"), 12))

    story.append(Paragraph("VALEURS FONDATRICES (3 à 5 max)", styles["section"]))
    story.append(Paragraph(
        "<i>Les principes non-négociables. Pas des mots-clés marketing — des engagements internes.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("values"), 20))

    story.append(PageBreak())

    # ── Étape 2 — Brand Personality ──
    story.append(Paragraph("02 · Brand Personality", styles["title"]))
    story.append(hr())

    story.append(Paragraph("ARCHÉTYPE DE MARQUE", styles["section"]))
    story.append(Paragraph(
        "<i>Les 12 archétypes de Jung : Innocent · Sage · Explorateur · Rebelle · Magicien · Héros · "
        "Amant · Bouffon · Homme du peuple · Soignant · Souverain · Créateur. Choisir 1 dominant + 1 secondaire.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("archetype"), 18))

    story.append(Paragraph("TONE OF VOICE (3 adjectifs)", styles["section"]))
    story.append(Paragraph(
        "<i>Comment la marque parle. Format : « X mais pas Y ». Ex : « Direct, mais pas brutal ».</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("tone_of_voice"), 20))

    story.append(Paragraph("BRAND PERSONA", styles["section"]))
    story.append(Paragraph(
        "<i>Si la marque était une personne, qui serait-elle ? Décrire en 4-5 phrases : âge, métier, "
        "valeurs, façon de parler, ce qu'elle adore, ce qu'elle déteste.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("persona"), 35))

    story.append(Paragraph("MANIFESTO / POINT OF VIEW", styles["section"]))
    story.append(Paragraph(
        "<i>Le statement-fondateur de la marque. Une phrase ou un court paragraphe qui capture "
        "ce contre quoi elle se bat et ce qu'elle propose au monde.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("manifesto"), 30))

    story.append(PageBreak())

    # ── Étape 3 — Target Audience ──
    story.append(Paragraph("03 · Target Audience & Research", styles["title"]))
    story.append(hr())

    for i, (label, hint) in enumerate([
        ("PERSONA 1 — Cœur de cible",
         "Nom · âge · métier · revenus · ville · valeurs · ce qu'il/elle cherche · ce qu'il/elle évite · où on le/la touche"),
        ("PERSONA 2 — Cible secondaire",
         "Même format que persona 1. Souvent plus large ou un segment d'influence."),
    ], start=1):
        story.append(Paragraph(label, styles["section"]))
        story.append(Paragraph(f"<i>{hint}</i>", styles["footnote"]))
        story.append(Spacer(1, 2 * mm))
        story.append(filled_or_empty(strategy.get(f"persona_{i}"), 40))

    story.append(Paragraph("JOBS TO BE DONE", styles["section"]))
    story.append(Paragraph(
        "<i>Quel « job » la marque accomplit pour le client ? Format : « Quand je suis dans situation X, "
        "j'ai besoin de la marque Y pour réaliser Z ». Distinguer fonctionnel / émotionnel / social.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("jobs_to_be_done"), 35))

    story.append(PageBreak())

    # ── Étape 4 — Gap Analysis ──
    story.append(Paragraph("04 · Gap Analysis", styles["title"]))
    story.append(hr())

    story.append(Paragraph("AUDIT CONCURRENTIEL (5 marques benchmark)", styles["section"]))
    story.append(Paragraph(
        "<i>Lister 5 marques sur le marché. Pour chacune : positionnement perçu, points forts, "
        "points faibles, opportunité d'écart.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    # Tableau 5 lignes
    comp_rows = [["Marque", "Positionnement", "Force", "Faiblesse"]]
    for i in range(1, 6):
        comp_rows.append([f"{i}.", "", "", ""])
    tbl = Table(comp_rows, colWidths=[25 * mm, 60 * mm, 45 * mm, (W - 2 * MARGIN) - 130 * mm])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK3),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("POSITIONING MAP — Les axes différenciants", styles["section"]))
    story.append(Paragraph(
        "<i>Choisir 2 axes (ex : prix vs qualité, mass-market vs niche, traditionnel vs disruptif). "
        "Placer les concurrents sur la carte. Identifier les zones vides.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("positioning_map"), 30))

    story.append(Paragraph("GAPS IDENTIFIÉS", styles["section"]))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("gaps"), 25))

    story.append(PageBreak())

    # ── Étape 5 — Roadmap ──
    story.append(Paragraph("05 · Roadmap & activation", styles["title"]))
    story.append(hr())

    story.append(Paragraph("ROADMAP 12 MOIS — Les jalons stratégiques", styles["section"]))
    rmap_rows = [["Trimestre", "Objectif", "Action prioritaire"]]
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        rmap_rows.append([q, "", ""])
    tbl2 = Table(rmap_rows, colWidths=[25 * mm, 65 * mm, (W - 2 * MARGIN) - 90 * mm])
    tbl2.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK3),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
    ]))
    story.append(tbl2)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("3 BRAND PILLARS", styles["section"]))
    story.append(Paragraph(
        "<i>Les 3 grands thèmes de communication. Toute prise de parole devra s'inscrire dans l'un d'eux. "
        "Évite la dispersion, force la cohérence sur 12 mois.</i>",
        styles["footnote"],
    ))
    for i in range(1, 4):
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"<b>Pilier {i}</b>", styles["label"]))
        story.append(filled_or_empty(strategy.get(f"pillar_{i}"), 15))

    story.append(Paragraph("PLATEFORME MESSAGING", styles["section"]))
    story.append(Paragraph(
        "<i>Tagline · accroche principale · 3 phrases-clés à réutiliser sur tous les touchpoints.</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("messaging_platform"), 30))

    story.append(Paragraph("TOUCHPOINTS PRIORITAIRES", styles["section"]))
    story.append(Paragraph(
        "<i>Site web · réseaux sociaux · email · packaging · espace physique · partenariats · presse · podcast · vidéo. "
        "Lesquels en priorité pour atteindre la cible définie en étape 3 ?</i>",
        styles["footnote"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(filled_or_empty(strategy.get("touchpoints"), 25))

    return story


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)

    project = payload.get("project") or {}
    client = payload.get("client") or {}
    strategy = payload.get("strategy") or {}
    brand_name = safe(strategy.get("brand_name") or project.get("name"), "Brand")
    client_name = safe(client.get("company") or project.get("client"), "")
    ref = safe(project.get("code"), "BRAND")
    date_str = fmt_date_fr(None)

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 4 * mm, bottomMargin=MARGIN,
        title=f"Brand Strategy — {brand_name}",
        author="LES GRIOTS",
    )

    cover_frame = Frame(0, 0, W, H,
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                        showBoundary=0)
    content_frame = Frame(MARGIN, MARGIN,
                          W - 2 * MARGIN, H - 2 * MARGIN - 8 * mm,
                          leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                          showBoundary=0)

    def on_cover(canvas, doc):
        cover_page(canvas, doc, brand_name, client_name, ref, date_str)

    def on_content(canvas, doc):
        header_footer(canvas, doc, brand_name)

    from reportlab.platypus.doctemplate import NextPageTemplate
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="content", frames=[content_frame], onPage=on_content),
    ])

    story = [
        Spacer(1, 1),
        NextPageTemplate("content"),
        PageBreak(),
    ]
    story.extend(build_workbook(payload))

    doc.build(story)
    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

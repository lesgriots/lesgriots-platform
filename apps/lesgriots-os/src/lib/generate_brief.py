#!/usr/bin/env python3
"""
LES GRIOTS — Generateur de Creative Brief PDF
Format inspire de Practical Project Management (The Futur / Chris Do).

Structure :
  - Cover page : bandeau couleur (couleur du pilier) + titre projet en gros
  - Page contenu : titre + intro + 6 sections PPM (Goal, Overview, Brand positioning,
    User needs, Client needs, Creative direction) + 2 sections LES GRIOTS
    (Jalons, Specs techniques)

Usage: echo '<json>' | python3 generate_brief.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY

# ── Dimensions & couleurs ─────────────────────────────────
W, H = A4
MARGIN = 18 * mm

PAPER = colors.HexColor("#FBF7EE")
INK = colors.HexColor("#1A1410")
INK2 = colors.HexColor("#5C5246")
INK3 = colors.HexColor("#8B8175")
RULE = colors.HexColor("#1A1410")
HAIR = colors.HexColor("#DDD2BB")

TERRACOTTA = colors.HexColor("#C46B3D")
SAFFRON = colors.HexColor("#B07A0E")

# Couleurs piliers (cover page)
PILLAR_COLOR = {
    "STUDIO": colors.HexColor("#2670B4"),
    "PROD": colors.HexColor("#8347A1"),
    "GRIOTHEQUE": colors.HexColor("#B07A0E"),
    "AGENCE": colors.HexColor("#2670B4"),
}

PILLAR_LABEL = {
    "STUDIO": "LES GRIOTS x STUDIO",
    "PROD": "Production Originale",
    "GRIOTHEQUE": "La Griotheque",
    "AGENCE": "LES GRIOTS x STUDIO",
}

# ── Sections du brief (ordre PPM + complements LG) ────────
BRIEF_FIELDS = [
    ("goal",              "GOAL"),
    ("overview",          "OVERVIEW"),
    ("brandPositioning",  "BRAND POSITIONING"),
    ("userNeeds",         "USER NEEDS"),
    ("clientNeeds",       "CLIENT NEEDS"),
    ("creativeDirection", "CREATIVE DIRECTION"),
    ("milestones",        "JALONS"),
    ("deliverySpecs",     "SPECS TECHNIQUES"),
]


def safe(v, fallback=""):
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


def fmt_date_fr(d):
    if not d:
        return ""
    try:
        months = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
                  "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except Exception:
        return str(d)


def html_escape(s):
    """Escape pour reportlab Paragraph. \n → <br/>."""
    if s is None:
        return ""
    return (str(s).replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\n", "<br/>"))


# ── Styles ────────────────────────────────────────────────
def make_styles():
    return {
        "cover_eyebrow": ParagraphStyle(
            "cover_eyebrow", fontName="Helvetica-Bold", fontSize=14, leading=18,
            textColor=colors.white, alignment=TA_LEFT, spaceAfter=0,
        ),
        "cover_pillar": ParagraphStyle(
            "cover_pillar", fontName="Helvetica-Bold", fontSize=11, leading=14,
            textColor=colors.white, alignment=TA_LEFT, spaceAfter=2,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", fontName="Helvetica-Bold", fontSize=52, leading=60,
            textColor=INK, alignment=TA_LEFT, spaceAfter=8,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle", fontName="Courier-Bold", fontSize=10, leading=14,
            textColor=INK2, alignment=TA_LEFT, spaceAfter=2,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", fontName="Helvetica", fontSize=9, leading=12,
            textColor=INK2, alignment=TA_LEFT,
        ),
        "cover_footer_left": ParagraphStyle(
            "cover_footer_left", fontName="Helvetica-Bold", fontSize=8, leading=10,
            textColor=INK2, alignment=TA_LEFT,
        ),
        "cover_footer_right": ParagraphStyle(
            "cover_footer_right", fontName="Helvetica-Bold", fontSize=8, leading=10,
            textColor=INK2, alignment=TA_RIGHT,
        ),
        # Page contenu
        "page_title": ParagraphStyle(
            "page_title", fontName="Helvetica-Bold", fontSize=32, leading=36,
            textColor=INK, alignment=TA_LEFT, spaceAfter=12,
        ),
        "page_intro": ParagraphStyle(
            "page_intro", fontName="Helvetica", fontSize=10, leading=14,
            textColor=INK2, alignment=TA_LEFT, spaceAfter=24,
        ),
        "section_label": ParagraphStyle(
            "section_label", fontName="Helvetica-Bold", fontSize=9, leading=12,
            textColor=INK, alignment=TA_LEFT, spaceAfter=6,
            spaceBefore=0,
        ),
        "section_body": ParagraphStyle(
            "section_body", fontName="Helvetica", fontSize=10, leading=15,
            textColor=INK, alignment=TA_LEFT, spaceAfter=20,
        ),
        "section_empty": ParagraphStyle(
            "section_empty", fontName="Helvetica-Oblique", fontSize=9, leading=12,
            textColor=INK3, alignment=TA_LEFT, spaceAfter=20,
        ),
        "footer": ParagraphStyle(
            "footer", fontName="Helvetica-Bold", fontSize=7, leading=9,
            textColor=INK2, alignment=TA_LEFT,
        ),
        "footer_right": ParagraphStyle(
            "footer_right", fontName="Helvetica-BoldOblique", fontSize=9, leading=11,
            textColor=INK, alignment=TA_RIGHT,
        ),
    }


# ── Page templates ────────────────────────────────────────
def on_cover_page(canv, doc):
    """Cover : bandeau pilier en haut (40% de la hauteur) + footer LES GRIOTS."""
    project = doc.lg_project
    pillar = project.get("pillar", "STUDIO")
    color = PILLAR_COLOR.get(pillar, PILLAR_COLOR["STUDIO"])

    # Bandeau pilier en haut, 40% de la page
    band_h = H * 0.42
    canv.setFillColor(color)
    canv.rect(0, H - band_h, W, band_h, fill=1, stroke=0)

    # "LES GRIOTS / Brief / pilier" en haut a gauche dans le bandeau
    canv.setFillColor(colors.white)
    canv.setFont("Helvetica-Bold", 11)
    canv.drawString(MARGIN, H - 30, "LES GRIOTS")
    canv.setFont("Helvetica-Bold", 11)
    canv.drawString(MARGIN, H - 44, "Creative")
    canv.drawString(MARGIN, H - 58, "Brief")

    # Pilier label en haut a droite dans le bandeau
    canv.setFont("Helvetica-Bold", 8)
    canv.drawRightString(W - MARGIN, H - 30, PILLAR_LABEL.get(pillar, pillar).upper())

    # Ligne de separation horizontale sous le bandeau (zone titre)
    line_y = MARGIN + 30
    canv.setStrokeColor(INK)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, line_y, W - MARGIN, line_y)

    # Footer copyright + url
    year = datetime.now().year
    canv.setFillColor(INK2)
    canv.setFont("Helvetica-Bold", 7.5)
    canv.drawString(MARGIN, MARGIN, f"© {year} LES GRIOTS SASU")
    canv.drawCentredString(W / 2, MARGIN, "lesgriots.com")
    canv.setFont("Helvetica-BoldOblique", 8)
    canv.drawRightString(W - MARGIN, MARGIN, "Practical Project Management")


def on_content_page(canv, doc):
    """Pages contenu : ligne horizontale en haut + footer."""
    project = doc.lg_project

    # Ligne en haut
    canv.setStrokeColor(INK)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, H - MARGIN + 5 * mm, W - MARGIN, H - MARGIN + 5 * mm)

    # Footer
    canv.setFillColor(INK2)
    canv.setFont("Helvetica-Bold", 7.5)
    year = datetime.now().year
    canv.drawString(MARGIN, MARGIN - 4 * mm, f"© {year} LES GRIOTS SASU")
    canv.drawCentredString(W / 2, MARGIN - 4 * mm, "Practical Project Management")
    canv.setFont("Helvetica-BoldOblique", 9)
    canv.setFillColor(INK)
    canv.drawRightString(W - MARGIN, MARGIN - 4 * mm, "lesgriots")

    # Page number en haut a droite
    canv.setFillColor(INK3)
    canv.setFont("Courier", 7)
    canv.drawRightString(W - MARGIN, H - MARGIN + 8 * mm,
                          f"{safe(project.get('code'))}  ·  page {canv.getPageNumber() - 1}")


# ── Contenu ──────────────────────────────────────────────
def build_cover_content(project, client, styles):
    """Bloc texte sur la cover, sous le bandeau colore."""
    elements = []

    # Espace en haut pour passer sous le bandeau (42% = ~322pt sur A4)
    elements.append(Spacer(1, H * 0.42 - MARGIN + 20))

    # Titre projet
    name = safe(project.get("name"), "Projet sans nom")
    elements.append(Paragraph(name, styles["cover_title"]))

    # Sous-titre "Creative Brief"
    elements.append(Paragraph("CREATIVE BRIEF", styles["cover_subtitle"]))

    elements.append(Spacer(1, 16))

    # Meta : code + client + dates + budget
    code = safe(project.get("code"))
    pillar = PILLAR_LABEL.get(project.get("pillar"), project.get("pillar", ""))
    template_str = safe(project.get("template")).upper()

    meta_parts = []
    if code: meta_parts.append(code)
    if pillar: meta_parts.append(pillar)
    if template_str: meta_parts.append(template_str)
    elements.append(Paragraph(" · ".join(meta_parts), styles["cover_subtitle"]))

    elements.append(Spacer(1, 20))

    # Client + dates
    client_str = ""
    if client:
        company = safe(client.get("company"))
        first = safe(client.get("firstName"))
        last = safe(client.get("lastName"))
        if company:
            contact = f"{first} {last}".strip()
            client_str = f"<b>Client</b>  ·  {html_escape(company)}"
            if contact:
                client_str += f"  ·  {html_escape(contact)}"
        else:
            full = f"{first} {last}".strip()
            if full:
                client_str = f"<b>Client</b>  ·  {html_escape(full)}"
    if not client_str:
        c = safe(project.get("client"))
        if c:
            client_str = f"<b>Client</b>  ·  {html_escape(c)}"

    if client_str:
        elements.append(Paragraph(client_str, styles["cover_meta"]))
        elements.append(Spacer(1, 4))

    sd = safe(project.get("startDate"))
    ed = safe(project.get("endDate"))
    if sd or ed:
        if sd and ed:
            dates_str = f"{fmt_date_fr(sd)}  →  {fmt_date_fr(ed)}"
        elif sd:
            dates_str = f"depuis le {fmt_date_fr(sd)}"
        else:
            dates_str = f"livraison le {fmt_date_fr(ed)}"
        elements.append(Paragraph(f"<b>Dates</b>  ·  {html_escape(dates_str)}", styles["cover_meta"]))

    return elements


def build_content_page(project, brief, styles):
    """Page contenu : titre + intro + sections."""
    elements = []

    # Titre projet
    name = safe(project.get("name"), "Projet sans nom")
    title = f"{name} Creative Brief"
    elements.append(Paragraph(title, styles["page_title"]))

    # Intro (peut etre vide ou utiliser les notes du projet)
    notes = safe(project.get("notes"))
    if notes:
        intro = html_escape(notes)
    else:
        intro = ("Ce document constitue le brief créatif du projet. "
                 "Il définit le but, le positionnement, les besoins utilisateur et client, "
                 "ainsi que la direction artistique. Il sert de référence partagée pour "
                 "l'équipe créative.")
    elements.append(Paragraph(intro, styles["page_intro"]))

    # Sections
    brief = brief or {}
    has_any = any(safe(brief.get(k)) for k, _ in BRIEF_FIELDS)
    if not has_any:
        elements.append(Paragraph(
            "Aucun contenu de brief renseigne. Editer la fiche projet pour completer "
            "chaque section, puis regenerer ce PDF.", styles["section_empty"]
        ))
        return elements

    for key, label in BRIEF_FIELDS:
        content = safe(brief.get(key))
        block = []
        # Petite barre horizontale au-dessus du label (style PPM)
        block.append(HRule(width=22*mm, thickness=1.5, color=INK))
        block.append(Spacer(1, 4))
        block.append(Paragraph(label, styles["section_label"]))
        if content:
            block.append(Paragraph(html_escape(content), styles["section_body"]))
        else:
            block.append(Paragraph("(non renseigne)", styles["section_empty"]))
        elements.append(KeepTogether(block))

    return elements


# ── HRule : petite ligne horizontale au-dessus du label ───
from reportlab.platypus import Flowable

class HRule(Flowable):
    def __init__(self, width=22*mm, thickness=1.5, color=INK):
        super().__init__()
        self.width = width
        self.thickness = thickness
        self.color = color
        self.height = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


# ── Build PDF ────────────────────────────────────────────
def build_pdf(payload):
    project = payload.get("project", {})
    client = payload.get("client") or None
    brief = payload.get("brief") or {}

    buf = io.BytesIO()

    frame_cover = Frame(MARGIN, MARGIN + 6 * mm, W - 2 * MARGIN, H - 2 * MARGIN - 6 * mm,
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                        showBoundary=0, id="cover_frame")

    frame_content = Frame(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN - 6 * mm,
                          leftPadding=0, rightPadding=0, topPadding=4 * mm, bottomPadding=0,
                          showBoundary=0, id="content_frame")

    template_cover = PageTemplate(id="cover", frames=[frame_cover], onPage=on_cover_page)
    template_content = PageTemplate(id="content", frames=[frame_content], onPage=on_content_page)

    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=MARGIN)
    doc.addPageTemplates([template_cover, template_content])

    styles = make_styles()
    doc.lg_styles = styles
    doc.lg_project = project

    story = []
    # Cover
    story.extend(build_cover_content(project, client, styles))

    # Forcer le passage au template "content" pour la page suivante
    from reportlab.platypus import NextPageTemplate
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())

    # Page(s) contenu
    story.extend(build_content_page(project, brief, styles))

    doc.build(story)

    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes


# ── Main ──────────────────────────────────────────────────
def main():
    try:
        payload = json.loads(sys.stdin.read())
    except Exception as e:
        sys.stderr.write(f"Invalid JSON input: {e}\n")
        sys.exit(2)

    try:
        pdf = build_pdf(payload)
        sys.stdout.buffer.write(pdf)
    except Exception as e:
        sys.stderr.write(f"PDF generation failed: {e}\n")
        sys.exit(3)


if __name__ == "__main__":
    main()

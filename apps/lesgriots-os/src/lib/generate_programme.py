#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Programme Détaillé de Formation PDF
Charte graphique : fond beige (#F5F0EB), accents gold (#D4A843),
Courier monospace, footer légal LES GRIOTS.

Usage: echo '<json>' | python3 generate_programme.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, Flowable, NextPageTemplate
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.utils import ImageReader


def _load_logo(data):
    """ImageReader du logo Griothèque (chemin passé par la route JS), ou None."""
    p = str(data.get("logoPath") or "").strip()
    if not p:
        return None
    try:
        return ImageReader(p)
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════
# SetHeader — dynamic header flowable (updates state before PageBreak)
# ═══════════════════════════════════════════════════════════════════

class SetHeader(Flowable):
    def __init__(self, header_state, left="", right=""):
        Flowable.__init__(self)
        self.header_state = header_state
        self.left = left
        self.right = right
        self.width = 0
        self.height = 0

    def draw(self):
        self.header_state["left"] = self.left
        self.header_state["right"] = self.right


# ═══════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════

W, H = A4
MARGIN = 22 * mm
BK = colors.black
LGRAY = colors.HexColor("#999999")
BEIGE = colors.HexColor("#F5F0EB")
GOLD = colors.HexColor("#D4A843")
WHITE = colors.white


def safe(v, fallback=""):
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


# ═══════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        "cover_sub": ParagraphStyle("pg_cover_sub", fontName="Courier-Bold", fontSize=9,
                                     textColor=BK, leading=12, spaceAfter=6),
        "cover_title": ParagraphStyle("pg_cover_title", fontName="Courier-Bold", fontSize=30,
                                       textColor=BK, leading=36),
        "cover_formation": ParagraphStyle("pg_cover_formation", fontName="Courier-Bold", fontSize=14,
                                           textColor=GOLD, leading=18),
        "section_tag": ParagraphStyle("pg_section_tag", fontName="Courier-Bold", fontSize=9,
                                       textColor=BK, leading=12),
        "section_title": ParagraphStyle("pg_section_title", fontName="Courier-Bold", fontSize=20,
                                         textColor=BK, leading=26),
        "h2": ParagraphStyle("pg_h2", fontName="Courier-Bold", fontSize=11,
                              textColor=BK, leading=15, spaceBefore=10, spaceAfter=4),
        "h3": ParagraphStyle("pg_h3", fontName="Courier-Bold", fontSize=10,
                              textColor=BK, leading=14, spaceBefore=6, spaceAfter=3),
        "body": ParagraphStyle("pg_body", fontName="Courier", fontSize=9,
                                textColor=BK, leading=14, alignment=TA_JUSTIFY),
        "body_b": ParagraphStyle("pg_body_b", fontName="Courier-Bold", fontSize=9,
                                  textColor=BK, leading=14),
        "bullet": ParagraphStyle("pg_bullet", fontName="Courier", fontSize=9,
                                  textColor=BK, leading=14, leftIndent=10,
                                  alignment=TA_LEFT),
        "small": ParagraphStyle("pg_small", fontName="Courier", fontSize=8,
                                 textColor=BK, leading=11),
        "small_b": ParagraphStyle("pg_small_b", fontName="Courier-Bold", fontSize=8,
                                   textColor=BK, leading=11),
        "th": ParagraphStyle("pg_th", fontName="Courier-Bold", fontSize=8,
                              textColor=LGRAY, leading=10),
        "tc": ParagraphStyle("pg_tc", fontName="Courier", fontSize=9,
                              textColor=BK, leading=13),
        "tc_b": ParagraphStyle("pg_tc_b", fontName="Courier-Bold", fontSize=9,
                                textColor=BK, leading=13),
        "module_title": ParagraphStyle("pg_module_title", fontName="Courier-Bold", fontSize=10,
                                        textColor=WHITE, leading=14),
        "module_item": ParagraphStyle("pg_module_item", fontName="Courier", fontSize=9,
                                       textColor=BK, leading=13, leftIndent=10),
        "footer": ParagraphStyle("pg_footer", fontName="Courier", fontSize=6,
                                  textColor=LGRAY, leading=8, alignment=TA_CENTER),
        "header_left": ParagraphStyle("pg_header_left", fontName="Courier-Bold", fontSize=8,
                                       textColor=BK, leading=10),
        "header_right": ParagraphStyle("pg_header_right", fontName="Courier", fontSize=7,
                                        textColor=BK, leading=9, alignment=TA_RIGHT),
        "contact_label": ParagraphStyle("pg_contact_label", fontName="Courier-Bold", fontSize=9,
                                         textColor=GOLD, leading=13),
        "contact_value": ParagraphStyle("pg_contact_value", fontName="Courier", fontSize=9,
                                         textColor=BK, leading=13),
    }


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def gold_box(S, title, body_text, cw):
    """Yellow/gold highlighted box."""
    content = []
    if title:
        content.append(Paragraph(f"<b>{title}</b>", S["small_b"]))
        content.append(Spacer(1, 2 * mm))
    content.append(Paragraph(body_text, S["body"]))
    inner = Table([[content]], colWidths=[cw - 8 * mm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    return inner


def section_tag(S, label):
    """Small gold tag pill."""
    tag_para = Paragraph(f"  {label}  ", ParagraphStyle(
        "tag_tmp", fontName="Courier-Bold", fontSize=8, textColor=BK, leading=11))
    tag_table = Table([[tag_para]], colWidths=[None])
    tag_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return tag_table


def hr_line(cw):
    t = Table([[""]], colWidths=[cw])
    t.setStyle(TableStyle([
        ("LINEBELOW",    (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING",   (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
    ]))
    return t


def module_header_bar(S, text, cw):
    """Dark bar with white text for module titles."""
    para = Paragraph(text, S["module_title"])
    t = Table([[para]], colWidths=[cw])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), BK),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    return t


def info_table(S, rows, cw):
    """Two-column label/value table."""
    table_data = []
    for label, value in rows:
        table_data.append([
            Paragraph(label, S["th"]),
            Paragraph(safe(value), S["tc"]),
        ])
    t = Table(table_data, colWidths=[cw * 0.3, cw * 0.7])
    t.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LINEBELOW",    (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING",  (0, 0), (0, -1), 0),
    ]))
    return t


# ═══════════════════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════════════════

def generate(data):
    S = _make_styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "LA GRIOTHÈQUE · PROGRAMME DE FORMATION", "right": ""}

    year = datetime.now().year
    company_name = safe(data.get("companyName"), "LES GRIOTS")
    siret = safe(data.get("siret"), "902 628 684 00018")
    nda = safe(data.get("nda"), "28 76 07471 76")
    footer_text = (
        f"{company_name} — SASU au capital de 1 000 € — "
        f"SIRET {siret} — NDA {nda}"
    )

    formation_title = safe(data.get("formationTitle"), "Formation")
    logo_img = _load_logo(data)

    # ───────────────────────────────────────────────────────────
    # Page drawing callbacks
    # ───────────────────────────────────────────────────────────

    def draw_cover_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Gold border
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.rect(MARGIN, MARGIN, cw, H - 2 * MARGIN, fill=False, stroke=True)
        # Footer
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W / 2, 12 * mm, footer_text)
        canvas.restoreState()

    def draw_section_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Header
        left_text = header_state.get("left", "")
        right_text = header_state.get("right", "")
        text_x = MARGIN
        if logo_img is not None:
            try:
                canvas.drawImage(logo_img, MARGIN, H - 16.5 * mm, width=8 * mm, height=8 * mm,
                                 preserveAspectRatio=True, mask='auto')
                text_x = MARGIN + 10 * mm
            except Exception:
                text_x = MARGIN
        canvas.setFont("Courier-Bold", 8)
        canvas.setFillColor(BK)
        canvas.drawString(text_x, H - 14 * mm, left_text)
        if right_text:
            canvas.setFont("Courier", 7)
            for i, line in enumerate(right_text.split("\n")):
                canvas.drawRightString(W - MARGIN, H - 14 * mm - i * 9, line)
        # Gold accent line
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 17 * mm, W - MARGIN, H - 17 * mm)
        # Footer
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W / 2, 12 * mm, footer_text)
        # Page number
        canvas.drawRightString(W - MARGIN, 12 * mm, f"{doc.page}")
        canvas.restoreState()

    # ───────────────────────────────────────────────────────────
    # Document setup
    # ───────────────────────────────────────────────────────────

    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=20 * mm)

    cover_frame = Frame(MARGIN + 8 * mm, 20 * mm, cw - 16 * mm,
                        H - MARGIN - 28 * mm, id="cover_frame")
    section_frame = Frame(MARGIN, 20 * mm, cw, H - MARGIN - 24 * mm,
                          id="section_frame")

    doc.addPageTemplates([
        PageTemplate(id="cover",   frames=[cover_frame],   onPage=draw_cover_page),
        PageTemplate(id="section", frames=[section_frame], onPage=draw_section_page),
    ])

    story = []
    right_header = f"{formation_title.upper()}\n©{year} {company_name}"

    # ═══════════════════════════════════════════════════════════
    # PAGE 1 — COVER
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("— LA GRIOTHÈQUE · PROGRAMME DE FORMATION", S["cover_sub"]))
    story.append(Spacer(1, 10 * mm))

    story.append(Paragraph("PROGRAMME", S["cover_title"]))
    story.append(Paragraph("DE FORMATION.", S["cover_title"]))
    story.append(Spacer(1, 12 * mm))

    # Formation title
    story.append(Paragraph(formation_title.upper(), S["cover_formation"]))
    story.append(Spacer(1, 8 * mm))

    # Description
    description = safe(data.get("formationDescription"), "")
    if description:
        story.append(Paragraph(description, S["body"]))
        story.append(Spacer(1, 10 * mm))

    # Info block
    duration_hours = safe(data.get("durationHours"), "7")
    duration_days = safe(data.get("durationDays"), "1")
    modality = safe(data.get("formationModality"), "Présentiel")
    location = safe(data.get("location"), "")
    formateur = safe(data.get("formateurName"), "")
    public = safe(data.get("formationPublic"), "")
    prerequisites = safe(data.get("formationPrerequisites"), "Aucun")

    days_label = f"{duration_days} jour{'s' if str(duration_days) not in ('1', '1.0') else ''}"

    info_rows = [
        ["DURÉE",       f"{duration_hours}h ({days_label})"],
        ["PUBLIC VISÉ", public],
        ["PRÉREQUIS",   prerequisites],
        ["MODALITÉ",    modality],
        ["LIEU",        location],
        ["FORMATEUR",   formateur],
    ]
    story.append(info_table(S, info_rows, cw - 16 * mm))

    # ═══════════════════════════════════════════════════════════
    # PAGE 2 — OBJECTIFS PÉDAGOGIQUES
    # ═══════════════════════════════════════════════════════════

    story.append(NextPageTemplate("section"))
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · PROGRAMME DE FORMATION",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4 * mm))
    story.append(section_tag(S, "OBJECTIFS"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("OBJECTIFS PÉDAGOGIQUES.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    objectives = data.get("formationObjectives", [])
    if objectives:
        story.append(Paragraph(
            "À l'issue de la formation, le stagiaire sera capable de :",
            S["body"]
        ))
        story.append(Spacer(1, 4 * mm))
        for obj in objectives:
            story.append(Paragraph(f"— {obj}", S["bullet"]))
            story.append(Spacer(1, 1 * mm))
    else:
        story.append(Paragraph("Objectifs définis en concertation avec le commanditaire.", S["body"]))

    story.append(Spacer(1, 8 * mm))
    story.append(hr_line(cw))

    # ═══════════════════════════════════════════════════════════
    # CONTENU DÉTAILLÉ — MODULES
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 8 * mm))
    story.append(section_tag(S, "CONTENU DÉTAILLÉ"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("CONTENU DÉTAILLÉ<br/>DE LA FORMATION.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    modules = data.get("modules", [])

    for idx, mod in enumerate(modules, start=1):
        mod_title = safe(mod.get("title"), f"Module {idx}")
        mod_hours = safe(mod.get("duration_hours"), "")
        duration_suffix = f" ({mod_hours}h)" if mod_hours else ""

        # Module header bar — keep together with at least first item
        mod_elements = []
        mod_elements.append(module_header_bar(
            S, f"MODULE {idx} : {mod_title.upper()}{duration_suffix}", cw
        ))
        mod_elements.append(Spacer(1, 4 * mm))

        items = mod.get("items", [])
        for item in items:
            mod_elements.append(Paragraph(f"— {item}", S["module_item"]))
            mod_elements.append(Spacer(1, 1 * mm))

        mod_elements.append(Spacer(1, 6 * mm))

        # KeepTogether for the header + first few items (avoid orphan headers)
        if len(items) <= 5:
            story.append(KeepTogether(mod_elements))
        else:
            # Keep header + first 3 items together, rest flows normally
            keep_part = mod_elements[:2 + 3 * 2]  # header + spacer + 3*(item+spacer)
            story.append(KeepTogether(keep_part))
            for el in mod_elements[2 + 3 * 2:]:
                story.append(el)

    # ═══════════════════════════════════════════════════════════
    # MÉTHODES PÉDAGOGIQUES
    # ═══════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · PROGRAMME · MODALITÉS",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4 * mm))
    story.append(section_tag(S, "MÉTHODES"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("MÉTHODES PÉDAGOGIQUES.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    method_text = safe(data.get("formationMethod"), (
        "Apports théoriques et méthodologiques.<br/>"
        "Études de cas et mises en situation pratiques.<br/>"
        "Échanges et retours d'expérience entre participants.<br/>"
        "Supports pédagogiques remis aux stagiaires."
    ))
    story.append(Paragraph(method_text, S["body"]))

    # ═══════════════════════════════════════════════════════════
    # MODALITÉS D'ÉVALUATION
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 10 * mm))
    story.append(section_tag(S, "ÉVALUATION"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("MODALITÉS D'ÉVALUATION.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    eval_text = safe(data.get("formationEvaluation"), (
        "Évaluation diagnostique en début de formation (positionnement).<br/>"
        "Évaluations formatives tout au long de la formation "
        "(exercices pratiques, quiz, mises en situation).<br/>"
        "Évaluation sommative en fin de formation.<br/>"
        "Questionnaire de satisfaction à chaud."
    ))
    story.append(Paragraph(eval_text, S["body"]))

    # ═══════════════════════════════════════════════════════════
    # MOYENS MATÉRIELS ET PÉDAGOGIQUES
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 10 * mm))
    story.append(section_tag(S, "MOYENS"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("MOYENS MATÉRIELS<br/>ET PÉDAGOGIQUES.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    moyens_text = safe(data.get("formationMoyensMateriels"), (
        "Salle de formation équipée (vidéoprojecteur, paperboard).<br/>"
        "Poste informatique individuel si nécessaire.<br/>"
        "Supports de cours remis en format numérique.<br/>"
        "Accès aux outils et logiciels requis pendant la formation."
    ))
    story.append(Paragraph(moyens_text, S["body"]))

    # ═══════════════════════════════════════════════════════════
    # DÉLAIS D'ACCÈS
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 10 * mm))
    story.append(section_tag(S, "DÉLAIS"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("DÉLAIS D'ACCÈS.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    delais_text = safe(data.get("formationDelais"), (
        "Les inscriptions sont acceptées jusqu'à 14 jours ouvrés "
        "avant le début de la formation, sous réserve de places disponibles. "
        "Un délai supplémentaire peut être nécessaire en cas de financement "
        "par un organisme tiers (OPCO, FAF, Pôle Emploi)."
    ))
    story.append(Paragraph(delais_text, S["body"]))

    # ═══════════════════════════════════════════════════════════
    # ACCESSIBILITÉ
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 10 * mm))
    story.append(section_tag(S, "ACCESSIBILITÉ"))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("ACCESSIBILITÉ.", S["section_title"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(
        "Cette formation est accessible aux personnes en situation de handicap. "
        "Merci de nous contacter afin d'étudier ensemble les modalités d'adaptation "
        "nécessaires pour garantir les meilleures conditions d'apprentissage.",
        S["body"]
    ))

    # ═══════════════════════════════════════════════════════════
    # CONTACT
    # ═══════════════════════════════════════════════════════════

    story.append(Spacer(1, 10 * mm))
    story.append(hr_line(cw))
    story.append(Spacer(1, 6 * mm))

    email = safe(data.get("emailFormation"), "formation@lesgriots.com")
    phone = safe(data.get("phoneFormation"), "06 47 04 15 35")

    contact_rows = [
        [Paragraph("CONTACT", S["contact_label"]),
         Paragraph(f"{email}  ·  {phone}", S["contact_value"])],
    ]
    contact_t = Table(contact_rows, colWidths=[cw * 0.25, cw * 0.75])
    contact_t.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("LEFTPADDING",  (0, 0), (0, -1), 0),
    ]))
    story.append(contact_t)

    story.append(Spacer(1, 4 * mm))

    address = safe(data.get("address"), "")
    postal = safe(data.get("postalCode"), "")
    city = safe(data.get("city"), "")
    if address or city:
        addr_line = ", ".join(filter(None, [address, f"{postal} {city}".strip()]))
        story.append(Paragraph(addr_line, S["small"]))

    # ───────────────────────────────────────────────────────────
    # Build
    # ───────────────────────────────────────────────────────────

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON parse error: {e}\n")
        sys.exit(1)

    pdf_bytes = generate(data)
    sys.stdout.buffer.write(pdf_bytes)

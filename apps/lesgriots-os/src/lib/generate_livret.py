#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Livret d'Accueil & Convocation PDF
Charte graphique : fond beige, titres monospace bold, encadrés jaunes,
footer légal LES GRIOTS / La Griothèque.

Usage: echo '<json>' | python3 generate_livret.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, Flowable
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


class SetHeader(Flowable):
    """Zero-height flowable that updates the page header state for subsequent pages."""
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


def fmt_date(d):
    if not d:
        return ""
    try:
        months = ["janvier","février","mars","avril","mai","juin",
                  "juillet","août","septembre","octobre","novembre","décembre"]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {months[dt.month-1]} {dt.year}"
    except:
        return str(d)


def fmt_date_short(d):
    if not d:
        return ""
    try:
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year}"
    except:
        return str(d)


def fmt_date_long_weekday(d):
    """Returns 'Lundi 30 mars 2026'."""
    if not d:
        return ""
    try:
        jours = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
        months = ["janvier","février","mars","avril","mai","juin",
                  "juillet","août","septembre","octobre","novembre","décembre"]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{jours[dt.weekday()]} {dt.day} {months[dt.month-1]} {dt.year}"
    except:
        return str(d)


# ═══════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        # Cover
        "cover_sub": ParagraphStyle("lv_cover_sub", fontName="Courier-Bold", fontSize=9,
                                     textColor=BK, leading=12, spaceAfter=6),
        "cover_title": ParagraphStyle("lv_cover_title", fontName="Courier-Bold", fontSize=36,
                                       textColor=BK, leading=42),
        "cover_intro": ParagraphStyle("lv_cover_intro", fontName="Courier", fontSize=10,
                                       textColor=BK, leading=15),
        "cover_formation": ParagraphStyle("lv_cover_formation", fontName="Courier-Bold", fontSize=9,
                                           textColor=GOLD, leading=12),
        "cover_pour": ParagraphStyle("lv_cover_pour", fontName="Courier-Bold", fontSize=10,
                                      textColor=BK, leading=14),
        # Section titles
        "section_tag": ParagraphStyle("lv_section_tag", fontName="Courier-Bold", fontSize=9,
                                       textColor=BK, leading=12),
        "section_title": ParagraphStyle("lv_section_title", fontName="Courier-Bold", fontSize=26,
                                         textColor=BK, leading=32),
        # Convocation
        "conv_tag": ParagraphStyle("lv_conv_tag", fontName="Courier-Bold", fontSize=9,
                                    textColor=BK, leading=12),
        "conv_title": ParagraphStyle("lv_conv_title", fontName="Courier-Bold", fontSize=24,
                                      textColor=BK, leading=30),
        "conv_intro": ParagraphStyle("lv_conv_intro", fontName="Courier", fontSize=10,
                                      textColor=BK, leading=15),
        # Body text
        "h2": ParagraphStyle("lv_h2", fontName="Courier-Bold", fontSize=10,
                              textColor=BK, leading=14, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("lv_body", fontName="Courier", fontSize=9,
                                textColor=BK, leading=14, alignment=TA_JUSTIFY),
        "body_b": ParagraphStyle("lv_body_b", fontName="Courier-Bold", fontSize=9,
                                  textColor=BK, leading=14),
        "small": ParagraphStyle("lv_small", fontName="Courier", fontSize=8,
                                 textColor=BK, leading=11),
        "small_b": ParagraphStyle("lv_small_b", fontName="Courier-Bold", fontSize=8,
                                   textColor=BK, leading=11),
        # Table cells
        "th": ParagraphStyle("lv_th", fontName="Courier-Bold", fontSize=8,
                              textColor=LGRAY, leading=10),
        "tc": ParagraphStyle("lv_tc", fontName="Courier", fontSize=9,
                              textColor=BK, leading=13),
        "tc_b": ParagraphStyle("lv_tc_b", fontName="Courier-Bold", fontSize=9,
                                textColor=BK, leading=13),
        # Yellow box
        "ybox_title": ParagraphStyle("lv_ybox_title", fontName="Courier-Bold", fontSize=8,
                                      textColor=BK, leading=11),
        "ybox_body": ParagraphStyle("lv_ybox_body", fontName="Courier", fontSize=9,
                                     textColor=BK, leading=14),
        # Sommaire
        "sommaire_num": ParagraphStyle("lv_sommaire_num", fontName="Courier", fontSize=10,
                                        textColor=BK, leading=14),
        "sommaire_title": ParagraphStyle("lv_sommaire_title", fontName="Courier-Bold", fontSize=10,
                                          textColor=BK, leading=14),
        # Modules (dark boxes)
        "mod_chapter": ParagraphStyle("lv_mod_chapter", fontName="Courier-Bold", fontSize=8,
                                       textColor=GOLD, leading=11),
        "mod_title": ParagraphStyle("lv_mod_title", fontName="Courier-Bold", fontSize=11,
                                     textColor=WHITE, leading=15),
        "mod_bullet": ParagraphStyle("lv_mod_bullet", fontName="Courier", fontSize=9,
                                      textColor=WHITE, leading=13),
        # Sécurité numéros
        "sec_num": ParagraphStyle("lv_sec_num", fontName="Courier-Bold", fontSize=9,
                                   textColor=BK, leading=12),
        # Règlement
        "article_title": ParagraphStyle("lv_article_title", fontName="Courier-Bold", fontSize=9,
                                         textColor=BK, leading=12),
        "article_sub": ParagraphStyle("lv_article_sub", fontName="Courier-Bold", fontSize=10,
                                       textColor=BK, leading=14),
        "article_body": ParagraphStyle("lv_article_body", fontName="Courier", fontSize=9,
                                        textColor=BK, leading=13),
        # Attestation
        "att_title": ParagraphStyle("lv_att_title", fontName="Courier-Bold", fontSize=26,
                                     textColor=BK, leading=32),
        # Footer
        "footer": ParagraphStyle("lv_footer", fontName="Courier", fontSize=6,
                                  textColor=LGRAY, leading=8, alignment=TA_CENTER),
        # Header
        "header_left": ParagraphStyle("lv_header_left", fontName="Courier-Bold", fontSize=8,
                                       textColor=BK, leading=10),
        "header_right": ParagraphStyle("lv_header_right", fontName="Courier", fontSize=7,
                                        textColor=BK, leading=9, alignment=TA_RIGHT),
    }


# ═══════════════════════════════════════════════════════════════════
# HELPER: yellow highlight box
# ═══════════════════════════════════════════════════════════════════

def yellow_box(S, title, body_text, cw):
    """Create a yellow highlighted box with title and body."""
    content = []
    if title:
        content.append(Paragraph(f"<b>{title}</b>", S["ybox_title"]))
        content.append(Spacer(1, 2*mm))
    content.append(Paragraph(body_text, S["ybox_body"]))

    inner_table = Table([[content]], colWidths=[cw - 8*mm])
    inner_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return inner_table


def section_tag(S, label):
    """Yellow tag label like [SECTION 01]."""
    tag_para = Paragraph(f"  {label}  ", ParagraphStyle("tag_tmp", fontName="Courier-Bold",
                          fontSize=8, textColor=BK, leading=11))
    tag_table = Table([[tag_para]], colWidths=[None])
    tag_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return tag_table


def hr_line(cw):
    """Simple horizontal rule."""
    t = Table([[""]],  colWidths=[cw])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, BK),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


# ═══════════════════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════════════════

def generate(data):
    buf = io.BytesIO()
    S = _make_styles()
    cw = W - 2 * MARGIN

    # ── Data extraction ──
    stagiaire_name    = safe(data.get("stagiaireName"), "Stagiaire")
    stagiaire_prenom  = safe(data.get("stagiairePrenom"), "")
    stagiaire_company = safe(data.get("stagiaireCompany"), "")
    stagiaire_siret   = safe(data.get("stagiaireSiret"), "")
    dossier_number    = safe(data.get("dossierNumber"), "")
    stagiaire_email   = safe(data.get("stagiaireEmail"), "")

    formation_title   = safe(data.get("formationTitle"), "Formation")
    formation_desc    = safe(data.get("formationDescription"), "")
    formation_objectives = data.get("formationObjectives", [])
    formation_prereq  = safe(data.get("formationPrerequisites"), "Aucun")
    formation_public  = safe(data.get("formationPublic"), "TPE, indépendants, entrepreneurs")
    formation_modality = safe(data.get("formationModality"), "Présentiel")
    formation_evaluation = safe(data.get("formationEvaluation"), "Continue + à chaud + à froid")
    formation_sanction = safe(data.get("formationSanction"), "Attestation de fin de formation")
    formation_delais  = safe(data.get("formationDelais"), "Minimum deux semaines après validation")
    formation_admission = safe(data.get("formationAdmission"), "Sur entretien préalable")
    formation_method  = safe(data.get("formationMethod"), "Active et participative")
    formation_moyens_materiels = safe(data.get("formationMoyensMateriels"), "")

    modules           = data.get("modules", [])
    planning          = data.get("planning", [])

    start_date        = safe(data.get("startDate"))
    end_date          = safe(data.get("endDate"))
    location          = safe(data.get("location"), "")
    horaires          = safe(data.get("horaires"), "09h00 – 12h30 · 14h00 – 17h30")

    formateur_name    = safe(data.get("formateurName"), "Moustapha COULIBALY")

    company_name      = safe(data.get("companyName"), "LES GRIOTS")
    legal_status      = safe(data.get("legalStatus"), "SASU")
    capital           = safe(data.get("capital"), "1000 €")
    rcs               = safe(data.get("rcs"), "902 628 684")
    siret             = safe(data.get("siret"), "90262868400018")
    address           = safe(data.get("address"), "80 avenue du 8 mai 1945")
    postal_code       = safe(data.get("postalCode"), "76610")
    city              = safe(data.get("city"), "Le Havre")
    nda               = safe(data.get("nda"), "28 76 07471 76")
    dreets            = safe(data.get("dreets"), "DREETS de Normandie")
    email_formation   = safe(data.get("emailFormation"), "formation@lesgriots.com")
    phone_formation   = safe(data.get("phoneFormation"), "06 47 04 15 35")

    year              = datetime.now().year
    logo_img          = _load_logo(data)

    def _draw_logo(canvas, y_offset_mm):
        """Dessine le logo en tête de page et retourne le décalage x du texte."""
        if logo_img is None:
            return MARGIN
        try:
            canvas.drawImage(logo_img, MARGIN, H - MARGIN + y_offset_mm - 6*mm,
                             width=8*mm, height=8*mm,
                             preserveAspectRatio=True, mask='auto')
            return MARGIN + 10*mm
        except Exception:
            return MARGIN

    footer_line1 = f"{company_name} · {legal_status} AU CAPITAL DE {capital} · RCS LE HAVRE {rcs} · {address}, {postal_code} {city}"
    footer_line2 = f"ORGANISME DE FORMATION ENREGISTRÉ SOUS LE N° {nda} AUPRÈS DE LA {dreets} ·"
    footer_line3 = email_formation.upper()

    # ── Page drawing ──
    # Mutable dict read by draw_section_page — updated via SetHeader flowable
    header_state = {
        "left": "LA GRIOTHÈQUE · LIVRET D'ACCUEIL",
        "right": f"{formation_title.upper()[:30]}\n©{year} {company_name}",
    }

    def draw_cover_page(canvas, doc):
        """Cover page: beige background, footer only."""
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Footer line
        canvas.setStrokeColor(BK)
        canvas.setLineWidth(0.3)
        canvas.line(MARGIN, 22*mm, W - MARGIN, 22*mm)
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawString(MARGIN, 17*mm, f"©{year} {company_name}")
        canvas.drawCentredString(W/2, 17*mm, "DOCUMENT QUALIOPI · CONVOCATION")
        canvas.drawRightString(W - MARGIN, 17*mm, f"RÉF. {dossier_number}")
        canvas.restoreState()

    def draw_convocation_page(canvas, doc):
        """Convocation page: beige bg, header + legal footer."""
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Header
        text_x = _draw_logo(canvas, 2*mm)
        canvas.setFont("Courier-Bold", 8)
        canvas.setFillColor(BK)
        canvas.drawString(text_x, H - MARGIN + 2*mm, "LA GRIOTHÈQUE · CONVOCATION OFFICIELLE")
        canvas.setFont("Courier", 7)
        canvas.drawRightString(W - MARGIN, H - MARGIN + 2*mm, f"{stagiaire_name.upper()}")
        canvas.drawRightString(W - MARGIN, H - MARGIN - 3*mm, f"©{year} {company_name}")
        canvas.setStrokeColor(BK)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - MARGIN - 5*mm, W - MARGIN, H - MARGIN - 5*mm)
        # Footer
        canvas.setFont("Courier", 5.5)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W/2, 16*mm, footer_line1.upper())
        canvas.drawCentredString(W/2, 11*mm, footer_line2.upper())
        canvas.drawCentredString(W/2, 7*mm, footer_line3)
        canvas.restoreState()

    def draw_section_page(canvas, doc):
        """Standard section page: beige bg, header + legal footer."""
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Read header from shared state (updated via SetHeader flowable)
        hl = header_state.get("left", "LA GRIOTHÈQUE · LIVRET D'ACCUEIL")
        hr = header_state.get("right", f"{formation_title.upper()[:30]}\n©{year} {company_name}")
        # Header
        text_x = _draw_logo(canvas, 2*mm)
        canvas.setFont("Courier-Bold", 8)
        canvas.setFillColor(BK)
        canvas.drawString(text_x, H - MARGIN + 2*mm, hl)
        canvas.setFont("Courier", 7)
        lines = hr.split("\n")
        for i, line in enumerate(lines):
            canvas.drawRightString(W - MARGIN, H - MARGIN + 2*mm - i*4*mm, line)
        canvas.setStrokeColor(BK)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - MARGIN - 5*mm, W - MARGIN, H - MARGIN - 5*mm)
        # Footer
        canvas.setFont("Courier", 5.5)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W/2, 16*mm, footer_line1.upper())
        canvas.drawCentredString(W/2, 11*mm, footer_line2.upper())
        canvas.drawCentredString(W/2, 7*mm, footer_line3)
        canvas.restoreState()

    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN + 10*mm, bottomMargin=MARGIN + 10*mm)
    cw = W - 2 * MARGIN

    frame_cover = Frame(MARGIN, MARGIN + 10*mm, cw, H - 2*MARGIN - 20*mm, id="cover")
    frame_main = Frame(MARGIN, MARGIN + 10*mm, cw, H - 2*MARGIN - 20*mm, id="main")

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame_cover], onPage=draw_cover_page),
        PageTemplate(id="convocation", frames=[frame_main], onPage=draw_convocation_page),
        PageTemplate(id="section", frames=[frame_main], onPage=draw_section_page),
    ])

    story = []

    # ═══════════════════════════════════════════════════════════════
    # PAGE 1 — COVER
    # ═══════════════════════════════════════════════════════════════

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("— LA GRIOTHÈQUE · LIVRET D'ACCUEIL &amp; CONVOCATION", S["cover_sub"]))
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph("LIVRET<br/>D'ACCUEIL<br/>DU STAGIAIRE.", S["cover_title"]))
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph(
        "Bienvenue. Ce document fait office de convocation officielle "
        "et rassemble toutes les informations nécessaires pour aborder "
        "votre formation dans les meilleures conditions.",
        S["cover_intro"]))
    story.append(Spacer(1, 12*mm))

    # Yellow formation bar
    formation_bar = Table(
        [[Paragraph(f"FORMATION · {formation_title.upper()}", S["cover_formation"])]],
        colWidths=[cw]
    )
    formation_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BK),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(formation_bar)
    story.append(Spacer(1, 4*mm))

    full_name = f"{stagiaire_prenom} {stagiaire_name}".strip() or stagiaire_name
    story.append(Paragraph(f"POUR {full_name.upper()}", S["cover_pour"]))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 2 — CONVOCATION OFFICIELLE
    # ═══════════════════════════════════════════════════════════════

    from reportlab.platypus import NextPageTemplate
    story.append(NextPageTemplate("convocation"))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "CONVOCATION"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("VOUS ÊTES ATTENDU·E<br/>À LA FORMATION.", S["conv_title"]))
    story.append(Spacer(1, 6*mm))
    prenom_only = stagiaire_prenom or stagiaire_name.split()[0] if stagiaire_name else "Stagiaire"
    story.append(Paragraph(
        f"Cher·e {prenom_only}, nous avons le plaisir de vous confirmer votre inscription à la formation "
        f"détaillée ci-dessous. Ce document vaut convocation officielle.",
        S["conv_intro"]))
    story.append(Spacer(1, 8*mm))

    # IDENTIFICATION section
    story.append(Paragraph("IDENTIFICATION", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))

    id_data = [
        [Paragraph("STAGIAIRE", S["th"]), "", ],
        [Paragraph(f"<b>{full_name}</b>", S["tc_b"]), ""],
    ]
    id_table = Table(id_data, colWidths=[cw])
    id_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(id_table)

    # Structure + SIRET
    if stagiaire_company or stagiaire_siret:
        id2_data = [[
            [Paragraph("STRUCTURE", S["th"]), Paragraph(stagiaire_company or "—", S["tc"])],
            [Paragraph("N° SIRET", S["th"]), Paragraph(stagiaire_siret or "—", S["tc"])],
        ]]
        id2_table = Table(id2_data[0], colWidths=[cw/2, cw/2])
        id2_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
            ("LINEBEFORE", (1, 0), (1, -1), 0.5, LGRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(id2_table)

    # N° de dossier
    if dossier_number:
        id3_data = [
            [Paragraph("N° DE DOSSIER", S["th"])],
            [Paragraph(dossier_number, S["tc"])],
        ]
        id3_table = Table(id3_data, colWidths=[cw])
        id3_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(id3_table)

    story.append(Spacer(1, 6*mm))

    # DÉTAILS DE LA FORMATION
    story.append(Paragraph("DÉTAILS DE LA FORMATION", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))

    # Intitulé
    det1 = Table([
        [Paragraph("INTITULÉ", S["th"])],
        [Paragraph(f"<b>{formation_title}</b>", S["tc_b"])],
    ], colWidths=[cw])
    det1.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(det1)

    # Dates
    det2 = Table([[
        [Paragraph("DATE DE DÉBUT", S["th"]), Paragraph(fmt_date_short(start_date), S["tc"])],
        [Paragraph("DATE DE FIN", S["th"]), Paragraph(fmt_date_short(end_date), S["tc"])],
    ]], colWidths=[cw/2, cw/2])
    det2.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(det2)

    # Modalité + formateur
    det3 = Table([[
        [Paragraph("MODALITÉ", S["th"]), Paragraph(formation_modality, S["tc"])],
        [Paragraph("FORMATEUR", S["th"]), Paragraph(formateur_name, S["tc"])],
    ]], colWidths=[cw/2, cw/2])
    det3.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(det3)

    # Lieu
    if location:
        det4 = Table([
            [Paragraph("LIEU", S["th"])],
            [Paragraph(location, S["tc"])],
        ], colWidths=[cw])
        det4.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(det4)

    story.append(Spacer(1, 4*mm))

    # À NOTER yellow box
    story.append(yellow_box(S, "À NOTER",
        "Vous êtes invité·e à vous présenter quinze minutes avant le début de la première session "
        "pour permettre l'accueil et la signature de la feuille d'émargement.",
        cw))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 3 — PLANNING
    # ═══════════════════════════════════════════════════════════════

    short_title = formation_title.upper()[:30]
    right_header = f"{short_title}\n©{year} {company_name}"
    right_header_stagiaire = f"{full_name.upper()}\n©{year} {company_name}"

    story.append(NextPageTemplate("section"))
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · PLANNING DE LA FORMATION",
        right=right_header_stagiaire))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "PLANNING"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("LE DÉROULÉ JOUR<br/>PAR JOUR.", S["section_title"]))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "Le planning ci-dessous précise les sessions et leurs horaires. Ce déroulé pourra être ajusté "
        "à la marge en fonction de la dynamique de la session.",
        S["body"]))
    story.append(Spacer(1, 8*mm))

    # Planning table
    plan_header = [Paragraph("DATE", S["th"]), Paragraph("HORAIRES", S["th"])]
    plan_data = [plan_header]

    if planning:
        for p in planning:
            plan_data.append([
                Paragraph(fmt_date_long_weekday(p.get("date", "")), S["tc_b"]),
                Paragraph(safe(p.get("horaires", horaires)), S["tc"]),
            ])
    else:
        # Generate from start/end dates
        try:
            from datetime import timedelta
            sd = datetime.strptime(start_date[:10], "%Y-%m-%d")
            ed = datetime.strptime(end_date[:10], "%Y-%m-%d")
            current = sd
            while current <= ed:
                if current.weekday() < 5:  # Skip weekends
                    plan_data.append([
                        Paragraph(fmt_date_long_weekday(current.strftime("%Y-%m-%d")), S["tc_b"]),
                        Paragraph(horaires, S["tc"]),
                    ])
                current += timedelta(days=1)
        except:
            plan_data.append([
                Paragraph(f"{fmt_date_short(start_date)} – {fmt_date_short(end_date)}", S["tc_b"]),
                Paragraph(horaires, S["tc"]),
            ])

    plan_table = Table(plan_data, colWidths=[cw*0.45, cw*0.55])
    plan_style = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BK),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(plan_data)):
        plan_style.append(("LINEBELOW", (0, i), (-1, i), 0.3, LGRAY))
    plan_table.setStyle(TableStyle(plan_style))
    story.append(plan_table)
    story.append(Spacer(1, 8*mm))

    # Contact box
    story.append(yellow_box(S, "CONTACT EN CAS D'IMPRÉVU",
        f"Pour toute absence, retard ou question liée au déroulement de la formation :<br/>"
        f"{email_formation} — {phone_formation}",
        cw))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 4 — SOMMAIRE
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · LIVRET D'ACCUEIL",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SOMMAIRE"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("CE QUE VOUS TROUVEREZ<br/>DANS CE LIVRET.", S["section_title"]))
    story.append(Spacer(1, 10*mm))

    sections = [
        ("01", "PRÉSENTATION DE L'ORGANISME"),
        ("02", "NOTRE FORMATION"),
        ("03", "ACCUEIL ET SUIVI DES STAGIAIRES"),
        ("04", "PROGRAMME DE FORMATION"),
        ("05", "MOYENS HUMAINS ET LOGISTIQUES"),
        ("06", "CHARTE DU STAGIAIRE"),
        ("07", "CONSIGNES DE SÉCURITÉ"),
        ("08", "RÈGLEMENT INTÉRIEUR"),
    ]

    sommaire_data = []
    for num, title in sections:
        sommaire_data.append([
            Paragraph(num, S["sommaire_num"]),
            Paragraph(f"<b>{title}</b>", S["sommaire_title"]),
        ])

    sommaire_table = Table(sommaire_data, colWidths=[cw*0.12, cw*0.88])
    sommaire_style = [
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(len(sommaire_data)):
        sommaire_style.append(("LINEBELOW", (0, i), (-1, i), 0.3, LGRAY))
    sommaire_table.setStyle(TableStyle(sommaire_style))
    story.append(sommaire_table)

    # ═══════════════════════════════════════════════════════════════
    # PAGE 5 — SECTION 01 : PRÉSENTATION DE L'ORGANISME
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 01 · PRÉSENTATION",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 01"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("PRÉSENTATION<br/>DE L'ORGANISME.", S["section_title"]))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph(
        f"{company_name} est une infrastructure narrative afro-diasporique spécialisée dans la production "
        f"audiovisuelle, la direction créative et la formation. Implantée au Havre, elle s'organise "
        f"autour de trois piliers : un studio de production et de direction artistique, une production "
        f"originale, et <b>La Griothèque</b> — son organisme de formation certifié Qualiopi.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Les formations proposées par La Griothèque s'adressent aux indépendants, créateurs, "
        "dirigeants de TPE et structures culturelles souhaitant acquérir des compétences concrètes en "
        "stratégie de communication, production audiovisuelle et stratégie de contenu.",
        S["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(yellow_box(S, "NOTRE APPROCHE PÉDAGOGIQUE",
        "Trois principes fondateurs : la rigueur professionnelle, l'écoute attentive des besoins "
        "de chaque participant, et l'ancrage dans la pratique réelle du métier.",
        cw))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "Chaque parcours est pensé comme une transmission : nous ne formons pas à des outils, nous "
        "transmettons une posture. Celle d'un créateur autonome, capable de penser sa communication "
        "comme un récit cohérent, de produire ses propres contenus avec exigence, et de mesurer leur "
        "impact pour ajuster sa pratique en continu.",
        S["body"]))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 6 — SECTION 02 : NOTRE FORMATION
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 02 · NOTRE FORMATION",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 02"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("NOTRE FORMATION.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("NOTRE OFFRE", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"Nous proposons la formation « <b>{formation_title}</b> », dont le programme "
        f"est détaillé dans la section 04 du présent livret. La formation est adaptable et "
        f"personnalisable selon le profil et les besoins du stagiaire.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("LE FORMATEUR", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"Le formateur est M. {formateur_name}, directeur de l'organisme de formation, référent "
        f"pédagogique, administratif et handicap.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("LES MODALITÉS", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Les formations se déroulent en présentiel, sur le site convenu avec le bénéficiaire. L'accord "
        "préalable précise le lieu, le rythme et les conditions matérielles d'accueil.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("PERSONNALISATION", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Chaque formation peut être adaptée et personnalisée selon les besoins du stagiaire ou de la "
        "structure : contenu, modalités (théorie, pratique, écrit, oral, vidéo), techniques "
        "d'apprentissage, rythme et niveau de complexité.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("ACCESSIBILITÉ — HANDICAP", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Nous nous engageons à mettre en œuvre tous les moyens à notre disposition pour permettre "
        "l'accessibilité de nos offres aux personnes en situation de handicap. En cas d'impossibilité, "
        "nous redirigeons vers des prestataires spécialisés.",
        S["body"]))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 7 — SECTION 03 : ACCUEIL ET SUIVI
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 03 · ACCUEIL ET SUIVI",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 03"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("ACCUEIL ET SUIVI<br/>DES STAGIAIRES.", S["section_title"]))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph(
        "Les stagiaires inscrits à une formation sont invités à se présenter <b>quinze minutes avant le "
        "début de la première session</b>, afin de permettre l'accueil et la signature de la feuille "
        "d'émargement.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Les horaires précis de la formation sont communiqués au stagiaire avant le début de la "
        "session, et rappelés par le formateur lors de la première journée.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Les frais de restauration ne sont pas pris en charge par l'organisme de formation. Des points "
        "de restauration sont signalés à proximité des lieux de formation.",
        S["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(yellow_box(S, "EN CAS D'ABSENCE OU DE RETARD",
        f"Le stagiaire prévient l'organisme dans les meilleurs délais par e-mail à "
        f"{email_formation} ou par téléphone au {phone_formation}.",
        cw))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "La formation est sanctionnée par <b>une attestation de fin de formation</b>. Le stagiaire s'engage à "
        "se conformer aux exercices d'évaluation prévus tout au long de la session pour permettre la "
        "mesure des acquis.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "L'objectif pédagogique de l'organisme est l'acquisition de savoir-faire concrets et de "
        "compétences clés directement applicables à l'activité professionnelle du stagiaire.",
        S["body"]))

    # ═══════════════════════════════════════════════════════════════
    # PAGES 8-10 — SECTION 04 : PROGRAMME
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 04 · PROGRAMME",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 04"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("PROGRAMME<br/>DE FORMATION.", S["section_title"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"« <i>{formation_title}</i> »", ParagraphStyle(
        "lv_italic", fontName="Courier-Oblique", fontSize=10, textColor=BK, leading=14)))
    story.append(Spacer(1, 6*mm))

    # Descriptif
    if formation_desc:
        story.append(Paragraph("DESCRIPTIF", S["h2"]))
        story.append(hr_line(cw))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(formation_desc, S["body"]))
        story.append(Spacer(1, 4*mm))

    # Objectifs pédagogiques
    if formation_objectives:
        story.append(Paragraph("OBJECTIFS PÉDAGOGIQUES", S["h2"]))
        story.append(hr_line(cw))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph("À l'issue de la formation, les participants seront capables de :", S["body"]))
        story.append(Spacer(1, 2*mm))
        for obj in formation_objectives:
            obj_text = safe(obj) if isinstance(obj, str) else safe(obj.get("text", "") if isinstance(obj, dict) else str(obj))
            if obj_text:
                story.append(Paragraph(f"•  {obj_text}", S["body"]))
                story.append(Spacer(1, 1*mm))
        story.append(Spacer(1, 4*mm))

    # Informations pratiques table
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 04 · PROGRAMME",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 04 · SUITE"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("INFORMATIONS<br/>PRATIQUES.", S["section_title"]))
    story.append(Spacer(1, 8*mm))

    info_rows = [
        ("MODALITÉ", formation_modality, "PRÉREQUIS", formation_prereq),
        ("PUBLIC VISÉ", formation_public, "MÉTHODE PÉDAGOGIQUE", formation_method),
        ("DÉLAIS D'ACCÈS", formation_delais, "MODALITÉ D'ADMISSION", formation_admission),
        ("SANCTION", formation_sanction, "ÉVALUATION", formation_evaluation),
    ]

    for label1, val1, label2, val2 in info_rows:
        row = Table([[
            [Paragraph(label1, S["th"]), Paragraph(val1, S["tc"])],
            [Paragraph(label2, S["th"]), Paragraph(val2, S["tc"])],
        ]], colWidths=[cw/2, cw/2])
        row.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
            ("LINEBEFORE", (1, 0), (1, -1), 0.5, LGRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(row)

    story.append(Spacer(1, 8*mm))

    # Approche pédagogique
    story.append(Paragraph("APPROCHE PÉDAGOGIQUE ET ÉVALUATION", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "La formation alterne cours théoriques, démonstrations et exercices pratiques. Une évaluation "
        "continue est mise en place tout au long du parcours, sous forme de mises en situation, de "
        "travaux individuels et de retours personnalisés.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Une évaluation finale, sous forme de projet de synthèse, permet de mesurer l'atteinte des "
        "objectifs pédagogiques. Une évaluation de satisfaction à chaud est recueillie en fin de "
        "session, complétée par une évaluation à froid trois à six mois après la formation.",
        S["body"]))

    # Programme détaillé (modules)
    if modules:
        story.append(PageBreak())
        story.append(Spacer(1, 4*mm))
        story.append(section_tag(S, "PROGRAMME DÉTAILLÉ"))
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("LES MODULES.", S["section_title"]))
        story.append(Spacer(1, 8*mm))

        for i, mod in enumerate(modules):
            mod_title = safe(mod.get("title", f"Module {i+1}"))
            mod_items = mod.get("items", [])
            if isinstance(mod_items, str):
                try:
                    mod_items = json.loads(mod_items)
                except:
                    mod_items = [mod_items] if mod_items else []

            # Build content for dark box
            content_parts = []
            content_parts.append(Paragraph(f"— CHAPITRE {i+1:02d}", S["mod_chapter"]))
            content_parts.append(Paragraph(f"<b>{mod_title.upper()}</b>", S["mod_title"]))
            content_parts.append(Spacer(1, 2*mm))
            for item in mod_items:
                item_text = safe(item) if isinstance(item, str) else safe(item.get("text", "") if isinstance(item, dict) else str(item))
                if item_text:
                    content_parts.append(Paragraph(f"·  {item_text}", S["mod_bullet"]))

            mod_box = Table([[content_parts]], colWidths=[cw - 4*mm])
            mod_box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BK),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]))
            story.append(mod_box)
            story.append(Spacer(1, 3*mm))

    # ═══════════════════════════════════════════════════════════════
    # SECTION 05 — MOYENS HUMAINS ET LOGISTIQUES
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 05 · MOYENS",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 05"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("MOYENS HUMAINS<br/>ET LOGISTIQUES.", S["section_title"]))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph("MOYENS HUMAINS", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"La formation est dispensée par M. <b>{formateur_name}</b>, directeur de l'organisme de formation, "
        f"référent pédagogique, administratif et handicap.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("MOYENS LOGISTIQUES ET TECHNIQUES", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Pour chaque session sont prévus : un support de formation, des temps d'échange, des mises en "
        "pratique, des questions-réponses et des évaluations intermédiaires.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Les locaux retenus permettent une réalisation optimale de la formation : tables, chaises, "
        "paperboard ou écran de projection, accès Wi-Fi, et accessibilité aux personnes à mobilité "
        "réduite lorsque le site le permet.",
        S["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("MATÉRIEL MIS À DISPOSITION", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    materiel = [
        "Supports pédagogiques imprimés et numériques",
        "Trépieds, stabilisateurs et supports pour téléphones",
        "Microphones externes et adaptateurs",
        "Lumières d'appoint",
        "Cartes mémoire, batteries externes, câbles",
    ]
    for m in materiel:
        story.append(Paragraph(f"•  {m}", S["body"]))
        story.append(Spacer(1, 1*mm))

    story.append(Spacer(1, 4*mm))
    story.append(yellow_box(S, "À LA CHARGE DU STAGIAIRE",
        "Le stagiaire vient avec son téléphone portable personnel. Les applications gratuites "
        "nécessaires sont à télécharger en amont selon les indications transmises avec la "
        "convocation.",
        cw))

    # ═══════════════════════════════════════════════════════════════
    # SECTION 06 — CHARTE DU STAGIAIRE
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 06 · CHARTE",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 06"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("CHARTE<br/>DU STAGIAIRE.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("DROITS ET DEVOIRS DES PARTICIPANTS", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Le stagiaire prend connaissance du règlement intérieur (section 08) et s'y conforme pendant "
        "toute la durée de la formation. Acteur et observateur de son parcours, il participe "
        "activement aux échanges, aux exercices et aux évaluations.",
        S["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Chaque stagiaire est tenu au respect de la discrétion professionnelle et au respect des "
        "autres participants. Nous veillons en particulier au respect :",
        S["body"]))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("•  de chaque participant en tant que personne,", S["body"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("•  des règles d'hygiène et de sécurité,", S["body"]))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("•  des règles de civilité et d'écoute mutuelle.", S["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(yellow_box(S, "L'ENGAGEMENT DU STAGIAIRE",
        "Le stagiaire est l'acteur principal de sa formation. La richesse de son parcours dépendra "
        "de son engagement, de son implication dans les exercices pratiques et de sa curiosité "
        "intellectuelle.",
        cw))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("PARTICIPATION À L'AMÉLIORATION CONTINUE", S["h2"]))
    story.append(hr_line(cw))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Dans le cadre de la démarche qualité de l'organisme, nous comptons sur la participation "
        "active de chaque stagiaire pour répondre aux questionnaires d'évaluation à chaud et à froid. "
        "Ces retours nourrissent directement nos actions d'amélioration.",
        S["body"]))

    # ═══════════════════════════════════════════════════════════════
    # SECTION 07 — CONSIGNES DE SÉCURITÉ
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 07 · SÉCURITÉ",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 07"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("CONSIGNES<br/>DE SÉCURITÉ.", S["section_title"]))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "Les consignes ci-dessous s'appliquent à toutes les formations en présentiel.",
        S["body"]))
    story.append(Spacer(1, 6*mm))

    consignes = [
        "Chaque participant veille à sa sécurité personnelle et à celle des autres en respectant "
        "les consignes générales et particulières de sécurité et d'hygiène en vigueur sur le "
        "lieu de formation.",
        "Tout accident ou incident survenu à l'occasion ou en cours de formation doit être "
        "immédiatement signalé au formateur ou à son représentant.",
        "Les participants ne doivent en aucun cas introduire dans les locaux des produits de "
        "nature inflammable ou toxique.",
        "Les consignes incendie, le plan de localisation des extincteurs et les issues de "
        "secours sont affichés dans les locaux de formation. Les stagiaires sont tenus "
        "d'exécuter sans délai l'ordre d'évacuation.",
    ]

    for i, c in enumerate(consignes):
        num_tag = section_tag(S, f"{i+1:02d}")
        row = Table([[num_tag, Paragraph(c, S["body"])]], colWidths=[14*mm, cw - 14*mm])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(row)
        story.append(Spacer(1, 2*mm))

    # ═══════════════════════════════════════════════════════════════
    # SECTION 08 — RÈGLEMENT INTÉRIEUR
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · 08 · RÈGLEMENT INTÉRIEUR",
        right=right_header))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SECTION 08"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("RÈGLEMENT<br/>INTÉRIEUR.", S["section_title"]))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "<i>Règlement conforme aux articles L. 6352-3, L. 6352-4 et R. 6352-1 à R. 6352-15 du Code du travail.</i>",
        ParagraphStyle("lv_italic2", fontName="Courier-Oblique", fontSize=8, textColor=BK, leading=11)))
    story.append(Spacer(1, 6*mm))

    articles = [
        ("Champ d'application",
         f"Le présent règlement s'applique à tous les stagiaires inscrits à une action de formation dispensée par {company_name}, "
         "et ce pour toute la durée de la formation suivie."),
        ("Hygiène et sécurité",
         "La prévention des risques d'accidents et de maladies est impérative. Les consignes générales et particulières "
         "de sécurité en vigueur sur le site de formation doivent être strictement respectées."),
        ("Discipline générale",
         "Il est formellement interdit aux stagiaires : d'entrer dans l'établissement en état d'ivresse ; d'introduire "
         "des boissons alcoolisées ; de quitter le stage sans motif valable ; d'emporter aucun objet sans autorisation "
         "écrite."),
        ("Sanctions",
         "Tout agissement fautif peut faire l'objet par ordre d'importance : avertissement écrit, blâme, exclusion "
         "définitive de la formation."),
        ("Garanties disciplinaires",
         "Aucune sanction ne peut être infligée au stagiaire sans qu'il ne soit informé dans le même temps et par écrit "
         "des griefs retenus contre lui."),
        ("Procédure disciplinaire",
         "Lorsqu'une sanction est envisagée, le stagiaire est convoqué par lettre recommandée avec accusé de réception, "
         "ou remise contre décharge."),
        ("Entretien",
         "Au cours de l'entretien, le stagiaire peut se faire assister par une personne de son choix. Le motif de la "
         "sanction lui est indiqué et ses explications sont recueillies."),
        ("Notification",
         "La sanction ne peut intervenir moins d'un jour franc ni plus de quinze jours après l'entretien. Notification "
         "écrite et motivée."),
        ("Mesure conservatoire",
         "Lorsqu'un agissement fautif rend nécessaire une exclusion temporaire à effet immédiat, aucune sanction "
         "définitive ne peut être prise sans information préalable des griefs."),
        ("Information de l'employeur",
         "Le directeur de l'organisme informe l'employeur du stagiaire et l'organisme paritaire prenant en charge les "
         "frais de formation, de la sanction prise."),
        ("Réclamations",
         f"Toute réclamation peut être adressée par e-mail à {email_formation}. Une réponse est apportée sous sept "
         "jours ouvrés, accompagnée d'un suivi correctif documenté."),
        ("Publicité du règlement",
         "Un exemplaire du présent règlement est remis à chaque stagiaire avant toute inscription définitive, en annexe "
         "du présent livret d'accueil."),
    ]

    for i, (title, body) in enumerate(articles):
        story.append(Paragraph(f"— ARTICLE {i+1:02d}", S["article_title"]))
        story.append(Paragraph(f"<b>{title}</b>", S["article_sub"]))
        story.append(Paragraph(body, S["article_body"]))
        story.append(Spacer(1, 4*mm))

    story.append(Spacer(1, 2*mm))
    story.append(yellow_box(S, "POUR TOUTE QUESTION",
        f"Contact : {email_formation} — {phone_formation}<br/>"
        f"{company_name} · {address}, {postal_code} {city}",
        cw))

    # ═══════════════════════════════════════════════════════════════
    # DERNIÈRE PAGE — ATTESTATION DE REMISE
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · RÉCÉPISSÉ DE REMISE",
        right=right_header_stagiaire))
    story.append(PageBreak())
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "RÉCÉPISSÉ"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("ATTESTATION<br/>DE REMISE.", S["att_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "À compléter et signer par le stagiaire avant le démarrage de la formation. Ce document "
        "atteste que le présent livret d'accueil et la convocation ont été remis et lus, et qu'il en a "
        "été pris connaissance dans son intégralité.",
        S["body"]))
    story.append(Spacer(1, 8*mm))

    # Declaration box
    declaration_text = (
        f"Je soussigné·e <b>{full_name}</b> reconnais avoir reçu le présent livret "
        f"d'accueil et la convocation à la formation « {formation_title} » "
        f"prévue du {fmt_date_short(start_date)} au {fmt_date_short(end_date)}"
    )
    if location:
        declaration_text += f" à {location}"
    declaration_text += (
        ", en avoir pris connaissance, et adhérer à "
        "l'ensemble de son contenu, notamment le règlement intérieur, la charte du "
        "stagiaire et les consignes de sécurité."
    )

    decl_box = Table([
        [Paragraph("DÉCLARATION DU STAGIAIRE", S["small_b"])],
        [Paragraph(declaration_text, S["body"])],
    ], colWidths=[cw - 8*mm])
    decl_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(decl_box)
    story.append(Spacer(1, 10*mm))

    # Fait à / Date
    sig_header = Table([
        [Paragraph("FAIT À", S["th"]), Paragraph("LE (DATE)", S["th"])],
    ], colWidths=[cw/2, cw/2])
    sig_header.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (0, 0), 0.5, BK),
        ("LINEBELOW", (1, 0), (1, 0), 0.5, BK),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_header)
    story.append(Spacer(1, 6*mm))

    # Signature stagiaire
    story.append(Paragraph("SIGNATURE DU STAGIAIRE", S["th"]))
    story.append(Spacer(1, 2*mm))
    sig_box = Table([[""]], colWidths=[cw], rowHeights=[25*mm])
    sig_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
    ]))
    story.append(sig_box)
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<i>Précédée de la mention manuscrite « Lu et approuvé ».</i>",
        ParagraphStyle("lv_italic3", fontName="Courier-Oblique", fontSize=8, textColor=BK, leading=11)))
    story.append(Spacer(1, 4*mm))

    # Signature organisme
    story.append(Paragraph(f"POUR {company_name} — {formateur_name.upper()}, DIRECTEUR", S["th"]))
    story.append(Spacer(1, 2*mm))
    sig_box2 = Table([[""]], colWidths=[cw], rowHeights=[25*mm])
    sig_box2.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
    ]))
    story.append(sig_box2)

    # ── Build ──
    doc.build(story)
    return buf.getvalue()


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    pdf = generate(data)
    sys.stdout.buffer.write(pdf)

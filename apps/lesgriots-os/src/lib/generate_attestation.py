#!/usr/bin/env python3
"""
LES GRIOTS — Generateur d'Attestation de Fin de Formation PDF
Charte graphique : fond beige, titres monospace bold, encadres gold,
footer legal LES GRIOTS / La Griotheque.

Usage: echo '<json>' | python3 generate_attestation.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
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
        months = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
                  "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except Exception:
        return str(d)


# ===================================================================
# STYLES
# ===================================================================

def _make_styles():
    return {
        "doc_title": ParagraphStyle("at_doc_title", fontName="Courier-Bold", fontSize=18,
                                     textColor=BK, leading=24, alignment=TA_CENTER),
        "h2": ParagraphStyle("at_h2", fontName="Courier-Bold", fontSize=11,
                              textColor=BK, leading=15, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("at_body", fontName="Courier", fontSize=9,
                                textColor=BK, leading=14, alignment=TA_JUSTIFY),
        "body_b": ParagraphStyle("at_body_b", fontName="Courier-Bold", fontSize=9,
                                  textColor=BK, leading=14),
        "body_center": ParagraphStyle("at_body_center", fontName="Courier", fontSize=9,
                                       textColor=BK, leading=14, alignment=TA_CENTER),
        "small": ParagraphStyle("at_small", fontName="Courier", fontSize=8,
                                 textColor=BK, leading=11),
        "small_b": ParagraphStyle("at_small_b", fontName="Courier-Bold", fontSize=8,
                                   textColor=BK, leading=11),
        "th": ParagraphStyle("at_th", fontName="Courier-Bold", fontSize=8,
                              textColor=LGRAY, leading=10),
        "tc": ParagraphStyle("at_tc", fontName="Courier", fontSize=9,
                              textColor=BK, leading=13),
        "tc_b": ParagraphStyle("at_tc_b", fontName="Courier-Bold", fontSize=9,
                                textColor=BK, leading=13),
        "legal": ParagraphStyle("at_legal", fontName="Courier", fontSize=7,
                                 textColor=LGRAY, leading=10, alignment=TA_CENTER),
        "header_left": ParagraphStyle("at_header_left", fontName="Courier-Bold", fontSize=8,
                                       textColor=BK, leading=10),
        "header_right": ParagraphStyle("at_header_right", fontName="Courier", fontSize=7,
                                        textColor=BK, leading=9, alignment=TA_RIGHT),
    }


# ===================================================================
# HELPERS
# ===================================================================

def gold_box(S, lines, cw):
    """Encadre gold avec contenu texte."""
    content = []
    for line in lines:
        content.append(Paragraph(line, S["small_b"]))
        content.append(Spacer(1, 1 * mm))
    inner = Table([[content]], colWidths=[cw - 8 * mm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return inner


def info_table(S, rows, cw):
    """Table label/valeur avec lignes fines."""
    table_data = []
    for label, value in rows:
        table_data.append([
            Paragraph(label, S["th"]),
            Paragraph(value, S["tc"])
        ])
    t = Table(table_data, colWidths=[cw * 0.35, cw * 0.65])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    return t


def hr_line(cw):
    t = Table([[""]], colWidths=[cw])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


# ===================================================================
# MAIN
# ===================================================================

def generate(data):
    S = _make_styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "LA GRIOTHEQUE . ATTESTATION DE FIN DE FORMATION", "right": ""}

    company_name = safe(data.get("companyName"), "LES GRIOTS")
    siret = safe(data.get("siret"), "902 628 684 00018")
    nda = safe(data.get("nda"), "28 76 07471 76")
    address = safe(data.get("address"), "")
    postal_code = safe(data.get("postalCode"), "")
    city = safe(data.get("city"), "Le Havre")
    email = safe(data.get("emailFormation"), "formation@lesgriots.com")

    footer_text = (
        f"{company_name} -- SASU au capital de 1 000 EUR "
        f"-- SIRET {siret} -- NDA {nda}"
    )

    logo_img = _load_logo(data)

    # --- Page drawing ---
    def draw_page(canvas, doc):
        canvas.saveState()
        # Fond beige
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
            canvas.drawRightString(W - MARGIN, H - 14 * mm, right_text)
        # Gold accent line
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 17 * mm, W - MARGIN, H - 17 * mm)
        # Footer
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W / 2, 12 * mm, footer_text)
        canvas.restoreState()

    # --- Doc setup ---
    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=20 * mm)

    content_frame = Frame(MARGIN, 20 * mm, cw, H - MARGIN - 24 * mm,
                          id="content_frame")

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[content_frame], onPage=draw_page),
    ])

    year = datetime.now().year
    story = []

    # Set header before content
    story.append(SetHeader(header_state,
        left="LA GRIOTHEQUE . ATTESTATION DE FIN DE FORMATION",
        right=f"(C){year} {company_name}"))

    # ===============================================================
    # TITLE
    # ===============================================================

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("ATTESTATION DE FIN DE FORMATION", S["doc_title"]))
    story.append(Spacer(1, 8 * mm))
    story.append(hr_line(cw))
    story.append(Spacer(1, 6 * mm))

    # ===============================================================
    # ORGANISME INFO BOX
    # ===============================================================

    org_lines = [
        f"{company_name} -- SASU",
        f"Adresse : {address}, {postal_code} {city}" if address else f"Ville : {city}",
        f"SIRET : {siret}",
        f"NDA : {nda}",
        f"Contact : {email}",
    ]
    story.append(KeepTogether([
        gold_box(S, org_lines, cw),
        Spacer(1, 8 * mm),
    ]))

    # ===============================================================
    # ATTESTE QUE
    # ===============================================================

    prenom = safe(data.get("stagiairePrenom"), "")
    nom = safe(data.get("stagiaireName"), "")
    stagiaire_company = safe(data.get("stagiaireCompany"), "")

    story.append(Paragraph("ATTESTE QUE", S["h2"]))
    story.append(Spacer(1, 3 * mm))

    stagiaire_text = f"<b>{prenom} {nom}</b>"
    if stagiaire_company:
        stagiaire_text += f", de la societe <b>{stagiaire_company}</b>,"
    stagiaire_text += " a suivi la formation suivante :"

    story.append(Paragraph(stagiaire_text, S["body"]))
    story.append(Spacer(1, 6 * mm))

    # ===============================================================
    # FORMATION DETAILS
    # ===============================================================

    formation_title = safe(data.get("formationTitle"), "Formation")
    start_date = fmt_date(data.get("startDate"))
    end_date = fmt_date(data.get("endDate"))
    duration_hours = safe(data.get("durationHours"), "7")
    location = safe(data.get("location"), city)
    modality = safe(data.get("formationModality"), "Presentiel")

    date_str = f"Du {start_date} au {end_date}" if end_date else start_date

    rows = [
        ["INTITULE", formation_title],
        ["DATES", date_str],
        ["DUREE", f"{duration_hours} heures"],
        ["LIEU", location],
        ["MODALITE", modality],
    ]

    story.append(KeepTogether([
        Paragraph("FORMATION", S["h2"]),
        Spacer(1, 3 * mm),
        info_table(S, rows, cw),
        Spacer(1, 6 * mm),
    ]))

    # ===============================================================
    # OBJECTIFS PEDAGOGIQUES ATTEINTS
    # ===============================================================

    objectives = data.get("formationObjectives", [])
    if objectives:
        obj_elements = [
            Paragraph("OBJECTIFS PEDAGOGIQUES ATTEINTS", S["h2"]),
            Spacer(1, 3 * mm),
        ]
        for obj in objectives:
            obj_elements.append(Paragraph(f"  -- {obj}", S["body"]))
        obj_elements.append(Spacer(1, 6 * mm))
        story.append(KeepTogether(obj_elements))

    # ===============================================================
    # RESULTATS DE L'EVALUATION
    # ===============================================================

    story.append(KeepTogether([
        Paragraph("RESULTATS DE L'EVALUATION", S["h2"]),
        Spacer(1, 3 * mm),
        Paragraph(
            f"<b>{prenom} {nom}</b> a suivi l'integralite de la formation "
            f"et atteint les objectifs pedagogiques definis dans le programme.",
            S["body"]
        ),
        Spacer(1, 8 * mm),
    ]))

    # ===============================================================
    # FAIT A ... LE ... + SIGNATURE
    # ===============================================================

    attestation_date = fmt_date(data.get("attestationDate"))
    if not attestation_date:
        attestation_date = fmt_date(datetime.now().strftime("%Y-%m-%d"))

    formateur_name = safe(data.get("formateurName"), "Moustapha COULIBALY")

    story.append(hr_line(cw))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(
        f"Fait a {city}, le {attestation_date}.",
        S["body"]
    ))
    story.append(Spacer(1, 8 * mm))

    # Signature block
    sig_content = [
        [
            Paragraph("Le responsable pedagogique", S["small_b"]),
            Spacer(1, 4 * mm),
            Paragraph(f"<b>{formateur_name}</b>", S["tc_b"]),
            Paragraph(f"{company_name}", S["small"]),
            Spacer(1, 18 * mm),
            Paragraph("Signature et cachet :", S["small"]),
        ]
    ]
    sig_table = Table([[sig_content]], colWidths=[cw * 0.5])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))

    # Align signature block to the right using a wrapper table
    wrapper = Table([[None, sig_table]], colWidths=[cw * 0.5, cw * 0.5])
    wrapper.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(wrapper)

    # ===============================================================
    # LEGAL MENTION
    # ===============================================================

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "En application des articles L.6353-1 et R.6353-1 du Code du Travail.",
        S["legal"]
    ))

    # --- Build ---
    doc.build(story)
    return buf.getvalue()


# ===================================================================
# ENTRY POINT
# ===================================================================

if __name__ == "__main__":
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON parse error: {e}\n")
        sys.exit(1)

    pdf_bytes = generate(data)
    sys.stdout.buffer.write(pdf_bytes)

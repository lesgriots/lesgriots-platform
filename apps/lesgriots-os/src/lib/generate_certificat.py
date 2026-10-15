#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Certificat de Réalisation PDF
Charte LA GRIOTHÈQUE : Geist 400/500, noir, beige clair #f5f4f1,
wordmark en en-tête, footer légal LES GRIOTS.

Document Qualiopi obligatoire — page unique.

Usage: echo '<json>' | python3 generate_certificat.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, Flowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.utils import ImageReader

# --- Charte LA GRIOTHÈQUE : Geist 400/500, noir, papier, beige clair ---
import os as _os
from reportlab.pdfbase import pdfmetrics as _pm
from reportlab.pdfbase.ttfonts import TTFont as _TTF
from reportlab.lib.fonts import addMapping as _am
_RACINE = _os.path.normpath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..'))
_WORDMARK = _os.path.join(_RACINE, 'public', 'branding', 'griotheque-wordmark-ink.png')
try:
    _pm.registerFont(_TTF('Geist', _os.path.join(_RACINE, 'resources', 'fonts', 'Geist-Regular.ttf')))
    _pm.registerFont(_TTF('Geist-Medium', _os.path.join(_RACINE, 'resources', 'fonts', 'Geist-Medium.ttf')))
    for _b in (0, 1):
        for _i in (0, 1):
            _am('Geist', _b, _i, 'Geist-Medium' if _b else 'Geist')
    F, FB = 'Geist', 'Geist-Medium'
except Exception:
    F, FB = 'Helvetica', 'Helvetica-Bold'


def _wordmark():
    try:
        return ImageReader(_WORDMARK) if _os.path.exists(_WORDMARK) else None
    except Exception:
        return None


def _dessiner_wordmark(canvas, x, y):
    """Le wordmark LA GRIOTHÈQUE™, 34 mm de large, ancré en bas à gauche."""
    wm = _wordmark()
    if wm is None:
        canvas.setFont(FB, 9)
        canvas.drawString(x, y, 'LA GRIOTHÈQUE™')
        return
    canvas.drawImage(wm, x, y, width=34 * mm, height=34 * mm * 253 / 2095, mask='auto')


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
# SetHeader — dynamic header flowable (same pattern as other PDFs)
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
BEIGE = colors.HexColor("#f5f4f1")
GOLD = colors.HexColor("#000000")
WHITE = colors.white

FOOTER_TEXT = (
    "LES GRIOTS · SASU au capital de 1 000 € "
    "· SIRET 902 628 684 00018 · NDA 28 76 07471 76"
)


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def safe(v, fallback=""):
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


def fmt_date(d):
    if not d:
        return ""
    try:
        months = [
            "janvier", "février", "mars", "avril", "mai", "juin",
            "juillet", "août", "septembre", "octobre", "novembre", "décembre"
        ]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except Exception:
        return str(d)


# ═══════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        "header_left": ParagraphStyle(
            "cr_header_left", fontName=FB, fontSize=8,
            textColor=BK, leading=10,
        ),
        "title": ParagraphStyle(
            "cr_title", fontName=FB, fontSize=22,
            textColor=BK, leading=28, alignment=TA_CENTER,
        ),
        "section": ParagraphStyle(
            "cr_section", fontName=FB, fontSize=10,
            textColor=BK, leading=14, spaceBefore=10, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "cr_body", fontName=F, fontSize=9,
            textColor=BK, leading=14, alignment=TA_JUSTIFY,
        ),
        "body_b": ParagraphStyle(
            "cr_body_b", fontName=FB, fontSize=9,
            textColor=BK, leading=14,
        ),
        "small": ParagraphStyle(
            "cr_small", fontName=F, fontSize=8,
            textColor=BK, leading=11,
        ),
        "small_b": ParagraphStyle(
            "cr_small_b", fontName=FB, fontSize=8,
            textColor=BK, leading=11,
        ),
        "legal": ParagraphStyle(
            "cr_legal", fontName=F, fontSize=7,
            textColor=LGRAY, leading=9, alignment=TA_CENTER,
        ),
        "footer": ParagraphStyle(
            "cr_footer", fontName=F, fontSize=6,
            textColor=LGRAY, leading=8, alignment=TA_CENTER,
        ),
        "th": ParagraphStyle(
            "cr_th", fontName=FB, fontSize=8,
            textColor=LGRAY, leading=10,
        ),
        "td": ParagraphStyle(
            "cr_td", fontName=F, fontSize=9,
            textColor=BK, leading=13,
        ),
        "td_b": ParagraphStyle(
            "cr_td_b", fontName=FB, fontSize=9,
            textColor=BK, leading=13,
        ),
    }


# ═══════════════════════════════════════════════════════════════════
# SECTION SEPARATOR — gold line with label
# ═══════════════════════════════════════════════════════════════════

def section_label(S, label, cw):
    """Gold-backed label tag."""
    tag = Paragraph(f"  {label}  ", ParagraphStyle(
        "cr_tag", fontName=FB, fontSize=8,
        textColor=BK, leading=11,
    ))
    t = Table([[tag]], colWidths=[None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BEIGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def info_row(S, label, value, cw):
    """Single label → value row for the info table."""
    return [
        Paragraph(label, S["th"]),
        Paragraph(safe(value), S["td"]),
    ]


# ═══════════════════════════════════════════════════════════════════
# GENERATE
# ═══════════════════════════════════════════════════════════════════

def generate(data):
    S = _make_styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "Certificat de réalisation", "right": ""}

    company_name = safe(data.get("companyName"), "LES GRIOTS")
    siret = safe(data.get("siret"), "902 628 684 00018")
    nda = safe(data.get("nda"), "28 76 07471 76")
    address = safe(data.get("address"), "")
    postal = safe(data.get("postalCode"), "")
    city = safe(data.get("city"), "Le Havre")

    prenom = safe(data.get("stagiairePrenom"))
    nom = safe(data.get("stagiaireName"))
    stagiaire_full = f"{prenom} {nom}".strip()
    stagiaire_company = safe(data.get("stagiaireCompany"))

    formation_title = safe(data.get("formationTitle"), "Formation")
    objectives = data.get("formationObjectives", [])
    start_date = fmt_date(data.get("startDate"))
    end_date = fmt_date(data.get("endDate"))
    duration = safe(data.get("durationHours"), "7")
    modality = safe(data.get("formationModality"), "Présentiel")
    location = safe(data.get("location"), "")
    certificat_date = fmt_date(data.get("certificatDate"))
    representant = safe(data.get("representantOf"), "Moustapha COULIBALY")

    logo_img = True  # le wordmark est toujours dessiné

    # --- Page drawing ---
    def draw_page(canvas, doc):
        canvas.saveState()
        # Header
        left_text = header_state.get("left", "")
        text_x = MARGIN
        if logo_img is not None:
            try:
                _dessiner_wordmark(canvas, MARGIN, H - 14.6 * mm)
                text_x = MARGIN + 10 * mm
            except Exception:
                text_x = MARGIN
        canvas.setFont(FB, 8)
        canvas.setFillColor(BK)
        canvas.drawRightString(W - MARGIN, H - 14 * mm, left_text)
        # Gold accent line under header
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 17 * mm, W - MARGIN, H - 17 * mm)
        # Footer
        canvas.setFont(F, 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W / 2, 10 * mm, FOOTER_TEXT)
        canvas.restoreState()

    # --- Doc setup ---
    doc = BaseDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=18 * mm,
    )

    frame = Frame(
        MARGIN, 18 * mm, cw, H - MARGIN - 22 * mm,
        id="main_frame",
    )

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=draw_page),
    ])

    story = []

    # ───────────────────────────────────────────────────────────
    # HEADER — SetHeader before content
    # ───────────────────────────────────────────────────────────

    story.append(SetHeader(header_state,
        left="Certificat de réalisation"))

    # ───────────────────────────────────────────────────────────
    # TITLE
    # ───────────────────────────────────────────────────────────

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Certificat de réalisation", S["title"]))
    # Gold underline via table
    gold_line = Table([[""]], colWidths=[60 * mm])
    gold_line.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(gold_line)
    story.append(Spacer(1, 8 * mm))

    # ───────────────────────────────────────────────────────────
    # SECTION : ORGANISME DE FORMATION
    # ───────────────────────────────────────────────────────────

    story.append(section_label(S, "Organisme de formation", cw))
    story.append(Spacer(1, 3 * mm))

    of_lines = [
        f"<b>{company_name}</b> · SASU",
        f"NDA : {nda}",
        f"SIRET : {siret}",
    ]
    if address:
        addr_line = address
        if postal or city:
            addr_line = ", ".join(x for x in [addr_line, f"{postal} {city}".strip()] if x)
        of_lines.append(addr_line)

    for line in of_lines:
        story.append(Paragraph(line, S["body"]))
    story.append(Spacer(1, 6 * mm))

    # ───────────────────────────────────────────────────────────
    # SECTION : STAGIAIRE
    # ───────────────────────────────────────────────────────────

    story.append(section_label(S, "Stagiaire", cw))
    story.append(Spacer(1, 3 * mm))

    stag_rows = [
        info_row(S, "Nom", nom, cw),
        info_row(S, "Prénom", prenom, cw),
    ]
    if stagiaire_company:
        stag_rows.append(info_row(S, "Entreprise", stagiaire_company, cw))

    stag_table = Table(stag_rows, colWidths=[cw * 0.3, cw * 0.7])
    stag_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    story.append(stag_table)
    story.append(Spacer(1, 6 * mm))

    # ───────────────────────────────────────────────────────────
    # SECTION : ACTION DE FORMATION
    # ───────────────────────────────────────────────────────────

    story.append(section_label(S, "Action de formation", cw))
    story.append(Spacer(1, 3 * mm))

    # Objectives text
    obj_text = " ; ".join(objectives) if objectives else "—"

    formation_rows = [
        info_row(S, "Intitulé", formation_title, cw),
        [Paragraph("Objectif", S["th"]),
         Paragraph(obj_text, S["td"])],
        info_row(S, "Nature", "Action de formation (art. L.6313-1 du Code du Travail)", cw),
        info_row(S, "Dates", f"Du {start_date} au {end_date}", cw),
        info_row(S, "Durée", f"{duration}h", cw),
        info_row(S, "Modalité", modality, cw),
        info_row(S, "Lieu", location, cw),
    ]

    form_table = Table(formation_rows, colWidths=[cw * 0.3, cw * 0.7])
    form_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    story.append(form_table)
    story.append(Spacer(1, 8 * mm))

    # ───────────────────────────────────────────────────────────
    # ATTESTATION
    # ───────────────────────────────────────────────────────────

    story.append(Paragraph(
        f"Le soussigné atteste que <b>{stagiaire_full}</b> a bien réalisé "
        f"l'action de formation désignée ci-dessus.",
        S["body"],
    ))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(
        f"Fait à {city}, le {certificat_date}.",
        S["body_b"],
    ))
    story.append(Spacer(1, 10 * mm))

    # ───────────────────────────────────────────────────────────
    # SIGNATURE BLOCKS
    # ───────────────────────────────────────────────────────────

    sig_left = [
        Paragraph("Le responsable de l'organisme<br/>de formation", S["small_b"]),
        Spacer(1, 3 * mm),
        Paragraph(representant, S["td_b"]),
        Paragraph("Président", S["small"]),
        Spacer(1, 18 * mm),
        Paragraph("Signature et cachet", S["small"]),
    ]
    sig_right = [
        Paragraph("Le stagiaire", S["small_b"]),
        Spacer(1, 3 * mm),
        Paragraph(stagiaire_full, S["td_b"]),
        Spacer(1, 3 * mm),
        Spacer(1, 18 * mm),
        Paragraph("Signature", S["small"]),
    ]

    sig_table = Table([[sig_left, sig_right]], colWidths=[cw * 0.48, cw * 0.48])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (0, 0), 0.5, LGRAY),
        ("BOX", (1, 0), (1, 0), 0.5, LGRAY),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 8 * mm))

    # ───────────────────────────────────────────────────────────
    # LEGAL MENTION
    # ───────────────────────────────────────────────────────────

    story.append(Paragraph(
        "Certificat établi en application des dispositions "
        "de l'article D.6313-3-1 du Code du Travail.",
        S["legal"],
    ))

    # --- Build ---
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

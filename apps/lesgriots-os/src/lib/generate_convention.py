#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Convention de Formation PDF
Charte graphique : fond beige, titres monospace bold, encadrés jaunes,
footer légal LES GRIOTS / La Griothèque.

Usage: echo '<json>' | python3 generate_convention.py
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


# ═══════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        "cover_sub": ParagraphStyle("cv_cover_sub", fontName="Courier-Bold", fontSize=9,
                                     textColor=BK, leading=12, spaceAfter=6),
        "cover_title": ParagraphStyle("cv_cover_title", fontName="Courier-Bold", fontSize=32,
                                       textColor=BK, leading=38),
        "cover_intro": ParagraphStyle("cv_cover_intro", fontName="Courier", fontSize=10,
                                       textColor=BK, leading=15),
        "cover_formation": ParagraphStyle("cv_cover_formation", fontName="Courier-Bold", fontSize=9,
                                           textColor=GOLD, leading=12),
        "section_tag": ParagraphStyle("cv_section_tag", fontName="Courier-Bold", fontSize=9,
                                       textColor=BK, leading=12),
        "section_title": ParagraphStyle("cv_section_title", fontName="Courier-Bold", fontSize=22,
                                         textColor=BK, leading=28),
        "h2": ParagraphStyle("cv_h2", fontName="Courier-Bold", fontSize=10,
                              textColor=BK, leading=14, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("cv_body", fontName="Courier", fontSize=9,
                                textColor=BK, leading=14, alignment=TA_JUSTIFY),
        "body_b": ParagraphStyle("cv_body_b", fontName="Courier-Bold", fontSize=9,
                                  textColor=BK, leading=14),
        "small": ParagraphStyle("cv_small", fontName="Courier", fontSize=8,
                                 textColor=BK, leading=11),
        "small_b": ParagraphStyle("cv_small_b", fontName="Courier-Bold", fontSize=8,
                                   textColor=BK, leading=11),
        "th": ParagraphStyle("cv_th", fontName="Courier-Bold", fontSize=8,
                              textColor=LGRAY, leading=10),
        "tc": ParagraphStyle("cv_tc", fontName="Courier", fontSize=9,
                              textColor=BK, leading=13),
        "tc_b": ParagraphStyle("cv_tc_b", fontName="Courier-Bold", fontSize=9,
                                textColor=BK, leading=13),
        "ybox_title": ParagraphStyle("cv_ybox_title", fontName="Courier-Bold", fontSize=8,
                                      textColor=BK, leading=11),
        "ybox_body": ParagraphStyle("cv_ybox_body", fontName="Courier", fontSize=9,
                                     textColor=BK, leading=14),
        "article_title": ParagraphStyle("cv_article_title", fontName="Courier-Bold", fontSize=10,
                                         textColor=BK, leading=14, spaceBefore=8),
        "article_body": ParagraphStyle("cv_article_body", fontName="Courier", fontSize=9,
                                        textColor=BK, leading=13, alignment=TA_JUSTIFY),
        "footer": ParagraphStyle("cv_footer", fontName="Courier", fontSize=6,
                                  textColor=LGRAY, leading=8, alignment=TA_CENTER),
        "header_left": ParagraphStyle("cv_header_left", fontName="Courier-Bold", fontSize=8,
                                       textColor=BK, leading=10),
        "header_right": ParagraphStyle("cv_header_right", fontName="Courier", fontSize=7,
                                        textColor=BK, leading=9, alignment=TA_RIGHT),
    }


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def yellow_box(S, title, body_text, cw):
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
    t = Table([[""]], colWidths=[cw])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def info_row(S, label, value, cw):
    return Table(
        [[Paragraph(label, S["th"]), Paragraph(safe(value), S["tc"])]],
        colWidths=[cw * 0.35, cw * 0.65]
    )


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def generate(data):
    S = _make_styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "LA GRIOTHÈQUE · CONVENTION DE FORMATION", "right": ""}

    year = datetime.now().year
    company_name = safe(data.get("companyName"), "LES GRIOTS")
    logo_img = _load_logo(data)

    # --- Page drawing functions ---
    def draw_cover_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.rect(MARGIN, MARGIN, cw, H - 2*MARGIN, fill=False, stroke=True)
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W/2, 12*mm,
            f"{company_name} · SASU au capital de 1 000 € · SIRET {safe(data.get('siret'))} · NDA {safe(data.get('nda'))}")
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
                canvas.drawImage(logo_img, MARGIN, H - 16.5*mm, width=8*mm, height=8*mm,
                                 preserveAspectRatio=True, mask='auto')
                text_x = MARGIN + 10*mm
            except Exception:
                text_x = MARGIN
        canvas.setFont("Courier-Bold", 8)
        canvas.setFillColor(BK)
        canvas.drawString(text_x, H - 14*mm, left_text)
        if right_text:
            canvas.setFont("Courier", 7)
            lines = right_text.split("\n")
            for i, line in enumerate(lines):
                canvas.drawRightString(W - MARGIN, H - 14*mm - i*9, line)
        # Gold accent line
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 17*mm, W - MARGIN, H - 17*mm)
        # Footer
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W/2, 12*mm,
            f"{company_name} · SASU au capital de 1 000 € · SIRET {safe(data.get('siret'))} · NDA {safe(data.get('nda'))}")
        # Page number
        canvas.drawRightString(W - MARGIN, 12*mm, f"{doc.page}")
        canvas.restoreState()

    # --- Doc setup ---
    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=20*mm)

    cover_frame = Frame(MARGIN + 8*mm, 20*mm, cw - 16*mm, H - MARGIN - 28*mm,
                        id="cover_frame")
    section_frame = Frame(MARGIN, 20*mm, cw, H - MARGIN - 24*mm,
                          id="section_frame")

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover_page),
        PageTemplate(id="section", frames=[section_frame], onPage=draw_section_page),
    ])

    from reportlab.platypus import NextPageTemplate
    story = []

    # ═══════════════════════════════════════════════════════════════
    # PAGE 1 — COVER
    # ═══════════════════════════════════════════════════════════════

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("— LA GRIOTHÈQUE · CONVENTION DE FORMATION", S["cover_sub"]))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph("CONVENTION", S["cover_title"]))
    story.append(Paragraph("DE FORMATION<br/>PROFESSIONNELLE.", S["cover_title"]))
    story.append(Spacer(1, 12*mm))

    # Convention number
    convention_num = safe(data.get("conventionNumber"), f"CF-{year}-001")
    story.append(Paragraph(f"Convention n° {convention_num}", S["body_b"]))
    story.append(Spacer(1, 4*mm))

    # Date
    today = fmt_date(datetime.now().strftime("%Y-%m-%d"))
    story.append(Paragraph(f"Établie le {today}", S["body"]))
    story.append(Spacer(1, 10*mm))

    # Parties
    story.append(Paragraph("ENTRE LES SOUSSIGNÉS :", S["h2"]))
    story.append(Spacer(1, 4*mm))

    # Organisme
    of_text = (
        f"<b>{company_name}</b>, {safe(data.get('legalStatus'), 'SASU')} "
        f"au capital de {safe(data.get('capital'), '1 000 €')}, "
        f"dont le siège social est situé au {safe(data.get('address'))}, "
        f"{safe(data.get('postalCode'))} {safe(data.get('city'))}, "
        f"immatriculée sous le numéro SIRET {safe(data.get('siret'))}, "
        f"déclarée en tant qu'organisme de formation sous le numéro "
        f"{safe(data.get('nda'))} auprès de la {safe(data.get('dreets'), 'DREETS de Normandie')}.<br/>"
        f"Ci-après dénommée <b>« L'Organisme de formation »</b>."
    )
    story.append(Paragraph(of_text, S["body"]))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("ET", S["body_b"]))
    story.append(Spacer(1, 6*mm))

    # Client
    client_name = safe(data.get("clientName"), "Le Client")
    client_company = safe(data.get("clientCompany"), "")
    client_siret = safe(data.get("clientSiret"), "")
    client_address = safe(data.get("clientAddress"), "")
    client_rep = safe(data.get("clientRepresentant"), client_name)

    if client_company:
        client_text = (
            f"<b>{client_company}</b>"
            + (f", SIRET {client_siret}" if client_siret else "")
            + (f", dont le siège social est situé au {client_address}" if client_address else "")
            + f", représentée par <b>{client_rep}</b>."
            + "<br/>Ci-après dénommée <b>« Le Client »</b>."
        )
    else:
        client_text = (
            f"<b>{client_rep}</b>"
            + (f", demeurant {client_address}" if client_address else "")
            + ".<br/>Ci-après dénommé·e <b>« Le Client »</b>."
        )
    story.append(Paragraph(client_text, S["body"]))
    story.append(Spacer(1, 10*mm))

    story.append(Paragraph(
        "Il a été convenu ce qui suit :",
        S["body_b"]
    ))

    # ═══════════════════════════════════════════════════════════════
    # PAGE 2+ — ARTICLES
    # ═══════════════════════════════════════════════════════════════

    right_header = f"{safe(data.get('formationTitle'), 'FORMATION').upper()}\n©{year} {company_name}"

    story.append(NextPageTemplate("section"))
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · CONVENTION DE FORMATION",
        right=right_header))
    story.append(PageBreak())

    # --- Article 1 : Objet ---
    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "ARTICLE 1"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("OBJET DE LA CONVENTION.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    formation_title = safe(data.get("formationTitle"), "Formation")
    story.append(Paragraph(
        f"En exécution de la présente convention, l'Organisme de formation s'engage "
        f"à organiser l'action de formation suivante :",
        S["body"]
    ))
    story.append(Spacer(1, 6*mm))

    # Formation info box
    story.append(yellow_box(S, "FORMATION", f"<b>{formation_title}</b>", cw))
    story.append(Spacer(1, 8*mm))

    # --- Article 2 : Nature et caractéristiques ---
    story.append(section_tag(S, "ARTICLE 2"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("NATURE ET CARACTÉRISTIQUES<br/>DE L'ACTION DE FORMATION.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    # Info table
    duration_hours = safe(data.get("durationHours"), "7")
    duration_days = safe(data.get("durationDays"), "1")
    modality = safe(data.get("formationModality"), "Présentiel")
    start_date = fmt_date(data.get("startDate"))
    end_date = fmt_date(data.get("endDate"))
    location = safe(data.get("location"), "")
    horaires = safe(data.get("horaires"), "09h00 – 12h30 · 14h00 – 17h30")

    info_data = [
        ["INTITULÉ", formation_title],
        ["TYPE D'ACTION", safe(data.get("typeAction"), "Action de formation")],
        ["DURÉE", f"{duration_hours} heures ({duration_days} jour{'s' if float(duration_days) > 1 else ''})"],
        ["MODALITÉ", modality],
        ["DATES", f"Du {start_date} au {end_date}" if end_date else start_date],
        ["HORAIRES", horaires],
        ["LIEU", location],
    ]

    table_data = []
    for label, value in info_data:
        table_data.append([
            Paragraph(label, S["th"]),
            Paragraph(value, S["tc"])
        ])

    info_table = Table(table_data, colWidths=[cw * 0.3, cw * 0.7])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6*mm))

    # Objectives
    objectives = data.get("formationObjectives", [])
    if objectives:
        story.append(Paragraph("<b>OBJECTIFS PÉDAGOGIQUES :</b>", S["body_b"]))
        story.append(Spacer(1, 3*mm))
        for obj in objectives:
            story.append(Paragraph(f"— {obj}", S["body"]))
        story.append(Spacer(1, 4*mm))

    # Programme summary
    story.append(Paragraph(
        "Le programme détaillé de la formation est annexé à la présente convention.",
        S["body"]
    ))

    # --- Article 3 : Stagiaires ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 3"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("STAGIAIRES.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    # List stagiaires
    stagiaires = data.get("stagiaires", [])
    if not stagiaires:
        # Single stagiaire fallback
        prenom = safe(data.get("stagiairePrenom"), "")
        nom = safe(data.get("stagiaireName"), "")
        if prenom or nom:
            stagiaires = [{"prenom": prenom, "nom": nom}]

    nb_stagiaires = len(stagiaires)
    story.append(Paragraph(
        f"La présente convention concerne <b>{nb_stagiaires} stagiaire{'s' if nb_stagiaires > 1 else ''}</b> :",
        S["body"]
    ))
    story.append(Spacer(1, 4*mm))

    for i, stag in enumerate(stagiaires):
        full = f"{safe(stag.get('prenom'))} {safe(stag.get('nom'))}".strip()
        story.append(Paragraph(f"  {i+1}. {full}", S["body_b"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        "L'Organisme de formation remettra à chaque stagiaire, avant le début de l'action, "
        "un livret d'accueil comprenant le règlement intérieur, le programme de formation "
        "et les informations pratiques.",
        S["body"]
    ))

    # --- Article 4 : Prix ---
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · CONVENTION · ARTICLES",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "ARTICLE 4"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("DISPOSITIONS FINANCIÈRES.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    price_ht = safe(data.get("priceHT"), "0")
    tva_rate = safe(data.get("tvaRate"), "0")
    tva_applicable = data.get("tvaApplicable", False)

    try:
        price_val = float(price_ht)
        tva_val = float(tva_rate) if tva_applicable else 0
        tva_amount = price_val * tva_val / 100
        price_ttc = price_val + tva_amount
    except:
        price_val = 0
        tva_amount = 0
        price_ttc = 0

    price_per_stagiaire = safe(data.get("pricePerStagiaire"), "")
    if not price_per_stagiaire and nb_stagiaires > 0:
        try:
            price_per_stagiaire = f"{price_val / nb_stagiaires:.2f} € HT"
        except:
            price_per_stagiaire = ""

    story.append(Paragraph(
        f"Le prix de la formation est fixé à <b>{price_val:,.2f} € HT</b> "
        + (f"(soit {price_ttc:,.2f} € TTC, TVA {tva_val}%)." if tva_applicable
           else "(TVA non applicable, art. 261-4-4°a du CGI)."),
        S["body"]
    ))
    story.append(Spacer(1, 4*mm))

    if nb_stagiaires > 1 and price_per_stagiaire:
        story.append(Paragraph(
            f"Soit {price_per_stagiaire} par stagiaire.",
            S["body"]
        ))
        story.append(Spacer(1, 4*mm))

    # Financement
    financement = safe(data.get("financement"), "")
    if financement:
        story.append(Paragraph(f"<b>Financement :</b> {financement}", S["body"]))
        story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        "En cas de cessation anticipée de la formation du fait de l'Organisme de formation "
        "ou de l'abandon du stagiaire pour un motif non lié à un cas de force majeure, "
        "le prix sera calculé au prorata de la durée effectivement réalisée.",
        S["body"]
    ))

    # --- Article 5 : Modalités de règlement ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 5"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("MODALITÉS DE RÈGLEMENT.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    payment_terms = safe(data.get("paymentTerms"), "30 jours à réception de facture")
    story.append(Paragraph(
        f"Le règlement sera effectué selon les modalités suivantes : "
        f"<b>{payment_terms}</b>.",
        S["body"]
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "En cas de prise en charge par un organisme financeur (OPCO, FAF, etc.), "
        "le Client s'engage à fournir l'accord de prise en charge avant le début de la formation. "
        "À défaut, le coût de la formation sera facturé directement au Client.",
        S["body"]
    ))

    # --- Article 6 : Obligations ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 6"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("OBLIGATIONS DE L'ORGANISME.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "L'Organisme de formation s'engage à :",
        S["body"]
    ))
    story.append(Spacer(1, 3*mm))
    obligations_of = [
        "Dispenser la formation conformément au programme annexé.",
        "Mettre à disposition les moyens pédagogiques et techniques nécessaires.",
        "Assurer l'encadrement par un formateur qualifié.",
        "Remettre une attestation de fin de formation à chaque stagiaire.",
        "Fournir les feuilles d'émargement signées.",
    ]
    for obl in obligations_of:
        story.append(Paragraph(f"— {obl}", S["body"]))
    story.append(Spacer(1, 4*mm))

    # --- Article 7 : Obligations du client ---
    story.append(section_tag(S, "ARTICLE 7"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("OBLIGATIONS DU CLIENT.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "Le Client s'engage à :",
        S["body"]
    ))
    story.append(Spacer(1, 3*mm))
    obligations_client = [
        "Informer les stagiaires des dates, horaires et lieu de formation.",
        "Veiller à la présence et à l'assiduité des stagiaires.",
        "Régler le prix de la formation selon les modalités convenues.",
        "Fournir les informations nécessaires à l'inscription.",
    ]
    for obl in obligations_client:
        story.append(Paragraph(f"— {obl}", S["body"]))

    # --- Article 8 : Annulation / Report ---
    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · CONVENTION · ARTICLES",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "ARTICLE 8"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("ANNULATION ET REPORT.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "En cas d'annulation par le Client à moins de <b>10 jours ouvrés</b> avant le début "
        "de la formation, une indemnité forfaitaire de <b>30 %</b> du prix total sera due.",
        S["body"]
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "En cas de report, l'Organisme de formation proposera de nouvelles dates dans un "
        "délai raisonnable. En cas d'impossibilité de reporter, les conditions d'annulation "
        "ci-dessus s'appliquent.",
        S["body"]
    ))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "Si l'annulation est du fait de l'Organisme de formation, le Client sera intégralement "
        "remboursé des sommes versées.",
        S["body"]
    ))

    # --- Article 9 : Propriété intellectuelle ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 9"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("PROPRIÉTÉ INTELLECTUELLE.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "Les supports pédagogiques remis aux stagiaires sont protégés par le droit d'auteur "
        "et restent la propriété exclusive de l'Organisme de formation. Toute reproduction, "
        "diffusion ou utilisation en dehors du cadre de la formation est strictement interdite "
        "sans autorisation préalable écrite.",
        S["body"]
    ))

    # --- Article 10 : Confidentialité ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 10"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("CONFIDENTIALITÉ ET RGPD.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "Les parties s'engagent à traiter de manière confidentielle toute information échangée "
        "dans le cadre de la présente convention. Les données personnelles collectées sont "
        "traitées conformément au Règlement Général sur la Protection des Données (RGPD) "
        "et ne sont utilisées que dans le cadre de l'exécution de la formation et des "
        "obligations légales de l'Organisme de formation.",
        S["body"]
    ))

    # --- Article 11 : Litige ---
    story.append(Spacer(1, 8*mm))
    story.append(section_tag(S, "ARTICLE 11"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("LITIGES.", S["section_title"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "En cas de litige relatif à l'exécution de la présente convention, les parties "
        "s'efforceront de trouver une solution amiable. À défaut, le litige sera porté "
        "devant le tribunal compétent du siège social de l'Organisme de formation.",
        S["body"]
    ))

    # ═══════════════════════════════════════════════════════════════
    # PAGE SIGNATURES
    # ═══════════════════════════════════════════════════════════════

    story.append(SetHeader(header_state,
        left="LA GRIOTHÈQUE · CONVENTION · SIGNATURES",
        right=right_header))
    story.append(PageBreak())

    story.append(Spacer(1, 4*mm))
    story.append(section_tag(S, "SIGNATURES"))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("ACCORD DES PARTIES.", S["section_title"]))
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph(
        f"Fait en deux exemplaires originaux, à {safe(data.get('city'), 'Le Havre')}, "
        f"le {today}.",
        S["body"]
    ))
    story.append(Spacer(1, 12*mm))

    # Signature boxes
    sig_data = [
        [
            [
                Paragraph("POUR L'ORGANISME DE FORMATION", S["small_b"]),
                Spacer(1, 4*mm),
                Paragraph(company_name, S["tc_b"]),
                Paragraph(safe(data.get("signataireName"), "Moustapha COULIBALY"), S["tc"]),
                Paragraph("Président", S["small"]),
                Spacer(1, 20*mm),
                Paragraph("Signature et cachet :", S["small"]),
                Spacer(1, 15*mm),
            ],
            [
                Paragraph("POUR LE CLIENT", S["small_b"]),
                Spacer(1, 4*mm),
                Paragraph(client_company or client_rep, S["tc_b"]),
                Paragraph(client_rep, S["tc"]),
                Paragraph(safe(data.get("clientFunction"), "Représentant légal"), S["small"]),
                Spacer(1, 20*mm),
                Paragraph("Signature et cachet :", S["small"]),
                Spacer(1, 15*mm),
            ],
        ]
    ]

    sig_table = Table(sig_data, colWidths=[cw * 0.48, cw * 0.48], spaceBefore=0)
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (0, 0), 0.5, LGRAY),
        ("BOX", (1, 0), (1, 0), 0.5, LGRAY),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(sig_table)

    story.append(Spacer(1, 10*mm))
    story.append(Paragraph(
        "Mention manuscrite « Lu et approuvé, bon pour accord »",
        S["small"]
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

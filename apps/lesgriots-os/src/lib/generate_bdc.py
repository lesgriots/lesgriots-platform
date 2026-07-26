#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Bon de Commande (BDC) PDF
Même charte graphique que les devis.

Usage: echo '<json>' | python3 generate_bdc.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY

W, H = A4
MARGIN = 20 * mm
BK = colors.black
LGRAY = colors.HexColor("#AAAAAA")
GOLD = colors.HexColor("#D4A843")


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


def fmt_eur(v):
    try:
        return f"{float(v):,.2f} €".replace(",", " ")
    except:
        return "0.00 €"


def _make_styles():
    return {
        "h1":      ParagraphStyle("bdc_h1", fontName="Helvetica-Bold", fontSize=20,
                                   textColor=BK, leading=24, alignment=TA_CENTER),
        "h2":      ParagraphStyle("bdc_h2", fontName="Helvetica-Bold", fontSize=12,
                                   textColor=BK, leading=16, spaceBefore=14, spaceAfter=4),
        "body":    ParagraphStyle("bdc_body", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_JUSTIFY),
        "body_b":  ParagraphStyle("bdc_body_b", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=13),
        "small":   ParagraphStyle("bdc_small", fontName="Helvetica", fontSize=8,
                                   textColor=BK, leading=11),
        "right":   ParagraphStyle("bdc_right", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_RIGHT),
        "right_b": ParagraphStyle("bdc_right_b", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_RIGHT),
        "th":      ParagraphStyle("bdc_th", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12),
        "tc":      ParagraphStyle("bdc_tc", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=12),
        "tc_b":    ParagraphStyle("bdc_tcb", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12),
        "tc_r":    ParagraphStyle("bdc_tcr", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=12, alignment=TA_RIGHT),
        "tc_rb":   ParagraphStyle("bdc_tcrb", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12, alignment=TA_RIGHT),
    }


def generate(data):
    buf = io.BytesIO()
    S = _make_styles()
    cw = W - 2 * MARGIN

    # ── Data extraction ──
    bdc_number    = safe(data.get("bdcNumber"), "BDC-XXXX")
    bdc_date      = safe(data.get("bdcDate"), datetime.now().strftime("%Y-%m-%d"))
    project_code  = safe(data.get("projectCode"))
    project_name  = safe(data.get("projectName"))

    # Émetteur (LES GRIOTS)
    company_name  = safe(data.get("companyName"), "LES GRIOTS")
    legal_status  = safe(data.get("legalStatus"), "SASU")
    siret         = safe(data.get("siret"), "90262868400018")
    tva_number    = safe(data.get("tvaNumber"))
    address       = safe(data.get("address"), "80 avenue du 8 mai 1945")
    postal_code   = safe(data.get("postalCode"), "93100")
    city          = safe(data.get("city"), "Montreuil")
    phone         = safe(data.get("phone"))
    email         = safe(data.get("email"), "contact@lesgriots.com")
    repr_name     = safe(data.get("representantName"), "COULIBALY Moustapha")

    # Prestataire (destinataire)
    prov_name     = safe(data.get("providerName"))
    prov_company  = safe(data.get("providerCompany"))
    prov_email    = safe(data.get("providerEmail"))
    prov_phone    = safe(data.get("providerPhone"))
    prov_siret    = safe(data.get("providerSiret"))
    prov_address  = safe(data.get("providerAddress"))

    # Lignes de commande
    lines         = data.get("lines", [])
    tva_rate      = float(data.get("tvaRate", 20))
    payment_terms = safe(data.get("paymentTerms"), "30 jours à réception de facture")
    payment_mode  = safe(data.get("paymentMode"), "Virement bancaire")
    notes         = safe(data.get("notes"))

    # IBAN / BIC
    iban          = safe(data.get("iban"))
    bic           = safe(data.get("bic"))

    # ── Header / Footer ──
    def draw_page(canvas, doc):
        canvas.saveState()
        # Header: company name top-left
        canvas.setFont("Helvetica-Bold", 16)
        canvas.drawString(MARGIN, H - MARGIN + 2*mm, company_name)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(LGRAY)
        parts = [legal_status]
        if siret:
            parts.append(f"SIRET {siret}")
        canvas.drawString(MARGIN, H - MARGIN - 5*mm, " · ".join(parts))
        # Header: BDC number top-right
        canvas.setFont("Helvetica-Bold", 10)
        canvas.setFillColor(BK)
        canvas.drawRightString(W - MARGIN, H - MARGIN + 2*mm, bdc_number)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(LGRAY)
        canvas.drawRightString(W - MARGIN, H - MARGIN - 5*mm, f"Date : {fmt_date(bdc_date)}")
        # Line under header
        canvas.setStrokeColor(BK)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - MARGIN - 9*mm, W - MARGIN, H - MARGIN - 9*mm)
        # Footer
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(LGRAY)
        footer_parts = [f"{company_name} — {legal_status}"]
        if siret:
            footer_parts.append(f"SIRET {siret}")
        footer_parts.append(f"{address}, {postal_code} {city}")
        if tva_number:
            footer_parts.append(f"TVA {tva_number}")
        canvas.drawCentredString(W/2, 12*mm, " · ".join(footer_parts))
        canvas.restoreState()

    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN + 14*mm, bottomMargin=MARGIN + 6*mm)
    frame = Frame(MARGIN, MARGIN + 6*mm, cw, H - 2*MARGIN - 20*mm, id="main")
    doc.addPageTemplates([PageTemplate(id="bdc", frames=[frame], onPage=draw_page)])

    story = []

    # ── Title ──
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("BON DE COMMANDE", S["h1"]))
    if project_code or project_name:
        story.append(Spacer(1, 2*mm))
        sub = f"Projet : {project_code}" if project_code else ""
        if project_name:
            sub += f" — {project_name}" if sub else project_name
        story.append(Paragraph(sub, ParagraphStyle("bdc_sub", fontName="Helvetica", fontSize=10,
                                                     textColor=LGRAY, leading=14, alignment=TA_CENTER)))
    story.append(Spacer(1, 8*mm))

    # ── Destinataire (Prestataire) ──
    story.append(Paragraph("PRESTATAIRE", S["h2"]))
    prov_display = prov_company or prov_name or "—"
    prov_lines = [f"<b>{prov_display}</b>"]
    if prov_company and prov_name:
        prov_lines.append(prov_name)
    if prov_address:
        prov_lines.append(prov_address)
    if prov_siret:
        prov_lines.append(f"SIRET : {prov_siret}")
    if prov_email:
        prov_lines.append(prov_email)
    if prov_phone:
        prov_lines.append(prov_phone)
    story.append(Paragraph("<br/>".join(prov_lines), S["body"]))
    story.append(Spacer(1, 6*mm))

    # ── Table de commande ──
    story.append(Paragraph("DÉTAIL DE LA COMMANDE", S["h2"]))
    table_cols = [cw * 0.46, cw * 0.14, cw * 0.20, cw * 0.20]
    table_data = [[
        Paragraph("Désignation", S["th"]),
        Paragraph("Quantité", S["th"]),
        Paragraph("Prix unitaire HT", S["th"]),
        Paragraph("Total HT", S["th"]),
    ]]

    total_ht = 0
    for line in lines:
        desc = safe(line.get("description"), "Prestation")
        qty = float(line.get("qty", 1))
        unit = safe(line.get("unit"), "")
        price = float(line.get("priceHT", 0))
        line_total = qty * price
        total_ht += line_total
        qty_str = f"{int(qty)} {unit}".strip() if qty == int(qty) else f"{qty} {unit}".strip()
        table_data.append([
            Paragraph(desc, S["tc"]),
            Paragraph(qty_str, S["tc_r"]),
            Paragraph(fmt_eur(price), S["tc_r"]),
            Paragraph(fmt_eur(line_total), S["tc_r"]),
        ])

    t = Table(table_data, colWidths=table_cols, repeatRows=1)
    t_style = [
        ("LINEBELOW", (0, 0), (-1, 0), 1, BK),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ]
    for i in range(1, len(table_data)):
        t_style.append(("LINEBELOW", (0, i), (-1, i), 0.5, LGRAY))
    t.setStyle(TableStyle(t_style))
    story.append(t)
    story.append(Spacer(1, 2*mm))

    # ── Totals ──
    tva_amount = total_ht * tva_rate / 100.0
    total_ttc = total_ht + tva_amount
    totals_col = [cw * 0.54, cw * 0.46]
    inner_cols = [totals_col[1] * 0.65, totals_col[1] * 0.35]
    inner_style = TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ])
    totals_data = [
        ["", Table([[Paragraph("Total HT", S["tc_b"]), Paragraph(fmt_eur(total_ht), S["tc_rb"])]], colWidths=inner_cols)],
        ["", Table([[Paragraph(f"TVA ({tva_rate:.0f}%)", S["tc"]), Paragraph(fmt_eur(tva_amount), S["tc_rb"])]], colWidths=inner_cols)],
        ["", Table([[Paragraph("<b>Total TTC</b>", S["tc_b"]), Paragraph(f"<b>{fmt_eur(total_ttc)}</b>", S["tc_rb"])]], colWidths=inner_cols)],
    ]
    for row in totals_data:
        if isinstance(row[1], Table):
            row[1].setStyle(inner_style)
    outer = Table(totals_data, colWidths=totals_col)
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(outer)
    story.append(Spacer(1, 8*mm))

    # ── Conditions ──
    story.append(Paragraph("CONDITIONS", S["h2"]))
    cond_lines = []
    cond_lines.append(f"<b>Mode de paiement :</b> {payment_mode}")
    cond_lines.append(f"<b>Conditions de paiement :</b> {payment_terms}")
    if notes:
        cond_lines.append(f"<b>Notes :</b> {notes}")
    story.append(Paragraph("<br/>".join(cond_lines), S["body"]))

    if iban or bic:
        story.append(Spacer(1, 4*mm))
        bank_parts = []
        if iban:
            bank_parts.append(f"<b>IBAN :</b> {iban}")
        if bic:
            bank_parts.append(f"<b>BIC :</b> {bic}")
        story.append(Paragraph("<br/>".join(bank_parts), S["small"]))

    story.append(Spacer(1, 12*mm))

    # ── Signatures ──
    story.append(Paragraph("SIGNATURES", S["h2"]))
    sig = Table(
        [[Paragraph(f"Pour {company_name},<br/>{repr_name}<br/><br/><br/><br/>Date et signature", S["small"]),
          Paragraph(f"Le prestataire,<br/>{prov_display}<br/><br/><br/><br/>Date et signature, mention « Bon pour accord »", S["small"])]],
        colWidths=[cw / 2] * 2
    )
    sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (0, 0), 0.5, LGRAY),
        ("BOX", (1, 0), (1, 0), 0.5, LGRAY),
    ]))
    story.append(sig)

    doc.build(story)
    return buf.getvalue()


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    pdf = generate(data)
    sys.stdout.buffer.write(pdf)

#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de devis PDF
Deux templates distincts selon le pilier :
  - AGENCE   → Devis de prestation (TVA 20%, pas de NDA)
  - GRIOTHEQUE → Devis de formation professionnelle (exonéré TVA, NDA, apprenants)

Usage: echo '<json>' | python3 generate_devis.py
"""
import sys, json, io
from datetime import datetime, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY

W, H = A4
MARGIN = 20 * mm
BK = colors.black
LGRAY = colors.HexColor("#AAAAAA")

def safe(v, fallback=""):
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback

def fmt_date(d):
    """Convert YYYY-MM-DD to French long date like '4 mars 2026'."""
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
    """Format number as French currency like '500.00€'."""
    try:
        return f"{float(v):,.2f}€".replace(",", " ")
    except:
        return "0.00€"


# ═══════════════════════════════════════════════════════════════════════════
# SHARED — styles, header/footer, price table, signatures
# ═══════════════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        "h1":      ParagraphStyle("dv_h1", fontName="Helvetica-Bold", fontSize=20,
                                   textColor=BK, leading=24, alignment=TA_CENTER),
        "h2":      ParagraphStyle("dv_h2", fontName="Helvetica-Bold", fontSize=12,
                                   textColor=BK, leading=16, spaceBefore=14, spaceAfter=4),
        "body":    ParagraphStyle("dv_body", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_JUSTIFY),
        "body_b":  ParagraphStyle("dv_body_b", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=13),
        "small":   ParagraphStyle("dv_small", fontName="Helvetica", fontSize=8,
                                   textColor=BK, leading=11),
        "right":   ParagraphStyle("dv_right", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_RIGHT),
        "right_b": ParagraphStyle("dv_right_b", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=13, alignment=TA_RIGHT),
        "th":      ParagraphStyle("dv_th", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12),
        "tc":      ParagraphStyle("dv_tc", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=12),
        "tc_b":    ParagraphStyle("dv_tcb", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12),
        "tc_r":    ParagraphStyle("dv_tcr", fontName="Helvetica", fontSize=9,
                                   textColor=BK, leading=12, alignment=TA_RIGHT),
        "tc_rb":   ParagraphStyle("dv_tcrb", fontName="Helvetica-Bold", fontSize=9,
                                   textColor=BK, leading=12, alignment=TA_RIGHT),
    }


def _build_price_table(lines, cw, S, tva_applicable, tva_rate, fallback_title="", fallback_revenue=0):
    """Build pricing table + totals block. Returns list of flowables."""
    story = []
    table_cols = [cw * 0.46, cw * 0.14, cw * 0.20, cw * 0.20]
    table_data = [[
        Paragraph("Désignation", S["th"]),
        Paragraph("Quantité", S["th"]),
        Paragraph("Prix unitaire HT", S["th"]),
        Paragraph("Total HT", S["th"]),
    ]]

    total_ht = 0
    for line in lines:
        desc = safe(line.get("description"), fallback_title or "Prestation")
        qty = float(line.get("qty", 1))
        price = float(line.get("priceHT", 0))
        line_total = qty * price
        total_ht += line_total
        # Label adapté : "Formation" pour Griothèque, "Prestation" pour Agence
        label = "Formation" if not tva_applicable else "Prestation"
        table_data.append([
            Paragraph(f"<b>{label}</b><br/>{desc}", S["tc"]),
            Paragraph(str(int(qty)), S["tc_r"]),
            Paragraph(fmt_eur(price), S["tc_r"]),
            Paragraph(fmt_eur(line_total), S["tc_r"]),
        ])

    if not lines:
        total_ht = fallback_revenue
        label = "Formation" if not tva_applicable else "Prestation"
        table_data.append([
            Paragraph(f"<b>{label}</b><br/>{fallback_title}", S["tc"]),
            Paragraph("1", S["tc_r"]),
            Paragraph(fmt_eur(fallback_revenue), S["tc_r"]),
            Paragraph(fmt_eur(fallback_revenue), S["tc_r"]),
        ])

    t = Table(table_data, colWidths=table_cols, repeatRows=1)
    t_style_list = [
        ("LINEBELOW", (0, 0), (-1, 0), 1, BK),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ]
    for i in range(1, len(table_data)):
        t_style_list.append(("LINEBELOW", (0, i), (-1, i), 0.5, LGRAY))
    t.setStyle(TableStyle(t_style_list))
    story.append(t)
    story.append(Spacer(1, 2*mm))

    # ── Totals block ──
    totals_col = [cw * 0.54, cw * 0.46]
    if tva_applicable:
        tva_amount = total_ht * tva_rate / 100.0
        total_ttc = total_ht + tva_amount
        totals_data = [
            ["", Table(
                [[Paragraph("Total HT", S["tc_b"]), Paragraph(fmt_eur(total_ht), S["tc_rb"])]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
            ["", Table(
                [[Paragraph(f"TVA ({tva_rate:.0f}%)", S["tc"]), Paragraph(fmt_eur(tva_amount), S["tc_rb"])]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
            ["", Table(
                [[Paragraph("<b>Total TTC</b>", S["tc_b"]), Paragraph(f"<b>{fmt_eur(total_ttc)}</b>", S["tc_rb"])]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
        ]
    else:
        totals_data = [
            ["", Table(
                [[Paragraph("Total HT", S["tc_b"]), Paragraph(fmt_eur(total_ht), S["tc_rb"])]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
            ["", Table(
                [[Paragraph("TVA non applicable, article 261-4-4a du CGI", S["tc"]), ""]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
            ["", Table(
                [[Paragraph("<b>Total TTC</b>", S["tc_b"]), Paragraph(f"<b>{fmt_eur(total_ht)}</b>", S["tc_rb"])]],
                colWidths=[totals_col[1]*0.65, totals_col[1]*0.35])],
        ]

    for row_data in totals_data:
        inner = row_data[1]
        if isinstance(inner, Table):
            inner.setStyle(TableStyle([
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, LGRAY),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]))

    outer = Table(totals_data, colWidths=totals_col)
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(outer)
    return story


def _build_signatures(cw, S, of_name, of_repr, client_name):
    """Build the signature page block."""
    story = []
    story.append(PageBreak())
    story.append(Spacer(1, 100*mm))
    sig = Table(
        [[Paragraph(f"Pour {of_name},<br/>{of_repr}", S["small"]),
          Paragraph(f"Pour le client, bon pour accord<br/>{client_name}", S["small"])]],
        colWidths=[cw/2]*2
    )
    sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(sig)
    return story


# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE AGENCE — Devis de prestation
# ═══════════════════════════════════════════════════════════════════════════

def _generate_agence(data, ctx):
    """Generate Agence devis: prestation créative / audiovisuelle."""
    S = ctx["S"]
    cw = ctx["cw"]
    story = []

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("Devis de prestation", S["h1"]))
    story.append(Spacer(1, 2*mm))

    # Numéro + date
    story.append(Paragraph(f"<b>N° {ctx['devis_num']}</b>", ParagraphStyle("dv_num", fontName="Helvetica-Bold",
        fontSize=10, textColor=BK, leading=14, alignment=TA_CENTER)))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"Date : <b>{ctx['devis_date_long'] or ctx['devis_date']}</b>", S["right"]))
    story.append(Spacer(1, 6*mm))

    # ── Client ──
    story.append(Paragraph("Client", S["h2"]))
    client_name = ctx["client_name"]
    client_contact = safe(data.get("clientContact"), "")
    client_contact_fn = safe(data.get("clientContactFirstName"), "")
    client_contact_ln = safe(data.get("clientContactLastName"), "")
    contact_display = client_contact or f"{client_contact_fn} {client_contact_ln}".strip()
    story.append(Paragraph(f"<b>{client_name}</b>", S["body_b"]))
    if contact_display:
        story.append(Paragraph(f"Contact : {contact_display}", S["body"]))
    if ctx["client_addr"]:
        story.append(Paragraph(f"Adresse : {ctx['client_addr']}", S["body"]))
    if ctx["client_siret"]:
        story.append(Paragraph(f"SIRET : {ctx['client_siret']}", S["body"]))
    if ctx["client_email"]:
        story.append(Paragraph(f"Email : {ctx['client_email']}", S["body"]))
    story.append(Spacer(1, 6*mm))

    # ── 1. Objet de la prestation ──
    story.append(Paragraph("1. Objet de la prestation", S["h2"]))
    project_name = safe(data.get("projectName"), "")
    project_code = safe(data.get("projectCode"), "")
    notes = safe(data.get("notes"), "")
    if project_code:
        story.append(Paragraph(f"Projet : <b>{project_code}</b> — {project_name}", S["body"]))
    elif project_name:
        story.append(Paragraph(f"Projet : <b>{project_name}</b>", S["body"]))
    if notes:
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(notes, S["body"]))

    # Dates prestation
    start_date = safe(data.get("startDate"), "")
    end_date = safe(data.get("endDate"), "")
    if start_date and end_date:
        story.append(Paragraph(f"Période : du <b>{start_date}</b> au <b>{end_date}</b>", S["body"]))
    elif start_date:
        story.append(Paragraph(f"Début : <b>{start_date}</b>", S["body"]))
    story.append(Spacer(1, 4*mm))

    # ── 2. Détail et tarification ──
    story.append(Paragraph("2. Détail et tarification", S["h2"]))
    price_flowables = _build_price_table(
        ctx["lines"], cw, S,
        tva_applicable=True, tva_rate=ctx["tva_rate"],
        fallback_title=project_name, fallback_revenue=float(data.get("revenue", 0))
    )
    story.extend(price_flowables)
    story.append(Spacer(1, 6*mm))

    # ── 3. Conditions de paiement ──
    story.append(Paragraph("3. Conditions de paiement", S["h2"]))
    payment_terms = safe(data.get("paymentTerms"), "30 jours à réception de facture")
    story.append(Paragraph(f"Paiement : {payment_terms}", S["body"]))
    late_note = safe(data.get("latePaymentNote"),
        "En cas de retard de paiement, des pénalités de 3× le taux d'intérêt légal seront appliquées, "
        "ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.")
    story.append(Paragraph(late_note, S["small"]))
    story.append(Spacer(1, 4*mm))

    # ── 4. Validité ──
    story.append(Paragraph("4. Durée de validité du devis", S["h2"]))
    story.append(Paragraph("Ce devis est valable 30 jours à compter de sa date d'émission.", S["body"]))

    # ── Signatures ──
    story.extend(_build_signatures(cw, S, ctx["OF_NAME"], ctx["OF_REPR"], client_name))

    return story


# ═══════════════════════════════════════════════════════════════════════════
# TEMPLATE GRIOTHEQUE — Devis de formation professionnelle
# ═══════════════════════════════════════════════════════════════════════════

def _generate_griotheque(data, ctx):
    """Generate Griothèque devis: formation professionnelle."""
    S = ctx["S"]
    cw = ctx["cw"]
    story = []

    formation = data.get("formation", {})
    session = data.get("session", {})
    f_title = safe(formation.get("title"), safe(data.get("projectName"), ""))
    f_duration = safe(formation.get("duration_hours"), "")
    f_start = safe(session.get("start_date"), safe(data.get("startDate"), ""))
    f_end = safe(session.get("end_date"), safe(data.get("endDate"), ""))
    f_location = safe(session.get("location"), safe(session.get("adresse"), ""))
    f_effectifs = safe(data.get("effectifs"), "1")
    apprenants = data.get("apprenants", [])
    client_name = ctx["client_name"]

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("Devis de formation professionnelle", S["h1"]))
    story.append(Spacer(1, 2*mm))

    # Numéro + date
    story.append(Paragraph(f"<b>N° {ctx['devis_num']}</b>", ParagraphStyle("dv_num2", fontName="Helvetica-Bold",
        fontSize=10, textColor=BK, leading=14, alignment=TA_CENTER)))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f"Date du devis : <b>{ctx['devis_date_long'] or ctx['devis_date']}</b>", S["right"]))
    story.append(Spacer(1, 6*mm))

    # ── Destinataire ──
    story.append(Paragraph(f"<b>Destinataire : {client_name}</b>", S["body_b"]))
    if ctx["client_addr"]:
        story.append(Paragraph(f"Situé : {ctx['client_addr']}", S["body"]))
    story.append(Spacer(1, 4*mm))

    # ── Organisateur ──
    story.append(Paragraph(f"<b>Organisateur de la formation : {ctx['OF_NAME']}</b>", S["body_b"]))
    story.append(Paragraph(f"Situé : {ctx['OF_ADDR']} {ctx['OF_CP']} {ctx['OF_CITY']}", S["body"]))
    story.append(Paragraph(f"Déclaration d'activité n° {ctx['OF_NDA']}", S["body"]))
    story.append(Paragraph(f"Numéro SIRET : {ctx['OF_SIRET']}", S["body"]))
    story.append(Paragraph(f"Représenté par : {ctx['OF_REPR']}", S["body"]))
    story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════
    # 1. Objet, nature et durée de la formation
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Objet, nature et durée de la formation", S["h2"]))
    bullets = []
    if f_title:
        title_display = f"<b>{client_name} - {f_title}</b>" if client_name else f"<b>{f_title}</b>"
        bullets.append(f"Intitulé de la formation : {title_display}")
    bullets.append("Type d'action de formation (au sens de l'article L6313-1 du Code du Travail) : "
                   "<b>Action de formation</b>")
    if f_duration:
        bullets.append(f"Durée : {f_duration} heures")
    if f_start and f_end:
        bullets.append(f"Dates de la formation : du <b>{fmt_date(f_start)}</b> au <b>{fmt_date(f_end)}</b>")
    elif f_start:
        bullets.append(f"Date de début : <b>{fmt_date(f_start)}</b>")
    if f_location:
        loc_display = f"<b>{client_name} - {f_location}</b>" if client_name else f"<b>{f_location}</b>"
        bullets.append(f"Lieu de la formation : {loc_display}")
    bullets.append(f"Effectifs formés du bénéficiaire : {f_effectifs}")
    if apprenants:
        bullets.append("Apprenants concernés par la formation :")

    for b in bullets:
        story.append(Paragraph(f"  • {b}", S["body"]))

    for a in apprenants:
        name = f"{safe(a.get('first_name',''))} {safe(a.get('last_name',''))}".strip()
        civilite = safe(a.get('civilite', ''))
        prefix = f"{civilite} " if civilite else ""
        story.append(Paragraph(f"        • {prefix}{name}", S["body"]))

    story.append(Spacer(1, 4*mm))

    # ══════════════════════════════════════════════════════════════════════
    # 2. Programme de la formation et formateur
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Programme de la formation et formateur", S["h2"]))
    story.append(Paragraph(
        "La description détaillée du programme de formation et du formateur est fournie en annexe.", S["body"]))
    story.append(Spacer(1, 4*mm))

    # ══════════════════════════════════════════════════════════════════════
    # 3. Prix de la formation
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Prix de la formation", S["h2"]))
    price_flowables = _build_price_table(
        ctx["lines"], cw, S,
        tva_applicable=False, tva_rate=0,
        fallback_title=f_title, fallback_revenue=float(data.get("revenueHT", data.get("revenue", 0)))
    )
    story.extend(price_flowables)
    story.append(Spacer(1, 8*mm))

    # ══════════════════════════════════════════════════════════════════════
    # 4. Durée de validité du devis
    # ══════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Durée de validité du devis", S["h2"]))
    story.append(Paragraph("Ce devis sera valable pour une durée de 30 jours.", S["body"]))

    # ── Signatures (organisme + bénéficiaire) ──
    story.append(PageBreak())
    story.append(Spacer(1, 100*mm))
    sig = Table(
        [[Paragraph(f"Pour l'organisme de formation,<br/>{ctx['OF_NAME']},<br/>{ctx['OF_REPR']}", S["small"]),
          Paragraph(f"Pour le bénéficiaire, bon pour accord<br/>{client_name}", S["small"])]],
        colWidths=[cw/2]*2
    )
    sig.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(sig)

    # Blank page for annexe
    story.append(PageBreak())
    story.append(Spacer(1, 10*mm))

    return story


# ═══════════════════════════════════════════════════════════════════════════
# MAIN GENERATE
# ═══════════════════════════════════════════════════════════════════════════

def generate(data: dict) -> bytes:
    buf = io.BytesIO()

    # ── Company info from settings ──
    OF_NAME  = safe(data.get("companyName"), "LES GRIOTS")
    OF_ADDR  = safe(data.get("address"), "80 avenue du 8 mai 1945")
    OF_CP    = safe(data.get("postalCode"), "93100")
    OF_CITY  = safe(data.get("city"), "Montreuil")
    OF_EMAIL = safe(data.get("email"), "contact@lesgriots.com")
    OF_PHONE = safe(data.get("phone"), "06 XX XX XX XX")
    OF_SIRET = safe(data.get("siret"), "90262868400018")
    OF_NDA   = safe(data.get("nda"), "28760747176")
    OF_TVA   = safe(data.get("tvaNumber"), "")
    OF_REPR  = safe(data.get("representantName"), "COULIBALY Moustapha")

    # ── Pillar / TVA logic ──
    pillar = safe(data.get("pillar"), "GRIOTHEQUE")  # AGENCE or GRIOTHEQUE
    tva_applicable = pillar == "AGENCE"
    tva_rate = float(data.get("tvaRate", 20.0)) if tva_applicable else 0.0

    # ── Devis metadata ──
    devis_num  = safe(data.get("devisNumber"), f"DEVIS-{datetime.now().year}-001")
    devis_date = safe(data.get("devisDate"), datetime.now().strftime("%d/%m/%Y"))
    devis_date_long = safe(data.get("devisDateLong"), fmt_date(datetime.now().strftime("%Y-%m-%d")))

    # ── Client info ──
    client_name  = safe(data.get("clientName"), "")
    client_addr  = safe(data.get("clientAddress"), "")
    client_siret = safe(data.get("clientSiret"), "")
    client_email = safe(data.get("clientEmail"), "")

    # ── Lines / modules ──
    lines = data.get("lines", [])

    # ── Styles ──
    S = _make_styles()
    cw = W - 2*MARGIN

    # ── Shared context dict ──
    ctx = {
        "S": S, "cw": cw,
        "OF_NAME": OF_NAME, "OF_ADDR": OF_ADDR, "OF_CP": OF_CP, "OF_CITY": OF_CITY,
        "OF_EMAIL": OF_EMAIL, "OF_PHONE": OF_PHONE, "OF_SIRET": OF_SIRET,
        "OF_NDA": OF_NDA, "OF_TVA": OF_TVA, "OF_REPR": OF_REPR,
        "pillar": pillar, "tva_applicable": tva_applicable, "tva_rate": tva_rate,
        "devis_num": devis_num, "devis_date": devis_date, "devis_date_long": devis_date_long,
        "client_name": client_name, "client_addr": client_addr,
        "client_siret": client_siret, "client_email": client_email,
        "lines": lines,
    }

    # ── Header/footer — adapté pilier ──
    def _header_footer(canvas, doc_obj):
        canvas.saveState()
        # Header — top left
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(MARGIN, H - 14*mm, OF_NAME)
        canvas.setFont("Helvetica", 8)
        y = H - 19*mm
        for line in [OF_ADDR, f"{OF_CP} {OF_CITY}", f"Email : {OF_EMAIL}", f"Tél : {OF_PHONE}"]:
            canvas.drawString(MARGIN, y, line)
            y -= 3.5*mm

        # Footer — adapté Agence vs Griothèque
        canvas.setFont("Helvetica-Bold", 7)
        footer_line1 = f"{OF_NAME} | {OF_ADDR} {OF_CP} {OF_CITY} | SIRET : {OF_SIRET}"
        if tva_applicable and OF_TVA:
            footer_line1 += f" | N° TVA : {OF_TVA}"
        canvas.drawCentredString(W/2, 16*mm, footer_line1)

        canvas.setFont("Helvetica-Oblique", 7)
        if not tva_applicable:
            # Griothèque : NDA + mention agrément
            canvas.drawCentredString(W/2, 12.5*mm,
                f"Numéro de déclaration d'activité : {OF_NDA}")
            canvas.drawCentredString(W/2, 9*mm,
                "Cet enregistrement ne vaut pas l'agrément de l'État.")
        else:
            # Agence : mention RCS
            canvas.drawCentredString(W/2, 12.5*mm,
                f"SASU au capital de 1 000€ — RCS Bobigny")
            if OF_TVA:
                canvas.drawCentredString(W/2, 9*mm,
                    f"TVA intracommunautaire : {OF_TVA}")

        # Page number
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(W - MARGIN, 9*mm, f"Page {doc_obj.page}")
        canvas.restoreState()

    # ── Build document ──
    frame = Frame(MARGIN, 22*mm, W - 2*MARGIN, H - 56*mm, id='main')
    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=38*mm, bottomMargin=22*mm,
                          title=f"Devis {devis_num}")
    doc.addPageTemplates([PageTemplate(id='devis', frames=frame, onPage=_header_footer)])

    # ── Dispatch to the right template ──
    if pillar == "AGENCE":
        story = _generate_agence(data, ctx)
    else:
        story = _generate_griotheque(data, ctx)

    doc.build(story)
    return buf.getvalue()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = sys.stdin.read()
    data = json.loads(raw)
    pdf_bytes = generate(data)
    sys.stdout.buffer.write(pdf_bytes)

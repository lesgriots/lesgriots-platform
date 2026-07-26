#!/usr/bin/env python3
"""
LES GRIOTS — Module commun pour les générateurs juridiques FR.

Centralise :
  - palette GRIOTS Light + typographies
  - styles ReportLab
  - composants réutilisables (header, footer, signature block, disclaimer)
  - infos LES GRIOTS SASU (constantes société)
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# ── Dimensions ─────────────────────────────────
W, H = A4
MARGIN = 22 * mm

# ── Palette GRIOTS Light ───────────────────────
PAPER = colors.HexColor("#FBF7EE")
SURFACE = colors.HexColor("#FFFFFF")
INK = colors.HexColor("#1A1410")
INK2 = colors.HexColor("#5C5246")
INK3 = colors.HexColor("#8B8175")
RULE = colors.HexColor("#1A1410")
HAIR = colors.HexColor("#DDD2BB")

TERRACOTTA = colors.HexColor("#C46B3D")
SAFFRON = colors.HexColor("#B07A0E")
GOLD_SOFT = colors.HexColor("#F5E9C8")
DANGER = colors.HexColor("#A62B1F")

# ── Identité LES GRIOTS SASU ──────────────────
LES_GRIOTS = {
    "nom_legal": "LES GRIOTS",
    "forme": "SASU",
    "capital": "1 000 €",
    "siret": "902 491 318 00018",  # à vérifier dans Settings
    "rcs": "Paris 902 491 318",
    "siege": "Paris, France",
    "representant_nom": "Moussa Coulibaly",
    "representant_titre": "Président",
    "email": "moos.coulibaly@gmail.com",
    "site": "lesgriots.com",
}


# ── Styles ParagraphStyle ─────────────────────
def make_styles():
    """Retourne un dict de styles ParagraphStyle pré-configurés."""
    return {
        "title": ParagraphStyle(
            "title",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=INK2,
            alignment=TA_CENTER,
            spaceAfter=18,
        ),
        "section": ParagraphStyle(
            "section",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=INK,
            spaceBefore=14,
            spaceAfter=8,
            uppercase=False,
        ),
        "label": ParagraphStyle(
            "label",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=12,
            textColor=INK3,
            spaceBefore=10,
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        ),
        "body_left": ParagraphStyle(
            "body_left",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "small": ParagraphStyle(
            "small",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=INK2,
            alignment=TA_LEFT,
        ),
        "footnote": ParagraphStyle(
            "footnote",
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            textColor=INK3,
            alignment=TA_LEFT,
        ),
        "disclaimer": ParagraphStyle(
            "disclaimer",
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11,
            textColor=INK3,
            alignment=TA_JUSTIFY,
            borderColor=HAIR,
            borderWidth=0.5,
            borderPadding=8,
            backColor=GOLD_SOFT,
        ),
        "article_num": ParagraphStyle(
            "article_num",
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=TERRACOTTA,
            spaceBefore=10,
            spaceAfter=2,
        ),
    }


# ── Components réutilisables ──────────────────
def hr(color=HAIR, thickness=0.6, space_before=4, space_after=8):
    """Filet horizontal."""
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceBefore=space_before, spaceAfter=space_after)


def page_header_footer(canvas, doc, doc_title, doc_ref=""):
    """Header/footer painté sur chaque page via onPage callback."""
    canvas.saveState()

    # Header
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(MARGIN, H - 12 * mm, "LES GRIOTS")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN + 22 * mm, H - 12 * mm, doc_title.upper())

    if doc_ref:
        canvas.drawRightString(W - MARGIN, H - 12 * mm, doc_ref)

    # Ligne sous header
    canvas.setStrokeColor(HAIR)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, H - 14 * mm, W - MARGIN, H - 14 * mm)

    # Footer
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN, 12 * mm,
                      f"{LES_GRIOTS['nom_legal']} {LES_GRIOTS['forme']} · "
                      f"RCS {LES_GRIOTS['rcs']} · "
                      f"Siège : {LES_GRIOTS['siege']}")
    canvas.drawRightString(W - MARGIN, 12 * mm, f"Page {doc.page}")

    canvas.restoreState()


def signature_block(label_left, infos_left, label_right, infos_right):
    """
    Retourne un Flowable Table avec 2 colonnes signature.
    Chaque infos est une liste de (libellé, valeur) ou de strings.
    """
    def col(label, infos):
        lines = [
            Paragraph(f"<b>{label}</b>", ParagraphStyle(
                "sig_label", fontName="Helvetica-Bold", fontSize=9,
                leading=12, textColor=INK, spaceAfter=4,
            )),
        ]
        for item in infos:
            if isinstance(item, tuple):
                lib, val = item
                lines.append(Paragraph(
                    f"<font color='#8B8175' size='7.5'>{lib}</font><br/>{val or '_________________'}",
                    ParagraphStyle("sig_item", fontName="Helvetica", fontSize=9,
                                   leading=12, textColor=INK, spaceAfter=4),
                ))
            else:
                lines.append(Paragraph(item, ParagraphStyle(
                    "sig_p", fontName="Helvetica", fontSize=9,
                    leading=12, textColor=INK, spaceAfter=2,
                )))
        # Cadre signature
        lines.append(Spacer(1, 8 * mm))
        lines.append(Paragraph(
            "<font color='#8B8175' size='7'>Lu et approuvé — Signature et date</font>",
            ParagraphStyle("sig_hint", fontName="Helvetica-Oblique",
                           fontSize=7.5, leading=10, textColor=INK3),
        ))
        lines.append(Spacer(1, 18 * mm))
        return lines

    left_cell = col(label_left, infos_left)
    right_cell = col(label_right, infos_right)

    tbl = Table(
        [[left_cell, right_cell]],
        colWidths=[(W - 2 * MARGIN) / 2 - 4 * mm, (W - 2 * MARGIN) / 2 - 4 * mm],
    )
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return tbl


def disclaimer_text(short=False):
    """Texte de disclaimer juridique standard."""
    if short:
        return (
            "<i>Modèle généré par LES GRIOTS OS — relecture par un·e juriste recommandée "
            "pour tout enjeu significatif (montant &gt; 10 000 €, cession exclusive, "
            "exclusivité, non-concurrence).</i>"
        )
    return (
        "<i>Ce document a été généré à partir d'un modèle interne LES GRIOTS OS, "
        "adapté au droit français à titre d'usage courant. Il ne constitue pas un conseil "
        "juridique. Pour tout enjeu significatif (contrat &gt; 10 000 €, cession exclusive "
        "de droits, clauses d'exclusivité ou de non-concurrence, contentieux), une relecture "
        "par un·e avocat·e en droit des affaires est vivement recommandée.</i>"
    )


def fmt_date_fr(iso_or_none):
    """Convertit YYYY-MM-DD en '13 mai 2026' ou retourne date du jour si None."""
    from datetime import datetime
    months = ["janvier", "février", "mars", "avril", "mai", "juin",
             "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    if not iso_or_none:
        d = datetime.now()
    else:
        try:
            d = datetime.fromisoformat(iso_or_none[:10])
        except Exception:
            d = datetime.now()
    return f"{d.day} {months[d.month - 1]} {d.year}"


def safe(v, fallback=""):
    if v is None:
        return fallback
    s = str(v).strip()
    return s if s else fallback


def client_display_name(client):
    """Retourne nom à afficher pour un client (company ou personne)."""
    if not client:
        return "[Client]"
    company = safe(client.get("company"))
    if company:
        return company
    first = safe(client.get("firstName") or client.get("first_name"))
    last = safe(client.get("lastName") or client.get("last_name"))
    full = f"{first} {last}".strip()
    return full or "[Client]"


def client_signatory(client):
    """Retourne (nom, titre, email) du signataire client."""
    if not client:
        return ("[Nom du représentant]", "[Fonction]", "")
    first = safe(client.get("firstName") or client.get("first_name"))
    last = safe(client.get("lastName") or client.get("last_name"))
    nom = f"{first} {last}".strip() or "[Nom du représentant]"
    titre = safe(client.get("title") or client.get("role"), "[Fonction]")
    email = safe(client.get("email"))
    return (nom, titre, email)

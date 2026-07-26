#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de Feuille d'Émargement PDF (Qualiopi)
Charte graphique : fond beige (#F5F0EB), accents gold (#D4A843),
texte noir, police Courier monospace.

Modes disponibles :
  - jour        : une page par jour de formation (défaut)
  - semaine     : une page par semaine (regroupe les jours)
  - demi_journee: une page par demi-journée (matin/après-midi séparés)
  - session     : une seule page récapitulative pour toute la session
  - module      : une page par module de formation
  - mensuel     : une page par mois (formations longues)

Usage: echo '<json>' | python3 generate_emargement.py
"""
import sys, json, io, math, base64
from datetime import datetime, timedelta
from collections import OrderedDict

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    Flowable, KeepTogether, Image as RLImage
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER


# ═══════════════════════════════════════════════════════════════════
# CUSTOM FLOWABLE
# ═══════════════════════════════════════════════════════════════════

class SetHeader(Flowable):
    """Zero-height flowable that updates header_state before a PageBreak."""
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
ROW_ALT = colors.HexColor("#EDE8E2")

JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin",
           "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


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
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {MOIS_FR[dt.month - 1]} {dt.year}"
    except Exception:
        return str(d)


def fmt_date_short(d):
    if not d:
        return ""
    try:
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year}"
    except Exception:
        return str(d)


def fmt_jour_semaine(d):
    """Return 'Lundi 12/05/2026'."""
    if not d:
        return ""
    try:
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{JOURS_FR[dt.weekday()]} {dt.day:02d}/{dt.month:02d}/{dt.year}"
    except Exception:
        return str(d)


def parse_date(d):
    try:
        return datetime.strptime(str(d)[:10], "%Y-%m-%d")
    except Exception:
        return None


def weekdays_between(start_str, end_str):
    """Return list of ISO date strings (weekdays only) between start and end inclusive."""
    start = parse_date(start_str)
    end = parse_date(end_str)
    if not start or not end:
        return []
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5:
            days.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return days


def iso_week_key(d_str):
    """Return (year, week_number) for grouping by week."""
    dt = parse_date(d_str)
    if not dt:
        return (0, 0)
    iso = dt.isocalendar()
    return (iso[0], iso[1])


def month_key(d_str):
    """Return (year, month) for grouping by month."""
    dt = parse_date(d_str)
    if not dt:
        return (0, 0)
    return (dt.year, dt.month)


def load_logo(data):
    """ImageReader du logo Griothèque (chemin passé par la route JS), ou None."""
    p = safe(data.get("logoPath"), "")
    if not p:
        return None
    try:
        return ImageReader(p)
    except Exception:
        return None


def build_sig_lookup(data):
    """Index des signatures électroniques : (role, apprenantId, date, period) → png data URI."""
    lookup = {}
    for s in data.get("signatures") or []:
        role = safe(s.get("signerRole"), "apprenant")
        key = (role,
               safe(s.get("apprenantId"), ""),
               safe(s.get("date"), "")[:10],
               safe(s.get("period"), ""))
        png = safe(s.get("png"), "")
        if png:
            lookup[key] = png
    return lookup


def sig_flowable(png_data, max_w=42*mm, max_h=14*mm):
    """Transforme un data URI PNG en Image reportlab (~120x40 pts max), ou '' si invalide."""
    try:
        b64 = png_data.split(",", 1)[1] if "," in png_data else png_data
        img_bytes = base64.b64decode(b64)
        img = RLImage(io.BytesIO(img_bytes))
        iw = float(img.imageWidth or 1)
        ih = float(img.imageHeight or 1)
        ratio = min(max_w / iw, max_h / ih, 1.0)
        img.drawWidth = iw * ratio
        img.drawHeight = ih * ratio
        return img
    except Exception:
        return ""


# ═══════════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════════

def _make_styles():
    return {
        "page_title": ParagraphStyle(
            "em_page_title", fontName="Courier-Bold", fontSize=16,
            textColor=BK, leading=20, alignment=TA_CENTER),
        "page_subtitle": ParagraphStyle(
            "em_page_subtitle", fontName="Courier-Bold", fontSize=12,
            textColor=BK, leading=16, alignment=TA_CENTER),
        "page_date": ParagraphStyle(
            "em_page_date", fontName="Courier-Bold", fontSize=11,
            textColor=BK, leading=14, alignment=TA_CENTER),
        "h2": ParagraphStyle(
            "em_h2", fontName="Courier-Bold", fontSize=10,
            textColor=BK, leading=14, spaceBefore=6, spaceAfter=3),
        "body": ParagraphStyle(
            "em_body", fontName="Courier", fontSize=9,
            textColor=BK, leading=13, alignment=TA_LEFT),
        "body_b": ParagraphStyle(
            "em_body_b", fontName="Courier-Bold", fontSize=9,
            textColor=BK, leading=13),
        "small": ParagraphStyle(
            "em_small", fontName="Courier", fontSize=8,
            textColor=BK, leading=11),
        "small_b": ParagraphStyle(
            "em_small_b", fontName="Courier-Bold", fontSize=8,
            textColor=BK, leading=11),
        "th": ParagraphStyle(
            "em_th", fontName="Courier-Bold", fontSize=7,
            textColor=BK, leading=9, alignment=TA_CENTER),
        "tc": ParagraphStyle(
            "em_tc", fontName="Courier", fontSize=8,
            textColor=BK, leading=11),
        "tc_center": ParagraphStyle(
            "em_tc_center", fontName="Courier", fontSize=8,
            textColor=BK, leading=11, alignment=TA_CENTER),
        "info_label": ParagraphStyle(
            "em_info_label", fontName="Courier-Bold", fontSize=8,
            textColor=LGRAY, leading=10),
        "info_value": ParagraphStyle(
            "em_info_value", fontName="Courier", fontSize=9,
            textColor=BK, leading=13),
        "footer": ParagraphStyle(
            "em_footer", fontName="Courier", fontSize=6,
            textColor=LGRAY, leading=8, alignment=TA_CENTER),
        "header_left": ParagraphStyle(
            "em_header_left", fontName="Courier-Bold", fontSize=8,
            textColor=BK, leading=10),
        "header_right": ParagraphStyle(
            "em_header_right", fontName="Courier", fontSize=7,
            textColor=BK, leading=9, alignment=TA_RIGHT),
        "legend": ParagraphStyle(
            "em_legend", fontName="Courier", fontSize=7,
            textColor=LGRAY, leading=9),
    }


# ═══════════════════════════════════════════════════════════════════
# BUILD TRAINING DAYS
# ═══════════════════════════════════════════════════════════════════

def build_training_days(data, horaires):
    planning = data.get("planning") or []
    start_date = safe(data.get("startDate"), "")
    end_date = safe(data.get("endDate"), "")

    if planning:
        training_days = []
        for entry in planning:
            d = safe(entry.get("date"), "")
            label = safe(entry.get("label"), "")
            h = safe(entry.get("horaires"), horaires)
            module = safe(entry.get("module"), "")
            training_days.append({"date": d, "label": label, "horaires": h, "module": module})
    else:
        day_dates = weekdays_between(start_date, end_date)
        training_days = []
        for i, d in enumerate(day_dates):
            training_days.append({
                "date": d,
                "label": f"Jour {i + 1}",
                "horaires": horaires,
                "module": "",
            })

    return training_days


# ═══════════════════════════════════════════════════════════════════
# SHARED COMPONENTS
# ═══════════════════════════════════════════════════════════════════

def make_info_block(S, cw, formation_title, session_dates_str, location, horaires_str, extra_rows=None):
    """Creates the formation info block at top of each page."""
    info_rows = [
        ["FORMATION", formation_title],
        ["DATES DE SESSION", session_dates_str],
    ]
    if location:
        info_rows.append(["LIEU", location])
    if horaires_str:
        info_rows.append(["HORAIRES", horaires_str])
    if extra_rows:
        info_rows.extend(extra_rows)

    info_data = []
    for label, value in info_rows:
        info_data.append([
            Paragraph(label, S["info_label"]),
            Paragraph(value, S["info_value"]),
        ])

    info_table = Table(info_data, colWidths=[cw * 0.28, cw * 0.72])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#DDDDDD")),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
    ]))
    return info_table


def make_formateur_signature(S, cw, formateur_name, sig_png=None):
    """Creates the formateur signature block at bottom of each page.
    Si sig_png (data URI) est fourni, la signature électronique est embarquée."""
    elements = []
    elements.append(Paragraph("Signature du formateur :", S["body_b"]))
    elements.append(Spacer(1, 2 * mm))
    if formateur_name:
        elements.append(Paragraph(f"Nom : {formateur_name}", S["body"]))
    else:
        elements.append(Paragraph("Nom : ____________________________________", S["body"]))
    elements.append(Spacer(1, 4 * mm))

    sig_cell = sig_flowable(sig_png) if sig_png else ""
    sig_line_table = Table(
        [["Signature :", sig_cell]],
        colWidths=[cw * 0.18, cw * 0.50]
    )
    sig_line_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LINEBELOW", (1, 0), (1, 0), 0.4, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 15 * mm),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
    ]))
    elements.append(sig_line_table)
    return elements


def apply_table_style(table, num_rows, header_h=8*mm, row_h=25*mm):
    """Applies standard émargement table styling."""
    style_cmds = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), BK),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#AAAAAA")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("TOPPADDING", (0, 1), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2),
    ]
    for row_idx in range(1, num_rows):
        if row_idx % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), ROW_ALT))
    table.setStyle(TableStyle(style_cmds))


# ═══════════════════════════════════════════════════════════════════
# MODE: JOUR (une page par jour)
# ═══════════════════════════════════════════════════════════════════

def mode_jour(story, S, cw, data, training_days, stagiaire_names,
              header_state, right_header, session_dates_str,
              formation_title, location, horaires, formateur_name):
    SIG_ROW_H = 25 * mm

    # Signatures électroniques (page publique /p/emargement) + ids apprenants
    sigs = build_sig_lookup(data)
    stagiaires = data.get("stagiaires") or []

    for day_idx, day in enumerate(training_days):
        day_date = day["date"]
        day_label = day["label"]
        day_horaires = day.get("horaires", horaires)

        if day_idx > 0:
            story.append(SetHeader(header_state,
                left="LA GRIOTHEQUE · EMARGEMENT · JOUR",
                right=right_header))
            story.append(PageBreak())
        else:
            header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · JOUR"
            header_state["right"] = right_header

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
        story.append(Spacer(1, 3 * mm))

        date_display = fmt_date(day_date)
        date_line = f"{day_label} — {date_display}" if day_label else date_display
        story.append(Paragraph(date_line, S["page_date"]))
        story.append(Spacer(1, 5 * mm))

        story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                     location, day_horaires))
        story.append(Spacer(1, 5 * mm))

        # Table: Nom | Matin | Après-midi | Observations
        col_widths = [cw * 0.30, cw * 0.22, cw * 0.22, cw * 0.26]
        header_row = [
            Paragraph("NOM PRENOM", S["th"]),
            Paragraph("MATIN", S["th"]),
            Paragraph("APRES-MIDI", S["th"]),
            Paragraph("OBSERVATIONS", S["th"]),
        ]
        day_key = safe(day_date, "")[:10]
        table_data = [header_row]
        for st_idx, name in enumerate(stagiaire_names):
            aid = safe(stagiaires[st_idx].get("id"), "") if st_idx < len(stagiaires) else ""
            png_matin = sigs.get(("apprenant", aid, day_key, "matin")) if aid else None
            png_aprem = sigs.get(("apprenant", aid, day_key, "apres_midi")) if aid else None
            table_data.append([
                Paragraph(name, S["tc"]),
                sig_flowable(png_matin, max_w=cw * 0.19, max_h=SIG_ROW_H - 5*mm) if png_matin else "",
                sig_flowable(png_aprem, max_w=cw * 0.19, max_h=SIG_ROW_H - 5*mm) if png_aprem else "",
                "",
            ])
        extra = max(0, 3 - len(stagiaire_names))
        for _ in range(extra):
            table_data.append(["", "", "", ""])

        t = Table(table_data, colWidths=col_widths,
                  rowHeights=[8*mm] + [SIG_ROW_H] * (len(table_data) - 1))
        apply_table_style(t, len(table_data))
        story.append(t)
        story.append(Spacer(1, 6 * mm))

        formateur_png = (sigs.get(("formateur", "", day_key, "matin"))
                         or sigs.get(("formateur", "", day_key, "apres_midi")))
        story.extend(make_formateur_signature(S, cw, formateur_name, sig_png=formateur_png))


# ═══════════════════════════════════════════════════════════════════
# MODE: SEMAINE (une page par semaine)
# ═══════════════════════════════════════════════════════════════════

def mode_semaine(story, S, cw, data, training_days, stagiaire_names,
                 header_state, right_header, session_dates_str,
                 formation_title, location, horaires, formateur_name):

    # Group days by ISO week
    weeks = OrderedDict()
    for day in training_days:
        wk = iso_week_key(day["date"])
        if wk not in weeks:
            weeks[wk] = []
        weeks[wk].append(day)

    SIG_ROW_H = 18 * mm  # slightly shorter for weekly view

    for wk_idx, (wk_key, week_days) in enumerate(weeks.items()):
        if wk_idx > 0:
            story.append(SetHeader(header_state,
                left="LA GRIOTHEQUE · EMARGEMENT · SEMAINE",
                right=right_header))
            story.append(PageBreak())
        else:
            header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · SEMAINE"
            header_state["right"] = right_header

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
        story.append(Spacer(1, 2 * mm))

        first_day = fmt_date_short(week_days[0]["date"])
        last_day = fmt_date_short(week_days[-1]["date"])
        story.append(Paragraph(f"Semaine {wk_idx + 1} — {first_day} au {last_day}", S["page_date"]))
        story.append(Spacer(1, 4 * mm))

        story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                     location, horaires))
        story.append(Spacer(1, 4 * mm))

        # Table: Nom | Day1 M/AM | Day2 M/AM | ... (2 sub-cols per day)
        n_days = len(week_days)
        col_nom = cw * 0.22
        remaining = cw - col_nom
        col_per_day = remaining / max(n_days, 1)

        # Build column widths: nom + (per_day for each day)
        col_widths = [col_nom] + [col_per_day] * n_days

        # Header: first row = day labels spanning 1 col each
        header_row = [Paragraph("NOM PRENOM", S["th"])]
        for day in week_days:
            day_str = fmt_jour_semaine(day["date"])
            header_row.append(Paragraph(day_str, S["th"]))

        # Sub-header: M / AM under each day
        sub_header = [""]
        for _ in week_days:
            sub_header.append(Paragraph("M / AM", S["th"]))

        table_data = [header_row, sub_header]

        for name in stagiaire_names:
            row = [Paragraph(name, S["tc"])]
            for _ in week_days:
                row.append("")
            table_data.append(row)

        extra = max(0, 2 - len(stagiaire_names))
        for _ in range(extra):
            row = [""] + [""] * n_days
            table_data.append(row)

        row_heights = [8*mm, 6*mm] + [SIG_ROW_H] * (len(table_data) - 2)
        t = Table(table_data, colWidths=col_widths, rowHeights=row_heights)

        style_cmds = [
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, 1), "CENTER"),
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#E8D9B8")),
            ("TEXTCOLOR", (0, 0), (-1, 1), BK),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#AAAAAA")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, 1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, 1), 3),
        ]
        for row_idx in range(2, len(table_data)):
            if row_idx % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), ROW_ALT))
        t.setStyle(TableStyle(style_cmds))
        story.append(t)
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("M = Matin · AM = Apres-midi · Chaque case = signature du stagiaire", S["legend"]))
        story.append(Spacer(1, 4 * mm))

        story.extend(make_formateur_signature(S, cw, formateur_name))


# ═══════════════════════════════════════════════════════════════════
# MODE: DEMI-JOURNÉE (une page par demi-journée)
# ═══════════════════════════════════════════════════════════════════

def mode_demi_journee(story, S, cw, data, training_days, stagiaire_names,
                      header_state, right_header, session_dates_str,
                      formation_title, location, horaires, formateur_name):
    SIG_ROW_H = 25 * mm
    page_idx = 0

    for day in training_days:
        day_date = day["date"]
        day_label = day["label"]
        day_horaires = day.get("horaires", horaires)

        # Parse horaires: "09h00 - 12h30 / 14h00 - 17h30"
        parts = day_horaires.split("/") if "/" in day_horaires else day_horaires.split("·")
        if len(parts) < 2:
            parts = [day_horaires, ""]
        h_matin = parts[0].strip()
        h_aprem = parts[1].strip() if len(parts) > 1 else ""

        for period_idx, (period_label, period_horaires) in enumerate([
            ("MATIN", h_matin),
            ("APRES-MIDI", h_aprem),
        ]):
            if not period_horaires:
                continue

            if page_idx > 0:
                story.append(SetHeader(header_state,
                    left="LA GRIOTHEQUE · EMARGEMENT · DEMI-JOURNEE",
                    right=right_header))
                story.append(PageBreak())
            else:
                header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · DEMI-JOURNEE"
                header_state["right"] = right_header
            page_idx += 1

            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
            story.append(Spacer(1, 3 * mm))

            date_display = fmt_date(day_date)
            story.append(Paragraph(f"{day_label} — {date_display}", S["page_date"]))
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(f"{period_label} ({period_horaires})", S["page_subtitle"]))
            story.append(Spacer(1, 5 * mm))

            story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                         location, period_horaires,
                                         extra_rows=[["CRENEAU", period_label]]))
            story.append(Spacer(1, 5 * mm))

            # Table: Nom | Heure arrivée | Signature | Heure départ
            col_widths = [cw * 0.30, cw * 0.18, cw * 0.30, cw * 0.22]
            header_row = [
                Paragraph("NOM PRENOM", S["th"]),
                Paragraph("HEURE ARRIVEE", S["th"]),
                Paragraph("SIGNATURE", S["th"]),
                Paragraph("HEURE DEPART", S["th"]),
            ]
            table_data = [header_row]
            for name in stagiaire_names:
                table_data.append([Paragraph(name, S["tc"]), "", "", ""])
            extra = max(0, 3 - len(stagiaire_names))
            for _ in range(extra):
                table_data.append(["", "", "", ""])

            t = Table(table_data, colWidths=col_widths,
                      rowHeights=[8*mm] + [SIG_ROW_H] * (len(table_data) - 1))
            apply_table_style(t, len(table_data))
            story.append(t)
            story.append(Spacer(1, 6 * mm))

            story.extend(make_formateur_signature(S, cw, formateur_name))


# ═══════════════════════════════════════════════════════════════════
# MODE: SESSION (une seule feuille récapitulative)
# ═══════════════════════════════════════════════════════════════════

def mode_session(story, S, cw, data, training_days, stagiaire_names,
                 header_state, right_header, session_dates_str,
                 formation_title, location, horaires, formateur_name):

    header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · SESSION"
    header_state["right"] = right_header

    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("Recapitulatif de session", S["page_subtitle"]))
    story.append(Spacer(1, 4 * mm))

    story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                 location, horaires,
                                 extra_rows=[["NB JOURS", str(len(training_days))]]))
    story.append(Spacer(1, 4 * mm))

    # Table: Nom | Day1 | Day2 | ... | Day_n
    # If too many days (>10), split into multiple pages
    MAX_DAYS_PER_PAGE = 8
    day_chunks = [training_days[i:i+MAX_DAYS_PER_PAGE]
                  for i in range(0, len(training_days), MAX_DAYS_PER_PAGE)]

    SIG_ROW_H = 16 * mm
    page_idx = 0

    for chunk_idx, chunk in enumerate(day_chunks):
        if chunk_idx > 0:
            story.append(SetHeader(header_state,
                left="LA GRIOTHEQUE · EMARGEMENT · SESSION",
                right=right_header))
            story.append(PageBreak())
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(f"EMARGEMENT (suite {chunk_idx + 1})", S["page_subtitle"]))
            story.append(Spacer(1, 4 * mm))

        n_days = len(chunk)
        col_nom = cw * 0.25
        remaining = cw - col_nom
        col_per_day = remaining / max(n_days, 1)
        col_widths = [col_nom] + [col_per_day] * n_days

        # Header row: day short dates
        header_row = [Paragraph("NOM PRENOM", S["th"])]
        for day in chunk:
            d_str = fmt_date_short(day["date"])
            header_row.append(Paragraph(d_str, S["th"]))

        # Sub-header: day labels (Jour 1, Jour 2...)
        sub_header = [""]
        for day in chunk:
            sub_header.append(Paragraph(day.get("label", ""), S["th"]))

        table_data = [header_row, sub_header]

        for name in stagiaire_names:
            row = [Paragraph(name, S["tc"])]
            for _ in chunk:
                row.append("")
            table_data.append(row)

        extra = max(0, 2 - len(stagiaire_names))
        for _ in range(extra):
            table_data.append([""] + [""] * n_days)

        row_heights = [8*mm, 6*mm] + [SIG_ROW_H] * (len(table_data) - 2)
        t = Table(table_data, colWidths=col_widths, rowHeights=row_heights)

        style_cmds = [
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, 1), "CENTER"),
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#E8D9B8")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#AAAAAA")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]
        for row_idx in range(2, len(table_data)):
            if row_idx % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), ROW_ALT))
        t.setStyle(TableStyle(style_cmds))
        story.append(t)
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph("Chaque case = signature du stagiaire pour la journee", S["legend"]))
        story.append(Spacer(1, 4 * mm))

    story.extend(make_formateur_signature(S, cw, formateur_name))


# ═══════════════════════════════════════════════════════════════════
# MODE: MODULE (une page par module)
# ═══════════════════════════════════════════════════════════════════

def mode_module(story, S, cw, data, training_days, stagiaire_names,
                header_state, right_header, session_dates_str,
                formation_title, location, horaires, formateur_name):

    modules = data.get("modules") or []
    if not modules:
        # Fallback: treat each day as a "module"
        modules = [{"title": d.get("label", f"Jour {i+1}"),
                     "duration_hours": 7,
                     "dates": [d["date"]]}
                    for i, d in enumerate(training_days)]
    else:
        # Try to associate dates with modules from planning
        for m_idx, m in enumerate(modules):
            if "dates" not in m:
                m["dates"] = []

    SIG_ROW_H = 25 * mm

    for mod_idx, mod in enumerate(modules):
        mod_title = safe(mod.get("title"), f"Module {mod_idx + 1}")
        mod_hours = mod.get("duration_hours", 0)

        if mod_idx > 0:
            story.append(SetHeader(header_state,
                left="LA GRIOTHEQUE · EMARGEMENT · MODULE",
                right=right_header))
            story.append(PageBreak())
        else:
            header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · MODULE"
            header_state["right"] = right_header

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f"Module {mod_idx + 1} : {mod_title}", S["page_subtitle"]))
        if mod_hours:
            story.append(Spacer(1, 1 * mm))
            story.append(Paragraph(f"({mod_hours}h)", S["page_date"]))
        story.append(Spacer(1, 4 * mm))

        story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                     location, horaires,
                                     extra_rows=[["MODULE", mod_title]]))
        story.append(Spacer(1, 5 * mm))

        # Table: Nom | Matin | Après-midi | Observations
        col_widths = [cw * 0.30, cw * 0.22, cw * 0.22, cw * 0.26]
        header_row = [
            Paragraph("NOM PRENOM", S["th"]),
            Paragraph("MATIN", S["th"]),
            Paragraph("APRES-MIDI", S["th"]),
            Paragraph("OBSERVATIONS", S["th"]),
        ]
        table_data = [header_row]
        for name in stagiaire_names:
            table_data.append([Paragraph(name, S["tc"]), "", "", ""])
        extra = max(0, 3 - len(stagiaire_names))
        for _ in range(extra):
            table_data.append(["", "", "", ""])

        t = Table(table_data, colWidths=col_widths,
                  rowHeights=[8*mm] + [SIG_ROW_H] * (len(table_data) - 1))
        apply_table_style(t, len(table_data))
        story.append(t)
        story.append(Spacer(1, 6 * mm))

        story.extend(make_formateur_signature(S, cw, formateur_name))


# ═══════════════════════════════════════════════════════════════════
# MODE: MENSUEL (une page par mois — formations longues)
# ═══════════════════════════════════════════════════════════════════

def mode_mensuel(story, S, cw, data, training_days, stagiaire_names,
                 header_state, right_header, session_dates_str,
                 formation_title, location, horaires, formateur_name):

    # Group days by month
    months = OrderedDict()
    for day in training_days:
        mk = month_key(day["date"])
        if mk not in months:
            months[mk] = []
        months[mk].append(day)

    SIG_ROW_H = 14 * mm

    for m_idx, (mk, month_days) in enumerate(months.items()):
        if m_idx > 0:
            story.append(SetHeader(header_state,
                left="LA GRIOTHEQUE · EMARGEMENT · MENSUEL",
                right=right_header))
            story.append(PageBreak())
        else:
            header_state["left"] = "LA GRIOTHEQUE · EMARGEMENT · MENSUEL"
            header_state["right"] = right_header

        year_m, month_m = mk
        month_label = f"{MOIS_FR[month_m - 1].capitalize()} {year_m}"

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph("FEUILLE D'EMARGEMENT", S["page_title"]))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(month_label, S["page_subtitle"]))
        story.append(Spacer(1, 4 * mm))

        story.append(make_info_block(S, cw, formation_title, session_dates_str,
                                     location, horaires,
                                     extra_rows=[["PERIODE", month_label],
                                                 ["NB JOURS", str(len(month_days))]]))
        story.append(Spacer(1, 4 * mm))

        # Similar to session mode but for the month's days
        MAX_DAYS = 12
        chunks = [month_days[i:i+MAX_DAYS] for i in range(0, len(month_days), MAX_DAYS)]

        for chunk_idx, chunk in enumerate(chunks):
            if chunk_idx > 0:
                story.append(SetHeader(header_state,
                    left="LA GRIOTHEQUE · EMARGEMENT · MENSUEL",
                    right=right_header))
                story.append(PageBreak())
                story.append(Spacer(1, 2 * mm))
                story.append(Paragraph(f"{month_label} (suite)", S["page_subtitle"]))
                story.append(Spacer(1, 4 * mm))

            n_days = len(chunk)
            col_nom = cw * 0.20
            remaining = cw - col_nom
            col_per_day = remaining / max(n_days, 1)
            col_widths = [col_nom] + [col_per_day] * n_days

            header_row = [Paragraph("NOM", S["th"])]
            for day in chunk:
                dt = parse_date(day["date"])
                lbl = f"{JOURS_FR[dt.weekday()][:3]}\n{dt.day:02d}" if dt else ""
                header_row.append(Paragraph(lbl, S["th"]))

            table_data = [header_row]
            for name in stagiaire_names:
                row = [Paragraph(name, S["tc"])]
                for _ in chunk:
                    row.append("")
                table_data.append(row)

            extra = max(0, 2 - len(stagiaire_names))
            for _ in range(extra):
                table_data.append([""] + [""] * n_days)

            row_heights = [10*mm] + [SIG_ROW_H] * (len(table_data) - 1)
            t = Table(table_data, colWidths=col_widths, rowHeights=row_heights)

            style_cmds = [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("BACKGROUND", (0, 0), (-1, 0), GOLD),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#AAAAAA")),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
            for row_idx in range(1, len(table_data)):
                if row_idx % 2 == 0:
                    style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), ROW_ALT))
            t.setStyle(TableStyle(style_cmds))
            story.append(t)
            story.append(Spacer(1, 3 * mm))

        story.append(Paragraph("Chaque case = signature du stagiaire", S["legend"]))
        story.append(Spacer(1, 4 * mm))
        story.extend(make_formateur_signature(S, cw, formateur_name))


# ═══════════════════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════════════════

def generate(data):
    S = _make_styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "LA GRIOTHEQUE · FEUILLE D'EMARGEMENT", "right": ""}

    company_name = safe(data.get("companyName"), "LES GRIOTS")
    siret = safe(data.get("siret"), "902 628 684 00018")
    nda = safe(data.get("nda"), "28 76 07471 76")
    footer_line = f"{company_name} — SASU au capital de 1 000 € — SIRET {siret} — NDA {nda}"

    formation_title = safe(data.get("formationTitle"), "Formation")
    start_date = safe(data.get("startDate"), "")
    end_date = safe(data.get("endDate"), "")
    location = safe(data.get("location"), "")
    horaires = safe(data.get("horaires"), "09h00 - 12h30 / 14h00 - 17h30")
    formateur_name = safe(data.get("formateurName"), "")

    mode = safe(data.get("mode"), "jour")

    training_days = build_training_days(data, horaires)

    # Stagiaires
    stagiaires = data.get("stagiaires") or []
    stagiaire_names = []
    for stag in stagiaires:
        first = safe(stag.get("firstName"), safe(stag.get("prenom"), ""))
        last = safe(stag.get("lastName"), safe(stag.get("nom"), ""))
        full = f"{last.upper()} {first}".strip()
        stagiaire_names.append(full if full else "—")
    if not stagiaire_names:
        stagiaire_names = ["—"]

    year = datetime.now().year

    if start_date and end_date and start_date != end_date:
        session_dates_str = f"Du {fmt_date(start_date)} au {fmt_date(end_date)}"
    elif start_date:
        session_dates_str = fmt_date(start_date)
    else:
        session_dates_str = ""

    right_header = f"{formation_title.upper()}\n©{year} {company_name}"

    logo_img = load_logo(data)

    # --- Page drawing function ---
    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
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
            lines = right_text.split("\n")
            for i, line in enumerate(lines):
                canvas.drawRightString(W - MARGIN, H - 14 * mm - i * 9, line)
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H - 17 * mm, W - MARGIN, H - 17 * mm)
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W / 2, 12 * mm, footer_line)
        canvas.drawRightString(W - MARGIN, 12 * mm, f"{doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=20 * mm)

    content_frame = Frame(MARGIN, 20 * mm, cw, H - MARGIN - 24 * mm,
                          id="content_frame")
    doc.addPageTemplates([
        PageTemplate(id="emargement", frames=[content_frame], onPage=draw_page),
    ])

    story = []

    # Dispatch by mode
    mode_args = (story, S, cw, data, training_days, stagiaire_names,
                 header_state, right_header, session_dates_str,
                 formation_title, location, horaires, formateur_name)

    if mode == "semaine":
        mode_semaine(*mode_args)
    elif mode == "demi_journee":
        mode_demi_journee(*mode_args)
    elif mode == "session":
        mode_session(*mode_args)
    elif mode == "module":
        mode_module(*mode_args)
    elif mode == "mensuel":
        mode_mensuel(*mode_args)
    else:  # default: jour
        mode_jour(*mode_args)

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

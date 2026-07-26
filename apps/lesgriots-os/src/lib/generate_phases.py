#!/usr/bin/env python3
"""
LES GRIOTS — Generateur PDF Phases : Cover + Gantt landscape + liste des taches.

3 sections :
  1) Cover page (portrait) — titre projet, meta, stats
  2) Gantt page (landscape) — barres horizontales datees, axe temporel, today line
  3) Liste des taches par phase (portrait) — detail complet

Usage: echo '<json>' | python3 generate_phases.py
"""
import sys, json, io
from datetime import datetime, timedelta

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, NextPageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Flowable,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

# ── Layout ──
PW, PH = A4
LW, LH = landscape(A4)  # Landscape A4
MARGIN = 18 * mm

# ── Palette GRIOTS Light ──
INK = colors.HexColor("#1A1410")
INK2 = colors.HexColor("#5C5246")
INK3 = colors.HexColor("#8B8175")
HAIR = colors.HexColor("#DDD2BB")
PAPER = colors.HexColor("#FBF7EE")
TERRACOTTA = colors.HexColor("#C46B3D")
SAFFRON = colors.HexColor("#B07A0E")
SUCCESS = colors.HexColor("#1E8449")
INFO = colors.HexColor("#1B6FB8")
WARNING = colors.HexColor("#C9821C")
DANGER = colors.HexColor("#B83328")

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
STATUS_COLOR = {
    "todo": INK3, "in_progress": INFO, "review": WARNING, "done": SUCCESS,
}
STATUS_LABEL = {
    "todo": "A faire", "in_progress": "En cours", "review": "Review", "done": "Termine",
}


def safe(v, fb=""):
    if v is None: return fb
    s = str(v).strip()
    return s if s else fb


def parse_date(s):
    if not s: return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d")
    except Exception:
        return None


def fmt_date_fr(d):
    if not d: return ""
    try:
        months = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
                  "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
        if isinstance(d, str): d = parse_date(d)
        return f"{d.day} {months[d.month - 1]} {d.year}"
    except Exception:
        return ""


def fmt_date_short(d, granularity):
    if granularity == "month":
        months = ["jan", "fev", "mar", "avr", "mai", "juin", "jul", "aou", "sep", "oct", "nov", "dec"]
        return f"{months[d.month - 1]} {str(d.year)[-2:]}"
    if granularity == "week":
        return f"{d.day:02d}/{d.month:02d}"
    return f"{d.day:02d}/{d.month:02d}"


def html_escape(s):
    if s is None: return ""
    return (str(s).replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\n", "<br/>"))


# ── HRule petite barre PPM ──
class HRule(Flowable):
    def __init__(self, width=28*mm, thickness=1.5, color=INK):
        super().__init__()
        self.width = width
        self.thickness = thickness
        self.color = color
        self.height = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


# ── Styles texte ──
def make_styles():
    return {
        "cover_title": ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=44, leading=50, textColor=INK, alignment=TA_LEFT, spaceAfter=8),
        "cover_subtitle": ParagraphStyle("csub", fontName="Courier-Bold", fontSize=10, leading=14, textColor=INK2, alignment=TA_LEFT, spaceAfter=2),
        "cover_meta": ParagraphStyle("cm", fontName="Helvetica", fontSize=10, leading=14, textColor=INK2, alignment=TA_LEFT),
        "page_title": ParagraphStyle("pt", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK, alignment=TA_LEFT, spaceAfter=8),
        "phase_label": ParagraphStyle("pl", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=INK, alignment=TA_LEFT, spaceAfter=4),
        "phase_name": ParagraphStyle("pn", fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=INK, alignment=TA_LEFT, spaceAfter=4),
        "phase_meta": ParagraphStyle("pm", fontName="Courier", fontSize=9, leading=11, textColor=INK3, alignment=TA_LEFT, spaceAfter=10),
        "task_title": ParagraphStyle("tt", fontName="Helvetica", fontSize=10, leading=14, textColor=INK, alignment=TA_LEFT),
        "task_meta": ParagraphStyle("tm", fontName="Courier", fontSize=8, leading=10, textColor=INK3, alignment=TA_LEFT),
        "empty_phase": ParagraphStyle("ep", fontName="Helvetica-Oblique", fontSize=9, leading=12, textColor=INK3, alignment=TA_LEFT, spaceAfter=16),
    }


# ── Calcul des ticks pour l'axe temporel ──
def compute_range_and_granularity(phases, project):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    mn, mx = None, None
    for ph in phases:
        s = parse_date(ph.get("startDate"))
        e = parse_date(ph.get("endDate"))
        if s and (mn is None or s < mn): mn = s
        if e and (mx is None or e > mx): mx = e
    if mn is None:
        mn = parse_date(project.get("startDate")) or today
    if mx is None:
        mx = parse_date(project.get("endDate")) or (today + timedelta(days=30))
    if mx <= mn:
        mx = mn + timedelta(days=30)
    mn = mn - timedelta(days=3)
    mx = mx + timedelta(days=3)
    total_days = (mx - mn).days
    granularity = "day" if total_days <= 14 else ("week" if total_days <= 90 else "month")
    return mn, mx, total_days, granularity, today


def compute_ticks(mn, mx, granularity):
    ticks = []
    cur = mn.replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "week":
        # Aligner sur lundi
        day = cur.weekday()  # 0=Monday
        if day != 0:
            cur = cur + timedelta(days=(7 - day))
    elif granularity == "month":
        # Aligner sur 1er du mois
        if cur.day != 1:
            year, month = cur.year, cur.month + 1
            if month > 12: year, month = year + 1, 1
            cur = datetime(year, month, 1)
    step_days = 1 if granularity == "day" else 7
    safety = 0
    while cur < mx and safety < 80:
        ticks.append(cur)
        if granularity == "month":
            year, month = cur.year, cur.month + 1
            if month > 12: year, month = year + 1, 1
            cur = datetime(year, month, 1)
        else:
            cur = cur + timedelta(days=step_days)
        safety += 1
    return ticks


# ── Cover page (landscape) ──
def on_cover_page(canv, doc):
    project = doc.lg_project
    pillar = project.get("pillar", "STUDIO")
    color = PILLAR_COLOR.get(pillar, PILLAR_COLOR["STUDIO"])

    W, H = LW, LH  # landscape

    band_h = H * 0.45
    canv.setFillColor(color)
    canv.rect(0, H - band_h, W, band_h, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Helvetica-Bold", 11)
    canv.drawString(MARGIN, H - 30, "LES GRIOTS")
    canv.drawString(MARGIN, H - 44, "Project")
    canv.drawString(MARGIN, H - 58, "Roadmap")
    canv.setFont("Helvetica-Bold", 8)
    canv.drawRightString(W - MARGIN, H - 30, PILLAR_LABEL.get(pillar, pillar).upper())

    canv.setStrokeColor(INK)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, MARGIN + 5 * mm, W - MARGIN, MARGIN + 5 * mm)
    canv.setFillColor(INK2)
    canv.setFont("Helvetica-Bold", 7.5)
    year = datetime.now().year
    canv.drawString(MARGIN, MARGIN, f"© {year} LES GRIOTS SASU")
    canv.drawCentredString(W / 2, MARGIN, "lesgriots.com")
    canv.setFont("Helvetica-BoldOblique", 8)
    canv.drawRightString(W - MARGIN, MARGIN, "Roadmap projet")


# ── Gantt page (landscape, dessine direct sur le canvas) ──
def on_gantt_page(canv, doc):
    project = doc.lg_project
    phases = doc.lg_phases
    tasks = doc.lg_tasks
    pillar = project.get("pillar", "STUDIO")
    color = PILLAR_COLOR.get(pillar, PILLAR_COLOR["STUDIO"])

    W, H = LW, LH  # landscape
    # ── Header bar ──
    canv.setFillColor(color)
    canv.rect(0, H - 8, W, 8, fill=1, stroke=0)

    # Titre projet + meta
    canv.setFillColor(INK)
    canv.setFont("Helvetica-Bold", 16)
    canv.drawString(MARGIN, H - 30, safe(project.get("name"), "Projet"))
    canv.setFont("Courier-Bold", 9)
    canv.setFillColor(INK3)
    canv.drawString(MARGIN, H - 45,
                    f"{safe(project.get('code'))}  ·  {PILLAR_LABEL.get(pillar, pillar)}  ·  Roadmap")

    # ── Dimensions de la chart ──
    label_w = 65 * mm
    chart_x = MARGIN + label_w
    chart_top = H - 75
    chart_bottom = MARGIN + 25  # laisser place pour footer
    chart_w = W - MARGIN - chart_x
    if not phases:
        canv.setFillColor(INK3)
        canv.setFont("Helvetica-Oblique", 10)
        canv.drawString(MARGIN, chart_top - 20, "Aucune phase definie pour ce projet.")
        # Footer
        canv.setFillColor(INK2)
        canv.setFont("Helvetica-Bold", 7.5)
        year = datetime.now().year
        canv.drawString(MARGIN, MARGIN - 4 * mm, f"© {year} LES GRIOTS SASU")
        canv.drawCentredString(W / 2, MARGIN - 4 * mm, "Roadmap projet")
        canv.setFont("Helvetica-BoldOblique", 9)
        canv.setFillColor(INK)
        canv.drawRightString(W - MARGIN, MARGIN - 4 * mm, "lesgriots")
        return

    sorted_phases = sorted(phases, key=lambda p: p.get("sortOrder", 0))
    mn, mx, total_days, granularity, today = compute_range_and_granularity(sorted_phases, project)
    ticks = compute_ticks(mn, mx, granularity)
    if total_days <= 0: total_days = 1
    px_per_day = chart_w / total_days

    def x_of(d):
        return chart_x + (d - mn).days * px_per_day

    # ── Header de l'axe temporel ──
    canv.setFillColor(INK3)
    canv.setFont("Courier", 8)
    for t in ticks:
        x = x_of(t)
        canv.line(x, chart_top - 12, x, chart_bottom)
        canv.setStrokeColor(HAIR)
        canv.setLineWidth(0.3)
        canv.line(x, chart_top - 12, x, chart_bottom)
        canv.setFillColor(INK3)
        canv.drawString(x + 2, chart_top - 9, fmt_date_short(t, granularity))

    # Today line
    if mn <= today <= mx:
        x_today = x_of(today)
        canv.setStrokeColor(SAFFRON)
        canv.setLineWidth(1.2)
        canv.setDash([3, 2])
        canv.line(x_today, chart_top - 12, x_today, chart_bottom)
        canv.setDash()
        canv.setFillColor(SAFFRON)
        canv.setFont("Helvetica-Bold", 7)
        canv.drawString(x_today + 2, chart_top - 6, "TODAY")

    # ── Rangées par phase ──
    row_h = 22
    available_h = chart_top - chart_bottom - 20
    max_rows = max(1, int(available_h / row_h))
    visible_phases = sorted_phases[:max_rows]
    bar_h = 12

    for i, phase in enumerate(visible_phases):
        y = chart_top - 30 - i * row_h

        # Zebra background
        if i % 2 == 1:
            canv.setFillColor(colors.HexColor("#F7F2E8"))
            canv.rect(chart_x, y - 4, chart_w, row_h - 4, fill=1, stroke=0)

        # Label phase à gauche
        try:
            phase_color = colors.HexColor(phase.get("color") or "#C46B3D")
        except Exception:
            phase_color = TERRACOTTA
        # Color stripe
        canv.setFillColor(phase_color)
        canv.rect(MARGIN, y, 3, bar_h, fill=1, stroke=0)
        # Name
        canv.setFillColor(INK)
        canv.setFont("Helvetica-Bold", 9)
        name = safe(phase.get("name"))
        canv.drawString(MARGIN + 8, y + 3, name[:30])

        # Bar gantt
        s = parse_date(phase.get("startDate"))
        e = parse_date(phase.get("endDate"))
        if s and e:
            bx = x_of(s)
            bw = max(2, (e - s).days * px_per_day)
            # Background pale
            canv.setFillColor(phase_color)
            canv.setFillAlpha(0.18)
            canv.roundRect(bx, y, bw, bar_h, 2, fill=1, stroke=0)
            canv.setFillAlpha(1)
            # Progress fill
            phase_tasks = [t for t in tasks if (t.get("phase_group") or t.get("phaseGroup")) == name]
            if phase_tasks:
                done = sum(1 for t in phase_tasks if t.get("status") == "done")
                prog = done / len(phase_tasks)
                if prog > 0:
                    canv.setFillColor(phase_color)
                    canv.setFillAlpha(0.85)
                    canv.roundRect(bx, y, bw * prog, bar_h, 2, fill=1, stroke=0)
                    canv.setFillAlpha(1)
                # Label dans la barre si assez large
                if bw > 50:
                    canv.setFillColor(colors.white)
                    canv.setFont("Helvetica-Bold", 7.5)
                    canv.drawString(bx + 4, y + 3, f"{done}/{len(phase_tasks)}")
                # Date deadline si la phase n'est pas done à 100%
            # Border
            canv.setStrokeColor(phase_color)
            canv.setLineWidth(0.6)
            canv.roundRect(bx, y, bw, bar_h, 2, fill=0, stroke=1)
        else:
            # Pas de dates
            canv.setFillColor(INK3)
            canv.setFont("Helvetica-Oblique", 7)
            canv.drawString(chart_x + 4, y + 4, "(pas de dates)")

        # Task dots (due dates) sous la barre
        phase_tasks_d = [t for t in tasks if (t.get("phase_group") or t.get("phaseGroup")) == name]
        for t in phase_tasks_d:
            due = parse_date(t.get("due_date") or t.get("dueDate"))
            if not due or due < mn or due > mx: continue
            dx = x_of(due)
            dy = y - 3
            status = t.get("status", "todo")
            canv.setFillColor(STATUS_COLOR.get(status, INK3))
            canv.circle(dx, dy, 1.6, fill=1, stroke=0)

    # Notice s'il y a plus de phases que l'espace
    if len(sorted_phases) > max_rows:
        skipped = len(sorted_phases) - max_rows
        canv.setFillColor(INK3)
        canv.setFont("Helvetica-Oblique", 8)
        canv.drawString(MARGIN, chart_bottom + 6,
                         f"+ {skipped} phase{'s' if skipped > 1 else ''} non affichee{'s' if skipped > 1 else ''} (espace insuffisant)")

    # ── Légende en bas ──
    legend_y = chart_bottom - 8
    items = [
        (SAFFRON, "today (dashed gold)", True),
        (STATUS_COLOR["todo"], "a faire", False),
        (STATUS_COLOR["in_progress"], "en cours", False),
        (STATUS_COLOR["review"], "review", False),
        (STATUS_COLOR["done"], "done", False),
    ]
    canv.setFont("Courier", 7.5)
    x_legend = MARGIN
    for color_l, label_l, dashed in items:
        if dashed:
            canv.setStrokeColor(color_l)
            canv.setLineWidth(1.2)
            canv.setDash([3, 2])
            canv.line(x_legend, legend_y, x_legend + 14, legend_y)
            canv.setDash()
        else:
            canv.setFillColor(color_l)
            canv.circle(x_legend + 4, legend_y, 2.5, fill=1, stroke=0)
        canv.setFillColor(INK3)
        canv.drawString(x_legend + 18, legend_y - 2, label_l)
        x_legend += 14 + 18 + len(label_l) * 4 + 8

    canv.setFillColor(INK3)
    canv.setFont("Helvetica-Oblique", 7)
    canv.drawRightString(W - MARGIN, legend_y - 2,
                         f"echelle : {'jours' if granularity == 'day' else 'semaines' if granularity == 'week' else 'mois'}")

    # ── Footer ──
    canv.setFillColor(INK2)
    canv.setFont("Helvetica-Bold", 7.5)
    year = datetime.now().year
    canv.drawString(MARGIN, MARGIN - 4 * mm, f"© {year} LES GRIOTS SASU")
    canv.drawCentredString(W / 2, MARGIN - 4 * mm, "Roadmap projet")
    canv.setFont("Helvetica-BoldOblique", 9)
    canv.setFillColor(INK)
    canv.drawRightString(W - MARGIN, MARGIN - 4 * mm, "lesgriots")


# ── Page Liste taches (landscape) ──
def on_list_page(canv, doc):
    project = doc.lg_project
    W, H = LW, LH  # landscape
    canv.setStrokeColor(INK)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, H - MARGIN + 5 * mm, W - MARGIN, H - MARGIN + 5 * mm)
    canv.setFillColor(INK3)
    canv.setFont("Courier", 7)
    canv.drawString(MARGIN, H - MARGIN + 8 * mm,
                     f"{safe(project.get('code'))}  ·  {safe(project.get('name'))[:60]}")
    canv.drawRightString(W - MARGIN, H - MARGIN + 8 * mm,
                          f"page {canv.getPageNumber() - 2}")
    canv.setFillColor(INK2)
    canv.setFont("Helvetica-Bold", 7.5)
    year = datetime.now().year
    canv.drawString(MARGIN, MARGIN - 4 * mm, f"© {year} LES GRIOTS SASU")
    canv.drawCentredString(W / 2, MARGIN - 4 * mm, "Roadmap — detail")
    canv.setFont("Helvetica-BoldOblique", 9)
    canv.setFillColor(INK)
    canv.drawRightString(W - MARGIN, MARGIN - 4 * mm, "lesgriots")


# ── Content cover ──
def build_cover(project, client, phases, tasks, styles):
    elements = []
    elements.append(Spacer(1, LH * 0.45 - MARGIN + 30))
    elements.append(Paragraph(safe(project.get("name"), "Projet sans nom"), styles["cover_title"]))
    elements.append(Paragraph("ROADMAP", styles["cover_subtitle"]))
    elements.append(Spacer(1, 16))
    parts = [safe(project.get("code")), PILLAR_LABEL.get(project.get("pillar"), project.get("pillar", ""))]
    elements.append(Paragraph(" · ".join([p for p in parts if p]), styles["cover_subtitle"]))
    elements.append(Spacer(1, 24))

    # Client + dates
    client_str = ""
    if client:
        company = safe(client.get("company"))
        first = safe(client.get("firstName"))
        last = safe(client.get("lastName"))
        if company:
            contact = f"{first} {last}".strip()
            client_str = f"<b>Client</b>  ·  {html_escape(company)}"
            if contact: client_str += f"  ·  {html_escape(contact)}"
        else:
            full = f"{first} {last}".strip()
            if full: client_str = f"<b>Client</b>  ·  {html_escape(full)}"
    if not client_str:
        c = safe(project.get("client"))
        if c: client_str = f"<b>Client</b>  ·  {html_escape(c)}"
    if client_str:
        elements.append(Paragraph(client_str, styles["cover_meta"]))
        elements.append(Spacer(1, 6))

    sd = safe(project.get("startDate"))
    ed = safe(project.get("endDate"))
    if sd or ed:
        if sd and ed: dates_str = f"{fmt_date_fr(sd)}  →  {fmt_date_fr(ed)}"
        elif sd: dates_str = f"depuis le {fmt_date_fr(sd)}"
        else: dates_str = f"livraison le {fmt_date_fr(ed)}"
        elements.append(Paragraph(f"<b>Dates</b>  ·  {html_escape(dates_str)}", styles["cover_meta"]))
        elements.append(Spacer(1, 6))

    # Stats
    total_tasks = len(tasks)
    tasks_done = sum(1 for t in tasks if t.get("status") == "done")
    total_hours = sum(float(t.get("estimated_hours") or 0) for t in tasks)
    progress_pct = round((tasks_done / total_tasks) * 100) if total_tasks else 0
    summary = [
        f"<b>Phases</b>  ·  {len(phases)}",
        f"<b>Taches</b>  ·  {total_tasks} ({tasks_done} terminees, {progress_pct}%)",
    ]
    if total_hours > 0:
        summary.append(f"<b>Heures estimees</b>  ·  {int(total_hours)}h")
    for line in summary:
        elements.append(Paragraph(line, styles["cover_meta"]))
        elements.append(Spacer(1, 4))
    return elements


# ── Content liste taches ──
def build_phase_detail_block(phase, phase_tasks, styles):
    elements = []
    try:
        phase_color = colors.HexColor(phase.get("color") or "#C46B3D")
    except Exception:
        phase_color = TERRACOTTA
    elements.append(HRule(width=28*mm, thickness=2, color=phase_color))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"PHASE {phase.get('sortOrder', 0) + 1}", styles["phase_label"]))
    elements.append(Paragraph(html_escape(phase.get("name", "—")), styles["phase_name"]))

    total = len(phase_tasks)
    done = sum(1 for t in phase_tasks if t.get("status") == "done")
    total_h = sum(float(t.get("estimated_hours") or 0) for t in phase_tasks)
    meta = []
    sd = safe(phase.get("startDate")); ed = safe(phase.get("endDate"))
    if sd and ed: meta.append(f"{fmt_date_fr(sd)} → {fmt_date_fr(ed)}")
    elif sd: meta.append(f"depuis le {fmt_date_fr(sd)}")
    elif ed: meta.append(f"livraison {fmt_date_fr(ed)}")
    meta.append(f"{total} tache{'s' if total > 1 else ''}")
    if done: meta.append(f"{done} terminees")
    if total_h: meta.append(f"{int(total_h)}h estimees")
    elements.append(Paragraph("  ·  ".join(meta), styles["phase_meta"]))

    if not phase_tasks:
        elements.append(Paragraph("(aucune tache assignee a cette phase)", styles["empty_phase"]))
        return elements

    rows = []
    for t in phase_tasks:
        complexity = t.get("complexity", "simple")
        marker = "◆" if complexity == "complex" else "●"
        marker_color = DANGER if complexity == "complex" else SUCCESS
        status = t.get("status", "todo")
        title = safe(t.get("title"), "—")
        title_html = html_escape(title)
        if status == "done": title_html = f"<strike>{title_html}</strike>"
        title_para = Paragraph(title_html, styles["task_title"])

        meta_t = []
        if t.get("assignee_name") or t.get("assigneeName"):
            meta_t.append(safe(t.get("assignee_name") or t.get("assigneeName")))
        if t.get("estimated_hours"): meta_t.append(f"{t['estimated_hours']}h")
        d = t.get("due_date") or t.get("dueDate")
        if d: meta_t.append(fmt_date_fr(d))
        deps = t.get("depends_on") or t.get("dependsOn") or []
        if isinstance(deps, list) and len(deps) > 0:
            meta_t.append(f"⇠ {len(deps)} dep{'s' if len(deps) > 1 else ''}")
        meta_t.append(STATUS_LABEL.get(status, status))
        meta_para = Paragraph("  ·  ".join(meta_t), styles["task_meta"])

        marker_para = Paragraph(
            f'<font color="{marker_color.hexval()}"><b>{marker}</b></font>',
            styles["task_title"]
        )
        rows.append([marker_para, [title_para, meta_para]])

    if rows:
        t = Table(rows, colWidths=[10 * mm, LW - 2 * MARGIN - 10 * mm])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR),
        ]))
        elements.append(t)
    elements.append(Spacer(1, 18))
    return elements


def build_list_pages(project, phases, tasks, styles):
    elements = []
    elements.append(Paragraph(safe(project.get("name"), "Projet"), styles["page_title"]))
    elements.append(Paragraph("Roadmap — detail des phases et taches", styles["cover_subtitle"]))
    elements.append(Spacer(1, 18))

    if not phases:
        elements.append(Paragraph("Aucune phase definie pour ce projet.", styles["empty_phase"]))
        return elements

    sorted_phases = sorted(phases, key=lambda p: p.get("sortOrder", 0))
    for phase in sorted_phases:
        name = phase.get("name", "")
        ph_tasks = [t for t in tasks if (t.get("phase_group") or t.get("phaseGroup")) == name]
        ph_tasks.sort(key=lambda t: t.get("sort_order", t.get("sortOrder", 0)) or 0)
        elements.append(KeepTogether(build_phase_detail_block(phase, ph_tasks, styles)))

    return elements


# ── Build PDF ──
def build_pdf(payload):
    project = payload.get("project", {})
    client = payload.get("client") or None
    phases = payload.get("phases", []) or []
    tasks = payload.get("tasks", []) or []

    buf = io.BytesIO()
    styles = make_styles()

    # 3 templates : Cover landscape, Gantt landscape, List landscape
    frame_cover = Frame(MARGIN, MARGIN + 6 * mm, LW - 2 * MARGIN, LH - 2 * MARGIN - 6 * mm,
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                        showBoundary=0, id="cover_frame")
    # Gantt page : on dessine TOUT au canvas, donc un frame vide minimal
    frame_gantt = Frame(MARGIN, MARGIN, LW - 2 * MARGIN, LH - 2 * MARGIN,
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                        showBoundary=0, id="gantt_frame")
    frame_list = Frame(MARGIN, MARGIN, LW - 2 * MARGIN, LH - 2 * MARGIN - 6 * mm,
                       leftPadding=0, rightPadding=0, topPadding=6 * mm, bottomPadding=0,
                       showBoundary=0, id="list_frame")

    t_cover = PageTemplate(id="cover", frames=[frame_cover], onPage=on_cover_page, pagesize=landscape(A4))
    t_gantt = PageTemplate(id="gantt", frames=[frame_gantt], onPage=on_gantt_page, pagesize=landscape(A4))
    t_list = PageTemplate(id="list", frames=[frame_list], onPage=on_list_page, pagesize=landscape(A4))

    doc = BaseDocTemplate(buf, pagesize=landscape(A4),
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=MARGIN)
    doc.addPageTemplates([t_cover, t_gantt, t_list])

    doc.lg_project = project
    doc.lg_phases = phases
    doc.lg_tasks = tasks

    story = []
    # Cover
    story.extend(build_cover(project, client, phases, tasks, styles))
    # Gantt page (le canvas est dessiné dans onPage)
    story.append(NextPageTemplate("gantt"))
    story.append(PageBreak())
    # Frame vide pour la page Gantt (le dessin est dans onPage)
    story.append(Spacer(1, 1))
    # Pages liste
    story.append(NextPageTemplate("list"))
    story.append(PageBreak())
    story.extend(build_list_pages(project, phases, tasks, styles))

    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes


def main():
    try:
        payload = json.loads(sys.stdin.read())
    except Exception as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)
    try:
        pdf = build_pdf(payload)
        sys.stdout.buffer.write(pdf)
    except Exception as e:
        sys.stderr.write(f"PDF generation failed: {e}\n")
        sys.exit(3)


if __name__ == "__main__":
    main()

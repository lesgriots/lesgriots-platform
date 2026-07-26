#!/usr/bin/env python3
"""
LES GRIOTS — Générateur After Action Review (AAR) PDF.

Format inspiré de Practical Project Management (The Futur / Chris Do) chapitre 14.

L'AAR est une rétrospective structurée post-projet, basée sur 4 questions :
  1. Qu'est-ce qui était censé arriver ? (intent)
  2. Qu'est-ce qui s'est réellement passé ? (reality)
  3. Pourquoi cette différence ? (root cause)
  4. Qu'est-ce qu'on retient pour la suite ? (lessons learned)

L'AAR est rempli post-projet par l'équipe pour capitaliser les apprentissages.
Ce générateur prend les données projet et produit un PDF pré-rempli des sections
factuelles (1, 2 partiel) ; les sections analytiques (3, 4) sont à compléter à la main.

Structure :
  - Cover : nom projet, dates, équipe, client
  - Section 1 — Intent (objectifs initiaux, livrables prévus, budget prévu)
  - Section 2 — Reality (livrables effectifs, dates effectives, heures réelles, budget réel, KPIs)
  - Section 3 — Root Cause (analyse écarts) — vide à remplir
  - Section 4 — Lessons Learned + Actions for next time — vide à remplir
  - Bonus : What worked / What didn't / What surprised us
  - Signature équipe

Usage: echo '<json>' | python3 generate_aar.py
"""
import sys
import json
import io
from datetime import datetime

from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.lib.units import mm
from reportlab.lib import colors

from legal_common import (
    W, H, MARGIN, PAPER, INK, INK2, INK3, HAIR, TERRACOTTA, GOLD_SOFT,
    LES_GRIOTS,
    make_styles, hr, fmt_date_fr, safe,
)


def page_aar_header_footer(canvas, doc, project_name):
    """Header/footer AAR."""
    canvas.saveState()
    # Header
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(MARGIN, H - 12 * mm, "LES GRIOTS · AAR")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN + 25 * mm, H - 12 * mm, project_name.upper()[:60])
    canvas.setStrokeColor(HAIR)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, H - 14 * mm, W - MARGIN, H - 14 * mm)
    # Footer
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN, 12 * mm, "After Action Review · Practical Project Management (The Futur)")
    canvas.drawRightString(W - MARGIN, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_aar(payload):
    """Construit la liste de Flowables."""
    project = payload.get("project") or {}
    client = payload.get("client") or {}
    tasks = payload.get("tasks") or []
    expenses = payload.get("expenses") or []
    journal = payload.get("journal") or []

    pname = safe(project.get("name"), "[Projet]")
    pcode = safe(project.get("code"))
    pillar = safe(project.get("pillar"))
    pstart = safe(project.get("startDate") or project.get("start_date"))
    pend = safe(project.get("endDate") or project.get("end_date"))
    prevenue = float(project.get("revenue") or 0)
    pbudget = float(project.get("budget") or 0)
    phours = float(project.get("hoursSpent") or project.get("hours_spent") or 0)
    pclient = safe(client.get("company")) or safe(project.get("client"))

    styles = make_styles()
    story = []

    # ── Cover ──
    story.append(Paragraph("After Action Review", styles["title"]))
    story.append(Paragraph(
        f"Rétrospective projet · {fmt_date_fr(None)}",
        styles["subtitle"],
    ))

    # Encadré projet
    cover_rows = [
        ["Projet", pname],
        ["Code", pcode or "—"],
        ["Pilier", pillar or "—"],
        ["Client", pclient or "—"],
        ["Période", f"{fmt_date_fr(pstart)} → {fmt_date_fr(pend)}" if pstart and pend else "—"],
        ["Revenue HT", f"{prevenue:,.0f} €".replace(",", " ") if prevenue else "—"],
        ["Heures passées", f"{phours:g} h" if phours else "—"],
    ]
    tbl = Table(cover_rows, colWidths=[35 * mm, (W - 2 * MARGIN) - 35 * mm])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), INK3),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HAIR),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8 * mm))

    # ── Méthodo encadrée ──
    story.append(Paragraph(
        "<b>L'AAR (After Action Review)</b> est une rétrospective post-projet structurée autour "
        "de 4 questions, popularisée par The Futur (Chris Do). Elle vise à transformer chaque "
        "projet en apprentissage capitalisable, sans pointer du doigt ni se complaire dans la "
        "victoire. Les sections factuelles sont pré-remplies depuis le dashboard LES GRIOTS OS. "
        "Les sections analytiques (Root Cause, Lessons Learned) sont à compléter en équipe.",
        styles["disclaimer"],
    ))
    story.append(Spacer(1, 8 * mm))

    # ── Section 1 — Intent ──
    story.append(Paragraph("1. INTENT — Ce qui était censé arriver", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        "<b>Objectif initial du projet</b> (depuis le brief)",
        styles["label"],
    ))
    goal = safe((project.get("creativeBrief") or {}).get("goal")) or safe(project.get("notes"))
    story.append(Paragraph(
        goal or "<i>[À compléter — pourquoi ce projet, quel résultat business visé ?]</i>",
        styles["body"],
    ))
    story.append(Paragraph("<b>Budget prévu</b>", styles["label"]))
    story.append(Paragraph(
        f"{pbudget:,.0f} € HT".replace(",", " ") if pbudget else "<i>[Non renseigné]</i>",
        styles["body_left"],
    ))
    story.append(Paragraph("<b>Période prévue</b>", styles["label"]))
    story.append(Paragraph(
        f"{fmt_date_fr(pstart)} → {fmt_date_fr(pend)}" if pstart and pend else "<i>[Non renseigné]</i>",
        styles["body_left"],
    ))

    # ── Section 2 — Reality ──
    story.append(Paragraph("2. REALITY — Ce qui s'est vraiment passé", styles["section"]))
    story.append(hr())

    # Stats équipe
    tasks_done = [t for t in tasks if t.get("status") == "done"]
    tasks_open = [t for t in tasks if t.get("status") != "done"]
    expenses_total = sum(float(e.get("amount_ttc") or 0) for e in expenses)

    stats_rows = [
        ["Tâches complétées", f"{len(tasks_done)} / {len(tasks)}"],
        ["Heures réellement passées", f"{phours:g} h" if phours else "—"],
        ["Dépenses engagées", f"{expenses_total:,.2f} € TTC".replace(",", " ") if expenses_total else "—"],
        ["Marge brute", f"{prevenue - expenses_total:,.2f} €".replace(",", " ") if prevenue else "—"],
        ["Revenue / heure", f"{(prevenue / phours):,.0f} €/h".replace(",", " ") if phours and prevenue else "—"],
    ]
    tbl2 = Table(stats_rows, colWidths=[55 * mm, (W - 2 * MARGIN) - 55 * mm])
    tbl2.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), INK2),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HAIR),
    ]))
    story.append(tbl2)
    story.append(Spacer(1, 4 * mm))

    # Tâches non terminées (signal faible)
    if tasks_open:
        story.append(Paragraph("<b>Tâches restées ouvertes</b>", styles["label"]))
        for t in tasks_open[:10]:
            title = safe(t.get("title"))
            assignee = safe(t.get("assignee_name") or t.get("assigneeName"))
            line = f"• {title}"
            if assignee:
                line += f" <font color='#8B8175'>({assignee})</font>"
            story.append(Paragraph(line, styles["body_left"]))
        if len(tasks_open) > 10:
            story.append(Paragraph(
                f"<i>… et {len(tasks_open) - 10} autres tâches</i>",
                styles["footnote"],
            ))

    # Journal projet (résumé)
    if journal:
        story.append(Paragraph("<b>Faits marquants (extrait du journal)</b>", styles["label"]))
        for entry in journal[:5]:
            content = safe(entry.get("content"))[:200]
            date = safe(entry.get("createdAt") or entry.get("created_at"))
            story.append(Paragraph(
                f"<font color='#8B8175' size='8'>{fmt_date_fr(date)}</font> — {content}",
                styles["body_left"],
            ))

    story.append(PageBreak())

    # ── Section 3 — Root Cause ──
    story.append(Paragraph("3. ROOT CAUSE — Pourquoi cette différence ?", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        "<i>Analyse à compléter en équipe. Pour chaque écart constaté à la section 2, "
        "creuser jusqu'à la cause profonde (méthode des « 5 pourquoi »). "
        "Ne pas chercher le coupable — chercher le mécanisme.</i>",
        styles["disclaimer"],
    ))
    story.append(Spacer(1, 4 * mm))
    for label in ["Écart budget", "Écart planning", "Écart scope", "Écart qualité", "Autre"]:
        story.append(Paragraph(f"<b>{label}</b>", styles["label"]))
        # Cadre vide pour écrire
        empty_table = Table(
            [[""]],
            colWidths=[(W - 2 * MARGIN)],
            rowHeights=[20 * mm],
        )
        empty_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ]))
        story.append(empty_table)
        story.append(Spacer(1, 4 * mm))

    story.append(PageBreak())

    # ── Section 4 — Lessons Learned ──
    story.append(Paragraph("4. LESSONS LEARNED — Ce qu'on retient", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        "<i>Lessons learned = ce qu'on appliquera concrètement au prochain projet. "
        "Pas une liste de vœux pieux, des actions actionnables avec des owners.</i>",
        styles["disclaimer"],
    ))
    story.append(Spacer(1, 4 * mm))

    for label in [
        "✅ Ce qui a marché — à reproduire",
        "❌ Ce qui n'a pas marché — à éviter",
        "🤯 Ce qui nous a surpris — à creuser",
        "🚀 Actions concrètes pour le prochain projet (Owner · Deadline)",
    ]:
        story.append(Paragraph(f"<b>{label}</b>", styles["label"]))
        empty_table = Table(
            [[""]],
            colWidths=[(W - 2 * MARGIN)],
            rowHeights=[25 * mm],
        )
        empty_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ]))
        story.append(empty_table)
        story.append(Spacer(1, 4 * mm))

    # ── Section 5 — Signatures ──
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Participant·e·s de la rétrospective", styles["section"]))
    story.append(hr())
    sig_rows = [
        ["Nom", "Rôle", "Signature"],
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
    ]
    sig_tbl = Table(sig_rows, colWidths=[60 * mm, 50 * mm, (W - 2 * MARGIN) - 110 * mm])
    sig_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(sig_tbl)

    return story


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)

    project = payload.get("project") or {}
    pname = safe(project.get("name"), "Projet")

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 4 * mm, bottomMargin=MARGIN,
        title=f"AAR — {pname}",
        author="LES GRIOTS",
    )

    frame = Frame(
        MARGIN, MARGIN,
        W - 2 * MARGIN, H - 2 * MARGIN - 8 * mm,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    def on_page(canvas, doc):
        page_aar_header_footer(canvas, doc, pname)

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=on_page),
    ])

    story = build_aar(payload)
    doc.build(story)

    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

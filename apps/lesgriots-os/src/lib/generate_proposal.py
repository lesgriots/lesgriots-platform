#!/usr/bin/env python3
"""
LES GRIOTS — Générateur Proposal PDF (Chris Do · The Perfect Proposal).

Une proposal n'est pas un devis. C'est :
  - une vente écrite (executive summary qui vend la valeur, pas les heures)
  - 3 niveaux d'investissement (good/better/best) qui ancrent le mid-tier
  - un scope tiered (ce qui est inclus / exclu à chaque niveau)
  - les conditions et next steps

Structure (cover landscape + détail portrait) :
  - Cover : titre projet + client + ref + date + valeur
  - Page 2 — Executive Summary : challenge / approche / résultat attendu
  - Page 3 — Investment Levels (3 cartes tarif side-by-side)
  - Page 4 — Scope detail (qu'est-ce qui est inclus à chaque niveau)
  - Page 5 — Timeline + Process + Next Steps
  - Page 6 — Terms (paiement, droits, juridiction simplifiés) + signature

Usage: echo '<json>' | python3 generate_proposal.py

JSON attendu :
{
  project, client, brief,
  levels: [
    { name: "Good", price_ht: 8000, included: ["…"], not_included: ["…"] },
    { name: "Better", price_ht: 14000, included: [...], not_included: [...], recommended: true },
    { name: "Best", price_ht: 22000, included: [...] }
  ],
  challenge: "...",
  approach: "...",
  outcome: "...",
  payment_terms: 30,
}
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
from reportlab.lib.pagesizes import landscape, A4

from legal_common import (
    W, H, MARGIN, PAPER, SURFACE, INK, INK2, INK3, HAIR, TERRACOTTA, SAFFRON, GOLD_SOFT,
    LES_GRIOTS,
    make_styles, hr, fmt_date_fr, safe,
)

# Pour la cover, on utilise landscape
LW, LH = landscape(A4)


def fmt_eur(n):
    if not n:
        return "—"
    try:
        n = float(n)
        return f"{n:,.0f} €".replace(",", " ")
    except Exception:
        return "—"


def proposal_cover(canvas, doc, project_name, client_name, ref, date_str):
    """Page de couverture personnalisée."""
    canvas.saveState()
    # Fond papier
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, LW, LH, fill=1, stroke=0)

    # Bandeau couleur
    canvas.setFillColor(TERRACOTTA)
    canvas.rect(0, 0, 20 * mm, LH, fill=1, stroke=0)

    # Bandeau secondaire
    canvas.setFillColor(SAFFRON)
    canvas.rect(20 * mm, 0, 4 * mm, LH, fill=1, stroke=0)

    # Logo / nom société
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(INK)
    canvas.drawString(40 * mm, LH - 25 * mm, "LES GRIOTS")
    canvas.setFillColor(INK3)
    canvas.drawString(60 * mm, LH - 25 * mm, "· Proposition de collaboration")

    # Titre projet (énorme)
    canvas.setFont("Helvetica-Bold", 36)
    canvas.setFillColor(INK)
    # Wrap simple sur 2 lignes si trop long
    title = project_name[:80]
    canvas.drawString(40 * mm, LH / 2 + 15 * mm, "PROPOSITION")

    canvas.setFont("Helvetica", 22)
    canvas.setFillColor(INK2)
    # Découper si > 50 chars
    if len(title) > 50:
        canvas.drawString(40 * mm, LH / 2 - 5 * mm, title[:50])
        canvas.drawString(40 * mm, LH / 2 - 15 * mm, title[50:])
    else:
        canvas.drawString(40 * mm, LH / 2 - 5 * mm, title)

    # Bloc bas — Pour / Réf / Date
    y = 40 * mm
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK3)
    canvas.drawString(40 * mm, y, "POUR")
    canvas.drawString(120 * mm, y, "RÉFÉRENCE")
    canvas.drawString(200 * mm, y, "DATE")

    canvas.setFont("Helvetica", 12)
    canvas.setFillColor(INK)
    canvas.drawString(40 * mm, y - 8 * mm, client_name[:30])
    canvas.drawString(120 * mm, y - 8 * mm, ref)
    canvas.drawString(200 * mm, y - 8 * mm, date_str)

    canvas.restoreState()


def page_header_simple(canvas, doc, title):
    """Header simple pour les pages content."""
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(MARGIN, H - 12 * mm, "LES GRIOTS")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN + 22 * mm, H - 12 * mm, "PROPOSITION")
    canvas.drawRightString(W - MARGIN, H - 12 * mm, title.upper()[:50])
    canvas.setStrokeColor(HAIR)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, H - 14 * mm, W - MARGIN, H - 14 * mm)
    # Footer
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(INK3)
    canvas.drawString(MARGIN, 12 * mm, f"{LES_GRIOTS['nom_legal']} {LES_GRIOTS['forme']} · {LES_GRIOTS['email']}")
    canvas.drawRightString(W - MARGIN, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_proposal(payload):
    """Pages 2+ (page 1 = cover gérée par template)."""
    project = payload.get("project") or {}
    client = payload.get("client") or {}
    brief = payload.get("brief") or {}
    levels = payload.get("levels") or []
    challenge = safe(payload.get("challenge"), brief.get("goal") or "")
    approach = safe(payload.get("approach"), brief.get("creativeDirection") or "")
    outcome = safe(payload.get("outcome"), brief.get("clientNeeds") or "")
    payment_days = int(payload.get("payment_terms") or 30)

    styles = make_styles()
    story = []

    # ── Page 2 — Executive Summary ──
    story.append(Paragraph("Résumé exécutif", styles["title"]))
    story.append(Paragraph(
        "<i>Le défi · L'approche · Le résultat attendu</i>",
        styles["subtitle"],
    ))
    story.append(hr())

    story.append(Paragraph("LE DÉFI", styles["section"]))
    story.append(Paragraph(
        challenge or "<i>[À compléter — le problème que le client cherche à résoudre]</i>",
        styles["body"],
    ))

    story.append(Paragraph("NOTRE APPROCHE", styles["section"]))
    story.append(Paragraph(
        approach or "<i>[À compléter — comment LES GRIOTS aborde le problème, méthodologie distinctive]</i>",
        styles["body"],
    ))

    story.append(Paragraph("LE RÉSULTAT ATTENDU", styles["section"]))
    story.append(Paragraph(
        outcome or "<i>[À compléter — quel changement concret après la collaboration]</i>",
        styles["body"],
    ))

    story.append(PageBreak())

    # ── Page 3 — Investment Levels (3 cards) ──
    story.append(Paragraph("Niveaux d'investissement", styles["title"]))
    story.append(Paragraph(
        "<i>Trois options pour adapter notre collaboration à ton ambition et ton budget</i>",
        styles["subtitle"],
    ))
    story.append(Spacer(1, 4 * mm))

    if not levels or len(levels) < 1:
        # Niveaux par défaut si non fournis
        base_revenue = float(project.get("revenue") or 10000)
        levels = [
            {"name": "GOOD", "price_ht": base_revenue * 0.6, "included": ["[À définir]"]},
            {"name": "BETTER", "price_ht": base_revenue, "included": ["[À définir]"], "recommended": True},
            {"name": "BEST", "price_ht": base_revenue * 1.6, "included": ["[À définir]"]},
        ]

    # Tableau 3 colonnes pour les niveaux
    col_w = (W - 2 * MARGIN) / 3 - 4 * mm
    cards_data = [[None, None, None]]
    for i, lvl in enumerate(levels[:3]):
        name = safe(lvl.get("name"), "—")
        price = lvl.get("price_ht") or 0
        recommended = lvl.get("recommended", False)
        included = lvl.get("included") or []
        not_included = lvl.get("not_included") or []

        # Construire le contenu de la carte
        lines = []
        if recommended:
            lines.append(Paragraph(
                "<b><font color='#C46B3D'>★ RECOMMANDÉ</font></b>",
                ParagraphStyleSimple(8, INK3, bold=False),
            ))
        lines.append(Paragraph(
            f"<font size='14'><b>{name}</b></font>",
            ParagraphStyleSimple(14, INK, bold=True),
        ))
        lines.append(Spacer(1, 2 * mm))
        lines.append(Paragraph(
            f"<font size='20'><b>{fmt_eur(price)}</b></font><br/><font size='8' color='#8B8175'>HT</font>",
            ParagraphStyleSimple(20, TERRACOTTA, bold=True),
        ))
        lines.append(Spacer(1, 4 * mm))

        # Inclus
        lines.append(Paragraph(
            "<font size='8' color='#8B8175'><b>INCLUS</b></font>",
            ParagraphStyleSimple(8, INK3, bold=True),
        ))
        for item in included:
            lines.append(Paragraph(
                f"✓ {item}",
                ParagraphStyleSimple(9, INK, bold=False),
            ))

        # Non inclus
        if not_included:
            lines.append(Spacer(1, 3 * mm))
            lines.append(Paragraph(
                "<font size='8' color='#8B8175'><b>NON INCLUS</b></font>",
                ParagraphStyleSimple(8, INK3, bold=True),
            ))
            for item in not_included:
                lines.append(Paragraph(
                    f"<font color='#8B8175'>– {item}</font>",
                    ParagraphStyleSimple(9, INK3, bold=False),
                ))

        cards_data[0][i] = lines

    cards_table = Table(cards_data, colWidths=[col_w, col_w, col_w])
    cards_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, HAIR),
        ("BACKGROUND", (0, 0), (0, 0), SURFACE),
        ("BACKGROUND", (1, 0), (1, 0), GOLD_SOFT),  # mid-tier highlighted
        ("BACKGROUND", (2, 0), (2, 0), SURFACE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(cards_table)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "<i>Tous les niveaux incluent : kickoff stratégique, accès au dashboard de suivi LES GRIOTS OS, "
        "rapport de fin de projet, garantie de qualité sur les livrables.</i>",
        styles["footnote"],
    ))

    story.append(PageBreak())

    # ── Page 4 — Timeline + Process + Next Steps ──
    story.append(Paragraph("Process & calendrier", styles["title"]))
    story.append(hr())

    pstart = safe(project.get("startDate") or project.get("start_date"))
    pend = safe(project.get("endDate") or project.get("end_date"))

    timeline_rows = [
        ["Phase", "Période", "Livrable principal"],
        ["1. Onboarding & kickoff", "Semaine 1", "Brief validé · planning calé"],
        ["2. Discovery & stratégie", "Semaines 2-3", "Document stratégique · références"],
        ["3. Production", "Semaines 4-7", "Itérations · feedbacks structurés"],
        ["4. Finalisation & livraison", "Semaine 8", "Livrables finaux · droits cédés"],
        ["5. After Action Review", "Semaine 9", "Rétrospective · capitalisation"],
    ]
    if pstart and pend:
        timeline_rows[1][1] = fmt_date_fr(pstart)[:10]
        timeline_rows[4][1] = fmt_date_fr(pend)[:10]

    tbl = Table(
        timeline_rows,
        colWidths=[55 * mm, 35 * mm, (W - 2 * MARGIN) - 90 * mm],
    )
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK3),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD_SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Comment on travaille ensemble", styles["section"]))
    story.append(hr())
    process_points = [
        "<b>Toute validation par écrit</b> — un mention « approuvé » par email suffit, mais elle est nécessaire pour passer à l'étape suivante.",
        "<b>Délai de retour client : 3 jours ouvrés max</b> — au-delà, les jalons décalent d'autant.",
        "<b>Hebdo de 15 min</b> — pour le statut et les points bloquants. Pas plus, pas moins.",
        "<b>Tout changement de scope discuté avant exécution</b> — pour qu'il n'y ait jamais de surprise sur la facture finale.",
        "<b>Accès au dashboard LES GRIOTS OS</b> — pour suivre l'avancement, les tâches, et toutes les communications projet.",
    ]
    for p in process_points:
        story.append(Paragraph(f"• {p}", styles["body"]))

    story.append(PageBreak())

    # ── Page 5 — Terms & Next Steps ──
    story.append(Paragraph("Conditions & prochaines étapes", styles["title"]))
    story.append(hr())

    story.append(Paragraph("CONDITIONS COMMERCIALES", styles["section"]))
    terms = [
        f"<b>Modalités de paiement :</b> 50% à la signature · 50% à la livraison finale. Délai de règlement : {payment_days} jours fin de mois.",
        f"<b>Validité de l'offre :</b> 30 jours à compter de la date d'émission de cette proposition.",
        "<b>Propriété intellectuelle :</b> les livrables finaux sont cédés au client sous réserve du paiement intégral. Les éléments préexistants et la méthodologie restent propriété de LES GRIOTS. Détails au MSA / Schedule A.",
        "<b>Confidentialité :</b> toute information échangée dans le cadre de cette collaboration reste confidentielle pendant 3 ans après la fin du projet.",
        "<b>Droit applicable :</b> droit français, tribunaux compétents de Paris.",
    ]
    for t in terms:
        story.append(Paragraph(f"• {t}", styles["body"]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("PROCHAINES ÉTAPES", styles["section"]))
    story.append(hr())

    steps = [
        ("1.", "Tu choisis le niveau qui correspond à ton ambition (Good / Better / Best)"),
        ("2.", "Tu me confirmes par retour de mail le niveau choisi et tes éventuelles questions"),
        ("3.", "Je t'envoie le contrat (MSA + SOW spécifique au niveau choisi)"),
        ("4.", "Signature & versement du premier acompte"),
        ("5.", "On démarre — kickoff sous 7 jours"),
    ]
    for num, txt in steps:
        story.append(Paragraph(
            f"<font color='#C46B3D'><b>{num}</b></font> &nbsp; {txt}",
            styles["body_left"],
        ))

    # Signature
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "Pour démarrer cette collaboration, il te suffit de signer ce document et de me le retourner par mail. "
        "Je suis disponible pour tout échange préalable.",
        styles["body"],
    ))

    story.append(Spacer(1, 8 * mm))
    sig_rows = [["Pour LES GRIOTS", "Pour le Client"],
                [f"{LES_GRIOTS['representant_nom']}\n{LES_GRIOTS['representant_titre']}\n{LES_GRIOTS['email']}", ""]]
    sig_tbl = Table(sig_rows, colWidths=[(W - 2 * MARGIN) / 2 - 4 * mm, (W - 2 * MARGIN) / 2 - 4 * mm], rowHeights=[10 * mm, 30 * mm])
    sig_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(sig_tbl)

    return story


def ParagraphStyleSimple(size, color, bold=False):
    """Helper pour créer un ParagraphStyle inline."""
    from reportlab.lib.styles import ParagraphStyle
    return ParagraphStyle(
        f"s{size}_{'b' if bold else 'r'}",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=size * 1.3,
        textColor=color,
        spaceAfter=2,
    )


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)

    project = payload.get("project") or {}
    client = payload.get("client") or {}
    pname = safe(project.get("name"), "Projet")
    ref = safe(project.get("code"), "PROP-DRAFT")
    cname = safe(client.get("company") or project.get("client"), "Client")
    date_str = fmt_date_fr(None)

    buf = io.BytesIO()
    # Cover landscape, content portrait — mixed templates
    doc = BaseDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 4 * mm, bottomMargin=MARGIN,
        title=f"Proposal — {pname}",
        author="LES GRIOTS",
    )

    # Frame pour cover landscape
    cover_frame = Frame(
        0, 0, LW, LH,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )
    content_frame = Frame(
        MARGIN, MARGIN,
        W - 2 * MARGIN, H - 2 * MARGIN - 8 * mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    def on_cover(canvas, doc):
        proposal_cover(canvas, doc, pname, cname, ref, date_str)

    def on_content(canvas, doc):
        page_header_simple(canvas, doc, pname)

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], pagesize=(LW, LH), onPage=on_cover),
        PageTemplate(id="content", frames=[content_frame], pagesize=(W, H), onPage=on_content),
    ])

    story = [PageBreak()]  # Force passage de cover à content
    # Override : passer au template content après la cover
    from reportlab.platypus.doctemplate import NextPageTemplate
    story = [
        Spacer(1, 1),  # cover (template auto)
        NextPageTemplate("content"),
        PageBreak(),
    ]
    story.extend(build_proposal(payload))

    doc.build(story)
    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

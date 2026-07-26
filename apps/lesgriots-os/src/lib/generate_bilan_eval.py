#!/usr/bin/env python3
"""
LES GRIOTS — Bilan d'Évaluation PDF (Qualiopi)
Synthèse des évaluations à chaud et à froid pour une session.
Charte graphique : beige (#F5F0EB), gold (#D4A843), Courier monospace.

Usage: echo '<json>' | python3 generate_bilan_eval.py
"""
import sys, json, io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY

W, H = A4
MARGIN = 22 * mm
BK = colors.black
LGRAY = colors.HexColor("#999999")
BEIGE = colors.HexColor("#F5F0EB")
GOLD = colors.HexColor("#D4A843")
ROW_ALT = colors.HexColor("#EDE8E2")


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


def safe(v, fb=""):
    if v is None: return fb
    s = str(v).strip()
    return s if s else fb


def fmt_date(d):
    if not d: return ""
    try:
        MOIS = ["janvier","fevrier","mars","avril","mai","juin",
                "juillet","aout","septembre","octobre","novembre","decembre"]
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} {MOIS[dt.month-1]} {dt.year}"
    except: return str(d)


def _styles():
    return {
        "title": ParagraphStyle("bt", fontName="Courier-Bold", fontSize=18, textColor=BK, leading=22, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("bst", fontName="Courier-Bold", fontSize=12, textColor=BK, leading=16, alignment=TA_CENTER),
        "h2": ParagraphStyle("bh2", fontName="Courier-Bold", fontSize=11, textColor=BK, leading=14, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("bb", fontName="Courier", fontSize=9, textColor=BK, leading=13),
        "body_b": ParagraphStyle("bbb", fontName="Courier-Bold", fontSize=9, textColor=BK, leading=13),
        "small": ParagraphStyle("bs", fontName="Courier", fontSize=8, textColor=BK, leading=11),
        "th": ParagraphStyle("bth", fontName="Courier-Bold", fontSize=8, textColor=BK, leading=10, alignment=TA_CENTER),
        "tc": ParagraphStyle("btc", fontName="Courier", fontSize=9, textColor=BK, leading=12),
        "tc_c": ParagraphStyle("btcc", fontName="Courier-Bold", fontSize=9, textColor=BK, leading=12, alignment=TA_CENTER),
        "info_label": ParagraphStyle("bil", fontName="Courier-Bold", fontSize=8, textColor=LGRAY, leading=10),
        "info_value": ParagraphStyle("biv", fontName="Courier", fontSize=9, textColor=BK, leading=13),
        "legend": ParagraphStyle("blg", fontName="Courier", fontSize=7, textColor=LGRAY, leading=9),
        "score_big": ParagraphStyle("bsb", fontName="Courier-Bold", fontSize=24, textColor=GOLD, leading=28, alignment=TA_CENTER),
    }


QUESTIONS = {
    "satisfaction": [
        "Attentes", "Contenu adapte", "Methodes efficaces", "Maitrise formateur",
        "Ecoute formateur", "Supports qualite", "Organisation", "Rythme", "Recommandation"
    ],
    "froid": [
        "Utilisation competences", "Impact pratique", "Autonomie",
        "Pertinence", "Transmission", "Objectifs pro", "Approfondissement"
    ],
    "positionnement": [
        "Connaissance sujet", "Maitrise outils", "Experience pratique", "Autonomie"
    ],
    "acquis": [
        "Concepts cles", "Reproduction exercices", "Maitrise outils", "Objectifs atteints"
    ],
}


def generate(data):
    S = _styles()
    buf = io.BytesIO()
    cw = W - 2 * MARGIN

    header_state = {"left": "LA GRIOTHEQUE · BILAN EVALUATIONS", "right": ""}

    company = safe(data.get("companyName"), "LES GRIOTS")
    siret = safe(data.get("siret"), "902 628 684 00018")
    nda = safe(data.get("nda"), "28 76 07471 76")
    footer = f"{company} — SASU au capital de 1 000 € — SIRET {siret} — NDA {nda}"

    formation = safe(data.get("formationTitle"), "Formation")
    start = safe(data.get("startDate"))
    end = safe(data.get("endDate"))
    eval_type = safe(data.get("evalType"), "satisfaction")
    evals = data.get("evaluations") or []

    year = datetime.now().year
    right_hdr = f"{formation.upper()}\n(c){year} {company}"

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BEIGE)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        canvas.setFont("Courier-Bold", 8)
        canvas.setFillColor(BK)
        canvas.drawString(MARGIN, H - 14*mm, header_state.get("left",""))
        rt = header_state.get("right","")
        if rt:
            canvas.setFont("Courier", 7)
            for i, line in enumerate(rt.split("\n")):
                canvas.drawRightString(W-MARGIN, H-14*mm - i*9, line)
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, H-17*mm, W-MARGIN, H-17*mm)
        canvas.setFont("Courier", 6)
        canvas.setFillColor(LGRAY)
        canvas.drawCentredString(W/2, 12*mm, footer)
        canvas.drawRightString(W-MARGIN, 12*mm, f"{doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=20*mm)
    frame = Frame(MARGIN, 20*mm, cw, H-MARGIN-24*mm, id="main")
    doc.addPageTemplates([PageTemplate(id="bilan", frames=[frame], onPage=draw_page)])

    story = []
    header_state["right"] = right_hdr

    # Title
    story.append(Spacer(1, 4*mm))
    type_labels = {"satisfaction": "A CHAUD", "froid": "A FROID", "positionnement": "POSITIONNEMENT", "acquis": "ACQUIS"}
    story.append(Paragraph(f"BILAN D'EVALUATION {type_labels.get(eval_type, eval_type.upper())}", S["title"]))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(formation, S["subtitle"]))
    story.append(Spacer(1, 6*mm))

    # Info block
    dates_str = f"Du {fmt_date(start)} au {fmt_date(end)}" if start and end else fmt_date(start)
    info = [
        ["FORMATION", formation],
        ["DATES", dates_str],
        ["TYPE", type_labels.get(eval_type, eval_type)],
        ["NB REPONDANTS", f"{len(evals)} apprenant{'s' if len(evals)>1 else ''}"],
        ["DATE DU BILAN", fmt_date(datetime.now().strftime("%Y-%m-%d"))],
    ]
    info_data = [[Paragraph(l, S["info_label"]), Paragraph(v, S["info_value"])] for l, v in info]
    t = Table(info_data, colWidths=[cw*0.28, cw*0.72])
    t.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LINEBELOW",(0,0),(-1,-2),0.3,colors.HexColor("#DDD")),
        ("LEFTPADDING",(0,0),(0,-1),0),
    ]))
    story.append(t)
    story.append(Spacer(1, 8*mm))

    if not evals:
        story.append(Paragraph("Aucune evaluation enregistree pour ce type.", S["body"]))
        doc.build(story)
        return buf.getvalue()

    # Compute averages per question
    questions = QUESTIONS.get(eval_type, QUESTIONS["satisfaction"])
    q_totals = [0.0] * len(questions)
    q_counts = [0] * len(questions)
    scores = []
    comments_list = []

    for ev in evals:
        if ev.get("score") is not None:
            scores.append(float(ev["score"]))
        resp = ev.get("responses") or ev.get("comments_parsed") or {}
        if isinstance(resp, str):
            try: resp = json.loads(resp)
            except: resp = {}
        for qi in range(len(questions)):
            val = resp.get(f"q{qi}")
            if val is not None and isinstance(val, (int, float)):
                q_totals[qi] += val
                q_counts[qi] += 1
        comment = resp.get("_comment") or ""
        if not comment and isinstance(ev.get("comments"), str) and not ev["comments"].startswith("{"):
            comment = ev["comments"]
        if comment:
            name = safe(ev.get("stagiaireName"), "Apprenant")
            comments_list.append(f"{name} : {comment}")

    # Global score
    global_avg = sum(scores) / len(scores) if scores else 0
    story.append(Paragraph("SCORE GLOBAL", S["h2"]))
    story.append(Spacer(1, 2*mm))

    score_display = f"{global_avg:.1f} / 10"
    story.append(Paragraph(score_display, S["score_big"]))
    story.append(Spacer(1, 6*mm))

    # Results per question
    story.append(Paragraph("RESULTATS PAR CRITERE", S["h2"]))
    story.append(Spacer(1, 3*mm))

    header_row = [
        Paragraph("CRITERE", S["th"]),
        Paragraph("MOY.", S["th"]),
        Paragraph("REPONSES", S["th"]),
        Paragraph("BARRE", S["th"]),
    ]
    table_data = [header_row]
    for qi, q_label in enumerate(questions):
        avg = q_totals[qi] / q_counts[qi] if q_counts[qi] > 0 else 0
        pct = avg / 5.0 * 100
        bar_text = f"{'█' * int(avg)} {'░' * (5 - int(avg))}  {avg:.1f}/5"
        table_data.append([
            Paragraph(q_label, S["tc"]),
            Paragraph(f"{avg:.1f}", S["tc_c"]),
            Paragraph(str(q_counts[qi]), S["tc_c"]),
            Paragraph(bar_text, S["tc"]),
        ])

    col_w = [cw*0.35, cw*0.12, cw*0.13, cw*0.40]
    qt = Table(table_data, colWidths=col_w)
    style = [
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("BACKGROUND",(0,0),(-1,0), GOLD),
        ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#CCC")),
        ("BOX",(0,0),(-1,-1),0.6,colors.HexColor("#AAA")),
        ("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]
    for ri in range(1, len(table_data)):
        if ri % 2 == 0:
            style.append(("BACKGROUND",(0,ri),(-1,ri), ROW_ALT))
    qt.setStyle(TableStyle(style))
    story.append(qt)
    story.append(Spacer(1, 8*mm))

    # Individual results
    story.append(Paragraph("DETAIL PAR APPRENANT", S["h2"]))
    story.append(Spacer(1, 3*mm))

    ind_header = [
        Paragraph("APPRENANT", S["th"]),
        Paragraph("SCORE", S["th"]),
    ] + [Paragraph(f"Q{i+1}", S["th"]) for i in range(len(questions))]

    ind_data = [ind_header]
    for ev in evals:
        name = safe(ev.get("stagiaireName"), "—")
        score = f"{ev['score']:.1f}" if ev.get("score") is not None else "—"
        resp = ev.get("responses") or {}
        if isinstance(resp, str):
            try: resp = json.loads(resp)
            except: resp = {}
        row = [Paragraph(name, S["tc"]), Paragraph(score, S["tc_c"])]
        for qi in range(len(questions)):
            val = resp.get(f"q{qi}")
            row.append(Paragraph(str(val) if val is not None else "—", S["tc_c"]))
        ind_data.append(row)

    n_q = len(questions)
    q_col = max(0.04, (cw * 0.52) / max(n_q, 1))
    ind_widths = [cw * 0.30, cw * 0.10] + [q_col] * n_q
    # Adjust to fit page width
    total = sum(ind_widths)
    if total > cw:
        factor = cw / total
        ind_widths = [w * factor for w in ind_widths]

    it = Table(ind_data, colWidths=ind_widths)
    istyle = [
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("BACKGROUND",(0,0),(-1,0), GOLD),
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#CCC")),
        ("BOX",(0,0),(-1,-1),0.5,colors.HexColor("#AAA")),
        ("LEFTPADDING",(0,0),(-1,-1),3),
        ("RIGHTPADDING",(0,0),(-1,-1),3),
        ("TOPPADDING",(0,0),(-1,-1),3),
        ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("FONTSIZE",(0,0),(-1,-1),7),
    ]
    for ri in range(1, len(ind_data)):
        if ri % 2 == 0:
            istyle.append(("BACKGROUND",(0,ri),(-1,ri), ROW_ALT))
    it.setStyle(TableStyle(istyle))
    story.append(it)
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("Q1-Q" + str(n_q) + " = notes sur 5 par critere", S["legend"]))

    # Comments
    if comments_list:
        story.append(Spacer(1, 8*mm))
        story.append(Paragraph("COMMENTAIRES LIBRES", S["h2"]))
        story.append(Spacer(1, 3*mm))
        for c in comments_list:
            story.append(Paragraph(f"• {c}", S["body"]))
            story.append(Spacer(1, 2*mm))

    # Signature
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph("Responsable pedagogique :", S["body_b"]))
    story.append(Spacer(1, 15*mm))
    sig_t = Table(
        [["Fait a :", "Le :", "Signature :"]],
        colWidths=[cw*0.30, cw*0.30, cw*0.40]
    )
    sig_t.setStyle(TableStyle([
        ("LINEBELOW",(0,0),(-1,0),0.3,LGRAY),
        ("BOTTOMPADDING",(0,0),(-1,0),12*mm),
    ]))
    story.append(sig_t)

    doc.build(story)
    return buf.getvalue()


if __name__ == "__main__":
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON parse error: {e}\n")
        sys.exit(1)
    pdf_bytes = generate(data)
    sys.stdout.buffer.write(pdf_bytes)

#!/usr/bin/env python3
"""
LES GRIOTS — Générateur de documents Qualiopi
Pack complet : Programme, Convention, Convocation, Émargement, Attestation, Certificat

Usage: echo '<json>' | python3 generate_documents.py <doc_type>
doc_type: programme | convention | convocation | emargement | attestation | certificat
Outputs PDF to stdout.
"""
import sys, json, io, locale
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

# ── COULEURS LES GRIOTS ─────────────────────────────────────────────────────
GOLD   = colors.HexColor("#D4A843")
DARK   = colors.HexColor("#111111")
GRAY   = colors.HexColor("#555555")
LGRAY  = colors.HexColor("#AAAAAA")
WHITE  = colors.white

W, H = A4
MARGIN = 20 * mm

# ── STYLES ───────────────────────────────────────────────────────────────────
def S():
    return {
        "logo": ParagraphStyle("logo", fontName="Helvetica-Bold", fontSize=18, textColor=DARK, leading=22),
        "logo_sub": ParagraphStyle("logo_sub", fontName="Helvetica", fontSize=7, textColor=LGRAY, leading=9),
        "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22, textColor=DARK, leading=26, spaceAfter=2),
        "subtitle": ParagraphStyle("subtitle", fontName="Helvetica", fontSize=10, textColor=GRAY, leading=14),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=11, textColor=DARK, leading=15, spaceBefore=10, spaceAfter=4),
        "section_gold": ParagraphStyle("section_gold", fontName="Helvetica-Bold", fontSize=7, textColor=LGRAY, leading=10, letterSpacing=1.5, spaceBefore=6, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9, textColor=DARK, leading=13),
        "body_bold": ParagraphStyle("body_bold", fontName="Helvetica-Bold", fontSize=9, textColor=DARK, leading=13),
        "body_italic": ParagraphStyle("body_italic", fontName="Helvetica-Oblique", fontSize=9, textColor=GRAY, leading=13),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=GRAY, leading=11),
        "small_bold": ParagraphStyle("small_bold", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY, leading=11),
        "th": ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, leading=11),
        "tc": ParagraphStyle("tc", fontName="Helvetica", fontSize=8, textColor=DARK, leading=11),
        "tc_bold": ParagraphStyle("tc_bold", fontName="Helvetica-Bold", fontSize=8, textColor=DARK, leading=11),
        "tc_center": ParagraphStyle("tc_center", fontName="Helvetica", fontSize=8, textColor=DARK, leading=11, alignment=TA_CENTER),
        "footer": ParagraphStyle("footer", fontName="Helvetica", fontSize=6, textColor=LGRAY, leading=8, alignment=TA_CENTER),
        "big_center": ParagraphStyle("big_center", fontName="Helvetica-Bold", fontSize=14, textColor=DARK, leading=18, alignment=TA_CENTER),
    }

# ── HELPERS ──────────────────────────────────────────────────────────────────
def fmt_date(d):
    if not d: return "—"
    try:
        ds = str(d).split("T")[0].split(" ")[0]
        dt = datetime.strptime(ds, "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except:
        return str(d)

def fmt_duration(hours, days):
    parts = []
    if days: parts.append(f"{days} jour{'s' if float(days) > 1 else ''}")
    if hours: parts.append(f"{hours}h")
    return " — ".join(parts) if parts else "—"

def safe(val, default="—"):
    return str(val).strip() if val else default

def parse_json_array(val):
    if isinstance(val, list): return val
    try: return json.loads(val or "[]")
    except: return []

def header_block(s, data, doc_title, doc_subtitle=""):
    """Common header: company logo + document title."""
    co_name = safe(data.get("companyName", "LES GRIOTS"))
    company_info = [
        Paragraph(f'<font color="#D4A843">{co_name}</font>', s["logo"]),
        Paragraph("SASU — Organisme de formation", s["logo_sub"]),
        Spacer(1, 4),
        Paragraph("NDA : " + safe(data.get("nda", ""), "en cours") + " | SIRET : " + safe(data.get("siret", ""), "—"), s["small"]),
    ]
    title_info = [
        Paragraph(doc_title, s["title"]),
    ]
    if doc_subtitle:
        title_info.append(Paragraph(doc_subtitle, s["subtitle"]))

    t = Table([[company_info, title_info]], colWidths=[W - 2*MARGIN - 65*mm, 65*mm])
    t.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("ALIGN", (1,0), (1,0), "RIGHT")]))
    return [t, Spacer(1, 4*mm), HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=6*mm)]

def footer_block(s, data):
    return [
        Spacer(1, 10*mm),
        HRFlowable(width="100%", thickness=0.5, color=LGRAY, spaceAfter=3*mm),
        Paragraph(
            f"{safe(data.get('companyName','LES GRIOTS'))} SASU — {safe(data.get('address',''))} {safe(data.get('postalCode',''))} {safe(data.get('city',''))} — "
            f"SIRET : {safe(data.get('siret',''))} — {safe(data.get('email',''))}",
            s["footer"]
        ),
    ]

def signature_block(s, left_label="L'organisme de formation", right_label="Le stagiaire / Le client"):
    sig = Table(
        [[Paragraph(f"<b>{left_label}</b><br/><br/><br/><br/><br/>Date et signature :", s["small"]),
          Paragraph(f"<b>{right_label}</b><br/><br/><br/><br/><br/>Date et signature :", s["small"])]],
        colWidths=[(W - 2*MARGIN)/2]*2
    )
    sig.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP")]))
    return sig

# ═══════════════════════════════════════════════════════════════════════════════
# 1. PROGRAMME DE FORMATION
# ═══════════════════════════════════════════════════════════════════════════════
def gen_programme(data):
    s = S()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18*mm, bottomMargin=18*mm, title="Programme de formation")
    story = []
    f = data.get("formation", {})

    story += header_block(s, data, "PROGRAMME", f"Réf. {safe(f.get('code',''))}")

    # Titre formation
    story.append(Paragraph(safe(f.get("title", "Formation")), ParagraphStyle("ftitle", fontName="Helvetica-Bold", fontSize=16, textColor=DARK, leading=20, spaceAfter=6)))
    if f.get("description"):
        story.append(Paragraph(f["description"], s["body"]))
        story.append(Spacer(1, 4*mm))

    # Info box
    info_rows = [
        ["Durée", fmt_duration(f.get("duration_hours"), f.get("duration_days"))],
        ["Modalité", safe(f.get("modality", ""), "Présentiel").replace("presentiel", "Présentiel").replace("distanciel", "Distanciel").replace("hybride", "Hybride")],
        ["Tarif", f"{f.get('price_ht', 0)} € HT" if f.get("price_ht") else "—"],
        ["Participants max", str(f.get("max_participants", 12))],
        ["Niveau", safe(f.get("level", "")).replace("debutant","Débutant").replace("intermediaire","Intermédiaire").replace("avance","Avancé") or "Tous niveaux"],
    ]
    if f.get("certification"): info_rows.append(["Certification", f["certification"]])
    if f.get("delais_acces"): info_rows.append(["Délais d'accès", f["delais_acces"]])

    t = Table([[Paragraph(r[0], s["small_bold"]), Paragraph(r[1], s["body"])] for r in info_rows],
              colWidths=[40*mm, W - 2*MARGIN - 40*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("LINEBELOW", (0,0), (-1,-2), 0.3, LGRAY),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    # Public visé
    if f.get("target_audience"):
        story.append(Paragraph("PUBLIC VISÉ", s["section_gold"]))
        story.append(Paragraph(f["target_audience"], s["body"]))
        story.append(Spacer(1, 3*mm))

    # Prérequis
    story.append(Paragraph("PRÉREQUIS", s["section_gold"]))
    story.append(Paragraph(safe(f.get("prerequisites", ""), "Aucun prérequis spécifique."), s["body"]))
    story.append(Spacer(1, 3*mm))

    # Objectifs pédagogiques
    objectives = parse_json_array(f.get("objectives"))
    if objectives:
        story.append(Paragraph("OBJECTIFS PÉDAGOGIQUES", s["section_gold"]))
        for i, obj in enumerate(objectives, 1):
            story.append(Paragraph(f"<b>{i}.</b> {obj}", s["body"]))
        story.append(Spacer(1, 3*mm))

    # Modules
    modules = data.get("modules", [])
    if modules:
        story.append(Paragraph("CONTENU DÉTAILLÉ", s["section_gold"]))
        for m in modules:
            story.append(Paragraph(f"<b>{safe(m.get('title','Module'))}</b>" + (f" — {m['duration_hours']}h" if m.get("duration_hours") else ""), s["body_bold"]))
            if m.get("description"):
                story.append(Paragraph(m["description"], s["body"]))
            m_objectives = parse_json_array(m.get("objectives"))
            for obj in m_objectives:
                story.append(Paragraph(f"  • {obj}", s["body"]))
            story.append(Spacer(1, 2*mm))

    # Méthodes pédagogiques
    if f.get("modalites_pedagogiques"):
        story.append(Paragraph("MODALITÉS PÉDAGOGIQUES", s["section_gold"]))
        story.append(Paragraph(f["modalites_pedagogiques"], s["body"]))
        story.append(Spacer(1, 3*mm))

    # Moyens matériels
    if f.get("moyens_materiels"):
        story.append(Paragraph("MOYENS TECHNIQUES ET PÉDAGOGIQUES", s["section_gold"]))
        story.append(Paragraph(f["moyens_materiels"], s["body"]))
        story.append(Spacer(1, 3*mm))

    # Évaluation
    eval_methods = parse_json_array(f.get("evaluation_methods"))
    if eval_methods:
        story.append(Paragraph("MODALITÉS D'ÉVALUATION", s["section_gold"]))
        for ev in eval_methods:
            story.append(Paragraph(f"• {ev}", s["body"]))
        story.append(Spacer(1, 3*mm))

    # Accessibilité
    if f.get("accessibility"):
        story.append(Paragraph("ACCESSIBILITÉ", s["section_gold"]))
        story.append(Paragraph(f["accessibility"], s["body"]))

    story += footer_block(s, data)
    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CONVENTION DE FORMATION — Modèle Ecohesens (noir/blanc, sobre)
# ═══════════════════════════════════════════════════════════════════════════════
def gen_convention(data):
    """
    Convention de formation professionnelle — modèle fidèle Ecohesens.
    Noir et blanc, header/footer récurrent, 11 articles + Annexe 1 Programme + Annexe 2 RI.
    """
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
    from reportlab.lib.enums import TA_JUSTIFY
    buf = io.BytesIO()
    session = data.get("session", {})
    f = data.get("formation", {})
    apprenants = data.get("apprenants", [])
    modules = data.get("modules", [])

    # ── Styles noir/blanc sobres (modèle Ecohesens) ──
    BK = colors.black
    s_h1 = ParagraphStyle("cv_h1", fontName="Helvetica-Bold", fontSize=14, textColor=BK, leading=18, alignment=TA_CENTER, spaceBefore=6, spaceAfter=2)
    s_h2 = ParagraphStyle("cv_h2", fontName="Helvetica-Bold", fontSize=12, textColor=BK, leading=16, spaceBefore=14, spaceAfter=4)
    s_h3 = ParagraphStyle("cv_h3", fontName="Helvetica-Bold", fontSize=10, textColor=BK, leading=13, spaceBefore=8, spaceAfter=2)
    s_body = ParagraphStyle("cv_body", fontName="Helvetica", fontSize=9, textColor=BK, leading=13, alignment=TA_JUSTIFY)
    s_body_b = ParagraphStyle("cv_body_b", fontName="Helvetica-Bold", fontSize=9, textColor=BK, leading=13)
    s_body_i = ParagraphStyle("cv_body_i", fontName="Helvetica-Oblique", fontSize=9, textColor=BK, leading=13)
    s_small = ParagraphStyle("cv_small", fontName="Helvetica", fontSize=8, textColor=BK, leading=11)
    s_small_b = ParagraphStyle("cv_small_b", fontName="Helvetica-Bold", fontSize=8, textColor=BK, leading=11)
    s_footer = ParagraphStyle("cv_footer", fontName="Helvetica-Bold", fontSize=7, textColor=BK, leading=9, alignment=TA_CENTER)
    s_footer_it = ParagraphStyle("cv_footer_it", fontName="Helvetica-Oblique", fontSize=7, textColor=BK, leading=9, alignment=TA_CENTER)
    s_tc = ParagraphStyle("cv_tc", fontName="Helvetica", fontSize=9, textColor=BK, leading=12)
    s_tc_b = ParagraphStyle("cv_tc_b", fontName="Helvetica-Bold", fontSize=9, textColor=BK, leading=12)
    s_tc_r = ParagraphStyle("cv_tc_r", fontName="Helvetica", fontSize=9, textColor=BK, leading=12, alignment=TA_RIGHT)
    s_tc_br = ParagraphStyle("cv_tc_br", fontName="Helvetica-Bold", fontSize=11, textColor=BK, leading=14, alignment=TA_LEFT)

    # ── Variables ──
    client_company = safe(session.get("client_company", ""), "Le Bénéficiaire")
    client_siret = safe(session.get("client_siret", ""), "")
    client_email = safe(session.get("client_email", ""), "")
    client_address = safe(session.get("client_address", ""), "")
    client_postal_code = safe(session.get("client_postal_code", ""), "")
    client_city = safe(session.get("client_city", ""), "")
    client_repr_first = safe(session.get("client_repr_first", ""), "")
    client_repr_last = safe(session.get("client_repr_last", ""), "")
    client_repr_role = safe(session.get("client_repr_role", ""), "Représentant légal")
    modality_str = safe(session.get("modality","presentiel")).replace("presentiel","Présentiel").replace("distanciel","Distanciel").replace("hybride","Hybride")
    location_str = safe(session.get("location",""), safe(session.get("adresse",""), "À définir"))
    horaire_str = safe(session.get("horaire",""), "")
    nb_apprenants = len(apprenants) if apprenants else 0
    tarif = session.get("tarif") or f.get("price_ht") or 0
    try:
        tarif_float = float(tarif)
    except:
        tarif_float = 0
    total_ht = tarif_float * (nb_apprenants or 1)

    OF_NAME = safe(data.get("companyName","LES GRIOTS"))
    OF_ADDR = safe(data.get("address","80 avenue du 8 mai 1945"))
    OF_CP = safe(data.get("postalCode","93100"))
    OF_CITY = safe(data.get("city","Montreuil"))
    OF_SIRET = safe(data.get("siret","90262868400018"))
    OF_NDA = safe(data.get("nda","28760747176"))
    OF_EMAIL = safe(data.get("email","contact@lesgriots.com"))
    OF_PHONE = safe(data.get("phone","06 XX XX XX XX"))
    OF_REPR = safe(data.get("representantName","COULIBALY Moustapha"))
    OF_REPR_TITLE = safe(data.get("representantTitle","Président"))
    OF_TRIBUNAL = safe(data.get("tribunalVille","Bobigny"))

    # ── Header/footer callbacks ──
    page_count_holder = [0]  # mutable to track total

    def _header_footer(canvas, doc_obj):
        canvas.saveState()
        # Header — top left
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(MARGIN, H - 14*mm, OF_NAME)
        canvas.setFont("Helvetica", 8)
        y = H - 19*mm
        for line in [OF_ADDR, f"{OF_CP}  {OF_CITY}", f"Email : {OF_EMAIL}", f"Tel : {OF_PHONE}"]:
            canvas.drawString(MARGIN, y, line)
            y -= 3.5*mm

        # Footer — 3 centered lines
        canvas.setFont("Helvetica-Bold", 7)
        canvas.drawCentredString(W/2, 16*mm,
            f"{OF_NAME} | {OF_ADDR} {OF_CP} | Numéro SIRET : {OF_SIRET} |")
        canvas.setFont("Helvetica-Oblique", 7)
        canvas.drawCentredString(W/2, 12.5*mm,
            f"Numéro de déclaration d'activité : {OF_NDA}")
        canvas.drawCentredString(W/2, 9*mm,
            "Cet enregistrement ne vaut pas l'agrément de l'État.")

        # Page number — bottom right
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(W - MARGIN, 9*mm, f"Page {doc_obj.page}")

        canvas.restoreState()

    # ── Build doc with BaseDocTemplate ──
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
    frame = Frame(MARGIN, 22*mm, W - 2*MARGIN, H - 56*mm, id='main')
    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=38*mm, bottomMargin=22*mm,
                          title="Convention de formation professionnelle")
    doc.addPageTemplates([PageTemplate(id='convention', frames=frame, onPage=_header_footer)])
    story = []

    # ════════════════════════════════════════════════════════════════════════════
    # CONVENTION PRINCIPALE
    # ════════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph("<b>Convention de formation professionnelle</b>", s_h1))
    story.append(Paragraph("(Article L. 6353-1 du Code du Travail Décret N° 2018-1341 du 28 décembre 2018)", ParagraphStyle("cv_sub_center", fontName="Helvetica", fontSize=9, textColor=BK, leading=12, alignment=TA_CENTER)))
    story.append(Spacer(1, 8*mm))

    # Entre l'OF
    story.append(Paragraph(f"<b>Entre l'organisme de formation : {OF_NAME}</b>", s_h3))
    story.append(Paragraph(f"immatriculée au RCS de sous le numéro {OF_SIRET}", s_body))
    story.append(Paragraph(f"Dont le siège social est situé {OF_ADDR}  {OF_CP} {OF_CITY}.", s_body))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        f"Représentée aux fins des présentes par {OF_REPR} en sa qualité de {OF_REPR_TITLE}, dûment habilité(e).", s_body))
    story.append(Paragraph(f"Déclaration d'activité n°{OF_NDA}.", s_body))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>Ci-après dénommée « l'Organisme de Formation »</b>", s_body_b))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("<b>D'une part</b>", s_body_b))
    story.append(Spacer(1, 4*mm))

    # Et le bénéficiaire
    story.append(Paragraph(f"<b>Et {client_company}</b>", s_h3))
    rcs_city = client_city if client_city != "—" else ""
    siret_line = f"immatriculée au RCS de {rcs_city} sous le numéro {client_siret}" if client_siret and client_siret != "—" else ""
    addr_parts = [client_address, client_postal_code, client_city]
    addr_full = " ".join([p for p in addr_parts if p and p != "—"])
    if siret_line:
        story.append(Paragraph(
            f"{siret_line}" + (f" dont le siège social est situé {addr_full}." if addr_full else "."), s_body))
    elif addr_full:
        story.append(Paragraph(f"Dont le siège social est situé {addr_full}.", s_body))
    story.append(Spacer(1, 2*mm))
    # Représentant légal du client
    if client_repr_first and client_repr_first != "—":
        story.append(Paragraph(
            f"Représentée aux fins des présentes par {client_repr_first} {client_repr_last} en sa qualité de {client_repr_role}, dûment habilité(e).",
            s_body))
        story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>Ci-après dénommée « le Bénéficiaire »</b>", s_body_b))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph("<b>D'autre part</b>", s_body_b))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("<b>Ci-après individuellement ou collectivement désigné(s) la ou les « Partie(s) »</b>", s_body_b))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        "Il est conclu une convention de formation professionnelle conformément aux dispositions des articles "
        "L. 6311-1 à L. 6363-2 du Code du Travail, et également en application des dispositions du Livre III "
        "de la 6ème partie et des catégories prévues à l'article L6313.1 du Code du Travail relatif à la "
        "formation professionnelle continue tout au long de la vie.", s_body))
    story.append(Spacer(1, 6*mm))

    # ── 1. Objet de la convention ──
    story.append(Paragraph("1. Objet de la convention", s_h2))
    story.append(Paragraph(
        "Aux termes de la présente convention, l'Organisme de Formation s'engage à organiser l'action de formation suivante :", s_body))
    story.append(Spacer(1, 2*mm))
    session_name = f"{client_company} - {safe(f.get('title',''))}"
    story.append(Paragraph(session_name, s_body))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("Catégorie de l'action de formation (art. L6313-1 du Code du Travail) :", s_body))
    story.append(Paragraph("<b>Action de formation</b>", s_body_b))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("Objectifs : Perfectionnement, élargissement des compétences", s_body))
    story.append(Paragraph("Contenu de l'action de formation et moyens prévus : Annexe 1", s_body))
    story.append(Paragraph(f"Durée : <b>{safe(f.get('duration_hours',''))} heures ({safe(f.get('duration_days',''))} jours)</b>", s_body))
    story.append(Paragraph(f"Lieu de la formation : <b>{client_company} - {location_str}</b>", s_body))
    story.append(Paragraph(f"Effectifs formés : <b>{nb_apprenants}</b>", s_body))
    story.append(Spacer(1, 3*mm))

    # Dates table
    date_header = [
        [Paragraph("<b>Date</b>", s_tc_b), Paragraph("<b>Heure</b>", s_tc_b), Paragraph("<b>Lieu</b>", s_tc_b)]
    ]
    date_rows = date_header + [
        [Paragraph(f"du {fmt_date(session.get('start_date',''))} au {fmt_date(session.get('end_date',''))}", s_tc),
         Paragraph(horaire_str, s_tc), Paragraph(f"en {modality_str}", s_tc_r)],
        [Paragraph(f"le {fmt_date(session.get('start_date',''))}", s_tc),
         Paragraph("", s_tc), Paragraph(f"en {modality_str}", s_tc_r)],
        [Paragraph(f"le {fmt_date(session.get('end_date',''))}", s_tc),
         Paragraph("", s_tc), Paragraph(f"en {modality_str}", s_tc_r)],
    ]
    cw = W - 2*MARGIN
    t_dates = Table(date_rows, colWidths=[cw*0.5, cw*0.2, cw*0.3])
    t_dates.setStyle(TableStyle([
        ("LINEBELOW",(0,0),(-1,0),0.8,BK),
        ("LINEBELOW",(0,-1),(-1,-1),0.5,colors.HexColor("#999999")),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(t_dates)
    story.append(Spacer(1, 4*mm))

    # ── 2. Effectif formé ──
    story.append(Paragraph("2. Effectif formé", s_h2))
    story.append(Paragraph("Public visé au sens de l'article L 6313-3 du Code du Travail :", s_body))
    story.append(Paragraph(
        "• les actions de formation ont pour objet de permettre à toute personne sans qualification professionnelle "
        "ou sans contrat de travail d'accéder dans les meilleures conditions à un emploi<br/>"
        "• favoriser l'adaptation des travailleurs à leur poste de travail, à l'évolution des emplois ainsi que leur "
        "maintien dans l'emploi et de participer au développement des compétences en lien ou non avec leur poste de travail<br/>"
        "• réduire, pour les travailleurs dont l'emploi est menacé, les risques résultant d'une qualification inadaptée "
        "à l'évolution des techniques et des structures des entreprises<br/>"
        "• favoriser la mobilité professionnelle.", s_body))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("L'Organisme de Formation accueillera la/les personne(s) suivante(s) :", s_body))
    if apprenants:
        for a in apprenants:
            civ = safe(a.get("civilite",""), "")
            name = f"{civ} {safe(a.get('last_name',''))} {safe(a.get('first_name',''))}".strip()
            story.append(Paragraph(f"  • {name}", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 3. Dispositions financières ──
    story.append(Paragraph("3. Dispositions financières", s_h2))
    story.append(Paragraph(
        "En contrepartie de cette action de formation, le bénéficiaire (ou le financeur dans le cadre d'une "
        "subrogation de paiement) s'acquittera des coûts suivants qui couvrent l'intégralité des frais engagés "
        "par l'Organisme de Formation pour cette session :", s_body))
    story.append(Spacer(1, 2*mm))

    # Pricing table — simple Description | Prix
    price_rows = [[Paragraph("<b>Description</b>", s_tc_b), Paragraph("<b>Prix</b>", s_tc_br)]]
    for a in (apprenants if apprenants else [{"first_name":"Participant","last_name":""}]):
        price_rows.append([
            Paragraph("Formation", s_tc),
            Paragraph(f"{tarif_float:.2f}€", s_tc_r),
        ])
    t_price = Table(price_rows, colWidths=[cw*0.75, cw*0.25])
    t_price.setStyle(TableStyle([
        ("LINEBELOW",(0,0),(-1,0),0.8,BK),
        ("LINEBELOW",(0,-1),(-1,-1),0.5,colors.HexColor("#999999")),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(t_price)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("L'organisme de formation atteste être exonéré de TVA.", s_body))
    story.append(Paragraph(f"<b>TOTAL NET DE TAXES : {total_ht:.2f}€</b>",
        ParagraphStyle("cv_total", fontName="Helvetica-Bold", fontSize=12, textColor=BK, leading=16, spaceBefore=2, spaceAfter=4)))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("Il est précisé que conformément aux dispositions de l'article L.6353-6 du Code du travail :", s_body))
    story.append(Paragraph(
        "• le Prix de la formation ne pourra être facturé avant la fin du délai de rétractation tel que prévu "
        "à l'article 6 \"Délai de rétractation - dédit ou abandon\" ;<br/>"
        "• à l'issue du délai de rétractation, l'Organisme de Formation facturera 30% du prix de la formation au Bénéficiaire ;<br/>"
        "• les 70 % restant du prix de la formation seront payés par le Bénéficiaire selon l'échéancier suivant : "
        "paiement mensuel du montant sur le temps de la formation restant.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 4. Modalités de déroulement ──
    story.append(Paragraph("4. Modalités de déroulement (présentiel, à distance, mixte, en situation de travail) et de suivi", s_h2))
    story.append(Paragraph(f"La Formation s'effectue {modality_str}.", s_body))
    story.append(Paragraph(
        "Des feuilles de présence seront signées par les Stagiaires et le(s) formateur(s) par demi-journée de formation, "
        "l'objectif étant de justifier la réalisation de la Formation.", s_body))
    story.append(Paragraph(
        "L'appréciation des résultats se fera à travers la mise en œuvre QCM et/ou grilles d'évaluation et/ou "
        "travaux pratiques et/ou fiches d'évaluation et/ou mises en situation et/ou autre.", s_body))
    story.append(Paragraph(
        "Les moyens permettant l'évaluation des acquis sont plus amplement détaillés dans le programme de "
        "Formation fourni dans le programme (<b>Annexe 1</b>).", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 5. Moyens de sanction ──
    story.append(Paragraph("5. Moyens de sanction (diplôme, titre professionnel, certification, attestation de fin de formation ou autres)", s_h2))
    story.append(Paragraph(
        "À l'issue de la Formation, l'Organisme de Formation délivre au Stagiaire le en cas de réussite. "
        "Conformément à l'article L6353-5 du Code du travail, le Bénéficiaire peut se rétracter dans le délai "
        "de dix jours à compter de la signature de la présente convention, en adressant un courrier avec avis "
        f"de réception à l'adresse suivante : {OF_ADDR} {OF_CP} {OF_CITY} France.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 6. Dédit ou abandon ──
    story.append(Paragraph("6. Dédit ou abandon", s_h2))
    story.append(Paragraph(
        "En cas de dédit par le Bénéficiaire à moins de 11 jours ouvrés avant le début de l'action mentionnée "
        "à l'article 1, ou d'abandon en cours de Formation par un ou plusieurs Stagiaire(s), l'Organisme de "
        "Formation (i) remboursera sur le coût total, les sommes qu'il n'aura pas réellement dépensées ou "
        "engagées pour la réalisation de ladite action et/ou (ii) proposera une nouvelle date de Formation.", s_body))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "Le cas échéant, le Bénéficiaire s'engage au versement d'un montant de 20 % du coût total de la "
        "Formation à titre de dédommagement, cette somme ne pouvant faire l'objet d'un financement par fonds publics ou paritaires.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 7. Modalités de règlement ──
    story.append(Paragraph("7. Modalités de règlement", s_h2))
    story.append(Paragraph(
        "Le paiement sera dû en totalité à réception d'une facture émise par l'Organisme de Formation à destination du Bénéficiaire.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 8. Propriété intellectuelle ──
    story.append(Paragraph("8. Propriété intellectuelle", s_h2))
    story.append(Paragraph(
        "Les supports de formation, quelle qu'en soit la forme, et les contenus de toute nature (textes, images, "
        "visuels, musiques, logos, marques, base de données, etc.) exploités par l'Organisme de Formation dans "
        "le cadre de l'action de formation sont protégés par tous droits de propriété intellectuelle ou droits "
        "des producteurs de bases de données en vigueur. Tous désassemblages, décompilations, décryptages, "
        "extractions, réutilisations, copies et plus généralement, tous actes de reproduction, représentation, "
        "diffusion et utilisation de l'un quelconque de ces éléments, en tout ou partie, sans l'autorisation "
        "de l'Organisme de Formation sont strictement interdits et pourront faire l'objet de poursuites judiciaires.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 9. Données à caractère personnel ──
    story.append(Paragraph("9. Données à caractère personnel", s_h2))
    story.append(Paragraph(
        "L'Organisme de Formation pratique une politique de protection des données personnelles dont les "
        "caractéristiques sont explicitées dans la politique de confidentialité.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 10. Différends éventuels ──
    story.append(Paragraph("10. Différends éventuels", s_h2))
    story.append(Paragraph(
        f"Si une contestation ou un différend ne peuvent être réglés à l'amiable, le Tribunal de {OF_TRIBUNAL} "
        f"sera seul compétent pour régler le litige.", s_body))
    story.append(Spacer(1, 4*mm))

    # ── 11. Signature électronique ──
    story.append(Paragraph("11. Signature électronique", s_h2))
    story.append(Paragraph(
        "Il est entendu entre les Parties que la présente convention pourra être signée par tout moyen "
        "électronique, les Parties reconnaissant la fiabilité du procédé lui conférant ainsi la même "
        "valeur juridique qu'une signature manuscrite au sens de la loi.", s_body))
    story.append(Spacer(1, 4*mm))

    # Date en français
    _months_fr = {"January":"janvier","February":"février","March":"mars","April":"avril","May":"mai","June":"juin","July":"juillet","August":"août","September":"septembre","October":"octobre","November":"novembre","December":"décembre"}
    _date_str = datetime.now().strftime("%-d %B %Y")
    for en, fr in _months_fr.items():
        _date_str = _date_str.replace(en, fr)
    story.append(Paragraph(
        f"Document réalisé en 2 exemplaires à {OF_CITY}, le {_date_str}.",
        s_body))
    story.append(Spacer(1, 10*mm))

    # Signatures
    left_sig = f"Pour l'organisme de formation,<br/><b>{OF_NAME}</b><br/>{OF_REPR}"
    right_sig = f"Pour le bénéficiaire, {client_company},"
    if client_repr_first and client_repr_first != "—":
        right_sig += f"<br/>Par {client_repr_first} {client_repr_last}"
    sig = Table(
        [[Paragraph(left_sig, s_small),
          Paragraph(right_sig, ParagraphStyle("cv_sig_r", fontName="Helvetica", fontSize=8, textColor=BK, leading=11, alignment=TA_RIGHT))]],
        colWidths=[cw/2]*2
    )
    sig.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
    story.append(sig)
    story.append(Spacer(1, 20*mm))

    # ════════════════════════════════════════════════════════════════════════════
    # ANNEXE 1 — PROGRAMME DE FORMATION
    # ════════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("<b>Annexe 1 : Programme de formation</b>", s_h1))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(f"<b>Nom de la session : {client_company} - {safe(f.get('title',''))}</b>", s_body_b))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("<b>DURÉE ET LIEU DE FORMATION</b>", s_h3))
    story.append(Paragraph(f"  • <b>Durée en heures</b> : {safe(f.get('duration_hours',''))} heures", s_body))
    story.append(Paragraph(f"  • <b>Lieu</b> : {location_str}", s_body))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("<b>PUBLIC CONCERNÉ</b>", s_h3))
    target = safe(f.get("target_audience",""), "")
    if target:
        for line in target.split("\n"):
            if line.strip():
                story.append(Paragraph(f"  • {line.strip()}", s_body))
    else:
        story.append(Paragraph("  • Tout public", s_body))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("<b>PRÉREQUIS</b>", s_h3))
    prereq = safe(f.get("prerequisites",""), "Aucun pré-requis technique.")
    story.append(Paragraph(f"  • {prereq}", s_body))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<b>QUALITÉ ET INDICATEURS DE RÉSULTATS</b>", s_h3))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>ACCESSIBILITÉ</b>", s_h3))
    if f.get("accessibility"):
        story.append(Paragraph(f["accessibility"], s_body))
    story.append(Spacer(1, 3*mm))

    # Objectifs
    objectives = parse_json_array(f.get("objectives"))
    if objectives:
        story.append(Paragraph("<b>OBJECTIFS</b>", s_h3))
        for obj in objectives:
            story.append(Paragraph(f"  • {obj}", s_body))
        story.append(Spacer(1, 4*mm))

    # Contenu de la formation (modules)
    story.append(Paragraph("<b>CONTENU DE LA FORMATION</b>", s_h3))
    if modules:
        for m in modules:
            story.append(Paragraph(f"  • <b>{safe(m.get('title',''))}</b>", s_body_b))
            if m.get("description"):
                story.append(Paragraph(f"        {m['description']}", s_body))
            m_obj = parse_json_array(m.get("objectives"))
            for obj in m_obj:
                story.append(Paragraph(f"        • {obj}", s_body))
    story.append(Spacer(1, 4*mm))

    # Organisation de la formation
    story.append(Paragraph("<b>ORGANISATION DE LA FORMATION</b>", s_h3))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(f"  • <b>Équipe pédagogique :</b>", s_body_b))
    story.append(Paragraph(safe(session.get("formateur_name",""), "Moustapha Coulibaly"), s_body))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("  • <b>Ressources pédagogiques et techniques prévues :</b>", s_body_b))
    story.append(Paragraph("  • accueil des Stagiaires dans une salle dédiée à la formation,", s_body))
    story.append(Paragraph("  • fourniture des moyens techniques suivants :", s_body))
    story.append(Paragraph("  • fourniture des supports de formation :", s_body))
    if f.get("moyens_materiels"):
        for line in f["moyens_materiels"].split("\n"):
            if line.strip():
                story.append(Paragraph(f"        • {line.strip()}", s_body))
    if f.get("modalites_pedagogiques"):
        story.append(Spacer(1, 3*mm))
        story.append(Paragraph("<b>MODALITÉS PÉDAGOGIQUES</b>", s_h3))
        story.append(Paragraph(f["modalites_pedagogiques"], s_body))

    # ════════════════════════════════════════════════════════════════════════════
    # ANNEXE 2 — RÈGLEMENT INTÉRIEUR
    # ════════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("<b>Annexe 2 : Règlement Intérieur</b>", s_h1))
    story.append(Spacer(1, 6*mm))

    ri_articles = [
        ("Article 1 - Objet et champ d'application",
         "Conformément aux dispositions des articles L.6352-3, L.6352-4 et R.6352-1 à R.6352-15 du Code du Travail, "
         "le présent règlement a pour objet de déterminer les principales mesures applicables en matière de santé, "
         "de sécurité et de discipline aux stagiaires de l'organisme de formation, dénommé ci-après.\n"
         "Tout stagiaire doit respecter les termes du présent règlement durant toute la durée de l'action de formation.\n"
         "Toutefois, lorsque la formation se déroule dans une entreprise déjà dotée d'un règlement intérieur, "
         "les mesures de santé et de sécurité applicables aux stagiaires sont celles de ce règlement."),

        ("Article 2 - Hygiène et sécurité",
         "Chaque stagiaire doit veiller au respect des consignes générales et particulières en matière "
         "d'hygiène et de sécurité, sous peine de sanctions disciplinaires.\n"
         "<b>Propreté des locaux</b>\n"
         "Les stagiaires doivent maintenir en ordre et en état de propreté constante les locaux où se déroule "
         "la formation. À ce titre, il leur est interdit de manger dans les salles de cours.\n"
         "<b>Alcool et produits stupéfiants</b>\n"
         "L'introduction et la consommation de produits stupéfiants ou de boissons alcoolisées est strictement interdite. "
         "Il est également interdit de pénétrer ou de demeurer dans l'établissement en état d'ivresse ou sous "
         "l'emprise de produits stupéfiants.\n"
         "<b>Consignes de sécurité – Incendie</b>\n"
         "Les consignes d'incendie et notamment un plan de localisation des extincteurs et des issues de secours "
         "sont affichés dans les locaux de formation de manière à être connus des stagiaires.\n"
         "<b>Accident - déclaration</b>\n"
         "Tout accident ou incident survenu à l'occasion ou en cours de formation doit être immédiatement "
         "déclaré par le·la stagiaire accidenté·e ou les personnes témoins de l'accident, à l'organisme de formation.\n"
         "<b>Interdiction de fumer ou de vapoter</b>\n"
         "Il est interdit de fumer ou de vapoter dans les locaux de formation."),

        ("Article 3 – Horaires, absences et retards",
         "Les horaires de la formation seront communiqués aux stagiaires au préalable. Les stagiaires sont "
         "tenu·e·s de respecter ces horaires.\n"
         "Sauf autorisation express, les stagiaires ne peuvent pas s'absenter pendant les heures de formation. "
         "L'émargement devra être fait au début ou à la fin de chaque atelier selon la pratique de l'organisme de formation.\n"
         "En cas d'absence ou retard, les stagiaires en informent dans les plus brefs délais l'organisme de "
         "formation et s'en justifier.\n"
         "De plus, pour les stagiaires dont le coût de la formation est pris en charge par un financeur externe "
         "(OPCO, Pôle Emploi, Caisse des Dépôts), les absences non justifiées entraînent une retenue sur la "
         "prise en charge du coût de la formation, proportionnelle à la durée de l'absence."),

        ("Article 4 - Comportement",
         "Il est demandé à tout stagiaire d'avoir un comportement garantissant le respect des règles "
         "élémentaires de savoir vivre, de savoir être en collectivité et le bon déroulement des formations.\n"
         "À titre d'exemple, il est formellement interdit aux stagiaires :\n"
         "- De modifier, d'utiliser à une fin tierce ou de diffuser les supports de formation sans l'autorisation "
         "express de l'organisme de formation ;\n"
         "- De modifier les réglages des paramètres de l'ordinateur ;\n"
         "- D'utiliser leurs téléphones portables durant les sessions de formation à des fins autres que celles de la formation."),

        ("Article 5 : Accès aux locaux",
         "Les stagiaires ont accès aux locaux où se déroule la formation exclusivement pour suivre le stage "
         "auquel ils·elles sont inscrit·e·s. Ils·elles ne peuvent y entrer ou y demeurer à d'autres fins, sauf autorisation.\n"
         "Il leur est interdit d'être accompagné·e·s de personnes non inscrites au stage."),

        ("Article 6 - Utilisation du matériel",
         "Tout·e stagiaire est tenu·e de conserver en bon état le matériel et la documentation mis à la "
         "disposition par l'organisme de formation.\n"
         "L'utilisation du matériel à d'autres fins, notamment personnelles est interdite, sauf pour le "
         "matériel mis à disposition à cet effet.\n"
         "La documentation pédagogique remise lors des sessions de formation est protégée au titre des droits "
         "d'auteur et ne peut être réutilisée que pour un strict usage personnel.\n"
         "Il est formellement interdit pour le·la stagiaire, sauf dérogation expresse, d'enregistrer ou de "
         "filmer les sessions de formation."),

        ("Article 7 : Vol ou dégradation des biens personnels des stagiaires",
         "L'organisme de formation décline toute responsabilité en cas de perte, vol ou détérioration des "
         "objets personnels de toute nature déposés par les stagiaires dans les locaux de formation."),

        ("Article 8 - Sanctions",
         "Tout agissement considéré comme fautif pourra, en fonction de sa gravité, faire l'objet de l'une ou "
         "l'autre des sanctions ci-après, sans nécessairement suivre l'ordre de ce classement :\n"
         "- rappel à l'ordre ;\n"
         "- avertissement écrit ;\n"
         "- blâme ;\n"
         "- exclusion temporaire de la formation ;\n"
         "- exclusion définitive de la formation.\n\n"
         "L'organisme de formation informe de la sanction prise le cas échéant : l'employeur du·de la stagiaire "
         "ou l'administration de l'agent stagiaire ; et/ou le financeur du stage."),

        ("Article 9 - Procédure disciplinaire",
         "En application de l'article R.6352-4 du Code du Travail, « aucune sanction ne peut être prononcée "
         "à l'encontre du stagiaire sans que celui-ci ait été informé au préalable des griefs retenus contre lui ».\n"
         "Lorsque l'organisme de formation envisage une prise de sanction, il convoque le la stagiaire par "
         "lettre recommandée avec accusé de réception ou remise à l'intéressé contre décharge en lui indiquant "
         "l'objet de la convocation, la date, l'heure et le lieu de l'entretien, sauf si la sanction envisagée "
         "n'a pas d'incidence sur la présence du stagiaire pour la suite de la formation.\n"
         "La sanction ne peut intervenir moins d'un jour franc ni plus de 15 jours après l'entretien où, le cas "
         "échéant, après avis de la Commission de discipline."),

        ("Article 10 : Représentation des stagiaires",
         "Dans les stages d'une durée supérieure à 500 heures, il est procédé simultanément à l'élection "
         "d'un délégué titulaire et d'un délégué suppléant conformément aux dispositions des articles R.6352-9 "
         "et suivants du Code du Travail.\n"
         "Les représentants des stagiaires font toute suggestion pour améliorer le déroulement des stages et "
         "les conditions de vie des stagiaires dans l'organisme de formation."),

        ("Article 11 : Publicité",
         "Le présent règlement est affiché dans les locaux et sur le site internet de l'organisme de formation. "
         "En outre, un exemplaire est remis à chaque stagiaire."),
    ]

    for title, body_text in ri_articles:
        story.append(Paragraph(f"<b>{title}</b>", s_h3))
        for para in body_text.split("\n"):
            if para.strip():
                story.append(Paragraph(para.strip(), s_body))
        story.append(Spacer(1, 2*mm))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(f"Fait à {OF_CITY}", s_body))
    story.append(Paragraph(f"Le {datetime.now().strftime('%d/%m/%Y')}", s_body))

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONVOCATION
# ═══════════════════════════════════════════════════════════════════════════════
def gen_convocation(data):
    s = S()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18*mm, bottomMargin=18*mm, title="Convocation")
    story = []
    session = data.get("session", {})
    f = data.get("formation", {})
    apprenant = data.get("apprenant", {})

    story += header_block(s, data, "CONVOCATION", "à une action de formation")

    # Destinataire
    story.append(Paragraph(f"<b>{safe(apprenant.get('first_name',''))} {safe(apprenant.get('last_name',''))}</b>", s["body_bold"]))
    if apprenant.get("email"):
        story.append(Paragraph(apprenant["email"], s["small"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(f"Objet : Convocation à la formation « <b>{safe(f.get('title',''))}</b> »", s["body_bold"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        f"Madame, Monsieur,<br/><br/>"
        f"Nous avons le plaisir de vous confirmer votre inscription à la formation "
        f"« {safe(f.get('title',''))} » (réf. {safe(f.get('code',''))}).<br/><br/>"
        f"Vous trouverez ci-dessous les informations pratiques :",
        s["body"]))
    story.append(Spacer(1, 4*mm))

    info = [
        ["Formation", safe(f.get("title", ""))],
        ["Dates", f"{fmt_date(session.get('start_date',''))} au {fmt_date(session.get('end_date',''))}"],
        ["Horaires", safe(session.get("horaire",""), "9h00 — 17h00")],
        ["Lieu", safe(session.get("location",""), safe(session.get("adresse",""), "À confirmer"))],
        ["Modalité", safe(session.get("modality","presentiel")).replace("presentiel","Présentiel").replace("distanciel","Distanciel").replace("hybride","Hybride")],
        ["Formateur", safe(session.get("formateur_name",""), "À confirmer")],
    ]
    t = Table([[Paragraph(r[0], s["small_bold"]), Paragraph(r[1], s["body"])] for r in info],
              colWidths=[35*mm, W - 2*MARGIN - 35*mm])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"), ("BOTTOMPADDING",(0,0),(-1,-1),4), ("TOPPADDING",(0,0),(-1,-1),4), ("LINEBELOW",(0,0),(-1,-2),0.3,LGRAY)]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "Nous vous remercions de bien vouloir confirmer votre présence. "
        "En cas d'empêchement, merci de nous prévenir dans les meilleurs délais.<br/><br/>"
        f"Cordialement,<br/><b>{safe(data.get('representantName','Moustapha Coulibaly'))}</b><br/>{safe(data.get('companyName','LES GRIOTS'))}",
        s["body"]))

    story += footer_block(s, data)
    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 4. FEUILLE D'ÉMARGEMENT — Modèle Digiforma (1 page par jour)
# ═══════════════════════════════════════════════════════════════════════════════
def gen_emargement(data):
    """
    Feuille d'émargement style Digiforma — 1 page par jour de formation.
    Header récurrent, info-box formation, tableau Matin/Après-midi avec modules,
    sections Apprenant + Intervenant séparées.
    """
    from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
    from reportlab.lib.enums import TA_JUSTIFY

    buf = io.BytesIO()
    session = data.get("session", {})
    f = data.get("formation", {})
    apprenants = data.get("apprenants", [])
    modules = data.get("modules", [])

    BK = colors.black
    GR = colors.HexColor("#666666")

    # Styles
    s_title = ParagraphStyle("em_title", fontName="Helvetica-Bold", fontSize=18, textColor=BK, leading=22, alignment=TA_CENTER)
    s_body = ParagraphStyle("em_body", fontName="Helvetica", fontSize=9, textColor=BK, leading=12)
    s_body_b = ParagraphStyle("em_body_b", fontName="Helvetica-Bold", fontSize=9, textColor=BK, leading=12)
    s_small = ParagraphStyle("em_small", fontName="Helvetica", fontSize=8, textColor=BK, leading=10)
    s_small_b = ParagraphStyle("em_small_b", fontName="Helvetica-Bold", fontSize=8, textColor=BK, leading=10)
    s_cell = ParagraphStyle("em_cell", fontName="Helvetica", fontSize=8, textColor=BK, leading=10, alignment=TA_CENTER)
    s_cell_b = ParagraphStyle("em_cell_b", fontName="Helvetica-Bold", fontSize=8, textColor=BK, leading=10, alignment=TA_CENTER)
    s_footer = ParagraphStyle("em_footer", fontName="Helvetica-Bold", fontSize=7, textColor=BK, leading=9, alignment=TA_CENTER)
    s_footer_it = ParagraphStyle("em_footer_it", fontName="Helvetica-Oblique", fontSize=7, textColor=BK, leading=9, alignment=TA_CENTER)

    # Variables
    OF_NAME = safe(data.get("companyName", "LES GRIOTS"))
    OF_ADDR = safe(data.get("address", ""))
    OF_CP = safe(data.get("postalCode", ""))
    OF_CITY = safe(data.get("city", ""))
    OF_SIRET = safe(data.get("siret", ""))
    OF_NDA = safe(data.get("nda", ""))
    OF_EMAIL = safe(data.get("email", ""))
    OF_PHONE = safe(data.get("phone", ""))
    OF_REPR = safe(data.get("representantName", "COULIBALY Moustapha"))

    client_company = safe(session.get("client_company", ""), "")
    location_str = safe(session.get("location", ""), safe(session.get("adresse", ""), "À définir"))
    formateur_name = safe(session.get("formateur_name", ""), OF_REPR)
    duration_hours = f.get("duration_hours", "")
    session_name = f"{client_company} - {safe(f.get('title', ''))}" if client_company else safe(f.get("title", "Formation"))

    # Header/footer callback
    def _header_footer(canvas, doc_obj):
        canvas.saveState()
        # Header — top left
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(MARGIN, H - 14*mm, OF_NAME)
        canvas.setFont("Helvetica", 8)
        y = H - 19*mm
        for line in [f"Email : {OF_EMAIL}", f"Tel : {OF_PHONE}"]:
            canvas.drawString(MARGIN, y, line)
            y -= 3.5*mm

        # Footer — 3 centered lines
        canvas.setFont("Helvetica-Bold", 7)
        canvas.drawCentredString(W/2, 16*mm,
            f"{OF_NAME} | {OF_ADDR} {OF_CP} {OF_CITY} | Numéro SIRET : {OF_SIRET} |")
        canvas.setFont("Helvetica-Oblique", 7)
        canvas.drawCentredString(W/2, 12.5*mm,
            f"Numéro de déclaration d'activité : {OF_NDA}")
        canvas.drawCentredString(W/2, 9*mm,
            "Cet enregistrement ne vaut pas l'agrément de l'État.")

        # Page number — bottom right
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(W - MARGIN, 9*mm, f"Page {doc_obj.page}")
        canvas.restoreState()

    # Build doc
    frame = Frame(MARGIN, 22*mm, W - 2*MARGIN, H - 52*mm, id='main')
    doc = BaseDocTemplate(buf, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=34*mm, bottomMargin=22*mm,
                          title="Feuille d'émargement")
    doc.addPageTemplates([PageTemplate(id='emargement', frames=frame, onPage=_header_footer)])
    story = []

    # Build dates list
    dates = []
    try:
        start = datetime.strptime(str(session.get("start_date", "")).split("T")[0].split(" ")[0], "%Y-%m-%d")
        end = datetime.strptime(str(session.get("end_date", "")).split("T")[0].split(" ")[0], "%Y-%m-%d")
        from datetime import timedelta
        current = start
        while current <= end:
            if current.weekday() < 5:  # weekdays only
                dates.append(current)
            current += timedelta(days=1)
    except:
        dates = [datetime.now()]

    # French date formatting
    _months_fr = {1:"janvier",2:"février",3:"mars",4:"avril",5:"mai",6:"juin",
                  7:"juillet",8:"août",9:"septembre",10:"octobre",11:"novembre",12:"décembre"}

    def fmt_date_fr(dt):
        return f"{dt.day} {_months_fr.get(dt.month, '')} {dt.year}"

    # Assign modules to half-days (morning/afternoon for each date)
    # Distribute modules sequentially across half-days
    half_day_modules = {}  # key: (date_idx, 'am'|'pm') → module title
    mod_idx = 0
    for di in range(len(dates)):
        for slot in ['am', 'pm']:
            if mod_idx < len(modules):
                m = modules[mod_idx]
                half_day_modules[(di, slot)] = f"Module {mod_idx+1} - {safe(m.get('title', ''))}"
                mod_idx += 1
            else:
                half_day_modules[(di, slot)] = ""

    cw = W - 2*MARGIN  # content width

    # ── Generate 1 page per day ──
    for di, day in enumerate(dates):
        if di > 0:
            story.append(PageBreak())

        story.append(Spacer(1, 4*mm))

        # Title
        story.append(Paragraph("<b>Feuille d'émargement</b>", s_title))
        story.append(Spacer(1, 6*mm))

        # Info box — formation details
        info_lines = [
            Paragraph(f"<b>Nom de la formation : {session_name}</b>", s_small_b),
            Paragraph(f"Date de la formation : du {fmt_date_fr(dates[0])} au {fmt_date_fr(dates[-1])}", s_small),
            Paragraph(f"Lieu de la formation : {client_company} - {location_str}" if client_company else f"Lieu de la formation : {location_str}", s_small),
            Paragraph(f"Durée : {duration_hours} heures" if duration_hours else "Durée : —", s_small),
            Paragraph(f"<b>Prestataire de la formation : {OF_NAME} N° de déclaration d'activité : {OF_NDA}</b>", s_small_b),
            Paragraph(f"Client de la formation : <b><font size='11'>{client_company}</font></b>" if client_company else "", s_small),
            Paragraph(f"Formateur(s) :", s_small),
            Paragraph(f"  • M. {formateur_name}", s_small),
        ]
        info_data = [[info_lines]]
        info_table = Table(info_data, colWidths=[cw])
        info_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, BK),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 4*mm))

        # Date header row
        date_str = f"Date : {fmt_date_fr(day)}"
        am_module = half_day_modules.get((di, 'am'), "")
        pm_module = half_day_modules.get((di, 'pm'), "")

        # Horaire strings (use session horaire or default)
        horaire = safe(session.get("horaire", ""), "09:00 - 13:00 / 14:00 - 17:00")
        am_horaire = "09:00 – 13:00"
        pm_horaire = "14:00 – 17:00"
        if "/" in horaire:
            parts = horaire.split("/")
            am_horaire = parts[0].strip()
            if len(parts) > 1:
                pm_horaire = parts[1].strip()

        # Build signature table
        name_col = cw * 0.30
        am_col = cw * 0.35
        pm_col = cw * 0.35

        rows = []

        # Row 0: Date spanning full width
        rows.append([
            Paragraph(f"<b>{date_str}</b>", s_small_b),
            "",
            ""
        ])

        # Row 1: Column headers (Matin / Après-midi with horaires + modules)
        rows.append([
            Paragraph("", s_cell),
            Paragraph(f"<b>Matin</b><br/>{am_horaire}<br/>{am_module}", s_cell),
            Paragraph(f"<b>Après-midi</b><br/>{pm_horaire}<br/>{pm_module}", s_cell),
        ])

        # Row 2: "Apprenant" section header
        rows.append([
            Paragraph("<b>Apprenant</b>", s_small_b),
            "",
            ""
        ])

        # Apprenant rows
        for a in apprenants:
            civ = safe(a.get("civilite", ""), "")
            name = f"{safe(a.get('first_name', ''))} {safe(a.get('last_name', ''))}".strip()
            if not name or name == "—":
                name = "Participant"
            company = safe(a.get("company", ""), "")
            label = f"  {name}"
            if company and company != "—":
                label += f"<br/>  {company}"
            rows.append([
                Paragraph(label, s_small),
                Paragraph("", s_cell),  # signature Matin
                Paragraph("", s_cell),  # signature Après-midi
            ])

        # "Intervenant" section header
        rows.append([
            Paragraph("<b>Intervenant</b>", s_small_b),
            "",
            ""
        ])

        # Intervenant row
        rows.append([
            Paragraph(f"  {formateur_name}", s_small),
            Paragraph("", s_cell),
            Paragraph("", s_cell),
        ])

        sig_table = Table(rows, colWidths=[name_col, am_col, pm_col])

        # Build style
        ts = [
            # Outer box
            ("BOX", (0, 0), (-1, -1), 0.5, BK),
            # Date row spans full width
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8E8E8")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, BK),
            # Column headers
            ("LINEBELOW", (0, 1), (-1, 1), 0.5, BK),
            ("LINEBEFORE", (1, 1), (1, -1), 0.5, BK),
            ("LINEBEFORE", (2, 1), (2, -1), 0.5, BK),
            # Apprenant section header
            ("SPAN", (0, 2), (-1, 2)),
            ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#F0F0F0")),
            ("LINEBELOW", (0, 2), (-1, 2), 0.5, BK),
            # Padding
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]

        # Row index for intervenant header = 3 + len(apprenants)
        intervenant_header_idx = 3 + len(apprenants)
        ts.append(("SPAN", (0, intervenant_header_idx), (-1, intervenant_header_idx)))
        ts.append(("BACKGROUND", (0, intervenant_header_idx), (-1, intervenant_header_idx), colors.HexColor("#F0F0F0")))
        ts.append(("LINEBELOW", (0, intervenant_header_idx), (-1, intervenant_header_idx), 0.5, BK))
        ts.append(("LINEABOVE", (0, intervenant_header_idx), (-1, intervenant_header_idx), 0.5, BK))

        # Horizontal lines between each apprenant
        for ai in range(len(apprenants)):
            row_idx = 3 + ai
            ts.append(("LINEBELOW", (0, row_idx), (-1, row_idx), 0.3, colors.HexColor("#CCCCCC")))

        # Line after intervenant row
        ts.append(("LINEBELOW", (0, intervenant_header_idx + 1), (-1, intervenant_header_idx + 1), 0.5, BK))

        # Make signature cells tall enough for actual signatures
        for ai in range(len(apprenants)):
            row_idx = 3 + ai
            ts.append(("TOPPADDING", (0, row_idx), (-1, row_idx), 10))
            ts.append(("BOTTOMPADDING", (0, row_idx), (-1, row_idx), 10))
        # Intervenant signature row
        ts.append(("TOPPADDING", (0, intervenant_header_idx + 1), (-1, intervenant_header_idx + 1), 10))
        ts.append(("BOTTOMPADDING", (0, intervenant_header_idx + 1), (-1, intervenant_header_idx + 1), 10))

        sig_table.setStyle(TableStyle(ts))
        story.append(sig_table)
        story.append(Spacer(1, 6*mm))

        # "Fait à" line
        lieu_fait = f"{client_company} - {location_str}" if client_company else location_str
        story.append(Paragraph(f"Fait à {lieu_fait}, le", s_body))

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ATTESTATION DE FIN DE FORMATION
# ═══════════════════════════════════════════════════════════════════════════════
def gen_attestation(data):
    s = S()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18*mm, bottomMargin=18*mm, title="Attestation de fin de formation")
    story = []
    session = data.get("session", {})
    f = data.get("formation", {})
    apprenant = data.get("apprenant", {})

    story += header_block(s, data, "ATTESTATION", "de fin de formation")
    story.append(Spacer(1, 8*mm))

    repr_name = safe(data.get('representantName', 'Moustapha Coulibaly'))
    co_name = safe(data.get('companyName', 'LES GRIOTS'))
    story.append(Paragraph(f"Je soussigné, {repr_name}, responsable de l'organisme de formation {co_name} SASU, atteste que :", s["body"]))
    story.append(Spacer(1, 6*mm))

    # Stagiaire info
    name = f"{safe(apprenant.get('first_name',''))} {safe(apprenant.get('last_name',''))}"
    story.append(Paragraph(f"<b>{name}</b>", ParagraphStyle("name_big", fontName="Helvetica-Bold", fontSize=14, textColor=DARK, leading=18, alignment=TA_CENTER)))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("a suivi avec assiduité la formation suivante :", s["body"]))
    story.append(Spacer(1, 4*mm))

    info = [
        ["Intitulé", safe(f.get("title", ""))],
        ["Référence", safe(f.get("code", ""))],
        ["Durée", fmt_duration(f.get("duration_hours"), f.get("duration_days"))],
        ["Dates", f"{fmt_date(session.get('start_date',''))} au {fmt_date(session.get('end_date',''))}"],
        ["Lieu", safe(session.get("location",""), safe(session.get("adresse",""), "—"))],
    ]
    t = Table([[Paragraph(r[0], s["small_bold"]), Paragraph(r[1], s["body"])] for r in info],
              colWidths=[35*mm, W - 2*MARGIN - 35*mm])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"), ("BOTTOMPADDING",(0,0),(-1,-1),4), ("TOPPADDING",(0,0),(-1,-1),4), ("LINEBELOW",(0,0),(-1,-2),0.3,LGRAY)]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    # Objectifs atteints
    objectives = parse_json_array(f.get("objectives"))
    if objectives:
        story.append(Paragraph("<b>Objectifs visés par la formation :</b>", s["body_bold"]))
        for obj in objectives:
            story.append(Paragraph(f"  • {obj}", s["body"]))
        story.append(Spacer(1, 4*mm))

    story.append(Paragraph(f"Fait à {safe(data.get('city','Montreuil'))}, le {datetime.now().strftime('%d/%m/%Y')}.", s["body"]))
    story.append(Spacer(1, 10*mm))

    # Signature
    sig = Table(
        [[Paragraph(f"<b>Le responsable de l'organisme</b><br/>{repr_name}<br/>{co_name} SASU<br/><br/><br/><br/>Signature et cachet", s["small"]),
          ""]],
        colWidths=[(W - 2*MARGIN)/2]*2
    )
    sig.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
    story.append(sig)

    story += footer_block(s, data)
    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CERTIFICAT DE RÉALISATION
# ═══════════════════════════════════════════════════════════════════════════════
def gen_certificat(data):
    """Certificat de réalisation — modèle conforme Digiforma / Qualiopi
    Inclut : assiduité par stagiaire, mentions légales conservation, notes de bas de page."""
    s = S()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18*mm, bottomMargin=18*mm, title="Certificat de réalisation")
    story = []
    session = data.get("session", {})
    f = data.get("formation", {})
    apprenants = data.get("apprenants", [])
    emargements = data.get("emargements", [])

    story += header_block(s, data, "CERTIFICAT", "de réalisation")
    story.append(Spacer(1, 6*mm))

    repr_name = safe(data.get('representantName', 'Moustapha Coulibaly'))
    co_name = safe(data.get('companyName', 'LES GRIOTS'))

    # ── Attestation solennelle ──
    story.append(Paragraph(
        f"Je soussigné(e) <b><u>{repr_name}</u></b> représentant légal du dispensateur de l'action "
        f"concourant au développement des compétences <b><u>{co_name}</u></b>",
        s["body"]))
    story.append(Paragraph("<b>atteste que :</b>", s["body_bold"]))
    story.append(Spacer(1, 4*mm))

    # ── Pour chaque apprenant — un bloc personnalisé ──
    client_name = safe(session.get("client_company", ""), "")
    type_action = safe(session.get("type_action_formation", "Action de formation"))
    start_str = fmt_date(session.get("start_date", ""))
    end_str = fmt_date(session.get("end_date", ""))
    duration_hours = f.get("duration_hours", 0) or session.get("duration_hours", 0) or 0
    session_name = safe(f.get("title", ""), safe(session.get("code_interne", ""), "Formation"))
    modality = safe(session.get("modality", "presentiel"))
    is_elearning = modality == "distanciel"

    # Calculate total emargement slots for the session
    total_slots = 0
    if emargements:
        dates_uniques = set(e.get("date", "") for e in emargements if e.get("date"))
        total_slots = len(dates_uniques) * 2  # matin + après-midi par jour

    for a in apprenants:
        civ = safe(a.get("civilite", ""), "M.")
        nom = safe(a.get("last_name", ""))
        prenom = safe(a.get("first_name", ""))
        company = safe(a.get("company", ""), client_name)
        ap_id = a.get("id", "")

        story.append(Paragraph(
            f"Mme/M. <u>{civ}</u> <u>{nom}</u> <u>{prenom}</u>",
            s["body"]))
        if company:
            story.append(Paragraph(
                f"salarié(e) de l'entreprise <u>{company}</u>, a suivi l'action <u>{session_name}</u>",
                s["body"]))
        else:
            story.append(Paragraph(
                f"a suivi l'action <u>{session_name}</u>",
                s["body"]))
        story.append(Spacer(1, 3*mm))

        # Nature de l'action
        story.append(Paragraph(
            f"<i>Nature de l'action concourant au développement des compétences :</i>",
            s["body"]))
        story.append(Paragraph(
            f"<u>{type_action}</u><super>1</super> qui s'est déroulée du <u>{start_str}</u> au <u>{end_str}</u> "
            f"pour une durée de <u>{duration_hours}</u> heures <super>2</super>",
            s["body"]))
        story.append(Spacer(1, 3*mm))

        # Assiduité du stagiaire
        story.append(Paragraph("<b>Assiduité du stagiaire</b>", s["body_bold"]))
        # Calculer heures réalisées depuis les émargements
        if emargements and ap_id:
            ap_emargements = [e for e in emargements if e.get("apprenant_id") == ap_id]
            present_slots = sum(1 for e in ap_emargements if e.get("present_matin")) + \
                            sum(1 for e in ap_emargements if e.get("present_aprem"))
            if total_slots > 0:
                taux = round(present_slots / total_slots * 100, 1)
                heures_realisees = round(present_slots / total_slots * float(duration_hours), 1)
            else:
                taux = 100.0
                heures_realisees = float(duration_hours)
        else:
            taux = 100.0
            heures_realisees = float(duration_hours)

        story.append(Paragraph(
            f"Durée effectivement suivie par le/la stagiaire : <u>{heures_realisees}</u> heures, "
            f"soit un taux de réalisation de <u>{taux}</u> %.",
            s["body"]))

        # Si e-learning
        if is_elearning:
            story.append(Spacer(1, 2*mm))
            story.append(Paragraph("<b>Suivi détaillé de l'assiduité e-learning</b>", s["body_bold"]))
            story.append(Paragraph("Relevé de connexions à l'extranet", s["body"]))

        story.append(Spacer(1, 5*mm))
        story.append(HRFlowable(width="100%", thickness=0.3, color=LGRAY))
        story.append(Spacer(1, 3*mm))

    # ── Mention légale conservation ──
    story.append(Spacer(1, 4*mm))
    conservation_style = ParagraphStyle("conservation", parent=s["body"], fontSize=8, leading=11,
                                        alignment=TA_LEFT, textColor=GRAY)
    story.append(Paragraph(
        "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, "
        "je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le "
        "présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier "
        "paiement. En cas de cofinancement des fonds européens la durée de conservation est étendue "
        "conformément aux obligations conventionnelles spécifiques.",
        conservation_style))
    story.append(Spacer(1, 6*mm))

    # ── Fait à / Signature ──
    city = safe(data.get("city", "Montreuil"))
    story.append(Paragraph(f"Fait à : <u>{city}</u>", s["body"]))
    story.append(Paragraph(f"Le : {datetime.now().strftime('%d/%m/%Y')}", s["body"]))
    story.append(Spacer(1, 4*mm))
    story.append(signature_block(s, "Cachet et signature\ndu responsable du dispensateur\nde formation", ""))
    story.append(Spacer(1, 8*mm))

    # ── Notes de bas de page ──
    footnote_style = ParagraphStyle("footnote", parent=s["body"], fontSize=7, leading=9,
                                     textColor=LGRAY)
    story.append(HRFlowable(width="30%", thickness=0.3, color=LGRAY))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "<super>1</super> Lorsque l'action est mise en œuvre dans le cadre d'un projet de transition "
        "professionnelle, le certificat de réalisation doit être transmis mensuellement.",
        footnote_style))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph(
        "<super>2</super> Dans le cadre des formations à distance prendre en compte la réalisation des "
        "activités pédagogiques et le temps estimé pour les réaliser.",
        footnote_style))

    story += footer_block(s, data)
    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# FACTURE — Agence (TVA 20%) et Griothèque (exonéré)
# ═══════════════════════════════════════════════════════════════════════════════
def gen_facture(data):
    """Génère une facture PDF.
    Paramètres attendus dans data :
      pillar: 'AGENCE' | 'GRIOTHEQUE'
      factureNumber, factureDate
      clientName, clientAddress, clientSiret, clientEmail
      lines: [{description, qty, unit, priceHT}]
      paymentTerms, paymentMode
      + infos OF standard (companyName, siret, nda, etc.)
    """
    s = S()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=18*mm, bottomMargin=22*mm, title="Facture")

    pillar = safe(data.get("pillar", "GRIOTHEQUE"))
    tva_applicable = pillar == "AGENCE"
    tva_rate = float(data.get("tvaRate", 20.0)) if tva_applicable else 0.0

    of_name = safe(data.get("companyName", "LES GRIOTS"))
    of_siret = safe(data.get("siret", "90262868400018"))
    of_nda = safe(data.get("nda", "28760747176"))
    of_addr = safe(data.get("address", "80 avenue du 8 mai 1945"))
    of_cp = safe(data.get("postalCode", "93100"))
    of_city = safe(data.get("city", "Montreuil"))
    of_email = safe(data.get("email", "contact@lesgriots.com"))
    of_phone = safe(data.get("phone", ""))
    of_tva = safe(data.get("tvaNumber", ""))
    of_repr = safe(data.get("representantName", "COULIBALY Moustapha"))
    of_iban = safe(data.get("iban", ""))
    of_bic = safe(data.get("bic", ""))

    facture_num = safe(data.get("factureNumber", f"F-{datetime.now().year}-001"))
    facture_date = safe(data.get("factureDate", datetime.now().strftime("%d/%m/%Y")))
    echeance = safe(data.get("echeance", ""))
    payment_mode = safe(data.get("paymentMode", "Virement bancaire"))
    payment_terms = safe(data.get("paymentTerms", "30 jours à réception de facture"))

    client_name = safe(data.get("clientName", ""))
    client_addr = safe(data.get("clientAddress", ""))
    client_siret = safe(data.get("clientSiret", ""))
    client_email = safe(data.get("clientEmail", ""))

    story = []

    # ── Header / Footer callback ──
    def _hf(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(MARGIN, H - 14*mm, of_name)
        canvas.setFont("Helvetica", 8)
        y = H - 19*mm
        for line in [of_addr, f"{of_cp} {of_city}", f"Email : {of_email}", f"Tel : {of_phone}"]:
            if line.strip():
                canvas.drawString(MARGIN, y, line)
                y -= 3.5*mm
        # Pillar badge
        if pillar == "AGENCE":
            canvas.setFont("Helvetica-Bold", 7)
            canvas.setFillColor(colors.HexColor("#1565C0"))
            canvas.drawRightString(W - MARGIN, H - 14*mm, "AGENCE")
        else:
            canvas.setFont("Helvetica-Bold", 7)
            canvas.setFillColor(GOLD)
            canvas.drawRightString(W - MARGIN, H - 14*mm, "LA GRIOTHEQUE")
        canvas.setFillColor(colors.black)
        # Footer
        canvas.setFont("Helvetica-Bold", 7)
        footer1 = f"{of_name} | {of_addr} {of_cp} | SIRET : {of_siret}"
        if tva_applicable and of_tva:
            footer1 += f" | TVA : {of_tva}"
        canvas.drawCentredString(W/2, 16*mm, footer1)
        canvas.setFont("Helvetica-Oblique", 7)
        if not tva_applicable:
            canvas.drawCentredString(W/2, 12.5*mm, f"N° de déclaration d'activité : {of_nda}")
            canvas.drawCentredString(W/2, 9*mm, "Cet enregistrement ne vaut pas l'agrément de l'État.")
        else:
            canvas.drawCentredString(W/2, 12.5*mm, "SASU au capital de 1 000€ — RCS Bobigny")
        canvas.setFont("Helvetica", 7)
        canvas.drawRightString(W - MARGIN, 9*mm, f"Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=lambda c, d: None)
    # Rebuild with callback
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=35*mm, bottomMargin=22*mm, title="Facture")
    story = []

    # ── FACTURE title ──
    title_style = ParagraphStyle("facture_title", fontName="Helvetica-Bold", fontSize=22,
                                  textColor=GOLD if not tva_applicable else colors.HexColor("#1565C0"),
                                  leading=26, alignment=TA_LEFT)
    story.append(Paragraph("FACTURE", title_style))
    story.append(Spacer(1, 2*mm))
    meta_style = ParagraphStyle("meta", fontName="Helvetica", fontSize=9, textColor=GRAY, leading=13)
    story.append(Paragraph(f"N° {facture_num}  —  Date : {facture_date}", meta_style))
    if echeance:
        story.append(Paragraph(f"Échéance : {echeance}", meta_style))
    story.append(Spacer(1, 6*mm))

    # ── Client block ──
    client_block = f"<b>{client_name}</b>"
    if client_addr:
        client_block += f"<br/>{client_addr}"
    if client_siret:
        client_block += f"<br/>SIRET : {client_siret}"
    if client_email:
        client_block += f"<br/>{client_email}"

    t_client = Table([
        [Paragraph("Destinataire", s["small_bold"]), Paragraph(client_block, s["body"])]
    ], colWidths=[30*mm, W - 2*MARGIN - 30*mm])
    t_client.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8F8F8")),
        ("BOX", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_client)
    story.append(Spacer(1, 8*mm))

    # ── Lignes de facturation ──
    lines = data.get("lines", [])
    total_ht = 0.0
    cw = W - 2 * MARGIN

    if tva_applicable:
        header = [Paragraph("<b>Désignation</b>", s["th"]),
                  Paragraph("<b>Qté</b>", s["th"]),
                  Paragraph("<b>P.U. HT</b>", s["th"]),
                  Paragraph("<b>TVA</b>", s["th"]),
                  Paragraph("<b>Total HT</b>", s["th"])]
        col_w = [cw * 0.40, cw * 0.10, cw * 0.18, cw * 0.14, cw * 0.18]
    else:
        header = [Paragraph("<b>Désignation</b>", s["th"]),
                  Paragraph("<b>Qté</b>", s["th"]),
                  Paragraph("<b>P.U. HT</b>", s["th"]),
                  Paragraph("<b>Total HT</b>", s["th"])]
        col_w = [cw * 0.48, cw * 0.12, cw * 0.20, cw * 0.20]

    rows = [header]
    for l in lines:
        qty = float(l.get("qty", 1))
        price = float(l.get("priceHT", 0))
        line_total = qty * price
        total_ht += line_total
        desc = safe(l.get("description", ""))
        desc = desc.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if "\n" in desc:
            _first, _rest = desc.split("\n", 1)
            desc = _first + '<br/><font size="7.5" color="#555555">' + _rest.replace("\n", "<br/>") + "</font>"
        unit = safe(l.get("unit", ""))
        if tva_applicable:
            rows.append([
                Paragraph(desc, s["tc"]),
                Paragraph(f"{qty:.0f} {unit}", s["tc"]),
                Paragraph(f"{price:,.2f} €".replace(",", " "), s["tc"]),
                Paragraph(f"{tva_rate:.0f}%", s["tc"]),
                Paragraph(f"{line_total:,.2f} €".replace(",", " "), s["tc"]),
            ])
        else:
            rows.append([
                Paragraph(desc, s["tc"]),
                Paragraph(f"{qty:.0f} {unit}", s["tc"]),
                Paragraph(f"{price:,.2f} €".replace(",", " "), s["tc"]),
                Paragraph(f"{line_total:,.2f} €".replace(",", " "), s["tc"]),
            ])

    t_lines = Table(rows, colWidths=col_w)
    t_lines.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, LGRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
    ]))
    story.append(t_lines)
    story.append(Spacer(1, 4*mm))

    # ── Totaux ──
    fmt_e = lambda v: f"{v:,.2f} €".replace(",", " ")
    totals_style = ParagraphStyle("tot", fontName="Helvetica", fontSize=10, textColor=DARK, leading=14, alignment=TA_RIGHT)
    totals_bold = ParagraphStyle("tot_b", fontName="Helvetica-Bold", fontSize=11, textColor=DARK, leading=14, alignment=TA_RIGHT)
    totals_label = ParagraphStyle("tot_l", fontName="Helvetica", fontSize=10, textColor=GRAY, leading=14, alignment=TA_RIGHT)

    if tva_applicable:
        tva_amount = total_ht * tva_rate / 100.0
        total_ttc = total_ht + tva_amount
        totals_rows = [
            [Paragraph("Total HT", totals_label), Paragraph(fmt_e(total_ht), totals_style)],
            [Paragraph(f"TVA ({tva_rate:.0f}%)", totals_label), Paragraph(fmt_e(tva_amount), totals_style)],
            [Paragraph("<b>Total TTC</b>", totals_label), Paragraph(f"<b>{fmt_e(total_ttc)}</b>", totals_bold)],
        ]
    else:
        totals_rows = [
            [Paragraph("Total HT", totals_label), Paragraph(fmt_e(total_ht), totals_style)],
            [Paragraph("TVA non applicable, art. 261-4-4a du CGI", ParagraphStyle("tva_note", fontName="Helvetica-Oblique", fontSize=8, textColor=LGRAY, leading=10, alignment=TA_RIGHT)), Paragraph("", totals_style)],
            [Paragraph("<b>Net à payer</b>", totals_label), Paragraph(f"<b>{fmt_e(total_ht)}</b>", totals_bold)],
        ]

    t_totals = Table(totals_rows, colWidths=[cw * 0.65, cw * 0.35])
    t_totals.setStyle(TableStyle([
        ("LINEBELOW", (0, -1), (-1, -1), 1, GOLD if not tva_applicable else colors.HexColor("#1565C0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_totals)
    story.append(Spacer(1, 8*mm))

    # ── Conditions de paiement ──
    story.append(Paragraph("<b>Conditions de paiement</b>", s["body_bold"]))
    story.append(Paragraph(f"Mode de paiement : {payment_mode}", s["body"]))
    story.append(Paragraph(f"Conditions : {payment_terms}", s["body"]))
    if of_iban:
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(f"IBAN : {of_iban}    BIC : {of_bic}", s["body"]))
    story.append(Spacer(1, 3*mm))

    # Mention pénalités de retard
    penalite_style = ParagraphStyle("penalite", fontName="Helvetica-Oblique", fontSize=7,
                                     textColor=LGRAY, leading=9)
    story.append(Paragraph(
        "En cas de retard de paiement, des pénalités de 3× le taux d'intérêt légal seront "
        "appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.",
        penalite_style))

    doc.build(story, onFirstPage=_hf, onLaterPages=_hf)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN DISPATCH
# ═══════════════════════════════════════════════════════════════════════════════
GENERATORS = {
    "programme": gen_programme,
    "convention": gen_convention,
    "convocation": gen_convocation,
    "emargement": gen_emargement,
    "attestation": gen_attestation,
    "certificat": gen_certificat,
    "facture": gen_facture,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: echo '<json>' | python3 generate_documents.py <type>", file=sys.stderr)
        print(f"Types: {', '.join(GENERATORS.keys())}", file=sys.stderr)
        sys.exit(1)

    doc_type = sys.argv[1]
    if doc_type not in GENERATORS:
        print(f"Unknown type: {doc_type}. Valid: {', '.join(GENERATORS.keys())}", file=sys.stderr)
        sys.exit(1)

    raw = sys.stdin.read()
    data = json.loads(raw)
    pdf_bytes = GENERATORS[doc_type](data)
    sys.stdout.buffer.write(pdf_bytes)

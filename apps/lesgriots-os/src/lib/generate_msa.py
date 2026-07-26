#!/usr/bin/env python3
"""
LES GRIOTS — Générateur MSA (Master Services Agreement) FR.

Contrat-cadre de prestation de services adapté au droit français :
  - Code civil (art. 1101 et suivants — contrats)
  - Code de la propriété intellectuelle (art. L.111-1 et suivants — droits d'auteur)
  - RGPD (Règlement UE 2016/679)
  - Code de commerce (délais de paiement art. L.441-10, intérêts de retard)
  - Code du travail (art. L.8221-1 — interdiction du travail dissimulé)

Structure :
  - Cover : titre, parties, date
  - Préambule
  - 14 articles : objet, champ application, modalités, prix et paiement,
    propriété intellectuelle, confidentialité, données personnelles,
    obligation indépendance, sous-traitance, responsabilité, force majeure,
    résiliation, juridiction, signature
  - Bloc signature
  - Disclaimer juridique

Usage: echo '<json>' | python3 generate_msa.py
"""
import sys
import json
import io

from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)
from reportlab.lib.units import mm
from reportlab.lib import colors

from legal_common import (
    W, H, MARGIN, PAPER, SURFACE, INK, INK2, INK3, HAIR, TERRACOTTA, GOLD_SOFT,
    LES_GRIOTS,
    make_styles, hr, page_header_footer, signature_block,
    disclaimer_text, fmt_date_fr, safe, client_display_name, client_signatory,
)


def build_msa(payload):
    """Construit la liste de Flowables."""
    client = payload.get("client") or {}
    scope = safe(payload.get("scope"),
                 "prestations de direction artistique, production audiovisuelle, "
                 "stratégie éditoriale et conseil créatif")
    payment_days = int(payload.get("payment_terms") or 30)
    jurisdiction = safe(payload.get("jurisdiction"), "Paris")
    place = safe(payload.get("signed_at"), "Paris")
    date_str = fmt_date_fr(payload.get("date"))
    contract_ref = safe(payload.get("ref"), f"MSA-{date_str.replace(' ', '-')}")

    styles = make_styles()
    story = []

    # ── Cover page ──
    story.append(Paragraph("Contrat-cadre de prestation de services", styles["title"]))
    story.append(Paragraph(
        f"Master Services Agreement (MSA) · {place}, le {date_str}",
        styles["subtitle"],
    ))

    # Encadré référence
    meta_rows = [
        ["Référence", contract_ref],
        ["Date d'effet", date_str],
        ["Lieu de signature", place],
        ["Droit applicable", "Droit français"],
    ]
    tbl = Table(meta_rows, colWidths=[40 * mm, (W - 2 * MARGIN) - 40 * mm])
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
    story.append(Spacer(1, 10 * mm))

    # ── Parties ──
    story.append(Paragraph("ENTRE LES SOUSSIGNÉS", styles["section"]))
    story.append(hr())

    story.append(Paragraph(
        f"<b>{LES_GRIOTS['nom_legal']}</b>, {LES_GRIOTS['forme']} au capital de "
        f"{LES_GRIOTS['capital']}, immatriculée au RCS de {LES_GRIOTS['rcs']}, "
        f"siège social {LES_GRIOTS['siege']}, représentée par "
        f"<b>{LES_GRIOTS['representant_nom']}</b>, en qualité de "
        f"{LES_GRIOTS['representant_titre']}, dûment habilité aux fins des présentes,",
        styles["body"],
    ))
    story.append(Paragraph(
        "Ci-après dénommée <b>« le Prestataire »</b>,",
        styles["body_left"],
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph("ET", styles["body_left"]))

    company = safe(client.get("company"))
    sign_name, sign_title, sign_email = client_signatory(client)
    siret = safe(client.get("siret"))
    address = safe(client.get("address"))

    if company:
        client_intro = f"<b>{company}</b>"
        if siret:
            client_intro += f", immatriculée sous le numéro SIRET {siret}"
        if address:
            client_intro += f", dont le siège est situé {address}"
        client_intro += f", représentée par <b>{sign_name}</b>"
        if sign_title and sign_title != "[Fonction]":
            client_intro += f", en qualité de {sign_title}"
        client_intro += ", dûment habilité·e aux fins des présentes,"
    else:
        client_intro = f"<b>{sign_name}</b>"
        if address:
            client_intro += f", demeurant {address}"
        client_intro += ","

    story.append(Paragraph(client_intro, styles["body"]))
    story.append(Paragraph(
        "Ci-après dénommé·e <b>« le Client »</b>,",
        styles["body_left"],
    ))

    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Ensemble désignés <b>« les Parties »</b> et individuellement <b>« une Partie »</b>.",
        styles["body_left"],
    ))

    # ── Préambule ──
    story.append(Paragraph("PRÉAMBULE", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        f"Le Prestataire est une SASU spécialisée dans l'ingénierie narrative afro-diasporique, "
        f"opérant trois pôles d'activité : agence créative et direction artistique, production "
        f"audiovisuelle originale, et formations professionnelles (organisme de formation enregistré). "
        f"Le Client souhaite recourir aux services du Prestataire dans le domaine suivant : "
        f"<i>{scope}</i>.",
        styles["body"],
    ))
    story.append(Paragraph(
        "Le présent contrat-cadre a pour objet de définir les conditions générales applicables "
        "à l'ensemble des prestations qui pourront être confiées au Prestataire par le Client. "
        "Chaque mission ou projet fera l'objet d'un cahier des charges, d'un devis ou d'un "
        "bon de commande spécifique (ci-après <b>« Statement of Work »</b> ou <b>« SOW »</b>) "
        "annexé aux présentes.",
        styles["body"],
    ))
    story.append(Paragraph("Il a été convenu ce qui suit :", styles["body_left"]))

    # ── Articles ──
    articles = [
        ("Article 1 — Objet",
         "Le présent contrat-cadre (ci-après <b>« Contrat »</b>) a pour objet de définir les "
         "conditions générales applicables aux prestations confiées par le Client au Prestataire. "
         "Chaque mission spécifique fera l'objet d'un SOW décrivant : périmètre, livrables, "
         "calendrier, prix, modalités particulières. Les SOW prévaudront sur le présent Contrat "
         "en cas de contradiction sur les points spécifiquement traités, sans déroger aux clauses "
         "essentielles (propriété intellectuelle, confidentialité, juridiction)."),

        ("Article 2 — Champ d'application",
         "Le Contrat s'applique à toutes les prestations commandées par le Client au Prestataire "
         "à compter de la date de signature, qu'elles soient ponctuelles ou récurrentes, jusqu'à "
         "résiliation conformément à l'article 13. Toute prestation acceptée par les Parties (via "
         "SOW signé, bon de commande, devis accepté ou email confirmant l'engagement mutuel) "
         "est régie par le présent Contrat."),

        ("Article 3 — Indépendance des Parties",
         "Le Prestataire intervient en qualité de prestataire indépendant. Le présent Contrat ne "
         "crée entre les Parties aucun lien de subordination, ni société commune, ni mandat, ni "
         "agence, ni franchise. Chaque Partie demeure responsable de ses obligations sociales, "
         "fiscales et administratives. Le Prestataire conserve la maîtrise de l'organisation de "
         "son travail (article L.8221-1 du Code du travail)."),

        ("Article 4 — Prix et facturation",
         f"Les prix sont définis dans chaque SOW. Sauf stipulation contraire, ils sont exprimés "
         f"en euros hors taxes. La TVA est ajoutée au taux légal en vigueur. "
         f"Les factures sont émises selon les modalités prévues au SOW (à la commande, à étape, "
         f"mensuellement ou à livraison). Le délai de paiement est de <b>{payment_days} jours "
         f"à compter de la date d'émission de la facture</b>. "
         f"Tout retard de paiement entraîne, de plein droit et sans mise en demeure préalable, "
         f"l'application d'intérêts de retard au taux directeur BCE majoré de 10 points "
         f"(art. L.441-10 du Code de commerce), ainsi qu'une indemnité forfaitaire pour frais de "
         f"recouvrement de 40 € par facture impayée (art. D.441-5 du Code de commerce)."),

        ("Article 5 — Modalités d'exécution",
         "Le Prestataire s'engage à exécuter les prestations conformément aux règles de l'art, "
         "dans les délais convenus au SOW et en bonne intelligence avec le Client. Le Prestataire "
         "désigne un·e interlocuteur·rice principal·e pour chaque mission. Le Client s'engage à "
         "fournir, dans des délais raisonnables, l'ensemble des éléments, accès, validations et "
         "informations nécessaires à la bonne exécution des prestations. Tout retard imputable "
         "au Client peut entraîner un décalage du planning et une révision du SOW."),

        ("Article 6 — Propriété intellectuelle",
         "Conformément aux articles L.111-1 et L.131-1 et suivants du Code de la propriété "
         "intellectuelle : (i) les éléments préexistants du Prestataire (méthodologies, outils, "
         "savoir-faire, templates, code source réutilisable) restent sa propriété exclusive ; "
         "(ii) sous réserve du paiement intégral des prestations, le Prestataire cède au Client, "
         "à titre non exclusif sauf stipulation contraire au SOW, les droits patrimoniaux sur "
         "les livrables finaux (droit de reproduction, de représentation, d'adaptation), "
         "pour la durée de protection légale, pour le monde entier, et pour les usages convenus "
         "au SOW ; (iii) en aucun cas la cession ne porte sur les droits moraux (article L.121-1 "
         "CPI), inaliénables et imprescriptibles ; (iv) le Prestataire se réserve le droit de "
         "mentionner les travaux réalisés dans ses supports de communication (book, portfolio, "
         "site, réseaux sociaux) sauf clause de confidentialité spécifique."),

        ("Article 7 — Confidentialité",
         "Chaque Partie s'engage à conserver confidentielles les informations échangées dans le "
         "cadre du Contrat et à n'en faire usage que pour l'exécution des prestations. Cette "
         "obligation perdure pendant la durée du Contrat et trois (3) ans après son terme. "
         "Sont exclues : les informations publiques, déjà connues légitimement, ou dont la "
         "divulgation est imposée par une autorité publique."),

        ("Article 8 — Données personnelles (RGPD)",
         "Chaque Partie s'engage à respecter le Règlement (UE) 2016/679 (RGPD) et la loi "
         "Informatique et Libertés modifiée. Lorsque le Prestataire traite des données "
         "personnelles pour le compte du Client, il agit en qualité de sous-traitant au sens "
         "de l'article 28 RGPD : un accord de sous-traitance (DPA) sera annexé sur demande, "
         "précisant les finalités, durées, mesures techniques et organisationnelles, et droits "
         "des personnes concernées."),

        ("Article 9 — Sous-traitance",
         "Le Prestataire peut recourir à des sous-traitants, freelances ou partenaires de son "
         "choix pour l'exécution des prestations, sous sa responsabilité. Il garantit que ces "
         "tiers sont soumis à des obligations de confidentialité, de qualité et de respect des "
         "délais équivalentes."),

        ("Article 10 — Responsabilité",
         "Le Prestataire est tenu d'une obligation de moyens pour l'exécution des prestations. "
         "Sa responsabilité, en cas de manquement contractuel prouvé, est limitée au montant "
         "hors taxes effectivement perçu au titre du SOW concerné au cours des douze (12) mois "
         "précédant le fait générateur. Les Parties excluent expressément la responsabilité pour "
         "préjudices indirects (perte d'exploitation, perte de chance, atteinte à l'image). "
         "Ces limitations ne s'appliquent pas en cas de faute lourde, dol ou atteinte à un droit "
         "fondamental de la personne."),

        ("Article 11 — Force majeure",
         "Aucune Partie ne pourra être tenue responsable d'un manquement à ses obligations s'il "
         "résulte d'un cas de force majeure au sens de l'article 1218 du Code civil. La Partie "
         "concernée informera l'autre sans délai par tout moyen écrit. Si le cas de force majeure "
         "perdure au-delà de 60 jours, chaque Partie pourra résilier le Contrat ou le SOW concerné "
         "sans indemnité, après mise en demeure restée sans effet pendant 15 jours."),

        ("Article 12 — Durée",
         "Le présent Contrat prend effet à la date de signature et est conclu pour une durée "
         "indéterminée. Chaque Partie peut y mettre fin à tout moment moyennant un préavis "
         "de trente (30) jours notifié par lettre recommandée avec accusé de réception ou par "
         "email avec accusé de lecture. La résiliation du Contrat-cadre n'emporte pas résiliation "
         "automatique des SOW en cours, qui se poursuivent jusqu'à leur terme sauf décision "
         "contraire des Parties."),

        ("Article 13 — Résiliation",
         "En cas de manquement grave de l'une des Parties à ses obligations, l'autre Partie peut "
         "résilier le Contrat ou un SOW spécifique de plein droit, trente (30) jours après une "
         "mise en demeure adressée par lettre recommandée et restée sans effet. En cas de "
         "résiliation pour manquement, les sommes dues au titre des prestations exécutées "
         "demeurent acquises au Prestataire."),

        ("Article 14 — Droit applicable et juridiction",
         f"Le présent Contrat est régi par le droit français. En cas de différend, les Parties "
         f"s'engagent à rechercher une solution amiable. À défaut, compétence exclusive est "
         f"attribuée aux tribunaux compétents du ressort de la Cour d'appel de <b>{jurisdiction}</b>, "
         f"nonobstant pluralité de défendeurs, appel en garantie ou procédure d'urgence."),
    ]

    for title, body in articles:
        story.append(Paragraph(title, styles["article_num"]))
        story.append(Paragraph(body, styles["body"]))

    # ── Annexes mentionnées ──
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("ANNEXES", styles["section"]))
    story.append(hr())
    story.append(Paragraph(
        "<b>Annexe A — Cession de propriété intellectuelle :</b> les Parties pourront convenir "
        "d'une cession exclusive ou élargie par avenant spécifique précisant l'étendue, "
        "la durée, le territoire et les modalités financières.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Annexe B — Statement of Work (SOW) :</b> chaque mission fera l'objet d'un document "
        "spécifique signé des deux Parties détaillant le périmètre, les livrables, le calendrier "
        "et le prix.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Annexe C — Accord de sous-traitance RGPD :</b> sera annexé sur demande dès lors que "
        "les prestations impliquent un traitement de données personnelles pour le compte du Client.",
        styles["body"],
    ))

    # ── Signature ──
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f"Fait à <b>{place}</b>, le <b>{date_str}</b>, en deux exemplaires originaux.",
        styles["body_left"],
    ))
    story.append(Spacer(1, 6 * mm))

    story.append(signature_block(
        "Pour le Prestataire",
        [
            (LES_GRIOTS["representant_titre"], LES_GRIOTS["representant_nom"]),
            ("Société", f"{LES_GRIOTS['nom_legal']} {LES_GRIOTS['forme']}"),
            ("Email", LES_GRIOTS["email"]),
        ],
        "Pour le Client",
        [
            ("Nom et fonction", f"{sign_name}" + (f" — {sign_title}" if sign_title and sign_title != '[Fonction]' else "")),
            ("Société", company or "_________________"),
            ("Email", sign_email or "_________________"),
        ],
    ))

    # ── Disclaimer ──
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(disclaimer_text(short=False), styles["disclaimer"]))

    return story


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(2)

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=(W, H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 4 * mm, bottomMargin=MARGIN,
        title="MSA — LES GRIOTS",
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
        page_header_footer(canvas, doc, "Contrat-cadre de prestation", "MSA")

    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=on_page),
    ])

    story = build_msa(payload)
    doc.build(story)

    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere les pages relais statiques du site (une par grande adresse).

Le site est une application d'une seule page : nginx sert index.html pour
toute adresse inconnue. Ces relais sont des copies d'index.html avec le
titre, la description et la canonique de leur page : les robots des reseaux
sociaux, qui n'executent pas JavaScript, y lisent le bon apercu ; un
visiteur, lui, y demarre l'application normalement.

A RELANCER apres chaque modification d'index.html (notamment les bumps ?v=),
sinon les relais servent d'anciennes versions des scripts :

    python3 genere-shells.py <dossier du site>
"""
import io, os, re, sys

base = sys.argv[1] if len(sys.argv) > 1 else "."
idx = os.path.join(base, "index.html")

# slug -> (titre, description, canonique si differente de l'adresse)
PAGES = {
    "formations": (
        u"Formations",
        u"Des formations pratiques pour apprendre à raconter ton talent et en vivre. Conçues et animées par des professionnels en activité.",
        None,
    ),
    "catalogue": (
        u"Formations",
        u"Des formations pratiques pour apprendre à raconter ton talent et en vivre. Conçues et animées par des professionnels en activité.",
        u"https://lagriotheque.com/formations/",
    ),
    "workshops": (
        u"Workshops",
        u"Des formats courts et intensifs, en groupe restreint, pour pratiquer sur ton projet réel.",
        None,
    ),
    "events": (
        u"Événements",
        u"Masterclasses, talks et rencontres de LA GRIOTHÈQUE.",
        None,
    ),
    "agenda": (
        u"Agenda",
        u"Les prochaines sessions de formation, workshops et événements.",
        None,
    ),
    "ressources": (
        u"Ressources",
        u"Templates, guides et outils gratuits pour structurer ton récit et tes projets.",
        None,
    ),
    "approche": (
        u"Notre approche",
        u"Transmettre à une nouvelle génération de créatifs les outils pour bâtir leur récit et vivre de leur passion.",
        None,
    ),
    "contact": (
        u"À propos",
        u"Qui nous sommes, et comment nous écrire.",
        None,
    ),
    "financement": (
        u"Financement",
        u"CPF, OPCO, FAF : les dispositifs pour financer ta formation.",
        None,
    ),
    "newsletter": (
        u"Newsletter",
        u"Les prochaines dates, les ressources, les coulisses. Inscription en trente secondes, désinscription en un clic.",
        None,
    ),
    "cgv": (
        u"Conditions générales de vente",
        u"Les conditions générales de vente de LA GRIOTHÈQUE.",
        None,
    ),
    "mentions-legales": (
        u"Mentions légales",
        u"Les mentions légales du site lagriotheque.com.",
        None,
    ),
    "confidentialite": (
        u"Politique de confidentialité",
        u"Ce que nous faisons, et ne faisons pas, de tes données.",
        None,
    ),
}

gabarit = io.open(idx, encoding="utf-8").read()
if "<base " not in gabarit:
    raise SystemExit("index.html sans <base href> : lance d'abord la migration des chemins")


def poser(html, motif, remplacement):
    neuf, n = re.subn(motif, remplacement, html, count=1)
    if n != 1:
        raise SystemExit("balise introuvable : " + motif)
    return neuf


for slug, (titre, desc, canonique) in sorted(PAGES.items()):
    url = canonique or (u"https://lagriotheque.com/" + slug + u"/")
    plein = titre + u" · LA GRIOTHÈQUE"
    h = gabarit
    h = poser(h, r"<title>.*?</title>", u"<title>%s</title>" % plein)
    h = poser(h, r'(<meta name="description" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % desc)
    h = poser(h, r'(<link rel="canonical" href=")[^"]*(")', u"\\g<1>%s\\g<2>" % url)
    h = poser(h, r'(<meta property="og:url" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % url)
    h = poser(h, r'(<meta property="og:title" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % plein)
    h = poser(h, r'(<meta property="og:description" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % desc)
    h = poser(h, r'(<meta name="twitter:title" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % plein)
    h = poser(h, r'(<meta name="twitter:description" content=")[^"]*(")', u"\\g<1>%s\\g<2>" % desc)
    dossier = os.path.join(base, slug)
    os.makedirs(dossier, exist_ok=True)
    io.open(os.path.join(dossier, "index.html"), "w", encoding="utf-8").write(h)
    print("relais :", slug + "/index.html")

print("fait :", len(PAGES), "relais")

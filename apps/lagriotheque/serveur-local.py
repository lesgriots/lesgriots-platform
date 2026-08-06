#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Serveur local du site LA GRIOTHÈQUE, pour travailler avant de déployer.

Reproduit le comportement de nginx en production :
  - sert les fichiers du dossier tels quels ;
  - une adresse inconnue (/formations/xyz) renvoie index.html, c'est
    l'application qui affiche la bonne page ;
  - jamais de cache, chaque rechargement lit les fichiers du disque.

Lancement :  python3 serveur-local.py [port]     (défaut : 8123)
"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
RACINE = os.path.dirname(os.path.abspath(__file__))


class Repli(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        chemin = self.translate_path(self.path.split("?")[0].split("#")[0])
        if os.path.isdir(chemin):
            if not os.path.exists(os.path.join(chemin, "index.html")):
                self.path = "/index.html"
        elif not os.path.exists(chemin):
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silencieux


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    handler = functools.partial(Repli, directory=RACINE)
    with Serveur(("127.0.0.1", PORT), handler) as s:
        print("Site local : http://localhost:%d" % PORT)
        s.serve_forever()

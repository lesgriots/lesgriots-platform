#!/bin/bash
# Envoi automatique des convocations — déclenché chaque matin par
# lesgriots-os-envois.timer (ce VPS n'a pas de cron).
#
# Le script ne décide rien : il appelle la route qui porte la logique, avec
# la clé d'API du serveur. Toute la traçabilité reste dans l'application.
set -uo pipefail

ENV_FILE=/etc/lesgriots-os.env
BASE=${NEXTAUTH_URL:-https://app.lagriotheque.com}

# La clé vient d'abord de l'environnement : systemd la fournit via
# EnvironmentFile, qu'il lit en root. La lecture directe du fichier reste en
# secours, pour un lancement à la main depuis un compte qui y a accès.
if [ -z "${OS_API_KEY:-}" ] && [ -r "$ENV_FILE" ]; then
  OS_API_KEY=$(grep -E '^OS_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
fi

if [ -z "${OS_API_KEY:-}" ]; then
  echo "$(date -Is) ✗ OS_API_KEY absente de l'environnement et de $ENV_FILE — rien envoyé"
  echo "   (le service doit porter EnvironmentFile=$ENV_FILE : il tourne sous un compte"
  echo "    qui n'a pas le droit de lire ce fichier, et c'est volontaire)"
  exit 1
fi

REPONSE=$(curl -sS -m 120 -X POST "$BASE/api/griotheque/envois-auto" \
  -H "x-api-key: $OS_API_KEY" -H 'Content-Type: application/json')

echo "$(date -Is) $REPONSE"

# Sortie en erreur si la route a répondu une erreur : le journal systemd
# marquera l'unité en échec, ce qui est visible dans systemctl status.
echo "$REPONSE" | grep -q '"error"' && exit 1
exit 0

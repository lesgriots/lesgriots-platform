#!/usr/bin/env bash
#
# redeploy-os.sh — met à jour LES GRIOTHÈQUE OS en production.
#
#   pull → npm ci (si besoin) → build → bascule → restart → fumée → verdict
#
# Usage (sur le VPS) :
#   sudo /var/www/ecosystem/production/lesgriots-platform/infra/scripts/redeploy-os.sh
#   sudo …/redeploy-os.sh --deps        # force la réinstallation des dépendances
#   sudo …/redeploy-os.sh --revenir     # remet le build précédent, sans rien construire
#
# ── Deux filets, et pourquoi il en faut deux ────────────────────────────
#
# Le premier existait déjà : un build qui échoue ne redémarre rien, l'ancien
# build continue d'être servi. Il attrape les fautes de compilation.
#
# Il n'attrape pas l'autre moitié des accidents : le code qui compile très
# bien et qui explose à l'exécution. Une variable non définie dans un rendu,
# un import circulaire, une colonne SQL absente — tout cela passe le build et
# rend une page blanche. Jusqu'ici le déploiement se déclarait réussi parce
# que /login répondait 200, et /login est justement la seule page qui ne
# touche à rien.
#
# D'où le second filet. Le build précédent est mis de côté avant la bascule.
# Après redémarrage, on frappe les routes qui comptent : une seule d'entre
# elles qui rend un 500 et l'ancien build est remis en place dans la seconde.
# Mieux vaut une version d'hier qui marche qu'une version d'aujourd'hui qui
# affiche une page blanche à quelqu'un en pleine session de formation.

set -u
REPO=/var/www/ecosystem/production/lesgriots-platform
APP="$REPO/apps/lesgriots-os"
LOG=/tmp/os-redeploy.log
DEPS=0
REVENIR=0
[ "${1:-}" = "--deps" ] && DEPS=1
[ "${1:-}" = "--revenir" ] && REVENIR=1

PRECEDENT="$APP/.next.precedent"

# Les routes de fumée. Sans session, l'OS répond 307 vers /login : c'est un
# succès, cela prouve que la route s'est exécutée. Ce qu'on traque, c'est le 500.
ROUTES=(
  /login
  /apercu
  /pipeline-formations
  /sessions-list
  /inscriptions
  /agenda
  /catalogue
  /api/public/rendez-vous
)

frapper() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    -H 'Host: app.lagriotheque.com' "http://127.0.0.1:3010$1"
}

fumee() {
  local echecs=0
  for r in "${ROUTES[@]}"; do
    local code
    code=$(frapper "$r")
    if [ "$code" -ge 500 ] 2>/dev/null || [ -z "$code" ] || [ "$code" = "000" ]; then
      echo "   ✗ $r → $code"
      echecs=$((echecs + 1))
    else
      echo "   · $r → $code"
    fi
  done
  return "$echecs"
}

restaurer() {
  if [ -d "$PRECEDENT" ]; then
    rm -rf "$APP/.next.casse"
    mv "$APP/.next" "$APP/.next.casse" 2>/dev/null || true
    mv "$PRECEDENT" "$APP/.next"
    systemctl restart lesgriots-os
    sleep 5
    echo "↩ build précédent restauré (le build fautif est dans .next.casse)"
    return 0
  fi
  echo "↩ aucun build précédent à restaurer"
  return 1
}

# ── Retour arrière à la demande ────────────────────────────────────────
if [ "$REVENIR" = "1" ]; then
  : > "$LOG"
  echo "→ retour au build précédent"
  restaurer || exit 1
  fumee || true
  echo "✓ service=$(systemctl is-active lesgriots-os)"
  exit 0
fi

: > "$LOG"
echo "→ git pull"
sudo -u deployment git -C "$REPO" pull --ff-only >> "$LOG" 2>&1 || { echo "✗ pull"; tail -3 "$LOG"; exit 1; }

# Réinstalle si demandé, si node_modules manque, ou si le verrou a bougé.
if [ "$DEPS" = "1" ] || [ ! -d "$APP/node_modules" ] || \
   [ "$APP/package-lock.json" -nt "$APP/node_modules" ]; then
  echo "→ npm ci"
  ( cd "$APP" && sudo -u deployment npm ci >> "$LOG" 2>&1 ) || { echo "✗ npm ci"; tail -5 "$LOG"; exit 1; }
fi

# ── Le build sort dans un dossier à part ───────────────────────────────
# Next écrit dans .next. On met donc l'ancien de côté AVANT, et on le remet
# si le build échoue : à aucun moment le dossier servi n'est incomplet.
rm -rf "$PRECEDENT"
if [ -d "$APP/.next" ]; then
  cp -al "$APP/.next" "$PRECEDENT" 2>/dev/null || cp -a "$APP/.next" "$PRECEDENT"
fi

echo "→ build"
( cd "$APP" && sudo -u deployment npm run build >> "$LOG" 2>&1 ) || {
  echo "✗ BUILD ÉCHOUÉ — service inchangé, ancien build toujours servi"
  grep -iE "error|ReferenceError|Failed to compile" "$LOG" | head -5
  rm -rf "$PRECEDENT"
  exit 1
}

echo "→ restart"
systemctl restart lesgriots-os
sleep 5

ETAT=$(systemctl is-active lesgriots-os)
if [ "$ETAT" != "active" ]; then
  echo "✗ le service ne démarre pas"
  restaurer
  exit 1
fi

echo "→ fumée"
if ! fumee; then
  echo "✗ FUMÉE ÉCHOUÉE — au moins une route rend un 500"
  restaurer
  exit 1
fi

# Tout va bien : le filet d'hier ne sert plus à rien, il devient celui d'aujourd'hui.
rm -rf "$PRECEDENT"
CODE=$(frapper /login)
echo "✓ service=$ETAT  /login=$CODE  fumée=${#ROUTES[@]} routes OK"
exit 0

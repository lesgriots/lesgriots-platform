#!/bin/bash
set -e
pw=$(grep ^ADMIN_PASSWORD= /etc/lagriotheque-backoffice.env | cut -d= -f2)
echo "--- Sessions actuelles ---"
curl -s -u "admin:$pw" http://localhost:3031/api/sessions | python3 -c "
import json, sys
for s in json.load(sys.stdin):
    print(s.get('formation_id') or s.get('workshop_id'), '|', s.get('date'), '|', s.get('status'), '| places:', repr(s.get('places')))
"
echo "--- Ajout 17 août ---"
python3 - << 'PYEOF'
import json
s = {
  "id": "ses-strategie-marque-260817",
  "formation_id": "strategie-marque",
  "date": "2026-08-17",
  "places": "",
  "status": "OUVERTE"
}
json.dump(s, open('/tmp/s.json', 'w'), ensure_ascii=False)
PYEOF
curl -s -u "admin:$pw" -X POST -H "Content-Type: application/json" -d @/tmp/s.json http://localhost:3031/api/sessions | python3 -c "import json,sys; j=json.load(sys.stdin); print('créée:', j.get('id'), j.get('date'), j.get('status')) if j.get('id') else print('ERREUR:', j)"
rm /tmp/s.json
curl -s -u "admin:$pw" -X POST http://localhost:3031/api/export -o /dev/null -w "export: %{http_code}\n"

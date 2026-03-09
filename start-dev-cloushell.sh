#!/usr/bin/env bash
set -euo pipefail

ANGULAR_JSON="angular.json"
BACKUP="${ANGULAR_JSON}.bak.$(date +%Y%m%d%H%M%S)"

if [ ! -f "$ANGULAR_JSON" ]; then
  echo "Error: $ANGULAR_JSON not found."
  exit 1
fi

echo "Backing up $ANGULAR_JSON -> $BACKUP"
cp "$ANGULAR_JSON" "$BACKUP"

echo "Patching $ANGULAR_JSON to add allowedHosts for *.cloudshell.dev and host/port options..."
python3 - <<'PY'
import json,sys
f='angular.json'
j=json.load(open(f))
# pick defaultProject or first project key
proj_key = j.get('defaultProject') or next(iter(j.get('projects',{})), None)
if not proj_key:
    print("No project found in angular.json", file=sys.stderr)
    sys.exit(1)
serve = j['projects'][proj_key].setdefault('architect',{}).setdefault('serve',{})
opts = serve.setdefault('options',{})
opts['host'] = '0.0.0.0'
opts['port'] = 4200
hosts = opts.setdefault('allowedHosts',[])
if '*.cloudshell.dev' not in hosts:
    hosts.append('*.cloudshell.dev')
open(f,'w').write(json.dumps(j,indent=2))
print("angular.json patched successfully for project:", proj_key)
PY

echo "Installing dependencies (if needed)..."
npm install --no-audit --no-fund

echo "Starting Angular dev server (project from angular.json)..."
PROJECT=$(python3 - <<'PY'
import json
j=json.load(open('angular.json'))
print(j.get('defaultProject') or next(iter(j.get('projects',{}))))
PY
)
npx ng serve --project "$PROJECT"

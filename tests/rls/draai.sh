#!/usr/bin/env bash
# Draait de toegangstest tegen een tijdelijke lokale PostgreSQL (16).
# Gebruik: tests/rls/draai.sh   (vereist PostgreSQL-binaries, bijv. /usr/lib/postgresql/16/bin)
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HIER/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then echo "PostgreSQL niet gevonden; toegangstest overgeslagen."; exit 0; fi
TMP="$(mktemp -d)"; chmod 777 "$TMP"
ALS=""; [ "$(id -u)" = 0 ] && ALS="runuser -u postgres --"
$ALS "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
$ALS "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p 55432 -k $TMP" -l "$TMP/log" -w start >/dev/null
trap '$ALS "$PGBIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null; rm -rf "$TMP"' EXIT
export PGOPTIONS="-c client_min_messages=warning"
PSQL=("$PGBIN/psql" -h "$TMP" -p 55432 -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database lt" >/dev/null
"${PSQL[@]}" -d lt -f "$HIER/emulatie.sql" >/dev/null 2>&1
"${PSQL[@]}" -d lt -f "$REPO/supabase/schema.sql" >/dev/null
"${PSQL[@]}" -d lt -f "$REPO/supabase/schema.sql" >/dev/null   # tweede keer: script moet herhaalbaar zijn
PGOPTIONS="-c client_min_messages=notice" "${PSQL[@]}" -d lt -t -f "$HIER/test.sql" 2>&1 | sed -n 's/^psql:[^ ]* NOTICE:  /  /p; /MISLUKT\|ERROR\|GESLAAGD/p'
exit "${PIPESTATUS[0]}"

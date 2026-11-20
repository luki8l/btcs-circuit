#!/usr/bin/env bash
# The Azure mode end to end on one machine, from an empty database: migrations as a non-superuser (like Azure),
# the app's own database role, demo data, the production server, Microsoft sign-in against a stand-in provider.
#
#   PG_ADMIN_URL=postgres://azadmin:pw@127.0.0.1:5432 tests/postgres-e2e.sh
#
# PG_ADMIN_URL: a PostgreSQL login that may create databases and roles (no database name at the end).
# Needs a production build first (npm run build). Creates and drops the database "circuit_e2e" and the role
# "circuit_e2e_app" on that server; nothing else is touched.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PG_ADMIN_URL:?set PG_ADMIN_URL, e.g. postgres://azadmin:pw@127.0.0.1:5432}"
ADMIN="${PG_ADMIN_URL%/}"
DB=circuit_e2e APP_ROLE=circuit_e2e_app APP_PW="e2e-$(node -e 'console.log(require("crypto").randomBytes(9).toString("hex"))')"
PORT=${PORT:-3300}
SA=.next/standalone
[ -f "$SA/server.js" ] || { echo "No production build: run npm run build first."; exit 2; }

sql() { node -e '
  const { Client } = require("pg"); const c = new Client({ connectionString: process.argv[1] });
  c.connect().then(async () => { for (const q of process.argv.slice(2)) await c.query(q); await c.end(); })
   .catch(e => { console.error(e.message); process.exit(1); });' "$@"; }

echo "→ fresh database $DB"
sql "$ADMIN/postgres" "drop database if exists $DB with (force)" "drop role if exists $APP_ROLE" \
  "create database $DB" "create role $APP_ROLE login noinherit password '$APP_PW'"
echo "→ migrations"
DATABASE_URL="$ADMIN/$DB" node scripts/migrate.mjs --backend postgres | tail -2
sql "$ADMIN/$DB" "grant connect on database $DB to $APP_ROLE" "grant anon, authenticated, service_role to $APP_ROLE"
echo "→ demo data (example people and requests) and an admin"
node -e '
  const { Client } = require("pg"); const fs = require("fs"); const c = new Client({ connectionString: process.argv[1] });
  c.connect().then(async () => { await c.query(fs.readFileSync("supabase/dev/demo.sql", "utf8")); await c.end(); })
   .catch(e => { console.error(e.message); process.exit(1); });' "$ADMIN/$DB"
DATABASE_URL="$ADMIN/$DB" node scripts/add-user.mjs --email admin@example.com --name "Admin Example" --role admin

echo "→ production server on port $PORT (postgres mode)"
rm -rf "$SA/.next/static" "$SA/public"; cp -r .next/static "$SA/.next/static"; cp -r public "$SA/public"
APP_URL="http://localhost:$PORT"
APP_DB_URL=$(node -e 'const u = new URL(process.argv[1] + "/" + process.argv[2]); u.username = process.argv[3]; u.password = process.argv[4]; console.log(u.href)' "$ADMIN" "$DB" "$APP_ROLE" "$APP_PW")
( cd "$SA" && exec env TZ=UTC CIRCUIT_BACKEND=postgres NODE_ENV=production PORT=$PORT HOSTNAME=127.0.0.1 \
    DATABASE_URL="$APP_DB_URL" \
    CIRCUIT_SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')" \
    SITE_URL="$APP_URL" ENTRA_ISSUER=http://127.0.0.1:3201 ENTRA_ALLOW_INSECURE_ISSUER=1 ENTRA_TENANT_ID=test-tenant-0000 \
    ENTRA_CLIENT_ID=circuit-test ENTRA_CLIENT_SECRET=circuit-test-secret-0123456789 \
    node server.js > /tmp/circuit-e2e-server.log 2>&1 ) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf "$APP_URL/api/health" >/dev/null 2>&1 && break; sleep 1; done
curl -s "$APP_URL/api/health"; echo
APP="$APP_URL" node tests/e2e-postgres.mjs 2>&1 | grep -v "oidc-provider \(WARNING\|NOTICE\)"

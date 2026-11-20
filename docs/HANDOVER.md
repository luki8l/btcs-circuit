# Circuit · handover to IT

Everything needed to run Circuit on Bitcoin Suisse infrastructure (Azure, Azure DevOps, Microsoft sign-in):
what it is made of, every setting, the one-time setup, moving the data over, and day-to-day operation.

**Short version.** One container image (Next.js/Node 22) plus one PostgreSQL database. Sign-in with the Bitcoin Suisse
Microsoft account (Entra ID). The pipeline in `azure-pipelines.yml` tests, builds the image, updates the database and
rolls out. No Supabase, no Vercel, no passwords in Azure mode.

---

## 1. What Circuit is

An internal web app for external events: sales find a conference and request a spot, the events team (Roman)
approves, management sees coverage and cost. About 10–30 users, all Bitcoin Suisse employees. Optional link to
HubSpot (the custom object "Events").

Roles (set per account by an admin in the app, page *People*):

| Role | Who | Can |
| --- | --- | --- |
| `admin` | app owner(s) | everything, including accounts |
| `events` | Roman (CEO) | approve requests, keep the event catalogue |
| `management` | leadership | see everything, change nothing |
| `sales` | relationship managers | request spots, suggest events, debrief |

## 2. Architecture

```
Browser ──HTTPS──► Circuit container (Next.js server, Node 22, port 3000)
                     │  /auth/microsoft, /auth/callback ──► Microsoft Entra ID (OpenID Connect, code flow + PKCE)
                     │  every page / API call ──► PostgreSQL (DATABASE_URL, app role, TLS)
                     │  optional ──► HubSpot API (service key)
                     └  /api/health (no sign-in): is the app up, can it reach the database?
```

* **The database holds the rules.** Users never read or write tables directly. Every action is a database
  function that checks the caller's role and writes an activity log entry (`supabase/migrations/*.sql`).
  Per request the server opens a transaction, sets the signed-in user (`request.jwt.claims`), switches to the
  role `authenticated` and calls the function. Row access is therefore enforced by PostgreSQL itself, not only by
  the app.
* **Two modes, one code base.** `CIRCUIT_BACKEND` selects them:

  | | today (pilot) | Azure (`CIRCUIT_BACKEND=postgres`) |
  | --- | --- | --- |
  | hosting | Vercel (Stockholm) | your container platform |
  | database | Supabase PostgreSQL | any PostgreSQL ≥ 15 (Azure Database for PostgreSQL Flexible Server) |
  | sign-in | e-mail + password, one-time sign-in links | Microsoft (Entra ID) only |
  | session | Supabase Auth cookie | Circuit's own signed cookie (`circuit_session`, HttpOnly) |

  The database schema is the same. `db/postgres/00_auth_compat.sql` adds the small part of Supabase the schema
  uses (three roles, `auth.users`, `auth.uid()`); `db/postgres/90_postgres_mode.sql` adds the Microsoft sign-in
  and session functions. Both are applied automatically by the migration script in Azure mode only.
* **Settings are read when the container starts, not at build time.** The same image runs in test and production.

### Files that matter for operation

| Path | What |
| --- | --- |
| `Dockerfile` | the image: production server, migrations, admin scripts; runs as non-root user `circuit` (uid 1001) |
| `azure-pipelines.yml` | Azure DevOps: test → image → migrate → deploy → health check |
| `scripts/migrate.mjs` | database changes, each exactly once, remembered in `public.circuit_migrations` |
| `scripts/add-user.mjs` | first admin, rename an e-mail, list accounts (database admin connection) |
| `scripts/transfer-data.mjs` | one-time move of all data from Supabase to Azure |
| `supabase/migrations/` | the schema and its changes (names are historic; they are plain SQL) |
| `db/postgres/` | the Azure-mode additions (see above) |
| `tests/postgres-e2e.sh` | the Azure mode end to end on one machine (also runs in the pipeline) |

## 3. Settings (environment variables)

Azure mode. Put the secrets in Key Vault and reference them from the container settings.

| Variable | Required | Secret | Meaning |
| --- | --- | --- | --- |
| `CIRCUIT_BACKEND` | yes | no | `postgres` |
| `SITE_URL` | yes | no | the public address users open, e.g. `https://circuit.bitcoinsuisse.com` (no trailing slash). Used for the Microsoft redirect and all redirects; must be the public HTTPS address, not the container's internal one |
| `DATABASE_URL` | yes | **yes** | the **app role** connection, e.g. `postgres://circuit_app:…@<server>.postgres.database.azure.com:5432/circuit?sslmode=verify-full` |
| `CIRCUIT_SESSION_SECRET` | yes | **yes** | ≥ 32 random characters; signs the session cookie. Generate: `openssl rand -base64 48`. Changing it signs everyone out |
| `ENTRA_TENANT_ID` | yes | no | Directory (tenant) ID. Only accounts from this tenant get in |
| `ENTRA_CLIENT_ID` | yes | no | Application (client) ID of the app registration |
| `ENTRA_CLIENT_SECRET` | yes | **yes** | client secret of the app registration (note its expiry date) |
| `CIRCUIT_SESSION_DAYS` | no | no | how long a sign-in lasts, default 30 (1–400). After that, Microsoft signs people in again, usually without a click |
| `PGPOOL_MAX` | no | no | database connections per container, default 5 |
| `HUBSPOT_SERVICE_KEY` | no | **yes** | HubSpot service key (scopes `crm.objects.custom.read`, `crm.objects.custom.write`). Without it the HubSpot features are hidden |
| `HUBSPOT_AUTO_SYNC` | no | no | `on`: events go to HubSpot automatically once someone is approved to go |
| `HUBSPOT_EVENTS_OBJECT` | no | no | object type id of HubSpot's "Events" object; found automatically if empty |
| `CIRCUIT_VERSION` | no | no | shown by `/api/health`; the pipeline sets it to the build number |
| `PORT` | no | no | default 3000 (set in the image) |

Pilot mode (Vercel + Supabase) instead uses `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
`SITE_URL` (the older `NEXT_PUBLIC_…` names still work). `CIRCUIT_LOCAL_*` and `ENTRA_ISSUER` /
`ENTRA_ALLOW_INSECURE_ISSUER` are for development and tests only; never set them in production.

## 4. One-time setup in Azure

Names below are examples. Order matters only where noted.

### 4.1 PostgreSQL

1. Create **Azure Database for PostgreSQL – Flexible Server**, PostgreSQL 16 (tested with 16), in Switzerland North
   or your usual region. Smallest burstable size is enough for this app. Authentication: PostgreSQL authentication
   (the admin login runs the migrations).
2. Networking: either private access in your VNet (recommended) or public access with firewall rules. The
   container must reach it; so must whoever runs the migrations (see 4.5).
3. Create the database `circuit`.
4. Create the app's own login (connected as the server admin). It gets no rights of its own; it may only switch
   to the three roles the app uses:

   ```sql
   create role circuit_app login noinherit password '<long random password>';
   grant connect on database circuit to circuit_app;
   ```
5. Run the migrations once (4.5), then, still as the admin:

   ```sql
   grant anon, authenticated, service_role to circuit_app;
   ```
   (The three roles are created by the first migration run.)
6. `DATABASE_URL` for the app = `postgres://circuit_app:<password>@<server>.postgres.database.azure.com:5432/circuit?sslmode=verify-full`.
   Azure requires TLS. If Node rejects the server certificate, add Azure's root certificate with
   `NODE_EXTRA_CA_CERTS=/path/to/root.pem` (mount it into the container).

### 4.2 Microsoft sign-in (Entra ID app registration)

1. Entra admin center → App registrations → **New registration**: name `Circuit`, *Accounts in this organizational
   directory only*, redirect URI platform **Web**: `<SITE_URL>/auth/callback`
   (e.g. `https://circuit.bitcoinsuisse.com/auth/callback`). For a test environment add its own redirect URI.
2. **Certificates & secrets** → New client secret → copy the *Value* → `ENTRA_CLIENT_SECRET`. Put its expiry
   date in the team calendar: when it expires nobody can sign in until a new one is set.
3. **Overview**: *Application (client) ID* → `ENTRA_CLIENT_ID`, *Directory (tenant) ID* → `ENTRA_TENANT_ID`.
4. **API permissions**: Microsoft Graph, delegated: `openid`, `profile`, `email` (`User.Read` may stay). *Grant
   admin consent*, so nobody is asked on first sign-in.
5. Optional, **Token configuration** → Add optional claim → ID token → `email`. Without it Circuit uses the
   sign-in name (UPN), which at Bitcoin Suisse is usually the e-mail anyway.
6. Optional, Enterprise applications → Circuit → Properties → *Assignment required* = Yes, and assign a group.
   Not needed for security: Circuit lets in only people an admin has given an account (see 5).

How a sign-in works: code flow with PKCE, state and nonce; the ID token is checked (signature, issuer, audience,
expiry, nonce) and must come from `ENTRA_TENANT_ID`. Circuit then looks for the account by the Microsoft object id
(`oid`); on someone's very first sign-in by e-mail, and from then on it remembers the object id. No Circuit account
→ "There is no Circuit account for … yet", nothing else happens.

### 4.3 Container

Either **Azure Container Apps** (simplest) or **App Service (Web App for Containers)**. The pipeline supports both
(`deployTarget`).

* Image: `<registry>.azurecr.io/circuit:<build number>`, pulled with the app's managed identity (role *AcrPull*).
* Port 3000 (App Service: app setting `WEBSITES_PORT=3000`). HTTPS only, at the platform.
* Health probe: `GET /api/health` → 200 `{"ok":true,"backend":"postgres","db":"ok",…}`, 503 when the database is
  unreachable. No sign-in needed, returns no data.
* 1 replica is enough; 2+ work (sessions live in a signed cookie and the database, nothing in memory).
* The settings from 3, secrets as Key Vault references.
* Logs go to stdout/stderr (Log Analytics). Sign-in failures are logged as `microsoft sign-in …`.
* Custom domain + certificate for `SITE_URL`.

### 4.4 Azure DevOps

1. Import the repository (or mirror it) into Azure Repos.
2. Project settings → Service connections: one **Azure Resource Manager** connection (the resource group) and one
   **Docker Registry** connection to the Azure Container Registry.
3. Pipelines → Library → variable group **`circuit-production`** with the secret `MIGRATE_DATABASE_URL` = the
   **admin** connection (`postgres://<admin>:…@<server>…/circuit?sslmode=verify-full`); can be linked to Key Vault.
4. Pipelines → Environments → **`circuit-production`**; add an approval if deploys should wait for someone.
5. Fill the `CHANGE-ME` values at the top of `azure-pipelines.yml`, create the pipeline from that file, and allow
   it to use the variable group and environment on its first run.

What it does:

| Stage | When | Steps |
| --- | --- | --- |
| Test | every PR and push | `npm ci`, typecheck, database tests, HubSpot tests, production build, **Azure mode end to end** (PostgreSQL 16 container with a non-superuser admin like Azure's, Microsoft sign-in stand-in, browser) |
| Image | push to `main` | build the Dockerfile, push `circuit:<build id>` and `circuit:latest` |
| Deploy | after Image | migrations with the new image → roll out → wait until `/api/health` reports the new version and `db: ok` |

The deploy job runs on Microsoft-hosted agents. If the database is private (VNet) or the app is not reachable from
the internet, use a self-hosted agent pool inside the network for that stage (change `pool:`), or run the
migration step by hand (4.5).

### 4.5 Database migrations

Each `.sql` file runs once, in name order, in its own transaction; a lock stops two runs at once. What ran is in
`public.circuit_migrations` (file, checksum, time).

```bash
# with the image (what the pipeline does)
docker run --rm -e DATABASE_URL='<admin connection>' <registry>/circuit:<tag> node scripts/migrate.mjs --backend postgres
# or from a checkout:  npm ci && DATABASE_URL='<admin connection>' node scripts/migrate.mjs --backend postgres
node scripts/migrate.mjs --backend postgres --status     # what ran, what is pending; changes nothing
```

A new database gets the full schema and the event catalogue (267 events from the masterlist). Later changes are new
files; a file that already ran is never edited (the script stops if one changed).

### 4.6 The first admin

```bash
DATABASE_URL='<admin connection>' node scripts/add-user.mjs --email anna.muster@bitcoinsuisse.com --name "Anna Muster" --role admin
```
(Also inside the image: `docker run --rm -e DATABASE_URL=… <image> node scripts/add-user.mjs …`.) Everyone else
is added by an admin in the app.

## 5. Accounts

* An admin adds a colleague under **People** (name, Bitcoin Suisse e-mail, role, team). Nothing to send: the person
  opens Circuit and signs in with Microsoft.
* **Deactivate** under People: the next click of that person ends their session; they cannot sign in again.
* **Your account → Sign out on all other devices** ends every other session of that person.
* The e-mail in Circuit must be the one Microsoft reports (usually the UPN). If someone's differs:
  `node scripts/add-user.mjs --rename old@… new@…` (they then sign in once more by e-mail).
* `node scripts/add-user.mjs --list` lists all accounts with their last sign-in.

## 6. Moving the data from the pilot (Supabase) — once

Everything is copied with the same ids: accounts (without passwords), profiles, events, requests, flags,
suggestions, activity log. All or nothing (one transaction).

1. Tell users about a short freeze (no changes for ~15 minutes).
2. Target ready: 4.1 and 4.5 done (schema exists).
3. Source connection: Supabase dashboard → Connect → connection string (use the *Session pooler* string if your
   network has no IPv6). Read-only use; nothing is changed there.
4. Dry run, then the real run:

   ```bash
   SOURCE_DATABASE_URL='<supabase>' DATABASE_URL='<azure admin>' node scripts/transfer-data.mjs --dry-run
   SOURCE_DATABASE_URL='<supabase>' DATABASE_URL='<azure admin>' node scripts/transfer-data.mjs
   ```
   It prints the row counts per table and the accounts per e-mail domain. Accounts that are not
   `@bitcoinsuisse.com` (tests, private addresses) cannot sign in with Microsoft: rename them (5) or deactivate them.
   A second run is refused unless `--replace` (wipes the target first).
5. Point the domain to Azure, sign in, check *My events* and *Requests* against the pilot.
6. Keep the Supabase project read-only for a few weeks, then delete it.

## 7. Operation

| Task | How |
| --- | --- |
| deploy a change | merge to `main`; the pipeline does the rest |
| is it up? | `GET /api/health`; container platform health probe |
| roll back the app | redeploy the previous image tag (Container App revision / Web App deployment) |
| roll back a migration | not automatic: write a new migration that undoes it, or restore the database (below) |
| new client secret | create it in the app registration, update Key Vault, restart; delete the old secret |
| sign everyone out | change `CIRCUIT_SESSION_SECRET` and restart |
| HubSpot errors | container logs (`hubspot …`); `GET /api/hubspot/check` as an admin shows what the key sees |

### Backup and restore

* Flexible Server makes automatic backups (retention configurable, 7 days by default, up to 35) and restores to any
  point in that window **as a new server**. Restore → point the app's `DATABASE_URL` (and the pipeline's
  `MIGRATE_DATABASE_URL`) to the new server → recreate `circuit_app`'s password if needed → restart.
* For longer retention, a nightly `pg_dump -Fc` of the database `circuit` to a storage account. Restore with
  `pg_restore --no-owner -d circuit <file>` into an empty database, run `node scripts/migrate.mjs --backend postgres
  --status` to confirm nothing is pending, then step 4.1/5 for the app role.
* The data is small (hundreds of rows); a dump takes seconds.

## 8. Security notes

* Sign-in only with a Bitcoin Suisse Microsoft account (tenant check) **and** an account created by a Circuit admin.
* Session: signed cookie (HS256), `HttpOnly`, `Secure`, `SameSite=Lax`; checked against the database on every
  request (account active, not signed out everywhere).
* Database: the app login has no rights of its own (`noinherit`); per request it switches to `authenticated` and can
  only call the functions, which check the role. Tables are not readable directly. New tables and functions start
  closed. Activity log cannot be edited.
* Browser: Content Security Policy with a per-request nonce, no framing, HSTS, same-origin checks on `/api/act`.
* Secrets: only in Key Vault / pipeline secret variables; nothing secret in the image or the repository.
* Dependencies: pinned versions (`package-lock.json`); `npm audit` before each release.
* Data: names, work e-mails, roles, which events people attend, costs, notes. No customer data from HubSpot is
  stored; Circuit only writes event name, place and dates to HubSpot's Events object.

## 9. Testing the Azure mode

`tests/postgres-e2e.sh` does it all on one machine: a fresh database (`circuit_e2e`) created as a non-superuser,
migrations, the app role, demo data, the production server, Microsoft sign-in against a stand-in provider
(`tests/mock-oidc.mjs`, not part of the app), then a browser walks through: sign-in for sales, events and admin;
unknown person and foreign organisation refused; an admin adds a colleague who can sign in at once; deactivation
ends a running session; sign out on other devices; Roman approves; sign out.

```bash
npm ci && npm run build && npx playwright install chromium
PG_ADMIN_URL=postgres://<admin>:<pw>@127.0.0.1:5432 npm run test:e2e:postgres
```

Other tests: `npm run typecheck`, `npm run test:sql` (schema and access rules), `npm run test:hubspot`, and the
browser tests in `tests/` against the local development mode (see README).

## 10. If something is wrong

| Symptom | Cause / fix |
| --- | --- |
| Login page: "Microsoft sign-in is not set up yet" | `ENTRA_*`, `SITE_URL` or `CIRCUIT_SESSION_SECRET` missing; container log says which |
| Microsoft shows "redirect URI mismatch" | the app registration's redirect URI must be exactly `<SITE_URL>/auth/callback` |
| "Please sign in with your Bitcoin Suisse Microsoft account" | token from another tenant, or `ENTRA_TENANT_ID` wrong |
| "There is no Circuit account for x yet" | add the person under People, or `--rename` their e-mail (5) |
| "Your Circuit account is switched off" | an admin switches it back on under People |
| Page "Not set up yet" | migrations have not run against this database (4.5) |
| `/api/health` 503 | database unreachable: `DATABASE_URL`, firewall/VNet, TLS, `circuit_app` password |
| "permission denied to set role" in the log | step 4.1/5 (`grant anon, authenticated, service_role to circuit_app`) missing |
| everyone signed out at once | `CIRCUIT_SESSION_SECRET` changed (expected) |

## 11. What has been verified, and what not yet

Verified on PostgreSQL 16 with a non-superuser admin (like Azure's): migrations from an empty database, the data
transfer script, the production server in Azure mode, and the full browser test in 9 (all passing). The pilot mode
on Vercel + Supabase runs unchanged.

Not yet verified, because it needs Bitcoin Suisse's Azure: the real Entra ID sign-in (the stand-in provider speaks
the same protocol), the Docker image build and the pipeline run on Azure DevOps, Azure's TLS certificate with
`sslmode=verify-full`. Expect small fixes on the first run of each.

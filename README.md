# Circuit · Bitcoin Suisse

External events in one place: sales find a conference, request their spot, the events team approves it in one click,
sales log it in HubSpot and debrief afterwards. Management sees coverage, cost and leads per event.

**Pilot rule: the catalogue comes from the internal events masterlist and the accounts are real colleagues.
Get IT and Compliance to sign off the hosting (Supabase eu-north-1 Stockholm / Vercel arn1) before rolling it out widely.**

## What's in it

| Page | Who | What |
| --- | --- | --- |
| Events | everyone | List (default), month calendar, year view; filter dropdowns with counts, quick views, full screen, ⌘K jump, “Request a spot” on every row |
| Event drawer | everyone | Who goes, policy for the tier, buy-side fit, team rating, masterlist notes; request / change / debrief |
| My events | everyone | Own requests, HubSpot step, 60-second debrief, own suggestions |
| Team | everyone | People × months: who goes where (approved solid, waiting dashed) |
| Requests | events, admin (management read-only) | Inbox with bulk approve/decline, decided (reopen), coverage gaps (flag, send someone), suggestions |
| Catalogue | events, admin | Every event: add, edit, archive |
| Overview | events, management, admin | Season ahead, key events without anyone, events per month, coverage by region, results per event |
| People | admin | Create accounts (sign-in link to copy), roles, market, team, deactivate; activity log |

Roles: `admin` (everything + accounts) · `events` (approves, keeps the catalogue) · `management` (sees everything, read-only) · `sales` (requests, debriefs).

## Architecture

```
Browser ─► Next.js (Vercel, arn1) ─► /api/act { fn, args }  (zod-validated, whitelist)
                                 └► server components: bootstrap()           ▼
                                                     Supabase Postgres: tables read-only, every write through a
                                                     SECURITY DEFINER function that checks the role and logs activity
```

* **The database owns the rules** (`supabase/migrations`): roles, policy (Tier 4–5 need a reason), one active request per person and event, only approved requests can be debriefed, only after the event started, activity log nobody can edit.
* The role comes only from `app_metadata` (set by the server with the secret key), never from what someone types.
* Accounts: an admin creates them under People; the app shows a one-time sign-in link (valid 1 h; make a new one under People if it ran out) to send via Teams. Sign-ups are off.

## Security

* **Access**: every page and API call needs a signed-in, active account (middleware + the database again). Sign-ups are off; only an admin creates accounts. Deactivating someone also blocks their login in Supabase Auth, which ends their sessions on every device.
* **Database**: anonymous visitors can't read or call anything. Signed-in users can't read or write tables directly; everything goes through the functions, which check the role. New tables and functions start closed (default privileges revoked); each migration grants what it needs. `npm run test:sql` checks all of this.
* **Sessions**: cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, 400 days (people stay signed in). The browser never talks to Supabase; the Supabase URL and key are not in the page code. Account → *Sign out on all other devices*; changing the password does that too.
* **Passwords**: sign-in and the current-password check are throttled (8 wrong tries for one e-mail from one address, 30 from one address, or 20 for one e-mail from anywhere → 15 minutes wait; `public.login_attempts`, kept one day, server only). A new password without the current one only right after a sign-in link (< 1 h).
* **Browser**: Content Security Policy with a per-request nonce (only the app's own scripts run), no framing, no referrer to other sites, HSTS, Permissions-Policy, same-origin opener/resource policy. `/api/act` accepts same-origin JSON only; links in events and suggestions must be `http(s)://` (API, database and display).
* **Dependencies**: `npm audit` clean (postcss and uuid pinned to patched versions via `overrides`).

## HubSpot

Circuit links each event to a record in HubSpot's custom object **Events** (one record per event, not per person) and sends
four fields: Event Name, Event Location ("City, Country"), Event Start Date, Event End Date.

* **Times**: events can have a start and end time (catalogue editor), meant as local time at the event. The time zone comes from the city or country (`lib/tz.ts`, Vienna if unknown). Without times, HubSpot gets the whole days (00:00 to 23:59). Month-only and TBD events go over without dates.
* **Manual (now)**: in the event drawer, Roman and admins see the HubSpot panel. "Prepare for HubSpot" only reads: it shows what would be sent and HubSpot events that look the same (name, overlapping days in the event's time zone). Then: *Create in HubSpot*, *Link this one* (nothing written to HubSpot), *Update in HubSpot* (overwrites the four fields) or *Unlink* (HubSpot keeps the record). Sales see "Event is in HubSpot" instead of the manual step once an event is linked.
* **Automatic (off)**: with `HUBSPOT_AUTO_SYNC=on` in Vercel, an approval or "Send someone" creates the record (an exact existing one is linked instead), and editing a linked event updates it. Runs after the response; errors are in the Vercel logs.
* **Key**: `HUBSPOT_SERVICE_KEY` (Vercel, sensitive). Needs `crm.objects.custom.read` and `crm.objects.custom.write`. `GET /api/hubspot/check` (admins) shows what the key can see; it returns no contact or deal records.
* **Tests**: `npm run test:hubspot` (fields, time zones), `tests/e2e-hubspot.mjs` against a local fake HubSpot (`CIRCUIT_HUBSPOT_FAKE=1`, nothing leaves the machine).

## Setup (once)

1. Supabase project (EU region; this one runs in Stockholm, eu-north-1, so Vercel functions run in arn1 next to it). SQL Editor: run `supabase/migrations/*.sql` in order (the second file seeds the 267 masterlist events).
2. Authentication → Sign-ups off. URL configuration: Site URL = the Vercel URL. Email OTP expiry: 3600 s (links valid 1 h).
3. Vercel: import the repo, env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `NEXT_PUBLIC_SITE_URL`.
4. First admin: create the user in Supabase (Authentication → Add user) with app metadata `{"role":"admin"}`, or `update public.profiles set role = 'admin' where email = '…';`.

Later database changes come as new files in `supabase/migrations` (date-prefixed); never edit a migration that has run.

## Updating the catalogue from a new masterlist

```
python3 scripts/extract_masterlist.py "Masterlist.xlsx" /tmp/masterlist.json
python3 scripts/masterlist_to_sql.py /tmp/masterlist.json supabase/migrations/<date>_masterlist.sql
```
The seed only runs on an empty catalogue; for updates edit events in the app (Catalogue) or write a migration.

## Local development and tests

* `npm run test:sql` — the migrations against real Postgres (PGlite): access rules, roles, requests, debriefs, accounts.
* `CIRCUIT_LOCAL_DB=1 CIRCUIT_LOCAL_DEMO=1 CIRCUIT_LOCAL_ADMINS=you@x.com CIRCUIT_LOCAL_ROLES=roman@example.com:events,ceo@example.com:management npx next dev` — the whole app on an in-memory Postgres with made-up people and requests (`supabase/dev/demo.sql`); any e-mail, password `demo`. Development only, never in a production build.
* `node tests/e2e.mjs` — browser walk-through of every role against the local app (screenshots in `.e2e-shots/`).

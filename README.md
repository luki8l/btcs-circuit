# Circuit · Bitcoin Suisse

External events in one place: sales find a conference, request their spot, the events team approves it in one click,
sales log it in HubSpot and debrief afterwards. Management sees coverage, cost and leads per event.

**Pilot rule: the catalogue comes from the internal events masterlist and the accounts are real colleagues.
Get IT and Compliance to sign off the hosting (Supabase eu-north-1 Stockholm / Vercel arn1) before rolling it out widely.**

## What's in it

| Page | Who | What |
| --- | --- | --- |
| Discover | everyone | Season map (tier × month), month calendar, list; filters with counts, quick views, full screen, ⌘K jump |
| Event drawer | everyone | Who goes, policy for the tier, buy-side fit, team rating, masterlist notes; request / change / debrief |
| My events | everyone | Own requests, HubSpot step, 60-second debrief, own suggestions |
| Team | everyone | People × months: who goes where (approved solid, waiting dashed) |
| Approvals | events, admin | Inbox with bulk approve/decline, decided (reopen), coverage gaps (flag, send someone), suggestions |
| Catalogue | events, admin | Every event: add, edit, archive |
| Insights | events, management, admin | Coverage, spend, leads, cost per lead, results per event / tier / person |
| People | admin | Create accounts (sign-in link to copy), roles, market, team, deactivate; activity log |

Roles: `admin` (everything + accounts) · `events` (approves, keeps the catalogue) · `management` (sees everything, read-only) · `sales` (requests, debriefs).

## Architecture

```
Browser ─► Next.js (Vercel, fra1) ─► /api/act { fn, args }  (zod-validated, whitelist)
                                 └► server components: bootstrap()           ▼
                                                     Supabase Postgres: tables read-only, every write through a
                                                     SECURITY DEFINER function that checks the role and logs activity
```

* **The database owns the rules** (`supabase/migrations`): roles, policy (Tier 4–5 need a reason), one active request per person and event, only approved requests can be debriefed, only after the event started, activity log nobody can edit.
* The role comes only from `app_metadata` (set by the server with the secret key), never from what someone types.
* Accounts: an admin creates them under People; the app shows a one-time sign-in link (24 h) to send via Teams. Sign-ups are off.

## Setup (once)

1. Supabase project (EU region; this one runs in Stockholm, eu-north-1, so Vercel functions run in arn1 next to it). SQL Editor: run `supabase/migrations/*.sql` in order (the second file seeds the 267 masterlist events).
2. Authentication → Sign-ups off. URL configuration: Site URL = the Vercel URL. Email OTP expiry: 86400 s (links valid 24 h).
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

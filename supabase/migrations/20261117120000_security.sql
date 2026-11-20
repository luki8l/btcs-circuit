-- Security hardening. Safe to run again.

-- 1. The app reads only through the functions (bootstrap, me, …). Signed-in users no longer read the tables directly,
--    so a stolen session can't page through raw rows (e-mail addresses, notes) outside what the app shows.
revoke select on public.profiles, public.events, public.requests, public.flags, public.suggestions from authenticated;

-- 2. Nothing new in the public schema is open by default: Supabase grants new tables and functions to anon and
--    authenticated automatically. Future migrations grant exactly what they need, like the ones before.
--    (for the role that runs the migrations: postgres on Supabase, the server admin on plain Postgres / Azure)
do $$ declare r text; begin
  foreach r in array array['postgres', current_user] loop
    if exists (select 1 from pg_roles where rolname = r) and pg_has_role(current_user, r, 'MEMBER') then
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke execute on functions from public, anon, authenticated', r);
    end if;
  end loop;
end $$;

-- 3. Links are web links only (no javascript:, data: …), checked again here after the app.
alter table public.events drop constraint if exists events_website_http;
alter table public.events add constraint events_website_http check (website is null or website ~* '^https?://[^\s]+$');
alter table public.suggestions drop constraint if exists suggestions_website_http;
alter table public.suggestions add constraint suggestions_website_http check (website = '' or website ~* '^https?://[^\s]+$');

-- 4. Sign-in throttle. Failed attempts per e-mail and network address; the server checks before each sign-in and
--    password check. Only the server (secret key) can use it. Entries are kept one day.
create table if not exists public.login_attempts (
  id    bigint generated always as identity primary key,
  at    timestamptz not null default now(),
  email text not null check (length(email) <= 320),
  ip    text not null default '' check (length(ip) <= 64)
);
create index if not exists login_attempts_email_at on public.login_attempts (email, at desc);
create index if not exists login_attempts_ip_at on public.login_attempts (ip, at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;

-- seconds until this e-mail may try again from this address; 0 = go ahead.
-- Locked for 15 minutes after: 8 failures for this e-mail from this address, 30 from this address (any e-mail),
-- or 40 for this e-mail from anywhere (spread-out guessing).
create or replace function public.login_wait(p_email text, p_ip text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, ''))); i text := coalesce(p_ip, ''); since timestamptz := now() - interval '15 minutes';
        pair integer; by_ip integer; by_mail integer; last timestamptz;
begin
  select count(*) filter (where email = e and ip = i), count(*) filter (where ip = i and i <> ''), count(*) filter (where email = e), max(at)
    into pair, by_ip, by_mail, last
  from public.login_attempts where at > since and (email = e or (ip = i and i <> ''));
  if pair >= 8 or by_ip >= 30 or by_mail >= 40 then
    return greatest(1, ceil(extract(epoch from (last + interval '15 minutes' - now())))::integer);
  end if;
  return 0;
end $$;

-- after an attempt: a failure is counted; a success clears this e-mail's failures from this address (own typos)
create or replace function public.login_note(p_email text, p_ip text, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := left(lower(btrim(coalesce(p_email, ''))), 320); i text := left(coalesce(p_ip, ''), 64);
begin
  delete from public.login_attempts where at < now() - interval '1 day';
  if coalesce(p_ok, false) then
    delete from public.login_attempts where email = e and ip = i;
  else
    insert into public.login_attempts (email, ip) values (e, i);
  end if;
end $$;

revoke all on function public.login_wait(text, text) from public, anon, authenticated;
revoke all on function public.login_note(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_wait(text, text) to service_role;
grant execute on function public.login_note(text, text, boolean) to service_role;

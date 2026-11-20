-- Plain PostgreSQL only, after the migrations: sign-in with Microsoft (Entra ID), sessions, creating accounts.
-- NEVER run this on Supabase (there, Supabase Auth does these jobs). Safe to run again.

-- Microsoft sign-in: find the Circuit account for a Microsoft login. First by the Microsoft object id (stable),
-- else by e-mail (first sign-in), then remember the object id. Only the server calls this (service_role).
create or replace function auth.entra_sign_in(p_email text, p_oid text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u auth.users; e text := lower(btrim(coalesce(p_email, ''))); o text := btrim(coalesce(p_oid, ''));
begin
  if o = '' then raise exception 'oid missing' using errcode = '22023'; end if;
  select * into u from auth.users where raw_user_meta_data ->> 'entra_oid' = o;
  if u.id is null and e <> '' then
    select * into u from auth.users where lower(email) = e and coalesce(raw_user_meta_data ->> 'entra_oid', '') = '';
  end if;
  if u.id is null then return jsonb_build_object('status', 'no_account'); end if;
  if not exists (select 1 from public.profiles where id = u.id and active) then return jsonb_build_object('status', 'inactive'); end if;
  update auth.users set last_sign_in_at = now(), raw_user_meta_data = raw_user_meta_data || jsonb_build_object('entra_oid', o) where id = u.id;
  return jsonb_build_object('status', 'ok', 'id', u.id, 'iat', floor(extract(epoch from now()))::bigint);
end $$;

-- every request: is this session still good? (account active, not signed out everywhere since it started)
create or replace function auth.session_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and p.active
      and (u.sessions_after is null or u.sessions_after <= to_timestamp(coalesce((auth.jwt() ->> 'iat')::bigint, 0))))
$$;

-- "sign out on all other devices": sessions started before now are void; returns the new start for this device
create or replace function auth.sessions_reset() returns bigint
language plpgsql security definer set search_path = '' as $$
declare t timestamptz := date_trunc('second', now());
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update auth.users set sessions_after = t where id = auth.uid();
  return extract(epoch from t)::bigint;
end $$;

-- admin: new account; the person signs in with Microsoft using this e-mail (no password, no link)
create or replace function public.person_create(p_email text, p_name text, p_role text, p_market text default '', p_team text default '', p_title text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, ''))); id uuid;
begin
  perform public.require_role(array['admin']);
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail address.' using errcode = '22023'; end if;
  if p_role not in ('admin', 'events', 'management', 'sales') then raise exception 'invalid role' using errcode = '22023'; end if;
  if exists (select 1 from auth.users where lower(email) = e) then raise exception 'An account with this e-mail exists already.' using errcode = '23505'; end if;
  insert into auth.users (email, raw_user_meta_data, raw_app_meta_data)
  values (e, jsonb_build_object('name', btrim(coalesce(p_name, '')), 'market', btrim(coalesce(p_market, '')), 'team', btrim(coalesce(p_team, '')), 'title', btrim(coalesce(p_title, ''))),
          jsonb_build_object('role', p_role))
  returning auth.users.id into id;
  perform public.log('person_save', null, null, jsonb_build_object('name', btrim(coalesce(p_name, '')), 'created', true));
  return jsonb_build_object('id', id);
end $$;

revoke all on function auth.entra_sign_in(text, text), auth.session_ok(), auth.sessions_reset(), public.person_create(text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function auth.entra_sign_in(text, text) to service_role;
grant execute on function auth.session_ok(), auth.sessions_reset(), public.person_create(text, text, text, text, text, text) to authenticated;

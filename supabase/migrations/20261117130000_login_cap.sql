-- Sign-in throttle: at most 20 wrong passwords per e-mail in 15 minutes from anywhere (was 40). Addresses are cheap
-- to rotate, so this per-e-mail cap is the real limit for guessing one person's password.
-- (8 per e-mail and address, and 30 per address, stay as they are.)
create or replace function public.login_wait(p_email text, p_ip text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, ''))); i text := coalesce(p_ip, ''); since timestamptz := now() - interval '15 minutes';
        pair integer; by_ip integer; by_mail integer; last timestamptz;
begin
  select count(*) filter (where email = e and ip = i), count(*) filter (where ip = i and i <> ''), count(*) filter (where email = e), max(at)
    into pair, by_ip, by_mail, last
  from public.login_attempts where at > since and (email = e or (ip = i and i <> ''));
  if pair >= 8 or by_ip >= 30 or by_mail >= 20 then
    return greatest(1, ceil(extract(epoch from (last + interval '15 minutes' - now())))::integer);
  end if;
  return 0;
end $$;

revoke all on function public.login_wait(text, text) from public, anon, authenticated;
grant execute on function public.login_wait(text, text) to service_role;

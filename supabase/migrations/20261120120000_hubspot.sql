-- HubSpot: optional event times (local at the event) and the link to the HubSpot "Events" record. Safe to run again.

alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists end_time time;
alter table public.events add column if not exists hubspot_id text;
alter table public.events add column if not exists hubspot_synced_at timestamptz;
alter table public.events drop constraint if exists events_hubspot_id_digits;
alter table public.events add constraint events_hubspot_id_digits check (hubspot_id is null or hubspot_id ~ '^[0-9]{1,30}$');
create unique index if not exists events_hubspot_id_unique on public.events (hubspot_id) where hubspot_id is not null;

create or replace function public.event_json(e public.events) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'name', e.name, 'website', e.website, 'start', e.start_date, 'end', e.end_date,
    'startTime', to_char(e.start_time, 'HH24:MI'), 'endTime', to_char(e.end_time, 'HH24:MI'),
    'mode', e.date_mode, 'dateNote', e.date_note, 'region', e.region, 'country', e.country, 'city', e.city,
    'kind', e.kind, 'focus', e.focus, 'tier', e.tier, 'tierPrev', e.tier_prev,
    'ratingAvg', e.rating_avg, 'ratingSd', e.rating_sd, 'ratingMedian', e.rating_median, 'ratingN', e.rating_n,
    'ratingDist', to_jsonb(e.rating_dist), 'fit', to_jsonb(e.fit), 'audience', e.audience, 'size', e.size,
    'costTicket', e.cost_ticket, 'costSponsor', e.cost_sponsor, 'notes', e.notes, 'history', e.history,
    'comment', e.comment, 'isNew', e.is_new, 'source', e.source, 'archived', e.archived, 'updatedAt', e.updated_at,
    'hubspotId', e.hubspot_id, 'hubspotSyncedAt', e.hubspot_synced_at)
$$;

create or replace function public.event_save(p_id bigint, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.events; d jsonb := coalesce(p_data, '{}'); mode text; s date; en date; t smallint; v_fit smallint[]; st time; et time;
begin
  perform public.require_role(array['admin', 'events']);
  if jsonb_typeof(d) <> 'object' then raise exception 'invalid data' using errcode = '22023'; end if;
  mode := coalesce(nullif(d ->> 'mode', ''), 'exact');
  s := nullif(d ->> 'start', '')::date; en := coalesce(nullif(d ->> 'end', '')::date, s);
  if mode = 'tbd' then s := null; en := null; end if;
  if mode = 'month' and s is not null then s := date_trunc('month', s)::date; en := s; end if;
  -- optional local times (event's own time zone), only with exact dates
  if coalesce(d ->> 'startTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and coalesce(d ->> 'startTime', '') <> '' then raise exception 'start time: HH:MM' using errcode = '22023'; end if;
  if coalesce(d ->> 'endTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and coalesce(d ->> 'endTime', '') <> '' then raise exception 'end time: HH:MM' using errcode = '22023'; end if;
  st := case when mode = 'exact' then nullif(d ->> 'startTime', '')::time end;
  et := case when mode = 'exact' then nullif(d ->> 'endTime', '')::time end;
  if st is not null and et is not null and s = en and et <= st then raise exception 'The end time is before the start time.' using errcode = '22023'; end if;
  t := nullif(d ->> 'tier', '')::smallint;
  v_fit := case when jsonb_typeof(d -> 'fit') = 'array' and jsonb_array_length(d -> 'fit') = 5
              then (select array_agg(case when jsonb_typeof(x) = 'number' then (x #>> '{}')::smallint end order by o)::smallint[] from jsonb_array_elements(d -> 'fit') with ordinality as a(x, o))
              else null end;
  if v_fit is not null and exists (select 1 from unnest(v_fit) f where f is not null and (f < 1 or f > 5)) then raise exception 'fit: 1 to 5' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.events (name, website, start_date, end_date, start_time, end_time, date_mode, date_note, region, country, city, kind, focus, tier,
                               audience, size, cost_ticket, cost_sponsor, notes, fit, is_new, source, created_by, updated_by)
    values (btrim(coalesce(d ->> 'name', '')), nullif(btrim(coalesce(d ->> 'website', '')), ''), s, en, st, et, mode, nullif(btrim(coalesce(d ->> 'dateNote', '')), ''),
            coalesce(nullif(btrim(d ->> 'region'), ''), 'TBA'), coalesce(nullif(btrim(d ->> 'country'), ''), 'TBA'), nullif(btrim(coalesce(d ->> 'city', '')), ''),
            nullif(btrim(coalesce(d ->> 'kind', '')), ''), nullif(btrim(coalesce(d ->> 'focus', '')), ''), t,
            nullif(btrim(coalesce(d ->> 'audience', '')), ''), nullif(btrim(coalesce(d ->> 'size', '')), ''), nullif(btrim(coalesce(d ->> 'costTicket', '')), ''),
            nullif(btrim(coalesce(d ->> 'costSponsor', '')), ''), nullif(btrim(coalesce(d ->> 'notes', '')), ''), coalesce(v_fit, '{null,null,null,null,null}'),
            true, 'manual', auth.uid(), auth.uid())
    returning * into e;
    perform public.log('event_create', e.id, null, jsonb_build_object('name', e.name));
  else
    update public.events set
      name = btrim(coalesce(d ->> 'name', name)), website = nullif(btrim(coalesce(d ->> 'website', '')), ''),
      start_date = s, end_date = en, start_time = st, end_time = et, date_mode = mode, date_note = nullif(btrim(coalesce(d ->> 'dateNote', '')), ''),
      region = coalesce(nullif(btrim(d ->> 'region'), ''), 'TBA'), country = coalesce(nullif(btrim(d ->> 'country'), ''), 'TBA'),
      city = nullif(btrim(coalesce(d ->> 'city', '')), ''), kind = nullif(btrim(coalesce(d ->> 'kind', '')), ''),
      focus = nullif(btrim(coalesce(d ->> 'focus', '')), ''), tier = t,
      audience = nullif(btrim(coalesce(d ->> 'audience', '')), ''), size = nullif(btrim(coalesce(d ->> 'size', '')), ''),
      cost_ticket = nullif(btrim(coalesce(d ->> 'costTicket', '')), ''), cost_sponsor = nullif(btrim(coalesce(d ->> 'costSponsor', '')), ''),
      notes = nullif(btrim(coalesce(d ->> 'notes', '')), ''), fit = coalesce(v_fit, public.events.fit),
      updated_by = auth.uid(), updated_at = now()
    where id = p_id returning * into e;
    if e.id is null then raise exception 'event not found' using errcode = 'P0002'; end if;
    perform public.log('event_edit', e.id, null, jsonb_build_object('name', e.name));
  end if;
  return public.event_json(e);
end $$;

-- the server records the HubSpot record an event is linked to, after creating, finding or updating it there.
-- p_hubspot_id null = unlink (the record in HubSpot stays as it is)
create or replace function public.event_hubspot_link(p_id bigint, p_hubspot_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  perform public.require_role(array['admin', 'events']);
  if p_hubspot_id is not null and p_hubspot_id !~ '^[0-9]{1,30}$' then raise exception 'invalid HubSpot id' using errcode = '22023'; end if;
  if p_action not in ('created', 'linked', 'updated', 'unlinked') then raise exception 'invalid action' using errcode = '22023'; end if;
  if p_hubspot_id is not null and exists (select 1 from public.events where hubspot_id = p_hubspot_id and id <> p_id) then
    raise exception 'This HubSpot event is already linked to another event in Circuit.' using errcode = '23505';
  end if;
  update public.events set hubspot_id = p_hubspot_id, hubspot_synced_at = case when p_hubspot_id is null then null else now() end
  where id = p_id returning * into e;
  if e.id is null then raise exception 'event not found' using errcode = 'P0002'; end if;
  perform public.log('hubspot_' || p_action, e.id, null, jsonb_build_object('name', e.name, 'hubspotId', coalesce(p_hubspot_id, '')));
  return public.event_json(e);
end $$;

revoke all on function public.event_hubspot_link(bigint, text, text) from public, anon;
grant execute on function public.event_hubspot_link(bigint, text, text) to authenticated;
revoke all on function public.event_save(bigint, jsonb) from public, anon;
grant execute on function public.event_save(bigint, jsonb) to authenticated;

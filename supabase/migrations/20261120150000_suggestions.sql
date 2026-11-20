-- Suggestions carry everything the sales person knows (all optional), Roman can say why one is not added,
-- and the sales person can improve and resend it. Safe to run again.

alter table public.suggestions add column if not exists details jsonb not null default '{}';
alter table public.suggestions add column if not exists decision_note text not null default '';
alter table public.suggestions add column if not exists updated_at timestamptz not null default now();
alter table public.suggestions drop constraint if exists suggestions_decision_note_len;
alter table public.suggestions add constraint suggestions_decision_note_len check (length(decision_note) <= 1000);
alter table public.suggestions drop constraint if exists suggestions_details_object;
alter table public.suggestions add constraint suggestions_details_object check (jsonb_typeof(details) = 'object');

-- the optional event details a sales person may give; unknown keys are dropped, formats checked, texts capped
create or replace function public.suggestion_clean(p_details jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare d jsonb := coalesce(p_details, '{}'); o jsonb := '{}'; k text; v text;
  caps constant jsonb := '{"country": 40, "region": 20, "kind": 120, "size": 12, "costTicket": 300, "costSponsor": 400, "audience": 300, "focus": 300, "notes": 2000}';
begin
  if jsonb_typeof(d) <> 'object' then raise exception 'details: object expected' using errcode = '22023'; end if;
  v := coalesce(d ->> 'mode', '');
  if v not in ('', 'exact', 'month', 'tbd') then raise exception 'details: mode' using errcode = '22023'; end if;
  if v <> '' then o := o || jsonb_build_object('mode', v); end if;
  foreach k in array array['start', 'end'] loop
    v := coalesce(d ->> k, '');
    if v <> '' then
      if v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'details: % date', k using errcode = '22023'; end if;
      perform v::date;
      o := o || jsonb_build_object(k, v);
    end if;
  end loop;
  foreach k in array array['startTime', 'endTime'] loop
    v := coalesce(d ->> k, '');
    if v <> '' then
      if v !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'details: % time', k using errcode = '22023'; end if;
      o := o || jsonb_build_object(k, v);
    end if;
  end loop;
  for k in select jsonb_object_keys(caps) loop
    v := btrim(coalesce(d ->> k, ''));
    if v <> '' then o := o || jsonb_build_object(k, left(v, (caps ->> k)::int)); end if;
  end loop;
  if o ->> 'mode' = 'exact' and o ? 'start' and o ? 'end' and (o ->> 'end') < (o ->> 'start') then raise exception 'The end date is before the start.' using errcode = '22023'; end if;
  return o;
end $$;

-- new suggestion (anyone signed in); p_details = optional event details (see suggestion_clean)
drop function if exists public.suggestion_create(text, text, text, text, text);
create or replace function public.suggestion_create(p_name text, p_month text, p_city text, p_website text, p_reason text, p_details jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.suggestions; d jsonb := public.suggestion_clean(p_details);
begin
  perform public.require_role();
  insert into public.suggestions (name, month, city, website, reason, details, suggested_by)
  values (btrim(coalesce(p_name, '')),
          coalesce(case when d ->> 'mode' = 'exact' and d ? 'start' then left(d ->> 'start', 7) end, nullif(btrim(coalesce(p_month, '')), '')),
          btrim(coalesce(p_city, '')), btrim(coalesce(p_website, '')), btrim(coalesce(p_reason, '')), d, auth.uid())
  returning * into s;
  perform public.log('suggest', null, null, jsonb_build_object('name', s.name));
  return jsonb_build_object('id', s.id);
end $$;

-- the person who suggested it changes it (still waiting) or improves and resends it (after "not added")
create or replace function public.suggestion_update(p_id uuid, p_name text, p_month text, p_city text, p_website text, p_reason text, p_details jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.suggestions; d jsonb := public.suggestion_clean(p_details); was text;
begin
  perform public.require_role();
  select * into s from public.suggestions where id = p_id for update;
  if s.id is null or s.suggested_by is distinct from auth.uid() then raise exception 'suggestion not found' using errcode = 'P0002'; end if;
  if s.status = 'added' then raise exception 'Already in the calendar.' using errcode = '22023'; end if;
  was := s.status;
  update public.suggestions set
    name = btrim(coalesce(p_name, '')),
    month = coalesce(case when d ->> 'mode' = 'exact' and d ? 'start' then left(d ->> 'start', 7) end, nullif(btrim(coalesce(p_month, '')), '')),
    city = btrim(coalesce(p_city, '')), website = btrim(coalesce(p_website, '')), reason = btrim(coalesce(p_reason, '')), details = d,
    status = 'pending', updated_at = now()
  where id = p_id returning * into s;
  perform public.log(case when was = 'dismissed' then 'suggestion_resent' else 'suggestion_edit' end, null, null, jsonb_build_object('name', s.name));
  return jsonb_build_object('id', s.id);
end $$;

-- Roman: add it to the calendar with everything the sales person gave (the editor opens for tier and fit),
-- or don't, with a note that the sales person sees (e.g. "too vague: add dates and city")
drop function if exists public.suggestion_decide(uuid, boolean);
create or replace function public.suggestion_decide(p_id uuid, p_add boolean, p_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.suggestions; d jsonb; ev jsonb; evid bigint; mode text;
begin
  perform public.require_role(array['admin', 'events']);
  select * into s from public.suggestions where id = p_id for update;
  if s.id is null then raise exception 'suggestion not found' using errcode = 'P0002'; end if;
  if s.status <> 'pending' then raise exception 'already decided' using errcode = '22023'; end if;
  if length(coalesce(p_note, '')) > 1000 then raise exception 'note: at most 1000 characters' using errcode = '22023'; end if;
  if p_add then
    d := s.details;
    mode := coalesce(d ->> 'mode', case when s.month is not null then 'month' else 'tbd' end);
    if mode = 'exact' and not d ? 'start' then mode := case when s.month is not null then 'month' else 'tbd' end; end if;
    if mode = 'month' and s.month is null then mode := 'tbd'; end if;
    ev := public.event_save(null, d || jsonb_build_object(
      'name', s.name, 'website', s.website, 'city', s.city, 'mode', mode,
      'start', case when mode = 'exact' then d ->> 'start' when mode = 'month' then s.month || '-01' end,
      'end', case when mode = 'exact' then coalesce(d ->> 'end', d ->> 'start') when mode = 'month' then s.month || '-01' end,
      'notes', nullif(concat_ws(E'\n\n', nullif(s.reason, ''), nullif(d ->> 'notes', '')), '')));
    evid := (ev ->> 'id')::bigint;
    update public.events set source = 'suggestion' where id = evid;
  end if;
  update public.suggestions set status = case when p_add then 'added' else 'dismissed' end, event_id = evid,
    decision_note = btrim(coalesce(p_note, '')), decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = p_id;
  perform public.log(case when p_add then 'suggestion_added' else 'suggestion_dismissed' end, evid, null,
                     jsonb_build_object('name', s.name, 'note', btrim(coalesce(p_note, ''))));
  return jsonb_build_object('eventId', evid);
end $$;

create or replace function public.bootstrap() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r text := public.require_role(); staff boolean := r in ('admin', 'events');
begin
  return jsonb_build_object(
    'me', public.me(),
    'today', current_date,
    'people', coalesce((select jsonb_agg(public.person_json(p) order by p.name) from public.profiles p where p.active or staff), '[]'),
    'events', coalesce((select jsonb_agg(public.event_json(e) order by e.start_date nulls last, e.id) from public.events e where not e.archived or staff), '[]'),
    'requests', coalesce((select jsonb_agg(public.request_json(q) order by q.created_at) from public.requests q where q.status <> 'withdrawn'), '[]'),
    'flags', coalesce((select jsonb_agg(jsonb_build_object('eventId', f.event_id, 'note', f.note, 'by', f.flagged_by, 'at', f.created_at)) from public.flags f), '[]'),
    'suggestions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'month', s.month, 'city', s.city,
        'website', s.website, 'reason', s.reason, 'source', s.source, 'by', s.suggested_by, 'status', s.status,
        'eventId', s.event_id, 'createdAt', s.created_at, 'details', s.details, 'decisionNote', s.decision_note,
        'decidedBy', s.decided_by, 'decidedAt', s.decided_at, 'updatedAt', s.updated_at) order by s.created_at)
      from public.suggestions s where staff or s.suggested_by = auth.uid()), '[]'));
end $$;

revoke all on function public.suggestion_clean(jsonb) from public, anon, authenticated;
revoke all on function public.suggestion_create(text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.suggestion_update(uuid, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.suggestion_decide(uuid, boolean, text) from public, anon;
grant execute on function public.suggestion_create(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.suggestion_update(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.suggestion_decide(uuid, boolean, text) to authenticated;

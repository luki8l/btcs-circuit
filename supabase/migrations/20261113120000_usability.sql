-- Usability round 1 (after the PROD walk-through with six sales test accounts). Safe to run again.

-- 1) Logging a past visit: the Tier 4–5 reason is for asking to go, not for saying you were there.
create or replace function public.request_create(p_event bigint, p_mode text, p_ticket text, p_cost numeric, p_groups integer[], p_meetings integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.events; q public.requests; over boolean;
begin
  perform public.require_role();
  select * into e from public.events where id = p_event and not archived;
  if e.id is null then raise exception 'event not found' using errcode = 'P0002'; end if;
  perform public.check_request_input(p_mode, p_ticket, p_cost, p_groups, p_meetings);
  over := e.date_mode <> 'tbd' and e.start_date is not null and coalesce(case when e.date_mode = 'month' then (date_trunc('month', e.start_date) + interval '1 month - 1 day')::date else coalesce(e.end_date, e.start_date) end, e.start_date) < current_date;
  if not over and coalesce(e.tier, 0) >= 4 and length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Tier % events need a short reason so the events team can make an exception', e.tier using errcode = '22023';
  end if;
  if exists (select 1 from public.requests where event_id = p_event and person_id = auth.uid() and status in ('requested', 'approved')) then
    raise exception 'you already have a request for this event' using errcode = '23505';
  end if;
  insert into public.requests (event_id, person_id, mode, ticket, cost, groups, meetings_planned, reason, created_by)
  values (p_event, auth.uid(), p_mode, p_ticket, case when p_ticket = 'paid' then coalesce(p_cost, 0) else 0 end,
          (select array_agg(distinct g order by g)::smallint[] from unnest(p_groups) g), coalesce(p_meetings, 0), btrim(coalesce(p_reason, '')), auth.uid())
  returning * into q;
  perform public.log(case when over then 'log_visit' else 'request' end, p_event, q.id, jsonb_build_object('mode', p_mode, 'ticket', p_ticket));
  return public.request_json(q);
end $$;
revoke all on function public.request_create(bigint, text, text, numeric, integer[], integer, text) from public, anon;
grant execute on function public.request_create(bigint, text, text, numeric, integer[], integer, text) to authenticated;

-- 2) Masterlist location typos that put events in the wrong country or region (by name, so it works on any copy).
update public.events set country = 'US', region = 'US' where name = 'Sibos' and city = 'Miami' and country = 'TBA';
update public.events set country = 'UK' where name = 'Impact Investor Global Summit 2027' and city = 'London' and country = 'US';
update public.events set region = 'CH' where name = 'European Single Family Office Symposium' and country = 'CH' and region = 'EU';
update public.events set city = 'Abu Dhabi' where city = 'abu Dhabi';
update public.events set city = 'Zurich', notes = concat_ws(E'\n', nullif(notes, ''), 'Masterlist location: Zurich (DAYS edition); Cannes summit during EthCC week.')
  where name = 'Staking Summit / Digital Asset Yield Summit (Staking Rewards)' and city = 'Zurich (DAYS edition); Cannes summit during EthCC week';

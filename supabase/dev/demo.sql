-- Local development only (CIRCUIT_LOCAL_DEMO=1): example people and requests, so every screen has something to show.
-- Never run this in Supabase: the people and numbers are made up.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'roman@example.com',   '{"name":"Roman Events","title":"Head of Events","team":"Marketing"}', '{"role":"events"}'),
  ('10000000-0000-0000-0000-000000000002', 'ceo@example.com',     '{"name":"Chris Executive","title":"CEO"}', '{"role":"management"}'),
  ('10000000-0000-0000-0000-000000000003', 'sara@example.com',    '{"name":"Sara Lind","market":"Sweden","team":"Nordics","title":"Relationship Manager"}', '{"role":"sales"}'),
  ('10000000-0000-0000-0000-000000000004', 'pedro@example.com',   '{"name":"Pedro Costa","market":"Portugal","team":"Iberia","title":"Relationship Manager"}', '{"role":"sales"}'),
  ('10000000-0000-0000-0000-000000000005', 'jan@example.com',     '{"name":"Jan de Vries","market":"Netherlands","team":"Benelux","title":"Relationship Manager"}', '{"role":"sales"}'),
  ('10000000-0000-0000-0000-000000000006', 'mara@example.com',    '{"name":"Mara Keller","market":"Switzerland","team":"DACH","title":"Senior Relationship Manager"}', '{"role":"sales"}'),
  ('10000000-0000-0000-0000-000000000007', 'felix@example.com',   '{"name":"Felix Huber","market":"Austria","team":"DACH","title":"Relationship Manager"}', '{"role":"sales"}'),
  ('10000000-0000-0000-0000-000000000008', 'lena@example.com',    '{"name":"Lena Brandt","market":"Germany","team":"DACH","title":"Relationship Manager"}', '{"role":"sales"}')
on conflict do nothing;

create or replace function pg_temp.ev(n text) returns bigint language sql as $$ select id from public.events where name = n limit 1 $$;
create or replace function pg_temp.req(p_ev bigint, p_person uuid, p_status text, p_mode text, p_ticket text, p_cost numeric, p_groups smallint[], p_meet int, p_reason text,
  p_hub boolean default false, p_leads int default null, p_rating int default null, p_again text default null, p_note text default '', p_dnote text default '') returns void language sql as $$
  insert into public.requests (event_id, person_id, status, mode, ticket, cost, groups, meetings_planned, reason, decision_note,
    decided_by, decided_at, hubspot, leads, meetings_held, rating, go_again, debrief_note, debriefed_at, created_by)
  select p_ev, p_person, p_status, p_mode, p_ticket, p_cost, p_groups, p_meet, p_reason, p_dnote,
    case when p_status in ('approved','declined') then '10000000-0000-0000-0000-000000000001'::uuid end, case when p_status in ('approved','declined') then now() - interval '3 days' end,
    p_hub, p_leads, case when p_leads is not null then greatest(p_meet - 1, 0) end, p_rating, p_again, p_note, case when p_rating is not null then now() - interval '2 days' end, p_person
  where p_ev is not null and not exists (select 1 from public.requests where event_id = p_ev and person_id = p_person)
$$;
select pg_temp.req(pg_temp.ev('Plan B Forum'), '10000000-0000-0000-0000-000000000006', 'approved', 'attend', 'paid', 1000, '{0,2}', 9, '', true, 14, 4, 'yes', 'Strong crypto-HNWI crowd. Two family offices asked for a follow-up.');
select pg_temp.req(pg_temp.ev('Merge Madrid'), '10000000-0000-0000-0000-000000000004', 'approved', 'attend', 'paid', 650, '{0,4}', 6, '', true, 9, 3, 'maybe', 'Good for the Iberia pipeline, many service providers.');
select pg_temp.req(pg_temp.ev('Apex Invest Europe'), '10000000-0000-0000-0000-000000000006', 'approved', 'attend', 'free', 0, '{2,4}', 7, '', true, 6, 4, 'yes', 'LP-only format works.');
select pg_temp.req(pg_temp.ev('Digital Assets Week London'), '10000000-0000-0000-0000-000000000007', 'approved', 'attend', 'paid', 900, '{2}', 4, '', true, 5, 3, 'maybe', 'Mostly service providers. Two EAM leads.');
select pg_temp.req(pg_temp.ev('SuperReturn Europe (formerly SuperInvestor)'), '10000000-0000-0000-0000-000000000005', 'approved', 'attend', 'paid', 2400, '{4,2}', 8, '', true);
select pg_temp.req(pg_temp.ev('Bitcoin Amsterdam'), '10000000-0000-0000-0000-000000000005', 'approved', 'attend', 'paid', 130, '{0,2}', 5, '');
select pg_temp.req(pg_temp.ev('Citywire DACH Selector Retreat'), '10000000-0000-0000-0000-000000000008', 'approved', 'attend', 'free', 0, '{2,1}', 6, '', true);
select pg_temp.req(pg_temp.ev('Slush (Founder-focused / Venture Capital)'), '10000000-0000-0000-0000-000000000003', 'requested', 'attend', 'paid', 420, '{4}', 5, 'Nordic VC and LP crowd. Five meetings with fund managers lined up.');
select pg_temp.req(pg_temp.ev('Campden European Family Office Forum (27th edition)'), '10000000-0000-0000-0000-000000000007', 'requested', 'attend', 'free', 0, '{2,1}', 6, 'Closed-door family office forum. Fits our asset manager push in DACH.');
select pg_temp.req(pg_temp.ev('Abu Dhabi Finance Week'), '10000000-0000-0000-0000-000000000006', 'requested', 'meetings', 'paid', 2000, '{1,2,4}', 8, 'Stage slot in negotiation (masterlist). I would cover the client meetings around it.');
select pg_temp.req(pg_temp.ev('CfC St. Moritz'), '10000000-0000-0000-0000-000000000006', 'approved', 'attend', 'paid', 4800, '{0,1,2}', 6, '', true);
select pg_temp.req(pg_temp.ev('EthCC'), '10000000-0000-0000-0000-000000000004', 'requested', 'attend', 'paid', 500, '{0,3}', 6, 'Largest European Ethereum event. Institutional track for crypto funds.');
select pg_temp.req(pg_temp.ev('Institutional Money Kongress'), '10000000-0000-0000-0000-000000000008', 'approved', 'attend', 'free', 0, '{4,1}', 6, '');
select pg_temp.req(pg_temp.ev('Nordic Blockchain Conference'), '10000000-0000-0000-0000-000000000003', 'approved', 'attend', 'paid', 1000, '{0}', 4, '', true);
select pg_temp.req(pg_temp.ev('0100 Europe'), '10000000-0000-0000-0000-000000000005', 'requested', 'attend', 'free', 0, '{2,4}', 8, 'Free for LPs, in Amsterdam. Eight meetings with Dutch family offices pre-booked.');
select pg_temp.req(pg_temp.ev('CoinFest UK'), '10000000-0000-0000-0000-000000000004', 'declined', 'attend', 'paid', 300, '{0}', 2, 'Brand awareness in the UK.', false, null, null, null, '', 'Tier 4, not a priority for 2027.');
select pg_temp.req(pg_temp.ev('World Family Office Forum Europe'), '10000000-0000-0000-0000-000000000006', 'requested', 'attend', 'paid', 2500, '{2,1}', 7, 'Montreux, close to home. Family office principals.');
select pg_temp.req(pg_temp.ev('Point Zero Forum'), '10000000-0000-0000-0000-000000000006', 'approved', 'speak', 'free', 0, '{1,4}', 5, '', true);
select pg_temp.req(pg_temp.ev('BTC Prague'), '10000000-0000-0000-0000-000000000008', 'requested', 'attend', 'paid', 600, '{0}', 4, 'Biggest Bitcoin event in Europe, many crypto HNWIs from DACH.');
insert into public.flags (event_id, note, flagged_by) select id, 'We need someone here', '10000000-0000-0000-0000-000000000001' from public.events
  where name in ('Digital Asset Summit UAE (DAS Abu Dhabi) - NEW', 'Campden Wealth Switzerland Family Office Forum') on conflict do nothing;

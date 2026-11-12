-- Supabase Auth writes app_metadata (where the role lives) after inserting the user, so the insert trigger does not
-- see it. Keep the profile's role in step whenever the server changes the role in app_metadata.
create or replace function public.handle_user_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data ->> 'role' in ('admin', 'events', 'management', 'sales')
     and (old.raw_app_meta_data ->> 'role') is distinct from (new.raw_app_meta_data ->> 'role') then
    update public.profiles set role = new.raw_app_meta_data ->> 'role' where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_role on auth.users;
create trigger on_auth_user_role after update of raw_app_meta_data on auth.users for each row execute function public.handle_user_role();
revoke all on function public.handle_user_role() from public, anon, authenticated;

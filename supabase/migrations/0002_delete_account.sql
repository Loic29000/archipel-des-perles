-- Lets a player erase their account and everything tied to it (store requirement).
-- Removing the auth user cascades to profiles, tiles, survey_answers and ad_events.
create or replace function delete_account() returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid();
begin
  -- players this one referred keep their pearls, only the link goes
  update profiles set referred_by = null where referred_by = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;

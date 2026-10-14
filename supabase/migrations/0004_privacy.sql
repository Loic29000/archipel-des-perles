-- GDPR: data export (right of access and portability) and the retention limit announced in the privacy policy.

-- Everything the server holds about the calling player, as one JSON document.
create or replace function export_my_data() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'account', jsonb_build_object('id', uid, 'email', (select to_jsonb(u) ->> 'email' from auth.users u where u.id = uid)),
    'profile', (select to_jsonb(p) from profiles p where p.id = uid),
    'tiles', coalesce((select jsonb_agg(to_jsonb(t) order by t.acquired_at) from tiles t where t.owner = uid), '[]'),
    'survey_answers', coalesce((select jsonb_agg(jsonb_build_object('answers', a.answers, 'created_at', a.created_at) order by a.id) from survey_answers a where a.user_id = uid), '[]'),
    'ad_rewards', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'created_at', e.created_at, 'consumed_at', e.consumed_at) order by e.id) from ad_events e where e.user_id = uid), '[]'),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('product', x.product, 'test', x.test, 'created_at', x.created_at) order by x.id) from purchases x where x.user_id = uid), '[]'),
    'referred_players', (select count(*) from profiles r where r.referred_by = uid)
  );
end $$;

-- Retention: accounts with no activity for 3 years are deleted, and used ad receipts are dropped after 90 days.
-- profiles.coins_at moves on every game action, so it is the last activity time.
-- Run daily from the Supabase scheduler (pg_cron): select cron.schedule('purge', '0 4 * * *', 'select purge_inactive()');
create or replace function purge_inactive() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from ad_events where consumed_at < now() - interval '90 days';
  update profiles set referred_by = null where referred_by in
    (select id from profiles where coins_at < (extract(epoch from now() - interval '3 years') * 1000)::bigint);
  with gone as (
    delete from auth.users where id in (select id from profiles where coins_at < (extract(epoch from now() - interval '3 years') * 1000)::bigint)
    returning 1)
  select count(*) into n from gone;
  return n;
end $$;

revoke all on function export_my_data(), purge_inactive() from public, anon, authenticated;
grant execute on function export_my_data() to authenticated;

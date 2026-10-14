-- Pass Capitaine: monthly pass modelled on Atlas Earth's Explorer Club. Mirrors PASS in src/game/rules.ts.
-- Perks: 8 h boost reserve (instead of 6), the pass line of the login calendar (free reward again + 1),
-- mini-games every 40 min (instead of 1 h), badge next to the name in the ranking.

alter table profiles add column if not exists pass_until bigint not null default 0;

create or replace function g_grant_purchase(uid uuid, product text) returns void language plpgsql security definer set search_path = public as $$
begin
  case product
    when 'perles_100' then update profiles set pearls = pearls + 100 where id = uid;
    when 'perles_550' then update profiles set pearls = pearls + 550 where id = uid;
    when 'perles_1200' then update profiles set pearls = pearls + 1200 where id = uid;
    when 'pass_capitaine' then update profiles set pass_until = greatest(g_now(), pass_until) + 30 * g_day() where id = uid;
    else raise exception 'Produit inconnu.';
  end case;
end $$;

create or replace function get_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; tl jsonb;
begin
  perform g_settle(uid, t);
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid;
  select coalesce(jsonb_object_agg(q || ',' || r, jsonb_build_object('rar', rar, 'level', level, 'biome', biome, 'deco', deco)), '{}')
    into tl from tiles where owner = uid;
  return jsonb_build_object(
    'now', t,
    's', jsonb_build_object(
      'pearls', p.pearls, 'coins', p.coins, 'coinsAt', p.coins_at, 'tiles', tl,
      'spawn', jsonb_build_array(p.spawn_q, p.spawn_r), 'boostUntil', p.boost_until,
      'cd', jsonb_build_object('ad', p.cd_ad, 'survey', p.cd_survey, 'fish', p.cd_fish, 'memo', p.cd_memo, 'event', p.cd_event),
      'pendingGame', case when p.pending_game is null then null else jsonb_build_object('game', p.pending_game, 'at', p.pending_at) end,
      'streak', jsonb_build_object('count', p.streak_count, 'lastDay', p.streak_day),
      'quests', jsonb_build_object('day', p.quest_day, 'items', p.quests),
      'flags', to_jsonb(p.flags), 'flag', p.flag, 'username', p.username,
      'referralCode', p.referral_code, 'referralUsed', p.referred_by is not null,
      'achClaimed', to_jsonb(p.ach_claimed), 'caught', p.caught, 'passUntil', p.pass_until));
end $$;

-- Boost reserve: 6 h, or 8 h with the pass. Whale event: 2 h per ad.
create or replace function ad_reward(kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; ev bigint; cap bigint;
begin
  if kind not in ('pearl','boost','game') then raise exception 'Type de pub inconnu.'; end if;
  if (select require_ssv from app_config) then
    select id into ev from ad_events where user_id = uid and ad_events.kind = ad_reward.kind and consumed_at is null
      and created_at > now() - interval '10 minutes' order by id limit 1 for update;
    if ev is null then raise exception 'Pub non validée par la régie, réessayez dans un instant.'; end if;
    update ad_events set consumed_at = now() where id = ev;
  end if;
  perform g_settle(uid, t);
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid for update;
  if kind = 'pearl' then
    if t < p.cd_ad then raise exception 'La prochaine pub n''est pas encore disponible.'; end if;
    update profiles set pearls = pearls + 1, cd_ad = t + 20 * g_minute() where id = uid;
  elsif kind = 'boost' then
    if not exists (select 1 from tiles where owner = uid) then raise exception 'Acquérez d''abord un îlot.'; end if;
    cap := case when t < p.pass_until then 8 else 6 end * g_hour();
    if p.boost_until - t > cap - g_hour() then raise exception 'Votre réserve de boost est pleine.'; end if;
    update profiles set boost_until = least(t + cap,
      greatest(t, p.boost_until) + case when event_at(t) = 'baleines' then 2 else 1 end * g_hour()) where id = uid;
    perform g_bump_quest(uid, 'boost');
  end if;
  perform g_bump_quest(uid, 'ad');
  return get_state();
end $$;

-- Mini-games: every hour, or every 40 min with the pass.
create or replace function start_game(game text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; cd bigint;
begin
  if game not in ('fish','memo') then raise exception 'Jeu inconnu.'; end if;
  select * into p from profiles where id = uid for update;
  if (game = 'fish' and t < p.cd_fish) or (game = 'memo' and t < p.cd_memo) then
    raise exception 'Ce mini-jeu n''est pas encore disponible.';
  end if;
  cd := case when t < p.pass_until then 40 * g_minute() else g_hour() end;
  update profiles set pending_game = game, pending_at = t,
    cd_fish = case when game = 'fish' then t + cd else cd_fish end,
    cd_memo = case when game = 'memo' then t + cd else cd_memo end
  where id = uid;
  return get_state();
end $$;

-- Pass line of the login calendar: the free reward again, plus 1.
create or replace function pass_streak_reward(n int) returns int language sql immutable as $$ select streak_reward(n) + 1 $$;

create or replace function claim_streak() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); d int := (t / g_day())::int; p profiles; c int; reward int;
begin
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid for update;
  if (select count(*) from tiles where owner = uid) < 3 then raise exception 'Possédez 3 îlots pour débloquer le bonus de connexion.'; end if;
  if p.streak_day = d then raise exception 'Bonus du jour déjà récupéré. Revenez demain !'; end if;
  c := case when p.streak_day = d - 1 then p.streak_count + 1 else 1 end;
  reward := streak_reward(c) + case when t < p.pass_until then pass_streak_reward(c) else 0 end;
  update profiles set streak_count = c, streak_day = d, pearls = pearls + reward where id = uid;
  return get_state() || jsonb_build_object('reward', reward);
end $$;

-- Ranking shows the pass badge.
drop function if exists leaderboard();
create function leaderboard() returns table(username text, tiles int, coins double precision, flag text, me boolean, pass boolean)
language sql stable security definer set search_path = public as $$
  select p.username, count(t.*)::int, p.coins, p.flag, p.id = auth.uid(), g_now() < p.pass_until
  from profiles p left join tiles t on t.owner = p.id
  group by p.id order by count(t.*) desc, p.coins desc limit 50
$$;

revoke all on function leaderboard(), pass_streak_reward(int) from public, anon;
grant execute on function leaderboard() to authenticated;

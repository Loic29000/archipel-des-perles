-- Achievements, limited-time events, island decorations and in-app purchases.
-- Mirrors src/game/rules.ts (ACHIEVEMENTS, EVENTS, DECOS, PRODUCTS); keep both in step.

alter table profiles add column if not exists ach_claimed text[] not null default '{}';
alter table profiles add column if not exists caught integer not null default 0;
alter table profiles add column if not exists cd_event bigint not null default 0;
alter table profiles add column if not exists no_ads boolean not null default false;
alter table tiles add column if not exists deco text;
-- true until the stores are set up: lets the app credit purchases without a receipt
alter table app_config add column if not exists iap_test boolean not null default true;

create table if not exists purchases (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  product text not null,
  transaction_id text unique,
  test boolean not null default false,
  created_at timestamptz not null default now()
);
alter table purchases enable row level security;

-- ---------------------------------------------------------------- events: 4 days every 14, rotating
create or replace function event_at(t bigint) returns text language sql immutable as $$
  select case when (((t + 203 * 3600000::bigint) % (14 * 86400000::bigint)) + 14 * 86400000::bigint) % (14 * 86400000::bigint) >= 4 * 86400000::bigint then null
    else (array['tortues','maree','baleines'])[(((t + 203 * 3600000::bigint) / (14 * 86400000::bigint)) % 3) + 1] end
$$;

-- ---------------------------------------------------------------- achievements
create or replace function ach_reward(aid text) returns int language sql immutable as $$
  select case
    when aid in ('biome_plage','biome_prairie','biome_foret','biome_marais','biome_montagne','biome_volcan') then 2
    when aid = 'size_5' then 3 when aid = 'size_15' then 5 when aid = 'size_30' then 8 when aid = 'size_60' then 12
    when aid = 'size_100' then 15 when aid = 'size_150' then 20 when aid = 'size_250' then 30 when aid = 'size_500' then 50
    when aid = 'rar_1' then 3 when aid = 'rar_2' then 5 when aid = 'rar_3' then 10
    when aid = 'streak_3' then 2 when aid = 'streak_7' then 5 when aid = 'streak_30' then 15
    when aid = 'phare_1' then 2 when aid = 'phare_10' then 5
    when aid = 'deco_1' then 2 when aid = 'deco_5' then 5
    when aid = 'catch_1' then 3 when aid = 'catch_10' then 8 end
$$;

create or replace function ach_done(uid uuid, aid text) returns boolean language plpgsql stable as $$
declare kind text := split_part(aid, '_', 1); arg text := split_part(aid, '_', 2); p profiles;
begin
  select * into p from profiles where id = uid;
  return case kind
    when 'biome' then exists (select 1 from tiles where owner = uid and biome = arg)
    when 'size' then (select count(*) from tiles where owner = uid) >= arg::int
    when 'rar' then exists (select 1 from tiles where owner = uid and rar = arg::int)
    when 'streak' then p.streak_count >= arg::int
    when 'phare' then (select coalesce(sum(level), 0) from tiles where owner = uid) >= arg::int
    when 'deco' then (select count(*) from tiles where owner = uid and deco is not null) >= arg::int
    when 'catch' then p.caught >= arg::int
    else false end;
end $$;

create or replace function claim_achievement(aid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); reward int := ach_reward(aid);
begin
  if reward is null then raise exception 'Succès inconnu.'; end if;
  if exists (select 1 from profiles where id = uid and aid = any(ach_claimed)) then raise exception 'Récompense déjà reçue.'; end if;
  if not ach_done(uid, aid) then raise exception 'Succès pas encore débloqué.'; end if;
  update profiles set ach_claimed = array_append(ach_claimed, aid), pearls = pearls + reward where id = uid;
  return get_state();
end $$;

-- ---------------------------------------------------------------- event creature
create or replace function catch_creature() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); ev text := event_at(t); reward int;
begin
  if ev is null then raise exception 'Aucun événement en cours.'; end if;
  perform g_settle(uid, t);
  if not exists (select 1 from tiles where owner = uid) then raise exception 'Acquérez d''abord un îlot.'; end if;
  if (select cd_event from profiles where id = uid for update) > t then raise exception 'La créature reviendra bientôt.'; end if;
  reward := case when ev = 'tortues' then 3 else 2 end;
  update profiles set pearls = pearls + reward, caught = caught + 1, cd_event = t + g_hour() where id = uid;
  return get_state() || jsonb_build_object('reward', reward);
end $$;

-- ---------------------------------------------------------------- decorations
create or replace function decorate_tile(tq int, tr int, did text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); cur text; ok boolean; price double precision;
begin
  price := case did when 'cabane' then 0.0003 when 'bateau' then 0.0003 when 'mouettes' then 0.0004 when 'tresor' then 0.0006 when 'tortue' then 0 end;
  if price is null then raise exception 'Décoration inconnue.'; end if;
  perform g_settle(uid, g_now());
  select deco, true into cur, ok from tiles where q = tq and r = tr and owner = uid for update;
  if ok is null then raise exception 'Cet îlot ne vous appartient pas.'; end if;
  if cur is not distinct from did then raise exception 'Cet îlot a déjà cette décoration.'; end if;
  if did = 'tortue' and (select caught from profiles where id = uid) < 1 then
    raise exception 'Attrapez une créature d''événement pour débloquer la tortue.';
  end if;
  if (select coins from profiles where id = uid) < price then raise exception 'Pas assez de doublons.'; end if;
  update profiles set coins = greatest(0, coins - price) where id = uid;
  update tiles set deco = did where q = tq and r = tr;
  return get_state();
end $$;

-- ---------------------------------------------------------------- purchases
create or replace function g_grant_purchase(uid uuid, product text) returns void language plpgsql security definer set search_path = public as $$
begin
  case product
    when 'perles_100' then update profiles set pearls = pearls + 100 where id = uid;
    when 'perles_550' then update profiles set pearls = pearls + 550 where id = uid;
    when 'perles_1200' then update profiles set pearls = pearls + 1200 where id = uid;
    when 'sans_pubs' then update profiles set no_ads = true where id = uid;
    else raise exception 'Produit inconnu.';
  end case;
end $$;

-- Test mode only. Real purchases will be credited by a server function that checks the store receipt.
create or replace function test_purchase(product text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid();
begin
  if not (select iap_test from app_config) then raise exception 'Achats de test désactivés.'; end if;
  perform g_grant_purchase(uid, product);
  insert into purchases(user_id, product, test) values (uid, product, true);
  return get_state();
end $$;

-- ---------------------------------------------------------------- updated rules
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
      'achClaimed', to_jsonb(p.ach_claimed), 'caught', p.caught, 'noAds', p.no_ads));
end $$;

-- Golden tide event doubles the epic and legendary odds.
create or replace function claim_tile(tq int, tr int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; n int; price int; x double precision; rr int;
begin
  perform g_settle(uid, t);
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid for update;
  select count(*) into n from tiles where owner = uid;
  if exists (select 1 from tiles where q = tq and r = tr) then raise exception 'Cet îlot appartient déjà à quelqu''un.'; end if;
  if n = 0 then
    if tq <> p.spawn_q or tr <> p.spawn_r then raise exception 'Commencez par votre îlot de départ.'; end if;
  elsif not exists (select 1 from tiles where owner = uid and (q, r) in
      ((tq+1,tr),(tq+1,tr-1),(tq,tr-1),(tq-1,tr),(tq-1,tr+1),(tq,tr+1))) then
    raise exception 'Cet îlot ne touche pas votre territoire.';
  end if;
  price := case when n = 0 then 0 else 100 end;
  if p.pearls < price then raise exception 'Il vous faut % perles.', price; end if;
  x := random();
  if event_at(t) = 'maree' then
    rr := case when x < 0.1 then 3 when x < 0.3 then 2 when x < 0.6 then 1 else 0 end;
  else
    rr := case when x < 0.05 then 3 when x < 0.2 then 2 when x < 0.5 then 1 else 0 end;
  end if;
  insert into tiles(q, r, owner, rar, biome) values (tq, tr, uid, rr, biome_at(tq, tr));
  update profiles set pearls = pearls - price where id = uid;
  perform g_bump_quest(uid, 'claim');
  return get_state() || jsonb_build_object('tile', jsonb_build_object('rar', rr, 'level', 0, 'biome', biome_at(tq, tr)));
end $$;

-- Whale event: 2 h of boost per ad. "Sans pubs" players get the reward without an AdMob check.
create or replace function ad_reward(kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; ev bigint;
begin
  if kind not in ('pearl','boost','game') then raise exception 'Type de pub inconnu.'; end if;
  if (select require_ssv from app_config) and not (select no_ads from profiles where id = uid) then
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
    if p.boost_until - t > 5 * g_hour() then raise exception 'Votre réserve de boost est pleine.'; end if;
    update profiles set boost_until = least(t + 6 * g_hour(),
      greatest(t, p.boost_until) + case when event_at(t) = 'baleines' then 2 else 1 end * g_hour()) where id = uid;
    perform g_bump_quest(uid, 'boost');
  end if;
  perform g_bump_quest(uid, 'ad');
  return get_state();
end $$;

-- ---------------------------------------------------------------- permissions
revoke all on all functions in schema public from public, anon;
grant execute on function get_state(), daily_login(), claim_tile(int, int), ad_reward(text), start_game(text),
  finish_game(text, int), submit_survey(jsonb), claim_quest(text), buy_pearls(int), upgrade_tile(int, int),
  buy_flag(text), set_username(text), apply_referral(text), tiles_near(int, int, int), leaderboard(), delete_account(),
  claim_achievement(text), catch_creature(), decorate_tile(int, int, text), test_purchase(text)
  to authenticated;

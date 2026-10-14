-- Archipel des Perles: server-authoritative game state.
-- Every write goes through a SECURITY DEFINER function that uses the server clock,
-- so players cannot edit their pearls, skip cooldowns or pick their rarity.
-- The rules mirror src/game/rules.ts; keep both in step when changing a number.

-- ---------------------------------------------------------------- tables
create table if not exists app_config (
  id boolean primary key default true check (id),
  require_ssv boolean not null default false  -- true in production: ad rewards need an AdMob server-side verification
);
insert into app_config default values on conflict do nothing;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null default 'Navigateur',
  pearls integer not null default 0 check (pearls >= 0),
  coins double precision not null default 0 check (coins >= 0),
  coins_at bigint not null,
  spawn_q integer not null,
  spawn_r integer not null,
  boost_until bigint not null default 0,
  cd_ad bigint not null default 0,
  cd_survey bigint not null default 0,
  cd_fish bigint not null default 0,
  cd_memo bigint not null default 0,
  pending_game text,
  pending_at bigint,
  streak_count integer not null default 0,
  streak_day integer not null default -1,
  quest_day integer not null default -1,
  quests jsonb not null default '[]',
  flags text[] not null default '{lagon}',
  flag text not null default 'lagon',
  referral_code text unique not null,
  referred_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists tiles (
  q integer not null,
  r integer not null,
  owner uuid not null references profiles(id) on delete cascade,
  rar smallint not null check (rar between 0 and 3),
  level smallint not null default 0 check (level between 0 and 3),
  biome text not null,
  acquired_at timestamptz not null default now(),
  primary key (q, r)
);
create index if not exists tiles_owner on tiles(owner);

create table if not exists survey_answers (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists ad_events (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  transaction_id text unique not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

-- Nothing is readable or writable directly; clients only call the functions below.
alter table app_config enable row level security;
alter table profiles enable row level security;
alter table tiles enable row level security;
alter table survey_answers enable row level security;
alter table ad_events enable row level security;

-- ---------------------------------------------------------------- constants
create or replace function g_now() returns bigint language sql stable as
$$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

create or replace function g_minute() returns bigint language sql immutable as $$ select 60000::bigint $$;
create or replace function g_hour() returns bigint language sql immutable as $$ select 3600000::bigint $$;
create or replace function g_day() returns bigint language sql immutable as $$ select 86400000::bigint $$;

create or replace function rarity_rent(rar int) returns double precision language sql immutable as
$$ select (array[0.0000000011, 0.0000000016, 0.0000000022, 0.0000000044])[rar + 1]::double precision $$;

create or replace function tier_mult(n int) returns int language sql immutable as $$
  select case
    when greatest(n, 1) <= 150 then 30 when n <= 220 then 20 when n <= 290 then 15 when n <= 365 then 12
    when n <= 435 then 10 when n <= 545 then 8 when n <= 625 then 7 when n <= 730 then 6
    when n <= 875 then 5 when n <= 1100 then 4 when n <= 1500 then 3 else 2 end
$$;

create or replace function srb_cycle() returns bigint language sql immutable as $$ select 15 * 86400000::bigint $$;
create or replace function srb_len() returns bigint language sql immutable as $$ select 32 * 3600000::bigint $$;

-- ---------------------------------------------------------------- world (port of src/game/world.ts)
create or replace function hash32(x int, y int, s int) returns double precision language plpgsql immutable as $$
declare m bigint := 4294967295; h bigint;
begin
  h := ((((x::bigint & m) * 374761393) & m) + (((y::bigint & m) * 668265263) & m) + (((s::bigint & m) * 982451653) & m)) & m;
  h := ((h # (h >> 13)) * 1274126177) & m;
  h := h # (h >> 16);
  return h::double precision / 4294967295;
end $$;

create or replace function vnoise(x double precision, y double precision, s int) returns double precision language plpgsql immutable as $$
declare xi int := floor(x); yi int := floor(y); xf double precision; yf double precision; u double precision; v double precision;
  a double precision; b double precision; c double precision; d double precision;
begin
  xf := x - xi; yf := y - yi;
  u := xf * xf * (3 - 2 * xf); v := yf * yf * (3 - 2 * yf);
  a := hash32(xi, yi, s); b := hash32(xi + 1, yi, s); c := hash32(xi, yi + 1, s); d := hash32(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
end $$;

create or replace function fbm(x double precision, y double precision, s int) returns double precision language sql immutable as $$
  select vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 2) * 0.15
$$;

create or replace function biome_at(q int, r int) returns text language plpgsql immutable as $$
declare x double precision := sqrt(3::double precision) * (q + r / 2.0::double precision);
  y double precision := 1.5 * r; e double precision; m double precision;
begin
  e := fbm(x * 0.09 + 10, y * 0.09 + 10, 7319);
  m := fbm(x * 0.12 + 50, y * 0.12 + 50, 7319 + 9);
  return case
    when e < 0.36 then 'plage'
    when e > 0.62 then case when hash32(q, r, 7319 + 3) < 0.35 then 'volcan' else 'montagne' end
    when e > 0.54 then 'montagne'
    when m > 0.58 then 'marais'
    when m > 0.47 then 'foret'
    else 'prairie' end;
end $$;

create or replace function featured_biome(t bigint) returns text language sql immutable as $$
  select (array['plage','prairie','foret','marais','montagne','volcan'])[((t / (7 * 86400000::bigint)) % 6) + 1]
$$;

-- ---------------------------------------------------------------- derived values
create or replace function badge_count(uid uuid) returns int language sql stable as $$
  with t as (select * from tiles where owner = uid), n as (select count(*)::int c from t)
  select (select count(distinct biome)::int from t)
       + (select count(*)::int from unnest(array[5,15,30,60,100,150,250,500]) k, n where n.c >= k)
       + (select count(distinct rar)::int from t where rar > 0)
$$;

create or replace function passport_bonus(uid uuid) returns double precision language sql stable as $$
  select case when b >= 101 then 0.25 when b >= 61 then 0.2 when b >= 31 then 0.15 when b >= 11 then 0.1 when b >= 1 then 0.05 else 0 end
  from (select badge_count(uid) b) x
$$;

create or replace function base_rate(uid uuid, at bigint) returns double precision language sql stable as $$
  select coalesce(sum(rarity_rent(rar) * (1 + 0.1 * level) * case when biome = featured_biome(at) then 1.25 else 1 end), 0)
         * (1 + passport_bonus(uid))
  from tiles where owner = uid
$$;

create or replace function super_overlap(a bigint, b bigint) returns bigint language plpgsql immutable as $$
declare k bigint := floor(a::numeric / srb_cycle()); total bigint := 0; lo bigint; hi bigint;
begin
  while k * srb_cycle() <= b loop
    lo := greatest(a, k * srb_cycle()); hi := least(b, k * srb_cycle() + srb_len());
    if hi > lo then total := total + (hi - lo); end if;
    k := k + 1;
  end loop;
  return total;
end $$;

-- ---------------------------------------------------------------- internal helpers
create or replace function g_settle(uid uuid, t bigint) returns void language plpgsql security definer set search_path = public as $$
declare p profiles; base double precision; boost_end bigint; boosted bigint; sup bigint := 0; tier int;
begin
  select * into p from profiles where id = uid for update;
  if t <= p.coins_at then return; end if;
  base := base_rate(uid, p.coins_at);
  boost_end := least(t, p.boost_until);
  boosted := greatest(0, boost_end - p.coins_at);
  if boosted > 0 then sup := super_overlap(p.coins_at, boost_end); end if;
  tier := tier_mult((select count(*)::int from tiles where owner = uid));
  update profiles set
    coins = coins + base * ((t - p.coins_at) + boosted * (tier - 1) + sup * (50 - tier)) / 1000.0,
    coins_at = t
  where id = uid;
end $$;

-- Port of questsFor(day, 0): three distinct quests picked with the shared hash.
create or replace function quests_for(day int) returns jsonb language plpgsql immutable as $$
declare ids text[] := array['ad','claim','game','survey','boost']; out jsonb := '[]'; i int; idx int;
begin
  for i in 0..2 loop
    idx := floor(hash32(day, i, 7319 + 5) * array_length(ids, 1))::int + 1;
    out := out || jsonb_build_object('id', ids[idx], 'progress', 0, 'claimed', false);
    ids := ids[1:idx - 1] || ids[idx + 1:];
  end loop;
  return out;
end $$;

create or replace function quest_target(id text) returns int language sql immutable as $$
  select case id when 'ad' then 3 when 'claim' then 1 when 'game' then 2 when 'survey' then 1 when 'boost' then 2 end
$$;
create or replace function quest_reward(id text) returns int language sql immutable as $$
  select case id when 'ad' then 2 when 'claim' then 3 when 'game' then 2 when 'survey' then 1 when 'boost' then 2 end
$$;

create or replace function g_ensure_day(uid uuid, t bigint) returns void language plpgsql security definer set search_path = public as $$
declare d int := (t / g_day())::int;
begin
  update profiles set quest_day = d, quests = quests_for(d) where id = uid and quest_day <> d;
end $$;

create or replace function g_bump_quest(uid uuid, qid text) returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set quests = (
    select jsonb_agg(case when e->>'id' = qid
      then jsonb_set(e, '{progress}', to_jsonb(least(quest_target(qid), (e->>'progress')::int + 1))) else e end)
    from jsonb_array_elements(quests) e)
  where id = uid and jsonb_array_length(quests) > 0;
end $$;

create or replace function g_uid() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour jouer.'; end if;
  return auth.uid();
end $$;

-- ---------------------------------------------------------------- state for the client
create or replace function get_state() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; tl jsonb;
begin
  perform g_settle(uid, t);
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid;
  select coalesce(jsonb_object_agg(q || ',' || r, jsonb_build_object('rar', rar, 'level', level, 'biome', biome)), '{}')
    into tl from tiles where owner = uid;
  return jsonb_build_object(
    'now', t,
    's', jsonb_build_object(
      'pearls', p.pearls, 'coins', p.coins, 'coinsAt', p.coins_at, 'tiles', tl,
      'spawn', jsonb_build_array(p.spawn_q, p.spawn_r), 'boostUntil', p.boost_until,
      'cd', jsonb_build_object('ad', p.cd_ad, 'survey', p.cd_survey, 'fish', p.cd_fish, 'memo', p.cd_memo),
      'pendingGame', case when p.pending_game is null then null else jsonb_build_object('game', p.pending_game, 'at', p.pending_at) end,
      'streak', jsonb_build_object('count', p.streak_count, 'lastDay', p.streak_day),
      'quests', jsonb_build_object('day', p.quest_day, 'items', p.quests),
      'flags', to_jsonb(p.flags), 'flag', p.flag, 'username', p.username,
      'referralCode', p.referral_code, 'referralUsed', p.referred_by is not null));
end $$;

-- ---------------------------------------------------------------- actions
create or replace function daily_login() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); d int := (t / g_day())::int; p profiles; c int; reward int := 0;
begin
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid for update;
  if p.streak_day <> d then
    c := case when p.streak_day = d - 1 then p.streak_count + 1 else 1 end;
    reward := (array[1,1,2,2,3,3,5])[((c - 1) % 7) + 1];
    update profiles set streak_count = c, streak_day = d, pearls = pearls + reward where id = uid;
  end if;
  return get_state() || jsonb_build_object('reward', reward);
end $$;

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
  rr := case when x < 0.05 then 3 when x < 0.2 then 2 when x < 0.5 then 1 else 0 end;
  insert into tiles(q, r, owner, rar, biome) values (tq, tr, uid, rr, biome_at(tq, tr));
  update profiles set pearls = pearls - price where id = uid;
  perform g_bump_quest(uid, 'claim');
  return get_state() || jsonb_build_object('tile', jsonb_build_object('rar', rr, 'level', 0, 'biome', biome_at(tq, tr)));
end $$;

create or replace function ad_reward(kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; ev bigint;
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
    if p.boost_until - t > 5 * g_hour() then raise exception 'Votre réserve de boost est pleine.'; end if;
    update profiles set boost_until = least(t + 6 * g_hour(), greatest(t, p.boost_until) + g_hour()) where id = uid;
    perform g_bump_quest(uid, 'boost');
  end if;
  perform g_bump_quest(uid, 'ad');
  return get_state();
end $$;

create or replace function start_game(game text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles;
begin
  if game not in ('fish','memo') then raise exception 'Jeu inconnu.'; end if;
  select * into p from profiles where id = uid for update;
  if (game = 'fish' and t < p.cd_fish) or (game = 'memo' and t < p.cd_memo) then
    raise exception 'Ce mini-jeu n''est pas encore disponible.';
  end if;
  update profiles set pending_game = game, pending_at = t,
    cd_fish = case when game = 'fish' then t + g_hour() else cd_fish end,
    cd_memo = case when game = 'memo' then t + g_hour() else cd_memo end
  where id = uid;
  return get_state();
end $$;

create or replace function finish_game(game text, score int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); p profiles; reward int;
begin
  select * into p from profiles where id = uid for update;
  if p.pending_game is distinct from game then raise exception 'Aucune partie en cours.'; end if;
  -- a real round lasts 12 s (fish) or up to 40 s (memo); reject instant or stale submissions
  if t - p.pending_at < (case when game = 'fish' then 10000 else 4000 end) or t - p.pending_at > 10 * g_minute() then
    update profiles set pending_game = null where id = uid;
    raise exception 'Partie invalide.';
  end if;
  reward := case when game = 'fish' then least(3, greatest(0, score) / 5)
                 when score >= 6 then 3 else greatest(0, least(6, score)) / 2 end;
  update profiles set pending_game = null, pearls = pearls + reward where id = uid;
  perform g_ensure_day(uid, t);
  perform g_bump_quest(uid, 'game');
  return get_state() || jsonb_build_object('reward', reward);
end $$;

create or replace function submit_survey(answers jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now();
begin
  if (select cd_survey from profiles where id = uid) > t then raise exception 'Le prochain sondage n''est pas encore disponible.'; end if;
  if jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) <> 3 then raise exception 'Répondez aux 3 questions.'; end if;
  insert into survey_answers(user_id, answers) values (uid, answers);
  update profiles set pearls = pearls + 3, cd_survey = t + 2 * g_hour() where id = uid;
  perform g_ensure_day(uid, t);
  perform g_bump_quest(uid, 'survey');
  return get_state();
end $$;

create or replace function claim_quest(qid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); e jsonb;
begin
  perform g_ensure_day(uid, t);
  select x into e from profiles, jsonb_array_elements(quests) x where id = uid and x->>'id' = qid;
  if e is null or (e->>'claimed')::boolean or (e->>'progress')::int < quest_target(qid) then raise exception 'Quête non terminée.'; end if;
  update profiles set pearls = pearls + quest_reward(qid), quests = (
    select jsonb_agg(case when x->>'id' = qid then jsonb_set(x, '{claimed}', 'true') else x end) from jsonb_array_elements(quests) x)
  where id = uid;
  return get_state();
end $$;

create or replace function buy_pearls(n int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid();
begin
  perform g_settle(uid, g_now());
  if n < 1 or (select coins from profiles where id = uid) < n * 0.0001 then raise exception 'Pas assez de doublons.'; end if;
  update profiles set coins = greatest(0, coins - n * 0.0001), pearls = pearls + n where id = uid;
  return get_state();
end $$;

create or replace function upgrade_tile(tq int, tr int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); lv int; cost double precision;
begin
  perform g_settle(uid, g_now());
  select level into lv from tiles where q = tq and r = tr and owner = uid for update;
  if lv is null then raise exception 'Cet îlot ne vous appartient pas.'; end if;
  if lv >= 3 then raise exception 'Niveau maximum atteint.'; end if;
  cost := 0.0005 * (lv + 1);
  if (select coins from profiles where id = uid) < cost then raise exception 'Pas assez de doublons.'; end if;
  update profiles set coins = greatest(0, coins - cost) where id = uid;
  update tiles set level = level + 1 where q = tq and r = tr;
  return get_state();
end $$;

create or replace function buy_flag(fid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); price double precision;
begin
  price := case fid when 'lagon' then 0 when 'corail' then 0.0002 when 'safran' then 0.0002 when 'algue' then 0.0002 when 'nuit' then 0.0002 end;
  if price is null then raise exception 'Drapeau inconnu.'; end if;
  perform g_settle(uid, g_now());
  if not exists (select 1 from profiles where id = uid and fid = any(flags)) then
    if (select coins from profiles where id = uid) < price then raise exception 'Pas assez de doublons.'; end if;
    update profiles set coins = greatest(0, coins - price), flags = array_append(flags, fid) where id = uid;
  end if;
  update profiles set flag = fid where id = uid;
  return get_state();
end $$;

create or replace function set_username(name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare clean text := left(btrim(name), 20);
begin
  if length(clean) < 2 then raise exception 'Choisissez un nom d''au moins 2 caractères.'; end if;
  update profiles set username = clean where id = g_uid();
  return get_state();
end $$;

-- Both the new player and their sponsor get 10 pearls, once.
create or replace function apply_referral(code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); sponsor uuid;
begin
  if (select referred_by from profiles where id = uid) is not null then raise exception 'Vous avez déjà utilisé un code.'; end if;
  select id into sponsor from profiles where referral_code = upper(btrim(code));
  if sponsor is null or sponsor = uid then raise exception 'Code de parrainage invalide.'; end if;
  update profiles set referred_by = sponsor, pearls = pearls + 10 where id = uid;
  update profiles set pearls = pearls + 10 where id = sponsor;
  return get_state() || jsonb_build_object('reward', 10);
end $$;

-- ---------------------------------------------------------------- social reads
create or replace function tiles_near(cq int, cr int, radius int) returns table(q int, r int, owner text, flag text)
language sql stable security definer set search_path = public as $$
  select t.q, t.r, p.username, p.flag from tiles t join profiles p on p.id = t.owner
  where t.owner <> auth.uid() and t.q between cq - radius and cq + radius and t.r between cr - radius and cr + radius
  limit 2000
$$;

create or replace function leaderboard() returns table(username text, tiles int, coins double precision, flag text, me boolean)
language sql stable security definer set search_path = public as $$
  select p.username, count(t.*)::int, p.coins, p.flag, p.id = auth.uid()
  from profiles p left join tiles t on t.owner = p.id
  group by p.id order by count(t.*) desc, p.coins desc limit 50
$$;

-- ---------------------------------------------------------------- new players
-- Spawn in free sea, a few hexes away from everyone, on a ring that grows with the player count.
create or replace function pick_spawn(out sq int, out sr int) language plpgsql as $$
declare ring double precision := 12 + 6 * sqrt((select count(*) from profiles)); a double precision; i int;
begin
  for i in 1..60 loop
    a := random() * 2 * pi();
    sr := round(ring * sin(a) / 1.5)::int;
    sq := round(ring * cos(a) / sqrt(3::double precision) - sr / 2.0)::int;
    if not exists (select 1 from tiles where abs(q - sq) + abs(r - sr) + abs(q + r - sq - sr) <= 8) then return; end if;
    ring := ring + 2;
  end loop;
end $$;

create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; code text;
begin
  select * into s from pick_spawn();
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from profiles where referral_code = code);
  end loop;
  insert into profiles(id, coins_at, spawn_q, spawn_r, referral_code) values (new.id, g_now(), s.sq, s.sr, code);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------------------------------------------------------------- permissions
revoke all on all functions in schema public from public, anon;
grant execute on function get_state(), daily_login(), claim_tile(int, int), ad_reward(text), start_game(text),
  finish_game(text, int), submit_survey(jsonb), claim_quest(text), buy_pearls(int), upgrade_tile(int, int),
  buy_flag(text), set_username(text), apply_referral(text), tiles_near(int, int, int), leaderboard()
  to authenticated;

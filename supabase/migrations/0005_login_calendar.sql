-- Daily login bonus, Atlas Earth-style: unlocked at 3 islands, collected by hand once a day,
-- 1 pearl a day with bigger milestones over a 90-day cycle; a missed day starts again at day 1.
-- Mirrors STREAK_* and streakReward in src/game/rules.ts.

create or replace function streak_reward(n int) returns int language sql immutable as $$
  select case ((n - 1) % 90) + 1
    when 7 then 5 when 14 then 10 when 21 then 10 when 30 then 25
    when 45 then 25 when 60 then 50 when 75 then 50 when 90 then 200 else 1 end
$$;

-- Opening the game only starts the day (quests); the bonus is no longer automatic.
create or replace function daily_login() returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform g_ensure_day(g_uid(), g_now());
  return get_state() || jsonb_build_object('reward', 0);
end $$;

create or replace function claim_streak() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := g_uid(); t bigint := g_now(); d int := (t / g_day())::int; p profiles; c int; reward int;
begin
  perform g_ensure_day(uid, t);
  select * into p from profiles where id = uid for update;
  if (select count(*) from tiles where owner = uid) < 3 then raise exception 'Possédez 3 îlots pour débloquer le bonus de connexion.'; end if;
  if p.streak_day = d then raise exception 'Bonus du jour déjà récupéré. Revenez demain !'; end if;
  c := case when p.streak_day = d - 1 then p.streak_count + 1 else 1 end;
  reward := streak_reward(c);
  update profiles set streak_count = c, streak_day = d, pearls = pearls + reward where id = uid;
  return get_state() || jsonb_build_object('reward', reward);
end $$;

revoke all on function streak_reward(int), claim_streak() from public, anon;
grant execute on function claim_streak() to authenticated;

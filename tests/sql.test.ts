// Runs the Supabase migration in an embedded Postgres (PGlite) and exercises every game function.
// Checks that the SQL world/quest generation matches the TypeScript rules. Run: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { biomeAt } from '../src/game/world';
import { ACHIEVEMENTS, DAY, eventAt, HOUR, passStreakReward, questsFor, streakReward } from '../src/game/rules';
const db = new PGlite();
const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows as any[];
(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;`);
  for (const m of ['0001_init.sql', '0002_delete_account.sql', '0003_engagement.sql', '0004_privacy.sql', '0005_login_calendar.sql', '0006_pass.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${m}`, import.meta.url), 'utf8'));
  // world parity
  let bad = 0;
  for (let a = -30; a <= 30; a += 3) for (let b = -30; b <= 30; b += 3) {
    const [row] = await q('select biome_at($1,$2) b', [a, b]);
    if (row.b !== biomeAt(a, b)) bad++;
  }
  console.log('biome mismatches', bad);
  for (const d of [20000, 20001, 20002]) {
    const [row] = await q('select quests_for($1) j', [d]);
    const sqlIds = row.j.map((x: any) => x.id).join(), js = questsFor(d, 0).join();
    console.log('quests', d, sqlIds === js ? 'ok' : `MISMATCH ${sqlIds} vs ${js}`);
  }
  // event calendar parity, every 7 h over 60 days
  let evBad = 0;
  for (let t = 1.79e12; t < 1.79e12 + 60 * DAY; t += 7 * HOUR) {
    const [row] = await q('select event_at($1::bigint) e', [Math.round(t)]);
    if (row.e !== (eventAt(Math.round(t))?.id ?? null)) evBad++;
  }
  console.log('event mismatches', evBad);
  let achBad = 0;
  for (const a of ACHIEVEMENTS) { const [row] = await q('select ach_reward($1) r', [a.id]); if (row.r !== a.reward) achBad++; }
  console.log('achievement reward mismatches', achBad, 'of', ACHIEVEMENTS.length);
  let stBad = 0;
  for (let n = 1; n <= 200; n++) { const [row] = await q('select streak_reward($1) r', [n]); if (row.r !== streakReward(n)) stBad++;
    const [pr] = await q('select pass_streak_reward($1) r', [n]); if (pr.r !== passStreakReward(n)) stBad++; }
  console.log('streak reward mismatches', stBad);
  const u1 = '11111111-1111-1111-1111-111111111111', u2 = '22222222-2222-2222-2222-222222222222';
  await q('insert into auth.users values ($1),($2)', [u1, u2]);
  const as = async (u: string, sql: string, p: any[] = []) => { await db.exec(`set test.uid='${u}'`); try { return (await q(sql, p))[0]; } catch (e: any) { return { error: e.message }; } };
  let st = await as(u1, 'select get_state() j'); const sp = st.j.s.spawn; console.log('spawn', sp, 'code', st.j.s.referralCode);
  console.log('login', (await as(u1, 'select daily_login() j')).j.reward);
  console.log('claim off-spawn', (await as(u1, 'select claim_tile(999,999) j')).error);
  const c1 = await as(u1, 'select claim_tile($1,$2) j', sp); console.log('claim spawn', c1.j?.tile, c1.error);
  console.log('claim neighbour w/o pearls', (await as(u1, 'select claim_tile($1,$2) j', [sp[0] + 1, sp[1]])).error);
  console.log('pearl ad', (await as(u1, 'select ad_reward($1) j', ['pearl'])).j.s.pearls);
  console.log('pearl ad again', (await as(u1, 'select ad_reward($1) j', ['pearl'])).error);
  const b = await as(u1, 'select ad_reward($1) j', ['boost']); console.log('boost until-now h', (b.j.s.boostUntil - b.j.now) / 3.6e6);
  console.log('start fish', !!(await as(u1, "select start_game('fish') j")).j);
  console.log('finish too fast', (await as(u1, "select finish_game('fish', 20) j")).error);
  const s2 = await as(u1, "select submit_survey('[1,2,3]'::jsonb) j"); console.log('survey pearls', s2.j?.s.pearls, s2.error);
  console.log('quests', JSON.stringify(s2.j.s.quests.items));
  await db.exec(`update profiles set pearls = 500, coins = 0.01 where id='${u1}'`);
  console.log('claim neighbour', (await as(u1, 'select claim_tile($1,$2) j', [sp[0] + 1, sp[1]])).j?.tile);
  console.log('buy pearls', (await as(u1, 'select buy_pearls(10) j')).j?.s.pearls);
  console.log('upgrade', JSON.stringify((await as(u1, 'select upgrade_tile($1,$2) j', sp)).j?.s.tiles));
  { const f = await as(u1, "select buy_flag('corail') j"); console.log('flag', f.j?.s.flag, f.error); }
  const code = st.j.s.referralCode;
  console.log('referral', (await as(u2, 'select apply_referral($1) j', [code])).j?.reward, (await as(u2, 'select apply_referral($1) j', [code])).error);
  console.log('near (u2 sees u1)', (await db.exec(`set test.uid='${u2}'`), await q('select * from tiles_near($1,$2,10)', sp)).length);
  console.log('leaderboard', JSON.stringify(await q('select * from leaderboard()')));
  // rent settle: backdate coins_at by one day with 2 tiles
  await db.exec(`update profiles set coins=0, coins_at = coins_at - 86400000, boost_until=0 where id='${u1}'`);
  console.log('1 day rent', (await as(u1, 'select get_state() j')).j.s.coins);
  // engagement features
  { const a = await as(u1, "select claim_achievement('size_5') j"); console.log('ach not done', a.error); }
  { const a = await as(u1, "select claim_achievement('rar_' || (select rar from tiles where owner = $1 limit 1)) j", [u1]);
    console.log('ach claim', a.j ? a.j.s.achClaimed : a.error); }
  await db.exec(`update profiles set coins = 0.01 where id='${u1}'`);
  { const d = await as(u1, 'select decorate_tile($1,$2,$3) j', [sp[0], sp[1], 'bateau']); console.log('decorate', d.j ? d.j.s.tiles[`${sp[0]},${sp[1]}`].deco : d.error); }
  { const d = await as(u1, 'select decorate_tile($1,$2,$3) j', [sp[0], sp[1], 'tortue']); console.log('turtle locked', d.error); }
  { const p = await as(u1, "select test_purchase('perles_100') j"); console.log('pack', p.j?.s.pearls); }
  await db.exec('update app_config set iap_test = false');
  console.log('purchase off', (await as(u1, "select test_purchase('perles_100') j")).error);
  { const ev = (await q('select event_at(g_now()) e'))[0].e; const c = await as(u1, 'select catch_creature() j');
    console.log('catch during', ev, c.j ? [c.j.reward, c.j.s.caught] : c.error, 'again:', (await as(u1, 'select catch_creature() j')).error); }
  // login calendar
  console.log('streak locked', (await as(u2, 'select claim_streak() j')).error);
  await q(`insert into tiles(q, r, owner, rar, biome) values (500, 500, $1, 0, 'plage')`, [u1]);
  { const a = await as(u1, 'select claim_streak() j'); console.log('streak day', a.j?.s.streak.count, 'reward', a.j?.reward); }
  console.log('streak twice', (await as(u1, 'select claim_streak() j')).error);
  await db.exec(`update profiles set streak_day = streak_day - 1, streak_count = 6 where id='${u1}'`);
  { const a = await as(u1, 'select claim_streak() j'); console.log('streak day', a.j?.s.streak.count, 'reward', a.j?.reward, '(want 7, 5)'); }
  await db.exec(`update profiles set streak_day = streak_day - 2, streak_count = 29 where id='${u1}'`);
  { const a = await as(u1, 'select claim_streak() j'); console.log('after missed day', a.j?.s.streak.count, 'reward', a.j?.reward, '(want 1, 1)'); }
  // Pass Capitaine
  await db.exec('update app_config set iap_test = true');
  { const now = (await q('select g_now() t'))[0].t;
    const a = await as(u1, "select test_purchase('pass_capitaine') j");
    console.log('pass days', Math.round((a.j.s.passUntil - now) / 86400000));
    await db.exec(`update profiles set boost_until = g_now() + 6.5 * 3600000, cd_fish = 0, streak_day = streak_day - 1 where id='${u1}'`);
    const b = await as(u1, "select ad_reward('boost') j");
    console.log('pass boost over 6 h', b.j ? Math.round((b.j.s.boostUntil - now) / 60000) + ' min' : b.error);
    const g = await as(u1, "select start_game('fish') j");
    console.log('pass fish cooldown', Math.round((g.j.s.cd.fish - now) / 60000), 'min');
    const k = await as(u1, 'select claim_streak() j'); console.log('pass login', k.j?.s.streak.count, 'reward', k.j?.reward, '(want 2, 1 + 2)');
    console.log('pass in ranking', (await as(u1, 'select * from leaderboard() where me')).pass);
    await db.exec(`update profiles set boost_until = g_now() + 6.5 * 3600000, pass_until = 0 where id='${u1}'`);
    console.log('no pass boost over 6 h', (await as(u1, "select ad_reward('boost') j")).error); }
  { const x = (await as(u1, 'select export_my_data() j')).j;
    console.log('export', x.account.id === u1, x.tiles.length, 'tiles', x.purchases.length, 'purchases', x.survey_answers.length, 'surveys', x.referred_players, 'referred'); }
  console.log('anon export', (await as('', 'select export_my_data() j')).error ? 'refused' : 'ALLOWED');
  // u2 was referred by u1: deleting u1 must keep u2 and remove all of u1's rows
  await as(u1, 'select delete_account()');
  const left = await q(`select (select count(*) from auth.users where id='${u1}') u, (select count(*) from profiles where id='${u1}') p,
    (select count(*) from tiles where owner='${u1}') t, (select count(*) from profiles where id='${u2}') other`);
  console.log('delete account', JSON.stringify(left[0]));
  // retention: a player inactive for 3 years is purged, an active one stays
  const u3 = '33333333-3333-3333-3333-333333333333';
  await q('insert into auth.users values ($1)', [u3]); await as(u3, 'select get_state() j');
  await db.exec(`update profiles set coins_at = coins_at - 3 * 366 * 86400000::bigint where id='${u2}'`);
  console.log('purge', (await q('select purge_inactive() n'))[0].n, 'left', JSON.stringify(await q('select id from profiles')));
})();

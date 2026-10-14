// Runs the Supabase migration in an embedded Postgres (PGlite) and exercises every game function.
// Checks that the SQL world/quest generation matches the TypeScript rules. Run: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { biomeAt } from '../src/game/world';
import { questsFor } from '../src/game/rules';
const db = new PGlite();
const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows as any[];
(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;`);
  for (const m of ['0001_init.sql', '0002_delete_account.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${m}`, import.meta.url), 'utf8'));
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
  // u2 was referred by u1: deleting u1 must keep u2 and remove all of u1's rows
  await as(u1, 'select delete_account()');
  const left = await q(`select (select count(*) from auth.users where id='${u1}') u, (select count(*) from profiles where id='${u1}') p,
    (select count(*) from tiles where owner='${u1}') t, (select count(*) from profiles where id='${u2}') other`);
  console.log('delete account', JSON.stringify(left[0]));
})();

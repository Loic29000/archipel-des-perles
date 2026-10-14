// Online backend: Supabase is the authority (see supabase/migrations). Players start
// with an anonymous account and can attach an email later to keep their game.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GameError, GameState, Tile } from '../game/rules';
import type { Account, Backend, LeaderRow, WorldTile } from './types';

interface Envelope { now: number; s: GameState; reward?: number; tile?: Tile }

export function createOnlineBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  let offset = 0; // server clock minus device clock
  let account: Account = { online: true, email: null, anonymous: true };

  async function rpc(name: string, args?: Record<string, unknown>): Promise<Envelope> {
    const sent = Date.now();
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new GameError(error.message);
    const env = data as Envelope;
    offset = env.now - (sent + Date.now()) / 2;
    return env;
  }

  async function init() {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw new GameError('Connexion au serveur impossible : ' + error.message);
    }
    const { data: u } = await sb.auth.getUser();
    account = { online: true, email: u.user?.email ?? null, anonymous: !!u.user?.is_anonymous, userId: u.user?.id };
    return (await rpc('get_state')).s;
  }

  return {
    mode: 'online',
    now: () => Date.now() + offset,
    init,
    async resetAll() {
      const { error } = await sb.rpc('delete_account');
      if (error) throw new GameError(error.message);
      await sb.auth.signOut();
      return init();
    },
    dailyLogin: async () => { const e = await rpc('daily_login'); return { s: e.s, reward: e.reward ?? 0 }; },
    claim: async (q, r) => { const e = await rpc('claim_tile', { tq: q, tr: r }); return { s: e.s, tile: e.tile! }; },
    adReward: async kind => (await rpc('ad_reward', { kind })).s,
    startGame: async game => (await rpc('start_game', { game })).s,
    finishGame: async (game, score) => { const e = await rpc('finish_game', { game, score }); return { s: e.s, reward: e.reward ?? 0 }; },
    survey: async answers => (await rpc('submit_survey', { answers })).s,
    claimQuest: async id => (await rpc('claim_quest', { qid: id })).s,
    buyPearls: async n => (await rpc('buy_pearls', { n })).s,
    upgrade: async (q, r) => (await rpc('upgrade_tile', { tq: q, tr: r })).s,
    buyFlag: async id => (await rpc('buy_flag', { fid: id })).s,
    setUsername: async name => (await rpc('set_username', { name })).s,
    applyReferral: async code => { const e = await rpc('apply_referral', { code }); return { s: e.s, reward: e.reward ?? 0 }; },
    async othersNear(q, r, radius) {
      const { data, error } = await sb.rpc('tiles_near', { cq: q, cr: r, radius });
      if (error) return [];
      return data as WorldTile[];
    },
    async leaderboard() {
      const { data, error } = await sb.rpc('leaderboard');
      if (error) throw new GameError(error.message);
      return data as LeaderRow[];
    },
    account: () => account,
    async linkEmail(email) {
      // Keeps the same user id: the anonymous game becomes a permanent account once the email is confirmed.
      const { error } = await sb.auth.updateUser({ email });
      if (error) throw new GameError(error.message);
    },
  };
}

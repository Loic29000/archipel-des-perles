// Offline backend: the rules run on the device and the game is saved locally.
// Used for the web prototype, for demo mode, and when no server is configured.
import * as R from '../game/rules';
import { loadJSON, removeKey, saveJSON } from '../services/storage';
import type { Backend } from './types';

const DEMO_SPEED = 600; // 1 s = 10 min
interface Save { s: R.GameState; gt: number; real: number }

export function createLocalBackend(): Backend {
  let demo = false;
  let s: R.GameState;
  let gt = Date.now(), real = Date.now();
  const speed = () => (demo ? DEMO_SPEED : 1);
  const now = () => gt + (Date.now() - real) * speed();
  const slot = () => (demo ? 'archipel:v1:demo' : 'archipel:v1');

  async function persist() {
    gt = now(); real = Date.now();
    await saveJSON(slot(), { s, gt, real } satisfies Save);
  }
  async function load() {
    const saved = await loadJSON<Save>(slot());
    if (saved) {
      // time spent with the app closed counts at normal speed, even in demo mode
      s = saved.s; gt = saved.gt + (Date.now() - saved.real); real = Date.now();
    } else {
      gt = Date.now(); real = Date.now();
      s = R.newState(gt);
      s.referralCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      if (demo) s.pearls = 300;
    }
    await saveJSON('archipel:mode', { demo });
    return s;
  }
  async function apply<T extends { s: R.GameState }>(fn: () => T): Promise<T>;
  async function apply(fn: () => R.GameState): Promise<R.GameState>;
  async function apply(fn: () => any) {
    const out = fn();
    s = 's' in out && out.s ? out.s : out;
    await persist();
    return out;
  }

  return {
    mode: 'local',
    now,
    async init() {
      demo = (await loadJSON<{ demo: boolean }>('archipel:mode'))?.demo ?? false;
      return load();
    },
    dailyLogin: () => apply(() => R.dailyLogin(s, now())),
    claim: (q, r) => apply(() => R.claim(s, q, r, now(), Math.random())),
    adReward: kind => apply(() => R.adReward(s, kind, now())),
    startGame: game => apply(() => R.startGame(s, game, now())),
    finishGame: (game, score) => apply(() => R.finishGame(s, game, score, now())),
    survey: () => apply(() => R.submitSurvey(s, now())),
    claimQuest: id => apply(() => R.claimQuest(s, id, now())),
    buyPearls: n => apply(() => R.buyPearls(s, n, now())),
    upgrade: (q, r) => apply(() => R.upgradeTile(s, q, r, now())),
    buyFlag: id => apply(() => R.buyFlag(s, id, now())),
    setUsername: name => apply(() => ({ ...s, username: name.trim().slice(0, 20) || s.username })),
    async applyReferral() {
      throw new R.GameError('Le parrainage fonctionne avec un compte en ligne.');
    },
    async othersNear() { return []; },
    async leaderboard() {
      const t = R.settle(s, now());
      return [{ username: s.username, tiles: R.tileCount(s), coins: t.coins, flag: s.flag, me: true }];
    },
    account: () => ({ online: false, email: null, anonymous: true }),
    async linkEmail() {
      throw new R.GameError('Les comptes demandent une connexion au serveur du jeu.');
    },
    async resetAll() {
      await removeKey(slot());
      return load();
    },
    demo: {
      enabled: () => demo,
      async toggle() { await persist(); demo = !demo; return load(); },
      gift: () => apply(() => ({ ...s, pearls: s.pearls + 100 })),
    },
  };
}

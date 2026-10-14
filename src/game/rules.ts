// Game rules as pure functions. The local backend runs them directly; the online
// backend runs the same rules in Postgres (supabase/migrations/0001_init.sql), which
// is the authority. Keep both in step when changing a number here.
import { BIOMES, BIOME_KEYS, Biome, biomeAt, hash, key, neighborsOf, SEED } from './world';

export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000, WEEK = 7 * DAY;

export type Rarity = 0 | 1 | 2 | 3;
// Rent per second (doublons) and drop odds, from Atlas Earth's published figures.
export const RARITIES = [
  { name: 'Commun', rent: 0.0000000011, odds: 0.5 },
  { name: 'Rare', rent: 0.0000000016, odds: 0.3 },
  { name: 'Épique', rent: 0.0000000022, odds: 0.15 },
  { name: 'Légendaire', rent: 0.0000000044, odds: 0.05 },
] as const;

export const ISLAND_PRICE = 100;
// Boost multiplier by islands owned (Atlas Earth US tiers).
export const TIERS: [number, number][] = [[150, 30], [220, 20], [290, 15], [365, 12], [435, 10], [545, 8], [625, 7], [730, 6], [875, 5], [1100, 4], [1500, 3], [Infinity, 2]];
// Passport: notebooks needed -> permanent rent bonus.
export const PASSPORT: [number, number][] = [[101, 0.25], [61, 0.2], [31, 0.15], [11, 0.1], [1, 0.05]];
export const SUPER_MULT = 50, MAX_BOOST = 6 * HOUR, SRB_CYCLE = 15 * DAY, SRB_LEN = 32 * HOUR;
export const EVENT_BONUS = 0.25;
export const COOLDOWN = { ad: 20 * MIN, survey: 2 * HOUR, fish: HOUR, memo: HOUR, event: HOUR };
export const STREAK_REWARDS = [1, 1, 2, 2, 3, 3, 5];
// Shop prices in doublons.
export const PEARL_PRICE = 0.0001;
export const UPGRADE_PRICE = (level: number) => 0.0005 * (level + 1);
export const UPGRADE_BONUS = 0.1, MAX_LEVEL = 3;
export const FLAGS = [
  { id: 'lagon', name: 'Lagon', price: 0 },
  { id: 'corail', name: 'Corail', price: 0.0002 },
  { id: 'safran', name: 'Safran', price: 0.0002 },
  { id: 'algue', name: 'Algue', price: 0.0002 },
  { id: 'nuit', name: 'Nuit', price: 0.0002 },
] as const;
export type FlagId = (typeof FLAGS)[number]['id'];

// Island decorations: cosmetic, shown on the map. The turtle comes from events.
export const DECOS = [
  { id: 'cabane', name: 'Cabane', price: 0.0003 },
  { id: 'bateau', name: 'Voilier', price: 0.0003 },
  { id: 'mouettes', name: 'Mouettes', price: 0.0004 },
  { id: 'tresor', name: 'Coffre au trésor', price: 0.0006 },
  { id: 'tortue', name: 'Tortue', price: 0 },
] as const;
export type DecoId = (typeof DECOS)[number]['id'];

// Limited-time events: 4 days every 14, rotating. EVENT_OFFSET only shifts the calendar.
export const EVENT_CYCLE = 14 * DAY, EVENT_LEN = 4 * DAY, EVENT_OFFSET = 203 * HOUR;
export const EVENTS = [
  { id: 'tortues', name: 'Migration des tortues', creature: 'tortue', desc: 'Les tortues rapportent 3 perles au lieu de 2.' },
  { id: 'maree', name: 'Grande marée dorée', creature: 'coquillage', desc: 'Chances doublées d’îlots légendaires (10 %) et épiques (20 %).' },
  { id: 'baleines', name: 'Chant des baleines', creature: 'baleine', desc: 'Chaque pub de boost ajoute 2 h au lieu d’1 h.' },
] as const;
export type EventId = (typeof EVENTS)[number]['id'];

// Achievements: one-time pearl rewards. The first three groups also count for the passport.
export const ACHIEVEMENTS: { id: string; name: string; desc: string; reward: number }[] = [
  ...BIOME_KEYS.map(b => ({ id: `biome_${b}`, name: `Explorateur · ${BIOMES[b]}`, desc: `Posséder un îlot ${BIOMES[b].toLowerCase()}`, reward: 2 })),
  ...([[5, 3], [15, 5], [30, 8], [60, 12], [100, 15], [150, 20], [250, 30], [500, 50]] as const).map(([k, r]) => ({ id: `size_${k}`, name: `Archipel de ${k}`, desc: `Posséder ${k} îlots`, reward: r })),
  ...(['Rare', 'Épique', 'Légendaire'] as const).map((n, i) => ({ id: `rar_${i + 1}`, name: `Chasseur · ${n}`, desc: `Posséder un îlot ${n.toLowerCase()}`, reward: [3, 5, 10][i] })),
  ...([[3, 2], [7, 5], [30, 15]] as const).map(([k, r]) => ({ id: `streak_${k}`, name: `Fidèle · ${k} jours`, desc: `Série de connexion de ${k} jours`, reward: r })),
  ...([[1, 2], [10, 5]] as const).map(([k, r]) => ({ id: `phare_${k}`, name: k === 1 ? 'Gardien de phare' : 'Côte illuminée', desc: k === 1 ? 'Construire un phare' : 'Construire 10 phares', reward: r })),
  ...([[1, 2], [5, 5]] as const).map(([k, r]) => ({ id: `deco_${k}`, name: k === 1 ? 'Décorateur' : 'Architecte', desc: k === 1 ? 'Décorer un îlot' : 'Décorer 5 îlots', reward: r })),
  ...([[1, 3], [10, 8]] as const).map(([k, r]) => ({ id: `catch_${k}`, name: k === 1 ? 'Première rencontre' : 'Ami des créatures', desc: k === 1 ? 'Attraper une créature d’événement' : 'Attraper 10 créatures d’événement', reward: r })),
];

// In-app purchases (store prices are shown for information; the store sets the real ones).
export const PRODUCTS = [
  { id: 'perles_100', name: '100 perles', pearls: 100, price: '0,99 €' },
  { id: 'perles_550', name: '550 perles', pearls: 550, price: '4,99 €' },
  { id: 'perles_1200', name: '1 200 perles', pearls: 1200, price: '9,99 €' },
  { id: 'sans_pubs', name: 'Sans pubs', pearls: 0, price: '3,99 €' },
] as const;
export type ProductId = (typeof PRODUCTS)[number]['id'];

export type QuestId = 'ad' | 'claim' | 'game' | 'survey' | 'boost';
export const QUESTS: Record<QuestId, { label: string; target: number; reward: number }> = {
  ad: { label: 'Regarder 3 pubs', target: 3, reward: 2 },
  claim: { label: 'Acquérir 1 îlot', target: 1, reward: 3 },
  game: { label: 'Jouer à 2 mini-jeux', target: 2, reward: 2 },
  survey: { label: 'Répondre à un sondage', target: 1, reward: 1 },
  boost: { label: 'Cumuler 2 h de boost', target: 2, reward: 2 },
};
const QUEST_IDS = Object.keys(QUESTS) as QuestId[];

export type Game = 'fish' | 'memo';
export type AdKind = 'pearl' | 'boost' | 'game';

export interface Tile { rar: Rarity; level: number; biome: Biome; deco?: DecoId | null }
export interface GameState {
  pearls: number;
  coins: number;
  coinsAt: number; // rent is settled up to this time
  tiles: Record<string, Tile>;
  spawn: [number, number];
  boostUntil: number;
  cd: { ad: number; survey: number; fish: number; memo: number; event: number };
  pendingGame: { game: Game; at: number } | null;
  streak: { count: number; lastDay: number };
  quests: { day: number; items: { id: QuestId; progress: number; claimed: boolean }[] };
  flags: FlagId[];
  flag: FlagId;
  username: string;
  referralCode: string;
  referralUsed: boolean;
  achClaimed: string[];
  caught: number;
  noAds: boolean;
}

export class GameError extends Error {}

export function newState(now: number): GameState {
  return {
    pearls: 0, coins: 0, coinsAt: now, tiles: {}, spawn: [0, 0], boostUntil: 0,
    cd: { ad: 0, survey: 0, fish: 0, memo: 0, event: 0 }, pendingGame: null,
    streak: { count: 0, lastDay: -1 }, quests: { day: -1, items: [] },
    flags: ['lagon'], flag: 'lagon', username: 'Navigateur', referralCode: '', referralUsed: false,
    achClaimed: [], caught: 0, noAds: false,
  };
}

/** Fills fields added after a save was written. */
export function upgradeSave(s: GameState): GameState {
  const base = newState(s.coinsAt);
  return { ...base, ...s, cd: { ...base.cd, ...s.cd } };
}

// ---------- derived values ----------
export const dayOf = (t: number) => Math.floor(t / DAY);
export const tileCount = (s: GameState) => Object.keys(s.tiles).length;
export const tierMult = (n: number) => TIERS.find(([max]) => Math.max(1, n) <= max)![1];
export const featuredBiome = (t: number): Biome => BIOME_KEYS[Math.floor(t / WEEK) % BIOME_KEYS.length];
const cyclePos = (t: number) => ((t % SRB_CYCLE) + SRB_CYCLE) % SRB_CYCLE;
export const inSuper = (t: number) => cyclePos(t) < SRB_LEN;
export const superEndsIn = (t: number) => SRB_LEN - cyclePos(t);
export const superStartsIn = (t: number) => SRB_CYCLE - cyclePos(t);

const eventPos = (t: number) => (((t + EVENT_OFFSET) % EVENT_CYCLE) + EVENT_CYCLE) % EVENT_CYCLE;
/** The event running at time t, or null. */
export function eventAt(t: number) {
  if (eventPos(t) >= EVENT_LEN) return null;
  return EVENTS[Math.floor((t + EVENT_OFFSET) / EVENT_CYCLE) % EVENTS.length];
}
export const eventEndsIn = (t: number) => EVENT_LEN - eventPos(t);
export const nextEventIn = (t: number) => EVENT_CYCLE - eventPos(t);
export const nextEvent = (t: number) => EVENTS[(Math.floor((t + EVENT_OFFSET) / EVENT_CYCLE) + 1) % EVENTS.length];

export function achievementDone(s: GameState, id: string) {
  const tiles = Object.values(s.tiles);
  const [kind, arg] = id.split('_');
  const k = Number(arg);
  switch (kind) {
    case 'biome': return tiles.some(t => t.biome === arg);
    case 'size': return tiles.length >= k;
    case 'rar': return tiles.some(t => t.rar === k);
    case 'streak': return s.streak.count >= k;
    case 'phare': return tiles.reduce((a, t) => a + t.level, 0) >= k;
    case 'deco': return tiles.filter(t => t.deco).length >= k;
    case 'catch': return s.caught >= k;
  }
  return false;
}

export function badges(s: GameState) {
  const tiles = Object.values(s.tiles);
  const biomes = new Set(tiles.map(t => t.biome));
  const rars = new Set(tiles.map(t => t.rar));
  const n = tiles.length;
  const list: { name: string; desc: string; ok: boolean }[] = BIOME_KEYS.map(b => ({
    name: `Explorateur · ${BIOMES[b]}`, desc: `Posséder un îlot ${BIOMES[b].toLowerCase()}`, ok: biomes.has(b),
  }));
  for (const k of [5, 15, 30, 60, 100, 150, 250, 500]) list.push({ name: `Archipel de ${k}`, desc: `Posséder ${k} îlots`, ok: n >= k });
  (['Rare', 'Épique', 'Légendaire'] as const).forEach((r, i) =>
    list.push({ name: `Chasseur · ${r}`, desc: `Posséder un îlot ${r.toLowerCase()}`, ok: rars.has((i + 1) as Rarity) }));
  return list;
}
export const badgeCount = (s: GameState) => badges(s).filter(b => b.ok).length;
export const passportBonus = (s: GameState) => PASSPORT.find(([min]) => badgeCount(s) >= min)?.[1] ?? 0;

export function tileRent(t: Tile, at: number) {
  return RARITIES[t.rar].rent * (1 + UPGRADE_BONUS * t.level) * (t.biome === featuredBiome(at) ? 1 + EVENT_BONUS : 1);
}
// Rent per second without boost.
export function baseRate(s: GameState, at: number) {
  let r = 0;
  for (const t of Object.values(s.tiles)) r += tileRent(t, at);
  return r * (1 + passportBonus(s));
}
export const boostMult = (s: GameState, at: number) => (inSuper(at) ? SUPER_MULT : tierMult(tileCount(s)));
export const currentRate = (s: GameState, at: number) => baseRate(s, at) * (at < s.boostUntil ? boostMult(s, at) : 1);

function superOverlap(a: number, b: number) {
  let total = 0;
  for (let k = Math.floor(a / SRB_CYCLE); k * SRB_CYCLE <= b; k++) {
    const lo = Math.max(a, k * SRB_CYCLE), hi = Math.min(b, k * SRB_CYCLE + SRB_LEN);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

// ---------- actions (return a new state; throw GameError when not allowed) ----------
const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

export function settle(s0: GameState, now: number): GameState {
  const s = clone(s0);
  const a = s.coinsAt, b = now;
  if (b <= a) return s;
  const base = baseRate(s, a);
  const boostEnd = Math.min(b, s.boostUntil);
  const boosted = Math.max(0, boostEnd - a);
  const sup = boosted > 0 ? superOverlap(a, boostEnd) : 0;
  const tier = tierMult(tileCount(s));
  // seconds weighted by multiplier: 1x everywhere, tier on boosted time, 50x on boosted super-boost time
  const weighted = (b - a) + boosted * (tier - 1) + sup * (SUPER_MULT - tier);
  s.coins += base * weighted / 1000;
  s.coinsAt = b;
  return s;
}

function bumpQuest(s: GameState, id: QuestId, by = 1) {
  const q = s.quests.items.find(x => x.id === id);
  if (q) q.progress = Math.min(QUESTS[id].target, q.progress + by);
}

export function questsFor(day: number, seed: number): QuestId[] {
  const ids = [...QUEST_IDS];
  const out: QuestId[] = [];
  for (let i = 0; i < 3; i++) out.push(ids.splice(Math.floor(hash(day, i, SEED + 5 + seed) * ids.length), 1)[0]);
  return out;
}

export function ensureDay(s0: GameState, now: number, seed = 0): GameState {
  const s = clone(s0);
  const day = dayOf(now);
  if (s.quests.day !== day) s.quests = { day, items: questsFor(day, seed).map(id => ({ id, progress: 0, claimed: false })) };
  return s;
}

export function dailyLogin(s0: GameState, now: number, seed = 0): { s: GameState; reward: number } {
  const s = ensureDay(s0, now, seed);
  const day = dayOf(now);
  if (s.streak.lastDay === day) return { s, reward: 0 };
  s.streak.count = s.streak.lastDay === day - 1 ? s.streak.count + 1 : 1;
  s.streak.lastDay = day;
  const reward = STREAK_REWARDS[(s.streak.count - 1) % STREAK_REWARDS.length];
  s.pearls += reward;
  return { s, reward };
}

export function isClaimable(s: GameState, q: number, r: number, takenByOthers?: (k: string) => boolean) {
  const k = key(q, r);
  if (s.tiles[k] || takenByOthers?.(k)) return false;
  if (tileCount(s) === 0) return q === s.spawn[0] && r === s.spawn[1];
  return neighborsOf(q, r).some(([a, b]) => s.tiles[key(a, b)]);
}

export function rollRarity(x: number, goldenTide = false): Rarity {
  return goldenTide
    ? (x < 0.1 ? 3 : x < 0.3 ? 2 : x < 0.6 ? 1 : 0)
    : (x < 0.05 ? 3 : x < 0.2 ? 2 : x < 0.5 ? 1 : 0);
}

export function claim(s0: GameState, q: number, r: number, now: number, rand: number): { s: GameState; tile: Tile } {
  if (!isClaimable(s0, q, r)) throw new GameError('Cet îlot ne touche pas votre territoire.');
  const s = ensureDay(settle(s0, now), now);
  const price = tileCount(s) === 0 ? 0 : ISLAND_PRICE;
  if (s.pearls < price) throw new GameError(`Il vous faut ${price} perles.`);
  s.pearls -= price;
  const tile: Tile = { rar: rollRarity(rand, eventAt(now)?.id === 'maree'), level: 0, biome: biomeAt(q, r) };
  s.tiles[key(q, r)] = tile;
  bumpQuest(s, 'claim');
  return { s, tile };
}

export const boostPerAd = (t: number) => (eventAt(t)?.id === 'baleines' ? 2 * HOUR : HOUR);

export function adReward(s0: GameState, kind: AdKind, now: number): GameState {
  const s = ensureDay(settle(s0, now), now);
  if (kind === 'pearl') {
    if (now < s.cd.ad) throw new GameError('La prochaine pub n’est pas encore disponible.');
    s.pearls += 1;
    s.cd.ad = now + COOLDOWN.ad;
  } else if (kind === 'boost') {
    if (tileCount(s) === 0) throw new GameError('Acquérez d’abord un îlot.');
    if (s.boostUntil - now > MAX_BOOST - HOUR) throw new GameError('Votre réserve de boost est pleine.');
    s.boostUntil = Math.min(now + MAX_BOOST, Math.max(now, s.boostUntil) + boostPerAd(now));
    bumpQuest(s, 'boost');
  }
  bumpQuest(s, 'ad');
  return s;
}

export function startGame(s0: GameState, game: Game, now: number): GameState {
  const s = ensureDay(s0, now);
  if (now < s.cd[game]) throw new GameError('Ce mini-jeu n’est pas encore disponible.');
  s.cd[game] = now + COOLDOWN[game];
  s.pendingGame = { game, at: now };
  return s;
}

export function gameReward(game: Game, score: number) {
  return game === 'fish' ? Math.min(3, Math.floor(Math.max(0, score) / 5)) : score >= 6 ? 3 : Math.floor(Math.max(0, Math.min(6, score)) / 2);
}

export function finishGame(s0: GameState, game: Game, score: number, now: number): { s: GameState; reward: number } {
  const s = ensureDay(s0, now);
  if (!s.pendingGame || s.pendingGame.game !== game) throw new GameError('Aucune partie en cours.');
  s.pendingGame = null;
  const reward = gameReward(game, score);
  s.pearls += reward;
  bumpQuest(s, 'game');
  return { s, reward };
}

export function submitSurvey(s0: GameState, now: number): GameState {
  const s = ensureDay(s0, now);
  if (now < s.cd.survey) throw new GameError('Le prochain sondage n’est pas encore disponible.');
  s.pearls += 3;
  s.cd.survey = now + COOLDOWN.survey;
  bumpQuest(s, 'survey');
  return s;
}

export function claimQuest(s0: GameState, id: QuestId, now: number): GameState {
  const s = ensureDay(s0, now);
  const q = s.quests.items.find(x => x.id === id);
  if (!q || q.claimed || q.progress < QUESTS[id].target) throw new GameError('Quête non terminée.');
  q.claimed = true;
  s.pearls += QUESTS[id].reward;
  return s;
}

export function buyPearls(s0: GameState, n: number, now: number): GameState {
  const s = settle(s0, now);
  const cost = n * PEARL_PRICE;
  if (n < 1 || s.coins < cost) throw new GameError('Pas assez de doublons.');
  s.coins -= cost;
  s.pearls += n;
  return s;
}

export function upgradeTile(s0: GameState, q: number, r: number, now: number): GameState {
  const s = settle(s0, now);
  const t = s.tiles[key(q, r)];
  if (!t) throw new GameError('Cet îlot ne vous appartient pas.');
  if (t.level >= MAX_LEVEL) throw new GameError('Niveau maximum atteint.');
  const cost = UPGRADE_PRICE(t.level);
  if (s.coins < cost) throw new GameError('Pas assez de doublons.');
  s.coins -= cost;
  t.level += 1;
  return s;
}

export function buyFlag(s0: GameState, id: FlagId, now: number): GameState {
  const s = settle(s0, now);
  const f = FLAGS.find(x => x.id === id);
  if (!f) throw new GameError('Drapeau inconnu.');
  if (!s.flags.includes(id)) {
    if (s.coins < f.price) throw new GameError('Pas assez de doublons.');
    s.coins -= f.price;
    s.flags.push(id);
  }
  s.flag = id;
  return s;
}

export function catchCreature(s0: GameState, now: number): { s: GameState; reward: number } {
  const ev = eventAt(now);
  if (!ev) throw new GameError('Aucun événement en cours.');
  const s = settle(s0, now);
  if (tileCount(s) === 0) throw new GameError('Acquérez d’abord un îlot.');
  if (now < s.cd.event) throw new GameError('La créature reviendra bientôt.');
  const reward = ev.id === 'tortues' ? 3 : 2;
  s.pearls += reward;
  s.caught += 1;
  s.cd.event = now + COOLDOWN.event;
  return { s, reward };
}

export function decorate(s0: GameState, q: number, r: number, id: DecoId, now: number): GameState {
  const s = settle(s0, now);
  const t = s.tiles[key(q, r)];
  if (!t) throw new GameError('Cet îlot ne vous appartient pas.');
  const d = DECOS.find(x => x.id === id);
  if (!d) throw new GameError('Décoration inconnue.');
  if (t.deco === id) throw new GameError('Cet îlot a déjà cette décoration.');
  if (id === 'tortue' && s.caught < 1) throw new GameError('Attrapez une créature d’événement pour débloquer la tortue.');
  if (s.coins < d.price) throw new GameError('Pas assez de doublons.');
  s.coins -= d.price;
  t.deco = id;
  return s;
}

export function claimAchievement(s0: GameState, id: string): GameState {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) throw new GameError('Succès inconnu.');
  if (s0.achClaimed.includes(id)) throw new GameError('Récompense déjà reçue.');
  if (!achievementDone(s0, id)) throw new GameError('Succès pas encore débloqué.');
  const s = clone(s0);
  s.achClaimed.push(id);
  s.pearls += a.reward;
  return s;
}

/** Applies a purchase that the store (or test mode) has confirmed. */
export function grantPurchase(s0: GameState, id: ProductId): GameState {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) throw new GameError('Produit inconnu.');
  const s = clone(s0);
  s.pearls += p.pearls;
  if (id === 'sans_pubs') s.noAds = true;
  return s;
}

import type { AdKind, FlagId, Game, GameState, QuestId, Tile } from '../game/rules';

export interface WorldTile { q: number; r: number; owner: string; flag: FlagId }
export interface LeaderRow { username: string; tiles: number; coins: number; flag: FlagId; me: boolean }
export interface Account { online: boolean; email: string | null; anonymous: boolean; userId?: string }

export interface Backend {
  mode: 'local' | 'online';
  /** Game clock in ms. Online: server-corrected time. Local: may run faster in demo mode. */
  now(): number;
  init(): Promise<GameState>;
  dailyLogin(): Promise<{ s: GameState; reward: number }>;
  claim(q: number, r: number): Promise<{ s: GameState; tile: Tile }>;
  adReward(kind: AdKind): Promise<GameState>;
  startGame(game: Game): Promise<GameState>;
  finishGame(game: Game, score: number): Promise<{ s: GameState; reward: number }>;
  survey(answers: [string, string][]): Promise<GameState>;
  claimQuest(id: QuestId): Promise<GameState>;
  buyPearls(n: number): Promise<GameState>;
  upgrade(q: number, r: number): Promise<GameState>;
  buyFlag(id: FlagId): Promise<GameState>;
  setUsername(name: string): Promise<GameState>;
  applyReferral(code: string): Promise<{ s: GameState; reward: number }>;
  othersNear(q: number, r: number, radius: number): Promise<WorldTile[]>;
  leaderboard(): Promise<LeaderRow[]>;
  account(): Account;
  linkEmail(email: string): Promise<void>;
  /** Erases the player's game (and online account), then starts a fresh one. */
  resetAll(): Promise<GameState>;
  demo?: { enabled(): boolean; toggle(): Promise<GameState>; gift(): Promise<GameState> };
}

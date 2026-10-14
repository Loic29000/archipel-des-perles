// Endless hex world. Biomes come from deterministic noise so every client and the
// server (supabase/migrations: biome_at) agree on them. Rarity is NOT derived here:
// it is drawn at random when an island is bought, so nobody can see it in advance.

export const SEED = 7319;

export type Biome = 'plage' | 'prairie' | 'foret' | 'marais' | 'montagne' | 'volcan';
export const BIOMES: Record<Biome, string> = {
  plage: 'Plage',
  prairie: 'Prairie',
  foret: 'Forêt',
  marais: 'Marais',
  montagne: 'Montagne',
  volcan: 'Volcan',
};
export const BIOME_KEYS = Object.keys(BIOMES) as Biome[];

// 32-bit integer hash; Math.imul keeps it exact so the SQL port matches bit for bit.
export function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, s: number): number {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 2) * 0.15;
}

const biomeCache = new Map<string, Biome>();
export function biomeAt(q: number, r: number): Biome {
  const k = key(q, r);
  const hit = biomeCache.get(k);
  if (hit) return hit;
  const x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
  const e = fbm(x * 0.09 + 10, y * 0.09 + 10, SEED);
  const m = fbm(x * 0.12 + 50, y * 0.12 + 50, SEED + 9);
  const b: Biome =
    e < 0.36 ? 'plage'
    : e > 0.62 ? (hash(q, r, SEED + 3) < 0.35 ? 'volcan' : 'montagne')
    : e > 0.54 ? 'montagne'
    : m > 0.58 ? 'marais'
    : m > 0.47 ? 'foret'
    : 'prairie';
  biomeCache.set(k, b);
  return b;
}

export const key = (q: number, r: number) => `${q},${r}`;
export const parseKey = (k: string): [number, number] => k.split(',').map(Number) as [number, number];
export const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const neighborsOf = (q: number, r: number): [number, number][] => DIRS.map(([dq, dr]) => [q + dq, r + dr]);
export const hexDistance = (q1: number, r1: number, q2: number, r2: number) =>
  (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;

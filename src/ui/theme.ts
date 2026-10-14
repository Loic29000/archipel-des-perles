import { Platform, useColorScheme } from 'react-native';
import type { Biome } from '../game/world';
import type { FlagId } from '../game/rules';

const light = {
  sea: '#cfe3e6', seaLine: '#b5d1d6', paper: '#f7f4ec', ink: '#16313a', muted: '#5b7279',
  accent: '#e0a21b', accentInk: '#2a1d00', own: '#0f6b74', line: '#c9d6d4', panel: '#fffdf8',
  good: '#1f7a4d', bad: '#a83a2c', other: '#7d6b8f',
  biome: { plage: '#ead9a6', prairie: '#a9cf86', foret: '#5f9a5c', marais: '#8aa78f', montagne: '#a3998d', volcan: '#b9604a' } as Record<Biome, string>,
};
const dark: typeof light = {
  sea: '#0d2229', seaLine: '#163640', paper: '#0f1d22', ink: '#e6efe9', muted: '#8fa7a6',
  accent: '#f2b736', accentInk: '#241800', own: '#4fd1c5', line: '#24414a', panel: '#13252b',
  good: '#5fd39a', bad: '#ff8a78', other: '#b9a6d6',
  biome: { plage: '#b9a46c', prairie: '#6f9a52', foret: '#3e6d43', marais: '#5a7563', montagne: '#7b7268', volcan: '#a24a36' },
};
export type Palette = typeof light;

export const FLAG_COLORS: Record<FlagId, string> = { lagon: '#0f8b96', corail: '#e2694f', safran: '#e0a21b', algue: '#4c8b3c', nuit: '#3b3f8f' };
export const RARITY_COLORS = (c: Palette) => [c.muted, c.good, c.own, c.accent];

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  display: Platform.select({ web: '"Unbounded", "Arial Black", system-ui, sans-serif', default: undefined }),
  body: Platform.select({ web: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif', default: undefined }),
  num: Platform.select({ web: '"JetBrains Mono", ui-monospace, Menlo, monospace', ios: 'Menlo', default: 'monospace' }),
};

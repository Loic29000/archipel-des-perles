import { Platform, TextStyle, useColorScheme } from 'react-native';
import type { Biome } from '../game/world';
import type { FlagId } from '../game/rules';

const light = {
  sea: '#7fcfd9', seaDeep: '#3d98b0', seaLine: '#b8ecf0', foam: '#ffffff',
  paper: '#f4efe2', ink: '#12313b', muted: '#5d747a',
  accent: '#f2b225', accentDeep: '#d98e0b', accentInk: '#2a1d00',
  own: '#0f7c86', line: '#dcd5c3', panel: '#fffcf4', card: '#f5efe0',
  good: '#1f8a55', bad: '#c2412d', other: '#7d6b8f', epic: '#7c4ddb',
  pearl: '#f6f0ff', pearlShade: '#c9b8e8', coin: '#f2b225', coinShade: '#c27c0e',
  sand: '#f3e2ae', shadow: 'rgba(8,40,52,0.28)',
  biome: { plage: '#ecd59a', prairie: '#9fd477', foret: '#4f9a55', marais: '#7fae92', montagne: '#b1a698', volcan: '#7a4a3c' } as Record<Biome, string>,
  deco: { plage: '#2f8f4e', prairie: '#ffffff', foret: '#2c6b3a', marais: '#4c7d62', montagne: '#8a7f72', volcan: '#3b2622' } as Record<Biome, string>,
};
const dark: typeof light = {
  sea: '#0f4253', seaDeep: '#071d27', seaLine: '#2c6c7c', foam: '#bfe9ef',
  paper: '#0b1a20', ink: '#e8f1ec', muted: '#8fa8a7',
  accent: '#f5bd3b', accentDeep: '#d4920e', accentInk: '#241800',
  own: '#4fd1c5', line: '#22404a', panel: '#10232a', card: '#173039',
  good: '#5fd39a', bad: '#ff8a78', other: '#b9a6d6', epic: '#a98bff',
  pearl: '#f3edff', pearlShade: '#a993d6', coin: '#f5bd3b', coinShade: '#b9770c',
  sand: '#cdb67c', shadow: 'rgba(0,0,0,0.45)',
  biome: { plage: '#d2b874', prairie: '#78b057', foret: '#3a7a44', marais: '#5e8d74', montagne: '#8f8679', volcan: '#5e3a30' },
  deco: { plage: '#2b7d45', prairie: '#f4f1d0', foret: '#1f5530', marais: '#3b6a51', montagne: '#6f665c', volcan: '#2a1a17' },
};
export type Palette = typeof light;

export const FLAG_COLORS: Record<FlagId, string> = { lagon: '#0f8b96', corail: '#e2694f', safran: '#e0a21b', algue: '#4c8b3c', nuit: '#3b3f8f' };
export const RARITY_COLORS = (c: Palette) => [c.muted, c.good, c.epic, c.accent];

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

// Web loads the families from Google Fonts and picks the weight with fontWeight.
// Native registers one family per weight (see services/fonts), so the weight is part of the name.
type Weight = TextStyle['fontWeight'];
const heavy = (w: Weight) => w === 'bold' || Number(w) >= 700;
export function fontFor(kind: 'display' | 'body' | 'num', weight: Weight): TextStyle {
  if (Platform.OS === 'web') {
    const family = kind === 'display' ? '"Unbounded", "Arial Black", system-ui, sans-serif'
      : kind === 'num' ? '"JetBrains Mono", ui-monospace, Menlo, monospace'
      : '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';
    return { fontFamily: family };
  }
  if (kind === 'num') return { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' };
  if (kind === 'display') return { fontFamily: heavy(weight) || weight === undefined ? 'Unbounded_700Bold' : 'Unbounded_500Medium', fontWeight: 'normal' };
  const family = heavy(weight) ? 'Figtree_700Bold' : weight === '600' || weight === '500' ? 'Figtree_600SemiBold' : 'Figtree_400Regular';
  return { fontFamily: family, fontWeight: 'normal' };
}

export const fonts = {
  body: fontFor('body', '400').fontFamily,
  num: fontFor('num', '400').fontFamily,
};

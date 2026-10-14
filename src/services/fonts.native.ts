import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { Unbounded_500Medium, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';

/** True once the bundled fonts are ready (or failed: the app then falls back to system fonts). */
export function useGameFonts() {
  const [loaded, error] = useFonts({ Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, Unbounded_500Medium, Unbounded_700Bold });
  return loaded || !!error;
}

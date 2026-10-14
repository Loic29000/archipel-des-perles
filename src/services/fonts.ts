// The fonts ship inside the app on every platform (no request to a font CDN).
// Each weight is imported on its own so only these five files end up in the build.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Unbounded_500Medium } from '@expo-google-fonts/unbounded/500Medium';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { useFonts } from 'expo-font';

/** True once the bundled fonts are ready (or failed: the app then falls back to system fonts). */
export function useGameFonts() {
  const [loaded, error] = useFonts({ Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, Unbounded_500Medium, Unbounded_700Bold });
  return loaded || !!error;
}

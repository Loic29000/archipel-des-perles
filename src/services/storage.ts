import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage can be unavailable (private browsing, blocked site data): never let it crash the game.
export async function loadJSON<T>(k: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJSON(k: string, v: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(v));
  } catch {
    // ignore
  }
}

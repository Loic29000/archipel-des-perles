import { createLocalBackend } from './local';
import { createOnlineBackend } from './online';
import type { Backend } from './types';

// Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example) to play online.
// Without them the game runs fully on the device, which is what the web prototype uses.
export function createBackend(): Backend {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createOnlineBackend(url, key) : createLocalBackend();
}
export type { Backend } from './types';

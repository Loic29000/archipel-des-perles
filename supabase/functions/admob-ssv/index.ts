// AdMob rewarded-ad server-side verification (SSV) callback.
// AdMob calls this URL after a player finishes a rewarded ad. We check Google's
// signature, then record the event; the ad_reward() SQL function only pays out
// when a matching event exists (once app_config.require_ssv is true).
// Deploy: supabase functions deploy admob-ssv --no-verify-jwt
// Then paste https://<project>.supabase.co/functions/v1/admob-ssv in the AdMob ad unit's SSV settings.
import { createClient } from 'npm:@supabase/supabase-js@2';

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let keyCache: { at: number; keys: Map<string, CryptoKey> } | null = null;

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function verifierKeys(): Promise<Map<string, CryptoKey>> {
  if (keyCache && Date.now() - keyCache.at < 3600_000) return keyCache.keys;
  const res = await fetch(KEYS_URL);
  const json = (await res.json()) as { keys: { keyId: number; base64: string }[] };
  const keys = new Map<string, CryptoKey>();
  for (const k of json.keys) {
    keys.set(String(k.keyId), await crypto.subtle.importKey('spki', b64ToBytes(k.base64) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
  }
  keyCache = { at: Date.now(), keys };
  return keys;
}

// Google sends a DER-encoded signature; WebCrypto expects raw r||s (64 bytes).
function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error('bad DER');
    const len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = readInt(), s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

Deno.serve(async req => {
  const url = new URL(req.url);
  const query = url.search.slice(1);
  const cut = query.indexOf('&signature=');
  if (cut < 0) return new Response('missing signature', { status: 400 });
  const message = query.slice(0, cut);
  const params = url.searchParams;
  const signature = params.get('signature')!;
  const keyId = params.get('key_id') ?? '';

  // AdMob's console "verify URL" test sends no user: acknowledge it.
  const userId = params.get('user_id');
  const kind = params.get('custom_data');
  const tx = params.get('transaction_id');

  const key = (await verifierKeys()).get(keyId);
  if (!key) return new Response('unknown key', { status: 400 });
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64ToBytes(signature)) as BufferSource, new TextEncoder().encode(message));
  if (!ok) return new Response('bad signature', { status: 403 });
  if (!userId || !tx || !kind || !['pearl', 'boost', 'game'].includes(kind)) return new Response('ok');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('ad_events').insert({ user_id: userId, kind, transaction_id: tx });
  if (error && error.code !== '23505') return new Response(error.message, { status: 500 }); // 23505: replayed transaction
  return new Response('ok');
});

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Backend, createBackend } from './src/backend';
import type { LeaderRow, WorldTile } from './src/backend/types';
import * as R from './src/game/rules';
import { biomeAt, BIOMES, key, parseKey } from './src/game/world';
import { adsSimulated, showRewardedAd } from './src/services/ads';
import { buzz, play, setSoundOn } from './src/services/feedback';
import { useGameFonts } from './src/services/fonts';
import { enableNotifications, Reminder, scheduleReminders } from './src/services/notify';
import { loadJSON, saveJSON } from './src/services/storage';
import { PopItem, Pops } from './src/ui/fx';
import { HexMap } from './src/ui/HexMap';
import {
  BoltIcon, BookIcon, BottleIcon, ClipboardIcon, CoinIcon, FlameIcon, GiftIcon, IslandIcon, LighthouseIcon,
  MoreIcon, PearlIcon, ScrollIcon, ShellIcon, ShopIcon, TrophyIcon, TvIcon, UserIcon,
} from './src/ui/icons';
import { Island, IslandBase, tileHash } from './src/ui/island';
import { Badge, Btn, Card, Progress, styles as k, T } from './src/ui/kit';
import { AdOverlay, FishingLayer, MemoryPanel, MessageCard, RevealCard, SurveyPanel, TUTORIAL } from './src/ui/Overlays';
import { FLAG_COLORS, fonts, Palette, RARITY_COLORS, usePalette } from './src/ui/theme';

type Tab = 'tile' | 'earn' | 'boost' | 'quests' | 'more';
type More = 'shop' | 'ranking' | 'log' | 'profile';
const MORE: [More, string, (p: { size?: number; color?: string }) => React.ReactElement][] = [
  ['shop', 'Comptoir', ShopIcon], ['ranking', 'Classement', TrophyIcon], ['log', 'Carnets', BookIcon], ['profile', 'Profil', UserIcon],
];
type Overlay =
  | { type: 'ad'; label: string; then: () => void }
  | { type: 'survey' } | { type: 'memo' } | { type: 'fish' }
  | { type: 'reveal'; tile: R.Tile }
  | { type: 'msg'; title: string; body: string; action?: string; next?: Overlay | null; streak?: boolean }
  | { type: 'tutorial'; step: number; next?: Overlay | null };

const fmtInt = (n: number) => Math.floor(n).toLocaleString('fr-FR');
const fmtCoins = (n: number) => {
  const d = n < 1e-4 ? 10 : n < 1 ? 8 : 4;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const dur = (ms: number) => {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return d ? `${d} j ${h} h` : h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min ${String(x).padStart(2, '0')}`;
};
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}

function Game() {
  const c = usePalette();
  const fontsReady = useGameFonts();
  const backend = useMemo<Backend>(() => createBackend(), []);
  const [s, setS] = useState<R.GameState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('tile');
  const [more, setMore] = useState<More>('shop');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [others, setOthers] = useState<Map<string, WorldTile>>(new Map());
  const [focus, setFocus] = useState<{ at: [number, number]; nonce: number }>({ at: [0, 0], nonce: 0 });
  const [zoom, setZoom] = useState(34);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pops, setPops] = useState<PopItem[]>([]);
  const [hudH, setHudH] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const [settings, setSettings] = useState({ sound: true, notifications: false, tutorialDone: false });
  const [demo, setDemo] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popId = useRef(0);

  const say = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  /** Celebrate a gain with a floating badge and a coin sound. */
  const reward = useCallback((text: string, icon?: PopItem['icon']) => {
    play('coin');
    buzz('success');
    setPops(p => [...p.slice(-2), { id: ++popId.current, text, icon }]);
  }, []);

  // Runs a backend action; game rule refusals become a toast instead of a crash.
  const act = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      buzz('error');
      say(e instanceof Error ? e.message : 'Action impossible.');
      return null;
    }
  }, [say]);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    (async () => {
      const saved = (await loadJSON<typeof settings>('archipel:settings')) ?? settings;
      setSettings(saved);
      setSoundOn(saved.sound);
      try {
        let st = await backend.init();
        setDemo(!!backend.demo?.enabled());
        const login = await backend.dailyLogin();
        st = login.s;
        setS(st);
        const home: [number, number] = Object.keys(st.tiles)[0] ? parseKey(Object.keys(st.tiles)[0]) : st.spawn;
        setFocus({ at: home, nonce: 1 });
        if (R.tileCount(st) === 0) setSelected(st.spawn);
        const daily: Overlay | null = login.reward > 0
          ? { type: 'msg', streak: true, title: `Série de ${plural(login.s.streak.count, 'jour')} !`, body: `Récompense de connexion : +${plural(login.reward, 'perle')}. Revenez demain pour continuer la série.`, action: 'Récupérer' }
          : null;
        setOverlay(saved.tutorialDone ? daily : { type: 'tutorial', step: 0, next: daily });
      } catch (e) {
        setFatal(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const updateSettings = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveJSON('archipel:settings', next);
  };

  // ---------------------------------------------------------------- neighbours (online only)
  const refreshOthers = useCallback(async (st: R.GameState | null) => {
    if (!st || backend.mode !== 'online') return;
    const first = Object.keys(st.tiles)[0];
    const [q, r] = first ? parseKey(first) : st.spawn;
    const rows = await backend.othersNear(q, r, 30);
    setOthers(new Map(rows.map(t => [key(t.q, t.r), t])));
  }, [backend]);
  useEffect(() => {
    if (!s) return;
    refreshOthers(s);
    const id = setInterval(() => refreshOthers(s), 30_000);
    return () => clearInterval(id);
  }, [s ? R.tileCount(s) : -1]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- reminders
  useEffect(() => {
    if (!s || !settings.notifications || demo) return;
    const toDevice = (t: number) => Date.now() + (t - backend.now());
    const list: Reminder[] = [];
    const n = backend.now();
    if (s.boostUntil > n) list.push({ id: 'boost', at: toDevice(s.boostUntil), title: 'Boost terminé', body: 'Regardez une pub pour relancer votre boost.' });
    if (s.cd.ad > n) list.push({ id: 'ad', at: toDevice(s.cd.ad), title: 'Une perle vous attend', body: 'Une nouvelle publicité est disponible : +1 perle.' });
    for (const g of ['fish', 'memo'] as const) if (s.cd[g] > n) list.push({ id: g, at: toDevice(s.cd[g]), title: 'Mini-jeu disponible', body: g === 'fish' ? 'La pêche aux bouteilles est de retour.' : 'La mémoire des coquillages est de retour.' });
    list.push({ id: 'daily', at: toDevice((R.dayOf(n) + 1) * R.DAY + 8 * R.HOUR), title: 'Récompense du jour', body: 'Connectez-vous pour garder votre série et vos quêtes.' });
    scheduleReminders(list);
  }, [s, settings.notifications, demo, backend]);

  if (fatal) {
    return (
      <SafeAreaView style={[st.root, { backgroundColor: c.paper, padding: 20, gap: 12 }]}>
        <T c={c} display style={{ fontWeight: '700' }}>Archipel des Perles</T>
        <T c={c}>{fatal}</T>
        <Btn c={c} label="Réessayer" onPress={() => setFatal(null)} />
      </SafeAreaView>
    );
  }
  if (!s || !fontsReady) return <View style={[st.root, { backgroundColor: c.seaDeep }]} />;

  // ---------------------------------------------------------------- derived values for this frame
  const now = backend.now();
  const live = R.settle(s, now);
  const count = R.tileCount(s);
  const rate = R.currentRate(s, now);
  const boosting = now < s.boostUntil;
  const sup = R.inSuper(now);
  const featured = R.featuredBiome(now);
  const selKey = selected ? key(selected[0], selected[1]) : null;
  const busy = !!overlay;
  const ready = (t: number) => now >= t;
  const cdLabel = (t: number, label: string) => (ready(t) ? label : dur(t - now));

  // ---------------------------------------------------------------- actions
  function watchAd(kind: R.AdKind, label: string, after: () => void) {
    const grant = async () => {
      if (kind === 'game') { backend.adReward('game').then(setS).catch(() => {}); after(); return; }
      // with server-side verification the reward can land a moment after the ad closes
      for (let i = 0; i < 4; i++) {
        try {
          setS(await backend.adReward(kind));
          after();
          return;
        } catch (e) {
          const m = e instanceof Error ? e.message : '';
          if (!m.includes('non validée') || i === 3) { say(m || 'Publicité non comptée.'); return; }
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    };
    if (adsSimulated) {
      setOverlay({ type: 'ad', label, then: () => { setOverlay(null); grant(); } });
    } else {
      showRewardedAd(kind, backend.account().userId).then(ok => (ok ? grant() : say('Publicité interrompue, aucune récompense.')));
    }
  }

  async function claimSelected() {
    if (!selected) return;
    const res = await act(() => backend.claim(selected[0], selected[1]));
    if (!res) return;
    setS(res.s);
    play(res.tile.rar >= 2 ? 'legend' : 'reveal');
    buzz('success');
    setOverlay({ type: 'reveal', tile: res.tile });
    refreshOthers(res.s);
  }

  function startGame(game: R.Game) {
    watchAd('game', 'Publicité · le jeu démarre ensuite', async () => {
      const st2 = await act(() => backend.startGame(game));
      if (!st2) return;
      setS(st2);
      setOverlay({ type: game });
    });
  }
  async function endGame(game: R.Game, score: number) {
    setOverlay(null);
    const res = await act(() => backend.finishGame(game, score));
    if (!res) return;
    setS(res.s);
    if (res.reward) reward(`+${res.reward}`, 'pearl');
    else say(game === 'fish' ? `${plural(score, 'bouteille')} : il en faut 5 pour une perle.` : 'Aucune perle cette fois.');
  }

  const simple = async (fn: () => Promise<R.GameState>, gain?: [string, PopItem['icon']?]) => {
    const st2 = await act(fn);
    if (st2) { setS(st2); if (gain) reward(gain[0], gain[1]); }
  };

  // ---------------------------------------------------------------- tab contents
  function TileTab() {
    if (!selected) {
      return (
        <Card c={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[st.disc, { backgroundColor: c.own }]}><IslandIcon size={22} color="#ffffff" /></View>
          <T c={c} muted style={{ flex: 1, lineHeight: 19 }}>Touchez un îlot dans la brume « ? » pour l’explorer. Il doit toucher votre archipel.</T>
        </Card>
      );
    }
    const own = s!.tiles[selKey!];
    const other = others.get(selKey!);
    const biomeKey = own?.biome ?? biomeAt(selected[0], selected[1]);
    const biome = BIOMES[biomeKey];
    const preview = (kind: 'own' | 'other' | 'free') => (
      <Svg width={64} height={64}>
        <IslandBase x={32} y={32} s={26} c={c} kind={kind === 'free' ? 'own' : kind} />
        <Island x={32} y={32} s={26} c={c} biome={biomeKey} kind={kind === 'free' ? 'own' : kind} seed={tileHash(selected[0], selected[1])}
          rar={own?.rar} level={own?.level} flag={own ? FLAG_COLORS[s!.flag] : undefined} />
      </Svg>
    );
    if (own) {
      const perDay = R.tileRent(own, now) * (1 + R.passportBonus(s!)) * 86400;
      const col = RARITY_COLORS(c)[own.rar];
      return (
        <Card c={c} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {preview('own')}
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T c={c} style={{ fontWeight: '700', fontSize: 17 }}>{biome}</T>
                <View style={[st.tag, { backgroundColor: col }]}><T c={c} style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{R.RARITIES[own.rar].name.toUpperCase()}</T></View>
                {own.biome === featured && <View style={[st.tag, { backgroundColor: c.accent }]}><T c={c} style={{ color: c.accentInk, fontSize: 11, fontWeight: '700' }}>+25 % CETTE SEMAINE</T></View>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <CoinIcon size={14} />
                <T c={c} num style={{ fontSize: 12 }}>{fmtCoins(perDay)}</T>
                <T c={c} muted style={{ fontSize: 12 }}>par jour</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                {Array.from({ length: R.MAX_LEVEL }, (_, i) => (
                  <View key={i} style={{ opacity: i < own.level ? 1 : 0.25 }}><LighthouseIcon size={16} color={c.bad} /></View>
                ))}
                <T c={c} muted style={{ fontSize: 12 }}>phares {own.level}/{R.MAX_LEVEL}</T>
              </View>
            </View>
          </View>
          {own.level < R.MAX_LEVEL
            ? <Btn c={c} kind="teal" icon={<LighthouseIcon size={18} color="#ffffff" />} label={`Construire un phare (+10 %) · ${fmtCoins(R.UPGRADE_PRICE(own.level))}`} disabled={live.coins < R.UPGRADE_PRICE(own.level)}
                onPress={() => simple(() => backend.upgrade(selected[0], selected[1]), ['Phare construit !'])} />
            : <T c={c} muted style={{ fontSize: 13 }}>Cet îlot est au niveau maximum.</T>}
        </Card>
      );
    }
    if (other) {
      return (
        <Card c={c} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {preview('other')}
          <T c={c} style={{ flex: 1 }}>{biome} · appartient à <T c={c} style={{ fontWeight: '700' }}>{other.owner}</T>.</T>
        </Card>
      );
    }
    const claimable = R.isClaimable(s!, selected[0], selected[1], kk => others.has(kk));
    const price = count === 0 ? 0 : R.ISLAND_PRICE;
    const short = Math.max(0, price - s!.pearls);
    return (
      <Card c={c} style={{ gap: 10 }} highlight={claimable && !short ? c.accent : undefined}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Svg width={64} height={64}>
            <Island x={32} y={32} s={26} c={c} biome={biomeKey} kind="free" seed={0} />
          </Svg>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <T c={c} style={{ fontWeight: '700', fontSize: 17 }}>Îlot mystère · {biome}</T>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {R.RARITIES.map((r, i) => (
                <View key={r.name} style={[st.tag, { backgroundColor: RARITY_COLORS(c)[i] }]}>
                  <T c={c} style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{r.name} {Math.round(r.odds * 100)} %</T>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Btn c={c} icon={price ? <PearlIcon size={18} /> : <GiftIcon size={18} color={c.accentInk} />}
          label={!claimable ? 'Hors de portée' : !price ? 'Acquérir gratuitement' : short ? `Encore ${short} perles` : `Acquérir · ${price} perles`}
          disabled={!claimable || short > 0 || busy} onPress={claimSelected} />
        {claimable && short > 0 && (
          <Pressable onPress={() => setTab('earn')}><T c={c} style={{ color: c.own, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Gagner des perles →</T></Pressable>
        )}
      </Card>
    );
  }

  function EarnRow({ icon, color, title, sub, label, disabled, onPress, isReady }: {
    icon: React.ReactNode; color: string; title: string; sub: string; label: string; disabled?: boolean; onPress: () => void; isReady?: boolean;
  }) {
    return (
      <Card c={c} highlight={isReady ? c.accent : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        <View style={[st.disc, { backgroundColor: color }]}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T c={c} style={{ fontWeight: '700' }}>{title}</T>
          <T c={c} muted style={{ fontSize: 12 }}>{sub}</T>
        </View>
        <Btn c={c} small kind={isReady ? 'primary' : 'secondary'} label={label} disabled={disabled || busy} onPress={onPress} />
      </Card>
    );
  }

  function EarnTab() {
    return (
      <View style={{ gap: 8 }}>
        <EarnRow icon={<TvIcon size={20} color="#fff" />} color="#e2694f" title="Publicité" sub="+1 perle · toutes les 20 min"
          label={cdLabel(s!.cd.ad, 'Regarder')} disabled={!ready(s!.cd.ad)} isReady={ready(s!.cd.ad)}
          onPress={() => watchAd('pearl', 'Publicité · +1 perle', () => reward('+1', 'pearl'))} />
        <EarnRow icon={<ClipboardIcon size={20} color="#fff" />} color={c.own} title="Sondage" sub="3 questions · +3 perles · toutes les 2 h"
          label={cdLabel(s!.cd.survey, 'Répondre')} disabled={!ready(s!.cd.survey)} isReady={ready(s!.cd.survey)}
          onPress={() => setOverlay({ type: 'survey' })} />
        <EarnRow icon={<BottleIcon size={20} color="#fff" />} color="#3d98b0" title="Pêche aux bouteilles" sub="12 s · 1 perle par 5 bouteilles, 3 max"
          label={cdLabel(s!.cd.fish, 'Jouer')} disabled={!ready(s!.cd.fish)} isReady={ready(s!.cd.fish)} onPress={() => startGame('fish')} />
        <EarnRow icon={<ShellIcon size={20} color="#fff" />} color={c.epic} title="Mémoire des coquillages" sub="40 s · 1 perle par 2 paires, 3 si tout trouvé"
          label={cdLabel(s!.cd.memo, 'Jouer')} disabled={!ready(s!.cd.memo)} isReady={ready(s!.cd.memo)} onPress={() => startGame('memo')} />
        <T c={c} muted style={{ fontSize: 11, textAlign: 'center' }}>Une courte publicité précède chaque mini-jeu.</T>
        {demo && <EarnRow icon={<GiftIcon size={20} color="#fff" />} color={c.accentDeep} title="Démo" sub="Pour tester sans attendre" label="+100 perles"
          onPress={async () => { setS(await backend.demo!.gift()); reward('+100', 'pearl'); }} />}
      </View>
    );
  }

  function BoostTab() {
    const tier = R.tierMult(count);
    const left = Math.max(0, s!.boostUntil - now);
    const mult = sup ? R.SUPER_MULT : tier;
    let lo = 1;
    return (
      <View style={{ gap: 10 }}>
        <Card c={c} highlight={boosting ? c.accent : undefined} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[st.bigDisc, { backgroundColor: boosting ? c.accent : c.line }]}>
              <T c={c} display style={{ fontSize: 20, fontWeight: '700', color: boosting ? c.accentInk : c.muted }}>×{mult}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T c={c} style={{ fontWeight: '700', fontSize: 16 }}>{boosting ? `Boost actif · ${dur(left)}` : 'Boost en pause'}</T>
              <T c={c} muted style={{ fontSize: 12, lineHeight: 17 }}>Chaque pub ajoute 1 h, jusqu’à 6 h en réserve. Avec {plural(count, 'îlot')}, la rente est multipliée par {tier}.</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: 6 }, (_, i) => {
              const f = Math.max(0, Math.min(1, left / R.HOUR - i));
              return (
                <View key={i} style={{ flex: 1, height: 12, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
                  <View style={{ width: `${f * 100}%`, height: '100%', backgroundColor: c.accent }} />
                </View>
              );
            })}
          </View>
          <Btn c={c} icon={<BoltIcon size={18} color={c.accentInk} />} label="Regarder une pub · +1 h de boost" disabled={busy || count === 0 || left > R.MAX_BOOST - R.HOUR}
            onPress={() => watchAd('boost', 'Publicité · +1 h de boost', () => reward(`+1 h ×${R.boostMult(s!, backend.now())}`, 'boost'))} />
        </Card>
        <Card c={c} highlight={sup ? c.bad : undefined} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={[st.disc, { backgroundColor: sup ? c.bad : c.epic }]}><BoltIcon size={20} color="#fff" /></View>
          <T c={c} style={{ flex: 1, fontSize: 13 }}>
            {sup ? <><T c={c} style={{ fontWeight: '700', fontSize: 13 }}>Super boost ×50 en cours</T> encore {dur(R.superEndsIn(now))}.</>
              : <>Prochain <T c={c} style={{ fontWeight: '700', fontSize: 13 }}>super boost ×50</T> dans {dur(R.superStartsIn(now))}.</>}
          </T>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {R.TIERS.map(([max, m]) => {
            const label = `${max === Infinity ? `${lo}+` : `${lo}–${max}`} · ×${m}`;
            lo = max + 1;
            const cur = m === tier;
            return (
              <View key={m} style={{ paddingVertical: 4, paddingHorizontal: 7, borderRadius: 8, backgroundColor: cur ? c.own : c.card }}>
                <T c={c} num style={{ fontSize: 11, color: cur ? '#fff' : c.muted }}>{label}</T>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  function QuestsTab() {
    const weekLeft = R.WEEK - (now % R.WEEK);
    const pos = ((s!.streak.count - 1) % 7 + 7) % 7;
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.biome[featured] }}>
          <Svg width={44} height={44}>
            <Island x={22} y={22} s={18} c={c} biome={featured} kind="own" seed={3} />
          </Svg>
          <View style={{ flex: 1 }}>
            <T c={c} style={{ fontWeight: '700', color: '#16313a' }}>Semaine {BIOMES[featured].toLowerCase()} · +25 % de rente</T>
            <T c={c} style={{ fontSize: 12, color: '#16313a' }}>Encore {dur(weekLeft)} pour en profiter.</T>
          </View>
        </View>
        <Card c={c} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FlameIcon size={18} color="#e2694f" />
            <T c={c} style={{ fontWeight: '700' }}>Série de {plural(s!.streak.count, 'jour')}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {R.STREAK_REWARDS.map((r, i) => {
              const done = i <= pos && s!.streak.count > 0;
              const today = i === pos && s!.streak.count > 0;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 10, gap: 1,
                  backgroundColor: done ? c.accent : c.panel, borderWidth: 2, borderColor: today ? c.accentDeep : 'transparent' }}>
                  <T c={c} style={{ fontSize: 10, fontWeight: '700', color: done ? c.accentInk : c.muted }}>J{i + 1}</T>
                  {i === 6 ? <GiftIcon size={16} color={done ? c.accentInk : c.muted} /> : <PearlIcon size={14} />}
                  <T c={c} num style={{ fontSize: 11, color: done ? c.accentInk : c.ink }}>+{r}</T>
                </View>
              );
            })}
          </View>
        </Card>
        {s!.quests.items.map(q => {
          const def = R.QUESTS[q.id];
          const complete = q.progress >= def.target;
          return (
            <Card key={q.id} c={c} highlight={complete && !q.claimed ? c.accent : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: q.claimed ? 0.6 : 1 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={k.row}>
                  <T c={c} style={{ fontWeight: '600', flex: 1 }}>{def.label}</T>
                  <T c={c} num style={{ fontSize: 12 }}>{Math.min(q.progress, def.target)}/{def.target}</T>
                </View>
                <Progress c={c} value={q.progress / def.target} color={complete ? c.good : c.own} />
              </View>
              <Btn c={c} small kind={complete && !q.claimed ? 'primary' : 'secondary'} icon={!q.claimed ? <PearlIcon size={14} /> : undefined}
                label={q.claimed ? 'Reçu ✓' : `+${def.reward}`} disabled={!complete || q.claimed}
                onPress={() => simple(() => backend.claimQuest(q.id), [`+${def.reward}`, 'pearl'])} />
            </Card>
          );
        })}
      </View>
    );
  }

  function ShopTab() {
    const maxPearls = Math.floor(live.coins / R.PEARL_PRICE);
    return (
      <View style={{ gap: 10 }}>
        <Card c={c} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CoinIcon size={18} /><T c={c} style={{ fontWeight: '700' }}>→</T><PearlIcon size={18} />
            <T c={c} muted style={{ fontSize: 13, flex: 1 }}>1 perle = {fmtCoins(R.PEARL_PRICE)} doublon · {maxPearls} possible{maxPearls > 1 ? 's' : ''}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[1, 10, 100].map(n => (
              <Btn key={n} c={c} small kind="secondary" label={`+${n}`} icon={<PearlIcon size={14} />} disabled={maxPearls < n}
                onPress={() => simple(() => backend.buyPearls(n), [`+${n}`, 'pearl'])} />
            ))}
            {maxPearls > 0 && <Btn c={c} small label={`Tout échanger (${maxPearls})`} onPress={() => simple(() => backend.buyPearls(maxPearls), [`+${maxPearls}`, 'pearl'])} />}
          </View>
        </Card>
        <T c={c} style={{ fontWeight: '700' }}>Drapeaux</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {R.FLAGS.map(f => {
            const ownF = s!.flags.includes(f.id), cur = s!.flag === f.id;
            return (
              <Pressable key={f.id} accessibilityRole="button" disabled={busy}
                onPress={() => simple(() => backend.buyFlag(f.id), ownF ? undefined : [`Drapeau ${f.name}`])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, backgroundColor: c.card, borderWidth: 2, borderColor: cur ? FLAG_COLORS[f.id] : 'transparent' }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: FLAG_COLORS[f.id], borderWidth: 2, borderColor: '#fff' }} />
                <T c={c} style={{ fontSize: 13, fontWeight: cur ? '700' : '400' }}>{f.name}{ownF ? '' : ` · ${fmtCoins(f.price)}`}</T>
              </Pressable>
            );
          })}
        </View>
        <T c={c} muted style={{ fontSize: 12 }}>Les phares (+10 % de rente par niveau) se construisent en touchant un de vos îlots.</T>
      </View>
    );
  }

  function ProfileTab() {
    const acc = backend.account();
    return (
      <View style={{ gap: 10 }}>
        <NameField c={c} initial={s!.username} onSave={n => simple(() => backend.setUsername(n), ['Nom enregistré'])} />
        <T c={c} style={{ fontWeight: '700' }}>Compte</T>
        {acc.online
          ? acc.anonymous
            ? <EmailField c={c} onSave={async email => { const ok = await act(() => backend.linkEmail(email)); if (ok !== null) say('Vérifiez vos e-mails pour confirmer votre compte.'); }} />
            : <T c={c} muted>Partie sauvegardée sur le serveur · {acc.email}</T>
          : <T c={c} muted style={{ fontSize: 13 }}>Partie enregistrée sur cet appareil uniquement. La sauvegarde en ligne s’active quand le serveur du jeu est configuré.</T>}
        <T c={c} style={{ fontWeight: '700' }}>Parrainage</T>
        {acc.online ? (
          <>
            <T c={c} muted style={{ fontSize: 13 }}>Votre code : <T c={c} num selectable style={{ fontWeight: '700' }}>{s!.referralCode}</T>. Vous et votre filleul recevez 10 perles.</T>
            {!s!.referralUsed && <CodeField c={c} onSave={async code => { const r = await act(() => backend.applyReferral(code)); if (r) { setS(r.s); reward(`+${r.reward}`, 'pearl'); } }} />}
          </>
        ) : <T c={c} muted style={{ fontSize: 13 }}>Le parrainage demande un compte en ligne.</T>}
        <T c={c} style={{ fontWeight: '700' }}>Réglages</T>
        <SwitchRow c={c} label="Sons" value={settings.sound} onChange={v => { setSoundOn(v); updateSettings({ sound: v }); }} />
        {Platform.OS !== 'web' && (
          <SwitchRow c={c} label="Rappels (boost, pubs, série)" value={settings.notifications}
            onChange={async v => { const ok = v ? await enableNotifications() : true; updateSettings({ notifications: v && ok }); if (!v) scheduleReminders([]); if (v && !ok) say('Autorisez les notifications dans les réglages du téléphone.'); }} />
        )}
        {backend.demo && (
          <SwitchRow c={c} label="Mode démo (1 s = 10 min, partie séparée)" value={demo}
            onChange={async () => { await backend.demo!.toggle(); const st2 = (await backend.dailyLogin()).s; setDemo(backend.demo!.enabled()); setS(st2); setSelected(R.tileCount(st2) ? null : st2.spawn); setFocus({ at: st2.spawn, nonce: Date.now() }); }} />
        )}
        <Btn c={c} small kind="secondary" label="Revoir le tutoriel" onPress={() => setOverlay({ type: 'tutorial', step: 0 })} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  function LogTab() {
    const list = R.badges(s!);
    const n = list.filter(b => b.ok).length;
    const next = [...R.PASSPORT].reverse().find(([min]) => n < min);
    return (
      <View style={{ gap: 8 }}>
        <Card c={c} style={{ gap: 6 }}>
          <T c={c} style={{ fontWeight: '700' }}>Passeport · {plural(n, 'carnet')} · +{Math.round(R.passportBonus(s!) * 100)} % de rente</T>
          {next && <><Progress c={c} value={n / next[0]} color={c.epic} />
            <T c={c} muted style={{ fontSize: 12 }}>Prochain niveau à {next[0]} carnets (+{Math.round(next[1] * 100)} %).</T></>}
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map(b => (
            <View key={b.name} style={{ width: '48.5%', padding: 9, borderRadius: 12, backgroundColor: b.ok ? c.card : 'transparent', borderWidth: 1.5, borderStyle: b.ok ? 'solid' : 'dashed', borderColor: b.ok ? c.good : c.line }}>
              <T c={c} style={{ fontWeight: '700', fontSize: 13, color: b.ok ? c.ink : c.muted }}>{b.ok ? '✓ ' : ''}{b.name}</T>
              <T c={c} muted style={{ fontSize: 12 }}>{b.desc}</T>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function MoreTab() {
    const body: Record<More, () => React.ReactElement> = { shop: ShopTab, ranking: () => <Ranking c={c} backend={backend} />, log: LogTab, profile: ProfileTab };
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {MORE.map(([id, label, Icon]) => (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: more === id }} onPress={() => { play('tap'); setMore(id); }}
              style={[st.seg, { backgroundColor: more === id ? c.ink : c.card }]}>
              <Icon size={16} color={more === id ? c.paper : c.muted} />
              <T c={c} style={{ fontSize: 11, fontWeight: '700', color: more === id ? c.paper : c.muted }} numberOfLines={1}>{label}</T>
            </Pressable>
          ))}
        </View>
        {body[more]()}
      </View>
    );
  }

  const tabBody: Record<Tab, () => React.ReactElement> = { tile: TileTab, earn: EarnTab, boost: BoostTab, quests: QuestsTab, more: MoreTab };
  const questsReady = s.quests.items.filter(q => !q.claimed && q.progress >= R.QUESTS[q.id].target).length;
  const earnReady = (['ad', 'survey', 'fish', 'memo'] as const).filter(x => ready(s.cd[x])).length;
  const TABS: [Tab, string, (p: { size?: number; color?: string }) => React.ReactElement, number | true | 0][] = [
    ['tile', 'Îlot', IslandIcon, 0], ['earn', 'Perles', PearlLine, earnReady], ['boost', 'Boost', BoltIcon, !boosting && count > 0 ? true : 0],
    ['quests', 'Quêtes', ScrollIcon, questsReady], ['more', 'Plus', MoreIcon, 0],
  ];
  const nextIsland = count === 0 ? 1 : Math.min(1, s.pearls / R.ISLAND_PRICE);

  // ---------------------------------------------------------------- overlays
  function renderOverlay() {
    if (!overlay) return null;
    switch (overlay.type) {
      case 'ad': return <AdOverlay c={c} seconds={demo ? 3 : 30} label={overlay.label} onDone={overlay.then} />;
      case 'survey': return (
        <SurveyPanel c={c} onCancel={() => setOverlay(null)} onDone={async answers => {
          setOverlay(null);
          await simple(() => backend.survey(answers), ['+3', 'pearl']);
        }} />
      );
      case 'memo': return <MemoryPanel c={c} onEnd={p => endGame('memo', p)} />;
      case 'fish': return <FishingLayer c={c} onEnd={n => endGame('fish', n)} />;
      case 'reveal': return (
        <RevealCard c={c} tile={overlay.tile} rentPerDay={fmtCoins(R.tileRent(overlay.tile, now) * (1 + R.passportBonus(s!)) * 86400)}
          onClose={() => { setOverlay(null); setSelected(null); }} />
      );
      case 'msg': return (
        <MessageCard c={c} title={overlay.title} body={overlay.body} action={overlay.action}
          icon={overlay.streak ? <View style={[st.bigDisc, { backgroundColor: '#e2694f' }]}><FlameIcon size={34} color="#fff" /></View> : undefined}
          onClose={() => { if (overlay.streak) reward(`+${R.STREAK_REWARDS[((s!.streak.count - 1) % 7 + 7) % 7]}`, 'pearl'); setOverlay(overlay.next ?? null); }} />
      );
      case 'tutorial': {
        const [title, body] = TUTORIAL[overlay.step];
        const last = overlay.step === TUTORIAL.length - 1;
        return (
          <MessageCard c={c} title={title} body={body} action={last ? 'Jouer' : 'Suivant'}
            icon={<View style={{ flexDirection: 'row', gap: 5 }}>{TUTORIAL.map((_, i) => <View key={i} style={{ width: i === overlay.step ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === overlay.step ? c.accent : c.line }} />)}</View>}
            onClose={() => {
              if (last) { updateSettings({ tutorialDone: true }); setOverlay(overlay.next ?? null); }
              else setOverlay({ ...overlay, step: overlay.step + 1 });
            }} />
        );
      }
    }
  }

  return (
    <View style={[st.root, { backgroundColor: c.seaDeep }]}>
      <StatusBar style="light" />
      <HexMap s={s} others={others} selected={selected} focus={focus} zoom={zoom} c={c} disabled={busy} insetTop={hudH} insetBottom={sheetH}
        onSelect={(q, r) => {
          const kk = key(q, r);
          if (s.tiles[kk] || others.has(kk) || R.isClaimable(s, q, r, x => others.has(x))) { setSelected([q, r]); setTab('tile'); play('tap'); }
          else setSelected(null);
        }} />

      <SafeAreaView style={st.overlayRoot} edges={['top', 'bottom', 'left', 'right']} pointerEvents="box-none">
        <View style={st.app} pointerEvents="box-none">
          {/* ---- resources */}
          <View onLayout={e => setHudH(e.nativeEvent.layout.height + e.nativeEvent.layout.y)} style={[st.hud, { backgroundColor: c.panel, borderColor: c.line }]}>
            <View style={[k.row, { gap: 6 }]}>
              <T c={c} display style={{ fontWeight: '700', fontSize: 15, flexShrink: 1 }} numberOfLines={1}>Archipel des Perles</T>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {demo && <View style={[st.tag, { backgroundColor: c.accent }]}><T c={c} style={{ fontSize: 10, fontWeight: '700', color: c.accentInk }}>DÉMO</T></View>}
                <View style={[st.tag, { backgroundColor: c.card, flexDirection: 'row', gap: 3, alignItems: 'center' }]}>
                  <FlameIcon size={13} color="#e2694f" />
                  <T c={c} style={{ fontSize: 11, fontWeight: '700' }}>{s.streak.count}</T>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => setTab('earn')} style={[st.res, { backgroundColor: c.card }]}>
                <PearlIcon size={24} />
                <View>
                  <T c={c} num style={{ fontSize: 16, fontWeight: '700' }}>{fmtInt(s.pearls)}</T>
                  <T c={c} muted style={st.resLabel}>perles</T>
                </View>
              </Pressable>
              <Pressable onPress={() => { setTab('more'); setMore('shop'); }} style={[st.res, { backgroundColor: c.card, flex: 1.6 }]}>
                <CoinIcon size={24} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T c={c} num style={{ fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{fmtCoins(live.coins)}</T>
                  <T c={c} muted style={st.resLabel} numberOfLines={1}>+{fmtCoins(rate * 86400)} / jour</T>
                </View>
              </Pressable>
            </View>
            <View style={{ gap: 4 }}>
              <View style={k.row}>
                <T c={c} style={{ fontSize: 11, fontWeight: '700' }}>{count === 0 ? 'Premier îlot offert' : `${plural(count, 'îlot')} · prochain îlot`}</T>
                <T c={c} num style={{ fontSize: 11 }}>{count === 0 ? 'gratuit' : `${Math.min(s.pearls, R.ISLAND_PRICE)}/${R.ISLAND_PRICE}`}</T>
              </View>
              <Progress c={c} value={nextIsland} color={nextIsland >= 1 ? c.good : c.accent} height={7} />
            </View>
          </View>

          {/* ---- map controls */}
          <View style={st.mapRow} pointerEvents="box-none">
            <Pressable onPress={() => setTab('boost')}
              style={[st.chip, { backgroundColor: boosting ? (sup ? c.bad : c.accent) : c.panel, borderColor: boosting ? 'transparent' : c.line }]}>
              <BoltIcon size={15} color={boosting ? (sup ? '#fff' : c.accentInk) : c.muted} />
              <T c={c} num style={{ fontSize: 12, fontWeight: '700', color: boosting ? (sup ? '#fff' : c.accentInk) : c.ink }}>
                {boosting ? `×${sup ? R.SUPER_MULT : R.tierMult(count)} · ${dur(s.boostUntil - now)}` : 'Boost en pause'}
              </T>
            </Pressable>
            <View style={{ gap: 6 }}>
              {[['+', () => setZoom(z => Math.min(56, z * 1.25))], ['−', () => setZoom(z => Math.max(14, z * 0.8))],
                ['◎', () => setFocus({ at: selected ?? (Object.keys(s.tiles)[0] ? parseKey(Object.keys(s.tiles)[0]) : s.spawn), nonce: Date.now() })]].map(([l, f]) => (
                <Pressable key={l as string} accessibilityRole="button" accessibilityLabel={l === '+' ? 'Zoomer' : l === '−' ? 'Dézoomer' : 'Recentrer'}
                  onPress={f as () => void} style={[st.iconBtn, { backgroundColor: c.panel, borderColor: c.line }]}>
                  <T c={c} style={{ fontSize: 18, fontWeight: '700' }}>{l as string}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }} pointerEvents="none" />

          {/* ---- bottom sheet */}
          <View onLayout={e => setSheetH(e.nativeEvent.layout.height + 10)} style={[st.sheet, { backgroundColor: c.panel, borderColor: c.line }]}>
            {toast && (
              <View pointerEvents="none" style={[st.toast, { backgroundColor: c.ink }]}>
                <T c={c} style={{ color: c.paper, fontSize: 13, textAlign: 'center' }}>{toast}</T>
              </View>
            )}
            <ScrollView style={{ maxHeight: 268 }} contentContainerStyle={{ padding: 12, paddingBottom: 6 }}>
              {tabBody[tab]()}
            </ScrollView>
            <View style={[st.tabBar, { borderColor: c.line }]}>
              {TABS.map(([id, label, Icon, badge]) => {
                const on = tab === id;
                return (
                  <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => { play('tap'); setTab(id); }} style={st.tabBtn}>
                    <View style={[st.tabIcon, on && { backgroundColor: c.accent }]}>
                      <Icon size={21} color={on ? c.accentInk : c.muted} />
                      {!!badge && <Badge c={c} n={badge} />}
                    </View>
                    <T c={c} style={{ fontSize: 11, fontWeight: on ? '700' : '600', color: on ? c.ink : c.muted }}>{label}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>

      {overlay && <View style={StyleSheet.absoluteFill}>{renderOverlay()}</View>}
      <SafeAreaView style={st.overlayRoot} edges={['top']} pointerEvents="none">
        <View style={{ position: 'absolute', left: 0, right: 0, top: hudH + 8 }}>
          <Pops c={c} items={pops} onDone={id => setPops(p => p.filter(x => x.id !== id))} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------- small components
const PearlLine = ({ size = 22, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <SvgCircle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} fill="none" />
    <SvgCircle cx={9} cy={9} r={2.2} fill={color} />
  </Svg>
);

function SwitchRow({ c, label, value, onChange }: { c: Palette; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={k.row}>
      <T c={c} style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.own, false: c.line }} />
    </View>
  );
}

function Field({ c, placeholder, initial = '', action, onSave, keyboard }: {
  c: Palette; placeholder: string; initial?: string; action: string; onSave: (v: string) => void; keyboard?: 'email-address';
}) {
  const [v, setV] = useState(initial);
  return (
    <View style={[k.row, { gap: 8 }]}>
      <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={c.muted} autoCapitalize="none" keyboardType={keyboard}
        style={{ flex: 1, minWidth: 0, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: c.ink, fontFamily: fonts.body }} />
      <Btn c={c} small label={action} disabled={!v.trim()} onPress={() => onSave(v.trim())} />
    </View>
  );
}
const NameField = ({ c, initial, onSave }: { c: Palette; initial: string; onSave: (v: string) => void }) =>
  <Field c={c} placeholder="Votre nom de navigateur" initial={initial} action="Enregistrer" onSave={onSave} />;
const EmailField = ({ c, onSave }: { c: Palette; onSave: (v: string) => void }) =>
  <><T c={c} muted style={{ fontSize: 13 }}>Ajoutez un e-mail pour retrouver votre partie sur un autre téléphone.</T>
    <Field c={c} placeholder="vous@exemple.fr" action="Sauvegarder" keyboard="email-address" onSave={onSave} /></>;
const CodeField = ({ c, onSave }: { c: Palette; onSave: (v: string) => void }) =>
  <Field c={c} placeholder="Code d’un ami" action="Valider" onSave={onSave} />;

function Ranking({ c, backend }: { c: Palette; backend: Backend }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  useEffect(() => { backend.leaderboard().then(setRows).catch(() => setRows([])); }, [backend]);
  if (!rows) return <T c={c} muted>Chargement du classement…</T>;
  return (
    <View style={{ gap: 2 }}>
      {backend.mode === 'local' && <T c={c} muted style={{ fontSize: 13, marginBottom: 6 }}>Le classement entre joueurs apparaît quand le serveur du jeu est configuré.</T>}
      {rows.map((r, i) => (
        <View key={i} style={[k.row, { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: r.me ? c.card : 'transparent' }]}>
          <T c={c} num style={{ width: 28 }}>{i + 1}</T>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: FLAG_COLORS[r.flag] ?? c.muted }} />
          <T c={c} style={{ flex: 1, fontWeight: r.me ? '700' : '400' }} numberOfLines={1}>{r.username}{r.me ? ' (vous)' : ''}</T>
          <T c={c} num style={{ fontSize: 13 }}>{r.tiles} îlots</T>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  overlayRoot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  app: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, gap: 8 },
  hud: { borderRadius: 20, borderWidth: 1, padding: 10, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  res: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 14 },
  resLabel: { fontSize: 10, letterSpacing: 0.4 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  mapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  toast: { position: 'absolute', top: -46, alignSelf: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, maxWidth: '92%', zIndex: 2 },
  sheet: { borderRadius: 24, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 4 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  seg: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 7, borderRadius: 12 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bigDisc: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});

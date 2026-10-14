import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Backend, createBackend } from './src/backend';
import type { LeaderRow, WorldTile } from './src/backend/types';
import * as R from './src/game/rules';
import { biomeAt, BIOMES, key, parseKey } from './src/game/world';
import { adsSimulated, showRewardedAd } from './src/services/ads';
import { buzz, play, setSoundOn } from './src/services/feedback';
import { enableNotifications, Reminder, scheduleReminders } from './src/services/notify';
import { loadJSON, saveJSON } from './src/services/storage';
import { HexMap } from './src/ui/HexMap';
import { Btn, Progress, styles as k, T } from './src/ui/kit';
import { AdOverlay, FishingLayer, MemoryPanel, MessageCard, RevealCard, SurveyPanel, TUTORIAL } from './src/ui/Overlays';
import { FLAG_COLORS, fonts, Palette, RARITY_COLORS, usePalette } from './src/ui/theme';

type Tab = 'tile' | 'earn' | 'boost' | 'quests' | 'shop' | 'ranking' | 'log' | 'profile';
const TABS: [Tab, string][] = [
  ['tile', 'Îlot'], ['earn', 'Perles'], ['boost', 'Boost'], ['quests', 'Quêtes'],
  ['shop', 'Comptoir'], ['ranking', 'Classement'], ['log', 'Carnets'], ['profile', 'Profil'],
];
type Overlay =
  | { type: 'ad'; label: string; then: () => void }
  | { type: 'survey' } | { type: 'memo' } | { type: 'fish' }
  | { type: 'reveal'; tile: R.Tile }
  | { type: 'msg'; title: string; body: string; action?: string; next?: Overlay | null }
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

export default function App() {
  return (
    <SafeAreaProvider>
      <Game />
    </SafeAreaProvider>
  );
}

function Game() {
  const c = usePalette();
  const backend = useMemo<Backend>(() => createBackend(), []);
  const [s, setS] = useState<R.GameState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('tile');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [others, setOthers] = useState<Map<string, WorldTile>>(new Map());
  const [focus, setFocus] = useState<{ at: [number, number]; nonce: number }>({ at: [0, 0], nonce: 0 });
  const [zoom, setZoom] = useState(30);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState({ sound: true, notifications: false, tutorialDone: false });
  const [demo, setDemo] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
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
          ? { type: 'msg', title: `Série de ${login.s.streak.count} jour${login.s.streak.count > 1 ? 's' : ''}`, body: `Récompense de connexion : +${login.reward} perle${login.reward > 1 ? 's' : ''}. Revenez demain pour continuer la série.` }
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
  if (!s) return <View style={[st.root, { backgroundColor: c.paper }]} />;

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
    if (res.reward) { play('coin'); buzz('success'); say(`+${res.reward} perle${res.reward > 1 ? 's' : ''}`); }
    else say(game === 'fish' ? `${score} bouteille${score > 1 ? 's' : ''} : il en faut 5 pour une perle.` : 'Aucune perle cette fois.');
  }

  const simple = async (fn: () => Promise<R.GameState>, ok?: string) => {
    const st2 = await act(fn);
    if (st2) { setS(st2); if (ok) { play('coin'); say(ok); } }
  };

  // ---------------------------------------------------------------- tab contents
  const ready = (t: number) => now >= t;
  const cdLabel = (t: number, label: string) => (ready(t) ? label : dur(t - now));

  function TileTab() {
    if (!selected) {
      return <T c={c} muted>Touchez un îlot marqué « ? » sur la carte. Il doit toucher votre territoire.</T>;
    }
    const own = s!.tiles[selKey!];
    const other = others.get(selKey!);
    const biome = BIOMES[own?.biome ?? biomeAt(selected[0], selected[1])];
    if (own) {
      const perDay = R.tileRent(own, now) * (1 + R.passportBonus(s!)) * 86400;
      return (
        <View style={{ gap: 10 }}>
          <View style={k.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T c={c} style={{ fontWeight: '700', fontSize: 16 }}>{BIOMES[own.biome]} <T c={c} style={{ color: RARITY_COLORS(c)[own.rar], fontSize: 12, fontWeight: '700' }}>{R.RARITIES[own.rar].name.toUpperCase()}</T></T>
              <T c={c} muted style={{ fontSize: 13 }}>{fmtCoins(perDay)} doublon par jour hors boost · amélioration {own.level}/{R.MAX_LEVEL}{own.biome === featured ? ' · biome à l’honneur +25 %' : ''}</T>
            </View>
          </View>
          {own.level < R.MAX_LEVEL
            ? <Btn c={c} kind="secondary" label={`Construire un phare (+10 %) · ${fmtCoins(R.UPGRADE_PRICE(own.level))} doublon`} disabled={live.coins < R.UPGRADE_PRICE(own.level)}
                onPress={() => simple(() => backend.upgrade(selected[0], selected[1]), 'Phare construit')} />
            : <T c={c} muted>Cet îlot est au niveau maximum.</T>}
        </View>
      );
    }
    if (other) {
      return <T c={c}>{biome} · appartient à <T c={c} style={{ fontWeight: '700' }}>{other.owner}</T>.</T>;
    }
    const claimable = R.isClaimable(s!, selected[0], selected[1], kk => others.has(kk));
    const price = count === 0 ? 0 : R.ISLAND_PRICE;
    return (
      <View style={k.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T c={c} style={{ fontWeight: '700', fontSize: 16 }}>{biome} <T c={c} muted style={{ fontSize: 12, fontWeight: '700' }}>RARETÉ INCONNUE</T></T>
          <T c={c} muted style={{ fontSize: 13 }}>Tirage à l’achat : 50 % commun, 30 % rare, 15 % épique, 5 % légendaire.</T>
        </View>
        <Btn c={c} label={!claimable ? 'Hors de portée' : price ? `Acquérir · ${price} perles` : 'Acquérir gratuitement'}
          disabled={!claimable || s!.pearls < price || busy} onPress={claimSelected} />
      </View>
    );
  }

  function earnRow({ title, sub, label, disabled, onPress }: { title: string; sub: string; label: string; disabled?: boolean; onPress: () => void }) {
    return (
      <View key={title} style={[k.row, k.divider, { borderColor: c.line, paddingVertical: 8 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T c={c} style={{ fontWeight: '700' }}>{title}</T>
          <T c={c} muted style={{ fontSize: 12 }}>{sub}</T>
        </View>
        <Btn c={c} small label={label} disabled={disabled || busy} onPress={onPress} />
      </View>
    );
  }

  function EarnTab() {
    return (
      <View>
        {earnRow({ title: "Publicité", sub: "+1 perle · toutes les 20 min", label: cdLabel(s!.cd.ad, 'Regarder'), disabled: !ready(s!.cd.ad),
          onPress: () => watchAd('pearl', 'Publicité · +1 perle', () => { play('coin'); say('+1 perle'); }),  })}
        {earnRow({ title: "Sondage", sub: "3 questions · +3 perles · toutes les 2 h", label: cdLabel(s!.cd.survey, 'Répondre'), disabled: !ready(s!.cd.survey),
          onPress: () => setOverlay({ type: 'survey' }),  })}
        {earnRow({ title: "Pêche aux bouteilles", sub: "Pub puis 12 s · 1 perle par 5 bouteilles, 3 max · toutes les heures", label: cdLabel(s!.cd.fish, 'Jouer'), disabled: !ready(s!.cd.fish),
          onPress: () => startGame('fish'),  })}
        {earnRow({ title: "Mémoire des coquillages", sub: "Pub puis 40 s · 1 perle par 2 paires, 3 si tout trouvé · toutes les heures", label: cdLabel(s!.cd.memo, 'Jouer'), disabled: !ready(s!.cd.memo),
          onPress: () => startGame('memo'),  })}
        {demo && earnRow({ title: "Démo", sub: "Pour tester sans attendre", label: "+100 perles", onPress: async () => setS(await backend.demo!.gift()) })}
      </View>
    );
  }

  function BoostTab() {
    const tier = R.tierMult(count);
    const left = Math.max(0, s!.boostUntil - now);
    let lo = 1;
    return (
      <View style={{ gap: 10 }}>
        <T c={c} muted style={{ fontSize: 13, lineHeight: 19 }}>
          Chaque pub ajoute 1 h de boost, jusqu’à 6 h en réserve ({dur(left)} en ce moment). Avec {count} îlot{count > 1 ? 's' : ''}, le boost multiplie votre rente par {tier}.{' '}
          {sup ? `Super boost en cours : vos heures de boost comptent ×50 encore ${dur(R.superEndsIn(now))}.` : `Prochain super boost ×50 dans ${dur(R.superStartsIn(now))}.`}
        </T>
        <Btn c={c} label="Regarder une pub · +1 h de boost" disabled={busy || count === 0 || left > R.MAX_BOOST - R.HOUR}
          onPress={() => watchAd('boost', 'Publicité · +1 h de boost', () => { play('coin'); say(`+1 h de boost ×${R.boostMult(s!, backend.now())}`); })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {R.TIERS.map(([max, m]) => {
            const label = `${max === Infinity ? `${lo}+` : `${lo}–${max}`} · ×${m}`;
            lo = max + 1;
            const cur = m === tier;
            return (
              <View key={m} style={{ paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: cur ? c.own : c.line, backgroundColor: cur ? c.own : 'transparent' }}>
                <T c={c} num style={{ fontSize: 11, color: cur ? c.paper : c.muted }}>{label}</T>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  function QuestsTab() {
    const weekLeft = R.WEEK - (now % R.WEEK);
    return (
      <View style={{ gap: 10 }}>
        <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.biome[featured] }}>
          <T c={c} style={{ fontWeight: '700', color: '#16313a' }}>Semaine {BIOMES[featured].toLowerCase()} : +25 % de rente</T>
          <T c={c} style={{ fontSize: 12, color: '#16313a' }}>Vos îlots {BIOMES[featured].toLowerCase()} rapportent plus pendant encore {dur(weekLeft)}.</T>
        </View>
        <T c={c} style={{ fontWeight: '700' }}>Série de connexion : {s!.streak.count} jour{s!.streak.count > 1 ? 's' : ''}</T>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {R.STREAK_REWARDS.map((r, i) => {
            const pos = ((s!.streak.count - 1) % 7 + 7) % 7;
            const done = i <= pos && s!.streak.count > 0;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: done ? c.own : c.line, backgroundColor: done ? c.own : 'transparent' }}>
                <T c={c} style={{ fontSize: 10, color: done ? c.paper : c.muted }}>J{i + 1}</T>
                <T c={c} num style={{ fontSize: 12, color: done ? c.paper : c.ink }}>+{r}</T>
              </View>
            );
          })}
        </View>
        <T c={c} style={{ fontWeight: '700' }}>Quêtes du jour</T>
        {s!.quests.items.map(q => {
          const def = R.QUESTS[q.id];
          const complete = q.progress >= def.target;
          return (
            <View key={q.id} style={[k.row, { gap: 12 }]}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <T c={c}>{def.label} · {q.progress}/{def.target}</T>
                <Progress c={c} value={q.progress / def.target} />
              </View>
              <Btn c={c} small label={q.claimed ? 'Reçu' : `+${def.reward} perles`} disabled={!complete || q.claimed}
                onPress={() => simple(() => backend.claimQuest(q.id), `Quête terminée : +${def.reward} perles`)} />
            </View>
          );
        })}
      </View>
    );
  }

  function ShopTab() {
    const maxPearls = Math.floor(live.coins / R.PEARL_PRICE);
    return (
      <View style={{ gap: 10 }}>
        <T c={c} muted style={{ fontSize: 13 }}>Échangez vos doublons : 1 perle = {fmtCoins(R.PEARL_PRICE)} doublon. Vous pouvez en obtenir {maxPearls}.</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[1, 10, 100].map(n => (
            <Btn key={n} c={c} small kind="secondary" label={`+${n} perle${n > 1 ? 's' : ''}`} disabled={maxPearls < n}
              onPress={() => simple(() => backend.buyPearls(n), `+${n} perle${n > 1 ? 's' : ''}`)} />
          ))}
          {maxPearls > 0 && <Btn c={c} small label={`Tout échanger (${maxPearls})`} onPress={() => simple(() => backend.buyPearls(maxPearls), `+${maxPearls} perles`)} />}
        </View>
        <T c={c} style={{ fontWeight: '700' }}>Drapeaux</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {R.FLAGS.map(f => {
            const ownF = s!.flags.includes(f.id), cur = s!.flag === f.id;
            return (
              <Pressable key={f.id} accessibilityRole="button" disabled={busy}
                onPress={() => simple(() => backend.buyFlag(f.id), ownF ? undefined : `Drapeau ${f.name} acheté`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: cur ? 2 : 1, borderColor: cur ? c.ink : c.line }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: FLAG_COLORS[f.id] }} />
                <T c={c} style={{ fontSize: 13 }}>{f.name}{ownF ? '' : ` · ${fmtCoins(f.price)}`}</T>
              </Pressable>
            );
          })}
        </View>
        <T c={c} muted style={{ fontSize: 12 }}>Les phares (+10 % de rente par niveau, 3 niveaux) se construisent depuis l’onglet Îlot.</T>
      </View>
    );
  }

  function ProfileTab() {
    const acc = backend.account();
    return (
      <View style={{ gap: 10 }}>
        <NameField c={c} initial={s!.username} onSave={n => simple(() => backend.setUsername(n), 'Nom enregistré')} />
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
            {!s!.referralUsed && <CodeField c={c} onSave={async code => { const r = await act(() => backend.applyReferral(code)); if (r) { setS(r.s); play('coin'); say(`Code accepté : +${r.reward} perles`); } }} />}
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
        <T c={c} muted style={{ fontSize: 13 }}>
          Passeport : {n} carnet{n > 1 ? 's' : ''} · +{Math.round(R.passportBonus(s!) * 100)} % de rente permanente{next ? `. Prochain niveau à ${next[0]} carnets (+${Math.round(next[1] * 100)} %).` : '.'}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map(b => (
            <View key={b.name} style={{ width: '48%', padding: 8, borderRadius: 9, borderWidth: 1, borderStyle: b.ok ? 'solid' : 'dashed', borderColor: b.ok ? c.own : c.line }}>
              <T c={c} style={{ fontWeight: '700', fontSize: 13, color: b.ok ? c.ink : c.muted }}>{b.ok ? '✓ ' : ''}{b.name}</T>
              <T c={c} muted style={{ fontSize: 12 }}>{b.desc}</T>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const tabBody: Record<Tab, () => React.ReactElement> = {
    tile: TileTab, earn: EarnTab, boost: BoostTab, quests: QuestsTab, shop: ShopTab,
    ranking: () => <Ranking c={c} backend={backend} />, log: LogTab, profile: ProfileTab,
  };
  const questsReady = s.quests.items.some(q => !q.claimed && q.progress >= R.QUESTS[q.id].target);

  // ---------------------------------------------------------------- overlays
  function renderOverlay() {
    if (!overlay) return null;
    switch (overlay.type) {
      case 'ad': return <AdOverlay c={c} seconds={demo ? 3 : 30} label={overlay.label} onDone={overlay.then} />;
      case 'survey': return (
        <SurveyPanel c={c} onCancel={() => setOverlay(null)} onDone={async answers => {
          setOverlay(null);
          await simple(() => backend.survey(answers), 'Sondage terminé : +3 perles');
        }} />
      );
      case 'memo': return <MemoryPanel c={c} onEnd={p => endGame('memo', p)} />;
      case 'fish': return <FishingLayer c={c} onEnd={n => endGame('fish', n)} />;
      case 'reveal': return (
        <RevealCard c={c} tile={overlay.tile} rentPerDay={fmtCoins(R.tileRent(overlay.tile, now) * (1 + R.passportBonus(s!)) * 86400)}
          onClose={() => { setOverlay(null); setSelected(null); }} />
      );
      case 'msg': return <MessageCard c={c} title={overlay.title} body={overlay.body} action={overlay.action} onClose={() => setOverlay(overlay.next ?? null)} />;
      case 'tutorial': {
        const [title, body] = TUTORIAL[overlay.step];
        const last = overlay.step === TUTORIAL.length - 1;
        return (
          <MessageCard c={c} title={`${overlay.step + 1}/${TUTORIAL.length} · ${title}`} body={body} action={last ? 'Jouer' : 'Suivant'}
            onClose={() => {
              if (last) { updateSettings({ tutorialDone: true }); setOverlay(overlay.next ?? null); }
              else setOverlay({ ...overlay, step: overlay.step + 1 });
            }} />
        );
      }
    }
  }

  return (
    <SafeAreaView style={[st.root, { backgroundColor: c.paper }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="auto" />
      <View style={st.app}>
        <View style={st.header}>
          <View style={[k.row, { flexWrap: 'wrap' }]}>
            <T c={c} display style={{ fontWeight: '700', fontSize: 15 }}>Archipel des Perles</T>
            {demo && <View style={{ backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><T c={c} style={{ fontSize: 11, fontWeight: '700', color: c.accentInk }}>Démo · 1 s = 10 min</T></View>}
          </View>
          <View style={st.stats}>
            <Stat c={c} value={fmtInt(s.pearls)} label="perles" />
            <Stat c={c} value={fmtCoins(live.coins)} label="doublons" />
            <Stat c={c} value={fmtCoins(rate * 86400)} label="par jour" />
            <Stat c={c} value={String(count)} label="îlots" />
          </View>
        </View>

        <View style={[st.map, { backgroundColor: c.sea, borderColor: c.line }]}>
          <HexMap s={s} others={others} selected={selected} focus={focus} zoom={zoom} c={c} disabled={busy}
            onSelect={(q, r) => {
              const kk = key(q, r);
              if (s.tiles[kk] || others.has(kk) || R.isClaimable(s, q, r, x => others.has(x))) { setSelected([q, r]); setTab('tile'); play('tap'); }
              else setSelected(null);
            }} />
          <View style={[st.chip, { backgroundColor: boosting ? (sup ? c.bad : c.accent) : c.panel, borderColor: boosting ? 'transparent' : c.line }]}>
            <T c={c} num style={{ fontSize: 12, fontWeight: '700', color: boosting ? (sup ? c.paper : c.accentInk) : c.ink }}>
              {boosting ? `${sup ? 'Super ×50' : `Boost ×${R.tierMult(count)}`} · ${dur(s.boostUntil - now)}` : 'Sans boost'}
            </T>
          </View>
          <View style={st.zoom}>
            {[['+', () => setZoom(z => Math.min(48, z * 1.25))], ['−', () => setZoom(z => Math.max(12, z * 0.8))],
              ['◎', () => setFocus({ at: selected ?? (Object.keys(s.tiles)[0] ? parseKey(Object.keys(s.tiles)[0]) : s.spawn), nonce: Date.now() })]].map(([l, f]) => (
              <Pressable key={l as string} accessibilityRole="button" accessibilityLabel={l === '+' ? 'Zoomer' : l === '−' ? 'Dézoomer' : 'Recentrer'}
                onPress={f as () => void} style={[st.iconBtn, { backgroundColor: c.panel, borderColor: c.line }]}>
                <T c={c} style={{ fontSize: 18, fontWeight: '600' }}>{l as string}</T>
              </Pressable>
            ))}
          </View>
          {renderOverlay()}
          {toast && (
            <View pointerEvents="none" style={[st.toast, { backgroundColor: c.ink }]}>
              <T c={c} style={{ color: c.paper, fontSize: 13 }}>{toast}</T>
            </View>
          )}
        </View>

        <View style={[st.sheet, { backgroundColor: c.panel, borderColor: c.line }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {TABS.map(([id, label]) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)}
                style={[st.tab, { borderColor: tab === id ? c.ink : c.line, backgroundColor: tab === id ? c.ink : 'transparent' }]}>
                <T c={c} style={{ fontSize: 13, fontWeight: '600', color: tab === id ? c.paper : c.muted }}>
                  {label}{id === 'quests' && questsReady ? ' •' : ''}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ paddingTop: 10 }}>
            {tabBody[tab]()}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- small components
function Stat({ c, value, label }: { c: Palette; value: string; label: string }) {
  return (
    <View>
      <T c={c} num style={{ fontSize: 15 }}>{value}</T>
      <T c={c} muted style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</T>
    </View>
  );
}

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
        <View key={i} style={[k.row, { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: r.me ? c.sea : 'transparent' }]}>
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
  app: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  header: { gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  map: { flex: 1, minHeight: 220, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  chip: { position: 'absolute', left: 10, top: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  sheet: { borderRadius: 14, borderWidth: 1, padding: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1 },
});

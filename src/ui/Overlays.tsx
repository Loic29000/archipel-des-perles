import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { RARITIES, Tile } from '../game/rules';
import { BIOMES } from '../game/world';
import { Confetti, Rays } from './fx';
import { ClipboardIcon } from './icons';
import { Island, IslandBase } from './island';
import { Btn, Progress, T } from './kit';
import { Palette, RARITY_COLORS } from './theme';

const fill = StyleSheet.absoluteFill;

// ---------------------------------------------------------------- simulated ad (web only)
export function AdOverlay({ c, seconds, label, onDone }: { c: Palette; seconds: number; label: string; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const t0 = Date.now(), end = t0 + seconds * 1000;
    const id = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      setFrac(Math.min(1, (Date.now() - t0) / (seconds * 1000)));
      if (l === 0) { clearInterval(id); onDone(); }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const R = 46, L = 2 * Math.PI * R;
  return (
    <View style={[fill, { backgroundColor: 'rgba(6,22,29,0.94)', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }]}>
      <T c={c} style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>{label}</T>
      <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={120} height={120} style={{ position: 'absolute' }}>
          <Circle cx={60} cy={60} r={R} stroke="rgba(255,255,255,0.15)" strokeWidth={8} fill="none" />
          <Circle cx={60} cy={60} r={R} stroke={c.accent} strokeWidth={8} fill="none" strokeLinecap="round"
            strokeDasharray={`${L}`} strokeDashoffset={L * (1 - frac)} transform="rotate(-90 60 60)" />
        </Svg>
        <T c={c} num style={{ color: '#ffffff', fontSize: 34, fontWeight: '700' }}>{left}</T>
      </View>
      <T c={c} style={{ color: '#ffffff', opacity: 0.65, fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
        Publicité simulée dans la version web. L’application mobile affiche une vraie publicité AdMob.
      </T>
    </View>
  );
}

// ---------------------------------------------------------------- survey
const QUESTIONS: [string, string[]][] = [
  ['À quelle fréquence jouez-vous à des jeux mobiles ?', ['Tous les jours', 'Plusieurs fois par semaine', 'Rarement']],
  ['Quelle récompense préférez-vous ?', ['Des perles', 'Plus de boost', 'Des îlots rares']],
  ['Combien de temps dure une partie typique pour vous ?', ['Moins de 5 min', '5 à 20 min', 'Plus de 20 min']],
  ['Quel biome aimeriez-vous voir ajouté ?', ['Glacier', 'Désert', 'Récif corallien', 'Jungle']],
  ['Comment avez-vous découvert ce jeu ?', ['Un ami', 'Les réseaux sociaux', 'Un store d’applications', 'Autre']],
  ['Regarderiez-vous plus de pubs pour plus de boost ?', ['Oui', 'Peut-être', 'Non']],
];
export function SurveyPanel({ c, onDone, onCancel }: { c: Palette; onDone: (a: [string, string][]) => void; onCancel: () => void }) {
  const qs = useMemo(() => [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3), []);
  const [answers, setAnswers] = useState<[string, string][]>([]);
  const i = answers.length;
  if (i >= qs.length) return null;
  return (
    <View style={[fill, { backgroundColor: c.panel, padding: 18, gap: 14 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[iconDisc, { backgroundColor: c.own }]}><ClipboardIcon size={20} color="#ffffff" /></View>
        <View style={{ flex: 1 }}>
          <T c={c} display style={{ fontWeight: '700', fontSize: 15 }}>Sondage</T>
          <T c={c} muted style={{ fontSize: 12 }}>Question {i + 1} sur 3 · 3 perles à la fin</T>
        </View>
      </View>
      <Progress c={c} value={i / qs.length} color={c.accent} />
      <T c={c} style={{ fontWeight: '700', fontSize: 18, lineHeight: 24 }}>{qs[i][0]}</T>
      <View style={{ gap: 8 }}>
        {qs[i][1].map(o => (
          <Pressable key={o} accessibilityRole="button" onPress={() => {
            const next = [...answers, [qs[i][0], o] as [string, string]];
            setAnswers(next);
            if (next.length === qs.length) onDone(next);
          }} style={({ pressed }) => ({ padding: 14, borderRadius: 14, borderWidth: 2, borderColor: pressed ? c.accent : c.line, backgroundColor: pressed ? c.card : c.panel })}>
            <T c={c} style={{ fontWeight: '600' }}>{o}</T>
          </Pressable>
        ))}
      </View>
      <Btn c={c} kind="secondary" small label="Plus tard" onPress={onCancel} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

// ---------------------------------------------------------------- memory game: 6 pairs in 40 s
const SYMBOLS = ['🐚', '🦀', '🐠', '🐙', '⭐', '🐬'];
function MemoCard({ c, sym, shown, found, onPress, index }: { c: Palette; sym: string; shown: boolean; found: boolean; onPress: () => void; index: number }) {
  const flip = useRef(new Animated.Value(shown ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(flip, { toValue: shown ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [shown, flip]);
  // squash to zero width halfway, then swap faces
  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });
  const front = flip.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const back = flip.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] });
  return (
    <Pressable accessibilityLabel={`Carte ${index + 1}`} onPress={onPress} style={{ width: 74, height: 84 }}>
      <Animated.View style={[fill, memo.card, { backgroundColor: c.own, borderColor: '#0a5a62', opacity: back, transform: [{ scaleX }] }]}>
        <Svg width={40} height={40} viewBox="0 0 24 24">
          <Path d="M12 20.5c-4.5 0-8-3.8-8-8.5 0-3.6 3.6-7.5 8-7.5s8 3.9 8 7.5c0 4.7-3.5 8.5-8 8.5zM12 20.5V4.5M12 20.5 6.5 7M12 20.5 17.5 7" stroke="rgba(255,255,255,0.55)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[fill, memo.card, { backgroundColor: found ? c.card : '#ffffff', borderColor: found ? c.good : c.accent, opacity: front, transform: [{ scaleX }] }]}>
        <T c={c} style={{ fontSize: 34 }}>{sym}</T>
      </Animated.View>
    </Pressable>
  );
}

export function MemoryPanel({ c, onEnd }: { c: Palette; onEnd: (pairs: number) => void }) {
  const deck = useMemo(() => [...SYMBOLS, ...SYMBOLS].sort(() => Math.random() - 0.5), []);
  const [up, setUp] = useState<number[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [left, setLeft] = useState(40);
  const ended = useRef(false);
  const pairs = done.size / 2;
  const end = (p: number) => { if (!ended.current) { ended.current = true; setTimeout(() => onEnd(p), 700); } };
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const l = 40 - Math.floor((Date.now() - t0) / 1000);
      setLeft(Math.max(0, l));
      if (l <= 0) { clearInterval(id); end(doneRef.current.size / 2); }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doneRef = useRef(done);
  doneRef.current = done;
  function flip(i: number) {
    if (ended.current || up.length === 2 || up.includes(i) || done.has(i)) return;
    const next = [...up, i];
    setUp(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (deck[a] === deck[b]) {
        const d = new Set(done); d.add(a); d.add(b);
        setTimeout(() => { setDone(d); setUp([]); }, 250);
        if (d.size === deck.length) end(6);
      } else setTimeout(() => setUp([]), 750);
    }
  }
  return (
    <View style={[fill, { backgroundColor: c.panel, padding: 16, gap: 12, alignItems: 'center', justifyContent: 'center' }]}>
      <T c={c} display style={{ fontWeight: '700', fontSize: 16 }}>Mémoire des coquillages</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Chip c={c} text={`${pairs}/6 paires`} />
        <Chip c={c} text={`${left} s`} hot={left <= 10} />
      </View>
      <View style={{ width: '100%', maxWidth: 340 }}><Progress c={c} value={left / 40} color={left <= 10 ? c.bad : c.accent} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 346, justifyContent: 'center' }}>
        {deck.map((sym, i) => (
          <MemoCard key={i} index={i} c={c} sym={sym} shown={up.includes(i) || done.has(i)} found={done.has(i)} onPress={() => flip(i)} />
        ))}
      </View>
    </View>
  );
}

function Chip({ c, text, hot }: { c: Palette; text: string; hot?: boolean }) {
  return (
    <View style={{ backgroundColor: hot ? c.bad : c.ink, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
      <T c={c} num style={{ color: hot ? '#ffffff' : c.paper, fontSize: 13, fontWeight: '700' }}>{text}</T>
    </View>
  );
}

// ---------------------------------------------------------------- fishing: tap bottles for 12 s
interface Bottle { id: number; x: number; y: number; vx: number; ph: number }
export function FishingLayer({ c, onEnd }: { c: Palette; onEnd: (caught: number) => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [caught, setCaught] = useState(0);
  const [left, setLeft] = useState(12);
  const caughtRef = useRef(0);
  useEffect(() => {
    if (!box.w) return;
    const t0 = Date.now();
    let nextSpawn = 0, id = 0, raf = 0, last = Date.now();
    const loop = () => {
      const now = Date.now(), dt = (now - last) / 1000;
      last = now;
      const el = (now - t0) / 1000;
      setLeft(Math.max(0, Math.ceil(12 - el)));
      if (el > 12) { onEnd(caughtRef.current); return; }
      setBottles(bs => {
        let out = bs.map(b => ({ ...b, x: b.x + b.vx * dt, ph: b.ph + dt * 5 })).filter(b => b.x > -50 && b.x < box.w + 50);
        if (now > nextSpawn) {
          nextSpawn = now + 380 + Math.random() * 340;
          const fromLeft = Math.random() < 0.5;
          out = [...out, { id: id++, x: fromLeft ? -30 : box.w + 30, y: 30 + Math.random() * (box.h - 60), vx: (fromLeft ? 1 : -1) * (60 + Math.random() * 80), ph: Math.random() * 6 }];
        }
        return out;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w]);
  return (
    <View style={fill} onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="fishSea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.sea} />
              <Stop offset="1" stopColor={c.seaDeep} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill="url(#fishSea)" />
          {Array.from({ length: 14 }, (_, i) => {
            const x = ((i * 137) % 100) / 100 * box.w, y = 40 + ((i * 61) % 100) / 100 * (box.h - 80);
            return <Path key={i} d={`M${x - 10} ${y} q5 -5 10 0 t10 0`} stroke={c.seaLine} strokeWidth={1.6} fill="none" opacity={0.7} strokeLinecap="round" />;
          })}
        </Svg>
      )}
      <View style={{ position: 'absolute', top: 24, alignSelf: 'center', alignItems: 'center', gap: 4 }}>
        <T c={c} display style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Pêche aux bouteilles</T>
        <T c={c} style={{ color: '#ffffff', opacity: 0.85, fontSize: 12 }}>Touchez les bouteilles · 5 = 1 perle</T>
      </View>
      <View style={{ position: 'absolute', bottom: 56, alignSelf: 'center', flexDirection: 'row', gap: 8 }}>
        <Chip c={c} text={`🍾 ${caught}`} />
        <Chip c={c} text={`${left} s`} hot={left <= 4} />
      </View>
      {bottles.map(b => (
        <Pressable key={b.id} hitSlop={10} accessibilityLabel="Bouteille"
          onPress={() => { caughtRef.current += 1; setCaught(caughtRef.current); setBottles(bs => bs.filter(x => x.id !== b.id)); }}
          style={{ position: 'absolute', left: b.x - 22, top: b.y + Math.sin(b.ph) * 6 - 14, width: 44, height: 28, transform: [{ scaleX: b.vx > 0 ? 1 : -1 }, { rotate: `${Math.sin(b.ph) * 14}deg` }] }}>
          <BottleArt />
        </Pressable>
      ))}
    </View>
  );
}

/** A message in a bottle, drawn lying on its side. */
function BottleArt() {
  return (
    <Svg width={44} height={28} viewBox="0 0 44 28">
      <Path d="M4 21 Q22 25 40 21" stroke="#ffffff" strokeWidth={2} fill="none" opacity={0.6} strokeLinecap="round" />
      <Rect x={6} y={7} width={24} height={13} rx={6} fill="#9be3c9" opacity={0.9} stroke="#2f7d6a" strokeWidth={1.5} />
      <Rect x={29} y={10} width={7} height={7} rx={2} fill="#9be3c9" stroke="#2f7d6a" strokeWidth={1.5} />
      <Rect x={35} y={10.5} width={4} height={6} rx={1.2} fill="#a8723c" />
      <Rect x={11} y={10} width={13} height={7} rx={2} fill="#fff4d6" transform="rotate(-6 17 13)" />
      <Path d="M9 10 Q12 8.5 18 8.6" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------- rarity reveal after a purchase
export function RevealCard({ c, tile, rentPerDay, onClose }: { c: Palette; tile: Tile; rentPerDay: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ]),
      Animated.timing(text, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [scale, lift, text]);
  const col = RARITY_COLORS(c)[tile.rar];
  const big = 150, s = 52;
  return (
    <View style={[fill, { backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, overflow: 'hidden' }]}>
      <View style={{ alignItems: 'center', justifyContent: 'center', width: 260, height: 220 }}>
        <Rays color={col} size={tile.rar >= 2 ? 360 : 280} />
        <Animated.View style={{ transform: [{ scale }, { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
          <Svg width={big} height={big}>
            <IslandBase x={big / 2} y={big / 2} s={s} c={c} kind="own" />
            <Island x={big / 2} y={big / 2} s={s} c={c} biome={tile.biome} kind="own" seed={1} rar={tile.rar} />
          </Svg>
        </Animated.View>
      </View>
      <Animated.View style={{ alignItems: 'center', gap: 6, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <View style={{ backgroundColor: col, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 16 }}>
          <T c={c} display style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}>{RARITIES[tile.rar].name}{tile.rar >= 2 ? ' !' : ''}</T>
        </View>
        <T c={c} style={{ fontWeight: '700', fontSize: 16 }}>Îlot {BIOMES[tile.biome].toLowerCase()}</T>
        <T c={c} muted style={{ textAlign: 'center' }}>{rentPerDay} doublon par jour hors boost</T>
        <Btn c={c} label="Découvrir les voisins" onPress={onClose} style={{ marginTop: 8 }} />
      </Animated.View>
      {tile.rar >= 2 && <Confetti count={tile.rar === 3 ? 60 : 36} />}
    </View>
  );
}

// ---------------------------------------------------------------- generic message card
export function MessageCard({ c, title, body, action = 'Compris', onClose, children, icon, onCancel, disabled }: {
  c: Palette; title: string; body: string; action?: string; onClose: () => void; children?: React.ReactNode; icon?: React.ReactNode; onCancel?: () => void; disabled?: boolean;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start(); }, [pop]);
  return (
    <View style={[fill, { backgroundColor: 'rgba(6,22,29,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
      <Animated.View style={{ backgroundColor: c.panel, borderRadius: 24, padding: 20, gap: 12, maxWidth: 360, width: '100%', borderWidth: 2, borderColor: c.accent,
        opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
        {icon && <View style={{ alignSelf: 'center' }}>{icon}</View>}
        <T c={c} display style={{ fontWeight: '700', fontSize: 17, textAlign: icon ? 'center' : 'left' }}>{title}</T>
        <T c={c} muted style={{ lineHeight: 20, textAlign: icon ? 'center' : 'left' }}>{body}</T>
        {children}
        <Btn c={c} label={action} onPress={onClose} disabled={disabled} style={{ alignSelf: icon ? 'stretch' : 'flex-start' }} />
        {onCancel && <Btn c={c} kind="secondary" label="Annuler" onPress={onCancel} style={{ alignSelf: icon ? 'stretch' : 'flex-start' }} />}
      </Animated.View>
    </View>
  );
}

const iconDisc = { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const };
const memo = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center' },
});

export const TUTORIAL: [string, string][] = [
  ['Bienvenue sur l’Archipel', 'Chaque îlot vous rapporte des doublons à la seconde, même quand l’application est fermée.'],
  ['Votre premier îlot est gratuit', 'Touchez l’îlot marqué « ? » puis Acquérir. Sa rareté reste secrète jusqu’à l’achat, et ses voisins apparaissent ensuite.'],
  ['Gagnez des perles', 'Publicités, sondages et mini-jeux rapportent des perles. Chaque nouvel îlot coûte 100 perles.'],
  ['Boostez votre rente', 'Une pub de boost ajoute 1 h de rente multipliée, jusqu’à ×30 quand votre archipel est petit.'],
  ['Revenez chaque jour', 'Série de connexion, quêtes du jour et biome à l’honneur chaque semaine. Les doublons s’échangent au Comptoir.'],
];

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { RARITIES, Tile } from '../game/rules';
import { BIOMES } from '../game/world';
import { Btn, T } from './kit';
import { Palette, RARITY_COLORS } from './theme';

const fill = StyleSheet.absoluteFill;

// ---------------------------------------------------------------- simulated ad (web only)
export function AdOverlay({ c, seconds, label, onDone }: { c: Palette; seconds: number; label: string; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) { clearInterval(id); onDone(); }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[fill, { backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }]}>
      <T c={c} style={{ color: c.paper }}>{label}</T>
      <T c={c} num style={{ color: c.paper, fontSize: 40, fontWeight: '700' }}>{left}</T>
      <T c={c} style={{ color: c.paper, opacity: 0.7, fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
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
    <View style={[fill, { backgroundColor: c.panel, padding: 16, gap: 12 }]}>
      <T c={c} display style={{ fontWeight: '700' }}>Sondage · question {i + 1} sur 3</T>
      <T c={c} muted style={{ fontSize: 12 }}>Vos réponses aident à améliorer le jeu. 3 perles à la fin.</T>
      <T c={c} style={{ fontWeight: '600', fontSize: 16 }}>{qs[i][0]}</T>
      <View style={{ gap: 6 }}>
        {qs[i][1].map(o => (
          <Pressable key={o} accessibilityRole="button" onPress={() => {
            const next = [...answers, [qs[i][0], o] as [string, string]];
            setAnswers(next);
            if (next.length === qs.length) onDone(next);
          }} style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.line }}>
            <T c={c}>{o}</T>
          </Pressable>
        ))}
      </View>
      <Btn c={c} kind="secondary" small label="Plus tard" onPress={onCancel} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

// ---------------------------------------------------------------- memory game: 6 pairs in 40 s
const SYMBOLS = ['◆', '●', '▲', '■', '★', '✚'];
export function MemoryPanel({ c, onEnd }: { c: Palette; onEnd: (pairs: number) => void }) {
  const deck = useMemo(() => [...SYMBOLS, ...SYMBOLS].sort(() => Math.random() - 0.5), []);
  const [up, setUp] = useState<number[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [left, setLeft] = useState(40);
  const ended = useRef(false);
  const pairs = done.size / 2;
  const end = (p: number) => { if (!ended.current) { ended.current = true; setTimeout(() => onEnd(p), 600); } };
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
        setDone(d); setUp([]);
        if (d.size === deck.length) end(6);
      } else setTimeout(() => setUp([]), 650);
    }
  }
  return (
    <View style={[fill, { backgroundColor: c.panel, padding: 16, gap: 10 }]}>
      <T c={c} display style={{ fontWeight: '700' }}>Mémoire des coquillages</T>
      <T c={c} muted>{pairs} paire{pairs > 1 ? 's' : ''} · {left} s</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 340 }}>
        {deck.map((sym, i) => {
          const shown = up.includes(i) || done.has(i);
          return (
            <Pressable key={i} accessibilityLabel={`Carte ${i + 1}`} onPress={() => flip(i)}
              style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center',
                backgroundColor: shown ? c.paper : c.ink, opacity: done.has(i) ? 0.35 : 1 }}>
              <T c={c} style={{ fontSize: 26, fontWeight: '700' }}>{shown ? sym : ''}</T>
            </Pressable>
          );
        })}
      </View>
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
      <View style={{ position: 'absolute', bottom: 56, alignSelf: 'center', backgroundColor: c.ink, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
        <T c={c} num style={{ color: c.paper, fontSize: 13 }}>Bouteilles {caught} · {left} s</T>
      </View>
      {bottles.map(b => (
        <Pressable key={b.id} hitSlop={14} accessibilityLabel="Bouteille"
          onPress={() => { caughtRef.current += 1; setCaught(caughtRef.current); setBottles(bs => bs.filter(x => x.id !== b.id)); }}
          style={{ position: 'absolute', left: b.x - 14, top: b.y + Math.sin(b.ph) * 6 - 7, width: 28, height: 14, borderRadius: 5,
            backgroundColor: c.accent, borderWidth: 1.5, borderColor: c.ink, transform: [{ rotate: `${Math.sin(b.ph) * 17}deg` }] }} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- rarity reveal after a purchase
export function RevealCard({ c, tile, rentPerDay, onClose }: { c: Palette; tile: Tile; rentPerDay: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])),
    ]).start();
  }, [scale, spin, glow]);
  const col = RARITY_COLORS(c)[tile.rar];
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  return (
    <View style={[fill, { backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }]}>
      <Animated.View style={{ transform: [{ scale }, { rotate }], alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: col, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, tile.rar >= 2 ? 0.45 : 0.25] }) }} />
        <View style={{ width: 96, height: 96, borderRadius: 22, backgroundColor: c.biome[tile.biome], borderWidth: 4, borderColor: col, transform: [{ rotate: '45deg' }] }} />
      </Animated.View>
      <T c={c} display style={{ fontSize: 22, fontWeight: '700', color: col, marginTop: 18 }}>{RARITIES[tile.rar].name}{tile.rar >= 2 ? ' !' : ''}</T>
      <T c={c} muted>{BIOMES[tile.biome]} · {rentPerDay} doublon par jour hors boost</T>
      <Btn c={c} label="Continuer" onPress={onClose} />
    </View>
  );
}

// ---------------------------------------------------------------- generic message card
export function MessageCard({ c, title, body, action = 'Compris', onClose }: { c: Palette; title: string; body: string; action?: string; onClose: () => void }) {
  return (
    <View style={[fill, { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
      <View style={{ backgroundColor: c.panel, borderRadius: 16, padding: 18, gap: 10, maxWidth: 360, width: '100%', borderWidth: 1, borderColor: c.line }}>
        <T c={c} display style={{ fontWeight: '700', fontSize: 16 }}>{title}</T>
        <T c={c} muted style={{ lineHeight: 20 }}>{body}</T>
        <Btn c={c} label={action} onPress={onClose} style={{ alignSelf: 'flex-start' }} />
      </View>
    </View>
  );
}

export const TUTORIAL: [string, string][] = [
  ['Bienvenue sur l’Archipel', 'Chaque îlot vous rapporte des doublons à la seconde, même quand l’application est fermée.'],
  ['Votre premier îlot est gratuit', 'Touchez l’îlot marqué « ? » puis Acquérir. Sa rareté reste secrète jusqu’à l’achat, et ses voisins apparaissent ensuite.'],
  ['Gagnez des perles', 'Publicités, sondages et mini-jeux rapportent des perles. Chaque nouvel îlot coûte 100 perles.'],
  ['Boostez votre rente', 'Une pub de boost ajoute 1 h de rente multipliée, jusqu’à ×30 quand votre archipel est petit.'],
  ['Revenez chaque jour', 'Série de connexion, quêtes du jour et biome à l’honneur chaque semaine. Les doublons s’échangent au Comptoir.'],
];

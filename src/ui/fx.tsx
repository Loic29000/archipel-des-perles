import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { CoinIcon, PearlIcon } from './icons';
import { T } from './kit';
import { Palette } from './theme';

export interface PopItem { id: number; text: string; icon?: 'pearl' | 'coin' | 'boost' }

/** A reward that rises and fades: "+3" with a pearl, for instance. */
function Pop({ c, item, index, onDone }: { c: Palette; item: PopItem; index: number; onDone: (id: number) => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onDone(item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[st.pop, {
      backgroundColor: item.icon === 'boost' ? c.accent : c.panel, borderColor: c.accent,
      top: 8 + index * 6,
      opacity: t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [24, -46] }) },
        { scale: t.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.6, 1.18, 1, 1] }) },
      ],
    }]}>
      {item.icon === 'pearl' && <PearlIcon size={22} />}
      {item.icon === 'coin' && <CoinIcon size={22} />}
      <T c={c} display style={{ fontSize: 16, fontWeight: '700', color: item.icon === 'boost' ? c.accentInk : c.ink }}>{item.text}</T>
    </Animated.View>
  );
}

export function Pops({ c, items, onDone }: { c: Palette; items: PopItem[]; onDone: (id: number) => void }) {
  return (
    <View pointerEvents="none" style={st.popLayer}>
      {items.map((it, i) => <Pop key={it.id} c={c} item={it} index={i} onDone={onDone} />)}
    </View>
  );
}

const CONFETTI = ['#f2b225', '#ff7a59', '#4fd1c5', '#7c4ddb', '#9fd477', '#ffffff'];

/** A burst of confetti, used when a rare island is revealed. */
export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useRef(Array.from({ length: count }, (_, i) => ({
    t: new Animated.Value(0),
    x: (Math.random() - 0.5) * 340,
    y: -120 - Math.random() * 200,
    rot: (Math.random() - 0.5) * 900,
    color: CONFETTI[i % CONFETTI.length],
    w: 6 + Math.random() * 6,
    delay: Math.random() * 180,
  }))).current;
  useEffect(() => {
    Animated.parallel(pieces.map(p => Animated.timing(p.t, { toValue: 1, duration: 1700, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }))).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: p.w, height: p.w * 0.45, borderRadius: 1.5, backgroundColor: p.color,
          opacity: p.t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: p.t.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
            // up first, then gravity pulls the piece down
            { translateY: p.t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, p.y, p.y + 420] }) },
            { rotate: p.t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
          ],
        }} />
      ))}
    </View>
  );
}

/** Slow rotating light rays behind a revealed island. */
export function Rays({ color, size = 280 }: { color: string; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center',
      transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ position: 'absolute', width: 26, height: size, alignItems: 'center', transform: [{ rotate: `${i * 30}deg` }] }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 13, borderRightWidth: 13, borderTopWidth: size / 2, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color, opacity: 0.22 }} />
        </View>
      ))}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  popLayer: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  pop: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});

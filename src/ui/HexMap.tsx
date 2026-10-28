import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { WorldTile } from '../backend/types';
import { GameState, isClaimable, tileCount } from '../game/rules';
import { biomeAt, key, neighborsOf, parseKey } from '../game/world';
import { CreatureArt, hexPoints, Island, IslandBase, tileHash } from './island';
import { FLAG_COLORS, Palette } from './theme';

interface Props {
  s: GameState;
  others: Map<string, WorldTile>;
  selected: [number, number] | null;
  onSelect: (q: number, r: number) => void;
  /** Change `nonce` to recenter the camera on `at`. */
  focus: { at: [number, number]; nonce: number };
  zoom: number;
  c: Palette;
  disabled?: boolean;
  /** Screen space covered by floating panels; the camera centres on what is left. */
  insetTop?: number;
  insetBottom?: number;
  /** An event creature swimming at a sea hex; tapping it calls onCreature. */
  creature?: { q: number; r: number; kind: 'tortue' | 'coquillage' | 'baleine' } | null;
  onCreature?: () => void;
  /** Two-finger pinch: the new hex size the player asked for. */
  onZoom?: (size: number) => void;
}

const SQ3 = Math.sqrt(3);
const toPix = (q: number, r: number, size: number) => ({ x: size * SQ3 * (q + r / 2), y: size * 1.5 * r });
function pixToHex(x: number, y: number, size: number): [number, number] {
  const qf = (SQ3 / 3 * x - y / 3) / size, rf = (2 / 3 * y) / size, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}
function HexMapImpl({ s, others, selected, onSelect, focus, zoom, c, disabled, insetTop = 0, insetBottom = 0, creature, onCreature, onZoom }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const size = zoom;
  const camRef = useRef(cam);
  camRef.current = cam;
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const cy = insetTop + Math.max(0, box.h - insetTop - insetBottom) / 2;
  const live = useRef({ size, box, onSelect, disabled, cy, onZoom });
  live.current = { size, box, onSelect, disabled, cy, onZoom };

  useEffect(() => {
    const p = toPix(focus.at[0], focus.at[1], size);
    setCam({ x: p.x, y: p.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.nonce]);

  // keep the same world point centred when zooming
  const lastSize = useRef(size);
  useEffect(() => {
    const k = size / lastSize.current;
    lastSize.current = size;
    setCam(cm => ({ x: cm.x * k, y: cm.y * k }));
  }, [size]);

  const pan = useMemo(() => {
    let start = { x: 0, y: 0 }, moved = false;
    let pinch: { dist: number; size: number } | null = null;
    const spread = (e: GestureResponderEvent) => {
      const [a, b] = e.nativeEvent.touches;
      return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = { ...camRef.current }; moved = false; pinch = null;
        // page coordinates are reliable on every platform; locationX can be relative to an SVG child on web
        const node = viewRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
        const rect = node?.getBoundingClientRect?.();
        if (rect) origin.current = { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
        else viewRef.current?.measure((_x, _y, _w, _h, px, py) => { origin.current = { x: px, y: py }; });
      },
      onPanResponderMove: (e, g) => {
        if (e.nativeEvent.touches?.length >= 2) {
          // pinch to zoom; panning resumes from wherever the camera ends up
          moved = true;
          const d = spread(e);
          if (!pinch) pinch = { dist: d, size: live.current.size };
          else if (pinch.dist > 0) live.current.onZoom?.(Math.max(14, Math.min(56, pinch.size * d / pinch.dist)));
          start = { x: camRef.current.x + g.dx, y: camRef.current.y + g.dy };
          return;
        }
        if (pinch) return; // one finger lifted after a pinch: wait for release
        if (Math.hypot(g.dx, g.dy) > 6) moved = true;
        if (moved) setCam({ x: start.x - g.dx, y: start.y - g.dy });
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        if (moved || live.current.disabled) return;
        const locationX = e.nativeEvent.pageX - origin.current.x, locationY = e.nativeEvent.pageY - origin.current.y;
        const { box: b, size: sz, cy: centerY } = live.current;
        const [q, r] = pixToHex(locationX - b.w / 2 + camRef.current.x, locationY - centerY + camRef.current.y, sz);
        live.current.onSelect(q, r);
      },
    });
  }, []);

  const tiles = useMemo(() => {
    const out: { q: number; r: number; kind: 'own' | 'free' | 'other'; owner?: WorldTile }[] = [];
    const seen = new Set<string>();
    const add = (q: number, r: number) => {
      const k = key(q, r);
      if (seen.has(k)) return;
      seen.add(k);
      if (s.tiles[k]) out.push({ q, r, kind: 'own' });
      else if (others.has(k)) out.push({ q, r, kind: 'other', owner: others.get(k) });
      else if (isClaimable(s, q, r, kk => others.has(kk))) out.push({ q, r, kind: 'free' });
    };
    if (tileCount(s) === 0) add(s.spawn[0], s.spawn[1]);
    for (const k of Object.keys(s.tiles)) {
      const [q, r] = parseKey(k);
      add(q, r);
      for (const [a, b] of neighborsOf(q, r)) add(a, b);
    }
    for (const t of others.values()) add(t.q, t.r);
    return out;
  }, [s, others]);

  const ox = box.w / 2 - cam.x, oy = cy - cam.y;
  const visible = tiles
    .map(t => ({ ...t, p: toPix(t.q, t.r, size) }))
    .filter(t => {
      const x = t.p.x + ox, y = t.p.y + oy;
      return x > -size * 1.5 && y > -size * 1.5 && x < box.w + size * 1.5 && y < box.h + size * 1.5;
    })
    .sort((a, b) => a.p.y - b.p.y);

  // little wave marks fixed in world space, so they travel with the camera
  const waves: { x: number; y: number; w: number }[] = [];
  const step = Math.max(26, size * 2.1);
  const occupied = new Set(tiles.map(t => key(t.q, t.r)));
  for (let gy = Math.floor((cam.y - cy) / step) - 1; gy * step < cam.y + box.h - cy + step; gy++) {
    for (let gx = Math.floor((cam.x - box.w / 2) / step) - 1; gx * step < cam.x + box.w / 2 + step; gx++) {
      const h = tileHash(gx, gy);
      if (h % 100 > 38) continue;
      const wx = gx * step + ((h >>> 8) % 100) / 100 * step, wy = gy * step + ((h >>> 16) % 100) / 100 * step;
      const [hq, hr] = pixToHex(wx, wy, size);
      if (occupied.has(key(hq, hr))) continue;
      waves.push({ x: wx + ox, y: wy + oy, w: size * (0.22 + ((h >>> 4) % 10) / 40) });
    }
  }

  const sel = selected ? toPix(selected[0], selected[1], size) : null;

  return (
    <View ref={viewRef} style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => {
      setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
      viewRef.current?.measure((_x, _y, _w, _h, px, py) => { origin.current = { x: px, y: py }; });
    }} {...pan.panHandlers}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id="seaG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.sea} />
              <Stop offset="1" stopColor={c.seaDeep} />
            </LinearGradient>
            <RadialGradient id="seaSun" cx="30%" cy="20%" r="60%">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill="url(#seaG)" />
          <Rect x={0} y={0} width={box.w} height={box.h} fill="url(#seaSun)" />
          {waves.map((w, i) => (
            <Path key={i} d={`M${(w.x - w.w).toFixed(1)} ${w.y.toFixed(1)} q${(w.w / 2).toFixed(1)} ${(-w.w / 2).toFixed(1)} ${w.w.toFixed(1)} 0 t${w.w.toFixed(1)} 0`}
              stroke={c.seaLine} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.7} />
          ))}
          {visible.map(t => <IslandBase key={'b' + key(t.q, t.r)} x={t.p.x + ox} y={t.p.y + oy} s={size} c={c} kind={t.kind} />)}
          {visible.map(t => {
            const k = key(t.q, t.r);
            const x = t.p.x + ox, y = t.p.y + oy;
            if (t.kind === 'own') {
              const tile = s.tiles[k];
              return <Island key={k} x={x} y={y} s={size} c={c} biome={tile.biome} kind="own" seed={tileHash(t.q, t.r)} rar={tile.rar} level={tile.level} flag={FLAG_COLORS[s.flag]} deco={tile.deco} />;
            }
            if (t.kind === 'other') {
              return <Island key={k} x={x} y={y} s={size} c={c} biome={biomeAt(t.q, t.r)} kind="other" seed={tileHash(t.q, t.r)}
                flag={FLAG_COLORS[t.owner!.flag] ?? c.other} label={t.owner!.owner.slice(0, 1).toUpperCase()} />;
            }
            return <Island key={k} x={x} y={y} s={size} c={c} biome={biomeAt(t.q, t.r)} kind="free" seed={0} />;
          })}
        </Svg>
      )}
      {creature && box.w > 0 && (() => {
        const p = toPix(creature.q, creature.r, size);
        return <Creature x={p.x + ox} y={p.y + oy} size={size} kind={creature.kind} onPress={onCreature} disabled={disabled} />;
      })()}
      {sel && box.w > 0 && <SelectRing x={sel.x + ox} y={sel.y + oy} size={size} color={c.accent} />}
    </View>
  );
}

/** A bobbing event creature the player can tap. */
function Creature({ x, y, size, kind, onPress, disabled }: { x: number; y: number; size: number; kind: 'tortue' | 'coquillage' | 'baleine'; onPress?: () => void; disabled?: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const d = Math.max(44, size * 1.7);
  return (
    <Animated.View style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d,
      transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) }, { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Créature de l’événement" disabled={disabled} onPress={onPress} hitSlop={10} style={{ width: d, height: d }}>
        <Svg width={d} height={d} viewBox="-24 -24 48 48">
          <Circle cx={0} cy={0} r={22} fill="#ffffff" opacity={0.35} />
          <Circle cx={0} cy={0} r={22} fill="none" stroke="#f2b225" strokeWidth={2} strokeDasharray="4,4" />
          <CreatureArt kind={kind} />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

/** Pulsing outline on the selected island. */
function SelectRing({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const d = size * 2.6;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d,
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
    }}>
      <Svg width={d} height={d}>
        <Polygon points={hexPoints(d / 2, d / 2, size * 1.02)} fill="none" stroke="#ffffff" strokeWidth={6} opacity={0.6} />
        <Polygon points={hexPoints(d / 2, d / 2, size * 1.02)} fill="none" stroke={color} strokeWidth={3.5} />
      </Svg>
    </Animated.View>
  );
}

export const HexMap = memo(HexMapImpl);

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import type { WorldTile } from '../backend/types';
import { GameState, isClaimable, tileCount } from '../game/rules';
import { biomeAt, key, neighborsOf, parseKey } from '../game/world';
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
function hexPoints(cx: number, cy: number, s: number) {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out += `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)} `;
  }
  return out;
}

function HexMapImpl({ s, others, selected, onSelect, focus, zoom, c, disabled }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const size = zoom;
  const camRef = useRef(cam);
  camRef.current = cam;
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const live = useRef({ size, box, onSelect, disabled });
  live.current = { size, box, onSelect, disabled };

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
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = { ...camRef.current }; moved = false;
        // page coordinates are reliable on every platform; locationX can be relative to an SVG child on web
        const node = viewRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
        const rect = node?.getBoundingClientRect?.();
        if (rect) origin.current = { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
        else viewRef.current?.measure((_x, _y, _w, _h, px, py) => { origin.current = { x: px, y: py }; });
      },
      onPanResponderMove: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) > 6) moved = true;
        if (moved) setCam({ x: start.x - g.dx, y: start.y - g.dy });
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        if (moved || live.current.disabled) return;
        const locationX = e.nativeEvent.pageX - origin.current.x, locationY = e.nativeEvent.pageY - origin.current.y;
        const { box: b, size: sz } = live.current;
        const [q, r] = pixToHex(locationX - b.w / 2 + camRef.current.x, locationY - b.h / 2 + camRef.current.y, sz);
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

  const ox = box.w / 2 - cam.x, oy = box.h / 2 - cam.y;
  const lines: number[] = [];
  for (let y = ((-cam.y % 40) + 40) % 40; y < box.h; y += 40) lines.push(y);

  return (
    <View ref={viewRef} style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => {
      setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
      viewRef.current?.measure((_x, _y, _w, _h, px, py) => { origin.current = { x: px, y: py }; });
    }} {...pan.panHandlers}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h}>
          {lines.map(y => <Line key={y} x1={0} x2={box.w} y1={y} y2={y} stroke={c.seaLine} strokeWidth={1} />)}
          <G>
            {tiles.map(t => {
              const p = toPix(t.q, t.r, size);
              const x = p.x + ox, y = p.y + oy;
              if (x < -size || y < -size || x > box.w + size || y > box.h + size) return null;
              const biome = biomeAt(t.q, t.r);
              const pts = hexPoints(x, y, size - 1);
              const k = key(t.q, t.r);
              if (t.kind === 'own') {
                const tile = s.tiles[k];
                return (
                  <G key={k}>
                    <Polygon points={pts} fill={c.biome[tile.biome]} stroke={FLAG_COLORS[s.flag]} strokeWidth={2.5} />
                    {size > 14 && <Polygon points={hexPoints(x, y - 2, size * 0.17)} fill={FLAG_COLORS[s.flag]} />}
                    {size > 14 && tile.rar > 0 && (
                      <SvgText x={x} y={y + size * 0.55} fontSize={size * 0.34} fill={tile.rar === 3 ? c.accent : c.ink} textAnchor="middle">
                        {'◆'.repeat(tile.rar)}
                      </SvgText>
                    )}
                    {size > 14 && tile.level > 0 && (
                      <SvgText x={x} y={y - size * 0.32} fontSize={size * 0.3} fill={c.ink} textAnchor="middle" fontWeight="700">
                        {'▲'.repeat(tile.level)}
                      </SvgText>
                    )}
                  </G>
                );
              }
              if (t.kind === 'other') {
                return (
                  <G key={k}>
                    <Polygon points={pts} fill={c.biome[biome]} opacity={0.8} stroke={FLAG_COLORS[t.owner!.flag] ?? c.other} strokeWidth={1.5} />
                    {size > 16 && (
                      <SvgText x={x} y={y + size * 0.18} fontSize={size * 0.45} fill={c.ink} opacity={0.7} textAnchor="middle" fontWeight="700">
                        {t.owner!.owner.slice(0, 1).toUpperCase()}
                      </SvgText>
                    )}
                  </G>
                );
              }
              return (
                <G key={k}>
                  <Polygon points={pts} fill={c.biome[biome]} opacity={0.55} stroke={c.ink} strokeWidth={1.4} strokeDasharray="4,3" />
                  {size > 14 && (
                    <SvgText x={x} y={y + size * 0.2} fontSize={size * 0.55} fill={c.ink} opacity={0.6} textAnchor="middle" fontWeight="700" fontFamily="system-ui, sans-serif">?</SvgText>
                  )}
                </G>
              );
            })}
            {selected && (() => {
              const p = toPix(selected[0], selected[1], size);
              return <Polygon points={hexPoints(p.x + ox, p.y + oy, size - 1)} fill="none" stroke={c.accent} strokeWidth={3.5} />;
            })()}
          </G>
        </Svg>
      )}
    </View>
  );
}

export const HexMap = memo(HexMapImpl);

import React from 'react';
import { Circle, Ellipse, G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import type { Biome } from '../game/world';
import { Palette, RARITY_COLORS } from './theme';

export function hexPoints(cx: number, cy: number, s: number) {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out += `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)} `;
  }
  return out;
}

/** Cheap integer hash so each island gets a stable look. */
export const tileHash = (q: number, r: number) => {
  let h = Math.imul(q, 374761393) ^ Math.imul(r, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Biome scenery drawn around (0,0) for an island of radius 30; the caller scales it. */
function Scenery({ biome, c, v }: { biome: Biome; c: Palette; v: number }) {
  const d = c.deco[biome];
  switch (biome) {
    case 'plage':
      return (
        <G>
          <Ellipse cx={8} cy={9} rx={6} ry={2.2} fill="#ffffff" opacity={0.35} />
          <Path d="M3 9 C 2 3, 0 -3, -2 -9" stroke="#8a5a2b" strokeWidth={2.6} strokeLinecap="round" fill="none" />
          {[[-12, -6], [-10, -13], [5, -13], [7, -6]].map(([x, y], i) => (
            <Path key={i} d={`M-2 -9 Q ${(-2 + x) / 2} ${-14 + (y + 9) / 3} ${x} ${y}`} stroke={d} strokeWidth={3.6} strokeLinecap="round" fill="none" />
          ))}
          <Circle cx={-1} cy={-7} r={1.6} fill="#6b3f1d" />
          <Circle cx={-11} cy={8} r={2.4} fill="#d9c08a" />
        </G>
      );
    case 'prairie':
      return (
        <G>
          {[[-9, 2], [7, -4], [0, 8], [-4, -8], [11, 6]].map(([x, y], i) => (
            <G key={i}>
              <Path d={`M${x - 2} ${y + 2} l2 -4 l2 4`} stroke={c.deco.foret} strokeWidth={1.5} fill="none" strokeLinecap="round" />
              {i % 2 === 0 && <Circle cx={x} cy={y - 3} r={2} fill={i === 2 ? '#ffd166' : d} />}
            </G>
          ))}
          <Ellipse cx={-2} cy={0} rx={4} ry={2.6} fill="#ffffff" opacity={0.18} />
        </G>
      );
    case 'foret':
      return (
        <G>
          {[[-8, 4, 1], [6, 6, 0.9], [0, -4, 1.15], [11, -5, 0.75]].slice(0, v % 2 ? 4 : 3).map(([x, y, k], i) => (
            <G key={i}>
              <Path d={`M${x} ${y + 6 * k} v2`} stroke="#6b4423" strokeWidth={2} />
              <Polygon points={`${x},${y - 11 * k} ${x - 6 * k},${y + 1 * k} ${x + 6 * k},${y + 1 * k}`} fill={d} />
              <Polygon points={`${x},${y - 6 * k} ${x - 7 * k},${y + 6 * k} ${x + 7 * k},${y + 6 * k}`} fill={d} />
              <Polygon points={`${x},${y - 11 * k} ${x - 2.5 * k},${y - 6 * k} ${x + 1 * k},${y - 6 * k}`} fill="#ffffff" opacity={0.18} />
            </G>
          ))}
        </G>
      );
    case 'marais':
      return (
        <G>
          <Ellipse cx={-2} cy={3} rx={11} ry={5.5} fill="#5aa0a8" opacity={0.85} />
          <Ellipse cx={-5} cy={2} rx={3} ry={1.2} fill="#ffffff" opacity={0.35} />
          <Circle cx={3} cy={4} r={2.2} fill="#6fbf73" />
          {[[8, -2], [11, -1], [-11, -4], [-8, -5]].map(([x, y], i) => (
            <G key={i}>
              <Path d={`M${x} ${y + 6} L${x + (i % 2 ? 1 : -1)} ${y - 6}`} stroke={d} strokeWidth={1.6} strokeLinecap="round" />
              <Ellipse cx={x + (i % 2 ? 1 : -1)} cy={y - 6} rx={1.3} ry={2.6} fill="#7a4e2a" />
            </G>
          ))}
        </G>
      );
    case 'montagne':
      return (
        <G>
          <Polygon points="-14,9 -3,-13 9,9" fill={d} />
          <Polygon points="-3,-13 9,9 2,9" fill="#000000" opacity={0.12} />
          <Polygon points="-3,-13 -7.5,-4 -4.5,-6 -2,-3.5 0.8,-6.5" fill="#ffffff" />
          <Polygon points="1,9 9,-4 16,9" fill={d} opacity={0.85} />
          <Polygon points="9,-4 6,1 8,0 10,1.6 11.4,0" fill="#ffffff" opacity={0.9} />
        </G>
      );
    case 'volcan':
      return (
        <G>
          <Circle cx={4} cy={-19} r={3.5} fill="#cfcfcf" opacity={0.55} />
          <Circle cx={8} cy={-24} r={4.5} fill="#cfcfcf" opacity={0.4} />
          <Polygon points="-14,9 -5,-10 5,-10 14,9" fill={d} />
          <Polygon points="5,-10 14,9 6,9" fill="#000000" opacity={0.18} />
          <Ellipse cx={0} cy={-10} rx={5} ry={1.8} fill="#ff6a2b" />
          <Path d="M-1 -9 C -2 -4, 1 -1, -1 4" stroke="#ff8f3a" strokeWidth={2} strokeLinecap="round" fill="none" />
          <Ellipse cx={0} cy={-10.5} rx={2.6} ry={0.9} fill="#ffd25e" />
        </G>
      );
  }
}

export type IslandKind = 'own' | 'other' | 'free';

/** Shadow and surf under an island; drawn in a first pass so neighbours never cover each other. */
export function IslandBase({ x, y, s, c, kind }: { x: number; y: number; s: number; c: Palette; kind: IslandKind }) {
  if (kind === 'free') return null;
  return (
    <G>
      <Polygon points={hexPoints(x, y + s * 0.14, s * 0.92)} fill={c.shadow} />
      <Polygon points={hexPoints(x, y, s * 1.0)} fill={c.foam} opacity={0.32} />
    </G>
  );
}

export function Island({ x, y, s, c, biome, kind, seed, rar = 0, level = 0, flag, label }: {
  x: number; y: number; s: number; c: Palette; biome: Biome; kind: IslandKind; seed: number;
  rar?: number; level?: number; flag?: string; label?: string;
}) {
  const k = s / 30;
  const detail = s > 13;
  if (kind === 'free') {
    return (
      <G>
        <Polygon points={hexPoints(x, y, s * 0.9)} fill={c.biome[biome]} opacity={0.35} stroke="#ffffff" strokeWidth={1.6} strokeDasharray="4,4" />
        {detail && (
          <G opacity={0.92}>
            <Circle cx={x - s * 0.28} cy={y + s * 0.06} r={s * 0.26} fill="#ffffff" />
            <Circle cx={x + s * 0.02} cy={y - s * 0.1} r={s * 0.34} fill="#ffffff" />
            <Circle cx={x + s * 0.32} cy={y + s * 0.08} r={s * 0.24} fill="#ffffff" />
            <Polygon points={`${x - s * 0.5},${y + s * 0.1} ${x + s * 0.55},${y + s * 0.1} ${x + s * 0.5},${y + s * 0.32} ${x - s * 0.45},${y + s * 0.32}`} fill="#ffffff" />
          </G>
        )}
        {detail && (
          <SvgText x={x} y={y + s * 0.24} fontSize={s * 0.5} fill={c.seaDeep} textAnchor="middle" fontWeight="700" fontFamily="system-ui, sans-serif">?</SvgText>
        )}
      </G>
    );
  }
  const flip = seed % 2 ? -1 : 1;
  const legend = kind === 'own' && rar === 3;
  return (
    <G opacity={kind === 'other' ? 0.78 : 1}>
      <Polygon points={hexPoints(x, y, s * 0.92)} fill={c.sand} />
      <Polygon points={hexPoints(x, y - s * 0.03, s * 0.74)} fill={c.biome[biome]} />
      {detail && (
        <G transform={`translate(${x.toFixed(1)} ${(y - s * 0.04).toFixed(1)}) scale(${(k * flip * 0.82).toFixed(3)} ${(k * 0.82).toFixed(3)})`}>
          <Scenery biome={biome} c={c} v={seed} />
        </G>
      )}
      {legend && <Polygon points={hexPoints(x, y, s * 0.97)} fill="none" stroke={c.accent} strokeWidth={Math.max(1.5, s * 0.09)} opacity={0.95} />}
      {kind === 'own' && rar === 2 && <Polygon points={hexPoints(x, y, s * 0.95)} fill="none" stroke={c.epic} strokeWidth={Math.max(1.2, s * 0.06)} opacity={0.8} />}
      {detail && flag && (
        <G>
          <Path d={`M${x - s * 0.5} ${y + s * 0.18} V${y - s * 0.42}`} stroke="#5b3a1e" strokeWidth={Math.max(1, s * 0.05)} strokeLinecap="round" />
          <Polygon points={`${x - s * 0.5},${y - s * 0.42} ${x - s * 0.14},${y - s * 0.31} ${x - s * 0.5},${y - s * 0.2}`} fill={flag} stroke="#ffffff" strokeWidth={Math.max(0.6, s * 0.025)} />
          {label && (
            <SvgText x={x - s * 0.38} y={y - s * 0.26} fontSize={s * 0.16} fill="#ffffff" textAnchor="middle" fontWeight="700" fontFamily="system-ui, sans-serif">{label}</SvgText>
          )}
        </G>
      )}
      {detail && kind === 'own' && rar > 0 && (
        <G>
          {Array.from({ length: rar }, (_, i) => {
            const gx = x + (i - (rar - 1) / 2) * s * 0.24, gy = y + s * 0.62, r = s * 0.11;
            return <Polygon key={i} points={`${gx},${gy - r} ${gx + r * 0.8},${gy} ${gx},${gy + r} ${gx - r * 0.8},${gy}`} fill={RARITY_COLORS(c)[rar]} stroke="#ffffff" strokeWidth={Math.max(0.8, s * 0.035)} />;
          })}
        </G>
      )}
      {detail && level > 0 && (
        <G>
          <Polygon points={`${x + s * 0.42},${y - s * 0.48} ${x + s * 0.52},${y - s * 0.48} ${x + s * 0.57},${y + s * 0.05} ${x + s * 0.37},${y + s * 0.05}`} fill="#ffffff" stroke={c.bad} strokeWidth={Math.max(0.8, s * 0.03)} />
          <Path d={`M${x + s * 0.39} ${y - s * 0.2} H${x + s * 0.55}`} stroke={c.bad} strokeWidth={Math.max(1, s * 0.06)} />
          <Circle cx={x + s * 0.47} cy={y - s * 0.55} r={s * 0.07} fill={c.accent} />
          {Array.from({ length: level }, (_, i) => <Circle key={i} cx={x + s * 0.38 + i * s * 0.1} cy={y + s * 0.15} r={s * 0.035} fill={c.accent} />)}
        </G>
      )}
      {legend && detail && (
        <G>
          {[[-0.55, -0.55], [0.6, 0.35], [0.1, -0.78]].map(([dx, dy], i) => {
            const sx = x + dx * s, sy = y + dy * s, r = s * (i === 2 ? 0.1 : 0.08);
            return <Path key={i} d={`M${sx} ${sy - r * 2} Q${sx} ${sy} ${sx + r * 2} ${sy} Q${sx} ${sy} ${sx} ${sy + r * 2} Q${sx} ${sy} ${sx - r * 2} ${sy} Q${sx} ${sy} ${sx} ${sy - r * 2}z`} fill="#fff6c8" />;
          })}
        </G>
      )}
    </G>
  );
}

import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

type P = { size?: number; color?: string };

/** The game's premium currency: a little nacre pearl. */
export function PearlIcon({ size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="pearlG" cx="38%" cy="32%" r="70%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.45" stopColor="#f1e9ff" />
          <Stop offset="0.8" stopColor="#c8b4ec" />
          <Stop offset="1" stopColor="#9b84c9" />
        </RadialGradient>
      </Defs>
      <Circle cx="12" cy="12" r="10" fill="url(#pearlG)" />
      <Ellipse cx="8.5" cy="7.8" rx="3" ry="2" fill="#ffffff" opacity={0.9} />
    </Svg>
  );
}

/** The rent currency: a gold doubloon. */
export function CoinIcon({ size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10.5" fill="#c27c0e" />
      <Circle cx="12" cy="11.2" r="10" fill="#f2b225" />
      <Circle cx="12" cy="11.2" r="6.6" fill="none" stroke="#c98a12" strokeWidth={1.6} />
      <Path d="M10 7.8h2.2a3.4 3.4 0 0 1 0 6.8H10z" fill="none" stroke="#9a6406" strokeWidth={1.7} strokeLinejoin="round" />
      <Path d="M5.5 7.5a7.5 7.5 0 0 1 4-3.4" stroke="#fff6d5" strokeWidth={1.6} strokeLinecap="round" opacity={0.85} />
    </Svg>
  );
}

const stroke = (color: string) => ({ stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

export function IslandIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 19c3-2 6-2 9 0s6 2 9 0" {...stroke(color)} />
      <Path d="M5 16c1.5-2.5 4-3.5 7-3.5s5.5 1 7 3.5" {...stroke(color)} />
      <Path d="M12 12.5V6M12 6c-2-1.6-4.5-1.4-6 .2M12 6c2-1.6 4.5-1.4 6 .2M12 6c-.6-1.8.4-3.2 2-3.8" {...stroke(color)} />
    </Svg>
  );
}
export function BoltIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z" {...stroke(color)} />
    </Svg>
  );
}
export function ScrollIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 3.5h10a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H8A3 3 0 0 1 5 17.5V5.5a2 2 0 0 1 2-2z" {...stroke(color)} />
      <Path d="m8.5 9 1.5 1.5 3-3M8.5 15h7" {...stroke(color)} />
    </Svg>
  );
}
export function MoreIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[[7, 7], [17, 7], [7, 17], [17, 17]].map(([x, y]) => <Rect key={`${x}${y}`} x={x - 3.5} y={y - 3.5} width={7} height={7} rx={2.2} {...stroke(color)} />)}
    </Svg>
  );
}
export function TvIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="6" width="18" height="13" rx="3" {...stroke(color)} />
      <Path d="m9 2.5 3 3.5 3-3.5M10.5 10v5l4-2.5z" {...stroke(color)} />
    </Svg>
  );
}
export function ClipboardIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="4.5" width="14" height="17" rx="2.5" {...stroke(color)} />
      <Path d="M9 4.5V3.5h6v1M8.5 11h7M8.5 15h5" {...stroke(color)} />
    </Svg>
  );
}
export function BottleIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G transform="rotate(-35 12 12)">
        <Path d="M10 2.5h4M10.5 2.5v3.5c-2 1-3 2.5-3 4.5v9a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-9c0-2-1-3.5-3-4.5V2.5" {...stroke(color)} />
        <Path d="M10 12.5h4M10 15.5h3" {...stroke(color)} />
      </G>
    </Svg>
  );
}
export function ShellIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 20.5c-4.5 0-8-3.8-8-8.5 0-3.6 3.6-7.5 8-7.5s8 3.9 8 7.5c0 4.7-3.5 8.5-8 8.5z" {...stroke(color)} />
      <Path d="M12 20.5V4.5M12 20.5 6.5 7M12 20.5 17.5 7M12 20.5 4.3 11.5M12 20.5l7.7-9" {...stroke(color)} />
    </Svg>
  );
}
export function ShopIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 9 5 4h14l1.5 5c0 1.7-1.3 2.8-2.9 2.8S14.7 10.7 14.7 9c0 1.7-1.2 2.8-2.7 2.8S9.3 10.7 9.3 9c0 1.7-1.3 2.8-2.9 2.8S3.5 10.7 3.5 9z" {...stroke(color)} />
      <Path d="M5 12v8h14v-8M10 20v-4.5h4V20" {...stroke(color)} />
    </Svg>
  );
}
export function TrophyIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 3.5h10v5a5 5 0 0 1-10 0zM7 5.5H4v1.5a3 3 0 0 0 3 3M17 5.5h3v1.5a3 3 0 0 1-3 3M12 13.5v3.5M8 21h8l-1-4H9z" {...stroke(color)} />
    </Svg>
  );
}
export function BookIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5.5c2.5-1.3 5.3-1.3 8 .5 2.7-1.8 5.5-1.8 8-.5v13c-2.5-1.3-5.3-1.3-8 .5-2.7-1.8-5.5-1.8-8-.5zM12 6v13" {...stroke(color)} />
    </Svg>
  );
}
export function UserIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" {...stroke(color)} />
      <Path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" {...stroke(color)} />
    </Svg>
  );
}
export function FlameIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21.5c-4 0-6.5-2.6-6.5-6.2 0-3.6 2.8-5.6 3.8-9.3 1.6 1.4 2.3 3 2.3 4.6 1.3-.6 2.2-2 2.4-3.6 2.4 2 4.5 4.8 4.5 8.3 0 3.6-2.5 6.2-6.5 6.2z" {...stroke(color)} />
    </Svg>
  );
}
export function GiftIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3.5" y="8" width="17" height="4.5" rx="1.2" {...stroke(color)} />
      <Path d="M5 12.5V20h14v-7.5M12 8v12M12 8c-1-3.5-5.5-4.5-5.5-1.8C6.5 8 12 8 12 8zm0 0c1-3.5 5.5-4.5 5.5-1.8C17.5 8 12 8 12 8z" {...stroke(color)} />
    </Svg>
  );
}
export function LighthouseIcon({ size = 22, color = '#000' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.5 9h5l1.5 11.5H8zM9 9l.5-3h5l.5 3M12 3v3M10.6 13.5h2.8M9.9 17h4.2M5 6.5 3 5.5M19 6.5l2-1" {...stroke(color)} />
    </Svg>
  );
}

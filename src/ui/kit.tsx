import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { play } from '../services/feedback';
import { fonts, Palette } from './theme';

export function Btn({ c, label, onPress, disabled, kind = 'primary', small, style }: {
  c: Palette; label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary'; small?: boolean; style?: ViewStyle;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { play('tap'); onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        { backgroundColor: primary ? c.accent : 'transparent', borderColor: primary ? c.accent : c.line, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, small && { fontSize: 13 }, { color: primary ? c.accentInk : c.ink, fontFamily: fonts.body }]}>{label}</Text>
    </Pressable>
  );
}

export function T({ c, style, muted, children, num, display, ...rest }: {
  c: Palette; style?: TextStyle | TextStyle[]; muted?: boolean; num?: boolean; display?: boolean; children: React.ReactNode; selectable?: boolean; numberOfLines?: number;
}) {
  return (
    <Text
      {...rest}
      style={[{ color: muted ? c.muted : c.ink, fontFamily: num ? fonts.num : display ? fonts.display : fonts.body, fontSize: 14 }, style as TextStyle]}
    >
      {children}
    </Text>
  );
}

export function Progress({ c, value }: { c: Palette; value: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, height: '100%', backgroundColor: c.own }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  small: { paddingVertical: 8, paddingHorizontal: 12 },
  btnText: { fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
});

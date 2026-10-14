import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { play } from '../services/feedback';
import { fontFor, Palette } from './theme';

export function Btn({ c, label, onPress, disabled, kind = 'primary', small, style, icon }: {
  c: Palette; label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'teal'; small?: boolean; style?: ViewStyle; icon?: React.ReactNode;
}) {
  const bg = kind === 'primary' ? c.accent : kind === 'teal' ? c.own : c.card;
  const edge = kind === 'primary' ? c.accentDeep : kind === 'teal' ? '#0a5a62' : c.line;
  const ink = kind === 'primary' ? c.accentInk : kind === 'teal' ? '#ffffff' : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { play('tap'); onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        { backgroundColor: bg, borderBottomColor: edge, opacity: disabled ? 0.45 : 1 },
        pressed && !disabled && { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.btnText, fontFor('body', '700'), small && { fontSize: 13 }, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

export function T({ c, style, muted, children, num, display, ...rest }: {
  c: Palette; style?: TextStyle | TextStyle[]; muted?: boolean; num?: boolean; display?: boolean; children: React.ReactNode; selectable?: boolean; numberOfLines?: number;
}) {
  const flat = StyleSheet.flatten(style as TextStyle) ?? {};
  return (
    <Text
      {...rest}
      style={[{ color: muted ? c.muted : c.ink, fontSize: 14 }, flat, fontFor(num ? 'num' : display ? 'display' : 'body', flat.fontWeight)]}
    >
      {children}
    </Text>
  );
}

export function Progress({ c, value, color, height = 8 }: { c: Palette; value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? c.own }}>
        <View style={{ position: 'absolute', left: 3, right: 3, top: 1.5, height: Math.max(1, height / 4), borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </View>
    </View>
  );
}

/** A rounded panel used for every list item in the bottom sheet. */
export function Card({ c, children, style, highlight }: { c: Palette; children: React.ReactNode; style?: ViewStyle; highlight?: string }) {
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: highlight ?? 'transparent' }, style]}>
      {children}
    </View>
  );
}

/** Small round counter shown on a tab or button. */
export function Badge({ c, n }: { c: Palette; n: number | true }) {
  return (
    <View style={[styles.badge, { backgroundColor: c.bad, borderColor: c.panel }]}>
      {n !== true && <Text style={[{ color: '#fff', fontSize: 10 }, fontFor('body', '700')]}>{n}</Text>}
    </View>
  );
}

export function SwitchRow({ c, label, sub, value, onChange }: { c: Palette; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <T c={c}>{label}</T>
        {sub && <T c={c} muted style={{ fontSize: 12 }}>{sub}</T>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.own, false: c.line }} />
    </View>
  );
}

export function Field({ c, placeholder, initial = '', action, onSave, keyboard }: {
  c: Palette; placeholder: string; initial?: string; action: string; onSave: (v: string) => void; keyboard?: 'email-address';
}) {
  const [v, setV] = useState(initial);
  return (
    <View style={[styles.row, { gap: 8 }]}>
      <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={c.muted} autoCapitalize="none" keyboardType={keyboard}
        style={{ flex: 1, minWidth: 0, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: c.ink, ...fontFor('body', '400') }} />
      <Btn c={c} small label={action} disabled={!v.trim()} onPress={() => onSave(v.trim())} />
    </View>
  );
}
export const NameField = ({ c, initial, onSave }: { c: Palette; initial: string; onSave: (v: string) => void }) =>
  <Field c={c} placeholder="Votre nom de navigateur" initial={initial} action="Enregistrer" onSave={onSave} />;
export const EmailField = ({ c, onSave }: { c: Palette; onSave: (v: string) => void }) =>
  <><T c={c} muted style={{ fontSize: 13 }}>Ajoutez un e-mail pour retrouver votre partie sur un autre téléphone.</T>
    <Field c={c} placeholder="vous@exemple.fr" action="Sauvegarder" keyboard="email-address" onSave={onSave} /></>;
export const CodeField = ({ c, onSave }: { c: Palette; onSave: (v: string) => void }) =>
  <Field c={c} placeholder="Code d’un ami" action="Valider" onSave={onSave} />;

export const styles = StyleSheet.create({
  btn: { flexDirection: 'row', gap: 6, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 14, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  small: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  btnText: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: 16, padding: 12, borderWidth: 1.5 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

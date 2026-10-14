import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as R from '../game/rules';
import { CompassIcon, FlameIcon, GiftIcon, LockIcon, PearlIcon } from './icons';
import { Btn, T } from './kit';
import { Palette } from './theme';

type Info = ReturnType<typeof R.streakInfo>;
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Day of the 90-day cycle the next collection falls on. */
const cycleDay = (info: Info) => ((info.next - 1) % R.STREAK_CYCLE) + 1;

/**
 * Login calendar days with two lines per day, as in a season pass: the free reward and the
 * Pass Capitaine reward. The pass line is always shown, with a padlock when the pass is not active.
 */
function Days({ c, info, pass, days }: { c: Palette; info: Info; pass: boolean; days: number[] }) {
  const cur = cycleDay(info);
  const rows: number[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return (
    <View style={{ gap: 5 }}>
      {rows.map(row => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 4 }}>
          {row.map(d => {
            const done = d < cur;
            const today = d === cur && info.canClaim;
            const big = !!R.STREAK_MILESTONES[d];
            return (
              <View key={d} style={[st.cell, { borderColor: today ? c.accentDeep : big ? c.epic : c.line, backgroundColor: c.panel }]}>
                <View style={[st.half, { backgroundColor: done ? c.accent : 'transparent' }]}>
                  <T c={c} style={{ fontSize: 9, fontWeight: '700', color: done ? c.accentInk : c.muted }}>J{d}</T>
                  {big ? <GiftIcon size={14} color={done ? c.accentInk : c.epic} /> : <PearlIcon size={12} />}
                  <T c={c} num style={{ fontSize: 10, color: done ? c.accentInk : c.ink }}>+{R.streakReward(d)}</T>
                </View>
                <View style={[st.half, st.passHalf, { backgroundColor: pass ? (done ? c.epic : 'rgba(124,77,219,0.14)') : c.card }]}>
                  {pass ? <CompassIcon size={11} color={done ? '#fff' : c.epic} /> : <LockIcon size={11} color={c.muted} />}
                  <T c={c} num style={{ fontSize: 10, fontWeight: '700', color: pass ? (done ? '#fff' : c.epic) : c.muted }}>+{R.passStreakReward(d)}</T>
                </View>
              </View>
            );
          })}
          {row.length < 7 && Array.from({ length: 7 - row.length }, (_, i) => <View key={`x${i}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

function Legend({ c, pass }: { c: Palette; pass: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      <View style={st.legend}><PearlIcon size={12} /><T c={c} muted style={{ fontSize: 11 }}>Gratuit</T></View>
      <View style={st.legend}>
        {pass ? <CompassIcon size={12} color={c.epic} /> : <LockIcon size={12} color={c.muted} />}
        <T c={c} muted style={{ fontSize: 11 }}>{pass ? 'Pass Capitaine actif' : 'Pass Capitaine (verrouillé)'}</T>
      </View>
    </View>
  );
}

/** Compact card for the Quests tab: the current week of the cycle. */
export function StreakWeek({ c, info, pass, onOpen }: { c: Palette; info: Info; pass: boolean; onOpen: () => void }) {
  const cur = cycleDay(info);
  const start = Math.floor((cur - 1) / 7) * 7 + 1;
  const days = Array.from({ length: Math.min(7, R.STREAK_CYCLE - start + 1) }, (_, i) => start + i);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <FlameIcon size={18} color="#e2694f" />
        <T c={c} style={{ fontWeight: '700', flex: 1 }}>Bonus de connexion · série de {plural(info.count, 'jour')}</T>
      </View>
      <Legend c={c} pass={pass} />
      <Days c={c} info={info} pass={pass} days={days} />
      {info.locked
        ? <T c={c} style={{ fontSize: 13, fontWeight: '700' }}>Débloqué avec {R.STREAK_MIN_TILES} îlots.</T>
        : info.canClaim
          ? <Btn c={c} small icon={<PearlIcon size={16} />} label={`Récupérer · jour ${info.next} · +${plural(info.reward, 'perle')}`} onPress={onOpen} />
          : <T c={c} style={{ fontSize: 13, fontWeight: '700', color: c.good }}>Bonus du jour récupéré ✓ Revenez demain.</T>}
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <T c={c} style={{ color: c.own, fontWeight: '700', fontSize: 13 }}>Voir les {R.STREAK_CYCLE} jours →</T>
      </Pressable>
    </View>
  );
}

/** Full calendar: all 90 days, free and pass lines, with the claim and pass buttons. */
export function StreakPanel({ c, info, pass, onClaim, onPass, onClose }: {
  c: Palette; info: Info; pass: boolean; onClaim: () => void; onPass: () => void; onClose: () => void;
}) {
  const cur = cycleDay(info);
  const scroll = useRef<ScrollView>(null);
  const days = Array.from({ length: R.STREAK_CYCLE }, (_, i) => i + 1);
  const passTotal = days.reduce((a, d) => a + R.passStreakReward(d), 0);
  const ROW = 63; // cell height + gap, to open the grid on the current week
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,22,29,0.5)', alignItems: 'center', justifyContent: 'center', padding: 14 }]}>
      <View style={[st.panel, { backgroundColor: c.panel, borderColor: c.accent }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[st.disc, { backgroundColor: '#e2694f' }]}><FlameIcon size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <T c={c} display style={{ fontWeight: '700', fontSize: 16 }}>Bonus de connexion</T>
            <T c={c} muted style={{ fontSize: 12 }}>
              {info.locked ? `Se débloque avec ${R.STREAK_MIN_TILES} îlots.` : info.canClaim ? `Jour ${info.next} à récupérer.` : `Série de ${plural(info.count, 'jour')} · revenez demain.`}
            </T>
          </View>
        </View>
        <Legend c={c} pass={pass} />
        <ScrollView ref={scroll} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingVertical: 2 }}
          onLayout={() => scroll.current?.scrollTo({ y: Math.max(0, Math.floor((cur - 1) / 7) - 1) * ROW, animated: false })}>
          <Days c={c} info={info} pass={pass} days={days} />
        </ScrollView>
        <T c={c} muted style={{ fontSize: 11 }}>
          {info.broken ? 'Série interrompue : elle repart au jour 1. ' : ''}Un jour manqué et la série repart au jour 1. Après le jour {R.STREAK_CYCLE}, le cycle recommence.
        </T>
        {!pass && (
          <Pressable accessibilityRole="button" onPress={onPass} style={[st.passCta, { borderColor: c.epic }]}>
            <LockIcon size={16} color={c.epic} />
            <T c={c} style={{ flex: 1, fontSize: 12 }}>
              <T c={c} style={{ fontSize: 12, fontWeight: '700', color: c.epic }}>Débloquer la ligne Pass</T> : {passTotal} perles en plus sur {R.STREAK_CYCLE} jours avec le {R.PASS.name} ({R.PASS.price} / mois).
            </T>
          </Pressable>
        )}
        {info.canClaim
          ? <Btn c={c} icon={<PearlIcon size={18} />} label={`Récupérer +${plural(info.reward, 'perle')}`} onPress={onClaim} />
          : null}
        <Btn c={c} kind="secondary" label={info.canClaim ? 'Plus tard' : 'Fermer'} onPress={onClose} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  panel: { borderRadius: 24, borderWidth: 2, padding: 16, gap: 10, width: '100%', maxWidth: 420, maxHeight: '100%' },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cell: { flex: 1, borderRadius: 10, borderWidth: 2, overflow: 'hidden' },
  half: { alignItems: 'center', paddingVertical: 3, gap: 1 },
  passHalf: { flexDirection: 'row', justifyContent: 'center', gap: 2, paddingVertical: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  passCta: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 8 },
});

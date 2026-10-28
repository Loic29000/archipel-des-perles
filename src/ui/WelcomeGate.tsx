import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LegalId } from '../legal/texts';
import { PearlIcon } from './icons';
import { Btn, Check, T } from './kit';
import { LegalView } from './LegalView';
import { fontFor, Palette } from './theme';

export type AgeGroup = 'minor' | 'adult';

/**
 * First launch: a neutral age screen (birth year, nothing hints at the threshold) and acceptance of the terms.
 * Only the age group is kept, not the year. When only the terms changed, the age question is skipped.
 */
export function WelcomeGate({ c, ageGroup, onDone }: { c: Palette; ageGroup: AgeGroup | null; onDone: (age: AgeGroup) => void }) {
  const [year, setYear] = useState('');
  const [agree, setAgree] = useState(false);
  const [doc, setDoc] = useState<LegalId | null>(null);
  const thisYear = new Date().getFullYear();
  const y = Number(year);
  const yearOk = year.length === 4 && y >= thisYear - 120 && y <= thisYear;
  const askAge = ageGroup === null;
  const link = (id: LegalId, label: string) => (
    <Text accessibilityRole="link" onPress={() => setDoc(id)} style={[{ color: c.own, textDecorationLine: 'underline' }, fontFor('body', '700')]}>{label}</Text>
  );
  if (doc) return <LegalView c={c} id={doc} onBack={() => setDoc(null)} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.sea }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <View style={[st.card, { backgroundColor: c.panel, borderColor: c.accent }]}>
            <View style={{ alignSelf: 'center' }}><PearlIcon size={56} /></View>
            <T c={c} display style={{ fontWeight: '700', fontSize: 20, textAlign: 'center' }}>{askAge ? 'Bienvenue à bord' : 'Nos conditions ont changé'}</T>
            <T c={c} muted style={{ textAlign: 'center', lineHeight: 20 }}>
              {askAge ? 'Avant de lever l’ancre, deux petites choses.' : 'Merci de les relire et de les accepter pour continuer à jouer.'}
            </T>
            {askAge && (
              <View style={{ gap: 6 }}>
                <T c={c} style={{ fontWeight: '700' }}>Votre année de naissance</T>
                <TextInput value={year} onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="AAAA" keyboardType="number-pad" maxLength={4}
                  accessibilityLabel="Année de naissance" placeholderTextColor={c.muted}
                  style={[st.input, fontFor('num', '700'), { color: c.ink, backgroundColor: c.card, borderColor: year && !yearOk ? c.bad : c.line }]} />
                <T c={c} muted style={{ fontSize: 12 }}>Elle sert seulement à adapter les publicités et les achats à votre âge. Elle n’est pas enregistrée.</T>
              </View>
            )}
            <Check c={c} value={agree} onChange={setAgree}>
              <Text style={[{ color: c.ink, fontSize: 14, lineHeight: 20 }, fontFor('body', '400')]}>
                J’ai lu et j’accepte les {link('cgu', 'conditions d’utilisation')} et la {link('confidentialite', 'politique de confidentialité')}.
              </Text>
            </Check>
            <T c={c} muted style={{ fontSize: 12 }}>Les plus jeunes : lisez-les avec un parent.</T>
            <Btn c={c} label="Commencer" disabled={!agree || (askAge && !yearOk)}
              onPress={() => onDone(askAge ? (thisYear - y <= 15 ? 'minor' : 'adult') : ageGroup)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 2, padding: 20, gap: 14, width: '100%', maxWidth: 400, alignSelf: 'center' },
  input: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, letterSpacing: 3, width: 120 },
});

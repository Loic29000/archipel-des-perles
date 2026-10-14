import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEGAL_DOCS, LegalId } from '../legal/texts';
import { BackIcon } from './icons';
import { T } from './kit';
import { Palette } from './theme';

/** Full-screen reader for one legal document. */
export function LegalView({ c, id, onBack }: { c: Palette; id: LegalId; onBack: () => void }) {
  const doc = LEGAL_DOCS[id];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <View style={st.wrap}>
          <View style={st.head}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack} style={[st.back, { backgroundColor: c.card }]}>
              <BackIcon size={20} color={c.ink} />
            </Pressable>
            <T c={c} display style={{ fontWeight: '700', fontSize: 17, flex: 1 }}>{doc.title}</T>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
            {doc.intro && <T c={c} style={st.p}>{doc.intro}</T>}
            {doc.sections.map(sec => (
              <View key={sec.h} style={{ gap: 6 }}>
                <T c={c} style={{ fontWeight: '700', fontSize: 15 }}>{sec.h}</T>
                {sec.body.map((b, i) => typeof b === 'string'
                  ? <T key={i} c={c} muted style={st.p} selectable>{b}</T>
                  : <View key={i} style={{ gap: 4 }}>{b.map(li => (
                      <View key={li} style={{ flexDirection: 'row', gap: 8 }}>
                        <T c={c} muted style={st.p}>•</T><T c={c} muted style={[st.p, { flex: 1 }]} selectable>{li}</T>
                      </View>
                    ))}</View>)}
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  p: { fontSize: 14, lineHeight: 21 },
});

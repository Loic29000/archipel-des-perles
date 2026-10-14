import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Account } from '../backend/types';
import * as R from '../game/rules';
import { BIOMES } from '../game/world';
import { LEGAL_DOCS, LegalId } from '../legal/texts';
import { BackIcon, GearIcon, InfoIcon } from './icons';
import { Btn, Card, EmailField, NameField, SwitchRow, T } from './kit';
import { LegalView } from './LegalView';
import { Palette, RARITY_COLORS, ThemeMode } from './theme';
import type { AgeGroup } from './WelcomeGate';

export interface Settings {
  sound: boolean; haptics: boolean; notifications: boolean; tutorialDone: boolean; theme: ThemeMode;
  /** Set by the first-launch age screen; the birth year itself is not kept. */
  ageGroup: AgeGroup | null;
  /** Version of the terms the player accepted (0: none yet). */
  terms: number;
}
export type SettingsPage = 'settings' | 'info';

const fmt = (n: number, d: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

interface Privacy { adChoices: boolean; onAdChoices: () => void; onExport: () => Promise<void> }

export function SettingsScreen({ c, page: initial, settings, onChange, account, online, username, demo, onToggleDemo, onTutorial, onRename, onLinkEmail, onReset, onClose, privacy }: {
  c: Palette; page: SettingsPage; settings: Settings; onChange: (patch: Partial<Settings>) => void;
  account: Account; online: boolean; username: string;
  demo: { available: boolean; on: boolean } ; onToggleDemo: () => void; onTutorial: () => void;
  onRename: (name: string) => void; onLinkEmail: (email: string) => void; onReset: () => Promise<void>; onClose: () => void;
  privacy: Privacy;
}) {
  const [page, setPage] = useState<SettingsPage>(initial);
  const [doc, setDoc] = useState<LegalId | null>(null);
  if (doc) return <LegalView c={c} id={doc} onBack={() => setDoc(null)} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <View style={st.wrap}>
          <View style={st.head}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour au jeu" onPress={onClose} style={[st.back, { backgroundColor: c.card }]}>
              <BackIcon size={20} color={c.ink} />
            </Pressable>
            <T c={c} display style={{ fontWeight: '700', fontSize: 18, flex: 1 }}>{page === 'settings' ? 'Paramètres' : 'Infos'}</T>
          </View>
          <View style={[st.seg, { backgroundColor: c.card }]}>
            {([['settings', 'Paramètres', GearIcon], ['info', 'Infos', InfoIcon]] as const).map(([id, label, Icon]) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: page === id }} onPress={() => setPage(id)}
                style={[st.segBtn, page === id && { backgroundColor: c.panel }]}>
                <Icon size={17} color={page === id ? c.ink : c.muted} />
                <T c={c} style={{ fontWeight: '700', fontSize: 13, color: page === id ? c.ink : c.muted }}>{label}</T>
              </Pressable>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {page === 'settings'
              ? <SettingsPanel {...{ c, settings, onChange, account, online, username, demo, onToggleDemo, onTutorial, onRename, onLinkEmail, onReset, privacy, onDoc: setDoc }} />
              : <InfoPanel c={c} online={online} account={account} onDoc={setDoc} />}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Section({ c, title, children }: { c: Palette; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T c={c} muted style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4 }}>{title.toUpperCase()}</T>
      <Card c={c} style={{ gap: 12 }}>{children}</Card>
    </View>
  );
}

function SettingsPanel({ c, settings, onChange, account, online, username, demo, onToggleDemo, onTutorial, onRename, onLinkEmail, onReset, privacy, onDoc }: {
  c: Palette; settings: Settings; onChange: (patch: Partial<Settings>) => void; account: Account; online: boolean; username: string;
  demo: { available: boolean; on: boolean }; onToggleDemo: () => void; onTutorial: () => void;
  onRename: (name: string) => void; onLinkEmail: (email: string) => void; onReset: () => Promise<void>;
  privacy: Privacy; onDoc: (id: LegalId) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <Section c={c} title="Son et vibrations">
        <SwitchRow c={c} label="Sons" value={settings.sound} onChange={v => onChange({ sound: v })} />
        <SwitchRow c={c} label="Vibrations" sub={Platform.OS === 'web' ? 'Sur les téléphones compatibles' : undefined} value={settings.haptics} onChange={v => onChange({ haptics: v })} />
      </Section>

      <Section c={c} title="Rappels">
        {Platform.OS === 'web'
          ? <T c={c} muted style={{ fontSize: 13 }}>Les rappels (boost terminé, pub disponible, série du jour) arrivent dans l’application mobile.</T>
          : <SwitchRow c={c} label="Notifications" sub="Boost terminé, pub disponible, série du jour" value={settings.notifications} onChange={v => onChange({ notifications: v })} />}
      </Section>

      <Section c={c} title="Apparence">
        <T c={c}>Thème</T>
        <View style={[st.seg, { backgroundColor: c.paper }]}>
          {([['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']] as const).map(([id, label]) => (
            <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: settings.theme === id }} onPress={() => onChange({ theme: id })}
              style={[st.segBtn, settings.theme === id && { backgroundColor: c.accent }]}>
              <T c={c} style={{ fontWeight: '700', fontSize: 13, color: settings.theme === id ? c.accentInk : c.muted }}>{label}</T>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section c={c} title="Jeu">
        {demo.available && <SwitchRow c={c} label="Mode démo" sub="1 s = 10 min, partie séparée" value={demo.on} onChange={onToggleDemo} />}
        <Btn c={c} small kind="secondary" label="Revoir le tutoriel" onPress={onTutorial} style={{ alignSelf: 'flex-start' }} />
      </Section>

      <Section c={c} title="Vie privée">
        <T c={c} muted style={{ fontSize: 13 }}>
          {settings.ageGroup === 'minor'
            ? 'Profil moins de 15 ans : publicités non personnalisées, accord parental demandé pour les achats.'
            : Platform.OS === 'web' ? 'La version web n’affiche pas de vraie publicité et ne dépose aucun traceur.' : 'Vous choisissez si les publicités peuvent être personnalisées.'}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {privacy.adChoices && <Btn c={c} small kind="secondary" label="Gérer mes choix publicitaires" onPress={privacy.onAdChoices} />}
          <Btn c={c} small kind="secondary" label={exporting ? 'Préparation…' : 'Télécharger mes données'} disabled={exporting}
            onPress={async () => { setExporting(true); try { await privacy.onExport(); } finally { setExporting(false); } }} />
        </View>
        <Pressable accessibilityRole="link" onPress={() => onDoc('confidentialite')}>
          <T c={c} style={{ color: c.own, fontWeight: '700', fontSize: 13 }}>Politique de confidentialité</T>
        </Pressable>
      </Section>

      <Section c={c} title="Compte">
        <T c={c} muted style={{ fontSize: 12 }}>Nom de navigateur</T>
        <NameField c={c} initial={username} onSave={onRename} />
        {online
          ? account.anonymous
            ? <EmailField c={c} onSave={onLinkEmail} />
            : <T c={c} muted style={{ fontSize: 13 }}>Partie sauvegardée sur le serveur · {account.email}</T>
          : <T c={c} muted style={{ fontSize: 13 }}>Partie enregistrée sur cet appareil uniquement.</T>}
        {!confirm ? (
          <Pressable accessibilityRole="button" onPress={() => setConfirm(true)}>
            <T c={c} style={{ color: c.bad, fontWeight: '700', fontSize: 13 }}>{online ? 'Supprimer mon compte' : 'Effacer ma partie'}</T>
          </Pressable>
        ) : (
          <View style={{ gap: 8, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: c.bad }}>
            <T c={c} style={{ fontSize: 13 }}>
              {online
                ? 'Votre compte, vos îlots, vos perles et vos doublons seront supprimés définitivement du serveur. Une nouvelle partie démarrera.'
                : `Vos îlots, perles et doublons${demo.on ? ' de la partie démo' : ''} seront effacés de cet appareil. Une nouvelle partie démarrera.`}
            </T>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn c={c} small label={resetting ? 'Suppression…' : 'Supprimer définitivement'} disabled={resetting}
                style={{ backgroundColor: c.bad, borderBottomColor: '#7a2418' }}
                onPress={async () => { setResetting(true); try { await onReset(); } finally { setResetting(false); setConfirm(false); } }} />
              <Btn c={c} small kind="secondary" label="Annuler" onPress={() => setConfirm(false)} />
            </View>
          </View>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- info
function Rule({ c, title, children, open: start }: { c: Palette; title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(!!start);
  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(o => !o)} style={st.ruleHead}>
        <T c={c} style={{ fontWeight: '700', flex: 1 }}>{title}</T>
        <T c={c} muted style={{ fontSize: 16, fontWeight: '700' }}>{open ? '−' : '+'}</T>
      </Pressable>
      {open && <View style={{ gap: 6 }}>{children}</View>}
    </View>
  );
}
const P = ({ c, children }: { c: Palette; children: React.ReactNode }) => <T c={c} muted style={{ fontSize: 13, lineHeight: 19 }}>{children}</T>;

function InfoPanel({ c, online, account, onDoc }: { c: Palette; online: boolean; account: Account; onDoc: (id: LegalId) => void }) {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  let lo = 1;
  const tiers = R.TIERS.map(([max, m]) => { const t = `${max === Infinity ? `${lo} et plus` : `${lo} à ${max}`} îlots : ×${m}`; lo = max + 1; return t; });
  return (
    <>
      <Section c={c} title="Règles du jeu">
        <Rule c={c} title="Îlots" open>
          <P c={c}>Votre premier îlot est gratuit, les suivants coûtent {R.ISLAND_PRICE} perles. Un nouvel îlot doit toucher votre archipel. Le monde est infini : chaque achat fait apparaître de nouveaux îlots dans la brume.</P>
        </Rule>
        <Rule c={c} title="Rareté et rente">
          <P c={c}>La rareté reste secrète jusqu’à l’achat. Chaque îlot rapporte des doublons à la seconde, même application fermée.</P>
          {R.RARITIES.map((r, i) => (
            <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RARITY_COLORS(c)[i] }} />
              <T c={c} style={{ fontSize: 13, fontWeight: '700', width: 82 }}>{r.name}</T>
              <T c={c} muted style={{ fontSize: 12, width: 40 }}>{Math.round(r.odds * 100)} %</T>
              <T c={c} num style={{ fontSize: 12, flex: 1, textAlign: 'right' }}>{fmt(r.rent * 86400, 8)} / jour</T>
            </View>
          ))}
        </Rule>
        <Rule c={c} title="Perles">
          <P c={c}>Une publicité toutes les 20 minutes rapporte 1 perle. Un sondage de 3 questions rapporte 3 perles toutes les 2 heures. La pêche aux bouteilles et la mémoire des coquillages rapportent jusqu’à 3 perles chacune, une fois par heure, après une courte publicité.</P>
        </Rule>
        <Rule c={c} title="Boost">
          <P c={c}>Chaque publicité de boost ajoute 1 heure, jusqu’à 6 heures en réserve. Pendant le boost, votre rente est multipliée selon la taille de votre archipel :</P>
          <P c={c}>{tiers.join(' · ')}</P>
          <P c={c}>Tous les 15 jours, un super boost de 32 heures fait compter vos heures de boost ×{R.SUPER_MULT}.</P>
        </Rule>
        <Rule c={c} title="Doublons, comptoir et phares">
          <P c={c}>Au comptoir, 1 perle coûte {fmt(R.PEARL_PRICE, 4)} doublon. Les drapeaux colorent votre archipel. Un phare ajoute +10 % de rente à un îlot, jusqu’à {R.MAX_LEVEL} phares par îlot.</P>
        </Rule>
        <Rule c={c} title="Passeport">
          <P c={c}>Les carnets se gagnent en explorant tous les biomes ({Object.values(BIOMES).join(', ').toLowerCase()}), en agrandissant votre archipel et en trouvant des raretés. Ils donnent un bonus de rente permanent : +5 % dès le premier carnet, puis +10 % à partir de 11 carnets.</P>
        </Rule>
        <Rule c={c} title="Événements">
          <P c={c}>Tous les 14 jours, un événement de 4 jours fait apparaître une créature près de votre archipel. Touchez-la pour gagner des perles, une fois par heure.</P>
          {R.EVENTS.map(e => <P key={e.id} c={c}>{e.name} : {e.desc}</P>)}
        </Rule>
        <Rule c={c} title="Succès et décorations">
          <P c={c}>Chaque succès débloqué (biomes, taille de l’archipel, raretés, série, phares, décorations, créatures) rapporte des perles une fois. Les décorations (cabane, voilier, mouettes, coffre, tortue) s’achètent en doublons et s’affichent sur la carte.</P>
        </Rule>
        <Rule c={c} title="Achats">
          <P c={c}>Des packs de perles sont proposés au comptoir, avec leur prix en euros et le prix pour 100 perles. Un îlot de {R.ISLAND_PRICE} perles vaut ainsi {R.pearlsInEuros(R.ISLAND_PRICE)} si les perles sont achetées, mais toutes les perles s’obtiennent aussi gratuitement en jouant.</P>
          <P c={c}>Les perles sont livrées tout de suite : en confirmant un achat, vous renoncez au délai de rétractation de 14 jours. Les joueurs de moins de 15 ans confirment l’accord d’un parent. Pour l’instant les achats sont en mode test : aucun paiement n’est demandé.</P>
        </Rule>
        <Rule c={c} title="Bonus de connexion, quêtes et biome de la semaine">
          <P c={c}>Trois quêtes du jour rapportent des perles. Dès 3 îlots, le calendrier de connexion donne 1 perle par jour à récupérer, et des gros bonus aux jours 7 (5 perles), 14 et 21 (10), 30 et 45 (25), 60 et 75 (50) et 90 (200), puis le cycle recommence. Un jour sans récupérer le bonus et la série repart au jour 1. Chaque semaine, un biome à l’honneur rapporte +25 %.</P>
        </Rule>
      </Section>

      <Section c={c} title="Confidentialité">
        <P c={c}>{online
          ? 'Votre partie est enregistrée sur le serveur du jeu avec un compte anonyme. L’e-mail n’est demandé que si vous voulez retrouver votre partie sur un autre appareil.'
          : 'Votre partie est enregistrée uniquement sur cet appareil. Rien n’est envoyé à un serveur.'}</P>
        <P c={c}>Le jeu n’utilise pas votre position : l’archipel est un monde imaginaire. Les publicités de l’application mobile sont fournies par Google AdMob, selon vos choix.</P>
        <P c={c}>Téléchargez vos données ou supprimez votre compte à tout moment dans Paramètres.</P>
      </Section>

      <Section c={c} title="Documents">
        {(['confidentialite', 'cgu', 'mentions-legales', 'suppression-compte'] as const).map(id => (
          <Pressable key={id} accessibilityRole="link" onPress={() => onDoc(id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T c={c} style={{ flex: 1, fontWeight: '600' }}>{LEGAL_DOCS[id].title}</T>
            <T c={c} muted style={{ fontSize: 16, fontWeight: '700' }}>›</T>
          </Pressable>
        ))}
      </Section>

      <Section c={c} title="Crédits">
        <P c={c}>Archipel des Perles : conception, illustrations et code originaux.</P>
        <P c={c}>Polices Unbounded et Figtree sous licence SIL Open Font License, intégrées à l’application. Construit avec Expo, React Native et react-native-svg{online ? ', serveur Supabase' : ''}.</P>
      </Section>

      <Section c={c} title="À propos">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T c={c} muted style={{ fontSize: 13 }}>Version</T><T c={c} num style={{ fontSize: 13 }}>{version}</T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T c={c} muted style={{ fontSize: 13 }}>Sauvegarde</T><T c={c} style={{ fontSize: 13 }}>{online ? 'En ligne' : 'Sur cet appareil'}</T>
        </View>
        {account.userId && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T c={c} muted style={{ fontSize: 13 }}>Identifiant joueur</T><T c={c} num selectable style={{ fontSize: 12 }}>{account.userId.slice(0, 8)}</T>
          </View>
        )}
      </Section>
    </>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11 },
  ruleHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
});

# Archipel des Perles

Jeu mobile idle : on acquiert des îlots hexagonaux sur un archipel infini, leur rareté est tirée au sort à l'achat, et ils rapportent des doublons à la seconde. L'économie reprend les chiffres publics d'Atlas Earth (rente par rareté, paliers de boost, super boost ×50, passeport), sans carte réelle ni argent réel.

Application Expo (React Native) pour iOS, Android et le web, avec un serveur Supabase qui fait autorité sur les règles.

## Ce qu'il y a dedans

| Domaine | Fichiers |
| --- | --- |
| Règles du jeu (fonctions pures) | `src/game/rules.ts`, `src/game/world.ts` |
| Mode hors ligne / démo (règles sur l'appareil) | `src/backend/local.ts` |
| Mode en ligne (comptes, sauvegarde, anti-triche) | `src/backend/online.ts`, `supabase/migrations/` |
| Paramètres et infos (règles, confidentialité, suppression du compte) | `src/ui/SettingsScreen.tsx` |
| Vérification des pubs AdMob côté serveur | `supabase/functions/admob-ssv/index.ts` |
| Pubs, notifications, sons, vibrations | `src/services/*.native.ts` (mobile) et `src/services/*.ts` (web) |
| Écran, carte, mini-jeux, tutoriel | `App.tsx`, `src/ui/` |

Fonctionnalités : quêtes du jour, bonus de connexion façon Atlas Earth (dès 3 îlots, à récupérer chaque jour, 1 perle par jour et gros bonus aux jours 7, 14, 21, 30, 45, 60, 75 et 90 sur un cycle de 90 jours, remis à zéro si un jour est manqué), biome à l'honneur chaque semaine (+25 %), comptoir (doublons → perles, phares +10 % par niveau, drapeaux), classement, voisins visibles sur la carte, parrainage (+10 perles chacun), tutoriel, animation de révélation, sons, vibrations, rappels locaux, mode démo (1 s = 10 min).

## Lancer en local

```bash
npm install
npm run web            # version navigateur, pubs simulées, partie enregistrée dans le navigateur
npm run typecheck
npm run test:sql       # rejoue la migration Supabase dans un Postgres embarqué et teste chaque fonction
```

Sans fichier `.env`, le jeu tourne entièrement sur l'appareil. Les pubs AdMob et les notifications demandent un build de développement (pas Expo Go) :

```bash
npx eas-cli@latest build --profile development --platform android   # ou ios
npx expo start --dev-client
```

## Passer en ligne (Supabase)

1. Créez un projet sur supabase.com.
2. Dans Authentication > Providers, activez **Anonymous sign-ins** (les joueurs démarrent sans inscription) et **Email** (pour sauvegarder leur partie).
3. Exécutez les fichiers de `supabase/migrations/` dans l'ordre (`0001_init.sql`, `0002_delete_account.sql`, `0003_engagement.sql`, `0004_privacy.sql`, `0005_login_calendar.sql`) dans l'éditeur SQL, ou `supabase db push` avec la CLI. Créez le projet dans une région de l'Union européenne (Francfort).
4. Copiez `.env.example` en `.env` et renseignez l'URL et la clé `anon` du projet.

Toutes les écritures passent par des fonctions SQL qui utilisent l'horloge du serveur : un joueur ne peut ni modifier ses perles, ni sauter un délai, ni choisir sa rareté. Le biome de chaque îlot est recalculé côté serveur avec le même bruit que le client (`biome_at`, testé par `npm run test:sql`).

## Vraies publicités (AdMob)

1. Créez une app et un bloc d'annonces **avec récompense** dans AdMob, pour Android et pour iOS.
2. Remplacez les identifiants d'app de test dans `app.json` (plugin `react-native-google-mobile-ads`) et mettez les blocs d'annonces dans `.env`.
3. Déployez la vérification serveur : `supabase functions deploy admob-ssv --no-verify-jwt`, puis collez `https://<projet>.supabase.co/functions/v1/admob-ssv` dans les réglages « validation côté serveur » du bloc d'annonces.
4. Activez l'exigence : `update app_config set require_ssv = true;` À partir de là, une récompense n'est versée que si Google a confirmé la pub.

En développement, l'app utilise automatiquement les pubs de test de Google.

## Légal (RGPD, CGU, consentement)

Voir [LEGAL.md](LEGAL.md) : ce qui est en place (âge, consentement publicitaire, export et suppression des données, règles d'achat), les textes à compléter dans `src/legal/texts.ts`, les pages web générées par `npm run legal` dans `docs/`, et les déclarations des stores dans `store/declarations.md`.

## Publier sur les stores

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform all
```

Avant : changez `bundleIdentifier` et `package` dans `app.json` (actuellement `com.example.archipeldesperles`), remplacez les icônes dans `assets/`, et préparez une politique de confidentialité (pubs, e-mail, identifiant publicitaire).

## Équilibrage

Tous les chiffres sont en tête de `src/game/rules.ts` et dupliqués dans la migration SQL. Changez-les aux deux endroits, puis lancez `npm run test:sql`.

## Succès, événements, décorations et achats

- **Succès** (`ACHIEVEMENTS` dans `src/game/rules.ts`) : chaque succès débloqué rapporte des perles une fois.
- **Événements** (`EVENTS`) : 4 jours tous les 14 jours, en rotation. Une créature apparaît près de l'archipel et rapporte des perles une fois par heure.
- **Décorations** (`DECOS`) : achetées en doublons, visibles sur la carte. La tortue se débloque en attrapant une créature.
- **Récap au retour** : à l'ouverture, le jeu affiche ce que les îlots ont rapporté pendant l'absence.
- **Achats intégrés** (`PRODUCTS`) : packs de perles, **en mode test** (aucun paiement).
  Côté serveur, `test_purchase` ne marche que si `app_config.iap_test` vaut `true`.
  Pour passer en réel : créer les produits sur App Store Connect et Google Play Console, ajouter une bibliothèque d'achats (par exemple `expo-iap`), vérifier chaque reçu dans une fonction serveur qui appelle `g_grant_purchase`, puis passer `iap_test` à `false`.


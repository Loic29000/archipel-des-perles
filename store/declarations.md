# Déclarations à remplir dans les stores

Réponses préparées pour la configuration actuelle du jeu : compte en ligne Supabase, publicités Google AdMob, achats intégrés.
Si le jeu est publié sans serveur (partie sur l'appareil uniquement), les lignes « compte » disparaissent mais celles d'AdMob restent.

## Google Play : Sécurité des données (Data safety)

**Questions générales**

| Question | Réponse |
| --- | --- |
| L'application collecte-t-elle ou partage-t-elle des données ? | Oui |
| Toutes les données sont-elles chiffrées en transit ? | Oui (HTTPS) |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | Oui, dans l'application et via l'URL de suppression |
| URL de suppression du compte | `<site>/suppression-compte.html` |
| URL de la politique de confidentialité | `<site>/confidentialite.html` |

**Types de données**

| Catégorie Google | Donnée | Collectée | Partagée | Finalités | Facultative |
| --- | --- | --- | --- | --- | --- |
| Informations personnelles | Adresse e-mail | Oui | Non | Fonctionnalités de l'appli, gestion du compte | Oui |
| Informations personnelles | ID utilisateur (compte anonyme) | Oui | Non | Fonctionnalités, gestion du compte, prévention des fraudes | Non |
| Informations financières | Historique d'achats | Oui | Non | Fonctionnalités de l'appli | Non |
| Activité dans l'appli | Interactions avec l'appli (partie, quêtes, mini-jeux) | Oui | Non | Fonctionnalités de l'appli | Non |
| Activité dans l'appli | Autre contenu généré (nom de navigateur, réponses aux sondages) | Oui | Non | Fonctionnalités, analyses (sondages) | Oui |
| Identifiants de l'appareil | Identifiant publicitaire | Oui (SDK AdMob) | Oui (Google) | Publicité ou marketing, prévention des fraudes, analyses | Non |
| Position | Position approximative (déduite de l'IP par AdMob) | Oui (SDK AdMob) | Oui (Google) | Publicité ou marketing | Non |
| Infos et performances | Journaux de plantage, diagnostics (SDK AdMob) | Oui | Oui (Google) | Analyses, publicité | Non |

Aucune donnée n'est vendue. La partie « partagée » vient uniquement du SDK Google Mobile Ads ; Google détaille ses propres réponses ici : https://developers.google.com/admob/android/privacy/play-data-disclosure

**Autres rubriques de la Play Console**

- Produits : 3 produits intégrés `perles_100`, `perles_550`, `perles_1200` et 1 abonnement `pass_capitaine` (forfait de base mensuel, renouvellement automatique, 4,99 €).

- Annonces : **Oui, l'application contient des annonces.**
- Public cible : recommandé **13 ans et plus** (13-15, 16-17, 18+). Le jeu applique quand même un traitement « enfant » aux moins de 15 ans. Cocher aussi les moins de 13 ans ferait entrer le jeu dans le programme Familles (SDK publicitaires certifiés, contraintes supplémentaires).
- Accès à l'application : aucun identifiant nécessaire (compte anonyme créé automatiquement).
- Identifiant publicitaire : **Oui**, utilisé pour la publicité (déclaration obligatoire depuis Android 13).
- Applications financières, santé, actualités, gouvernement : non concernées.

## Apple : Confidentialité de l'app (App Privacy, « étiquettes »)

**Données utilisées pour vous suivre (tracking)**

| Type | Utilisation |
| --- | --- |
| Identifiants > ID de l'appareil (IDFA, seulement si l'utilisateur accepte dans la fenêtre ATT) | Publicité de tiers |
| Données d'utilisation > Données publicitaires | Publicité de tiers |

**Données liées à l'utilisateur**

| Type | Finalités |
| --- | --- |
| Coordonnées > Adresse e-mail (facultative) | Fonctionnalités de l'app |
| Identifiants > ID utilisateur | Fonctionnalités de l'app |
| Achats > Historique d'achats | Fonctionnalités de l'app |
| Données d'utilisation > Interaction avec le produit | Fonctionnalités de l'app |
| Autres données > nom de navigateur, réponses aux sondages | Fonctionnalités de l'app, analyses |

**Données non liées à l'utilisateur**

| Type | Finalités |
| --- | --- |
| Position > Position approximative (AdMob) | Publicité de tiers |
| Diagnostics > Données de plantage, de performances (AdMob) | Publicité de tiers, analyses |

**Autres réglages App Store Connect**

- URL de la politique de confidentialité : `<site>/confidentialite.html`.
- Suppression du compte dans l'app : oui (Paramètres, Compte).
- App Tracking Transparency : la fenêtre iOS est affichée par le message « IDFA » configuré dans AdMob (Confidentialité et messages) ; le texte d'usage est dans `app.json`.
- Manifeste de confidentialité : déclaré dans `app.json` (`ios.privacyManifests`) ; le SDK Google Mobile Ads apporte le sien.
- Achats intégrés : déclarer les 3 produits consommables `perles_100`, `perles_550`, `perles_1200`, et l'abonnement auto-renouvelable `pass_capitaine` (1 mois, 4,99 €) dans un groupe d'abonnements « Pass Capitaine ». Apple exige dans la fiche et dans l'app le prix, la durée, le renouvellement automatique et les liens CGU / confidentialité : ils sont affichés dans la fenêtre du pass.

## Classification d'âge (IARC pour Google Play, questionnaire Apple)

| Question | Réponse |
| --- | --- |
| Violence, peur, sexualité, langage grossier, drogues | Non |
| Jeux d'argent réels | Non : aucune mise ni gain en argent réel |
| Jeux de hasard simulés | Non |
| Achats numériques | Oui (packs de perles et abonnement mensuel) |
| Objets aléatoires payants (« loot boxes ») | Oui : la rareté d'un îlot acheté avec des perles (achetables) est tirée au hasard, probabilités affichées |
| Interaction entre utilisateurs | Oui, limitée : nom de navigateur visible au classement et sur la carte, pas de messagerie |
| Partage de la position | Non |
| Publicités | Oui |

Résultat attendu : **PEGI 3** (ou 7) avec la mention « Achats intégrés (dont objets aléatoires) », **4+** sur l'App Store.

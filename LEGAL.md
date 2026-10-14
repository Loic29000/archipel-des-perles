# Conformité légale (France et Union européenne)

Ce qui est en place dans le jeu, et ce qui reste à faire avant la publication.

## Déjà en place

| Obligation | Où |
| --- | --- |
| Politique de confidentialité (RGPD), CGU/CGV, mentions légales (LCEN), page de suppression de compte | `src/legal/texts.ts` (source unique), lisibles dans le jeu (Paramètres > Infos > Documents) et générées en pages web dans `docs/` par `npm run legal` |
| Écran d'âge neutre et acceptation des CGU au premier lancement | `src/ui/WelcomeGate.tsx` ; seule la tranche d'âge est gardée, pas l'année |
| Consentement publicitaire IAB TCF v2.2 (Google UMP) avant la première pub, modifiable ensuite | `src/services/ads.native.ts`, Paramètres > Vie privée |
| Moins de 15 ans : pas de formulaire de consentement, pubs non personnalisées, classées G, traitement « enfant » | `src/services/ads.native.ts` |
| Achats : prix TTC en euros, prix pour 100 perles, renonciation expresse au droit de rétractation (art. L221-28 13° C. conso.), accord parental pour les moins de 15 ans | Comptoir et confirmation d'achat |
| Valeur en euros des perles demandées pour un îlot (principes CPC sur les monnaies virtuelles, 2024) | Fiche d'îlot |
| Probabilités de rareté affichées avant chaque achat d'îlot | Fiche d'îlot, Infos > Règles |
| Droit d'accès et de portabilité : export JSON | Paramètres > Vie privée > Télécharger mes données ; RPC `export_my_data` |
| Droit à l'effacement | Paramètres > Compte ; RPC `delete_account` |
| Durée de conservation : comptes inactifs 3 ans, preuves de pub 90 jours | `purge_inactive()` dans `supabase/migrations/0004_privacy.sql`, à planifier |
| Pas de requête vers un CDN de polices tiers (version web) | Polices embarquées dans l'app |
| Déclarations des stores (Data safety, App Privacy, IARC) | `store/declarations.md` |

## À faire par l'éditeur

1. **Remplir `PUBLISHER`** dans `src/legal/texts.ts` (identité, statut et SIREN, adresse, e-mail, hébergeur du site, médiateur), puis `npm run legal`.
2. **Statut** : vendre des achats intégrés est une activité commerciale. Une micro-entreprise suffit au début (déclaration gratuite sur formalites.entreprises.gouv.fr).
3. **Médiateur de la consommation** : obligatoire pour vendre aux consommateurs (art. L612-1 C. conso.). Adhérer à un médiateur agréé (liste sur economie.gouv.fr/mediation-conso) et indiquer son nom.
4. **Héberger `docs/`** sur une URL publique (GitHub Pages demande un dépôt public ou un forfait payant ; sinon Netlify, Cloudflare Pages…), puis donner les URL aux stores.
5. **Supabase** : créer le projet dans une région de l'Union européenne (Francfort), signer le DPA de Supabase, planifier `select purge_inactive()` chaque jour (pg_cron).
6. **AdMob** : créer le message RGPD (Confidentialité et messages > RGPD, avec les partenaires publicitaires) et le message IDFA pour iOS ; activer la vérification côté serveur.
7. **Stores** : remplir les déclarations de `store/declarations.md`, déclarer les 3 produits de perles, renseigner les URL.
8. **Avant de passer aux vrais paiements** : vérifier les reçus côté serveur (fonction à écrire) et mettre `app_config.iap_test = false`.

## Points de vigilance

- Les éléments virtuels n'ont aucune valeur monétaire et ne s'échangent jamais contre de l'argent : c'est ce qui sépare le jeu d'un jeu d'argent (ANJ). Ne pas ajouter de retrait d'argent réel ni de vente entre joueurs sans avis juridique.
- Changer les CGU de façon importante : augmenter `TERMS_VERSION`, les joueurs devront les accepter à nouveau.
- Ces textes sont un modèle sérieux mais pas une consultation juridique ; une relecture par un professionnel est conseillée avant un lancement commercial.

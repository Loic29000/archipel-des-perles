// Legal documents of the game, in one place: the app shows them (Paramètres > Infos) and
// `npm run legal` turns them into the web pages in docs/ that the stores link to.
// Fill in PUBLISHER below before publishing; every [BRACKETED] value is a placeholder.
// Bump TERMS_VERSION when a change needs players to accept the terms again.

export const TERMS_VERSION = 2; // 2: Pass Capitaine subscription
export const UPDATED = '14 octobre 2026';

export const PUBLISHER = {
  name: '[NOM ET PRÉNOM, OU NOM DE LA SOCIÉTÉ]',
  status: '[STATUT : entrepreneur individuel (micro-entreprise) ou forme de la société et capital · SIREN · RCS ou RNE · n° de TVA s’il y en a un]',
  address: '[ADRESSE POSTALE]',
  email: '[ADRESSE E-MAIL DE CONTACT]',
  director: '[NOM DU DIRECTEUR DE LA PUBLICATION, en général l’éditeur]',
  webHost: '[HÉBERGEUR DU SITE : nom, adresse et téléphone, par exemple GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis]',
  mediator: '[MÉDIATEUR DE LA CONSOMMATION : nom et site internet]',
  site: '[ADRESSE DU SITE, par exemple https://exemple.github.io/archipel-des-perles]',
};

import { PASS, PASS_PERKS, RARITIES } from '../game/rules';

const P = PUBLISHER;
const ODDS = RARITIES.map(r => `${r.name} ${Math.round(r.odds * 100)} %`).join(', ');
const GAME = 'Archipel des Perles';
const GOOGLE = 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande';
const SERVER = 'Supabase Inc. (base de données hébergée dans l’Union européenne, région de Francfort)';

/** A paragraph is a string; a bullet list is an array of strings. */
export type Block = string | string[];
export interface Section { h: string; body: Block[] }
export interface LegalDoc { id: LegalId; title: string; short: string; intro?: string; sections: Section[] }
export type LegalId = 'confidentialite' | 'cgu' | 'mentions-legales' | 'suppression-compte';

const privacy: LegalDoc = {
  id: 'confidentialite',
  title: 'Politique de confidentialité',
  short: 'Confidentialité',
  intro: `Cette politique explique quelles données ${GAME} traite, pourquoi, combien de temps, et comment exercer vos droits. Elle s’applique à l’application mobile et à la version web du jeu.`,
  sections: [
    { h: '1. Responsable du traitement', body: [
      `${P.name}, ${P.address}. Contact pour toute question sur vos données : ${P.email}.`,
    ] },
    { h: '2. Ce que le jeu ne collecte pas', body: [[
      'Votre position : l’archipel est un monde imaginaire, sans lien avec une carte réelle.',
      'Vos contacts, photos, micro ou caméra.',
      'Vos données de paiement : les achats passent par l’App Store ou Google Play, qui ne nous transmettent que le produit acheté.',
    ]] },
    { h: '3. Données traitées, finalités et bases légales', body: [
      'Partie enregistrée sur l’appareil. Sans compte en ligne, la partie et les réglages restent dans la mémoire de votre appareil. Rien n’est envoyé à un serveur, en dehors de la publicité décrite plus bas.',
      'Compte de jeu en ligne (exécution du contrat, c’est-à-dire les CGU) :',
      [
        'un identifiant de compte anonyme créé au premier lancement ;',
        'votre nom de navigateur, vos îlots, perles, doublons, décorations, quêtes, succès, série de connexion et code de parrainage ;',
        'votre adresse e-mail, seulement si vous la donnez pour retrouver votre partie sur un autre appareil ;',
        'l’historique de vos achats intégrés (produit, date, identifiant de transaction du magasin) ;',
        'les journaux techniques du serveur (adresse IP, date), conservés par l’hébergeur pour la sécurité.',
      ],
      'Prévention de la triche (intérêt légitime à garder un jeu équitable) : l’heure du serveur et les preuves de visionnage des publicités récompensées envoyées par Google AdMob.',
      'Sondages (consentement) : vos réponses aux sondages facultatifs du jeu servent uniquement à améliorer le jeu. Vous pouvez ne pas y répondre.',
      'Classement et voisins : votre nom de navigateur, votre drapeau et le nombre de vos îlots sont visibles par les autres joueurs. Choisissez un nom qui ne permet pas de vous identifier.',
      'Rappels : les notifications sont programmées sur votre appareil, seulement si vous les activez. Aucun jeton de notification n’est envoyé à un serveur.',
    ] },
    { h: '4. Publicité', body: [
      `Les publicités récompensées de l’application mobile sont fournies par Google AdMob (${GOOGLE}). Google peut traiter l’identifiant publicitaire de votre appareil, votre adresse IP et des informations techniques, en tant que responsable de traitement indépendant.`,
      'Au premier lancement, un message de consentement conforme au cadre IAB TCF v2.2 vous permet d’accepter ou de refuser la publicité personnalisée. Sur iPhone, iOS vous demande aussi si l’application peut vous suivre. Refuser ne vous empêche pas de jouer : les publicités deviennent non personnalisées.',
      'Vous pouvez changer d’avis à tout moment dans Paramètres, Vie privée, « Gérer mes choix publicitaires ».',
      'Si vous avez moins de 15 ans, le jeu ne demande pas ce consentement : toutes les publicités sont non personnalisées et adaptées à tous les publics.',
      'Politique de confidentialité de Google : https://policies.google.com/privacy. Partenaires publicitaires de Google : https://support.google.com/admob/answer/9012903.',
    ] },
    { h: '5. Mineurs', body: [
      'Au premier lancement, le jeu demande votre année de naissance. Elle n’est pas conservée : le jeu retient seulement si vous avez moins de 15 ans ou non.',
      'En France, un mineur de moins de 15 ans ne peut consentir seul au traitement de ses données fondé sur le consentement. Pour ces joueurs, le jeu n’utilise donc aucune publicité personnalisée, et chaque achat demande la confirmation qu’un parent ou tuteur est d’accord.',
    ] },
    { h: '6. Destinataires et transferts', body: [
      `Vos données de jeu sont hébergées par ${SERVER}. Elles ne sont ni vendues ni louées.`,
      'Google AdMob et, pour certains de ses services, Supabase peuvent transférer des données hors de l’Union européenne, notamment aux États-Unis. Ces transferts sont encadrés par le Data Privacy Framework UE–États-Unis ou par les clauses contractuelles types de la Commission européenne.',
    ] },
    { h: '7. Durées de conservation', body: [[
      'Compte de jeu : tant que vous jouez. Un compte sans aucune activité pendant 3 ans est supprimé automatiquement.',
      'Preuves de visionnage publicitaire : 90 jours après leur utilisation.',
      'Réponses aux sondages et historique d’achats : jusqu’à la suppression du compte.',
      'Partie sur l’appareil : jusqu’à ce que vous l’effaciez ou désinstalliez l’application.',
    ]] },
    { h: '8. Vos droits', body: [
      'Vous disposez des droits d’accès, de rectification, d’effacement, de portabilité, d’opposition et de limitation, et du droit de retirer votre consentement à tout moment.',
      [
        'Télécharger vos données : Paramètres, Vie privée, « Télécharger mes données ».',
        'Supprimer votre compte et toutes vos données : Paramètres, Compte, « Supprimer mon compte ».',
        'Changer vos choix publicitaires : Paramètres, Vie privée.',
        `Toute autre demande : ${P.email}, en indiquant votre identifiant joueur (Paramètres, Infos, À propos). Nous répondons sous un mois.`,
      ],
      'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (www.cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).',
    ] },
    { h: '9. Stockage sur l’appareil', body: [
      'Le jeu enregistre votre partie, vos réglages et votre session dans la mémoire de l’appareil (ou du navigateur pour la version web). Ce stockage est strictement nécessaire au jeu et ne sert pas à vous suivre. La version web n’affiche pas de publicité et ne dépose pas de traceur publicitaire.',
    ] },
    { h: '10. Sécurité', body: [
      'Les échanges avec le serveur sont chiffrés (HTTPS). Chaque joueur n’accède qu’à ses propres données ; toutes les actions de jeu sont vérifiées par le serveur.',
    ] },
    { h: '11. Modifications', body: [
      `Nous vous informerons dans le jeu de toute modification importante. Dernière mise à jour : ${UPDATED}.`,
    ] },
  ],
};

const terms: LegalDoc = {
  id: 'cgu',
  title: 'Conditions générales d’utilisation et de vente',
  short: 'CGU',
  intro: `Ces conditions s’appliquent à l’utilisation du jeu ${GAME} et aux achats intégrés. En jouant, vous les acceptez.`,
  sections: [
    { h: '1. Éditeur', body: [`Le jeu est édité par ${P.name}, ${P.status}, ${P.address}, ${P.email}.`] },
    { h: '2. Le jeu', body: [
      `${GAME} est un jeu gratuit. Vous achetez des îlots imaginaires avec des perles ; ils produisent des doublons. Perles, doublons, îlots, drapeaux et décorations sont des éléments virtuels du jeu.`,
      'Ils n’ont aucune valeur monétaire : ils ne peuvent être ni échangés contre de l’argent ou des biens réels, ni vendus, ni transférés à un autre joueur. Le jeu ne verse jamais d’argent réel.',
      'Vous obtenez une licence personnelle d’utilisation de ces éléments, que nous pouvons faire évoluer pour l’équilibre du jeu.',
    ] },
    { h: '3. Âge et compte', body: [
      'Le jeu s’adresse à tous les âges. Un mineur doit avoir l’accord d’un parent ou tuteur pour jouer et pour tout achat ; le jeu le rappelle à chaque achat d’un joueur de moins de 15 ans.',
      'Un compte anonyme est créé au premier lancement. Vous pouvez y associer une adresse e-mail. Vous pouvez supprimer votre compte à tout moment dans les paramètres.',
    ] },
    { h: '4. Hasard et probabilités', body: [
      `La rareté d’un îlot est tirée au hasard au moment de son acquisition. Les probabilités sont affichées avant chaque achat d’îlot et dans Paramètres, Infos : ${ODDS}. Elles peuvent changer pendant certains événements, qui l’annoncent.`,
    ] },
    { h: '5. Achats intégrés', body: [
      'Des packs de perles et un abonnement, le Pass Capitaine, sont vendus dans le jeu. Le prix est indiqué en euros, toutes taxes comprises, avant l’achat, avec le prix équivalent pour 100 perles. Le jeu indique aussi la valeur en euros des perles demandées pour un îlot.',
      'Le paiement est traité par l’App Store d’Apple ou Google Play, selon leurs conditions. Le contrat de vente est conclu avec l’éditeur dès la confirmation par le magasin.',
      'Les perles achetées sont livrées immédiatement. Conformément à l’article L221-28 13° du Code de la consommation, en confirmant votre achat vous demandez cette livraison immédiate et reconnaissez perdre votre droit de rétractation de 14 jours.',
      'En cas de perles non reçues ou de problème de paiement, contactez-nous ; les remboursements se demandent auprès d’Apple ou de Google selon leurs règles.',
      'Toutes les perles s’obtiennent aussi gratuitement en jouant (publicités, sondages, mini-jeux, quêtes, succès). Aucun achat n’est nécessaire pour progresser.',
    ] },
    { h: '6. Pass Capitaine (abonnement)', body: [
      `Le Pass Capitaine est un abonnement mensuel à ${PASS.price} TTC par mois. Il donne, tant qu’il est actif : ${PASS_PERKS.map(x => x.charAt(0).toLowerCase() + x.slice(1)).join(' ; ')}.`,
      'Il est renouvelé automatiquement chaque mois au même prix, sans durée minimale. Vous pouvez le résilier à tout moment, en quelques gestes, dans la gestion des abonnements de l’App Store ou de Google Play (un lien est proposé dans le jeu) ; il reste actif jusqu’à la fin de la période payée. Tout changement de prix vous sera annoncé à l’avance et vous pourrez alors résilier.',
      'En vous abonnant, vous demandez l’accès immédiat au pass. Vous gardez votre droit de rétractation de 14 jours, mais vous paierez la part de l’abonnement déjà utilisée (article L221-25 du Code de la consommation). Le remboursement se demande auprès d’Apple ou de Google.',
      'Le pass n’est pas nécessaire pour progresser : perles et îlots s’obtiennent tous en jouant gratuitement.',
    ] },
    { h: '7. Publicités récompensées', body: [
      'Regarder une publicité est toujours facultatif. La récompense est accordée quand la régie confirme que la publicité a été vue jusqu’au bout.',
    ] },
    { h: '8. Règles de conduite', body: [
      'Il est interdit de tricher (modifier l’application, automatiser des actions, exploiter un bug), de créer plusieurs comptes pour abuser du parrainage, et de choisir un nom injurieux, haineux, à caractère sexuel ou portant atteinte aux droits d’autrui.',
      `Pour signaler un nom ou un contenu illicite, écrivez à ${P.email} en indiquant le nom concerné et la raison. Nous pouvons renommer, suspendre ou supprimer un compte qui ne respecte pas ces règles, après vous avoir informé du motif sauf urgence.`,
    ] },
    { h: '9. Disponibilité et responsabilité', body: [
      'Nous faisons notre possible pour que le jeu fonctionne en continu, sans pouvoir le garantir. Le jeu peut être modifié, interrompu pour maintenance ou arrêté ; en cas d’arrêt définitif, nous préviendrons les joueurs au moins 30 jours à l’avance.',
      'Ces conditions ne limitent pas les garanties légales dont vous bénéficiez comme consommateur, notamment la garantie de conformité des contenus numériques.',
    ] },
    { h: '10. Propriété intellectuelle', body: [
      'Le jeu, son nom, ses illustrations, ses textes et son code sont protégés. Toute reproduction sans autorisation est interdite.',
    ] },
    { h: '11. Données personnelles', body: ['Voir la politique de confidentialité, accessible dans le jeu et sur notre site.'] },
    { h: '12. Modification des conditions', body: [
      'Nous pouvons modifier ces conditions. Les changements importants vous seront présentés dans le jeu et devront être acceptés pour continuer à jouer.',
    ] },
    { h: '13. Litiges', body: [
      'Ces conditions sont soumises au droit français. En cas de difficulté, contactez-nous d’abord par e-mail.',
      `Si aucune solution n’est trouvée, vous pouvez recourir gratuitement au médiateur de la consommation : ${P.mediator}. Les tribunaux compétents sont ceux prévus par la loi ; si vous résidez dans un autre pays de l’Union européenne, vous gardez la protection des règles impératives de votre pays.`,
      `Dernière mise à jour : ${UPDATED}.`,
    ] },
  ],
};

const notice: LegalDoc = {
  id: 'mentions-legales',
  title: 'Mentions légales',
  short: 'Mentions légales',
  sections: [
    { h: 'Éditeur', body: [[
      P.name, P.status, P.address, `Contact : ${P.email}`, `Directeur de la publication : ${P.director}`,
    ]] },
    { h: 'Hébergement', body: [[
      `Site internet : ${P.webHost}`,
      `Serveur du jeu : ${SERVER}, https://supabase.com`,
      `Régie publicitaire : ${GOOGLE}`,
    ]] },
    { h: 'Propriété intellectuelle', body: [
      `${GAME} : conception, illustrations et code originaux. Polices Unbounded et Figtree sous licence SIL Open Font License.`,
    ] },
  ],
};

const deletion: LegalDoc = {
  id: 'suppression-compte',
  title: 'Supprimer votre compte',
  short: 'Suppression du compte',
  intro: `Vous pouvez supprimer votre compte ${GAME} et toutes les données associées à tout moment.`,
  sections: [
    { h: 'Depuis le jeu', body: [[
      'Ouvrez le jeu et touchez la roue dentée en haut de l’écran.',
      'Dans Paramètres, section Compte, touchez « Supprimer mon compte ».',
      'Confirmez avec « Supprimer définitivement ».',
    ]] },
    { h: 'Sans accès au jeu', body: [
      `Écrivez à ${P.email} avec l’objet « Suppression de compte », en indiquant votre nom de navigateur et, si possible, votre identifiant joueur (Paramètres, Infos, À propos) ou l’adresse e-mail liée au compte. La suppression est faite sous 30 jours.`,
    ] },
    { h: 'Ce qui est supprimé', body: [
      'Votre compte, votre adresse e-mail, vos îlots, perles, doublons, décorations, succès, réponses aux sondages, preuves de visionnage publicitaire et historique d’achats. Rien n’est conservé, sauf les journaux techniques de l’hébergeur, effacés automatiquement après quelques jours.',
      'Les achats déjà faits ne sont pas remboursés par la suppression. Les reçus restent chez Apple ou Google, selon leurs propres règles.',
      'Supprimer le compte ne résilie pas un Pass Capitaine en cours : résiliez-le d’abord dans les abonnements de l’App Store ou de Google Play.',
    ] },
  ],
};

export const LEGAL_DOCS: Record<LegalId, LegalDoc> = {
  confidentialite: privacy, cgu: terms, 'mentions-legales': notice, 'suppression-compte': deletion,
};

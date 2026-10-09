# SPAWT — vérification avant recompilation, 9 octobre 2026

## Projet et état du travail

Application identifiée : `xtincell/spawt-ci-mobile-v1-mvp`, app Expo dans `app/`,
console dans `spawt-admin/`, backend self-hosted `https://api.spawt.online`.
Base de travail : `8aae5d846efad0c54a5e4912a45f2e3ba24f421a`, issue de la branche
GitHub active `claude/app-finale-ios-android-f8ewrp` ; `main` est en retard.
Les corrections de cet audit sont sur `codex/audit-avant-compilation`.

La compilation native APK/IPA n'est pas lancée pendant cet audit. Un export
JavaScript ou le build web de la console ne constitue pas une recette sur appareil.

## Comptes démo créés sur l'alpha

| Profil | Contenu initial |
|---|---|
| Démo Alpha Découverte | Palais vierge, Cocody |
| Démo Alpha Palais | Cinq axes de goût renseignés, Marcory |

Les accès sont remis dans la conversation et dans le fichier local non versionné
`app/secrets/DEMO_ALPHA_2026-10-09.md`. Dans l'app, ouvrir la connexion, saisir le
numéro complet, demander le code puis saisir le code alpha fourni.
Le mode SMS simulé était déjà actif sur le serveur (`MOCK_TERMII=true`) ;
aucun SMS n'a été envoyé et aucun fournisseur SMS n'a été activé par cet audit.
Ces accès sont des fixtures alpha connues, sans droits staff, internes ou Gold.
Ils ne doivent pas être traités comme des comptes personnels sécurisés par SMS réel.

Les deux comptes portent `spawters.is_demo=true` et une métadonnée Auth dédiée.
Ils n'ont ni faux avis public, ni fausses visites, ni rang artificiel. Aucun
consentement d'une personne réelle n'a été enregistré en les créant.
Le script `scripts/create-alpha-demo-accounts.mjs` prévisualise par défaut,
refuse les collisions avec des comptes réels et conserve les démos déjà présentes.

**Supprimer une démo :** ouvrir la console locale `http://127.0.0.1:5173/comptes`,
se connecter avec un compte staff admin, filtrer « Démo alpha », ouvrir la fiche,
choisir « Supprimer ce compte démo » et recopier le nom exact. La confirmation
est irréversible : Auth et les données liées sont supprimés ensemble.
La migration serveur 0070 est appliquée ; l'interface corrigée est locale tant
que le nouveau build admin n'a pas été déployé sur `admin.spawt.online`.

Le serveur revérifie les droits et le marqueur. Un client ne peut pas classer un
vrai compte en démo. L'action refuse les comptes réels, staff, fondateurs et
l'auto-suppression. Elle est journalisée. Les dix profils préexistants sont conservés.

## Corrections

- Ouverture : callbacks stables, animations annulées au démontage, réduction des
  mouvements respectée, disparition du premier Moka avant révélation de l'accueil,
  splash natif noir, police officielle, sortie du splash après préparation réelle.
  Une panne de restauration affiche une relance ; le secours de chargement des
  polices résiste au double montage React StrictMode.
- Accueil : suppression du plantage du carrousel après connexion. Son callback
  de visibilité garde son identité et lit le contexte de recommandation courant.
  Le défaut a été reproduit dans le navigateur puis le parcours connecté rejoué.
- Fiche : le retour après un lien direct ou un rechargement rejoint l'accueil
  lorsque l'historique de navigation est vide.
- Profil web : le bouton photo n'est plus imbriqué dans un élément HTML
  `button`. Le retournement de carte reste accessible au clic et au clavier,
  sans modifier la cible tactile native.
- Lecture des lieux : les erreurs réseau, droits et données invalides ne deviennent
  plus de fausses listes vides. Les écrans affichent une relance, conservent le
  dernier résultat exploitable et ignorent les réponses devenues obsolètes.
- Compte : restauration de l'historique et de la collection avant publication locale ;
  cache conditionné à la session courante, suspension à la déconnexion, réponses
  tardives et requêtes bloquées encadrées. Les flags et la progression suivent
  le changement de compte.
- Console : pagination sur six listes, erreurs explicites, filtres et onglets
  traités réparés, rôle obtenu via `current_staff()`, configuration invalide
  diagnostiquée. Les démos sont exclues des indicateurs de comptes.
- Partage : remplacement des liens vers le domaine `spawt.ci` indisponible par
  des liens de l'app installée ; invitation Meute préremplie, sans rejoindre
  automatiquement. Le message conserve le code pour une saisie manuelle.
- Préparation EAS : une passerelle indisponible ou une réponse Auth inattendue
  bloque désormais le contrôle au lieu d'annoncer un backend validé.
- Suppression démo : migration 0070 et retour arrière, correction de la cascade
  des titres qui empêchait auparavant de supprimer un compte possédant un titre.
- Dépendances : versions compatibles Expo SDK 55 alignées, dont React Native
  0.83.10. La dépendance transitive `shell-quote` est portée à 1.12.0 pour corriger
  l'alerte critique ; aucune mise à niveau forcée vers un autre SDK.

## Preuves serveur

- Auth répond ; les trois profils EAS distribuables passent la vérification de
  leur clé auprès de la passerelle réelle.
- Les deux nouveaux comptes passent `otp-send` puis `otp-verify` (HTTP 200) et
  lisent leur propre profil/Palais sous leur session réelle. Les requêtes de
  lieux, flags, favoris et collection répondent HTTP 200. Les sessions de test
  HTTP ont ensuite été fermées (204).
- Inventaire réel : 10 lieux et leurs ADN lisibles ; 10 positions GPS et horaires
  parsables. Aucun des 10 lieux n'a de photo de couverture renseignée. Une fiche
  visuellement pauvre n'est donc pas nécessairement une panne de connexion.
- SQL 0070 testé dans un cluster local jetable, puis dans une transaction sur
  le schéma réel : droits, protection du marqueur, confirmation exacte, suppression
  en cascade, annulation complète compte + audit en cas d'échec. Toutes les
  fixtures du test ont été annulées. La migration a ensuite été appliquée séparément.
  Un second passage sur le schéma réel couvre Palais, favori, visite GPS vérifiée
  avec avis, titres, signaux et pattes : purge complète et compteur d'avis du lieu
  recalculé de 1 à 0, lieu conservé. Ce passage est également annulé par `ROLLBACK`.
- Console : 190 tests / 27 suites, lint, TypeScript et build Vite réussis.
  Avertissement restant : bundle minifié de 1,50 Mo.
- Mobile : TypeScript, vocabulaire et i18n réussis ; suite complète à 982 tests
  réussis, 132 suites, quatre snapshots. Quatre tests ignorés restent déclarés
  (intégration SQL conditionnelle et ancien scénario OTP live), sans être comptés
  comme des validations. Après les derniers correctifs de navigation/profil,
  les 13 tests ciblés de fiche et carte passent également.
- Exports Hermes Android et iOS réussis : 2 584 / 2 553 modules, 93 assets,
  bundles de 8,3 / 8,2 Mo. Ces exports valident le code embarqué, pas les plugins
  natifs ni le lancement sur téléphone.
- Garde EAS : quatre contre-exemples automatisés réussis (acceptation, refus,
  panne réseau et panne GoTrue).

## Vérification dans le navigateur

La connexion admin d'Alexandre a permis de vérifier la liste des lieux, les deux
démos filtrées, leur fiche et la confirmation de suppression. Un nom incomplet
laisse le bouton final désactivé ; le nom exact l'active. Le formulaire a été
annulé, les démos sont conservées. Les métriques chargent et les suggestions
traitées affichent correctement leur état vide.

Le compte Démo Alpha Palais s'est connecté par OTP alpha. L'accueil affiche les
dix lieux et trois recommandations ; la recherche « Madame » retrouve sa fiche,
avec horaires, budget et ADN. Une sauvegarde de favori persiste après rechargement,
puis son retrait remet la liste à zéro. Le profil retrouve son nom, quartier,
Palais et ses compteurs. Aucun avis ni check-in public n'a été créé par ce test.
Les captures sont conservées localement dans `app/secrets/audit-2026-10-09/`.

## Limites de réception

Un audit ne garantit pas l'absence absolue de bugs. Le géofencing, le démarrage
natif, les notifications, les liens entre applications et les parcours sur deux
téléphones demandent encore une recette APK/IPA. Aucun appareil natif n'est
connecté à cette session. Les données de lieux n'ont pas été inventées pour remplir
les visuels. Les textes de consentement contiennent encore un statut de brouillon
juridique dans le parcours public ; leur validation ne fait pas partie d'un test
technique. Le SMS réel n'est pas validé puisque l'alpha utilise le mode simulé.

Le rendu animé sur téléphone reste à recevoir dans le nouveau binaire : la
prévisualisation web et les tests de composants ne mesurent pas sa fluidité native.
L'audit npm résiduel compte 67 alertes (51 hautes, 15 modérées, une basse, zéro
critique) ; leur portée runtime n'est pas entièrement qualifiée. Ce rapport ne
constitue donc pas un certificat d'absence de vulnérabilité.

Les modifications mobile/admin ne sont pas automatiquement présentes dans les
binaires déjà installés ni dans l'ancienne console publique.

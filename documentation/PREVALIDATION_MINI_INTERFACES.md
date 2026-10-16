# Passage au build 30

Le demandeur a explicitement autorisé la compilation APK après présentation des captures.
Build preview 30 en préparation via le workflow local EAS existant sur GitHub Actions.
Les mentions d’arrêt avant APK ci-dessous décrivent la phase de prévalidation précédente.
Aucune autorisation de fusion, OTA, publication store ou écriture de production.

# SPAWT — mini-interfaces, prévalidation du 13 octobre 2026

Travail local sur `codex/mini-interfaces-build29`, basé exactement sur le build 29,
`bd0b61f1a2701abd28d205cb9d0375295b64ca9d`. Le checkout était propre avant modification.
Les images fournies sont des intentions visuelles ; les captures de recette sont
des rendus du code modifié. Aucun APK compilé, commit poussé, déploiement, OTA,
publication store ou écriture de production. Validation explicite des captures
requise avant toute nouvelle compilation APK.

## Intégration

- Accueil : cinq accès, Suggestions par défaut, puis Rapide, Les sélections,
  En duo et Les spots. État actif souligné, gras et annoncé aux technologies
  d’assistance. Les panes visitées restent montées pour préserver leur état et
  leur défilement ; la navigation vers les détails est protégée des doubles appuis.
- Suggestions conserve `rankPlaces`, ses scores et le tri des lieux ouverts.
  Le changement d’usage n’écrit aucune préférence.
- Rapide partage `RapideContent` entre Accueil et la route autonome : même deck,
  exclusions, gel après le premier swipe, favoris idempotents, signaux et analytics.
  Les boutons Passe / Je le garde restent utilisables sans geste.
- Les sélections affiche d’abord une liste verticale de carnets via
  `ExploreCollections`, partagé avec la route Explore. Le détail conserve l’ordre
  éditorial et distingue erreur/réessai, carnet absent et carnet vide.
- Suite à la demande de remplir les écrans, En duo affiche deux aperçus illustrés :
  « Un café à deux » et « Une table pour deux ». Les sélections affiche les deux
  concepts éditoriaux des maquettes lorsqu’une lecture réussie ne renvoie aucun
  carnet publié. Ces vues portent « Aperçu de carnet » et une mention explicite
  de curation à préparer ; elles sont non interactives et n’inventent aucun spot
  associé. Les vrais carnets publiés remplacent ces aperçus et gardent leurs détails.
  Aucun filtre prix/ambiance, Crew ou contenu d’exemple ajouté aux données métier.
- Les spots et l’onglet Carte partagent `SpotsMap`, MapLibre, `usePlaces`, marqueurs
  et ouverture de fiche. Quand le module natif est indisponible, le message est
  accompagné des lieux réellement publiés : photo disponible, nom, quartier et
  accès à la fiche. Pas de carte schématique ni de photo inventée.
- La barre inférieure conserve ses destinations ; sa hauteur devient extensible
  et ses libellés peuvent revenir à la ligne avec un texte agrandi.

## Sources et arbitrage éditorial

Lecture publique anonyme du backend configuré dans le profil preview, le 13 octobre :
les flags globaux `mode-rapide` et `mode-explore` sont actifs dans les colonnes
internal/alpha/beta/prod. Leur résolution et les overrides individuels existants
restent inchangés. Les tests couvrent également leur désactivation.

La lecture anonyme des collections publiées renvoie une liste vide. Cela ne prouve
pas l’absence de carnets visibles avec une session authentifiée : les restrictions
RLS sont conservées. Le schéma OpenAPI réel expose id, slug, title_key, subtitle_key,
cover_url, sort_order, is_published, city_code, created_at et updated_at ; aucune
catégorie duo. Il faut donc définir et publier une curation dédiée et son raccord
explicite. Toute migration ou écriture de production éventuelle nécessite l’accord
du demandeur ; aucune n’a été créée ou exécutée ici.

## Vérifications exécutées

- TypeScript, vocabulaire et i18n : réussis.
- Jest mobile : 154 suites réussies, une ignorée ; 1 055 tests réussis,
  quatre ignorés ; quatre snapshots réussis.
- Configuration EAS : quatre tests réussis.
- Conformité : 264 assertions réussies, zéro échec ; avertissement existant sur
  les identifiants stores `ascAppId` / `appleTeamId` non renseignés.
- Export Expo web du code applicatif : réussi. Ce n’est pas une compilation APK.
- Tests ciblés : cinq accès, répétition et état actif, classement Suggestions,
  garder/passer/idempotence/fin de pile, erreurs et GPS tardif, carnets
  chargement/vide/erreur/réessai/requêtes périmées, filtrage publié, détail,
  navigation protégée, marqueurs, position de repli et module cartographique absent.

## Captures et méthode

Galerie et PNG dans `/workspace/spawt-contenu-prevalidation/`. Un banc de recette isolé
dans `/workspace/spawt-review` réutilise les composants, écrans, thème et navigation
inférieure du code modifié, avec un layout de prévalidation sans connexion.
Le parcours OTP n’a pas été exercé. Le code applicatif ne contient pas ce bypass.
Les requêtes autres que GET/HEAD/OPTIONS vers le backend sont bloquées dans le
navigateur de recette. Les rapports enregistrent les tentatives bloquées et erreurs.

Les cinq usages sont capturés à 320, 360 et 393 px. Les spots, photos et valeurs
affichés viennent des lectures publiques et calculs existants, sans session ni Palais
personnel. Les aperçus éditoriaux sont du contenu de présentation local, pas des
collections reçues du backend. Ils ne comportent ni IDs métier ni statistiques,
lieux ou navigation vers des publications inexistantes. La distance éventuelle est celle du mécanisme de position de repli existant,
pas une localisation GPS attestée. Le rendu de carnets rempli utilise les fixtures
existantes, interceptées localement et explicitement étiquetées comme non publiées.
Les erreurs réseau et l’inventaire vide sont aussi injectés localement pour la recette.

Les captures « texte150 » combinent `fontScale` simulé et taille/hauteur de ligne CSS
augmentées de 50 %. C’est un test de contrainte web, pas une validation du réglage
d’accessibilité Android/iOS. La rangée des accès défile horizontalement aux petites
largeurs et avec du grand texte, sans tronquer ses libellés.

Révisions après inspection : largeur des accès, continuité du fond Suggestions,
message vide des carnets, hauteur de carte à 320 px, contraste de la pastille de
score et libellés de navigation inférieure en grand texte. Après la demande de
contenu : deux illustrations SVG thématiques, cartes remplies, mention de statut
lisible et liste de lieux réels dans le remplacement de la carte. Aucun fond de carte ou
contenu métier des maquettes n’a été transformé en donnée réelle.

## Restant avant validation native

Valider les captures et le raccord éditorial En duo. La carte MapLibre réelle,
les gestes et retours sur appareils Android/iOS, les permissions système et les
lecteurs d’écran restent à vérifier nativement. Les tests avec MapLibre mocké et
le rendu web de remplacement ne démontrent pas le fonctionnement cartographique
natif. Les écritures de favoris/signaux sont testées automatiquement avec mocks,
pas exécutées sur un compte de production pendant cette recette.

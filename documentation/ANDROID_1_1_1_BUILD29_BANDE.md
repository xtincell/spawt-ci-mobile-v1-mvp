# Android 1.1.1 — build 29 : Accueil et La Bande

## Périmètre livré

Demande du 13 octobre : terminer cette version et compiler l’APK avec Expo.
Même branche `codex/audit-avant-compilation`, PR 13 toujours ouverte/brouillon.
La demande finale conserve tous les filtres sur une seule ligne horizontale défilante.
Les fonds distinguent les fonctions : sélecteur clair, éditorial sur crème avec cartes blanches,
avis sur crème et coups de cœur sur or clair. Les libellés et icônes doublent ce repère coloré.
Les changements d’Accueil déjà présents sont conservés : quatre choix discrets,
SVG dédiés, carrousel indépendant du classement Palais, photos et illustration de secours.

La Bande reprend le fil communautaire du plan de finalisation (§ phase 2, chantier 15)
et les cartes illustrées du kit `midfi-screens-6.jsx`. Elle affiche les avis publiés
(hors avis fondateurs), les coups de cœur, les auteurs publics avec Moka par défaut,
les notes cuisine/cadre/service et leur moyenne, les photos d’avis signées et les
photos officielles des lieux. Un ancien avis reste à note unique.
Les longs avis se déplient. La fiche du lieu, le partage natif et le signalement
réutilisent les parcours existants. Aucun compteur de réaction ni statut de présence fictif.

- Trois filtres réels : Tout, Avis, Coups de cœur. Ils portent uniquement sur La Bande.
- Pagination de 20 activités par curseur date + UUID, tri commun aux deux sources.
  Plus de quota arbitraire de 15 avis / 15 coups de cœur qui amputait le fil.
- Relecture au retour sur l’onglet et à la publication ; rafraîchissement manuel.
- Échec initial, liste vide et panne d’actualisation distincts ; contenu précédent conservé,
  réessai de pagination et verrou synchrone contre les doubles appuis.
- Les réponses d’un ancien filtre ou d’un écran quitté sont ignorées.
- Boutons d’au moins 44 dp, filtres défilants sur une seule ligne avec recentrage de la sélection,
  noms de lieux complets. Le fil reste prioritaire ; Crew replié et sous son flag existant.

## Accès aux données

L’ancienne expression `spawters_public:spawters!inner` renommait la table privée :
elle n’interrogeait pas la vue publique. Le nouveau lecteur récupère uniquement
`id, display_name, avatar_url` depuis `spawters_public`, en une requête groupée.
Les lieux sont explicitement filtrés `is_published=true`, y compris pour un compte staff.
Aucune migration ni écriture serveur n’est nécessaire.

Lecture réelle anonyme avec le code de l’adaptateur : **2 avis + 1 coup de cœur**.
L’ancienne requête du coup de cœur renvoie **0**. Curseur testé sur deux pages sans doublon.
`node scripts/qa-community-live.cjs` reproduit ce contrôle en lecture seule.

## Vérifications

- TypeScript, vocabulaire et i18n : passent.
- Suite mobile : 1 038 tests passent, 4 ignorés ; 4 snapshots passent.
- Conformité : 264 assertions passent ; seul avertissement attendu, identifiants stores absents.
- Expo web : 23 captures, matrice Accueil 320/360/393/430 px × texte CSS 100/130/150 %,
  filtres répétés de La Bande, retour Accueil et indépendance du feed, aucune erreur navigateur.
- La Bande 320 px / texte CSS 150 % : filtres défilants sur une seule ligne (décision finale d’Alexandre), photos visibles,
  contenu défilable. Le grossissement CSS ne remplace pas le réglage natif Android ;
  les libellés historiques de la barre inférieure restent tronqués dans cette approximation.
- Les captures « activité publique » rejouent dans l’app Expo web les trois lignes
  obtenues par la lecture réelle. Le bandeau indique honnêtement le runtime de démonstration.
  Cela vérifie le rendu, pas une session native connectée. Les fixtures supplémentaires
  servent uniquement aux états réseau / pagination, jamais insérées en base.

| Activité publique | Coups de cœur | Petit écran, texte agrandi |
| --- | --- | --- |
| ![](qa/bande-build29/la-bande-activite-publique-393.png) | ![](qa/bande-build29/la-bande-coups-publics-393.png) | ![](qa/bande-build29/la-bande-320-150.png) |

Compilation preview Android autorisée ; résultat et lien à compléter après le build.
Aucune fusion, publication store, OTA ni modification du backend de production.

## Préparation V2 — explicitement différée par Alexandre

La **Tanière durable** et les **abonnements entre membres** ne sont pas introduits
par cette APK. Le Crew actuel reste une session temporaire avec invitation/propositions/votes.
Avant V2 : décider visibilité/consentement des profils et du fil suivi, invitation et
sortie d’un cercle durable, partage des adresses, blocage/signalement et suppression des
relations. Ensuite schéma/RLS/RPC réversibles, parcours fonctionnels et recette à deux comptes.
Les réactions, commentaires de second niveau et statuts de présence dessinés dans le
kit n’ont pas de contrat de données validé ; aucun bouton inactif n’est ajouté.

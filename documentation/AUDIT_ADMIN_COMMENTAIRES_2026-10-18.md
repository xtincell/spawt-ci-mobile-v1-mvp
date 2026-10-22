# Panel admin, champs et commentaires — 18 octobre 2026

> **Audit initial, avant accès serveur.** Les constats de déploiement ci-dessous ont depuis été traités. Voir la [mise en service éditoriale](./MISE_EN_SERVICE_EDITORIALE_2026-10-18.md) puis le [bilan de liaison panel/app](./LIAISON_PANEL_APP_2026-10-18.md) pour l’état livré et les limites restantes.

Complément après consultation du Drive et des quatre dépôts : voir `AUDIT_DRIVE_DEPOTS_2026-10-18.md` pour les 31 363 références, les 129 fiches enrichies, les circuits de collecte distincts et la comparaison exacte du ZIP d'intégration avec GitHub.

Audit de `xtincell/spawt-ci-mobile-v1-mvp`, de ses branches récentes et des surfaces publiques de `https://api.spawt.online` et `https://admin.spawt.online`. Les lectures publiques ne remplacent pas une session staff, les journaux serveur ou le contenu local d'un téléphone.

## État mesuré en ligne

| Surface | Résultat |
| --- | --- |
| `places` | 10 lieux publiés de Mission 1 |
| `public_reviews` | 32 avis visibles, dont 30 textes fondateurs : trois par lieu |
| Auteur public des fondateurs | Alexandre, profil mobile `c6e5c430-c762-41e9-991d-73d0aecc3382` ; attribution 0072 présente |
| Avis communautaires visibles | Deux avis de Steph chez Madame Antika, créés le 9 octobre 2026 à 12:46 et 20:04 UTC ; `texte_avis = null` dans les deux cas |
| Notes détaillées | `note_cuisine`, `note_cadre`, `note_service`, `note_globale` accessibles dans `public_reviews` |
| Compteur `place_adn.total_reviews` | 2 pour Madame Antika, 0 pour les neuf autres ; il exclut volontairement les fondateurs |
| `places.editorial_profile` | HTTP 400, colonne absente |
| `public_editorial_reviews` | HTTP 404, vue absente du cache PostgREST |
| `explore_collections.audience` | HTTP 400, colonne absente |
| Panel déployé | Asset `/assets/index-DGPQrGNM.js`, HTTP 200 ; notes détaillées et attribution présentes, espace éditorial et recherche absents |

La migration éditoriale 0075 n'est donc pas disponible sur l'API en ligne. Le registre privé des migrations n'a pas été consulté.

## Décalage et compteurs

L'espace éditorial existe sur `codex/editorial-research-admin`, commit `ef87f8a`, [PR 15 ouverte](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/15). Sa documentation du 17 octobre indique que migration et déploiement admin restent à faire. L'APK récente et le serveur n'ont pas reçu le même périmètre.

Le panel en ligne correspond à la livraison décrite dans `ANDROID_1_1_1_RECETTE.md` : 0071–0074, auteur fondateur et trois notes. Il prévoit les textes dans Modération, mais sa liste Lieux présente un compteur « Avis » qui ne compte que la communauté. Un zéro n'y signifie pas absence de texte. Sans session staff, la lecture réelle de Modération et les éventuelles erreurs de droits du compte connecté restent à reproduire.

Les 31 363 références de recherche prévues par 0075 sont des lignes sources à qualifier, pas des lieux validés prêts à publier. La production expose toujours les dix lieux de Mission 1 ; aucun import supplémentaire n'est démontré par cet audit.

## Envoi des commentaires

Le client récent transmet notes, texte, tags et photos via un upsert complet de la visite. Il conserve une file locale durable et distingue enregistrement distant et envoi en attente. Un update à zéro ligne n'est plus acquitté comme réussi. Les tests couvrent aussi le rejeu d'une ancienne visite qui ne doit pas écraser son nouvel avis.

Le code ancien de `main` avait un update partiel considérant l'absence d'erreur comme un succès, même à zéro ligne. Ce défaut est déjà corrigé dans la lignée récente. La version installée doit être identifiée avant de conclure qu'un appareil bénéficie du correctif.

Les deux avis communautaires du 9 octobre prouvent que des avis atteignent le serveur ; leur texte est vide. Ils ne prouvent ni que tout texte envoyé arrive, ni qu'aucun autre texte n'est resté en attente. Il faut le compte, le lieu, la date et le build du commentaire concerné, puis une lecture authentifiée de sa ligne et de la file locale. Aucun nouveau commentaire d'essai n'a été publié pendant cet audit.

## Correction préparée et validation

- Liste Lieux : compteur « Avis communautaires », explication des fondateurs et lien « Voir les avis » disponible même à zéro.
- Modération : filtre `place_id` sans exclusion des fondateurs et retour à tous les lieux.
- `editorial/mission1-2026-10/reviews.json` : dix textes, un par lieu, repris à l'identique d'un avis fondateur. Date de visite issue du fichier source ; identifiant public et attribution vérifiés. Aucun jugement ou sous-note inventé.
- Admin : 200 tests, ESLint et build TypeScript/Vite réussis ; build reconstruit avec l'URL et la clé publique du backend réel.
- Mobile inchangé : TypeScript, vocabulaire, i18n et 1 080 tests réussis, 4 ignorés, 4 snapshots réussis.

Le profil mobile Alexandre et le compte staff Xtincell sont distincts. Les trente attributions mobiles existent déjà. Les dix avis du nouvel espace doivent être publiés via `save_editorial_review` avec la session nominative staff Xtincell, après vérification de `current_staff()`.

Aucun secret Coolify ou Supabase serveur n'est configuré dans l'environnement au moment de l'audit. Aucun déploiement, migration, import privé ni publication des dix nouveaux avis éditoriaux n'a été exécuté. Restent : accès serveur, sauvegarde, migration 0075, rebuild admin sur la bonne branche, publication sous Xtincell et recette authentifiée app → serveur → admin.

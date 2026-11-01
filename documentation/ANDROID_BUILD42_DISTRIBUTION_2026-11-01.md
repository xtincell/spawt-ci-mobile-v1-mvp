# Distribution Android SPAWT — build 42

**Réception achevée le 1er novembre 2026 à 01:03:01 UTC, soit 02:03:01 à Douala.** Le canal officiel indique le build 42 et **le téléchargement complet avec interruption puis reprise est validé**.

## Publication officielle confirmée

La [release SPAWT Android 1.1.1 — build 42](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/tag/local-build-android-2026-10-30-42), numéro public **430283547**, a été publiée le 1er novembre à 00:58:02 UTC, soit 01:58:02 à Douala. Elle est publiée comme préversion GitHub : `draft=false`, `prerelease=true`.

Le tag exact `local-build-android-2026-10-30-42` pointe vers le commit [`360d181c9c15c6378b06ec41893afeb6a653f120`](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/commit/360d181c9c15c6378b06ec41893afeb6a653f120). Les **dix fichiers de la release** correspondent au lot préparé : noms, tailles et empreintes SHA256 concordants, selon les [métadonnées publiques de la release](https://api.github.com/repos/xtincell/spawt-ci-mobile-v1-mvp/releases/tags/local-build-android-2026-10-30-42).

La [publication 41219261126](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41219261126), **tentative 2**, est terminée avec le résultat `success`. Le [manifeste officiel latest.json](https://raw.githubusercontent.com/xtincell/spawt-ci-mobile-v1-mvp/android-releases/latest.json) contient :

| Élément | Valeur confirmée |
|---|---|
| Version / build | `1.1.1` / `42` |
| APK | `spawt-1.1.1-build42.apk` |
| Taille | `162537663` octets |
| SHA256 | `2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7` |
| Source applicative | `8cf7ea89ef7610b69c28f7608218f4e005dbdc30` |

L’[APK publié](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/download/local-build-android-2026-10-30-42/spawt-1.1.1-build42.apk) conserve les preuves de la [compilation originale 41117097867](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41117097867) et de la [QA native 41123847019](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41123847019). Ces références restent inchangées dans le manifeste. La [compilation automatique 41259057033](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41259057033), déclenchée par la création du tag, est terminée avec le résultat `cancelled`.

## Portail déployé et téléchargement validé

Le commit [`9399cf191f1be95eef85fa3f899d56ee83df4c0c`](https://github.com/xtincell/project_spawt_mobile_ci/commit/9399cf191f1be95eef85fa3f899d56ee83df4c0c), branche `codex/build42-downloads`, est déployé ; sa [CI 41219751999](https://github.com/xtincell/project_spawt_mobile_ci/actions/runs/41219751999) est réussie. Le contrôle de santé est passé à `healthy` à 01:01:59 UTC (02:01:59 Douala), puis la mise à jour progressive s’est terminée à 01:02:05 UTC (02:02:05 Douala).

La réception publique est réussie, avec validation TLS du certificat et du nom d’hôte, sans authentification applicative ni cookies :

| Contrôle | Résultat |
|---|---|
| [APK 42 local](https://spawt.online/downloads/spawt-1.1.1-build42.apk) | Téléchargement complet de **162537663 octets** ; SHA256 intégral identique à celui du manifeste ci-dessus. HEAD 200, type APK et `Content-Disposition: attachment` corrects. |
| Interruption et reprise | Coupure volontaire après **8 Mio**, soit 8388608 octets ; reprise **206** avec `If-Range`, plage exacte `8388608-162537662/162537663` et ETag conservé. |
| [Lien stable latest](https://spawt.online/downloads/spawt-latest.apk) | Redirection **307** vers 42 avec `Cache-Control: no-store` ; même résultat pour son fichier SHA256. |
| Alias HTTPS | [www.spawt.online](https://www.spawt.online/downloads/spawt-1.1.1-build42.apk) et [portail.spawt.online](https://portail.spawt.online/downloads/spawt-1.1.1-build42.apk) valides, réponse finale 200. |
| [Build 41 conservé](https://spawt.online/downloads/spawt-1.1.1-build41.apk) | HEAD 200, fichier SHA256 conforme, plage de 1024 octets reçue en 206. **Aucun nouveau calcul intégral du SHA256 du build 41.** |
| Version inconnue 999 | Réponse HTTP **404** réelle. |

La [page officielle de statut](https://spawt.online/statut) affiche le build 42, son bouton de téléchargement local, 155 lieux publiés et 100 coordonnées éligibles au Guet. Les deux boutons Android de l’accueil pointent également vers le fichier local du build 42.

Preuves de cette réception : [reçu JSON public](android-build42-distribution-2026-11-01.json) et [capture du site officiel](android-build42-distribution-2026-11-01.jpg).

## Limites de qualification conservées

La [qualification publiée](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/download/local-build-android-2026-10-30-42/release-qualification.json) conserve les trois limites suivantes :

| Indicateur | État |
|---|---|
| `fullLiveReceipt` | `false` |
| `consoleModerationReceipt` | `false` |
| `physicalGuetReceipt` | `false` |

Ces résultats valident le parcours de téléchargement contrôlé. Ils ne garantissent pas la réussite sur tous les réseaux et ne constituent pas un audit d’intrusion. La recette complète en conditions réelles, la console de modération et la réception physique du guet restent à valider.

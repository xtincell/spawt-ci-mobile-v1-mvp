# SPAWT Android 1.1.1 — build 42

Raccordements au référentiel SPAWT v2, sans changement de design :

- Accès B2C gratuit, cinq axes existants accessibles et restrictions Gold retirées.
- Compteur de lieux distincts, séparé des favoris et des passages non admissibles.
- Signaux réels du lieu utilisés pour l’apprentissage du Palais ; avis et Palais conservés et synchronisés après une coupure.
- Vérification de présence répercutée dans l’historique et la progression.
- Fraîcheur du classement raccordée aux dernières visites vérifiées, avec les poids existants.
- Cycle du Guet raccordé aux changements de flag, permissions et compte.

Installation par-dessus le build 41 réussie sur Android 35, avec la même signature.

## Qualification de publication

Ce build est qualifié par le profil explicite **`raccordements`** : le binaire signé et la recette native ciblée révision 2 ont été reçus. La diffusion du candidat sur le canal Android officiel conserve les réceptions encore ouvertes dans un reçu public distinct, `release-qualification.json`.

[Compilation complète `41117097867`](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41117097867) et [recette ciblée corrigée `41123847019`](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/41123847019) réussies. Les **31 assertions natives** passent. Firebase, l’ouverture animée, l’installation 41 → 42, les sorties, la reprise hors connexion, le partage/révocation, les App Links et l’isolation entre comptes ont été reçus. Les cinq axes, le lien Réglages et le badge build 42 ont également été examinés sur les deux captures de profil publiées avec l’APK.

Les originaux de la recette sont identifiés par leurs empreintes. Le reçu public reprend les contrôles et leurs résultats, sans publier les identifiants de comptes ou de listes de recette. Le profil complet reste le comportement par défaut du circuit de publication ; ce profil ciblé est limité au build 42, à son empreinte et à ces deux exécutions précises.

## Données raccordées

La fraîcheur du catalogue est fournie par la migration 0091. La correction cartographique 0092 accepte une position sourcée sans inventer une précision GPS. La lecture publique du 31 octobre reçoit **100 lieux éligibles au Guet**, sur 155 fiches publiées : 98 positions conservées et deux corrections documentées. Les quatre activations du Guet sont présentes. Le compte rendu `GUET_CARTOGRAPHIE_2026-10-31.md` détaille cette vérification.

APK remise : `spawt-1.1.1-build42.apk`, 162 537 663 octets, SHA-256 `2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7`.

## Réceptions encore ouvertes

- Réception native complète des contenus et retours : `fullLiveReceipt=false`.
- Réception complète avec la console et la modération : `consoleModerationReceipt=false`.
- Déclenchement réel du Guet, permissions et notifications sur téléphone physique : `physicalGuetReceipt=false`.

Ces valeurs restent explicitement fausses dans le reçu de qualification publié. Les tests automatisés et la recette sur émulateur ne constituent pas ces réceptions. Le build 42 utilise le catalogue cartographique raccordé ; la recette physique du mécanisme reste à effectuer.

Les résultats et limites sont consignés dans `BUILD42_RACCORDEMENTS_2026-10-30.md`, `android-build42-artifact.json`, `android-build42-native-receipt.json` et `GUET_CARTOGRAPHIE_2026-10-31.md`.

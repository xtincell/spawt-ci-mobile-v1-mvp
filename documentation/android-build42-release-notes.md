# SPAWT Android 1.1.1 — build 42

Raccordements au référentiel SPAWT v2, sans changement de design :

- Accès B2C gratuit, cinq axes existants accessibles et restrictions Gold retirées.
- Compteur de lieux distincts, séparé des favoris et des passages non admissibles.
- Signaux réels du lieu utilisés pour l’apprentissage du Palais ; avis et Palais conservés et synchronisés après une coupure.
- Vérification de présence répercutée dans l’historique et la progression.
- Fraîcheur du classement raccordée aux dernières visites vérifiées, avec les poids existants.
- Cycle du Guet raccordé aux changements de flag, permissions et compte.

Installation par-dessus le build 41 réussie sur Android 35, avec la même signature.

## État du candidat

La migration de fraîcheur 0091 est déployée. Le drapeau Guet est activé depuis le 30 octobre 2026 à 17:52:33 UTC. Aucun lieu ne possède encore de preuve GPS terrain admissible : le Guet n'a donc actuellement aucune zone à surveiller.

Compilation complète `41117097867` et recette ciblée corrigée `41123847019` réussies. Les 31 assertions natives passent ; les cinq axes, le lien Réglages et le badge build 42 sont confirmés sur les captures. Firebase, l'ouverture animée, les sorties, le partage/révocation et l'isolation entre comptes sont reçus dans cette recette.

APK remise : `spawt-1.1.1-build42.apk`, 162 537 663 octets, SHA-256 `2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7`.

La recette native ciblée est distincte de la réception complète avec la console et du test physique du Guet. Le canal de téléchargement public reste sur le build 41 jusqu'à réception des contrôles de publication existants. Les résultats et limites effectifs sont consignés dans `BUILD42_RACCORDEMENTS_2026-10-30.md`, `android-build42-artifact.json`, `android-build42-native-receipt.json` et `android-build42-server-receipt.json`.

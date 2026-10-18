# Firebase Android et téléchargement officiel — 18 octobre 2026

Le projet Firebase existant `spawt-ci` est accessible par la connexion officielle
Firebase CLI autorisée par le propriétaire. L’application Android
`com.upgraders.spawt` y est enregistrée avec les empreintes SHA-1/SHA-256 du
certificat déjà utilisé pour les APK SPAWT.

## Configuration reçue

- Application Firebase : `1:784936275475:android:3592fb2dc6cc9ffc0a39e6`.
- Projet Expo : `15ac2301-e901-4caa-a8c8-864c6621bcd0`, compte `xtincell`.
- Compte technique : `spawt-expo-fcm@spawt-ci.iam.gserviceaccount.com` ; seul rôle
  projet : `roles/firebasecloudmessaging.admin`.
- API FCM active et clé FCM v1 associée aux credentials Android Expo.
- Validation Google de cette clé réussie avec `validate_only: true`. Aucun
  message réel ni campagne envoyé. CI :
  https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39143630770.
- Preuves structurées : `firebase-configuration-2026-10-18.json`.

`app/google-services.json` contient la configuration **cliente**, distribuée dans
l’APK. Il ne contient pas la clé privée du compte de service. Cette dernière a été
créée dans la CI puis transmise directement à Expo, sans dépôt ni artifact secret.
L’identité temporaire Google était limitée au dépôt, au tag et au workflow de
configuration, avec une échéance. Son autorisation a été retirée et son fournisseur
désactivé après réception. Les deux clés temporaires inutilisées ont été supprimées.

## Binaire et réception

Le build 35 compile la source `f265ae2a14ca01ee3b919a52aee6aac8c960ab9b`, après les
contrôles mobile et admin. Les contrôles de compilation vérifient le projet Firebase,
le package et les quatre ressources natives nécessaires, en plus de la signature et
de la configuration Supabase. Sa compilation est encore en cours au moment de cette
note ; elle ne constitue pas encore une livraison.

Aucun téléphone n’était enregistré côté serveur à 16:16 UTC. L’émulateur permet
de vérifier le démarrage et l’initialisation Firebase ; il ne remplace pas un test
de réception sur le téléphone du propriétaire. Les données applicatives, avis et
publications restent dans le backend Supabase existant.

## Mise à jour automatique du site

Après publication vérifiée, `scripts/publish-android-channel.mjs` avance le fichier
`latest.json` de la branche `android-releases`. Il contrôle l’empreinte de l’asset
publié par GitHub, refuse un retour vers un ancien build et refuse de remplacer les
octets d’un numéro déjà publié. Le workflow vérifie aussi la recette native avant
publication. La concurrence est sérialisée entre les publications Android.

La vitrine reçoit ce manifeste au chargement, au retour dans l’onglet et toutes les
cinq minutes visibles. Elle met à jour ensemble le lien, le nom de fichier et le
numéro affiché. Une publication suivante ne nécessite pas de redéploiement du site.
Une réponse invalide, plus ancienne ou indisponible conserve le dernier lien valide ;
un nouveau chargement dispose de l’APK local intégré à la vitrine. Le cache public
peut ajouter quelques minutes de délai.

Les tests du portail couvrent les deux boutons, le refus des liens étrangers,
l’absence de régression et les pannes. Une recette Chromium a également reçu une
publication simulée puis vérifié les replis sans erreur JavaScript. La publication
réelle et le déploiement final doivent encore être consignés après compilation.

# Firebase Android et téléchargement officiel — 18 octobre 2026

Le projet Firebase existant `spawt-ci` est accessible par la connexion officielle
Firebase CLI autorisée par le propriétaire. L’application Android
`com.upgraders.spawt` y est enregistrée avec les empreintes SHA-1/SHA-256 du
certificat déjà utilisé pour les APK SPAWT.

**Livré** : [APK Android 1.1.1 — build 35](https://spawt.online/downloads/spawt-1.1.1-build35.apk), disponible depuis les deux boutons de [spawt.online](https://spawt.online).

## Configuration reçue

- Application Firebase : `1:784936275475:android:3592fb2dc6cc9ffc0a39e6`.
- Projet Expo : `15ac2301-e901-4caa-a8c8-864c6621bcd0`, compte `xtincell`.
- Compte technique : `spawt-expo-fcm@spawt-ci.iam.gserviceaccount.com` ; seul rôle
  projet : `roles/firebasecloudmessaging.admin`.
- API FCM active et clé FCM v1 associée aux credentials Android Expo.
- Validation Google de cette clé réussie avec `validate_only: true`. Aucun
  message réel ni campagne envoyé. CI :
  https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39143630770.
- API Firebase Installations et FCM Registrations actives. Enregistrement réel avec la configuration cliente réussi, puis installation temporaire supprimée ; aucun téléphone impliqué dans cet essai.
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
de la configuration Supabase. La compilation [39143492062](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39143492062) est réussie :
162 454 527 octets, SHA-256 `53b7dcb40f0718484b10541a078c24382951536d5ab8c26a846cc4078f8c4086`.
La [recette Android 35](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39146032702) est réussie : cinq assertions de démarrage/réouverture, animation visible, zéro surface noire et initialisation Firebase confirmée dans le processus SPAWT. Captures natives examinées. Aucun OTP ni compte utilisé.

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
publication simulée puis vérifié les replis sans erreur JavaScript. La [publication réelle](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39146376114) est réussie : manifeste public build 35 reçu, fichier complet téléchargé depuis le site avec taille et SHA-256 exacts.

## Déploiement reçu

- Portail `5dc7357d44537b0d115c76e272917b4a750baf3d`, déploiement Coolify `aca81amlluymnkhn3gbj1lum` terminé à 16:50:26 UTC ; service sain.
- Contrôle Chromium public à 16:50 UTC : deux boutons build 35, lecture du manifeste HTTP 200, repli en panne HTTP 503, aucune erreur JavaScript et ancienne mention build 32 supprimée.
- APK complet téléchargé depuis `spawt.online` : taille et empreinte identiques au binaire testé. Type MIME Android et téléchargement en pièce jointe vérifiés.
- `spawt.online`, `www.spawt.online` et `portail.spawt.online` répondent HTTP 200 ; CSP compatible avec le manifeste.
- 47 tests vitrine, TypeScript, vocabulaire et build Vite réussis ; CI finale `39146715344`. Source mobile : 1 085 tests réussis (quatre ignorés), TypeScript/vocabulaire/i18n ; CI admin : 205 tests. Six tests Node des gardes Firebase/publication réussis.
- Changements poussés dans les [PR produit 17](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/17) et [portail 11](https://github.com/xtincell/project_spawt_mobile_ci/pull/11). Le déploiement utilise les commits contrôlés, indépendamment de leur fusion.

## Publications suivantes

1. Compiler une source contrôlée avec un nouveau numéro de build et la signature existante.
2. Exécuter la recette native sur cet APK précis.
3. Renseigner `documentation/android-release.json` avec les empreintes et les identifiants des deux exécutions réussies ; ajouter les notes de version.
4. Pousser le tag `publish-android-…` sur ce commit. Le workflow vérifie les preuves, publie l’APK et avance le manifeste public. Le site le reçoit automatiquement.

Une compilation seule ou une release créée manuellement hors de ce circuit ne change pas le bouton. Ne jamais remplacer un APK déjà publié sous le même numéro.

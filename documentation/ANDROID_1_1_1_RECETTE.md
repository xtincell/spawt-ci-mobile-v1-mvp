# SPAWT Android 1.1.1 — recette et déploiement

## État de livraison

APK preview **1.1.1 — build 27 — 2026-10-10** : compilation signée et recette native réussies ; APK publiée et téléchargement public vérifié sans authentification.

- [Compilation signée sur le runner GitHub](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38019749515).
- Le [build cloud EAS](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38011461473) a été refusé avant compilation : quota Android gratuit mensuel épuisé. Le mode [EAS local officiel](https://docs.expo.dev/build-reference/local-builds/) compile le même code sur le runner, en récupérant uniquement les credentials existantes. La signature est identique aux APK 9 et 25 ; aucun abonnement n’a été souscrit.
- [Contrôles source du build 27](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38019577015) : 1 017 tests mobile et 191 admin réussis.
- Tag `local-build-android-2026-10-10-27` ; source APK `6ba39d2b8b54c2bd7e5867b1dad6334a914df5f8`.
- [Téléchargement direct de l’APK](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/download/local-build-android-2026-10-10-27/spawt-1.1.1-build27.apk). Taille : **162 284 323 octets**. Version et numéro de build confirmés par le package installé sur Android.
- [Capture Android de l’ouverture](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/download/local-build-android-2026-10-10-27/ouverture-android-build27.mp4).
- SHA-256 : `587217be5efae3664d698b913db6a1b19745a254836fb434ea530592294e39c8` ; CRC ZIP et signature contrôlés. Certificat SHA-256 identique à la release 9 : `6c909bf0eddc02b8b50a0bbdc149f5deda87103ad18bc9fecc663d7ef6b52e74`.
- Première compilation locale arrêtée : Kotlin KSP a épuisé les 512 MiB de Metaspace du réglage standard. Le runner reçoit maintenant 4 GiB de heap et 2 GiB de Metaspace, deux workers et compilation Kotlin dans le processus Gradle. Les propriétés du [dossier utilisateur Gradle](https://docs.gradle.org/current/userguide/build_environment.html) priment sur celles du projet ; la [stratégie Kotlin](https://kotlinlang.org/docs/gradle-compilation-and-caches.html) est documentée. Un manque de mémoire provoque désormais une sortie immédiate.

## Corrections

- Cartes de lieux sur deux lignes ; nom complet dans la fiche et le formulaire.
- Profil contraint à la largeur disponible, hauteur adaptée au texte, compteurs lisibles.
- Bouton d’avis déplacé avec le clavier Android ; formulaire défilable.
- En-têtes d’accueil et de favoris repliables ; libellés de modes dimensionnés au texte système.
- Pluriels français restaurés sur Hermes et libellés de photos complétés.
- Cuisine, cadre, service obligatoires ; moyenne détaillée à une décimale et entier historique.
- Visite durable avant avis, boutons protégés contre le double appui et erreur détectée à zéro ligne.
- Brouillons et fichiers photos conservés après erreur ou fermeture ; reprise automatique de la file réseau.
- Moka partagé pour les profils sans photo et les images défaillantes ; remplacement par une photo accessible.
- 30 avis fondateurs attribués publiquement au profil mobile Alexandre, sans modifier leur propriétaire technique.
- Photos communautaires privées ; signature réservée aux photos d’avis visibles sur un lieu publié.
- Console : auteur attribué, trois notes et suppression auditée des comptes démo.

## Ouverture fournie et splash natif

Le pack `SPAWT-fenetre-V2-pack.zip` fourni par Alexandre remplace l’ancienne
ouverture. Le PNG `repere-carte.png` est copié à l’identique dans les assets.
Sur Android, le splash système blanc utilise un VectorDrawable produit depuis
les mêmes tracés, avec la pointe entière cadrée dans le masque système.
Le générateur `scripts/build-window-splash.py` vérifie cette limite.

L’ouverture reprend les **69 images exactes** du MP4 fourni, sur deux textures
PNG de 1 750 × 2 000 px, chacune sous 2 048 px. Les images sont recadrées à
250 × 400 px, puis affichées dans un cadre de 200 × 320 dp : surgissement,
rebond, étoiles, clin d’œil et réouverture. Les deux textures sont chargées
avant le retrait du splash. Reanimated déplace les cadres sur le thread UI ;
React ne rend pas une nouvelle image à chaque frame. La durée nominale est
1,15 seconde ; une frame UI tardive ralentit la séquence pour conserver ses
poses. Un délai borné et un repère de secours gardent l’accès à l’application.
Le générateur `scripts/build-window-sprites.py` contrôle l’empreinte du MP4,
les 69 cadres, le cadrage et la taille des textures. Le grand atlas reste une
référence du contrôle visuel. La fréquence source de 60 images/s ne constitue
pas une mesure de fluidité sur téléphone.

Le splash attend les polices, les textures et la disposition de la surface.
Android confirme ensuite son retrait réel sur le thread UI ; React peint
également le relais avant le mouvement. Le fondu natif est désactivé. La sortie
de 260 ms retire d’abord l’illustration, puis l’overlay, pour rejoindre la route
restaurée. Une restauration lente conserve la pose finale. Passage tactile,
réduction des mouvements et fin unique restent couverts. La politique OTA est
`nativeVersion`, pour isoler les APK avec ce nouveau module ; aucune OTA publiée.

Le module local `SpawtOpening` prépare l’écoute avant `hideAsync`, retire la vue
splash dans le callback Android, puis confirme deux frames sur le thread UI.
Avant Android 12, le relais attend le premier dessin de la vue. Un secours
borné couvre une activité déjà visible. L’autolinking reconnaît le module local.

Les builds vidéo intermédiaires ont été refusés après inspection Android :
le build 25 produit 29 échantillons noirs et le build 26 en produit 33, sans
clin d’œil visible. Un second moteur graphique SwANGLE reproduit le défaut
avec 30 échantillons noirs. Le décodeur Goldfish de l’émulateur signale que le
format 350 × 560 à 60 images/s dépasse ses capacités. La livraison finale
utilise les images PNG et n’embarque plus le lecteur Expo Video.

La capture d’ouverture garde 393 × 800 dp avec une surface 1x, encodée à
392 × 800 px (largeur paire) ; les proportions sont contrôlées. Les gestes et
la matrice conservent leurs captures 3x. Le moteur `software` actuel remplace
`swiftshader_indirect`, [déprécié depuis 36.4.9](https://developer.android.com/studio/run/emulator-acceleration).
Le contrôle exige surgissement, clin d’œil, réouverture et absence de surface
noire. La capture native du build 27 réussit ces quatre contrôles et son
inspection manuelle confirme les poses du pack fourni.

SHA-256 du pack fourni :
`9ce5ac80c4987eaa6ba0889a1cb9b825b747233961d1f57b19699d9176cfd4ee`.
SHA-256 du PNG original, identique au fichier du pack :
`2f9cedb45026128614d56ff75a93201a6fcfa74242c4f695f137226e73f5629f`.

## Contrôles source et base

1 017 tests mobile réussis, quatre ignorés ; 191 tests admin réussis.
TypeScript, vocabulaire, i18n, lint/build admin et conformité du cahier validés.
La CI du build final confirme les contrôles mobile avant compilation.
21 tests ciblés de l’ouverture et du relais réussissent. Le navigateur du
build 27 rejoint l’écran d’entrée sans erreur JavaScript ; les styles observés
passent de la première texture à la seconde et rejoignent la pose finale.
Cette vérification web ne remplace pas la capture de l’APK Android.

Les migrations 0071–0074 ont passé leur aller-retour transactionnel sur le
schéma réel avant application. `supabase/tests/review_delivery.sql` vérifie
5/4/4 → 4,3, le recalcul des moyennes, les sous-notes partielles refusées,
la modification d’une note simple par une ancienne APK, les 30 attributions,
les droits de signature, ainsi que la purge des 30 fondateurs dans une transaction
annulée. Aucun avis fondateur n’a été supprimé de la base alpha.

## Recette Android native

Android 35, émulateur Google APIs avec KVM, installé par le SDK Android officiel.
ADB cible uniquement `emulator-5554`. Connexions OTP avec de vrais JWT Supabase
sur deux profils synthétiques alpha ; le SMS reste simulé.

La matrice utilise 320, 360, 393 et 430 dp, chacune avec texte à 100 %, 130 % et
150 %, à une hauteur de 800 dp. Les captures couvrent accueil, listes, profil, recherche, favoris, fiche,
formulaire et clavier dans chaque combinaison. Les captures PNG/XML et les
fenêtres Android permettent de vérifier les limites de la carte profil, les
noms de lieux, les en-têtes et la position du bouton au-dessus du clavier.

La recette fonctionnelle vérifie :

- Démarrage animé à froid et restauration d’un compte connecté sans plantage natif.
- Refus caméra : message exploitable et retour au formulaire.
- Sélection réelle dans le sélecteur Android et miniature du brouillon.
- Envoi de photo sans réseau : alerte « Avis non envoyé », absence de publication et brouillon conservé après arrêt du processus.
- Double appui : un seul avis avec cuisine 5, cadre 4, service 4, moyenne 4,3 et une photo.
- Lecture anonyme : JPEG obtenu par URL signée du bucket privé.
- Avis sans photo hors ligne : reçu « en attente d’envoi », puis publication automatique unique au retour réseau.
- Moka sur deux profils sans photo, puis photo personnelle persistée.
- Second compte natif : auteur, photo, trois notes et moyenne visibles.
- Avis fondateurs : nom Alexandre, avatar Moka et badge fondateur.
- Publication depuis « Spawt le ! », puis lecture après redémarrage et au-delà du résumé des cinq premiers avis.

La [matrice du build 17](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/37987169753)
a réussi ses **165 assertions**. Les neuf planches ont été inspectées :
accueil, cartes, profil, recherche, favoris, fiche, titre du formulaire,
notes et clavier. Les 12 fenêtres IME réelles confirment le bouton entièrement
au-dessus du clavier, avec une marge minimale de **56 dp**, par
`scripts/android-keyboard-proof.py`. La publication depuis la fiche et sa
lecture après arrêt du processus réussissent. Aucun plantage natif ni
TypeError/ReferenceError n’apparaît dans le journal capturé.

Le build 27 conserve exactement ces écrans et le formulaire ; son changement
runtime porte sur les images V2 animées sur le thread UI et le relais natif.
La [recette photos/réseau du build 17](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/37987169457)
a passé ses **31 assertions**, avec inspection des captures. Elle fournit une
preuve fonctionnelle ; sa vidéo d’ouverture a été refusée après inspection.

La [recette finale du build 27](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/38022121379)
réussit ses **31 assertions**. Les 12 captures principales regroupées en deux
planches ont été inspectées : Moka, refus caméra, miniature sélectionnée,
brouillon conservé après panne et redémarrage, publication, attente d’envoi,
photo personnelle, second compte, auteur fondateur, lecture des avis et
restauration de session. Le journal ne signale aucun plantage SPAWT ni
TypeError/ReferenceError JavaScript.

La capture ADB de cette recette valide le surgissement, le clin d’œil et sa
réouverture : **45 images**, **1,5 s** de présence continue, déplacement initial
mesuré de **119,93 px**, **six images d’œil fermé puis 18 de réouverture**,
**zéro surface noire**. La planche de mouvement a été inspectée manuellement.
Un premier run du même APK avait validé l’ouverture mais s’était arrêté avant
l’écran OTP. Le script attend maintenant l’activation du formulaire et laisse
45 s pour observer également l’erreur réseau bornée à 30 s. La recette finale
confirme deux connexions et sessions réelles sur cet APK inchangé.

Le contrôle `scripts/android-opening-proof.py` analyse la vidéo ADB à 30 images/s.
Il exige plusieurs images consécutives de Moka sur fond blanc, un déplacement
du centre du doré pendant ses premières 450 ms, puis l’œil fermé et sa réouverture.
La comparaison utilise les cadres exacts du pack, avec une tolérance de centrage
d’un pixel et de compression vidéo. Le contrôle de présence/mouvement a refusé
les builds 17 (une image) et 18 (pose immobile). Le contrôle complet refuse le
build 19 (aucun clin d’œil) et le build 20 (surgissement figé). Un contrôle
assemblé depuis le MP4 natif réussit (5 images d’œil fermé, puis 23 de
réouverture). Le centrage du repère est calculé depuis sa position majoritaire
avant le mouvement. Ce contrôle assemblé sert à
vérifier le détecteur et ne constitue pas une preuve d’exécution Android.
La preuve native et l’inspection manuelle restent nécessaires ; aucune fluidité
sur téléphone n’est déduite du nombre d’images source.
Le diagnostic Android refuse aussi les plantages du processus SPAWT.

Les originaux PNG/XML, vidéo et assertions sont conservés 14 jours dans les
artefacts GitHub `android-proof` ; `android-preview` contient les planches.
Scripts : `scripts/android-qa.py` et `scripts/android-proof-preview.py`.
Les données des essais antérieurs ont été nettoyées avant cette recette.
Après la recette finale, sa photo et son avatar ont été supprimés par l’API
Storage, puis ses deux profils par la fonction admin auditée. Les huit contrôles
finaux confirment zéro profil, compte Auth, visite ou fichier de recette restant,
30 avis fondateurs et 30 attributions, deux comptes démo fournis conservés, et
le compteur du profil mobile Alexandre inchangé à un. Deux suppressions sont
inscrites dans le journal admin.

## Déploiement et retour arrière

Backend alpha : `https://api.spawt.online`. Migrations appliquées et cache
PostgREST rechargé. Sauvegarde avant migration :
`/home/xtincell/spawt-release-backups/before-1.1.1-build10.dump`.
Les migrations `.down.sql` appariées sont fournies ; elles doivent être appliquées
dans l’ordre inverse, après sauvegarde des nouvelles notes détaillées.

Console : `https://admin.spawt.online`. Bundle publié atomiquement après sauvegarde
`/home/xtincell/spawt-release-backups/admin-before-1.1.1.tar.gz` ; asset
`/assets/index-DGPQrGNM.js` reçu en HTTP 200 et identique à l’asset validé localement.
Coolify `spawt-admin` référence la branche `codex/audit-avant-compilation` et le
commit `1735137440a94eb112cfd20b30f536492e988223` pour reproduire cette version.
La configuration précédente était `claude/app-finale-ios-android-f8ewrp`, `HEAD`.
Le retour de console restaure le bundle sauvegardé et cette configuration.

La requête PostgREST exacte de la modération a été exécutée sur la base alpha :
30 avis fondateurs, 30 auteurs attribués Alexandre, propriétaire technique
inchangé et anciennes sous-notes toutes nulles. Le rôle du compte staff
Alexandre est actif. La nouvelle console n’a pas fait l’objet d’une nouvelle
connexion navigateur dans cette recette ; son code, ses tests, son bundle
public et la requête de données ont été vérifiés.

## Limites

La recette Android est faite sur émulateur ; elle ne mesure pas la fluidité sur
un téléphone physique. SMS réel, GPS réel et notifications ne sont pas validés
par cette recette. Aucun IPA ni OTA publié. Quatre tests mobile restent ignorés.
Le redémarrage validé utilise le lanceur Android, puis la navigation vers le lieu ;
les liens externes reçus à froid ne sont pas validés par cette recette.
L’installation des dépendances après retrait du lecteur signale 67 alertes
npm (aucune critique). Leur portée runtime n’a pas fait l’objet d’un audit
de sécurité dans cette livraison.
Les demandes followers, membre actif et autres fonctions historiques restent
hors de cette mise à jour.

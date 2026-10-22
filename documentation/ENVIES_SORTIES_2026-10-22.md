# SPAWT — livraison reçue du 22 octobre 2026

## Livraison

**Android 1.1.1 / build 41** est publié, installé en recette par-dessus le build 40
avec le même certificat. Les deux boutons du site et leur repli local proposent
le fichier vérifié. Le canal suit ensuite les versions publiées après réception.

- [Téléchargement officiel](https://spawt.online/downloads/spawt-1.1.1-build41.apk)
- [Release et preuves publiques](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/releases/tag/local-build-android-2026-10-22-41)
- [Sept contrôles publics des contenus](https://spawt.online/statut)
- [Fiche et menu IN’ Concept Store](https://spawt.online/lieu/c5acfd12-01dd-5cd3-9beb-0531d89c3e99)

| Composant | Version reçue |
| --- | --- |
| Source mobile | `e38c8f3ee5c6287e179ef70927ca4ea618ed1878` |
| Panel | `23e4eef249fecafedc76f81dad69889d8164e576` |
| Portail avec APK de secours | `2d1cdeb22f4ed2abb4e16a76e2f05584f4294c03` |
| Base | Migrations additives 0086–0089 |
| APK | 162,536,491 octets |
| SHA-256 | `62074f4dc68ec3c84dfce3f1e191b4353a3a1b8e6e979a7232600040dd0a6aa9` |

## Ce qui change

« Ça me tente » enregistre un lieu ou un plat. Les listes personnelles par occasion
se créent, se renomment, se suppriment et se partagent avec un lien révocable,
accessible sans compte sur le web et ouvrable dans l’app. Le groupe existant porte
les propositions et votes. Un choix explicite est distinct d’une visite.

L’accueil mêle éditorial et personnalisation ; « Choisir vite » et la hiérarchie
visuelle des raccourcis sont reçus dans le vrai APK. La recherche couvre plats,
variantes de nom et accompagnements. Les menus gardent source, prix observé et
date. **24 plats** de la carte officielle d’IN’ Concept Store ont été relus le
22 octobre et publiés. Cinq relevés de mars restent en brouillon. Aucune photo
non autorisée, aucun prix inconnu ni disponibilité du jour inventés.

Le catalogue reçu contient **155 lieux**, **111 points cartographiés**, **10 avis
éditoriaux**, **3 carnets** et **1 actualité**. Les fiches sans note restent sans
note ; les lieux sans coordonnées restent accessibles en liste. Les contributions
menu/GPS passent par la modération, avec reçu, décision lisible et récompense unique.

Les pages panel `/menus`, `/envies` et `/guet` sont déployées. La north star compte
les personnes distinctes ayant enregistré, proposé ou choisi une sortie sur sept
jours ; actifs 24/72 h, cohortes de retour et progression vers choix/visite restent
séparés. Comptes internes, fondateurs et bannis exclus ; pas d’activité historique
transformée en nouvel engagement, ni de visite créée par une proximité.

## Défaut corrigé et réception

La recette du premier candidat a révélé une course : une action ajoutée pendant
la lecture finale d’une synchronisation pouvait rester dans la file locale.
`syncOutings` attend désormais cette lecture puis envoie les nouvelles mutations
sous le même propriétaire. Deux tests couvrent la reprise et le changement de
compte. La régression échoue avant correction et réussit après ; une reproduction
Chromium sur l’interface confirme également le partage et la disparition de
l’attente. Ces fixtures locales sont clairement distinguées des preuves natives.

- [Compilation signée 39711862127](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39711862127) : intégrité, signature, identité, backend et Firebase embarqués reçus.
- [Recette native 39718577857](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39718577857) : mise à niveau 40→41, données réelles, recherche de plat, enregistrement hors ligne/redémarrage/reprise, listes et choix, partage anonyme, révocation et App Links Android, isolation entre comptes, sept lecteurs, retours/réponses et contributions/modération/Paws.
- [Captures et assertions du binaire reçu](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/tree/android-receipts/receipts/build-41/39718577857). Chaque preuve du parcours est liée à l’empreinte de ce nouvel APK ; les essais refusés n’ont pas servi de réception.
- CI source mobile/panel **39711634849** réussie ; 1 110 tests mobiles (4 ignorés), 231 tests panel, 50 tests portail. TypeScript, vocabulaire, i18n, compilation, PostgreSQL 15 et aller/retour des migrations, contrat Expo réel et nginx réel.
- `envies-reception/public-download41-proof.json` : deux boutons, panne simulée du canal, lectures publiques et téléchargement complet depuis le site avec taille/empreinte exactes.
- `envies-reception/repo-integration-proof.json` : branches des livraisons précédentes incluses ; correctif historique du compte à rebours repris à l’identique.

Les comptes de recette sont synthétiques et exclus des indicateurs. Les photos
techniques restent privées et sont rejetées ; la position simulée conserve les
coordonnées existantes, son justificatif technique est retiré après contrôle et
aucune visite n’est créée.

## Guet et limites

**Le Guet reste désactivé pour tous les publics.** Le binaire corrige événements
Expo, déclencheur SDK55, tâche sans montage React, permissions d’arrière-plan,
isolation des comptes et nettoyage à la déconnexion. Maximum 20 zones contrôlées,
rayon 150 m, rappel après deux minutes annulé lors d’un passage court. Messages
selon envie/visite, deux rappels par jour au total, silence local 22 h–9 h, même
type au même lieu au plus une fois par semaine. Un rappel d’avis exige une visite
explicite persistée. Aucune campagne Firebase n’a été envoyée par cette livraison.

Avant activation : réception sur téléphone physique au premier plan, en arrière-plan
et app fermée ; permissions refusées, passage court, changement de compte,
messages et limites. Seuls les points réellement contrôlés seront éligibles.
La présence serveur exige une mesure récente (≤120 s), précision ≤50 m et distance
≤100 m d’un point contrôlé ; cela ne prouve pas l’absence de GPS simulé sur un
appareil compromis. Une visite déclarée sans GPS reste possible sans certification.

Les anciens commentaires restés uniquement sur un téléphone ne sont pas déclarés
récupérés. Aide et retours permet désormais de vérifier les contenus, envoyer un
retour avec reçu serveur et relire la réponse privée de l’équipe.

Sauvegarde PostgreSQL vérifiée avant migration ; aucun redémarrage global du stack.
En cas d’incident, fermer la fonction concernée et conserver les données. Les
migrations descendantes ne s’appliquent pas sur des envies réelles sans sauvegarde
et plan de restauration. Réservation et édition collaborative des listes hors lot.

Sources produit : [Lean Canvas V5.1](https://docs.google.com/document/d/1XkpV-F41_8P-2YmSnJMGbFcFpmcqGL7jbeM-85eM9To/edit)
et documentation SPAWT du Drive ; les décisions de cette conversation sur listes
et north star priment sur l’ancienne mesure du Canvas.

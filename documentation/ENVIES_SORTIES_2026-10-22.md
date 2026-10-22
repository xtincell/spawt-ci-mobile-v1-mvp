# Envies de sortie — chantier du 22 octobre 2026

## Décisions acceptées

Une publication coordonnée app / panel / base / site, après le build 40.
North star : personnes distinctes ayant enregistré, proposé ou choisi une sortie
sur sept jours ; ouvertures, proximité et visites restent distinctes.
Accueil mêlant éditorial SPAWT et personnalisation. Enregistrement des lieux ET
des plats, listes personnelles partageables sur le web, vote via le groupe
existant. Réservation et édition collaborative des listes hors de ce lot.

## Réception à produire

- [x] Schéma additif, RLS, idempotence, compatibilité favoris du build 40.
- [ ] Plats documentés, recherche, publication/modération et actualisation.
- [x] Enregistrement, listes, partage révocable, choix et indicateurs serveur.
- [ ] Accueil hybride et retours contextuels, inspection des rendus.
- [ ] Guet : événements Expo réels, permissions natives, exécution sans React,
  comptes isolés, proximité distincte d'une visite, limitation des rappels.
- [ ] Pages publiques de partage et preuves de lecture sur le site.
- [ ] Gates mobile, panel, portail, migrations et recette APK.
- [ ] Déploiement reçu, signature / empreinte / canal de téléchargement vérifiés.
- [ ] Réception Guet sur téléphone réel avant activation publique.

## Base vérifiée

Mobile/panel : `32ad7cc` (PR 20), source livrée Android 40 `e072507`.
Portail : `5f9059b` (PR 16). Branches de travail : `codex/envies-sorties`
et `codex/envies-partage`. Aucun secret serveur déclaré dans l'environnement
au démarrage ; lecture GitHub disponible. Ne pas confondre préparation, tests
locaux, compilation, publication et réception réelle.

Défauts Guet confirmés : `eventType` lu dans `region` au lieu de `data` ;
déclencheur de notification sans type ; permission de localisation en arrière-plan
absente de l'APK 40 ; callback injecté seulement au montage de React ; attentes
globales et fausse vérification de présence à partir d'une entrée en zone.

Les anciens guides décrivent 10 m / 15 minutes / visite passive. Le plan accepté
les remplace pour la proximité : 150 m, rappel après deux minutes, aucune visite
automatique, coordonnées validées uniquement, deux sollicitations par jour,
un rappel de proximité par lieu sur sept jours, silence 22 h–9 h.

## Mise en œuvre préparée

- 0086 : plats sourcés et datés, envies de plats, listes privées par défaut, partage révocable, choix explicite. Mutations avec identifiant stable et propriétaire explicite ; les favoris existants ne sont pas transformés en nouvelle activité.
- 0087 : coordonnées contrôlées, invalidation en cas de déplacement du point, intégration aux contributions GPS approuvées. Interrupteur `guet-proximity-v2` fermé pour tous les publics.
- 0088 : vérification de présence côté serveur (position récente ≤120 s, précision ≤50 m, distance ≤100 m d’un point validé). Une visite explicite reste possible sans GPS ; la proximité ne crée aucune visite. Les vérifications historiques ne sont pas réécrites. Cela valide la cohérence d’une mesure transmise, pas l’absence de simulation GPS sur un appareil compromis.
- 0089 : NS sept jours, actifs 24/72 h, retours entre 24 et 72 h sur cohortes arrivées à maturité, enregistrement suivi d’un choix/d’une visite déclarée. Comptes internes/fondateurs/bannis exclus, pas d’attribution commerciale inventée.
- App : « Ça me tente », « Mes envies », listes par occasion, partage, vote via Crew, plats et accompagnements recherchables, accueil éditorial/personnalisé, reprise hors ligne isolée par compte, sept contrôles de données et retours contextuels.
- Panel : `/menus`, `/envies`, `/guet`. Menus à prix inconnu acceptés, édition concurrente détectée ; validation GPS auditée. Le circuit contributions/modération/Paws existant est conservé.
- Site : `/lieu/:id` et `/liste/:token` rendus côté serveur par la fonction `public-share`, HTML et aperçus sociaux, accès anonyme seulement, aucun cache de liste révoquée. App Links Android liés au certificat public existant. Deux nouveaux contrôles sur `/statut`.
- Guet : événement Expo corrigé, tâche sans montage React, déclencheur typé SDK55, permissions natives, contexte par compte, 20 zones proches maximum, annulation des passages courts, messages selon envie/visite, rappel d’avis seulement après une visite explicite persistée. Deux rappels/jour au total, silence local 22–9, rappel de même type au même lieu au plus une fois par semaine. Aucune campagne Firebase envoyée par ce chantier.

## Preuves locales

1 108 tests mobiles (4 ignorés), 231 tests panel cumulés, 50 tests portail ; gates TypeScript/vocabulaire/i18n/build ; tests SQL sur PostgreSQL 15 isolé, schéma complet et aller/retour des quatre migrations ; tests de propriété/idempotence/listes sur PGlite ; appel du vrai parseur Expo installé ; contrat de partage HTML ; configuration nginx testée dans l’image `nginx:alpine`.

Inspection Chromium à 393 px : page Envies, recherche de plat et accueil. Les contenus publics existants ont été relus anonymement ; le compte, les menus et les listes nouveaux sont des fixtures locales, toutes les écritures interceptées. Cette inspection n’est pas une réception en production ni une recette APK.

Cinq brouillons de plats documentés dans `editorial/envies-2026-10/menu-drafts.json`. Sources et dates originales de mars conservées. Ils restent à actualiser avant publication ; aucune photo, aucun prix ni disponibilité du jour inventés.

## Réception de la livraison 41

La version publique contrôlée le 22 octobre reste **1.1.1 / 40**. Les lecteurs publics des nouvelles tables répondent 404 : migrations non déployées. Les lectures actuelles répondent : 155 lieux, 10 avis éditoriaux, 3 carnets.

1. Sauvegarder la base et les paramètres, appliquer 0086–0089, contrôler les policies sous identité anonyme et deux comptes distincts. Garder le Guet fermé.
2. Déployer `public-share` (index et renderer), puis les commits panel/portail. Contrôler les routes avec une fiche publiée et une vraie liste ; une liste révoquée doit rendre 404, une panne 503. Contrôler `/.well-known/assetlinks.json` et le certificat du candidat.
3. Publier les plats uniquement après réception des sources actuelles. La suppression d’une publication doit disparaître de la recherche et des listes publiques ; l’historique privé garde un libellé identifiable.
4. Recette du candidat APK : recherche plat/alias, enregistrement hors ligne et reprise, changement de compte, liste/partage/révocation, choix, reprise depuis lien Android, sept lectures, retour et réponse du panel. Conserver `native-proof/outing-data.json` lié au SHA de l’APK ; la publication automatique 41 refuse une preuve absente.
5. Installer par-dessus le build 40, contrôler signature, Firebase natif, poids/SHA et démarrage. Publier seulement après réception app/base/panel/site, puis vérifier que le manifeste et les deux boutons passent ensemble au nouveau build.
6. Tester le Guet sur téléphone physique : premier plan/arrière-plan/app fermée, sortie avant deux minutes, permission refusée, changement de compte, quatre messages, cooldown et limites. Activer ensuite uniquement les lieux réellement contrôlés. Un succès du planificateur n’est pas une réception du téléphone.

Aucun accès Coolify authentifié n’est déclaré dans cet environnement. Le déploiement et la réception en ligne restent bloqués par cet accès ; le GitHub connecté permet de préparer les branches, les PR et le candidat de compilation. Les migrations `.down.sql` servent à tester la réversibilité ; ne pas les appliquer en production sur des envies réelles sans sauvegarde et plan de restauration.


Sources produit relues : [Lean Canvas V5.1](https://docs.google.com/document/d/1XkpV-F41_8P-2YmSnJMGbFcFpmcqGL7jbeM-85eM9To/edit) et documentation SPAWT du Drive. Les décisions de cette conversation sur la NS et les listes priment sur l’ancienne NS du Canvas.


## Contrôles GitHub reçus

- Source du candidat : `30b8f41e2229d727f516bbd3e2f62bf44063b382`.
- [CI app et panel 39700452723](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39700452723) : succès, y compris export web et contrats Expo/HTML.
- [PostgreSQL, migrations et contrats paiement 39700452815](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39700452815) : succès.
- [PR app/base/panel #21](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/pull/21) et [PR site #17](https://github.com/xtincell/project_spawt_mobile_ci/pull/17), en brouillon jusqu’à réception de la livraison coordonnée.
- Recette du candidat compilable : `documentation/android-build41.json`, lignée Android 40 reçue. La compilation ne publie ni l’APK ni le manifeste public.


[Aperçu local : Mes envies](envies-reception/envies.png) · [Recherche de plat](envies-reception/recherche.png) · [Accueil](envies-reception/accueil.png). Les fixtures sont explicites dans `envies-reception/visual-proof.json` ; aucun avis ni aucune envie de recette n’a été envoyé à la production.

Dernière correction avant compilation finale : l’affichage d’une zone attend aussi un contexte authentifié valide ; les notifications du Guet déjà affichées sont retirées à la déconnexion, sans toucher aux campagnes Firebase. Premier essai de compilation 41 arrêté pour intégrer ce contrôle (39700643440, aucun APK publié).


Source finale du candidat 41 : `e4106b0cfa638ed44884532847f0c79917dd384a`. [CI mobile/panel 39700994234](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39700994234) et [SQL 39700994214](https://github.com/xtincell/spawt-ci-mobile-v1-mvp/actions/runs/39700994214) reçues vertes après correction de la déconnexion. Site : [CI 39700457209](https://github.com/xtincell/project_spawt_mobile_ci/actions/runs/39700457209) verte, nginx réel compris.

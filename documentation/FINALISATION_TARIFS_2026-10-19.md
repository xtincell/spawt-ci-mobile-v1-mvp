# Finalisation GitHub — 19 octobre 2026

## Périmètre repris

- Produit : PR 17 (Firebase) et PR 18 (tarifs), intégrées dans `codex/audit-admin-commentaires`, base `886aa02`.
- Vitrine : PR 12 (CGU/CGV sans montant), intégrée dans `codex/android-download-channel`, base `5c51489`.
- Au contrôle initial, le serveur était à 0078 ; la console servait `47cc174`, la vitrine `5dc7357`. Le Gold lieu était encore à 65 000 HT / 76 700 TTC malgré la PR fusionnée.

## Correctifs

- 0079 conservée : catalogue TTC administrable, Gold lieu 60 000 = 50 847 HT + 9 153 TVA, prix figé au checkout, factures historiques conservées.
- 0080 : 23 actions du journal du panel rétablies après leur retrait involontaire par des contraintes plus anciennes. RLS, rôles et immutabilité restent appliqués.
- 0081 : après vérification du prestataire, une RPC réservée à `service_role` verrouille l'abonnement et confirme ensemble l'abonnement, le rôle B2B et la facture. Une erreur annule tout et permet la reprise. Ni un montant différent, ni une autre devise, ni le rejeu d'un abonnement expiré n'ouvre de droit.
- Webhook : refus explicite des montants/devise incorrects ; absence de devise non transformée en XOF ; corps vide identifié ; erreurs SQL renvoyées pour reprise. Checkout : prévol navigateur avec `x-client-info`.
- App build 36 : retrait du prix Gold écrit en dur dans le message hors zone. Le catalogue reste la source tarifaire.
- Console : rappel du préavis tarifaire de 30 jours figurant aux CGV.
- Vitrine : suppression de la remise annuelle supposée et des liens `/pro` et `/compte` absents du routeur. Souscription en ligne annoncée comme non ouverte ; contact existant conservé.

## Validation avant déploiement

- App : typecheck, vocabulaire, i18n ; 1 085 tests réussis, 4 ignorés. CI source `39175282461` verte.
- Admin : lint, 226 tests, build réussis.
- Paiement : 92 tests Deno avec vérification des types ; dépendances verrouillées, workflow GitHub dédié.
- PostgreSQL 15 isolé : reconstruction depuis 0001 avec objets de plateforme simulés et catalogue seedé après 0002 ; quatre suites SQL, descente 0081/0080/0079, remontée et quatre suites rejouées. Aucun accès de production dans ce test.
- Vitrine : typecheck, vocabulaire, 48 tests et build réussis.

## Limites et suivi

Au contrôle initial : aucun abonnement, facture ni paiement manuel ; identifiants CinetPay absents. Les tests ne prouvent pas un encaissement réel. Aucune campagne, notification ou transaction réelle n'est envoyée pour la recette.

Le build 36 (`76fb9be`, compilation `39175490281`) est en cours. Les résultats de sauvegarde, déploiement, recette navigateur et publication seront ajoutés après contrôle ; cette section ne vaut pas attestation de déploiement.

## Mise en production et reprise du serveur

- Sauvegarde PostgreSQL CUSTOM du 19 octobre (heure Lagos) : 4 189 612 octets ; liste d'archive contrôlée, tables métier et Auth présentes.
- Migrations 0079–0081 appliquées ensemble ; Gold lieu 60 000 TTC, autres prix inchangés. Quatre suites SQL exécutées sur le serveur puis annulées : aucun abonnement, facture ou paiement de test conservé.
- L'ancienne recette `manual_payments.sql` ignorait les erreurs et contenait un identifiant admin à remplacer. Elle est désormais autonome, avec assertions bloquantes, et a été rejouée localement et sur la base réelle.
- Console `231b7d1` et vitrine `5201785` déployées. Recette Xtincell : catalogue, aperçu avant/après et motif obligatoire, annulation sans modification, paiements, actualités et activité. CGU/CGV publiques vérifiées. Aucune erreur API/JavaScript ; session temporaire clôturée.
- Sept fichiers de paiement rechargés ; Auth répond 200, méthodes GET des fonctions 405 attendus, prévol checkout 204 avec `x-client-info`.
- Incident d'exploitation : le redémarrage global via Coolify 4.1.2 a arrêté le stack sans le relancer, avec une interruption d'environ dix minutes (23:23–23:33 UTC le 18 octobre). Les conteneurs existants et leurs volumes ont été relancés directement via un outil de maintenance temporaire sans domaine public. Les 155 fiches et l'absence de paiements ont été recontrôlées. Le repli vers un redémarrage global a été retiré de `deploy-edge-functions.mjs` ; seul le conteneur Edge doit être rechargé. Coolify retire également le saut de ligne final des fichiers : la comparaison en tient compte.

La compilation Android 36 et sa recette restent suivies ci-dessous ; elles sont distinctes de la mise à jour du serveur.

L'outil de maintenance temporaire a été supprimé, ses montages retirés et sa suppression confirmée par l'API. Les empreintes des sept fichiers ont été contrôlées **dans le conteneur Edge en cours d'exécution**. Le stack est revenu à `running:healthy`.

La CI SQL attend désormais le serveur TCP PostgreSQL définitif : le serveur temporaire d'initialisation pouvait donner un faux signal de disponibilité. Le workflow paiement `39177223856` est vert après ce correctif. Preuves sans identifiants dans `finalisation-tarifs-proof.json`.

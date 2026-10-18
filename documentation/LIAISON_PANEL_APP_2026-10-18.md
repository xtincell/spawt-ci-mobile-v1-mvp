# Liaison panel / application — 18 octobre 2026

La console gère désormais les actualités et informations du fil mobile, en plus des lieux, avis éditoriaux, carnets, événements et promotions. Une publication peut être préparée en brouillon, programmée (heure UTC/Abidjan), corrigée, retirée et supprimée. Les écritures sont historisées ; une modification concurrente est refusée.

L’app recharge les surfaces concernées au retour au premier plan et lorsqu’une sonde commune détecte un changement serveur. Sonde toutes les 30 secondes au premier plan ; le temps serveur invalide aussi à chaque minute pour les débuts/fins programmés. Aucune note de recherche privée n’est transmise. Un retrait est reflété à la prochaine lecture réussie ; hors connexion, la dernière lecture peut rester affichée.

La page **Activité dans l’app** reçoit à partir du build 34 un signal authentifié par appareil au premier plan, toutes les 60 secondes. « En cours » expire après 90 secondes. La page expose dernière activité, version/build, statut d’enregistrement push, nombre d’appareils enregistrés sur le compte et écritures du compte en attente. Ce n’est pas un inventaire de sessions d’authentification ni une preuve de lecture à la seconde. Les anciennes versions n’émettent pas ce signal.

La page **Push** estime les cibles côté serveur, permet un compte précis ou les segments existants, et prépare un lien depuis une actualité enregistrée. Les lectures sont paginées ; une erreur de filtre n’élargit jamais le public. Une réservation SQL précède l’envoi, protège contre les doublons et applique la limite de trois campagnes quotidiennes, même en concurrence. Les résultats sont conservés dans `push_campaigns`, car l’ancien CHECK de `admin_audit_log.action` refusait `push_campaign`. `sent` signifie **accepté par Expo**, pas reçu/lu. Un état `sending` persistant doit être vérifié sans renvoi automatique.

## Données et déploiement

- Migrations 0077/0078 appliquées le 18/10 après sauvegarde PostgreSQL complète de 4 159 611 octets : `/var/lib/postgresql/data/spawt-backups/before-console-bridge-20261018.dump`.
- 155 lieux conservés, dont 145 brouillons sans note et dix publics ; dix avis éditoriaux Xtincell et trois carnets publiés conservés.
- Le chemin d’écriture des avis reste la file durable livrée en build 32 : un échec reste en attente, avec reprise. Les commentaires éventuellement absents du serveur ne peuvent pas être reconstitués sans leur texte local.

## Limite d’accès vérifiée

Aucun jeton push n’existe en production au début de cette intervention. Aucun `google-services.json` ni `android.googleServicesFile` n’est configuré dans la source, aucun fichier correspondant trouvé dans le Drive. La configuration Firebase Android et le compte de service FCM v1 dans Expo restent requis pour joindre des téléphones. Aucun message de campagne n’a été diffusé pendant la recette. Le fil d’actualités fonctionne par lecture de l’API indépendamment des notifications système.

## Vérifications

Tests SQL avec rôles réels (PGlite), tests mobile/admin, tests Edge isolés, recette HTTP/browser et preuves de déploiement consignées lors de la livraison. La compilation APK ne remplace pas une réception physique Android/iOS.

La recette a détecté puis corrigé la redirection prématurée des liens Explore pendant le chargement des fonctionnalités. Le build 33 a été annulé avant livraison ; le build 34 inclut cette correction et charge les fonctionnalités indépendamment du Guet.
